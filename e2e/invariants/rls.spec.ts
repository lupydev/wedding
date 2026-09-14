import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";

/**
 * The RLS posture, proved from OUTSIDE.
 *
 * `0002_rls.sql` and `0004_default_deny_new_objects.sql` are rigorous, and
 * every other test of them runs with privileged access — which is exactly the
 * access an attacker does not have. This suite holds only the publishable
 * (anon) key, the one shipped to browsers and readable by anyone who opens the
 * page source, and asserts the four verbs it must never accomplish: SELECT
 * returns nothing, and INSERT, UPDATE and DELETE are all refused.
 *
 * Every table is seeded with a COMMITTED row first, and that row is proved
 * visible to a privileged reader. Without that proof, "the anon key returned no
 * rows" is satisfied by an empty database and means nothing.
 *
 * The final block creates a table AFTER the migrations ran and proves the same
 * thing about it, which is the only way to exercise the `0004` event trigger:
 * the protection it provides is precisely the protection that would otherwise
 * lapse silently for objects nobody has written a test for yet.
 */

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

/**
 * Every table this change owns. Every one must be default-deny.
 *
 * `ceremony` (migration 0009) is the one that matters most to this file. It was
 * created long after `0002_rls.sql` revoked the grants that existed when it
 * ran, so its posture rests entirely on the `0004` event trigger — and it holds
 * the ceremony stream credentials, which are meant to sit BEHIND the phone gate
 * rather than be readable by anyone holding the publishable key.
 */
const OWNED_TABLES = [
  "senders",
  "invitations",
  "invitation_guests",
  "dispatch_events",
  "rsvp_responses",
  "gate_attempts",
  "ceremony",
] as const;

type OwnedTable = (typeof OWNED_TABLES)[number];

/**
 * Realistic payloads.
 *
 * A rejection must come from the privilege check, not from a NOT NULL complaint
 * that would also have stopped a legitimate writer — that would pass while
 * proving nothing about authorization.
 */
const INSERT_PAYLOADS: Record<OwnedTable, object> = {
  senders: {
    display_name: "Intruder",
    role: "helper",
    allowlisted_email: "intruder.invariants@example.test",
    contact_wa_phone_e164: "+573001112222",
  },
  invitations: {
    slug: "aaaaaaaaaaaaaaab",
    display_name: "Intruder",
    greeting_name: "Intruder",
  },
  invitation_guests: { full_name: "Intruder" },
  dispatch_events: { kind: "link_opened" },
  rsvp_responses: { attending: true, seats_confirmed: 0 },
  gate_attempts: { ip_hash: "0".repeat(32), succeeded: true },
  ceremony: {
    ceremony_date: "fecha intrusa",
    ceremony_time: "hora intrusa",
    stream_meeting_id: "id intruso",
    stream_passcode: "clave intrusa",
  },
};

