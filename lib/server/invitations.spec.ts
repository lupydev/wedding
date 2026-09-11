import { describe, expect, it } from "vitest";

import {
  captureError,
  withDb,
  withRollback,
} from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";
import { summarizeConsoleList } from "@/lib/domain/console-list";

import {
  createInvitation,
  findInvitationBySlug,
  findGuestInvitationOwner,
  importInvitations,
  findConsoleInvitation,
  listConsoleInvitations,
  listOperatorProfiles,
  listSenderDirectory,
  updateGuestPhone,
  toGatePhoneRefs,
  toGuestFacingInvitation,
  validateImportRow,
  validateImportRows,
  type ImportRow,
  type NewInvitation,
  type SenderDirectory,
} from "./invitations";
import { createServerSupabaseClient } from "./supabase";

/** Base32 alphabet the `invitations.slug` CHECK constraint accepts. */
const CONSOLE_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/** A well-formed slug for a console fixture. Random, so parallel files cannot collide. */
function makeConsoleSlug(): string {
  let slug = "";

  for (let index = 0; index < 16; index += 1) {
    slug +=
      CONSOLE_SLUG_ALPHABET[
        Math.floor(Math.random() * CONSOLE_SLUG_ALPHABET.length)
      ];
  }

  return slug;
}

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

describe("validateImportRows — the source must be re-runnable", () => {
  it("derives a stable source key from the row's identity", () => {
    const first = validateImportRows([importRow()], SENDERS, "CO");
    const second = validateImportRows([importRow()], SENDERS, "CO");

    expect(first[0].sourceKey).toBe(second[0].sourceKey);
    expect(first[0].sourceKey).toBe("ana@example.test|familia restrepo");
  });

  it("gives two different households two different source keys", () => {
    const validated = validateImportRows(
      [
        importRow(),
        importRow({
          displayName: "Familia Muñóz",
          greetingName: "Familia Muñóz",
        }),
      ],
      SENDERS,
      "CO",
    );

    expect(validated[0].sourceKey).not.toBe(validated[1].sourceKey);
  });

  it("lets a row declare its own key, for two households sharing a name", () => {
    const validated = validateImportRows(
      [
        importRow({ sourceKey: "restrepo-bogota" }),
        importRow({ sourceKey: "restrepo-medellin" }),
      ],
      SENDERS,
      "CO",
    );

    expect(validated.map((row) => row.sourceKey)).toEqual([
      "restrepo-bogota",
      "restrepo-medellin",
    ]);
  });

  it("rejects a file whose rows collide on one source key", () => {
    // Left unchecked, the second row would be silently swallowed by the
    // idempotent insert and one household would never be invited.
    expect(() =>
      validateImportRows([importRow(), importRow()], SENDERS, "CO"),
    ).toThrow(/source key/i);
  });
});

