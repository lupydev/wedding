import { describe, expect, it } from "vitest";

import { withDb, withRollback } from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";
import {
  createInvitation,
  findInvitationBySlug,
  listSenderDirectory,
  toGatePhoneRefs,
  toGuestFacingInvitation,
  validateImportRow,
  type ImportRow,
  type SenderDirectory,
} from "./invitations";
import { createServerSupabaseClient } from "./supabase";

const SENDERS: SenderDirectory = {
  "ana@example.test": "11111111-1111-4111-8111-111111111111",
  "bruno@example.test": "22222222-2222-4222-8222-222222222222",
};

function importRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    ownerEmail: "ana@example.test",
    displayName: "Familia Restrepo",
    greetingName: "Familia Restrepo",
    seatsAllowed: 3,
    guests: [
      { fullName: "Ana Restrepo", phone: "3001234567", isPrimary: true },
      { fullName: "Nicolás Muñóz", phone: "300 765 4321" },
    ],
    ...overrides,
  };
}

describe("validateImportRow — sender ownership is mandatory", () => {
  it("resolves the owner email to exactly one sender id", () => {
    const validated = validateImportRow(importRow(), SENDERS, "CO");

    expect(validated.ownerSenderId).toBe(SENDERS["ana@example.test"]);
  });

  it("rejects a row whose owner column is empty", () => {
    expect(() =>
      validateImportRow(importRow({ ownerEmail: "  " }), SENDERS, "CO"),
    ).toThrow(/owner/i);
  });

  it("rejects a row whose owner is not a known sender", () => {
    expect(() =>
      validateImportRow(
        importRow({ ownerEmail: "carlos@example.test" }),
        SENDERS,
        "CO",
      ),
    ).toThrow(/unrecognized owner/i);
  });

  it("never yields an invitation without an owner", () => {
    const validated = validateImportRow(importRow(), SENDERS, "CO");

    expect(typeof validated.ownerSenderId).toBe("string");
    expect(validated.ownerSenderId.length).toBeGreaterThan(0);
  });
});

describe("validateImportRow — guest data", () => {
  it("normalizes every guest phone to E.164 for the configured country", () => {
    const validated = validateImportRow(importRow(), SENDERS, "CO");

    expect(validated.guests.map((guest) => guest.phoneE164)).toEqual([
      "+573001234567",
      "+573007654321",
    ]);
  });

  it("keeps a guest with no phone, storing null rather than an empty string", () => {
    const validated = validateImportRow(
      importRow({
        guests: [
          { fullName: "Ana Restrepo", phone: "3001234567", isPrimary: true },
          { fullName: "Niño Restrepo", isChild: true },
        ],
      }),
      SENDERS,
      "CO",
    );

    expect(validated.guests[1].phoneE164).toBeNull();
  });

  it("rejects a phone that cannot be normalized rather than storing junk", () => {
    expect(() =>
      validateImportRow(
        importRow({ guests: [{ fullName: "Ana", phone: "12" }] }),
        SENDERS,
        "CO",
      ),
    ).toThrow(/Familia Restrepo/);
  });

  it("rejects a seats_allowed of zero, which the hard cap forbids", () => {
    expect(() =>
      validateImportRow(importRow({ seatsAllowed: 0 }), SENDERS, "CO"),
    ).toThrow(/seats/i);
  });

  it("rejects a row with no guests at all", () => {
    expect(() =>
      validateImportRow(importRow({ guests: [] }), SENDERS, "CO"),
    ).toThrow(/guest/i);
  });

  it("rejects more than one primary guest per invitation", () => {
    expect(() =>
      validateImportRow(
        importRow({
          guests: [
            { fullName: "Ana", phone: "3001234567", isPrimary: true },
            { fullName: "Bruno", phone: "3007654321", isPrimary: true },
          ],
        }),
        SENDERS,
        "CO",
      ),
    ).toThrow(/primary/i);
  });
});

describe("toGuestFacingInvitation — phones never leave the server", () => {
  const record = {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "abcdefghijklmnop",
    ownerSenderId: SENDERS["ana@example.test"],
    displayName: "Familia Restrepo",
    greetingName: "Familia Restrepo",
    seatsAllowed: 3,
    rsvpDeadline: "2026-05-01",
    guests: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        fullName: "Ana Restrepo",
        phoneE164: "+573001234567",
        phoneLast8: "01234567",
        isPrimary: true,
        isChild: false,
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        fullName: "Niño Restrepo",
        phoneE164: null,
        phoneLast8: null,
        isPrimary: false,
        isChild: true,
      },
    ],
  };

  it("keeps the fields the invitation body actually renders", () => {
    const mapped = toGuestFacingInvitation(record);

    expect(mapped).toEqual({
      slug: "abcdefghijklmnop",
      greetingName: "Familia Restrepo",
      displayName: "Familia Restrepo",
      seatsAllowed: 3,
      rsvpDeadline: "2026-05-01",
      guests: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          fullName: "Ana Restrepo",
          isChild: false,
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          fullName: "Niño Restrepo",
          isChild: true,
        },
      ],
    });
  });

  it("contains no phone value anywhere in its serialized form", () => {
    const serialized = JSON.stringify(toGuestFacingInvitation(record));

    expect(serialized).not.toContain("+573001234567");
    expect(serialized).not.toContain("01234567");
    expect(serialized).not.toContain("phone");
  });

  it("still exposes the last-8 refs on the SERVER side, for the gate", () => {
    expect(toGatePhoneRefs(record)).toEqual([
      { phone_last8: "01234567" },
      { phone_last8: null },
    ]);
  });
});

