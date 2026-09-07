import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
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
    });
  });
});
