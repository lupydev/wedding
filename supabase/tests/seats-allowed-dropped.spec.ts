import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  seedGuests,
  seedInvitation,
  seedSender,
  withDb,
  withExclusiveSchema,
} from "./helpers/db";

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
 *
 * WHAT IS DELIBERATELY *NOT* EXERCISED HERE, AND WHY
 *
 * Rolling `seats_allowed` back is TWO scripts in order, and 0012's is the one
 * that restores the `between 1 and 12` check and clamps any household the check
 * would reject. A case for that was written, passed, and was then REMOVED,
 * because it is not sound in this environment and the reason generalises:
 *
 * 0012's down script runs `update invitations` over EVERY row, twice. An UPDATE
 * revalidates the foreign key of each row it touches, so that script fails on any
 * inconsistency anywhere in the table — including rows this suite never created.
 * One invitation left behind by an interrupted run, pointing at a sender that
 * `withSeededData`'s cleanup had already deleted with its FK triggers suspended,
 * turned the case red on every run until somebody cleaned the database by hand.
 *
 * A test that executes a whole-table migration script against a shared
 * development database inherits every inconsistency that database ever
 * accumulated. The cases that remain do not: 0013 only READS the whole table and
 * then drops a column, and neither of those revalidates a foreign key.
 *
 * So 0012's clamp is covered by reading it, not by running it. It is a rollback
 * step a person performs once, in an emergency, against a database whose state
 * they are already inspecting.
 */

const DOWN_SCRIPT = fileURLToPath(
  new URL("../down/0013_drop_seats_allowed_down.sql", import.meta.url),
);

const MIGRATION = fileURLToPath(
  new URL("../migrations/0013_drop_seats_allowed.sql", import.meta.url),
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
    await withExclusiveSchema(async (db) => {
      await db.query(readFileSync(DOWN_SCRIPT, "utf8"));

      expect(await columnExists(db)).toBe(true);
    });

    // And the rollback put the schema back, so nothing here leaked into the
    // suite that runs next.
    await withDb(async (db) => {
      expect(await columnExists(db)).toBe(false);
    });
  });

  it("names a disagreeing row in the notices it prints before destroying it", async () => {
    // THE ONLY SURVIVING RECORD HAS TO BE PROVED, NOT ASSERTED IN A COMMENT.
    //
    // Both SQL files call this report the last place a `seats_allowed` that
    // disagreed with its member count can still be read. Its cheapest failure is
    // to match nothing and print an empty list, which reads exactly like a clean
    // run — and the next statement destroys the data. So the report is run
    // against a household built to disagree, and the notices are read.
    //
    // Asserting "1 of N" rather than "at least 1" proves both halves of the
    // predicate: it finds the row that disagrees AND leaves alone the rows that
    // agree, which the down script's reconstruction has just made of every
    // other invitation.
    await withExclusiveSchema(async (db) => {
      await db.query(readFileSync(DOWN_SCRIPT, "utf8"));

      const invitationId = await seedInvitation(db, await seedSender(db));

      await seedGuests(db, invitationId, 2);
      await db.query("update invitations set seats_allowed = 7 where id = $1", [
        invitationId,
      ]);

      const notices: string[] = [];
      const collect = (notice: { readonly message?: string }) => {
        notices.push(notice.message ?? "");
      };

      db.on("notice", collect);

      try {
        await db.query(readFileSync(MIGRATION, "utf8"));
      } finally {
        db.off("notice", collect);
      }

      const printed = notices.join("\n");

      expect(printed).toMatch(/seats_allowed: 1 of \d+ rows/);
      expect(printed).toContain(
        "(Familia Prueba) had seats_allowed=7 with 2 named members",
      );
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
