import { randomBytes } from "node:crypto";

import { Client } from "pg";

/**
 * Test harness for the DB layer.
 *
 * These tests run against a REAL local Supabase Postgres (`supabase start`).
 * They deliberately do NOT skip when the database is unreachable: a database
 * test that silently passes without a database reads as coverage while proving
 * nothing, which is worse than having no test at all.
 */

/** Connection string for the local Supabase Postgres instance. */
export const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Base URL of the local Supabase API gateway (PostgREST + Auth). */
export const LOCAL_API_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

/**
 * Opens a connection, runs `body`, and always closes the connection.
 *
 * A connection failure is re-thrown with an actionable message so the cause is
 * never mistaken for a schema defect.
 */
export async function withDb<T>(body: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: LOCAL_DB_URL });

  try {
    await db.connect();
  } catch (cause) {
    throw new Error(
      `Cannot reach the local Supabase database at ${LOCAL_DB_URL}. ` +
        "Run `supabase start` before the DB test suite. " +
        `Underlying error: ${(cause as Error).message}`,
    );
  }

  try {
    return await body(db);
  } finally {
    await db.end();
  }
}

/**
 * Runs `body` inside a transaction that is ALWAYS rolled back.
 *
 * Every DB test therefore leaves the database exactly as it found it, so the
 * suite is order-independent and repeatable without a reset between runs.
 */
export async function withRollback<T>(
  body: (db: Client) => Promise<T>,
): Promise<T> {
  return withDb(async (db) => {
    await db.query("begin");
    try {
      return await body(db);
    } finally {
      await db.query("rollback");
    }
  });
}

/** Captures the error message raised by `body`, or `null` when it succeeded. */
export async function captureError(
  body: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await body();
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Inserts a sender and returns its id. Fabricated contact number only.
 *
 * The identity suffix is random for the same reason `makeSlug` is: parallel
 * spec files must not collide on `senders.allowlisted_email`.
 */
export async function seedSender(db: Client): Promise<string> {
  const suffix = randomBytes(4).toString("hex");
  const result = await db.query<{ id: string }>(
    `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
     values ($1, 'partner_a', $2, $3)
     returning id`,
    [
      `Test Sender ${suffix}`,
      `sender.${suffix}.${Date.now()}@example.test`,
      `+5730055${randomBytes(2).toString("hex").replace(/\D/g, "0").padEnd(4, "0")}`,
    ],
  );

  return result.rows[0].id;
}

/** Base32 alphabet the `invitations.slug` CHECK constraint accepts. */
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * Builds a well-formed 16-char `[a-z2-7]` slug for a test fixture.
 *
 * Random rather than sequential on purpose. Vitest runs spec files in parallel
 * worker threads, each with its own copy of this module, so a per-module
 * counter produces the SAME slug in two files at once and collides on the
 * `invitations.slug` unique index. That failure is invisible when a file runs
 * alone and appears only in a full-suite run.
 */
function makeSlug(): string {
  const bytes = randomBytes(16);
  let slug = "";

  for (const byte of bytes) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }

  return slug;
}

/** Inserts an invitation owned by `ownerSenderId` and returns its id. */
export async function seedInvitation(
  db: Client,
  ownerSenderId: string,
  seatsAllowed = 4,
): Promise<string> {
  const slug = makeSlug();
  const result = await db.query<{ id: string }>(
    `insert into invitations (slug, owner_sender_id, display_name, greeting_name, seats_allowed)
     values ($1, $2, 'Familia Prueba', 'Familia Prueba', $3)
     returning id`,
    [slug, ownerSenderId, seatsAllowed],
  );

  return result.rows[0].id;
}

/** The six tables this change owns. Every one must be default-deny. */
export const OWNED_TABLES = [
  "senders",
  "invitations",
  "invitation_guests",
  "dispatch_events",
  "rsvp_responses",
  "gate_attempts",
] as const;

/**
 * Seeds one committed row in every owned table, runs `body`, then removes them.
 *
 * Committed (not rolled back) because the anon-key checks reach Postgres over
 * HTTP through PostgREST on a separate connection, so an uncommitted fixture
 * would be invisible to them and "no rows returned" would prove nothing.
 *
 * Cleanup runs with `session_replication_role = replica`, which suspends user
 * triggers for this session only. That is required because `dispatch_events`
 * and `rsvp_responses` are append-only by trigger and would otherwise refuse
 * their own fixture teardown, including via ON DELETE CASCADE.
 */
export async function withSeededData<T>(
  body: (ids: { senderId: string; invitationId: string }) => Promise<T>,
): Promise<T> {
  return withDb(async (db) => {
    const senderId = await seedSender(db);
    const invitationId = await seedInvitation(db, senderId);

    await db.query(
      `insert into invitation_guests (invitation_id, full_name, phone_e164)
       values ($1, 'Seeded Guest', '+573005550000')`,
      [invitationId],
    );
    await db.query(
      `insert into dispatch_events (invitation_id, actor_sender_id, kind)
       values ($1, $2, 'marked_sent')`,
      [invitationId, senderId],
    );
    await db.query(
      `insert into rsvp_responses (invitation_id, attending, seats_confirmed)
       values ($1, true, 1)`,
      [invitationId],
    );
    await db.query(
      `insert into gate_attempts (invitation_id, ip_hash, succeeded)
       values ($1, 'ffffffffffffffffffffffffffffffff', false)`,
      [invitationId],
    );

    try {
      return await body({ senderId, invitationId });
    } finally {
      await db.query("set session_replication_role = replica");
      await db.query("delete from gate_attempts where invitation_id = $1", [
        invitationId,
      ]);
      await db.query("delete from rsvp_responses where invitation_id = $1", [
        invitationId,
      ]);
      await db.query("delete from dispatch_events where invitation_id = $1", [
        invitationId,
      ]);
      await db.query("delete from invitation_guests where invitation_id = $1", [
        invitationId,
      ]);
      await db.query("delete from invitations where id = $1", [invitationId]);
      await db.query("delete from senders where id = $1", [senderId]);
      await db.query("reset session_replication_role");
    }
  });
}
