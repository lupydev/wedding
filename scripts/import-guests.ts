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
 *         "seatsAllowed": 3,
 *         "rsvpDeadline": "2026-05-01",       // optional
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

  return invitations as ImportRow[];
}

/** One guest whose stored number cannot receive a WhatsApp message. */
export interface UndispatchableGuest {
  readonly displayName: string;
  readonly fullName: string;
  readonly lineType: PhoneLineType;
}

/** One household whose seat allowance disagrees with the names entered. */
export interface SeatMismatch {
  readonly displayName: string;
  readonly seatsAllowed: number;
  readonly namedGuests: number;
}

export interface ImportAdvisory {
  readonly householdCount: number;
  readonly guestCount: number;
  readonly undispatchablePhones: readonly UndispatchableGuest[];
  readonly seatMismatches: readonly SeatMismatch[];
}

/**
 * Inspects a validated guest list for the two faults that stay invisible until
 * the day they matter. Pure: it reads the rows and writes nothing.
 *
 * ADVISORY, never a rejection. The import is atomic, so refusing the file over
 * one aunt's landline would refuse the entire guest list, and a landline guest
 * is still a real guest — they open their own invitation at the phone gate, they
 * simply receive the link some other way. What must not happen is the product
 * building a `wa.me` link from that number, recording a dispatch event and
 * reporting it as sent while the message reaches nothing.
 *
 * The seat check exists because every seat in this guest list corresponds to a
 * named person. A household whose `seats_allowed` disagrees with the number of
 * names is therefore a data-entry typo, and it surfaces later as a guest who
 * cannot confirm their own household. It is not a database constraint on
 * purpose: a partially entered household must still be savable.
 */
export function buildImportAdvisory(
  invitations: readonly NewInvitation[],
  defaultCountry: string,
): ImportAdvisory {
  const undispatchablePhones: UndispatchableGuest[] = [];
  const seatMismatches: SeatMismatch[] = [];
  let guestCount = 0;

  for (const invitation of invitations) {
    guestCount += invitation.guests.length;

    if (invitation.seatsAllowed !== invitation.guests.length) {
      seatMismatches.push({
        displayName: invitation.displayName,
        seatsAllowed: invitation.seatsAllowed,
        namedGuests: invitation.guests.length,
      });
    }

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
          displayName: invitation.displayName,
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
    seatMismatches,
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

  if (advisory.seatMismatches.length > 0) {
    lines.push(
      `Seats: ${advisory.seatMismatches.length} of ${advisory.householdCount} households name a number of guests that differs from their seat allowance.`,
    );
    for (const mismatch of advisory.seatMismatches) {
      lines.push(
        `  - ${mismatch.displayName}: seats_allowed ${mismatch.seatsAllowed}, names entered ${mismatch.namedGuests}`,
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
