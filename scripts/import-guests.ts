/**
 * Imports the guest list into Supabase.
 *
 * USAGE
 *
 *   1. Create `data/guests.source.json`. This file is git-ignored and MUST
 *      stay that way: it holds real guest phone numbers, and no real number
 *      may ever enter the repository, a fixture, a seed, or a log.
 *   2. Export the environment this script needs:
 *        SUPABASE_URL, SUPABASE_SECRET_KEY, DEFAULT_PHONE_COUNTRY
 *   3. Run it:
 *        npx tsx scripts/import-guests.ts            # validate and import
 *        npx tsx scripts/import-guests.ts --dry-run  # validate only, no writes
 *
 * SOURCE FORMAT
 *
 *   {
 *     "invitations": [
 *       {
 *         "ownerEmail": "ana@example.test",   // must match senders.allowlisted_email
 *         "displayName": "Familia Restrepo",
 *         "greetingName": "Familia Restrepo",
 *         "sourceKey": "restrepo-bogota",     // optional, see below
 *         "guests": [
 *           { "fullName": "Ana Restrepo", "phone": "3001234567", "isPrimary": true },
 *           { "fullName": "Niño Restrepo", "isChild": true }
 *         ]
 *       }
 *     ]
 *   }
 *
 * ATOMIC AND RE-RUNNABLE
 *
 * Validation runs over EVERY row before a single write happens, and the write
 * itself is one transaction: either every household lands or none does. There
 * is no state in which some invitations exist and some do not.
 *
 * Re-running the same source is therefore the normal way to recover from a
 * failure. Each household is keyed by `sourceKey`, defaulting to owner email +
 * display name, and one that already exists is skipped rather than duplicated.
 * Supply an explicit `sourceKey` only when two genuinely different households
 * share an owner AND a display name — the import refuses the file in that case
 * instead of quietly importing one of them.
 *
 * Editing a row and re-running does NOT update the existing invitation; it is
 * recognized by its key and skipped. Correcting an already-imported household
 * is a deliberate act against that row, not a side effect of the importer.
 */

import { readFileSync } from "node:fs";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  classifyPhoneDispatchability,
  type PhoneLineType,
} from "@/lib/domain/phone-reachability";
import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import {
  importInvitations,
  listSenderDirectory,
  validateImportRows,
  type ImportedInvitation,
  type ImportRow,
  type NewInvitation,
} from "@/lib/server/invitations";
import { warmOgCard } from "@/lib/server/og-warm";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/** Repo-relative path of the untracked guest source. Git-ignored by design. */
export const GUEST_SOURCE_PATH = "data/guests.source.json";

/**
 * One guest row of the source file.
 *
 * STRICT, and that is the one-way door. A source file in the old format carries
 * a seats column and no `nickname`; there is no longer a stored seat allowance
 * for it to populate, because the member count IS the cap since migration 0012.
 * Accepting the file and ignoring the column is how a stale source imports
 * wrong data while reporting success, so an unknown key is a rejection that
 * names the key.
 */
const importGuestSchema = z.strictObject({
  fullName: z.string(),
  nickname: z.string().nullish(),
  phone: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isChild: z.boolean().optional(),
});

const importRowSchema = z.strictObject({
  ownerEmail: z.string(),
  displayName: z.string(),
  greetingName: z.string(),
  sourceKey: z.string().optional(),
  guests: z.array(importGuestSchema),
});

/**
 * Renders one issue's path in the source file's own terms.
 *
 * `invitations` is prepended because the schema is applied to the array, not to
 * the wrapper, and a path starting at `[7]` names a position in a file the
 * operator has to open by hand. Field names are rendered the way every other
 * message from this importer renders them — `full_name`, not `fullName` —
 * because `validateImportRow` has always spoken in column names and two
 * vocabularies for one field is one more than an operator can be asked to hold.
 */
function issuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((rendered, segment) => {
    if (typeof segment === "number") {
      return `${rendered}[${segment}]`;
    }

    return `${rendered}.${String(segment).replace(/[A-Z]/g, (upper) => `_${upper.toLowerCase()}`)}`;
  }, "invitations");
}

/**
 * The first issue, in the file's terms — never all of them.
 *
 * `ZodError.issues` for a malformed array is dominated by cascade noise from
 * the first bad row, and the requirement's whole point is stopping at the row
 * that introduced the problem. Zod's own message already reads
 * "Invalid input: expected string, received number"; only the redundant prefix
 * is removed, so the two halves of the sentence can never drift apart.
 */
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];

  return `${GUEST_SOURCE_PATH} → ${issuePath(issue.path)}: ${issue.message.replace(/^Invalid input:\s*/, "")}`;
}

/** Parses the raw source file contents into import rows. Pure and testable. */
export function parseGuestSource(contents: string): ImportRow[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch (cause) {
    throw new Error(
      `${GUEST_SOURCE_PATH} is not valid JSON: ${(cause as Error).message}`,
    );
  }

  const invitations = (parsed as { invitations?: unknown })?.invitations;

  if (!Array.isArray(invitations)) {
    throw new Error(
      `${GUEST_SOURCE_PATH} must contain an "invitations" array at the top level.`,
    );
  }

  if (invitations.length === 0) {
    throw new Error(
      `${GUEST_SOURCE_PATH} contains no invitations. Refusing to report a successful import of nothing.`,
    );
  }

  // D22. This used to be `return invitations as ImportRow[]`, an unchecked cast
  // over a value that had been checked only for being a non-empty array. Every
  // malformed row past that point failed somewhere downstream as a bare
  // TypeError naming no row, no field and no file.
  const parsedRows = z.array(importRowSchema).safeParse(invitations);

  if (!parsedRows.success) {
    throw new Error(firstIssueMessage(parsedRows.error));
  }

  return parsedRows.data;
}

/** One guest whose stored number cannot receive a WhatsApp message. */
export interface UndispatchableGuest {
  readonly displayName: string;
  readonly fullName: string;
  readonly lineType: PhoneLineType;
}

export interface ImportAdvisory {
  readonly householdCount: number;
  readonly guestCount: number;
  readonly undispatchablePhones: readonly UndispatchableGuest[];
}

/**
 * Inspects a validated guest list for the fault that stays invisible until the
 * day it matters. Pure: it reads the rows and writes nothing.
 *
 * ADVISORY, never a rejection. The import is atomic, so refusing the file over
 * one aunt's landline would refuse the entire guest list, and a landline guest
 * is still a real guest — they open their own invitation at the phone gate, they
 * simply receive the link some other way. What must not happen is the product
 * building a `wa.me` link from that number, recording a dispatch event and
 * reporting it as sent while the message reaches nothing.
 *
 * There used to be a second advisory here, reporting a household whose stored
 * seat allowance disagreed with the number of names entered. Migration 0012
 * removed the possibility rather than the warning: the member count IS the
 * allowance, so the two can no longer disagree and there is nothing left to
 * report.
 */
export function buildImportAdvisory(
  invitations: readonly NewInvitation[],
  defaultCountry: string,
): ImportAdvisory {
  const undispatchablePhones: UndispatchableGuest[] = [];
  let guestCount = 0;

  for (const invitation of invitations) {
    guestCount += invitation.guests.length;

    for (const guest of invitation.guests) {
      if (guest.phoneE164 === null) {
        // No phone is not a broken phone: a child or a household member who
        // shares the link has no dispatch that could fail.
        continue;
      }

      const { dispatchable, lineType } = classifyPhoneDispatchability(
        guest.phoneE164,
        defaultCountry,
      );

      if (!dispatchable) {
        undispatchablePhones.push({
          displayName: invitation.displayName ?? invitation.greetingName,
          fullName: guest.fullName,
          lineType,
        });
      }
    }
  }

  return {
    householdCount: invitations.length,
    guestCount,
    undispatchablePhones,
  };
}

