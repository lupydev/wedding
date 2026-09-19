import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { withDb } from "./helpers/db";

/**
 * `seats_allowed` IS GONE FROM THE SCHEMA, AND THIS ASSERTS IT AGAINST THE REAL ONE.
 *
 * `tools/no-seats-allowed.spec.ts` keeps the column out of application code by
 * scanning for the literal. It cannot see the database, so it cannot tell a tree
 * that stopped reading a column from a tree where the column was actually
 * dropped — and 0012 deliberately left those two states apart for one migration.
 * This file closes that gap by asking the live catalog.
 *
 * It is the one scanned file permitted to name the column, and it is on
 * `no-seats-allowed`'s exemption list for exactly that reason. An assertion that
 * a column is absent cannot be written without naming it.
 *
 * WHY THE DOWN SCRIPT IS EXERCISED FOR REAL AND STILL LEAVES NOTHING BEHIND
 *
 * A rollback path nobody ever runs is a rollback path nobody knows works — and
 * this is the only destructive migration in the capability, so its down script
 * is the one that matters most. Asserting on the file's TEXT would prove only
 * that somebody typed `add column`, not that Postgres accepts it against today's
 * schema.
 *
 * So the script is read from disk and executed, inside a transaction that is
 * then rolled back. Postgres has transactional DDL, so the column appears,
 * is asserted, and vanishes again with the rollback: the real statements meet the
 * real schema and no other test can observe a difference. Reading the file rather
 * than a copy of its statements is what keeps this honest — a down script edited
 * into something Postgres refuses fails here.
 */

const DOWN_SCRIPT = fileURLToPath(
  new URL("../down/0013_drop_seats_allowed_down.sql", import.meta.url),
);

/** Whether `invitations` currently has the column, per the live catalog. */
async function columnExists(
  db: Parameters<Parameters<typeof withDb>[0]>[0],
): Promise<boolean> {
  const found = await db.query(
    `select 1
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'invitations'
        and column_name = 'seats_allowed'`,
  );

  return found.rowCount === 1;
}

describe("migration 0013 — seats_allowed is dropped", () => {
  it("is absent from the invitations table", async () => {
    await withDb(async (db) => {
      expect(await columnExists(db)).toBe(false);
    });
  });

  it("is brought back by its own down script, which Postgres accepts", async () => {
    await withDb(async (db) => {
      await db.query("begin");

      try {
        await db.query(readFileSync(DOWN_SCRIPT, "utf8"));

        expect(await columnExists(db)).toBe(true);
      } finally {
        await db.query("rollback");
      }

      // And the rollback put the schema back, so nothing here leaked into the
      // suite that runs next.
      expect(await columnExists(db)).toBe(false);
    });
  });

  it("leaves the seat cap deriving its limit from the named members", async () => {
    // The landmine this migration had to clear. PL/pgSQL resolves a column
    // reference when the function RUNS, so a trigger still naming the dropped
    // column would survive the migration and fail on the next real RSVP —
    // something `drop column` reports nowhere. `seat-parity.spec.ts` proves the
    // cap still REFUSES correctly; this proves the reason it can.
    await withDb(async (db) => {
      const definition = await db.query<{ def: string }>(
        `select pg_get_functiondef(p.oid) as def
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'enforce_seat_cap'`,
      );

      expect(definition.rows).toHaveLength(1);
      expect(definition.rows[0].def).not.toContain("seats_allowed");
      expect(definition.rows[0].def).toContain("count(*)");
    });
  });
});
