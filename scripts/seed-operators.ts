/**
 * Creates or updates the console operators.
 *
 * USAGE
 *
 *   1. Create `data/operators.source.json`. This file is git-ignored and MUST
 *      stay that way: it holds the operators' real addresses and WhatsApp
 *      contact numbers, and neither may ever enter the repository, a fixture,
 *      a seed, or a log.
 *   2. Export the environment this script needs:
 *        SUPABASE_URL, SUPABASE_SECRET_KEY
 *      plus one variable per operator holding that operator's password, named
 *      by the row's `passwordEnv`:
 *        OPERATOR_PASSWORD_A, OPERATOR_PASSWORD_B, ...
 *   3. Run it:
 *        npm run seed:operators             # create or update
 *        npm run seed:operators -- --dry-run  # validate only, no writes
 *
 * THE PASSWORD IS PASSED AT RUN TIME AND IS NEVER STORED IN THE REPOSITORY.
 *
 * It is read from the environment, never from the source file and never from
 * `process.argv`. Not the source file, because that is a file on disk that a
 * maintainer edits by hand and that one `git add -f` would commit — a row
 * carrying a literal `password` key is REFUSED, naming `passwordEnv` instead.
 * Not argv, because arguments are visible to every other process on the machine
 * through `ps`. Nothing in this script ever prints a password, including in its
 * error messages, and the environment variable is named but never echoed.
 *
 * SOURCE FORMAT
 *
 *   {
 *     "operators": [
 *       {
 *         "displayName": "Ana",
 *         "role": "partner_a",                  // partner_a | partner_b | helper
 *         "email": "ana@example.test",          // becomes senders.allowlisted_email
 *         "contactPhone": "+573019900001",      // E.164; the "I cannot get in" contact
 *         "passwordEnv": "OPERATOR_PASSWORD_A"  // the variable, NOT the password
 *       }
 *     ]
 *   }
 *
 * RE-RUNNABLE, AND THAT IS THE RESET PATH
 *
 * Validation runs over every row before a single write happens, and seeding is
 * idempotent by address: running it twice leaves exactly one auth user and
 * exactly one `senders` row, and reports the second run as an update.
 *
 * The product has no sign-up and no self-service password reset, deliberately —
 * a reset flow mails a capability over every guest's phone number to whoever
 * controls that mailbox today. A forgotten password is a maintainer exporting a
 * new one and running this again.
 */

import { readFileSync } from "node:fs";

import { normalizeAllowlistEmail } from "@/lib/domain/operator-session";
import {
  seedOperator,
  type OperatorSeedInput,
  type OperatorSeedOutcome,
} from "@/lib/server/operators";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/** Repo-relative path of the untracked operator source. Git-ignored by design. */
export const OPERATOR_SOURCE_PATH = "data/operators.source.json";

/** The shortest password this tool will provision. */
export const MINIMUM_PASSWORD_LENGTH = 12;

/** The roles `senders.role` accepts. */
const ROLES = ["partner_a", "partner_b", "helper"] as const;

/** E.164, matching the `senders.contact_wa_phone_e164` CHECK exactly. */
const E164 = /^\+[1-9][0-9]{7,14}$/;

/** One operator, as the untracked source file describes them. */
export interface OperatorSourceRow {
  readonly displayName: string;
  readonly role: string;
  readonly email: string;
  readonly contactPhone: string;
  /** The NAME of the environment variable holding this operator's password. */
  readonly passwordEnv: string;
}

/** Parses the raw source file contents into rows. Pure and testable. */
export function parseOperatorSource(contents: string): OperatorSourceRow[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch (cause) {
    throw new Error(
      `${OPERATOR_SOURCE_PATH} is not valid JSON: ${(cause as Error).message}`,
    );
  }

  const operators = (parsed as { operators?: unknown })?.operators;

  if (!Array.isArray(operators)) {
    throw new Error(
      `${OPERATOR_SOURCE_PATH} must contain an "operators" array at the top level.`,
    );
  }

  if (operators.length === 0) {
    throw new Error(
      `${OPERATOR_SOURCE_PATH} contains no operators. Refusing to report a successful seeding of nothing.`,
    );
  }

  return operators as OperatorSourceRow[];
}

/** The environment, as this tool reads it. */
export type PasswordEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Validates every row and resolves its password from the environment.
 *
 * Throws on the FIRST fault, before any row is returned, so a file with one bad
 * entry writes nothing at all rather than half an operator list. Every message
 * names the operator by display name and never carries a password.
 */