/** A column every owned table has, cheap to attempt an UPDATE against. */
const UPDATE_PAYLOADS: Record<OwnedTable, object> = {
  senders: { display_name: "Owned" },
  invitations: { greeting_name: "Owned" },
  invitation_guests: { full_name: "Owned" },
  dispatch_events: { kind: "marked_sent" },
  rsvp_responses: { attending: false },
  gate_attempts: { succeeded: true },
  // The passcode is the value an attacker would actually want to change: a
  // stream everyone can reach is the same outage as a stream nobody can.
  ceremony: { stream_passcode: "clave intrusa" },
};

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function makeSlug(): string {
  let slug = "";
  for (let i = 0; i < 16; i += 1) {
    slug += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return slug;
}

async function connect(): Promise<Client> {
  const db = new Client({ connectionString: LOCAL_DB_URL });

  try {
    await db.connect();
  } catch (cause) {
    throw new Error(
      `Cannot reach the local Supabase database at ${LOCAL_DB_URL}. ` +
        "Run `supabase start` before the E2E suite. " +
        `Underlying error: ${(cause as Error).message}`,
    );
  }

  return db;
}

/** Anything the anon key does to an owned table must fail with a code. */
function refusal(error: { code?: string } | null): string {
  return error?.code ?? "NO_ERROR";
}

test.describe("RLS invariants held against the publishable key", () => {
  // Serial: the fixtures are COMMITTED, because the anon probes reach Postgres
  // over HTTP on a separate connection and an uncommitted row would be
  // invisible to them. A parallel worker would seed a second copy and tear down
  // the first one's rows mid-assertion.
  test.describe.configure({ mode: "serial" });

  const { anonKey, secretKey } = resolveLocalKeys();
  const anon: SupabaseClient = createClient(LOCAL_API_URL, anonKey);
  const privileged: SupabaseClient = createClient(LOCAL_API_URL, secretKey);

  let senderId = "";
  let invitationId = "";

  test.beforeAll(async () => {
    const db = await connect();
    try {
      const suffix = Math.random().toString(36).slice(2, 10);
      const sender = await db.query<{ id: string }>(
        `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
         values ($1, 'partner_a', $2, '+573005550000')
         returning id`,
        [
          `Invariant Sender ${suffix}`,
          `invariant.${suffix}.${Date.now()}@example.test`,
        ],
      );
      senderId = sender.rows[0].id;

      const invitation = await db.query<{ id: string }>(
        `insert into invitations (slug, owner_sender_id, display_name, greeting_name)
         values ($1, $2, 'Familia Invariante', 'Familia Invariante')
         returning id`,
        [makeSlug(), senderId],
      );
      invitationId = invitation.rows[0].id;

      const guest = await db.query<{ id: string }>(
        `insert into invitation_guests (invitation_id, full_name, phone_e164)
         values ($1, 'Invariant Guest', '+573005550001')
         returning id`,
        [invitationId],
      );
      await db.query(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind)
         values ($1, $2, 'marked_sent')`,
        [invitationId, senderId],
      );
      // One seat confirmed, one attendee named: `enforce_seat_cap` requires the
      // two to agree (migration 0007).
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
    } finally {
      await db.end();
    }
  });

  test.afterAll(async () => {
    const db = await connect();
    try {
      // User triggers are suspended for this session only: the child tables are
      // append-only by trigger and would refuse their own teardown.
      await db.query("set session_replication_role = replica");
      for (const table of [
        "gate_attempts",
        "rsvp_responses",
        "dispatch_events",
        "invitation_guests",
      ]) {
        await db.query(`delete from ${table} where invitation_id = $1`, [
          invitationId,
        ]);
      }
      await db.query("delete from invitations where id = $1", [invitationId]);
      await db.query("delete from senders where id = $1", [senderId]);
      await db.query("reset session_replication_role");
    } finally {
      await db.end();
    }
  });

  test("every owned table really does hold a row a privileged reader can see", async () => {
    const counts: Record<string, number> = {};

    for (const table of OWNED_TABLES) {
      const { data, error } = await privileged.from(table).select("*").limit(1);
      expect(error, `privileged select on ${table}`).toBeNull();
      counts[table] = data?.length ?? 0;
    }

    // Without this, every assertion below is satisfied by an empty database.
    expect(counts).toEqual({
      senders: 1,
      invitations: 1,
      invitation_guests: 1,
      dispatch_events: 1,
      rsvp_responses: 1,
      gate_attempts: 1,
      // Seeded by migration 0009 itself, not by `beforeAll`: the ceremony row
      // is a singleton the schema owns.
      ceremony: 1,
    });
  });

  test("the publishable key selects nothing from any owned table", async () => {
    const rows: Record<string, number> = {};

    for (const table of OWNED_TABLES) {
      const { data } = await anon.from(table).select("*");
      rows[table] = data?.length ?? 0;
    }

    expect(rows).toEqual({
      senders: 0,
      invitations: 0,
      invitation_guests: 0,
      dispatch_events: 0,
      rsvp_responses: 0,
      gate_attempts: 0,
      ceremony: 0,
    });
  });

  test("the publishable key inserts into no owned table", async () => {
    const codes: Record<string, string> = {};

    for (const table of OWNED_TABLES) {
      const { error } = await anon.from(table).insert(INSERT_PAYLOADS[table]);
      codes[table] = refusal(error);
    }

    // 42501 is Postgres' insufficient_privilege.
    for (const table of OWNED_TABLES) {
      expect(codes[table], `insert on ${table}`).toBe("42501");
    }
  });

  test("the publishable key updates no row in any owned table", async () => {
    const codes: Record<string, string> = {};

    for (const table of OWNED_TABLES) {
      const { error } = await anon
        .from(table)
        .update(UPDATE_PAYLOADS[table])
        .not("id", "is", null);
      codes[table] = refusal(error);
    }

    for (const table of OWNED_TABLES) {
      expect(codes[table], `update on ${table}`).toBe("42501");
    }
  });

  test("the publishable key deletes no row from any owned table", async () => {
    const codes: Record<string, string> = {};

    for (const table of OWNED_TABLES) {
      const { error } = await anon.from(table).delete().not("id", "is", null);
      codes[table] = refusal(error);
    }

    for (const table of OWNED_TABLES) {
      expect(codes[table], `delete on ${table}`).toBe("42501");
    }
  });

  test("no seeded row was mutated or removed by any of it", async () => {
    // The refusals above are read from the response. This reads the database,
    // because a refusal that arrived after a partial write would look the same.
    const db = await connect();
    try {
      const result = await db.query<{
        greeting_name: string;
        attending: boolean;
        rows: string;
      }>(
        `select i.greeting_name,
                r.attending,
                (select count(*) from gate_attempts g where g.invitation_id = i.id)::text as rows
         from invitations i
         join rsvp_responses r on r.invitation_id = i.id
         where i.id = $1`,
        [invitationId],
      );

      expect(result.rows[0]).toEqual({
        greeting_name: "Familia Invariante",
        attending: true,
        rows: "1",
      });

      // The ceremony row is a singleton nothing above may have touched: still
      // exactly one row, and still not the passcode the anon key tried to set.
      const ceremony = await db.query<{ stream_passcode: string }>(
        "select stream_passcode from ceremony",
      );

      expect(ceremony.rows).toHaveLength(1);
      expect(ceremony.rows[0].stream_passcode).not.toBe("clave intrusa");
    } finally {
      await db.end();
    }
  });
});

/**
 * A table created AFTER the migrations ran.
 *
 * `0002_rls.sql` revoked the grants that existed when it ran; an object created
 * later is born with whatever default privileges are in force at that moment.
 * The `deny_anon_on_new_public_objects` event trigger from `0004` is what keeps
 * that from lapsing, and this is the same probe an attacker would run.
 */
test.describe("a table created after the migrations", () => {
  // Serial for the same reason, and for one more: the setup below touches the
  // schema's default privileges, and two workers doing that at once collide on
  // the same catalog row.
  test.describe.configure({ mode: "serial" });

  const { anonKey, secretKey } = resolveLocalKeys();
  const anon: SupabaseClient = createClient(LOCAL_API_URL, anonKey);
  const privileged: SupabaseClient = createClient(LOCAL_API_URL, secretKey);
  const PROBE_TABLE = "rls_invariant_probe";

  test.beforeAll(async () => {
    const db = await connect();
    try {
      await db.query(`drop table if exists public.${PROBE_TABLE}`);

      // ONE transaction, deliberately. Reinstating the default grants is what
      // makes this probe non-vacuous — without it the table would be born with
      // no anon privileges anyway and the assertions below would prove nothing
      // about the event trigger. Committing the grant, the table and the
      // revoke together means a failure anywhere leaves the database exactly as
      // it was, rather than leaving a live instance permissive.
      await db.query("begin");
      await db.query(
        "alter default privileges in schema public grant all on tables to anon, authenticated",
      );
      await db.query(
        `create table public.${PROBE_TABLE} (id int primary key, secret text not null)`,
      );
      await db.query(
        `insert into public.${PROBE_TABLE} (id, secret) values (1, 'not for anon')`,
      );
      await db.query(
        "alter default privileges in schema public revoke all on tables from anon, authenticated",
      );
      await db.query("commit");

      // PostgREST caches the schema; without this the probe would 404 and every
      // assertion below would pass for the wrong reason.
      await db.query("notify pgrst, 'reload schema'");
    } catch (cause) {
      await db.query("rollback");
      throw cause;
    } finally {
      await db.end();
    }
  });

  test.afterAll(async () => {
    const db = await connect();
    try {
      await db.query(`drop table if exists public.${PROBE_TABLE}`);
      await db.query("notify pgrst, 'reload schema'");
    } finally {
      await db.end();
    }
  });

  test("was born with no anon grant, because the event trigger removed it", async () => {
    // The default privileges said anon gets everything. This asserts the
    // catalog disagrees, which only the `0004` event trigger can have caused.
    const db = await connect();
    try {
      const grants = await db.query<{ grantee: string }>(
        `select distinct grantee from information_schema.role_table_grants
         where table_schema = 'public' and table_name = $1
           and grantee in ('anon', 'authenticated')`,
        [PROBE_TABLE],
      );

      expect(grants.rows).toEqual([]);
    } finally {
      await db.end();
    }
  });

  test("is reachable through PostgREST, so the anon probe is not vacuous", async () => {
    await expect
      .poll(
        async () => {
          const { data } = await privileged
            .from(PROBE_TABLE)
            .select("secret")
            .limit(1);
          return data?.length ?? 0;
        },
        {
          message:
            "PostgREST never exposed the probe table; an anon 404 would prove nothing",
          timeout: 30_000,
        },
      )
      .toBe(1);
  });

  test("refuses the publishable key all four verbs", async () => {
    const select = await anon.from(PROBE_TABLE).select("*");
    const insert = await anon
      .from(PROBE_TABLE)
      .insert({ id: 2, secret: "owned" });
    const update = await anon
      .from(PROBE_TABLE)
      .update({ secret: "owned" })
      .not("id", "is", null);
    const remove = await anon.from(PROBE_TABLE).delete().not("id", "is", null);

    expect(select.data ?? []).toEqual([]);
    expect(refusal(insert.error)).toBe("42501");
    expect(refusal(update.error)).toBe("42501");
    expect(refusal(remove.error)).toBe("42501");
  });

  test("still lets service_role use it, so the revoke was surgical", async () => {
    // If the event trigger also cost `service_role` its access, every later
    // migration would ship a table our own server cannot read — and the test
    // above would pass for the wrong reason.
    const { data, error } = await privileged
      .from(PROBE_TABLE)
      .select("secret")
      .eq("id", 1)
      .single();

    expect(error).toBeNull();
    expect(data?.secret).toBe("not for anon");
  });
});
