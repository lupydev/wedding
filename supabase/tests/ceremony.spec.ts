import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getCeremony, updateCeremony } from "@/lib/server/ceremony";

import {
  captureError,
  LOCAL_API_URL,
  withDb,
  withRollback,
} from "./helpers/db";
import { resolveLocalKeys } from "./helpers/local-keys";

/**
 * The wedding's facts, as ONE row, against the REAL local stack.
 *
 * WHY A TABLE AND NOT ENVIRONMENT VARIABLES OR SOURCE CONSTANTS
 *
 * Every value here is needed by more than one surface: the invitation body, the
 * Open Graph card, the WhatsApp draft, the stream card behind the phone gate,
 * and later the public ceremony page. A fact stored in two places is a fact that
 * will drift — a reference project hard-coded the date and the venue into its
 * WhatsApp template, the event moved, and the message kept announcing the old
 * venue while the invitation page showed the new one. One row means changing
 * the Zoom passcode is an UPDATE, not a redeploy.
 *
 * WHY THE ROW IS SINGULAR BY CONSTRUCTION
 *
 * "Configuration" tables grow a second row the first time somebody inserts
 * instead of updating, and from then on every reader silently picks one. The
 * primary key is a boolean that only accepts `true`, so a second row is a
 * primary-key violation rather than a convention nobody enforces.
 *
 * WHY THE SEEDED VALUES ARE PLACEHOLDERS
 *
 * The couple has not supplied them. Inventing a plausible meeting ID would
 * ship an invitation that reads as finished and sends guests to a call that
 * does not exist. The placeholders are visibly unfinished on purpose, and they
 * are now the ONLY place in the system where such a placeholder lives: since
 * migration 0011 they are data in a row an operator can edit, not text compiled
 * into a component. `tools/no-source-placeholders.spec.ts` is the other half of
 * that statement.
 */

/** Every value column of the singleton, in the order the migrations added them. */
const CEREMONY_COLUMNS = [
  "ceremony_date",
  "ceremony_time",
  "stream_meeting_id",
  "stream_passcode",
  "couple_names",
  "venue_name",
  "venue_address",
] as const;

/** A seed value that is visibly unfinished: `{{LIKE_THIS}}`. */
const PLACEHOLDER = /^\{\{[A-Z_]+\}\}$/;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Every migration's SQL, in the order Postgres applies them. */
function readMigrationSql(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
}

/**
 * The value each `ceremony` column is SEEDED with, read from the migrations.
 *
 * Two shapes, because the table grew: `0009` seeds its four columns with an
 * INSERT, and `0011` seeds its three with a column default it then drops. Later
 * files win, so a migration that rewrote a seed would be the value reported.
 *
 * Pure on purpose — a string in, a record out, no database and no filesystem —
 * so the negative control below can hand it an invented value directly.
 */
function parseCeremonySeed(
  migrations: readonly string[],
): Record<string, string> {
  const seed: Record<string, string> = {};

  for (const sql of migrations) {
    const inserts = sql.matchAll(
      /insert\s+into\s+ceremony\s*\(([^)]*)\)\s*values\s*\(([^)]*)\)/gi,
    );
    for (const [, rawColumns, rawValues] of inserts) {
      const columns = rawColumns.split(",").map((part) => part.trim());
      const values = rawValues
        .split(",")
        .map((part) => part.trim().replace(/^'(.*)'$/, "$1"));

      columns.forEach((column, index) => {
        seed[column] = values[index] ?? "";
      });
    }

    const defaults = sql.matchAll(
      /add\s+column\s+(\w+)\s+\w+\s+not\s+null\s+default\s+'([^']*)'/gi,
    );
    for (const [, column, value] of defaults) {
      seed[column] = value;
    }
  }

  return seed;
}