export function resolveOperatorSeeds(
  rows: readonly OperatorSourceRow[],
  env: PasswordEnvironment,
): OperatorSeedInput[] {
  const seeds: OperatorSeedInput[] = [];
  const seenEmails = new Set<string>();
  const seenPasswordEnvs = new Set<string>();

  for (const row of rows) {
    const displayName = row?.displayName?.trim?.() ?? "";

    if (displayName === "") {
      throw new Error(
        `Every operator needs a displayName: it is what every message about that row is keyed by. ${OPERATOR_SOURCE_PATH}`,
      );
    }

    if ("password" in (row as unknown as Record<string, unknown>)) {
      throw new Error(
        `${displayName}: a password must never be written into ${OPERATOR_SOURCE_PATH}. ` +
          'Remove the "password" key and give "passwordEnv" the NAME of an environment variable instead.',
      );
    }

    const role = row.role;

    if (!(ROLES as readonly string[]).includes(role)) {
      throw new Error(
        `${displayName}: role must be one of ${ROLES.join(", ")}. Received: ${role}`,
      );
    }

    const allowlistedEmail = normalizeAllowlistEmail(row.email);

    if (allowlistedEmail === null) {
      throw new Error(
        `${displayName}: email is not a well-formed address, so it can never match senders.allowlisted_email.`,
      );
    }

    if (seenEmails.has(allowlistedEmail)) {
      throw new Error(
        `${allowlistedEmail} appears twice in ${OPERATOR_SOURCE_PATH}. One address is one operator.`,
      );
    }

    const contactPhone = row.contactPhone?.trim?.() ?? "";

    if (!E164.test(contactPhone)) {
      throw new Error(
        `${displayName}: contactPhone must be E.164, for example +573001234567. ` +
          "It is the number a guest who cannot get in is told to write to.",
      );
    }

    const passwordEnv = row.passwordEnv?.trim?.() ?? "";

    if (passwordEnv === "") {
      throw new Error(
        `${displayName}: passwordEnv must name the environment variable holding this operator's password.`,
      );
    }

    if (seenPasswordEnvs.has(passwordEnv)) {
      throw new Error(
        `${passwordEnv} is claimed by more than one operator. Two operators sharing one password are one account wearing two names.`,
      );
    }

    const password = env[passwordEnv] ?? "";

    if (password === "") {
      throw new Error(
        `${displayName}: ${passwordEnv} is not set. Export it before running this script; it is never read from the source file.`,
      );
    }

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      // The length is named, the password is not.
      throw new Error(
        `${displayName}: ${passwordEnv} is shorter than ${MINIMUM_PASSWORD_LENGTH} characters.`,
      );
    }

    seenEmails.add(allowlistedEmail);
    seenPasswordEnvs.add(passwordEnv);
    seeds.push({
      displayName,
      role: role as OperatorSeedInput["role"],
      allowlistedEmail,
      contactPhone,
      password,
    });
  }

  return seeds;
}

/**
 * Renders the outcome as console lines.
 *
 * Display names only. No address, no phone number, and never a password: this
 * output reaches a terminal and a scrollback buffer, and out of two operators a
 * display name is enough to tell which row is which.
 */
export function formatSeedOutcomes(
  outcomes: readonly OperatorSeedOutcome[],
): string[] {
  const lines = outcomes.map((outcome) => {
    const created = outcome.authUserCreated || outcome.senderCreated;

    return created
      ? `  - ${outcome.displayName}: created`
      : `  - ${outcome.displayName}: already present, updated in place`;
  });

  const created = outcomes.filter(
    (outcome) => outcome.authUserCreated || outcome.senderCreated,
  ).length;

  lines.push(
    `Seeded ${outcomes.length} operators: ${created} created, ${outcomes.length - created} updated.`,
  );

  return lines;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const rows = parseOperatorSource(readFileSync(OPERATOR_SOURCE_PATH, "utf8"));

  // Everything is validated before a single write happens, so `--dry-run`
  // catches an unusable file without touching Supabase at all.
  const seeds = resolveOperatorSeeds(rows, process.env);

  if (dryRun) {
    console.log(
      `Validated ${seeds.length} operators. Nothing was written (--dry-run).`,
    );
    return;
  }

  const client = createServerSupabaseClient();
  const outcomes: OperatorSeedOutcome[] = [];

  // Sequential: this is two rows, and a failure part way through should leave a
  // clear "these are done, that one is not" rather than an interleaved report.
  for (const seed of seeds) {
    outcomes.push(await seedOperator(client, seed));
  }

  for (const line of formatSeedOutcomes(outcomes)) {
    console.log(line);
  }
}

// `import.meta.main` is not available on every Node version this may run on, so
// the entry point is guarded by argv instead of by a module-identity check.
if (process.argv[1]?.endsWith("seed-operators.ts")) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
