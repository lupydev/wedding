import { describe, expect, it } from "vitest";

import {
  captureError,
  seedGuests,
  seedInvitation,
  seedSender,
  withExclusiveSchema,
  withRollback,
} from "./helpers/db";

/**
 * The dispatch recipient is held STRUCTURALLY, not remembered.
 *
 * `invitations.dispatch_recipient_guest_id` points at one member of the same
 * invitation through a COMPOSITE foreign key on `(id, dispatch_recipient_guest_id)
 * -> invitation_guests (invitation_id, id)`. That shape is what makes a
 * cross-household recipient unrepresentable rather than merely discouraged.
 *
 * The clearing half of the story is a `before update of invitation_id` trigger,
 * because no foreign-key form in PostgreSQL can do it — measured, not read from
 * a manual, and reproduced verbatim in `0012`'s comment. The test that drops the
 * trigger and watches the move FAIL is what keeps the default `NO ACTION`
 * honest as the fail-closed backstop: if somebody ever adds an `on update`
 * clause "for completeness", that test changes meaning and has to be argued
 * with rather than quietly deleted.
 */
describe("dispatch recipient: the composite foreign key", () => {
  it("permits a recipient belonging to this invitation", async () => {
    const stored = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [memberId] = await seedGuests(db, invitationId, 2);

      const updated = await db.query<{ dispatch_recipient_guest_id: string }>(
        `update invitations
            set dispatch_recipient_guest_id = $2
          where id = $1
          returning dispatch_recipient_guest_id`,
        [invitationId, memberId],
      );

      return updated.rows[0].dispatch_recipient_guest_id;
    });

    expect(stored).toEqual(expect.any(String));
  });

  it("refuses a recipient belonging to another invitation", async () => {
    // The refusal alone would pass against a constraint that refuses
    // everything, so it ships beside its permitting case above.
    const message = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const ours = await seedInvitation(db, senderId);
      const theirs = await seedInvitation(db, senderId);
      await seedGuests(db, ours, 1);
      const [foreignMemberId] = await seedGuests(db, theirs, 1);

      return captureError(() =>
        db.query(
          "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
          [ours, foreignMemberId],
        ),
      );
    });

    expect(message).toContain("invitations_dispatch_recipient_fk");
  });

  it("deleting the chosen guest clears the choice and the invitation survives", async () => {
    const after = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [chosenId] = await seedGuests(db, invitationId, 2);
      await db.query(
        "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
        [invitationId, chosenId],
      );

      await db.query("delete from invitation_guests where id = $1", [chosenId]);

      const result = await db.query<{
        dispatch_recipient_guest_id: string | null;
      }>("select dispatch_recipient_guest_id from invitations where id = $1", [
        invitationId,
      ]);

      return { rowCount: result.rowCount, rows: result.rows };
    });

    expect(after.rowCount).toBe(1);
    expect(after.rows[0].dispatch_recipient_guest_id).toBeNull();
  });

  it("deleting the invitation still cascades, despite the two opposite-direction foreign keys", async () => {
    // 0005's lesson: `invitations -> invitation_guests` and
    // `invitation_guests -> invitations` now point at each other. Whether the
    // cascade still completes is verified, never assumed.
    const remaining = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);
      const [chosenId] = await seedGuests(db, invitationId, 3);
      await db.query(
        "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
        [invitationId, chosenId],
      );

      await db.query("delete from invitations where id = $1", [invitationId]);

      const guests = await db.query(
        "select id from invitation_guests where invitation_id = $1",
        [invitationId],
      );
      const invitations = await db.query(
        "select id from invitations where id = $1",
        [invitationId],
      );

      return { guests: guests.rowCount, invitations: invitations.rowCount };
    });

    expect(remaining).toEqual({ guests: 0, invitations: 0 });
  });
});

