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
 *         "guests": [
 *           { "fullName": "Ana Restrepo", "phone": "3001234567", "isPrimary": true },
 *           { "fullName": "Niño Restrepo", "isChild": true }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Validation runs over EVERY row before a single write happens. An unrecognized
 * owner or an unnormalizable phone aborts the whole import, because a partially
 * imported guest list is harder to reason about than one that never started.
 */

import { readFileSync } from "node:fs";

import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import {
  createInvitation,
  listSenderDirectory,
  validateImportRow,
  type ImportRow,
} from "@/lib/server/invitations";
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

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const rows = parseGuestSource(readFileSync(GUEST_SOURCE_PATH, "utf8"));

  const client = createServerSupabaseClient();
  const senders = await listSenderDirectory(client);
  const defaultCountry = requiredDefaultPhoneCountry();

  // Validate everything first: a partially imported guest list is worse than
  // one that never started.
  const validated = rows.map((row) =>
    validateImportRow(row, senders, defaultCountry),
  );

  if (dryRun) {
    console.log(
      `Validated ${validated.length} invitations. No rows were written (--dry-run).`,
    );
    return;
  }

  for (const invitation of validated) {
    const created = await createInvitation(client, invitation);
    // Slug only. Never a guest name and never a phone: this output reaches logs.
    console.log(`Created invitation ${created.slug}`);
  }

  console.log(`Imported ${validated.length} invitations.`);
}

// `import.meta.main` is not available on every Node version this may run on, so
// the entry point is guarded by argv instead of by a module-identity check.
if (process.argv[1]?.endsWith("import-guests.ts")) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
