import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  captureError,
  LOCAL_API_URL,
  OWNED_TABLES,
  withDb,
  withRollback,
  withSeededData,
} from "./helpers/db";
import { resolveLocalKeys } from "./helpers/local-keys";

/**
 * Default-deny posture.
 *
 * RLS is enabled on all six tables with ZERO policies, and the default grants
 * Supabase issues to `anon`/`authenticated` are revoked. The browser never
 * holds a Supabase client for guest data, so any read reaching Postgres through
 * the publishable key is already an anomaly and must return nothing.
 *
 * Honest scope: this stops the publishable key only. `service_role` has
 * BYPASSRLS by design, which is why append-only is a trigger (design D5) and
 * why every `lib/server/**` file carries `import 'server-only'`.
 */
describe("row level security", () => {
  it("has RLS enabled and zero policies on every owned table", async () => {
    const rows = await withRollback(async (db) => {
      const result = await db.query<{
        table_name: string;
        rls_enabled: boolean;
        policy_count: string;
      }>(
        `select c.relname as table_name,
                c.relrowsecurity as rls_enabled,
                (select count(*) from pg_policy p where p.polrelid = c.oid)::text as policy_count
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = any($1)
         order by c.relname`,
        [[...OWNED_TABLES]],
      );

      return result.rows;
    });

    expect(rows.map((row) => row.table_name)).toEqual([...OWNED_TABLES].sort());
    for (const row of rows) {
      expect({ table: row.table_name, rls: row.rls_enabled }).toEqual({
        table: row.table_name,
        rls: true,
      });
      expect({ table: row.table_name, policies: row.policy_count }).toEqual({
        table: row.table_name,
        policies: "0",
      });
    }
  });

  it("grants anon and authenticated no privilege on any owned table", async () => {
    const grants = await withRollback(async (db) => {
      const result = await db.query<{ grantee: string; table_name: string }>(
        `select grantee, table_name
         from information_schema.role_table_grants
         where table_schema = 'public'
           and grantee in ('anon', 'authenticated')
           and table_name = any($1)`,
        [[...OWNED_TABLES]],
      );

      return result.rows;
    });

    expect(grants).toEqual([]);
  });

  it("returns no rows to the anon key even though every table holds data", async () => {
    const { anonKey } = resolveLocalKeys();
    const anon = createClient(LOCAL_API_URL, anonKey);

    const { privileged, viaAnonKey } = await withSeededData(async () => {
      // Proof the fixture is really visible to a privileged reader, so an
      // empty anon result cannot be explained by an empty database.
      const privileged = await withDb(async (db) => {
        const counts: Record<string, number> = {};
        for (const table of OWNED_TABLES) {
          const result = await db.query(`select 1 from ${table} limit 1`);
          counts[table] = result.rowCount ?? 0;
        }
        return counts;
      });

      const viaAnonKey: Record<string, number> = {};
      for (const table of OWNED_TABLES) {
        const { data } = await anon.from(table).select("*").limit(1);
        viaAnonKey[table] = data?.length ?? 0;
      }

      return { privileged, viaAnonKey };
    });

    expect(privileged).toEqual({
      senders: 1,
      invitations: 1,
      invitation_guests: 1,
      dispatch_events: 1,
      rsvp_responses: 1,
      gate_attempts: 1,
      // Seeded by migration 0009 itself, not by the fixture: the ceremony row
      // is a singleton the schema owns.
      ceremony: 1,
    });
    // Either shape is acceptable: an outright permission error, or an empty
    // result. What is NOT acceptable is a row reaching the publishable key.
    expect(viaAnonKey).toEqual({
      senders: 0,
      invitations: 0,
      invitation_guests: 0,
      dispatch_events: 0,
      rsvp_responses: 0,
      gate_attempts: 0,
      ceremony: 0,
    });
  });

  it("denies an anon-key insert on every owned table with a privilege error", async () => {
    const { anonKey } = resolveLocalKeys();
    const anon = createClient(LOCAL_API_URL, anonKey);

    // Realistic payloads: a rejection must come from the privilege check, not
    // from a NOT NULL complaint that would have failed for a legitimate writer.
    const payloads: Record<(typeof OWNED_TABLES)[number], object> = {
      senders: {
        display_name: "Intruder",
        role: "helper",
        allowlisted_email: "intruder@example.test",
        contact_wa_phone_e164: "+573001112222",
      },
      invitations: {
        slug: "abcdefghijklmnop",
        display_name: "Intruder",
        greeting_name: "Intruder",
        seats_allowed: 2,
      },
      invitation_guests: { full_name: "Intruder" },
      dispatch_events: { kind: "link_opened" },
      rsvp_responses: { attending: true, seats_confirmed: 1 },
      gate_attempts: { ip_hash: "0".repeat(32), succeeded: true },
      ceremony: {
        ceremony_date: "fecha intrusa",
        ceremony_time: "hora intrusa",
        stream_meeting_id: "id intruso",
        stream_passcode: "clave intrusa",
      },
    };

    const codes: Record<string, string> = {};
    for (const table of OWNED_TABLES) {
      const { error } = await anon.from(table).insert(payloads[table]);
      codes[table] = error?.code ?? "NO_ERROR";
    }

    // 42501 is Postgres' insufficient_privilege.
    expect(codes).toEqual({
      senders: "42501",
      invitations: "42501",
      invitation_guests: "42501",
      dispatch_events: "42501",
      rsvp_responses: "42501",
      gate_attempts: "42501",
      ceremony: "42501",
    });
  });
});