describe("the ceremony configuration row", () => {
  it("holds exactly one row after the migrations have run", async () => {
    const count = await withRollback(async (db) => {
      const result = await db.query<{ total: string }>(
        "select count(*)::text as total from ceremony",
      );

      return result.rows[0].total;
    });

    expect(count).toBe("1");
  });

  /**
   * A COMPLETE intruder row, and that is load-bearing.
   *
   * These two tests originally named only the four columns migration 0009
   * created. Once 0011 added three more `not null` columns the INSERTs started
   * failing on a missing `couple_names` instead — still red-free, still green,
   * and no longer testing the singleton at all. An incomplete INSERT never
   * reaches the primary key or the check constraint, so the guard would have
   * gone untested from the moment a column was added.
   */
  const INTRUDER_VALUES =
    "'otro dia', 'otra hora', 'otro id', 'otra clave', 'otra pareja', 'otro lugar', 'otra direccion'";

  it("refuses a second row instead of letting readers pick one", async () => {
    const error = await withRollback(async (db) => {
      return captureError(() =>
        db.query(
          `insert into ceremony (${CEREMONY_COLUMNS.join(", ")})
           values (${INTRUDER_VALUES})`,
        ),
      );
    });

    // The primary key is the enforcement, so the message names it.
    expect(error).toMatch(/duplicate key value|ceremony_pkey/i);
  });

  it("refuses a row that tries to sit beside the singleton under another key", async () => {
    const error = await withRollback(async (db) => {
      return captureError(() =>
        db.query(
          `insert into ceremony (id, ${CEREMONY_COLUMNS.join(", ")})
           values (false, ${INTRUDER_VALUES})`,
        ),
      );
    });

    expect(error).toMatch(/ceremony_is_singleton|violates check constraint/i);
  });

  /**
   * THIS ASSERTION IS ABOUT THE MIGRATIONS, NOT ABOUT THE LIVE ROW.
   *
   * It used to read the live singleton and require every column to look like
   * `{{THING}}`. That was correct for exactly as long as nobody could edit the
   * row — and then Work Unit 9 shipped `/console/wedding`, whose entire purpose
   * is to replace those placeholders. The couple typed their names in, and the
   * test went red for the feature working. A test that cannot survive the
   * feature it shipped beside is asserting on the wrong thing.
   *
   * The requirement it protects is real: the migration must SEED visibly
   * unfinished placeholders rather than invent a plausible date or meeting id,
   * because an invented value ships an invitation that reads as finished and
   * sends guests to a call that does not exist. That is a property of the seed
   * the migrations ship, so it is asserted against the migration SQL. A future
   * migration writing `'sábado 14 de noviembre'` fails this; the couple filling
   * in their own facts through the console does not.
   */
  it("ships a migration seed of clearly-unfinished placeholders, never invented details", () => {
    const seed = parseCeremonySeed(readMigrationSql());

    // Every value column must be ACCOUNTED FOR, not merely consistent. Without
    // this the assertion below is satisfied by a parser that found nothing —
    // which is exactly how a column added by a later migration would slip in
    // carrying an invented default and never be looked at.
    expect(Object.keys(seed).sort()).toEqual([...CEREMONY_COLUMNS].sort());

    for (const column of CEREMONY_COLUMNS) {
      expect({ column, value: seed[column] }).toEqual({
        column,
        value: expect.stringMatching(PLACEHOLDER),
      });
    }
  });

  it("reports an invented seed value instead of accepting it", () => {
    // The negative control, and the reason the parser is a pure function: this
    // is the mutation the test above exists to catch, asserted directly rather
    // than by editing a migration and hoping somebody notices.
    const invented = parseCeremonySeed([
      "insert into ceremony (ceremony_date) values ('sábado 14 de noviembre');",
    ]);

    expect(invented).toEqual({ ceremony_date: "sábado 14 de noviembre" });
    expect(invented.ceremony_date).not.toMatch(PLACEHOLDER);
  });

  it("still accepts an UPDATE, because that is how the couple will fill it in", async () => {
    const updated = await withRollback(async (db) => {
      await db.query(
        "update ceremony set stream_passcode = 'clave-nueva' where id",
      );
      const result = await db.query<{ stream_passcode: string }>(
        "select stream_passcode from ceremony",
      );

      return result.rows[0].stream_passcode;
    });

    // Unlike `rsvp_responses`, this table is NOT append-only: the whole point
    // of a row rather than an env var is that correcting it is an UPDATE.
    expect(updated).toBe("clave-nueva");
  });

  /**
   * BLANK IS REFUSED BY THE TABLE, NOT ONLY BY THE FORM.
   *
   * Before migration 0011 the only writer was a migration, so "not null" was
   * enough. Now a console form writes these seven values, and a form field that
   * an operator clears submits an empty string rather than a null — which
   * satisfies `not null` perfectly and renders as an invitation with a hole
   * where the venue should be. Nothing about that reads as broken to a guest:
   * it reads as a venue nobody has been told yet.
   */
  it.each([...CEREMONY_COLUMNS])("refuses a blank %s", async (column) => {
    const error = await withRollback(async (db) => {
      return captureError(() =>
        db.query(`update ceremony set ${column} = '' where id`),
      );
    });

    expect(error).toMatch(/violates check constraint/i);
  });

  it.each([...CEREMONY_COLUMNS])(
    "refuses a whitespace-only %s, which looks identical to a real value in a form",
    async (column) => {
      const error = await withRollback(async (db) => {
        return captureError(() =>
          db.query(`update ceremony set ${column} = '   ' where id`),
        );
      });

      expect(error).toMatch(/violates check constraint/i);
    },
  );

  it.each(["couple_names", "venue_name", "venue_address"])(
    "still holds a real %s once somebody types one",
    async (column) => {
      const stored = await withRollback(async (db) => {
        await db.query(`update ceremony set ${column} = $1 where id`, [
          "un valor de prueba",
        ]);
        const result = await db.query<Record<string, string>>(
          `select ${column} from ceremony`,
        );

        return result.rows[0][column];
      });

      expect(stored).toBe("un valor de prueba");
    },
  );
});