describe("dispatch recipient: moving a guest between invitations", () => {
  /** Two invitations, the first holding `names.length` members with a chosen recipient. */
  const seedMovePair = async (
    db: Parameters<Parameters<typeof withRollback>[0]>[0],
  ) => {
    const senderId = await seedSender(db);
    const source = await seedInvitation(db, senderId);
    const destination = await seedInvitation(db, senderId);
    const [chosenId, otherId] = await seedGuests(db, source, 2);
    const [destinationMemberId] = await seedGuests(db, destination, 1);

    await db.query(
      "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
      [source, chosenId],
    );
    await db.query(
      "update invitations set dispatch_recipient_guest_id = $2 where id = $1",
      [destination, destinationMemberId],
    );

    return { source, destination, chosenId, otherId, destinationMemberId };
  };

  const recipientOf = async (
    db: Parameters<Parameters<typeof withRollback>[0]>[0],
    invitationId: string,
  ) => {
    const result = await db.query<{
      dispatch_recipient_guest_id: string | null;
    }>("select dispatch_recipient_guest_id from invitations where id = $1", [
      invitationId,
    ]);

    return result.rows[0].dispatch_recipient_guest_id;
  };

  it("clears the choice when the moved guest IS the chosen recipient", async () => {
    const recipient = await withRollback(async (db) => {
      const { source, destination, chosenId } = await seedMovePair(db);

      await db.query(
        "update invitation_guests set invitation_id = $2 where id = $1",
        [chosenId, destination],
      );

      return recipientOf(db, source);
    });

    expect(recipient).toBeNull();
  });

  it("leaves the choice alone when the moved guest is NOT the chosen recipient", async () => {
    // The trigger's other branch. Without this, a trigger that cleared
    // unconditionally would pass the test above and still be wrong.
    const kept = await withRollback(async (db) => {
      const { source, destination, chosenId, otherId } = await seedMovePair(db);

      await db.query(
        "update invitation_guests set invitation_id = $2 where id = $1",
        [otherId, destination],
      );

      return { recipient: await recipientOf(db, source), chosenId };
    });

    expect(kept.recipient).toBe(kept.chosenId);
  });

  it("leaves the DESTINATION invitation's recipient untouched", async () => {
    // D25: the choice is cleared, never carried. Carrying it would be an
    // auto-pick nobody made, which is the failure decision 2 exists to prevent.
    const destinationRecipient = await withRollback(async (db) => {
      const { destination, chosenId, destinationMemberId } =
        await seedMovePair(db);

      await db.query(
        "update invitation_guests set invitation_id = $2 where id = $1",
        [chosenId, destination],
      );

      return {
        actual: await recipientOf(db, destination),
        expected: destinationMemberId,
      };
    });

    expect(destinationRecipient.actual).toBe(destinationRecipient.expected);
  });

  it("without the trigger, the very same move FAILS on the foreign key", async () => {
    // The backstop, proved rather than claimed. The default `NO ACTION` refuses
    // the move outright (measured probe 3), which is why `0012` writes no
    // `on update` clause and why adding one later cannot pass unnoticed.
    // `withExclusiveSchema`, not `withRollback`: dropping a trigger takes ACCESS
    // EXCLUSIVE on `invitation_guests`, which makes this case a schema mutator
    // and therefore half of the lock cycle a committing fixture closes from the
    // other side. The helper takes both tables up front under a `lock_timeout`
    // shorter than `deadlock_timeout`, so this transaction is the one that aborts
    // and retries instead of an unrelated test being chosen as the victim.
    const message = await withExclusiveSchema(async (db) => {
      const { destination, chosenId } = await seedMovePair(db);

      await db.query(
        "drop trigger invitation_guests_clear_recipient_on_move on invitation_guests",
      );

      return captureError(() =>
        db.query(
          "update invitation_guests set invitation_id = $2 where id = $1",
          [chosenId, destination],
        ),
      );
    });

    expect(message).toContain("violates foreign key constraint");
    expect(message).toContain("invitations_dispatch_recipient_fk");
  });
});

describe("dispatch recipient: the trigger function's grants", () => {
  it("is not executable by anon or authenticated", async () => {
    // `alter default privileges` never covered FUNCTIONS, and PostgREST
    // publishes an unrevoked one as an anon-callable RPC. `0012` revokes it
    // explicitly rather than inheriting the protection from 0004.
    const privileges = await withRollback(async (db) => {
      const result = await db.query<{
        anon: boolean;
        authenticated: boolean;
        owner: boolean;
      }>(
        `select has_function_privilege('anon', 'clear_recipient_on_guest_move()', 'execute') as anon,
                has_function_privilege('authenticated', 'clear_recipient_on_guest_move()', 'execute') as authenticated,
                has_function_privilege('postgres', 'clear_recipient_on_guest_move()', 'execute') as owner`,
      );

      return result.rows[0];
    });

    expect(privileges.anon).toBe(false);
    expect(privileges.authenticated).toBe(false);
    // The owner keeps it, so the revoke is scoped rather than a function nobody
    // can call — which would pass the two assertions above while proving
    // nothing about who was actually shut out.
    expect(privileges.owner).toBe(true);
  });
});