/**
 * Default-deny must survive the NEXT migration, not only this one.
 *
 * `0002_rls.sql` revokes the grants that existed when it ran. A table created
 * later is born with whatever default privileges are in force at that moment,
 * so the protection can lapse silently — for exactly the reason it was needed.
 * The Work Unit 3 RED run proved the danger is not theoretical: before the
 * revoke, the anon key could INSERT into `senders` and write itself into the
 * operator allowlist.
 *
 * Measured facts about this database, which decide the mechanism:
 *
 *  - `alter default privileges` binds to (grantor role, schema, object kind).
 *    `0002_rls.sql` ran as `postgres`, so it covers TABLES and SEQUENCES
 *    created by `postgres` — and nothing else.
 *  - `supabase_admin` still holds default ACLs granting `anon` everything on
 *    new public tables, and `postgres` cannot alter them: `alter default
 *    privileges for role supabase_admin ...` fails with "permission denied to
 *    change default privileges". The gap is real and unreachable by that tool.
 *  - FUNCTIONS were never covered at all. A function created by `postgres` in
 *    `public` is granted EXECUTE to PUBLIC, `anon` and `authenticated`, and
 *    PostgREST exposes it as an RPC endpoint.
 *
 * The mechanism that closes all three is an event trigger, which fires on the
 * created object regardless of which role created it or what the default
 * privileges said.
 */
describe("default deny for objects created after 0002_rls.sql", () => {
  it("keeps anon out of a table born with the default grants reinstated", async () => {
    const observed = await withRollback(async (db) => {
      // Exactly the lapse the finding describes: a later migration, tool or
      // dashboard action puts the default grants back, and the next table is
      // created with them.
      await db.query(
        "alter default privileges in schema public grant all on tables to anon, authenticated",
      );
      await db.query("create table public.future_table (id int primary key)");

      const grants = await db.query<{ grantee: string }>(
        `select distinct grantee from information_schema.role_table_grants
         where table_schema = 'public'
           and table_name = 'future_table'
           and grantee in ('anon', 'authenticated')`,
      );

      await db.query("set local role anon");
      await db.query("savepoint probe");
      const selectError = await captureError(() =>
        db.query("select id from public.future_table"),
      );
      await db.query("rollback to savepoint probe");
      const insertError = await captureError(() =>
        db.query("insert into public.future_table (id) values (1)"),
      );
      await db.query("rollback to savepoint probe");
      await db.query("reset role");

      return {
        grantees: grants.rows.map((row) => row.grantee),
        selectError,
        insertError,
      };
    });

    expect(observed.grantees).toEqual([]);
    expect(observed.selectError).toMatch(/permission denied/i);
    expect(observed.insertError).toMatch(/permission denied/i);
  });

  it("keeps anon out of a function created after the migration", async () => {
    const observed = await withRollback(async (db) => {
      await db.query(
        "create function public.future_function() returns int language sql as 'select 1'",
      );

      const grants = await db.query<{ grantee: string }>(
        `select distinct grantee from information_schema.role_routine_grants
         where routine_schema = 'public'
           and routine_name = 'future_function'
           and grantee in ('anon', 'authenticated', 'PUBLIC')`,
      );

      await db.query("set local role anon");
      await db.query("savepoint probe");
      const callError = await captureError(() =>
        db.query("select public.future_function()"),
      );
      await db.query("rollback to savepoint probe");
      await db.query("reset role");

      return { grantees: grants.rows.map((row) => row.grantee), callError };
    });

    expect(observed.grantees).toEqual([]);
    expect(observed.callError).toMatch(/permission denied/i);
  });

  it("still lets service_role use a newly created table", async () => {
    // The revoke must be surgical. If it also cost `service_role` its access,
    // every later migration would ship a table our own server cannot read, and
    // the previous two tests would pass for the wrong reason.
    const rows = await withRollback(async (db) => {
      await db.query("create table public.future_table (id int primary key)");
      await db.query("set local role service_role");
      await db.query("insert into public.future_table (id) values (7)");
      const result = await db.query<{ id: number }>(
        "select id from public.future_table",
      );
      await db.query("reset role");

      return result.rows.map((row) => row.id);
    });

    expect(rows).toEqual([7]);
  });

  it("enforces this with an enabled event trigger, not a convention", async () => {
    const trigger = await withRollback(async (db) => {
      const result = await db.query<{ evtname: string; evtenabled: string }>(
        `select evtname, evtenabled from pg_event_trigger
         where evtname = 'deny_anon_on_new_public_objects'`,
      );

      return result.rows[0] ?? null;
    });

    // 'O' is "enabled, origin" — the trigger fires for ordinary DDL. A
    // disabled trigger ('D') would leave the three tests above passing only
    // until the next object is created.
    expect(trigger).toEqual({
      evtname: "deny_anon_on_new_public_objects",
      evtenabled: "O",
    });
  });
});