describe("invitations repository (local Supabase)", () => {
  it("persists an invitation with its owner and guests, and reads it back by slug", async () => {
    const { secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;

    // Real sender rows, so the FK on owner_sender_id is genuinely satisfied.
    const senderId = await withDb(async (db) => {
      const result = await db.query<{ id: string }>(
        `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
         values ('Ana', 'partner_a', $1, '+573001110000')
         returning id`,
        [`ana.${Date.now()}@example.test`],
      );
      return result.rows[0].id;
    });

    const client = createServerSupabaseClient();

    try {
      const created = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Restrepo",
        greetingName: "Familia Restrepo",
        seatsAllowed: 3,
        rsvpDeadline: null,
        guests: [
          {
            fullName: "Ana Restrepo",
            phoneE164: "+573001234567",
            isPrimary: true,
            isChild: false,
          },
          {
            fullName: "Niño Restrepo",
            phoneE164: null,
            isPrimary: false,
            isChild: true,
          },
        ],
      });

      expect(created.slug).toMatch(/^[a-z2-7]{16}$/);

      const found = await findInvitationBySlug(client, created.slug);

      expect(found?.ownerSenderId).toBe(senderId);
      expect(found?.guests.map((guest) => guest.fullName).sort()).toEqual([
        "Ana Restrepo",
        "Niño Restrepo",
      ]);
      // The generated column, read back through the adapter.
      expect(found?.guests.find((guest) => guest.isPrimary)?.phoneLast8).toBe(
        "01234567",
      );
      expect(
        found?.guests.find((guest) => guest.isChild)?.phoneLast8,
      ).toBeNull();
    } finally {
      await withDb(async (db) => {
        await db.query("delete from invitations where owner_sender_id = $1", [
          senderId,
        ]);
        await db.query("delete from senders where id = $1", [senderId]);
      });
    }
  });

  it("returns null for a slug that does not exist", async () => {
    const { secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;

    const found = await findInvitationBySlug(
      createServerSupabaseClient(),
      "zzzzzzzzzzzzzzzz",
    );

    expect(found).toBeNull();
  });

  it("refuses to create an invitation whose owner does not exist", async () => {
    const { secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;

    await expect(
      createInvitation(createServerSupabaseClient(), {
        ownerSenderId: "99999999-9999-4999-8999-999999999999",
        displayName: "Sin Dueño",
        greetingName: "Sin Dueño",
        seatsAllowed: 2,
        rsvpDeadline: null,
        guests: [
          {
            fullName: "Guest",
            phoneE164: "+573001234567",
            isPrimary: true,
            isChild: false,
          },
        ],
      }),
    ).rejects.toThrow();

    // And nothing was left behind.
    const orphans = await withRollback(async (db) => {
      const result = await db.query(
        "select 1 from invitations where display_name = 'Sin Dueño'",
      );
      return result.rowCount;
    });

    expect(orphans).toBe(0);
  });
});

describe("listSenderDirectory (local Supabase)", () => {
  it("maps every allowlisted email to exactly one sender id", async () => {
    const { secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;

    const stamp = Date.now();
    const emails = [`ana.${stamp}@example.test`, `bruno.${stamp}@example.test`];

    const senderIds = await withDb(async (db) => {
      const result = await db.query<{ id: string; allowlisted_email: string }>(
        `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
         values ('Ana', 'partner_a', $1, '+573001110000'),
                ('Bruno', 'partner_b', $2, '+573001110001')
         returning id, allowlisted_email`,
        emails,
      );
      return new Map(
        result.rows.map((row) => [row.allowlisted_email, row.id] as const),
      );
    });

    try {
      const directory = await listSenderDirectory(createServerSupabaseClient());

      expect(directory[emails[0]]).toBe(senderIds.get(emails[0]));
      expect(directory[emails[1]]).toBe(senderIds.get(emails[1]));
      expect(directory[emails[0]]).not.toBe(directory[emails[1]]);
    } finally {
      await withDb(async (db) => {
        await db.query(
          "delete from senders where allowlisted_email = any($1)",
          [emails],
        );
      });
    }
  });
});