describe("importInvitations — atomic and idempotent (local Supabase)", () => {
  function useLocalSecretKey(): void {
    const { secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;
  }

  async function seedOwner(): Promise<string> {
    return withDb(async (db) => {
      const result = await db.query<{ id: string }>(
        `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
         values ('Ana', 'partner_a', $1, '+573001110000')
         returning id`,
        [`ana.import.${Date.now()}.${Math.random()}@example.test`],
      );
      return result.rows[0].id;
    });
  }

  async function dropOwner(senderId: string): Promise<void> {
    await withDb(async (db) => {
      // The cascade from `invitations` is what 0005 made possible; before it,
      // this teardown could not remove a dispatched invitation at all.
      await db.query("delete from invitations where owner_sender_id = $1", [
        senderId,
      ]);
      await db.query("delete from senders where id = $1", [senderId]);
    });
  }

  function household(
    ownerSenderId: string,
    sourceKey: string,
    displayName: string,
  ): NewInvitation {
    return {
      ownerSenderId,
      sourceKey,
      displayName,
      greetingName: displayName,
      seatsAllowed: 2,
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
    };
  }

  it("persists nothing at all when a later row fails", async () => {
    useLocalSecretKey();
    const senderId = await seedOwner();
    const stamp = `atomic-${Date.now()}`;

    try {
      const good = household(senderId, `${stamp}-a`, "Familia Restrepo");
      // A real mid-import failure: an owner id that is not in `senders`, which
      // the FK rejects at write time rather than at validation time.
      const bad = {
        ...household(senderId, `${stamp}-b`, "Familia Muñóz"),
        ownerSenderId: "99999999-9999-4999-8999-999999999999",
      };

      await expect(
        importInvitations(createServerSupabaseClient(), [good, bad]),
      ).rejects.toThrow();

      const persisted = await withDb(async (db) => {
        const result = await db.query(
          "select source_key from invitations where source_key like $1",
          [`${stamp}-%`],
        );
        return result.rowCount;
      });

      // The row that WOULD have succeeded must be gone too. That is the whole
      // point: a half-imported guest list has no clean way to be re-run.
      expect(persisted).toBe(0);
    } finally {
      await dropOwner(senderId);
    }
  });

  it("creates no duplicates when the same source is imported twice", async () => {
    useLocalSecretKey();
    const senderId = await seedOwner();
    const stamp = `idempotent-${Date.now()}`;
    const client = createServerSupabaseClient();

    try {
      const source = [
        household(senderId, `${stamp}-a`, "Familia Restrepo"),
        household(senderId, `${stamp}-b`, "Familia Muñóz"),
      ];

      const first = await importInvitations(client, source);
      const second = await importInvitations(client, source);

      const counts = await withDb(async (db) => {
        const invitations = await db.query(
          "select id from invitations where source_key like $1",
          [`${stamp}-%`],
        );
        const guests = await db.query(
          `select g.id from invitation_guests g
           join invitations i on i.id = g.invitation_id
           where i.source_key like $1`,
          [`${stamp}-%`],
        );
        return {
          invitations: invitations.rowCount,
          guests: guests.rowCount,
        };
      });

      expect(first.map((row) => row.created)).toEqual([true, true]);
      expect(second.map((row) => row.created)).toEqual([false, false]);
      // The second run reports the slug that already exists, so a re-run is
      // still usable output rather than a silent no-op.
      expect(second.map((row) => row.slug)).toEqual(
        first.map((row) => row.slug),
      );
      expect(counts).toEqual({ invitations: 2, guests: 4 });
    } finally {
      await dropOwner(senderId);
    }
  });

  it("is not reachable by anon, even though PostgREST publishes RPCs", async () => {
    const message = await withRollback(async (db) => {
      await db.query("set local role anon");

      return captureError(() =>
        db.query("select import_invitations('[]'::jsonb)"),
      );
    });

    expect(message).toMatch(/permission denied/i);
  });
});

/**
 * The console guest list, against the real local stack.
 *
 * These read through PostgREST rather than over the `pg` connection, so the
 * fixtures are COMMITTED and removed in `finally`. A rolled-back fixture would
 * be invisible to the HTTP client and every assertion would be measuring an
 * empty result set.
 */
describe("listConsoleInvitations (local Supabase)", () => {
  interface ConsoleFixture {
    readonly anaId: string;
    readonly betoId: string;
    readonly anaInvitationId: string;
    readonly betoInvitationId: string;
    readonly anaGuestId: string;
  }

  async function withConsoleFixture(
    body: (fixture: ConsoleFixture) => Promise<void>,
  ): Promise<void> {
    const { secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;

    const suffix = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    const fixture = await withDb(async (db) => {
      const senders = await db.query<{ id: string }>(
        `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
         values ('Ana Operadora', 'partner_a', $1, '+573001110000'),
                ('Beto Operador', 'partner_b', $2, '+573001110001')
         returning id`,
        [`ana.${suffix}@example.test`, `beto.${suffix}@example.test`],
      );
      const [anaId, betoId] = senders.rows.map((sender) => sender.id);

      const invitations = await db.query<{ id: string }>(
        `insert into invitations (slug, owner_sender_id, display_name, greeting_name, seats_allowed)
         values ($1, $3, 'Familia Muñóz', 'Familia Muñóz', 2),
                ($2, $4, 'Familia Peña', 'Familia Peña', 3)
         returning id`,
        [makeConsoleSlug(), makeConsoleSlug(), anaId, betoId],
      );
      const [anaInvitationId, betoInvitationId] = invitations.rows.map(
        (invitation) => invitation.id,
      );

      const guests = await db.query<{ id: string }>(
        `insert into invitation_guests (invitation_id, full_name, phone_e164, is_primary)
         values ($1, 'Ana Muñóz', '+573001234567', true)
         returning id`,
        [anaInvitationId],
      );

      return {
        anaId,
        betoId,
        anaInvitationId,
        betoInvitationId,
        anaGuestId: guests.rows[0].id,
      };
    });

    try {
      await body(fixture);
    } finally {
      await withDb(async (db) => {
        await db.query("set session_replication_role = replica");
        await db.query(
          "delete from rsvp_responses where invitation_id = any($1)",
          [[fixture.anaInvitationId, fixture.betoInvitationId]],
        );
        await db.query(
          "delete from dispatch_events where invitation_id = any($1)",
          [[fixture.anaInvitationId, fixture.betoInvitationId]],
        );
        await db.query(
          "delete from invitation_guests where invitation_id = any($1)",
          [[fixture.anaInvitationId, fixture.betoInvitationId]],
        );
        await db.query("delete from invitations where id = any($1)", [
          [fixture.anaInvitationId, fixture.betoInvitationId],
        ]);
        await db.query("delete from senders where id = any($1)", [
          [fixture.anaId, fixture.betoId],
        ]);
        await db.query("reset session_replication_role");
      });
    }
  }

  it("lists only the signed-in operator's own invitations by default", async () => {
    await withConsoleFixture(async (fixture) => {
      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: true,
        defaultCountry: "CO",
      });

      expect(rows.map((row) => row.invitationId)).toEqual([
        fixture.anaInvitationId,
      ]);
      expect(rows[0].ownedByViewer).toBe(true);
      expect(rows[0].ownerDisplayName).toBe("Ana Operadora");
    });
  });

  it("lists both partitions on the shared dashboard, attributing each to its owner", async () => {
    await withConsoleFixture(async (fixture) => {
      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: false,
        defaultCountry: "CO",
      });
      const mine = rows.find(
        (row) => row.invitationId === fixture.anaInvitationId,
      );
      const theirs = rows.find(
        (row) => row.invitationId === fixture.betoInvitationId,
      );

      expect(mine?.ownedByViewer).toBe(true);
      expect(theirs?.ownedByViewer).toBe(false);
      expect(theirs?.ownerDisplayName).toBe("Beto Operador");
    });
  });

  /**
   * The rule this suite exists for.
   *
   * `rsvp_responses` is append-only: a household that says yes and then no has
   * TWO rows. Counting over the raw table reports that household twice, once in
   * each bucket — the defect that had a reference project's dashboard reporting
   * 47 confirmed from 17 answers. `rsvp_latest` is one row per invitation by
   * construction, and the console must read nothing else.
   */
  it("counts a household that changed its mind ONCE, as its latest answer", async () => {
    await withConsoleFixture(async (fixture) => {
      await withDb(async (db) => {
        await db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids, submitted_at)
           values ($1, true, 1, $2, now() - interval '2 days')`,
          [fixture.anaInvitationId, [fixture.anaGuestId]],
        );
        await db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids, submitted_at)
           values ($1, false, 0, '{}', now() - interval '1 day')`,
          [fixture.anaInvitationId],
        );
      });

      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: true,
        defaultCountry: "CO",
      });

      // One household, not two.
      expect(rows).toHaveLength(1);
      expect(rows[0].answer).toBe("declined");
      expect(rows[0].seatsConfirmed).toBe(0);

      const summary = summarizeConsoleList(rows);

      expect(summary.total).toBe(1);
      expect(summary.declined).toBe(1);
      expect(summary.attending).toBe(0);
      expect(summary.seatsConfirmed).toBe(0);
    });
  });

  it("keeps an opened link out of the confirmed-send count", async () => {
    await withConsoleFixture(async (fixture) => {
      await withDb(async (db) => {
        await db.query(
          `insert into dispatch_events (invitation_id, actor_sender_id, kind)
           values ($1, $2, 'link_opened')`,
          [fixture.anaInvitationId, fixture.anaId],
        );
      });

      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: true,
        defaultCountry: "CO",
      });

      expect(rows[0].dispatchState).toBe("link_opened");
      expect(summarizeConsoleList(rows).operatorAssertedSends).toBe(0);
    });
  });

  it("classifies each guest's reachability so a landline is flagged in the row", async () => {
    await withConsoleFixture(async (fixture) => {
      await withDb(async (db) => {
        await db.query(
          `insert into invitation_guests (invitation_id, full_name, phone_e164)
           values ($1, 'Casa Muñóz', '+576012345678')`,
          [fixture.anaInvitationId],
        );
      });

      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: true,
        defaultCountry: "CO",
      });
      const landline = rows[0].guests.find(
        (guest) => guest.fullName === "Casa Muñóz",
      );
      const mobile = rows[0].guests.find(
        (guest) => guest.fullName === "Ana Muñóz",
      );

      expect(landline).toMatchObject({
        lineType: "fixed_line",
        dispatchable: false,
      });
      expect(mobile).toMatchObject({ lineType: "mobile", dispatchable: true });
    });
  });

  it("stores an edited guest phone in E.164 and refuses an unusable one", async () => {
    await withConsoleFixture(async (fixture) => {
      const client = createServerSupabaseClient();

      const updated = await updateGuestPhone(
        client,
        fixture.anaGuestId,
        "300 765 4321",
        "CO",
      );

      expect(updated).toBe("+573007654321");

      const stored = await withDb(async (db) => {
        const result = await db.query<{
          phone_e164: string | null;
          phone_last8: string | null;
        }>(
          "select phone_e164, phone_last8 from invitation_guests where id = $1",
          [fixture.anaGuestId],
        );
        return result.rows[0];
      });

      expect(stored.phone_e164).toBe("+573007654321");
      // The generated column keeps the gate working after an inline edit.
      expect(stored.phone_last8).toBe("07654321");

      await expect(
        updateGuestPhone(client, fixture.anaGuestId, "12", "CO"),
      ).rejects.toThrow();
    });
  });

  it("clears a guest phone back to NULL rather than to an empty string", async () => {
    await withConsoleFixture(async (fixture) => {
      // The `nullif` in the generated column is what stops an empty submission
      // from matching at the gate; storing '' here would defeat it.
      const cleared = await updateGuestPhone(
        createServerSupabaseClient(),
        fixture.anaGuestId,
        "   ",
        "CO",
      );

      expect(cleared).toBeNull();

      const stored = await withDb(async (db) => {
        const result = await db.query<{
          phone_e164: string | null;
          phone_last8: string | null;
        }>(
          "select phone_e164, phone_last8 from invitation_guests where id = $1",
          [fixture.anaGuestId],
        );
        return result.rows[0];
      });

      expect(stored.phone_e164).toBeNull();
      expect(stored.phone_last8).toBeNull();
    });
  });

  it("reports which operator owns the household a guest belongs to", async () => {
    await withConsoleFixture(async (fixture) => {
      const client = createServerSupabaseClient();

      expect(await findGuestInvitationOwner(client, fixture.anaGuestId)).toBe(
        fixture.anaId,
      );
    });
  });

  it("reports no owner for a guest id that does not exist", async () => {
    await withConsoleFixture(async () => {
      expect(
        await findGuestInvitationOwner(
          createServerSupabaseClient(),
          "99999999-9999-4999-8999-999999999999",
        ),
      ).toBeNull();
    });
  });

  it("names every operator for the device picker, without exposing their contact number", async () => {
    await withConsoleFixture(async (fixture) => {
      const profiles = await listOperatorProfiles(createServerSupabaseClient());
      const ana = profiles.find((profile) => profile.id === fixture.anaId);

      expect(ana).toEqual({ id: fixture.anaId, displayName: "Ana Operadora" });
      expect(profiles.some((profile) => profile.id === fixture.betoId)).toBe(
        true,
      );
      expect(JSON.stringify(profiles)).not.toContain("+57300111");
    });
  });

  /**
   * The compose view's read.
   *
   * Ownership is a `WHERE`, not a check after the fetch. The invitation id comes
   * out of the URL — a value the browser holds — so a compose view that fetched
   * first and compared afterwards would already have read another operator's
   * household into memory before deciding it should not have.
   */
  it("returns one owned invitation, reduced exactly as the list reduces it", async () => {
    await withConsoleFixture(async (fixture) => {
      const found = await findConsoleInvitation(createServerSupabaseClient(), {
        invitationId: fixture.anaInvitationId,
        viewerSenderId: fixture.anaId,
        defaultCountry: "CO",
      });

      expect(found?.invitationId).toBe(fixture.anaInvitationId);
      expect(found?.ownedByViewer).toBe(true);
      expect(found?.guests.length).toBeGreaterThan(0);
    });
  });

  it("returns nothing for an invitation the signed-in operator does not own", async () => {
    await withConsoleFixture(async (fixture) => {
      expect(
        await findConsoleInvitation(createServerSupabaseClient(), {
          invitationId: fixture.betoInvitationId,
          viewerSenderId: fixture.anaId,
          defaultCountry: "CO",
        }),
      ).toBeNull();
    });
  });

  it("returns nothing for an invitation id that does not exist", async () => {
    await withConsoleFixture(async (fixture) => {
      expect(
        await findConsoleInvitation(createServerSupabaseClient(), {
          invitationId: "99999999-9999-4999-8999-999999999999",
          viewerSenderId: fixture.anaId,
          defaultCountry: "CO",
        }),
      ).toBeNull();
    });
  });
});
