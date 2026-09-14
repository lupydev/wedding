import { describe, expect, it } from "vitest";

import {
  seedGuests,
  seedInvitation,
  seedSender,
  withRollback,
} from "./helpers/db";

/**
 * `rsvp_latest` — the ONE place an RSVP aggregate is allowed to start.
 *
 * WHY THIS EXISTS. `rsvp_responses` is append-only: a guest who changes her
 * mind writes a SECOND row, and the first one stays, because "she said yes,
 * then cancelled" is information the couple wants. That history is correct and
 * it is also a trap. The obvious `count(*) where attending` over the table
 * counts every mind ever changed, so a reference project's dashboard reported
 * 47 confirmed while 17 households had answered — twice, in two different
 * screens, because the reduction was re-derived at each call site instead of
 * being one object.
 *
 * The rule this view encodes: every count, every list and every total reduces
 * to ONE row per invitation FIRST. `distinct on (invitation_id)` with a
 * matching `order by` does exactly that, in the database, once.
 *
 * The tie-break is not decoration. Two rows written in one transaction share
 * `now()` to the microsecond, so `submitted_at desc` alone leaves the winner
 * to the planner — a result that is stable in a test and arbitrary in
 * production. `id desc` after it makes the choice total and deterministic.
 *
 * These tests submit MORE THAN ONCE on purpose. A test that answers once
 * cannot see this class of defect at all: the naive count and the correct one
 * agree on every invitation that never changed its mind.
 */

/** Inserts one response and returns its id. `submittedAt` defaults to `now()`. */
async function respond(
  db: import("pg").Client,
  options: {
    invitationId: string;
    attending: boolean;
    attendeeGuestIds?: readonly string[];
    submittedAt?: string;
  },
): Promise<string> {
  const attendees = options.attendeeGuestIds ?? [];
  const result = await db.query<{ id: string }>(
    `insert into rsvp_responses
       (invitation_id, attending, seats_confirmed, attendee_guest_ids, submitted_at)
     values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))
     returning id`,
    [
      options.invitationId,
      options.attending,
      attendees.length,
      attendees,
      options.submittedAt ?? null,
    ],
  );

  return result.rows[0].id;
}

async function countRows(
  db: import("pg").Client,
  sql: string,
  params: readonly unknown[],
): Promise<number> {
  const result = await db.query<{ count: string }>(sql, [...params]);

  return Number(result.rows[0].count);
}

