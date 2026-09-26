import { describe, expect, it } from "vitest";

import {
  captureError,
  seedGuests,
  seedInvitation,
  seedSender,
  withRollback,
} from "./helpers/db";

/**
 * A GUEST OUTLIVES THE INVITATION THEY WERE IN.
 *
 * Until migration 0015 `invitation_guests.invitation_id` was `not null` with
 * `on delete cascade`, which said two things at once: a guest cannot exist
 * before being placed in a household, and deleting the household deletes the
 * people. Both were wrong for how two people actually assemble a wedding list.
 *
 * The couple's answer, asked directly: "vuelven a la libreta". The first thing
 * a non-technical operator does is delete a household they assembled wrong, and
 * under a cascade that takes every name and phone number they had just typed.
 *
 * NULL IS WHAT ENFORCES THE RULE THEY ASKED FOR. "Un invitado que pertenece a
 * una invitación no debe poder pertenecer a otra" is not a check added here —
 * it is the shape of the column. One row, one `invitation_id`. A released guest
 * holds NULL, and the composite recipient key cannot match NULL, so a guest in
 * no household is unaddressable by every invitation rather than by convention.
 */
describe("releasing a guest", () => {
  it("stores a guest who belongs to no invitation yet", async () => {
    // The directory's whole premise: somebody typed into the guest list before
    // anybody decided which household they belong to.
    const stored = await withRollback(async (db) => {
      const created = await db.query<{ invitation_id: string | null }>(
        `insert into invitation_guests (invitation_id, full_name)
         values (null, 'Sin Invitación Todavía')
         returning invitation_id`,
      );

      return created.rows[0].invitation_id;
    });

    expect(stored).toBeNull();
  });

  it("returns the members to the directory when their invitation is deleted", async () => {
    const survivors = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const guestIds = await seedGuests(db, invitationId, 3);

      await db.query("delete from invitations where id = $1", [invitationId]);

      const remaining = await db.query<{
        id: string;
        invitation_id: string | null;
      }>(
        `select id, invitation_id from invitation_guests
          where id = any($1::uuid[])
          order by full_name`,
        [guestIds],
      );

      return remaining.rows;
    });

    // All three still exist, and all three are unassigned. Counting matters as
    // much as the null: a cascade that took two of them would leave the third
    // looking like a successful release.
    expect(survivors).toHaveLength(3);
    expect(survivors.every((guest) => guest.invitation_id === null)).toBe(true);
  });

  /**
   * The recipient choice disappears with the invitation that held it, which is
   * the trivial half. The half worth a test is that the DELETE succeeds AT ALL:
   * `invitations_dispatch_recipient_fk` points at `(invitation_id, id)` of the
   * guest, and the release sets that very column to NULL while the referencing
   * invitation is being deleted. Two constraint actions firing over the same
   * pair of rows is exactly where an ordering problem would live, and it would
   * surface as a delete that refuses rather than as anything subtle.
   */
  it("deletes an invitation that had chosen one of those members", async () => {
    const outcome = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [chosenId] = await seedGuests(db, invitationId, 2);

      await db.query(
        "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
        [invitationId, chosenId],
      );

      const failure = await captureError(() =>
        db.query("delete from invitations where id = $1", [invitationId]),
      );

      const released = await db.query<{ invitation_id: string | null }>(
        "select invitation_id from invitation_guests where id = $1",
        [chosenId],
      );

      return { failure, released: released.rows };
    });

    expect(outcome.failure).toBeNull();
    expect(outcome.released).toHaveLength(1);
    expect(outcome.released[0].invitation_id).toBeNull();
  });

  /**
   * THE RULE THE COUPLE ASKED FOR, STATED AS THE DATABASE HOLDS IT.
   *
   * A released guest cannot be addressed by anybody. Nothing was added to
   * achieve this: the composite key references `(invitation_id, id)`, and NULL
   * never matches, so an unassigned guest is unreachable by every invitation
   * at once. Placing them in a household is what makes them addressable again.
   */
  it("refuses to address an invitation to a guest who is in no household", async () => {
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [looseId] = await seedGuests(db, invitationId, 1);

      await db.query(
        "update invitation_guests set invitation_id = null where id = $1",
        [looseId],
      );

      return captureError(() =>
        db.query(
          "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
          [invitationId, looseId],
        ),
      );
    });

    expect(message).toContain("invitations_dispatch_recipient_fk");
  });

  /**
   * Releasing a member of a LIVE invitation clears that invitation's choice.
   *
   * This is `invitation_guests_clear_recipient_on_move` (0012) meeting a case
   * it was not written for and handling it correctly: it fires `before update
   * of invitation_id` whenever the column CHANGES, and a release changes it to
   * NULL. Without it the invitation would keep pointing at somebody who left,
   * and the foreign key — checked on the same statement — would refuse the
   * release outright.
   */
  it("clears a live invitation's choice when the chosen member is released", async () => {
    const choice = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [chosenId] = await seedGuests(db, invitationId, 2);

      await db.query(
        "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
        [invitationId, chosenId],
      );
      await db.query(
        "update invitation_guests set invitation_id = null where id = $1",
        [chosenId],
      );

      const after = await db.query<{
        dispatch_recipient_guest_id: string | null;
      }>("select dispatch_recipient_guest_id from invitations where id = $1", [
        invitationId,
      ]);

      return after.rows[0].dispatch_recipient_guest_id;
    });

    expect(choice).toBeNull();
  });
});
