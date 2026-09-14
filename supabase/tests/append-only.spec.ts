import { describe, expect, it } from "vitest";

import {
  captureError,
  seedGuests,
  seedInvitation,
  seedSender,
  withRollback,
} from "./helpers/db";

/**
 * Append-only enforcement, and why it is a TRIGGER rather than a policy.
 *
 * The `sb_secret_` key maps to `service_role`, which has BYPASSRLS. An RLS
 * policy therefore cannot make a table append-only against our own server
 * code — the exact code most likely to issue an accidental UPDATE. Every test
 * below runs `set local role service_role` so a passing result proves the
 * trigger fired, not that RLS blocked the statement.
 */
describe("append-only tables (as service_role)", () => {
  it("confirms service_role really does bypass RLS", async () => {
    const bypasses = await withRollback(async (db) => {
      const result = await db.query<{ rolbypassrls: boolean }>(
        "select rolbypassrls from pg_roles where rolname = 'service_role'",
      );

      return result.rows[0]?.rolbypassrls;
    });

    // If this ever becomes false the tests below stop proving what they claim.
    expect(bypasses).toBe(true);
  });

  it("rejects UPDATE on dispatch_events", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      await db.query(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind)
         values ($1, $2, 'marked_sent')`,
        [invitationId, senderId],
      );
      await db.query("set local role service_role");

      return captureError(() =>
        db.query("update dispatch_events set kind = 'marked_failed'"),
      );
    });

    expect(message).toContain("dispatch_events is append-only");
  });

  it("rejects DELETE on dispatch_events", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      await db.query(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind)
         values ($1, $2, 'link_opened')`,
        [invitationId, senderId],
      );
      await db.query("set local role service_role");

      return captureError(() => db.query("delete from dispatch_events"));
    });

    expect(message).toContain("dispatch_events is append-only");
  });

  it("rejects UPDATE on rsvp_responses", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const guestIds = await seedGuests(db, invitationId, 2);
      await db.query(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
         values ($1, true, 2, $2)`,
        [invitationId, guestIds],
      );
      await db.query("set local role service_role");

      return captureError(() =>
        db.query("update rsvp_responses set seats_confirmed = 1"),
      );
    });

    expect(message).toContain("rsvp_responses is append-only");
  });

  it("rejects DELETE on rsvp_responses", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      await db.query(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed)
         values ($1, false, 0)`,
        [invitationId],
      );
      await db.query("set local role service_role");

      return captureError(() => db.query("delete from rsvp_responses"));
    });

    expect(message).toContain("rsvp_responses is append-only");
  });

  it("still accepts a second INSERT, so the answer can change", async () => {
    const seats = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const guestIds = await seedGuests(db, invitationId, 3);
      await db.query("set local role service_role");
      // Explicit timestamps: both statements run inside one transaction, where
      // `now()` is the transaction start time, so the default would tie and the
      // "latest row wins" ordering would be arbitrary. Real submissions arrive
      // in separate transactions.
      await db.query(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids, submitted_at)
         values ($1, true, 3, $2, timestamptz '2026-01-01 10:00:00+00')`,
        [invitationId, guestIds],
      );
      await db.query(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, submitted_at)
         values ($1, false, 0, timestamptz '2026-01-01 11:00:00+00')`,
        [invitationId],
      );

      const result = await db.query<{ seats_confirmed: number }>(
        `select seats_confirmed from rsvp_responses
         where invitation_id = $1
         order by submitted_at desc`,
        [invitationId],
      );

      return result.rows.map((row) => row.seats_confirmed);
    });

    expect(seats).toEqual([0, 3]);
  });
});

/**
 * Seat allowance is a HARD CAP (design D6, confirmed product decision). It is
 * an invariant, so it is enforced at the database, not only in the form the
 * attacker controls.
 *
 * Since migration 0012 the cap is the invitation's own member count. The rule
 * did not loosen — the allowance simply stopped being a second number a human
 * could set to disagree with the names.
 */