describe("rsvp_latest", () => {
  it("reports exactly one response per invitation, and it is the newest", async () => {
    await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [guestOne] = await seedGuests(db, invitationId, 2);

      await respond(db, {
        invitationId,
        attending: true,
        attendeeGuestIds: [guestOne],
        submittedAt: "2026-04-01T15:00:00Z",
      });
      await respond(db, {
        invitationId,
        attending: false,
        submittedAt: "2026-04-02T15:00:00Z",
      });

      const latest = await db.query<{
        attending: boolean;
        seats_confirmed: number;
      }>(
        "select attending, seats_confirmed from rsvp_latest where invitation_id = $1",
        [invitationId],
      );

      expect(latest.rowCount).toBe(1);
      expect(latest.rows[0].attending).toBe(false);
      expect(latest.rows[0].seats_confirmed).toBe(0);
    });
  });

  it("does not double-count the household that changed its mind", async () => {
    await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [guestOne, guestTwo] = await seedGuests(db, invitationId, 2);

      // Two seats confirmed, then cancelled. The history is intentionally kept.
      await respond(db, {
        invitationId,
        attending: true,
        attendeeGuestIds: [guestOne, guestTwo],
        submittedAt: "2026-04-01T15:00:00Z",
      });
      await respond(db, {
        invitationId,
        attending: false,
        submittedAt: "2026-04-02T15:00:00Z",
      });

      const naiveAttending = await countRows(
        db,
        "select count(*) from rsvp_responses where invitation_id = $1 and attending",
        [invitationId],
      );
      const naiveSeats = await countRows(
        db,
        "select coalesce(sum(seats_confirmed), 0) as count from rsvp_responses where invitation_id = $1",
        [invitationId],
      );

      const reducedAttending = await countRows(
        db,
        "select count(*) from rsvp_latest where invitation_id = $1 and attending",
        [invitationId],
      );
      const reducedSeats = await countRows(
        db,
        "select coalesce(sum(seats_confirmed), 0) as count from rsvp_latest where invitation_id = $1",
        [invitationId],
      );

      // The defect, stated as a measurement rather than a warning: over the raw
      // table this household still reads as one attending party holding two
      // seats, long after it cancelled.
      expect(naiveAttending).toBe(1);
      expect(naiveSeats).toBe(2);

      expect(reducedAttending).toBe(0);
      expect(reducedSeats).toBe(0);
    });
  });

  it("picks one row deterministically when two share a submitted_at", async () => {
    await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [guestOne] = await seedGuests(db, invitationId, 2);

      // The exact same instant, as two writes inside one transaction produce.
      const sameInstant = "2026-04-03T18:30:00Z";
      const first = await respond(db, {
        invitationId,
        attending: true,
        attendeeGuestIds: [guestOne],
        submittedAt: sameInstant,
      });
      const second = await respond(db, {
        invitationId,
        attending: false,
        submittedAt: sameInstant,
      });

      const latest = await db.query<{ id: string }>(
        "select id from rsvp_latest where invitation_id = $1",
        [invitationId],
      );

      // One row, whichever it is — a tie must never turn into two.
      expect(latest.rowCount).toBe(1);
      // And WHICH one is fixed by the `id desc` tie-break, not by the planner.
      const expected = [first, second].sort().at(-1);
      expect(latest.rows[0].id).toBe(expected);
    });
  });

  it("reduces per invitation, never across them", async () => {
    await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const yesHousehold = await seedInvitation(db, senderId);
      const noHousehold = await seedInvitation(db, senderId);
      const [yesGuest] = await seedGuests(db, yesHousehold, 1);
      const [noGuest] = await seedGuests(db, noHousehold, 1);

      await respond(db, {
        invitationId: yesHousehold,
        attending: false,
        submittedAt: "2026-04-01T10:00:00Z",
      });
      await respond(db, {
        invitationId: yesHousehold,
        attending: true,
        attendeeGuestIds: [yesGuest],
        submittedAt: "2026-04-02T10:00:00Z",
      });
      await respond(db, {
        invitationId: noHousehold,
        attending: true,
        attendeeGuestIds: [noGuest],
        submittedAt: "2026-04-01T10:00:00Z",
      });
      await respond(db, {
        invitationId: noHousehold,
        attending: false,
        submittedAt: "2026-04-02T10:00:00Z",
      });

      const rows = await db.query<{
        invitation_id: string;
        attending: boolean;
      }>(
        "select invitation_id, attending from rsvp_latest where invitation_id = any($1::uuid[]) order by invitation_id",
        [[yesHousehold, noHousehold]],
      );

      expect(rows.rowCount).toBe(2);
      expect(
        rows.rows.find((row) => row.invitation_id === yesHousehold)?.attending,
      ).toBe(true);
      expect(
        rows.rows.find((row) => row.invitation_id === noHousehold)?.attending,
      ).toBe(false);
    });
  });

  it("is not reachable by the anon or authenticated roles", async () => {
    // Every other object this change owns is default-deny, and a view is the
    // classic way that posture is lost: a view runs as its OWNER unless told
    // otherwise, so an unrevoked one hands out exactly the rows RLS refuses.
    await withRollback(async (db) => {
      const grants = await db.query(
        `select grantee from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'rsvp_latest'
            and grantee in ('anon', 'authenticated')`,
      );

      expect(grants.rowCount).toBe(0);

      const invoker = await db.query<{ reloptions: string[] | null }>(
        "select reloptions from pg_class where relname = 'rsvp_latest'",
      );

      expect(invoker.rows[0].reloptions ?? []).toContain(
        "security_invoker=true",
      );
    });
  });
});
