import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRsvpStore, type RsvpStore } from "@/lib/server/rsvp";

import { LOCAL_API_URL, withDb } from "./helpers/db";
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
 */

const keys = resolveLocalKeys();

const client = createClient(LOCAL_API_URL, keys.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let store: RsvpStore;
let senderId: string;
let invitationId: string;
let guestIds: string[];

beforeAll(async () => {
  store = createRsvpStore(client);

  await withDb(async (db) => {
    const sender = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ('Store Sender', 'partner_a', $1, '+573005550000')
       returning id`,
      [`store.${Date.now()}@example.test`],
    );
    senderId = sender.rows[0].id;

    const invitation = await db.query<{ id: string }>(
      `insert into invitations (slug, owner_sender_id, display_name, greeting_name, seats_allowed)
       values ('storeaaaaaaaaaaa', $1, 'Familia Store', 'Familia Store', 3)
       returning id`,
      [senderId],
    );
    invitationId = invitation.rows[0].id;

    const guests = await db.query<{ id: string }>(
      `insert into invitation_guests (invitation_id, full_name)
       select $1, unnest(array['Store Uno', 'Store Dos', 'Store Tres'])
       returning id`,
      [invitationId],
    );
    guestIds = guests.rows.map((row) => row.id);
  });
});

afterAll(async () => {
  await withDb(async (db) => {
    // `rsvp_responses` is append-only by trigger and refuses its own teardown,
    // so user triggers are suspended for this session only.
    await db.query("set session_replication_role = replica");
    await db.query("delete from rsvp_responses where invitation_id = $1", [
      invitationId,
    ]);
    await db.query("delete from invitation_guests where invitation_id = $1", [
      invitationId,
    ]);
    await db.query("delete from invitations where id = $1", [invitationId]);
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
      message: "¡Allá nos vemos!",
    });

    await expect(store.latestResponse(invitationId)).resolves.toMatchObject({
      invitationId,
      attending: true,
      attendeeGuestIds: [guestIds[0], guestIds[1]],
      seatsConfirmed: 2,
      dietaryNotes: "Sin mariscos.",
      message: "¡Allá nos vemos!",
    });
  });

  it("returns the newest answer after the household changes its mind", async () => {
    // The assertion this whole file exists for. Two answers, and the store must
    // report ONE — the second. An adapter reading `rsvp_responses` directly
    // would return whichever row PostgREST happened to hand back first.
    await store.insertResponse({
      invitationId,
      attending: false,
      attendeeGuestIds: [],
      seatsConfirmed: 0,
      dietaryNotes: null,
      message: null,
    });

    const current = await store.latestResponse(invitationId);

    expect(current).toMatchObject({ attending: false, seatsConfirmed: 0 });
    // And the earlier answer is still on file, because the couple wants it.
    await expect(rawResponseCount()).resolves.toBe(2);
  });

  it("cannot be talked into replacing a row", async () => {
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
        message: null,
      }),
    ).rejects.toThrow(/exceeds seats_allowed/);

    await expect(rawResponseCount()).resolves.toBe(before);
  });
});