describe("rsvp seat cap (as service_role)", () => {
  it("rejects seats_confirmed above the invitation's member count", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      await seedGuests(db, invitationId, 3);
      await db.query("set local role service_role");

      return captureError(() =>
        db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed)
           values ($1, true, 4)`,
          [invitationId],
        ),
      );
    });

    expect(message).toContain(
      "seats_confirmed 4 exceeds the 3 named members of this invitation",
    );
  });

  it("rejects more attendee_guest_ids than the invitation has members", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const guests = await db.query<{ id: string }>(
        `insert into invitation_guests (invitation_id, full_name)
         values ($1, 'Guest One'), ($1, 'Guest Two')
         returning id`,
        [invitationId],
      );
      await db.query("set local role service_role");

      return captureError(() =>
        db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
           values ($1, true, 2, $2)`,
          [
            invitationId,
            [
              ...guests.rows.map((row) => row.id),
              "00000000-0000-4000-8000-000000000000",
            ],
          ],
        ),
      );
    });

    expect(message).toContain(
      "seats_confirmed 2 exceeds the 2 named members of this invitation",
    );
  });

  it("accepts a selection exactly at the cap", async () => {
    const stored = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const guests = await db.query<{ id: string }>(
        `insert into invitation_guests (invitation_id, full_name)
         values ($1, 'Guest One'), ($1, 'Guest Two')
         returning id`,
        [invitationId],
      );
      await db.query("set local role service_role");

      const inserted = await db.query<{
        seats_confirmed: number;
        attendee_guest_ids: string[];
      }>(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
         values ($1, true, 2, $2)
         returning seats_confirmed, attendee_guest_ids`,
        [invitationId, guests.rows.map((row) => row.id)],
      );

      return inserted.rows[0];
    });

    expect(stored.seats_confirmed).toBe(2);
    expect(stored.attendee_guest_ids).toHaveLength(2);
  });
});

/**
 * Append-only must not mean undeletable.
 *
 * `reject_mutation()` originally rejected EVERY delete, including the one fired
 * by `on delete cascade` when the parent `invitations` row goes. An invitation
 * that had ever been dispatched could therefore never be removed — not even a
 * row created by mistake during import, which is the single most likely reason
 * to need a delete at all.
 *
 * The chosen discrimination is the parent's existence. A cascading delete is
 * fired by the FK's AFTER DELETE trigger on `invitations`, so by the time the
 * child's BEFORE DELETE trigger runs, the parent row is already gone in this
 * transaction's view. A direct delete always leaves it there, because
 * `invitation_id` is NOT NULL and its FK is not deferrable. The distinction is
 * therefore a fact about the transaction, not a heuristic about call depth.
 */
describe("cascade delete vs. direct delete (as service_role)", () => {
  it("deletes an invitation that already has dispatch events and RSVPs", async () => {
    const remaining = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      await db.query(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind)
         values ($1, $2, 'marked_sent'), ($1, $2, 'resent')`,
        [invitationId, senderId],
      );
      const guestIds = await seedGuests(db, invitationId, 2);
      await db.query(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
         values ($1, true, 2, $2)`,
        [invitationId, guestIds],
      );
      await db.query("set local role service_role");

      await db.query("delete from invitations where id = $1", [invitationId]);

      const counts: Record<string, number> = {};
      for (const table of [
        "invitations",
        "dispatch_events",
        "rsvp_responses",
        "invitation_guests",
      ]) {
        const column = table === "invitations" ? "id" : "invitation_id";
        const result = await db.query(
          `select 1 from ${table} where ${column} = $1`,
          [invitationId],
        );
        counts[table] = result.rowCount ?? 0;
      }

      return counts;
    });

    expect(remaining).toEqual({
      invitations: 0,
      dispatch_events: 0,
      rsvp_responses: 0,
      invitation_guests: 0,
    });
  });

  it("still rejects deleting one dispatch event while its invitation lives", async () => {
    const outcome = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const event = await db.query<{ id: string }>(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind)
         values ($1, $2, 'marked_sent')
         returning id`,
        [invitationId, senderId],
      );
      await db.query("set local role service_role");
      await db.query("savepoint probe");

      const message = await captureError(() =>
        db.query("delete from dispatch_events where id = $1", [
          event.rows[0].id,
        ]),
      );
      await db.query("rollback to savepoint probe");

      const survivors = await db.query(
        "select 1 from dispatch_events where invitation_id = $1",
        [invitationId],
      );

      return { message, survivors: survivors.rowCount };
    });

    expect(outcome.message).toContain("dispatch_events is append-only");
    expect(outcome.survivors).toBe(1);
  });

  it("still rejects deleting one RSVP response while its invitation lives", async () => {
    const outcome = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const guestIds = await seedGuests(db, invitationId, 1);
      const response = await db.query<{ id: string }>(
        `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
         values ($1, true, 1, $2)
         returning id`,
        [invitationId, guestIds],
      );
      await db.query("set local role service_role");
      await db.query("savepoint probe");

      const message = await captureError(() =>
        db.query("delete from rsvp_responses where id = $1", [
          response.rows[0].id,
        ]),
      );
      await db.query("rollback to savepoint probe");

      const survivors = await db.query(
        "select 1 from rsvp_responses where invitation_id = $1",
        [invitationId],
      );

      return { message, survivors: survivors.rowCount };
    });

    expect(outcome.message).toContain("rsvp_responses is append-only");
    expect(outcome.survivors).toBe(1);
  });

  it("still rejects an UPDATE even when the invitation is being deleted", async () => {
    // The cascade exemption is DELETE-only. An UPDATE has no cascading form
    // here — `invitations.id` is never updated — so allowing one would widen
    // the hole well past the finding.
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      await db.query(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind)
         values ($1, $2, 'marked_sent')`,
        [invitationId, senderId],
      );
      await db.query("set local role service_role");

      return captureError(() =>
        db.query("update dispatch_events set kind = 'marked_failed'"),
      );
    });

    expect(message).toContain("dispatch_events is append-only");
  });
});
