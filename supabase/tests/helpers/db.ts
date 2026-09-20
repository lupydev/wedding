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

/**
 * Runs `body` in a rolled-back transaction holding every table it can touch.
 *
 * For a test that runs real DDL — a migration or a down script — against the
 * shared local database.
 *
 * WHY THIS EXISTS: A DEADLOCK, NOT A TIMEOUT.
 *
 * A script like this takes ACCESS EXCLUSIVE on `invitations` and then goes on to
 * touch `invitation_guests`. Fixture helpers do it the other way round, and some
 * of them commit rather than roll back — `withSeededData` deliberately so, since
 * PostgREST reads its rows over HTTP on another connection. So an
 * `invitation_guests` insert holds its row while waiting on `invitations` for a
 * foreign key check.
 *
 * Two transactions, two tables, opposite order: a cycle. Postgres does not wait
 * it out, it picks a victim and raises `deadlock detected` — which surfaced as
 * ONE failing test roughly one run in eight, a different test each time, every
 * one of them green when its file ran alone. Raising a timeout cannot fix that;
 * nobody was slow.
 *
 * TWO ATTEMPTS THAT DID NOT WORK, AND WHY THEY ARE WORTH KNOWING.
 *
 * The first asked both sides to serialize on a shared advisory key. It cut the
 * rate to one run in twenty and did not fix it, because more than one fixture
 * helper commits and only one had been taught the agreement. A cooperation
 * protocol is worth its list of participants, and that list is not ours to close.
 *
 * The second took both tables up front and claimed that ended it. IT DOES NOT,
 * and the claim was the dangerous part. `LOCK TABLE a, b` acquires the relations
 * ONE AT A TIME in the order written, so between them this transaction holds
 * `invitations` while waiting for `invitation_guests` — the same half-cycle.
 * Measured on this database rather than argued: with another session holding
 * `invitation_guests`, `pg_locks` shows this transaction granted on
 * `invitations` and ungranted on `invitation_guests` at the same instant.
 *
 * And no ordering fixes it, because the fixture helpers acquire BOTH tables and
 * hold them until they commit. Whichever table is named first here, they can be
 * holding the other.
 *
 * SO THE LOCK NARROWS THE WINDOW AND A RETRY COVERS WHAT IS LEFT.
 *
 * The up-front lock is still worth having: no application work happens between
 * the two acquisitions, which took the observed rate from one run in eight to
 * none in thirty. But narrow is not gone, so the deadlock Postgres reports is
 * retried rather than denied — which is exactly what Postgres recommends for
 * `40P01`, and it is safe here because this transaction always rolls back and so
 * has nothing to repeat.
 *
 * The table list is exactly what the scripts touch. A script that starts altering
 * another table must be added here, or the wait widens again.
 */
export async function withExclusiveSchema<T>(
  body: (db: Client) => Promise<T>,
): Promise<T> {
  return retryOnLockContention(
    () =>
      withRollback(async (db) => {
        // WE VOLUNTEER AS THE VICTIM, RATHER THAN LETTING POSTGRES CHOOSE.
        //
        // `LOCK TABLE a, b` takes the relations one at a time (measured: `pg_locks`
        // shows this transaction granted on the first and waiting on the second at
        // the same instant), so between them we hold one and want the other — half
        // of a cycle a committing fixture closes by holding an `invitation_guests`
        // row and needing `invitations` for its foreign key.
        //
        // Postgres breaks that cycle by aborting SOMEBODY, and when it chose the
        // fixture the failure landed in an unrelated test — measured at two runs in
        // ten. `deadlock_timeout` is 1000ms here (read from `pg_settings`, not
        // assumed), so a shorter `lock_timeout` makes OUR wait abort first, every
        // time: we roll back, release what we hold, the fixture proceeds, and the
        // retry above brings us back. No ordering avoids the cycle — the fixtures
        // hold both tables until they commit — so choosing who pays is the fix.
        await db.query("set local lock_timeout = '400ms'");
        await db.query(
          "lock table invitations, invitation_guests in access exclusive mode",
        );
        // Cleared once we hold both: the script's own statements may legitimately
        // wait, and they are no longer able to be half of a cycle.
        await db.query("set local lock_timeout = 0");

        return body(db);
      }),
    // More attempts than the default, because with the timeout above contention
    // is now the ORDINARY outcome here rather than a rare cycle: eight tries of
    // at most 400ms is under four seconds against a 15s test budget, and a schema
    // test that still cannot get the table after that should fail loudly.
    8,
  );
}

