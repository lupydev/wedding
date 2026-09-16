import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRsvpStore, type RsvpStore } from "@/lib/server/rsvp";

import {
  LOCAL_API_URL,
  seedGuests,
  seedInvitation,
  seedSender,
  withDb,
} from "./helpers/db";
import { resolveLocalKeys } from "./helpers/local-keys";

/**
 * The Supabase-backed RSVP store, against the REAL local stack.
 *
 * `lib/server/rsvp.spec.ts` tests the decisions through a port, which is the
 * right place for them. What a port cannot tell us is whether the adapter talks
 * to the right relation — and that is the whole defect this unit is guarding
 * against. `latestResponse` reading `rsvp_responses` instead of `rsvp_latest`
 * would pass every port-level test in the suite and return an arbitrary row out
 * of a household's history in production.
 *
 * So this file goes over PostgREST with the real secret key, exactly as the
 * server does. Fixtures are COMMITTED rather than rolled back, because the HTTP
 * client is a separate connection and would not see an open transaction.
 *
 * Each test gets its OWN household. `rsvp_responses` is append-only by a
 * trigger that binds even `service_role`, which is load-bearing product
 * behaviour and not something a test may suspend between cases — so there is no
 * such thing as cleaning a household's history up mid-file. A single shared
 * household therefore made every case here depend on the ones before it, and
 * "reports no answer" only passed while it happened to run first. The sender
 * stays shared: nothing below writes to it.
 */

const keys = resolveLocalKeys();

