import { describe, expect, it } from "vitest";

import { validateRsvpSelection } from "@/lib/domain/seats";

import {
  captureError,
  seedInvitation,
  seedSender,
  withRollback,
} from "./helpers/db";

/**
 * One rule, two enforcement points, stated identically.
 *
 * `lib/domain/seats.ts` requires a confirmed RSVP to name exactly as many
 * attendees as the seats it confirms. The `enforce_seat_cap` trigger used to
 * check the cap and the attendee list independently, which is strictly looser:
 * it accepted "2 seats, 1 name". Two enforcement points with two different
 * rules means whichever one a future code path skips is the one that mattered,
 * and nobody finds out until a household is seated wrong.
 *
 * Every seat in this guest list corresponds to a named person — the couple has
 * the names — so equality is a real invariant, not an over-restriction.
 *
 * These tests deliberately assert the SAME cases against both layers.
 */
describe("seat rules agree between the domain and the database", () => {
  const seedHousehold = async (
    db: Parameters<Parameters<typeof withRollback>[0]>[0],
    seatsAllowed: number,
    names: readonly string[],
  ) => {
    const senderId = await seedSender(db);
    const invitationId = await seedInvitation(db, senderId, seatsAllowed);
    const guests = await db.query<{ id: string }>(
      `insert into invitation_guests (invitation_id, full_name)
       select $1, unnest($2::text[])
       returning id`,
      [invitationId, [...names]],
    );

    return { invitationId, guestIds: guests.rows.map((row) => row.id) };
  };

  it("accepts 2 confirmed seats naming 2 attendees, in the domain", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 2, attendeeGuestIds: ["a", "b"] },
        2,
      ),
    ).toEqual({ ok: true });
  });

  it("accepts 2 confirmed seats naming 2 attendees, in the database", async () => {
    const stored = await withRollback(async (db) => {
      const { invitationId, guestIds } = await seedHousehold(db, 2, [
        "Guest One",
        "Guest Two",
      ]);
      await db.query("set local role service_role");

      const inserted = await db.query<{ seats_confirmed: number }>(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
         values ($1, true, 2, $2)
         returning seats_confirmed`,
        [invitationId, guestIds],
      );

      return inserted.rows[0];
    });

    expect(stored.seats_confirmed).toBe(2);
  });

  it("rejects 2 confirmed seats naming only 1 attendee, in the domain", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 2, attendeeGuestIds: ["a"] },
        2,
      ),
    ).toEqual({ ok: false, reason: "seats_do_not_match_attendees" });
  });

  it("rejects 2 confirmed seats naming only 1 attendee, in the database", async () => {
    // The loose trigger accepted exactly this row. `service_role` has
    // BYPASSRLS, so this is our own server code being constrained, which is the
    // whole reason the rule lives in a trigger rather than a policy.
    const message = await withRollback(async (db) => {
      const { invitationId, guestIds } = await seedHousehold(db, 2, [
        "Guest One",
        "Guest Two",
      ]);
      await db.query("set local role service_role");

      return captureError(() =>
        db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
           values ($1, true, 2, $2)`,
          [invitationId, guestIds.slice(0, 1)],
        ),
      );
    });

    expect(message).toContain(
      "seats_confirmed 2 does not match attendee_guest_ids of length 1",
    );
  });

  it("rejects 3 named attendees against a 2-seat cap, in the domain", () => {
    // The hard cap is untouched by the parity rule: it still fails first, and
    // it still fails for the cap's own reason.
    expect(
      validateRsvpSelection(
        {
          attending: true,
          seatsConfirmed: 2,
          attendeeGuestIds: ["a", "b", "c"],
        },
        2,
      ),
    ).toEqual({ ok: false, reason: "attendees_exceed_allowed" });
  });

  it("rejects 3 named attendees against a 2-seat cap, in the database", async () => {
    const message = await withRollback(async (db) => {
      const { invitationId, guestIds } = await seedHousehold(db, 2, [
        "Guest One",
        "Guest Two",
        "Guest Three",
      ]);
      await db.query("set local role service_role");

      return captureError(() =>
        db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
           values ($1, true, 2, $2)`,
          [invitationId, guestIds],
        ),
      );
    });

    expect(message).toContain("exceeds seats_allowed 2");
  });

  it("accepts a decline naming nobody, in both layers", async () => {
    expect(
      validateRsvpSelection(
        { attending: false, seatsConfirmed: 0, attendeeGuestIds: [] },
        2,
      ),
    ).toEqual({ ok: true });

    const stored = await withRollback(async (db) => {
      const { invitationId } = await seedHousehold(db, 2, ["Guest One"]);
      await db.query("set local role service_role");

      const inserted = await db.query<{ seats_confirmed: number }>(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed)
         values ($1, false, 0)
         returning seats_confirmed`,
        [invitationId],
      );

      return inserted.rows[0];
    });

    expect(stored.seats_confirmed).toBe(0);
  });
});