/** Postgres's code for a transaction it aborted to break a lock cycle. */
const DEADLOCK_DETECTED = "40P01";

/** Its code for a lock wait this transaction asked to abort itself. */
const LOCK_NOT_AVAILABLE = "55P03";

/**
 * Runs `run`, repeating it while Postgres reports a deadlock.
 *
 * SEPARATE FROM THE DATABASE ACCESS ON PURPOSE.
 *
 * What is worth pinning here is a DECISION — repeat a `40P01`, and nothing else —
 * and the deadlock it exists for is a race between two connections that cannot be
 * summoned to order. Testing the decision through `withExclusiveSchema` would
 * mean four more transactions taking ACCESS EXCLUSIVE on two tables in order to
 * assert something that has nothing to do with either table. Widening the very
 * window this code exists to survive, to test the code that survives it.
 *
 * So the policy takes any thunk and `db.spec.ts` exercises it with plain
 * functions, touching no database at all.
 *
 * Both halves of the decision matter. Repeating everything would report a broken
 * migration four times and bury which attempt mattered; repeating nothing leaves
 * the residual deadlock showing up as a rotating red test, which is the state all
 * of this replaced. Repeating is only safe because the caller above always rolls
 * back, so a repeat has nothing to undo.
 */
export async function retryOnLockContention<T>(
  run: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  for (let remaining = attempts; ; remaining -= 1) {
    try {
      return await run();
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      const contended =
        code === DEADLOCK_DETECTED || code === LOCK_NOT_AVAILABLE;

      if (!contended || remaining <= 1) {
        throw cause;
      }
    }
  }
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

/**
 * Inserts an invitation owned by `ownerSenderId` and returns its id.
 *
 * There is no seat allowance to state. Since migration 0012 the cap IS the
 * number of members on the invitation, so a fixture sets the cap by calling
 * `seedGuests` — which is the same thing the product does.
 */
export async function seedInvitation(
  db: Client,
  ownerSenderId: string,
): Promise<string> {
  const slug = makeSlug();
  const result = await db.query<{ id: string }>(
    `insert into invitations (slug, owner_sender_id, display_name, greeting_name)
     values ($1, $2, 'Familia Prueba', 'Familia Prueba')
     returning id`,
    [slug, ownerSenderId],
  );

  return result.rows[0].id;
}

/**
 * Inserts `count` named guests on an invitation and returns their ids.
 *
 * Fixtures need real guest ids because `enforce_seat_cap` requires a confirmed
 * RSVP to name exactly as many attendees as the seats it confirms (migration
 * 0007). A fixture that confirms seats without naming anybody states a row the
 * product itself is not allowed to write.
 */
export async function seedGuests(
  db: Client,
  invitationId: string,
  count: number,
): Promise<string[]> {
  const names = Array.from({ length: count }, (_, i) => `Guest ${i + 1}`);
  const result = await db.query<{ id: string }>(
    `insert into invitation_guests (invitation_id, full_name)
     select $1, unnest($2::text[])
     returning id`,
    [invitationId, names],
  );

  return result.rows.map((row) => row.id);
}

/**
 * Every table this change owns. Every one must be default-deny.
 *
 * `ceremony` is here for the same reason as the other six, and its inclusion is
 * the point: it was created by migration 0009, LONG after `0002_rls.sql`
 * revoked the grants that existed when it ran. A new table that nobody added to
 * this list is a table whose posture nothing checks.
 */
export const OWNED_TABLES = [
  "senders",
  "invitations",
  "invitation_guests",
  "dispatch_events",
  "rsvp_responses",
  "gate_attempts",
  "ceremony",
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

    const guest = await db.query<{ id: string }>(
      `insert into invitation_guests (invitation_id, full_name, phone_e164)
       values ($1, 'Seeded Guest', '+573005550000')
       returning id`,
      [invitationId],
    );
    await db.query(
      `insert into dispatch_events (invitation_id, actor_sender_id, kind)
       values ($1, $2, 'marked_sent')`,
      [invitationId, senderId],
    );
    await db.query(
      `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
       values ($1, true, 1, $2)`,
      [invitationId, [guest.rows[0].id]],
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