const client = createClient(LOCAL_API_URL, keys.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let store: RsvpStore;
let senderId: string;
let invitationId: string;
let guestIds: string[];

/** Every household this file created, so teardown can find all of them. */
const seededInvitationIds: string[] = [];

beforeAll(async () => {
  store = createRsvpStore(client);

  await withDb(async (db) => {
    senderId = await seedSender(db);
  });
});

beforeEach(async () => {
  await withDb(async (db) => {
    invitationId = await seedInvitation(db, senderId);
    // Three named members, because the seat cap IS the member count and the
    // last case below writes six seats against it.
    guestIds = await seedGuests(db, invitationId, 3);
  });

  seededInvitationIds.push(invitationId);
});

afterAll(async () => {
  await withDb(async (db) => {
    // `rsvp_responses` is append-only by trigger and refuses its own teardown,
    // so user triggers are suspended for this session only.
    await db.query("set session_replication_role = replica");
    await db.query("delete from rsvp_responses where invitation_id = any($1)", [
      seededInvitationIds,
    ]);
    await db.query(
      "delete from invitation_guests where invitation_id = any($1)",
      [seededInvitationIds],
    );
    await db.query("delete from invitations where id = any($1)", [
      seededInvitationIds,
    ]);
    await db.query("delete from senders where id = $1", [senderId]);
    await db.query("reset session_replication_role");
  });
});

async function rawResponseCount(): Promise<number> {
  return withDb(async (db) => {
    const result = await db.query<{ count: string }>(
      "select count(*) from rsvp_responses where invitation_id = $1",
      [invitationId],
    );

    return Number(result.rows[0].count);
  });
}

describe("createRsvpStore", () => {
  it("reports no answer for a household that has not responded", async () => {
    await expect(store.latestResponse(invitationId)).resolves.toBeNull();
  });

  it("reads back exactly what it wrote", async () => {
    await store.insertResponse({
      invitationId,
      attending: true,
      attendeeGuestIds: [guestIds[0], guestIds[1]],
      seatsConfirmed: 2,
      dietaryNotes: "Sin mariscos.",
    });

    await expect(store.latestResponse(invitationId)).resolves.toMatchObject({
      invitationId,
      attending: true,
      attendeeGuestIds: [guestIds[0], guestIds[1]],
      seatsConfirmed: 2,
      dietaryNotes: "Sin mariscos.",
    });
  });

  it("returns the newest answer after the household changes its mind", async () => {
    // The assertion this whole file exists for. Two answers, and the store must
    // report ONE — the second. An adapter reading `rsvp_responses` directly
    // would return whichever row PostgREST happened to hand back first.
    await store.insertResponse({
      invitationId,
      attending: true,
      attendeeGuestIds: [guestIds[0], guestIds[1]],
      seatsConfirmed: 2,
      dietaryNotes: "Sin mariscos.",
    });

    await store.insertResponse({
      invitationId,
      attending: false,
      attendeeGuestIds: [],
      seatsConfirmed: 0,
      dietaryNotes: null,
    });

    const current = await store.latestResponse(invitationId);

    expect(current).toMatchObject({ attending: false, seatsConfirmed: 0 });
    // And the earlier answer is still on file, because the couple wants it.
    await expect(rawResponseCount()).resolves.toBe(2);
  });

  it("cannot be talked into replacing a row", async () => {
    await store.insertResponse({
      invitationId,
      attending: false,
      attendeeGuestIds: [],
      seatsConfirmed: 0,
      dietaryNotes: null,
    });

    // Append-only is a trigger, and this client is `service_role`, which has
    // BYPASSRLS — so this is the one identity a policy could never have stopped.
    const { error } = await client
      .from("rsvp_responses")
      .update({ attending: true })
      .eq("invitation_id", invitationId);

    expect(error?.message ?? "").toContain("append-only");
    await expect(store.latestResponse(invitationId)).resolves.toMatchObject({
      attending: false,
    });
  });

  it("is refused by the database when a write would exceed the seat cap", async () => {
    // The third enforcement layer, checked from the outside: even if the domain
    // validation were bypassed entirely, this insert does not land.
    const before = await rawResponseCount();

    await expect(
      store.insertResponse({
        invitationId,
        attending: true,
        attendeeGuestIds: [...guestIds, ...guestIds],
        seatsConfirmed: 6,
        dietaryNotes: null,
      }),
    ).rejects.toThrow(/exceeds the 3 named members of this invitation/);

    await expect(rawResponseCount()).resolves.toBe(before);
  });
});

/**
 * The free-text message to the couple, removed from the schema itself.
 *
 * Taking the field out of the form alone would leave a column that silently
 * accepts whatever any future writer puts in it, and the couple with a second
 * inbox they have no reason to check. The flow begins in the guest's own
 * WhatsApp thread with the couple and arrives from the couple's own numbers, so
 * the reply channel that reaches them is the one they are already holding.
 *
 * `dietary_notes` is untouched on purpose: it is not a message, it is
 * operational data the catering needs and a guest will not send unprompted.
 */
describe("the removed message column", () => {
  it("is gone from rsvp_responses and from the view that reduces it", async () => {
    const columns = await withDb(async (db) => {
      const result = await db.query<{
        table_name: string;
        column_name: string;
      }>(
        `select table_name, column_name
         from information_schema.columns
         where table_schema = 'public'
           and table_name in ('rsvp_responses', 'rsvp_latest')
           and column_name in ('message', 'dietary_notes')
         order by table_name, column_name`,
      );

      return result.rows;
    });

    // `dietary_notes` present on BOTH proves the query is really looking, so
    // "no message column" cannot be explained by a typo in the table names.
    expect(columns).toEqual([
      { table_name: "rsvp_latest", column_name: "dietary_notes" },
      { table_name: "rsvp_responses", column_name: "dietary_notes" },
    ]);
  });

  it("refuses a write that still names it, rather than dropping it quietly", async () => {
    const { error } = await client.from("rsvp_responses").insert({
      invitation_id: invitationId,
      attending: false,
      seats_confirmed: 0,
      attendee_guest_ids: [],
      message: "por la puerta de atrás",
    });

    // 42703 is Postgres' undefined_column, surfaced by PostgREST as PGRST204.
    expect([error?.code, error?.message ?? ""]).toEqual([
      expect.stringMatching(/^(42703|PGRST204)$/),
      expect.stringContaining("message"),
    ]);
  });
});