/**
 * Renders the advisory as console lines.
 *
 * Names are included because an operator cannot fix a row they cannot find, and
 * the import already names households in its error messages. Digits never are:
 * this output reaches logs, and a phone number is personal data.
 */
export function formatImportAdvisory(advisory: ImportAdvisory): string[] {
  const lines: string[] = [];

  if (advisory.undispatchablePhones.length === 0) {
    lines.push(
      `Reachability: every stored phone can receive WhatsApp (${advisory.guestCount} guests checked).`,
    );
  } else {
    lines.push(
      `Reachability: ${advisory.undispatchablePhones.length} of ${advisory.guestCount} stored phones CANNOT receive WhatsApp. ` +
        "Their invitations must be delivered another way; do not report them as sent.",
    );
    for (const guest of advisory.undispatchablePhones) {
      lines.push(
        `  - ${guest.displayName} / ${guest.fullName}: ${guest.lineType}`,
      );
    }
  }

  return lines;
}

/** The warming call, injectable so the import can be tested without a network. */
export type WarmCard = (
  client: SupabaseClient,
  slug: string,
) => Promise<boolean>;

/**
 * Warms the Open Graph card of every household this run actually created.
 *
 * Only the created ones: `next/og` answers immutable, so a household that was
 * already present had its card warmed when it was first created and re-fetching
 * it buys nothing.
 *
 * Runs AFTER the import transaction has committed, and its outcome cannot
 * affect that transaction. A failed warm leaves `og_warmed_at` null, which the
 * console surfaces as a "preview not warmed" badge — and previewing warms it,
 * so the badge clears by itself the first time an operator looks at the row.
 */
export async function warmCreatedInvitations(
  client: SupabaseClient,
  imported: readonly ImportedInvitation[],
  warm: WarmCard = warmOgCard,
): Promise<number> {
  let warmed = 0;

  // Sequential on purpose: this is a courtesy pass over a few hundred rows at
  // most, and a burst of parallel cold generations is exactly the load the
  // strategy exists to avoid.
  for (const invitation of imported) {
    if (!invitation.created) {
      continue;
    }

    if (await warm(client, invitation.slug)) {
      warmed += 1;
    }
  }

  return warmed;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const rows = parseGuestSource(readFileSync(GUEST_SOURCE_PATH, "utf8"));

  const client = createServerSupabaseClient();
  const senders = await listSenderDirectory(client);
  const defaultCountry = requiredDefaultPhoneCountry();

  // Validate everything first. This catches an unusable row without touching
  // the database at all; the write itself is atomic regardless.
  const validated = validateImportRows(rows, senders, defaultCountry);

  // Reported before the write, so `--dry-run` surfaces it too and an operator
  // can correct the source before a single household lands.
  for (const line of formatImportAdvisory(
    buildImportAdvisory(validated, defaultCountry),
  )) {
    console.log(line);
  }

  if (dryRun) {
    console.log(
      `Validated ${validated.length} invitations. No rows were written (--dry-run).`,
    );
    return;
  }

  // One call, one transaction. Either every household lands or none does.
  const imported = await importInvitations(client, validated);

  for (const invitation of imported) {
    // Slug only. Never a guest name and never a phone: this output reaches logs.
    console.log(
      invitation.created
        ? `Created invitation ${invitation.slug}`
        : `Already present, skipped: ${invitation.slug}`,
    );
  }

  const created = imported.filter((invitation) => invitation.created).length;
  console.log(
    `Imported ${created} new invitations; ${imported.length - created} were already present.`,
  );

  // Everything below is best-effort. The import is already committed.
  const warmed = await warmCreatedInvitations(client, imported);
  console.log(
    `Warmed ${warmed} of ${created} preview cards. Any that failed warm themselves the first time they are previewed.`,
  );
}

// `import.meta.main` is not available on every Node version this may run on, so
// the entry point is guarded by argv instead of by a module-identity check.
if (process.argv[1]?.endsWith("import-guests.ts")) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
