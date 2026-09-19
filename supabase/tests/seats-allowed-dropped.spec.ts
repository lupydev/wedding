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
 * AND THE CHAIN IS EXERCISED, NOT JUST ITS LAST LINK
 *
 * Rolling `seats_allowed` back is TWO scripts in order, and the interesting work
 * is in the second one. 0013's own down script only re-creates the column and
 * reconstructs a value; 0012's is what restores the `between 1 and 12` check, and
 * it has to survive a household the check would reject — nobody named, or more
 * than twelve named — which it handles by clamping and printing a NOTICE.
 *
 * The clamp lives there and not in 0013's script on purpose: 0012's runs it on
 * every out-of-range value, including whatever 0013's reconstruction wrote, and
 * it runs it BEFORE adding the check. Duplicating it one script earlier would
 * print two notices for one household and leave two copies to keep in step.
 *
 * So the last case runs both scripts, in order, against households built to fall
 * outside the range — which is the whole rollback chain proved without ever
 * taking a real database down.
 */

const DOWN_SCRIPT = fileURLToPath(
  new URL("../down/0013_drop_seats_allowed_down.sql", import.meta.url),
);

const DOWN_0012 = fileURLToPath(
  new URL("../down/0012_invitation_administration_down.sql", import.meta.url),
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

  it("clamps a household the restored check would reject, and says so", async () => {
    // 0012's down script is the one that puts `between 1 and 12` back, so it is
    // the one that has to survive a household the check forbids, and nothing
    // exercised it.
    //
    // WHAT THIS PROVES IS THE CHAIN, NOT EITHER CLAMP, AND THAT IS DELIBERATE.
    //
    // The script clamps twice: once inside the backfill loop over NULL rows, and
    // once afterwards over every out-of-range value. Mutation says each alone is
    // sufficient — disabling either still leaves this green, because the other
    // catches the row. Disabling BOTH fails, and fails in the way production
    // would: `check constraint "invitations_seats_allowed_check" ... is violated
    // by some row`, thrown mid-rollback as the check goes back on.
    //
    // So the redundancy is real and this test is what says so. Removing one of
    // the two clamps as dead code would leave this passing and the rollback one
    // edit away from dying at the worst possible moment.
    await withExclusiveSchema(async (db) => {
      await db.query(readFileSync(DOWN_SCRIPT, "utf8"));

      const owner = await seedSender(db);
      const nobody = await seedInvitation(db, owner);
      const crowd = await seedInvitation(db, owner);

      await seedGuests(db, crowd, 13);

      // Back to NULL, which is the state 0012 left the relaxed column in for any
      // invitation written while nothing maintained it. That is the row the
      // backfill is for, so it is the row the NOTICE has to name.
      await db.query(
        "update invitations set seats_allowed = null where id = any($1)",
        [[nobody, crowd]],
      );

      const notices: string[] = [];
      const collect = (notice: { readonly message?: string }) => {
        notices.push(notice.message ?? "");
      };

      db.on("notice", collect);

      try {
        await db.query(readFileSync(DOWN_0012, "utf8"));
      } finally {
        db.off("notice", collect);
      }

      const printed = notices.join("\n");

      expect(printed).toContain("has 0 members, outside");
      expect(printed).toContain("has 13 members, outside");

      // And the clamp actually landed, which is what lets the check go back on.
      const clamped = await db.query<{ id: string; seats_allowed: number }>(
        "select id, seats_allowed from invitations where id = any($1)",
        [[nobody, crowd]],
      );
      const byId = new Map(
        clamped.rows.map((row) => [row.id, row.seats_allowed]),
      );

      expect(byId.get(nobody)).toBe(1);
      expect(byId.get(crowd)).toBe(12);
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