describe("the ceremony table's default-deny posture", () => {
  it("has row level security enabled and zero policies", async () => {
    const posture = await withRollback(async (db) => {
      const result = await db.query<{
        rls_enabled: boolean;
        policy_count: string;
      }>(
        `select c.relrowsecurity as rls_enabled,
                (select count(*) from pg_policy p where p.polrelid = c.oid)::text as policy_count
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'ceremony'`,
      );

      return result.rows[0];
    });

    expect(posture).toEqual({ rls_enabled: true, policy_count: "0" });
  });

  it("was born with no anon grant, and the migration never says so itself", async () => {
    // The `0004` event trigger is what revoked these, VERIFIED rather than
    // assumed: `0009_ceremony.sql` contains no revoke of its own, so a grant
    // reaching `anon` here would mean the trigger did not cover a plain
    // `CREATE TABLE` and every table added after it is equally exposed.
    const grants = await withRollback(async (db) => {
      const result = await db.query<{ grantee: string }>(
        `select distinct grantee from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'ceremony'
           and grantee in ('anon', 'authenticated')`,
      );

      return result.rows.map((row) => row.grantee);
    });

    expect(grants).toEqual([]);
  });

  it("returns nothing to the publishable key even though the row exists", async () => {
    const { anonKey } = resolveLocalKeys();
    const anon = createClient(LOCAL_API_URL, anonKey);

    // Proof the row is really there for a privileged reader, so an empty anon
    // result cannot be explained by an empty table.
    const privileged = await withDb(async (db) => {
      const result = await db.query("select 1 from ceremony");

      return result.rowCount ?? 0;
    });
    const { data } = await anon.from("ceremony").select("*");

    expect(privileged).toBe(1);
    expect(data ?? []).toEqual([]);
  });
});

describe("reading the ceremony through the server adapter", () => {
  const keys = resolveLocalKeys();
  const client = createClient(LOCAL_API_URL, keys.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it("maps the stored row onto the shape the page renders", async () => {
    const ceremony = await getCeremony(client);
    const stored = await withDb(async (db) => {
      const result = await db.query<Record<string, string>>(
        `select ${CEREMONY_COLUMNS.join(", ")} from ceremony`,
      );

      return result.rows[0];
    });

    // Asserted against what the database actually holds rather than against a
    // literal, so the mapping is proved without pinning the placeholder text
    // this test is deliberately not allowed to invent.
    expect(ceremony).toEqual({
      ceremonyDate: stored.ceremony_date,
      ceremonyTime: stored.ceremony_time,
      streamMeetingId: stored.stream_meeting_id,
      streamPasscode: stored.stream_passcode,
      coupleNames: stored.couple_names,
      venueName: stored.venue_name,
      venueAddress: stored.venue_address,
    });
    expect(ceremony.streamMeetingId.length).toBeGreaterThan(0);
  });

  /**
   * THE WRITE PATH, AND WHY IT IS TESTED AGAINST A REAL DATABASE.
   *
   * `updateCeremony` is what the console editor calls. The whole reason the facts
   * moved out of source is that an operator can now correct them without a
   * deploy, and "can" is a claim about a real UPDATE against a real singleton
   * with real check constraints — not about a mock returning `{ error: null }`.
   *
   * Committed and then restored, because the adapter goes through the Supabase
   * API in its own connection and would not see this suite's open transaction.
   */
  it("writes all seven facts back and reads exactly what was written", async () => {
    const before = await getCeremony(client);

    try {
      await updateCeremony(client, {
        ceremonyDate: "sábado 14 de noviembre de 2026",
        ceremonyTime: "4:00 p. m.",
        streamMeetingId: "123 4567 8901",
        streamPasscode: "una-clave",
        coupleNames: "Ana y Bruno",
        venueName: "Hacienda de prueba",
        venueAddress: "Calle de prueba 123, Ciudad",
      });

      expect(await getCeremony(client)).toEqual({
        ceremonyDate: "sábado 14 de noviembre de 2026",
        ceremonyTime: "4:00 p. m.",
        streamMeetingId: "123 4567 8901",
        streamPasscode: "una-clave",
        coupleNames: "Ana y Bruno",
        venueName: "Hacienda de prueba",
        venueAddress: "Calle de prueba 123, Ciudad",
      });
    } finally {
      await updateCeremony(client, before);
    }

    // The singleton survived the write: an UPDATE, never an INSERT.
    const total = await withDb(async (db) => {
      const result = await db.query<{ total: string }>(
        "select count(*)::text as total from ceremony",
      );

      return result.rows[0].total;
    });

    expect(total).toBe("1");
    expect(await getCeremony(client)).toEqual(before);
  });

  it("refuses a blank value instead of storing an invitation with a hole in it", async () => {
    const before = await getCeremony(client);
    const rejected = await updateCeremony(client, {
      ...before,
      venueName: "   ",
    }).then(
      () => null,
      (error: Error) => error.message,
    );

    // The database is the last line, not the only one: `parseWeddingFacts`
    // refuses this before the action ever reaches here. Both exist because a
    // blank venue renders as an invitation that looks finished and says nothing.
    expect(rejected).not.toBeNull();
    expect(await getCeremony(client)).toEqual(before);
  });
});
