import { describe, expect, it } from "vitest";

import { seedInvitation, seedSender, withRollback } from "./helpers/db";

/**
 * Dedicated security test for the `invitation_guests.phone_last8` generated
 * column.
 *
 * The `nullif(...)` wrapper in the column definition is a SECURITY CONTROL, not
 * a style choice. Without it, a guest whose `phone_e164` is NULL stores the
 * empty string, and an empty or blank gate submission — whose derived key is
 * also the empty string — matches that row. Anyone merely holding the link
 * would open the invitation. NULL never equals NULL, so the wrapper closes it.
 */
describe("invitation_guests.phone_last8", () => {
  it("is NULL, never the empty string, when phone_e164 is NULL", async () => {
    const stored = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);

      const inserted = await db.query<{ phone_last8: string | null }>(
        `insert into invitation_guests (invitation_id, full_name, phone_e164)
         values ($1, 'Guest Without Phone', null)
         returning phone_last8`,
        [invitationId],
      );

      return inserted.rows[0].phone_last8;
    });

    expect(stored).toBeNull();
    expect(stored).not.toBe("");
  });

  it("holds exactly the last 8 digits when phone_e164 is present", async () => {
    const stored = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);

      const inserted = await db.query<{ phone_last8: string | null }>(
        `insert into invitation_guests (invitation_id, full_name, phone_e164)
         values ($1, 'Guest With Phone', '+573001234567')
         returning phone_last8`,
        [invitationId],
      );

      return inserted.rows[0].phone_last8;
    });

    expect(stored).toBe("01234567");
  });

  it("cannot be matched by an empty gate submission", async () => {
    const matches = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);

      await db.query(
        `insert into invitation_guests (invitation_id, full_name, phone_e164)
         values ($1, 'Guest Without Phone', null),
                ($1, 'Guest With Phone', '+573009876543')`,
        [invitationId],
      );

      // Exactly the lookup the gate performs, with the empty string an
      // unpopulated submission would derive.
      const found = await db.query(
        `select id from invitation_guests
         where invitation_id = $1 and phone_last8 = $2`,
        [invitationId, ""],
      );

      return found.rowCount;
    });

    expect(matches).toBe(0);
  });

  it("is matched by the last 8 digits of a guest's real number", async () => {
    const matchedNames = await withRollback(async (db) => {
      const senderId = await seedSender(db);
      const invitationId = await seedInvitation(db, senderId);

      await db.query(
        `insert into invitation_guests (invitation_id, full_name, phone_e164)
         values ($1, 'Guest Without Phone', null),
                ($1, 'Guest With Phone', '+573009876543')`,
        [invitationId],
      );

      const found = await db.query<{ full_name: string }>(
        `select full_name from invitation_guests
         where invitation_id = $1 and phone_last8 = $2`,
        [invitationId, "09876543"],
      );

      return found.rows.map((row) => row.full_name);
    });

    expect(matchedNames).toEqual(["Guest With Phone"]);
  });
});
