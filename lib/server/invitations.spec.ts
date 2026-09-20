import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  captureError,
  withDb,
  withRollback,
} from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";
import { summarizeConsoleList } from "@/lib/domain/console-list";

import {
  addMember,
  chooseRecipient,
  createInvitation,
  deleteInvitation,
  editMember,
  removeMember,
  findInvitationBySlug,
  findInvitationMembership,
  findGuestInvitationOwner,
  importInvitations,
  moveMemberToInvitation,
  rotateInvitationSlug,
  findConsoleInvitation,
  listConsoleInvitations,
  listOperatorProfiles,
  listSenderDirectory,
  updateGuestPhone,
  updateInvitation,
  toGatePhoneRefs,
  toGuestFacingInvitation,
  validateImportRow,
  validateImportRows,
  type ImportRow,
  type NewInvitation,
  type NewInvitationGuest,
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
        `insert into invitations (slug, owner_sender_id, display_name, greeting_name)
         values ($1, $3, 'Familia Muñóz', 'Familia Muñóz'),
                ($2, $4, 'Familia Peña', 'Familia Peña')
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

  /**
   * WHO the household confirmed, not just how many.
   *
   * `attendee_guest_ids` is the only record of that, and the console is the only
   * surface that can make a stale entry in it legible. A row that arrives without
   * the ids cannot: the badge and the D24 count both read this field, and with an
   * empty array they report every household as perfectly consistent.
   */
  it("carries the attendee ids of the current answer out of rsvp_latest", async () => {
    await withConsoleFixture(async (fixture) => {
      await withDb(async (db) => {
        await db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
           values ($1, true, 1, $2)`,
          [fixture.anaInvitationId, [fixture.anaGuestId]],
        );
      });

      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: true,
        defaultCountry: "CO",
      });

      expect(rows[0].attendeeGuestIds).toEqual([fixture.anaGuestId]);
    });
  });

  /**
   * The dangling uuid, produced by real SQL rather than described.
   *
   * `attendee_guest_ids` is a bare `uuid[]`: Postgres cannot foreign-key array
   * elements, so removing a member leaves their id inside an answer that nothing
   * cascades to and that `rsvp_responses` will never let anybody correct. The
   * only available remedy is to see it.
   */
  it("surfaces an answer left naming a member who was afterwards removed", async () => {
    await withConsoleFixture(async (fixture) => {
      const removedGuestId = await withDb(async (db) => {
        const guests = await db.query<{ id: string }>(
          `insert into invitation_guests (invitation_id, full_name, phone_e164)
           values ($1, 'Fer Muñóz', '+573001234568')
           returning id`,
          [fixture.anaInvitationId],
        );
        const removed = guests.rows[0].id;

        await db.query(
          `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids)
           values ($1, true, 2, $2)`,
          [fixture.anaInvitationId, [fixture.anaGuestId, removed]],
        );
        // The couple's actual workflow: Fer already said yes, and now cannot
        // come. The removal is PERMITTED — the stored answer is what goes stale.
        await db.query("delete from invitation_guests where id = $1", [
          removed,
        ]);

        return removed;
      });

      const rows = await listConsoleInvitations(createServerSupabaseClient(), {
        viewerSenderId: fixture.anaId,
        ownedOnly: true,
        defaultCountry: "CO",
      });

      expect(rows[0].attendeeGuestIds).toEqual([
        fixture.anaGuestId,
        removedGuestId,
      ]);
      expect(rows[0].guests.map((guest) => guest.id)).toEqual([
        fixture.anaGuestId,
      ]);
      expect(summarizeConsoleList(rows).contradictedAnswers).toBe(1);
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

  /**
   * A malformed id is a MISSING invitation, not a broken server.
   *
   * `invitations.id` is a `uuid` column, and Postgres answers a value it cannot
   * parse with `22P02 invalid input syntax for type uuid` rather than with zero
   * rows. Passed straight through, that became a thrown error and a 500 — so a
   * mistyped console URL reported that the application was down, and every probe
   * with a nonsense id cost a round trip and an error log entry.
   *
   * The route already answers "does not exist" and "belongs to the other
   * operator" identically. A malformed id belongs in that same answer.
   */
  it("answers a malformed invitation id as not-found instead of raising", async () => {
    await withConsoleFixture(async (fixture) => {
      expect(
        await findConsoleInvitation(createServerSupabaseClient(), {
          invitationId: "not-a-uuid",
          viewerSenderId: fixture.anaId,
          defaultCountry: "CO",
        }),
      ).toBeNull();
    });
  });

  it("answers an empty invitation id as not-found instead of raising", async () => {
    await withConsoleFixture(async (fixture) => {
      expect(
        await findConsoleInvitation(createServerSupabaseClient(), {
          invitationId: "",
          viewerSenderId: fixture.anaId,
          defaultCountry: "CO",
        }),
      ).toBeNull();
    });
  });

  it("answers a malformed id without querying the database at all", async () => {
    await withConsoleFixture(async (fixture) => {
      // The guard is worth having only if it runs BEFORE the round trip: a
      // version that caught `22P02` afterwards would still pay for every probe.
      // A client whose `from` throws proves nothing was asked.
      const refusingClient = {
        from: () => {
          throw new Error(
            "the database must not be queried for a malformed id",
          );
        },
      } as never;

      expect(
        await findConsoleInvitation(refusingClient, {
          invitationId: "11111111-1111-4111-8111-11111111111",
          viewerSenderId: fixture.anaId,
          defaultCountry: "CO",
        }),
      ).toBeNull();
    });
  });

  it("still queries for a well-formed id", async () => {
    // The complement of the test above: the guard must not have become a
    // blanket refusal that returns null for everything.
    await withConsoleFixture(async (fixture) => {
      expect(
        (
          await findConsoleInvitation(createServerSupabaseClient(), {
            invitationId: fixture.anaInvitationId,
            viewerSenderId: fixture.anaId,
            defaultCountry: "CO",
          })
        )?.invitationId,
      ).toBe(fixture.anaInvitationId);
    });
  });
});

/**
 * ── The write side (design.md §8) ───────────────────────────────────────────
 *
 * Everything below drives the repository's write path. Two layers, chosen per
 * test rather than per file:
 *
 *  - The REAL local Supabase, wherever the database is the thing being proved —
 *    the composite FK refusing a foreign recipient, the move trigger clearing
 *    the source's choice, a hard delete really removing rows.
 *  - A FAKE client, for the two states a real database cannot be made to reach
 *    on demand: a guest insert failing while its compensating delete ALSO fails
 *    (D21), and the proof that a refused move issues no statement at all (D25).
 */

/**
 * One member of a create call, with everything a given test is not about
 * defaulted. The fixtures then state only what the test actually turns on.
 */
function member(
  fullName: string,
  overrides: Partial<NewInvitationGuest> = {},
): NewInvitationGuest {
  return {
    fullName,
    nickname: null,
    phoneE164: null,
    isPrimary: false,
    isChild: false,
    ...overrides,
  };
}

/** One call the repository made through the Supabase client. */
interface RecordedCall {
  readonly table: string;
  readonly operation: "from" | "select" | "insert" | "update" | "delete";
  readonly payload?: unknown;
}

type FakeResult = { data: unknown; error: { message: string } | null };

/**
 * A Supabase client that records every call and answers from a script.
 *
 * Keyed by `"<table>.<operation>"`. An unscripted call answers with an empty
 * success, so a test only has to state the outcomes it is actually about.
 */
function makeFakeClient(script: Readonly<Record<string, FakeResult>> = {}): {
  readonly calls: RecordedCall[];
  readonly client: SupabaseClient;
} {
  const calls: RecordedCall[] = [];

  function from(table: string) {
    calls.push({ table, operation: "from" });
    let key = table;

    const answer = (): Promise<FakeResult> =>
      Promise.resolve(script[key] ?? { data: null, error: null });

    const chain = {
      select(columns?: string) {
        calls.push({ table, operation: "select", payload: columns });
        // A trailing `.select()` on an insert or update is a RETURNING clause,
        // not a read: it must not steal the mutation's scripted outcome.
        if (key === table) {
          key = `${table}.select`;
        }
        return chain;
      },
      insert(payload: unknown) {
        calls.push({ table, operation: "insert", payload });
        key = `${table}.insert`;
        return chain;
      },
      update(payload: unknown) {
        calls.push({ table, operation: "update", payload });
        key = `${table}.update`;
        return chain;
      },
      delete() {
        calls.push({ table, operation: "delete" });
        key = `${table}.delete`;
        return chain;
      },
      eq() {
        return chain;
      },
      in() {
        return chain;
      },
      single: answer,
      maybeSingle: answer,
      then<TResult>(
        onfulfilled?: (value: FakeResult) => TResult,
        onrejected?: (reason: unknown) => TResult,
      ) {
        return answer().then(onfulfilled, onrejected);
      },
    };

    return chain;
  }

  return { calls, client: { from } as unknown as SupabaseClient };
}

/** A sender row that really exists, so `owner_sender_id`'s FK is satisfied. */
async function withSenderFixture(
  body: (senderId: string) => Promise<void>,
): Promise<void> {
  const { secretKey } = resolveLocalKeys();
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SECRET_KEY = secretKey;

  const suffix = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const senderId = await withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ('Ana Operadora', 'partner_a', $1, '+573001110000')
       returning id`,
      [`ana.${suffix}@example.test`],
    );
    return result.rows[0].id;
  });

  try {
    await body(senderId);
  } finally {
    await withDb(async (db) => {
      await db.query("set session_replication_role = replica");
      await db.query(
        `delete from dispatch_events where invitation_id in
           (select id from invitations where owner_sender_id = $1)`,
        [senderId],
      );
      await db.query(
        `delete from invitation_guests where invitation_id in
           (select id from invitations where owner_sender_id = $1)`,
        [senderId],
      );
      await db.query("delete from invitations where owner_sender_id = $1", [
        senderId,
      ]);
      await db.query("delete from senders where id = $1", [senderId]);
      await db.query("reset session_replication_role");
    });
  }
}

describe("createInvitation — validated before any write (local Supabase)", () => {
  it("creates a solo guest and a group through the identical write path", async () => {
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();

      const solo = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Luis Guzmán",
        greetingName: "",
        greetingNameSource: "derived",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      });

      const group = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "",
        greetingNameSource: "derived",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            nickname: "Lucho",
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
          member("Inés Guzmán"),
        ],
      });

      // Solo keeps the FULL name; a list member contributes a first name or a
      // nickname. Same function, same call, two members' worth of difference.
      const stored = await withDb(
        async (db) =>
          (
            await db.query<{
              id: string;
              greeting_name: string;
              greeting_name_source: string;
            }>(
              "select id, greeting_name, greeting_name_source from invitations where id = any($1)",
              [[solo.id, group.id]],
            )
          ).rows,
      );

      expect(stored.find((row) => row.id === solo.id)?.greeting_name).toBe(
        "Luis Guzmán",
      );
      expect(stored.find((row) => row.id === group.id)?.greeting_name).toBe(
        "Lucho e Inés",
      );
      // Written together with the name, by the same function (design.md §8).
      expect(stored.map((row) => row.greeting_name_source)).toEqual([
        "derived",
        "derived",
      ]);
      expect(solo.guests).toHaveLength(1);
      expect(group.guests).toHaveLength(2);
    });
  });

  it("stores a custom greeting name untouched, recording its source as custom", async () => {
    await withSenderFixture(async (senderId) => {
      const created = await createInvitation(createServerSupabaseClient(), {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "Los del salón",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      });

      const stored = await withDb(
        async (db) =>
          (
            await db.query<{
              greeting_name: string;
              greeting_name_source: string;
            }>(
              "select greeting_name, greeting_name_source from invitations where id = $1",
              [created.id],
            )
          ).rows[0],
      );

      expect(stored.greeting_name).toBe("Los del salón");
      expect(stored.greeting_name_source).toBe("custom");
    });
  });

  it("refuses a draft with zero members and creates nothing", async () => {
    await withSenderFixture(async (senderId) => {
      await expect(
        createInvitation(createServerSupabaseClient(), {
          ownerSenderId: senderId,
          displayName: "Sin Nadie",
          greetingName: "Sin Nadie",
          greetingNameSource: "custom",
          rsvpDeadline: null,
          guests: [],
        }),
      ).rejects.toThrow(/no_members/);

      const written = await withDb(
        async (db) =>
          (
            await db.query(
              "select 1 from invitations where owner_sender_id = $1",
              [senderId],
            )
          ).rowCount,
      );

      expect(written).toBe(0);
    });
  });

  it("refuses a member without a name and creates nothing", async () => {
    await withSenderFixture(async (senderId) => {
      await expect(
        createInvitation(createServerSupabaseClient(), {
          ownerSenderId: senderId,
          displayName: "Familia Anónima",
          greetingName: "Familia Anónima",
          greetingNameSource: "custom",
          rsvpDeadline: null,
          guests: [member("   ", { isPrimary: true })],
        }),
      ).rejects.toThrow(/member_without_name/);

      const written = await withDb(
        async (db) =>
          (
            await db.query(
              "select 1 from invitations where owner_sender_id = $1",
              [senderId],
            )
          ).rowCount,
      );

      expect(written).toBe(0);
    });
  });
});

describe("createInvitation — D21, a compensation that itself fails", () => {
  /**
   * The bug this closes: the compensating delete's own result was discarded,
   * so a failed compensation left a guestless invitation nobody could ever
   * unlock, looking perfectly valid in the console, while the operator was
   * told only that the guest insert had failed — the wrong thing, and no
   * handle on the row.
   */
  it("names BOTH failures and the orphaned invitation's id and slug", async () => {
    const { calls, client } = makeFakeClient({
      "invitations.insert": {
        data: { id: "0f5d2c3e-6a1b-4d7f-9c2e-3a4b5c6d7e8f" },
        error: null,
      },
      "invitation_guests.insert": {
        data: null,
        error: { message: "duplicate key value violates unique constraint" },
      },
      "invitations.delete": {
        data: null,
        error: { message: "deadlock detected" },
      },
    });

    const failure = await captureError(() =>
      createInvitation(client, {
        ownerSenderId: "11111111-1111-4111-8111-111111111111",
        displayName: "Familia Guzmán",
        greetingName: "Familia Guzmán",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      }),
    );

    const mintedSlug = calls.find(
      (call) => call.table === "invitations" && call.operation === "insert",
    )?.payload as { slug: string };

    expect(failure).toContain("duplicate key value violates unique constraint");
    expect(failure).toContain("deadlock detected");
    expect(failure).toContain("0f5d2c3e-6a1b-4d7f-9c2e-3a4b5c6d7e8f");
    expect(failure).toContain(mintedSlug.slug);
  });

  it("reports only the guest insert when the compensation succeeds", async () => {
    const { client } = makeFakeClient({
      "invitations.insert": {
        data: { id: "0f5d2c3e-6a1b-4d7f-9c2e-3a4b5c6d7e8f" },
        error: null,
      },
      "invitation_guests.insert": {
        data: null,
        error: { message: "phone_e164 violates check constraint" },
      },
      "invitations.delete": { data: null, error: null },
    });

    const failure = await captureError(() =>
      createInvitation(client, {
        ownerSenderId: "11111111-1111-4111-8111-111111111111",
        displayName: "Familia Guzmán",
        greetingName: "Familia Guzmán",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      }),
    );

    expect(failure).toContain("phone_e164 violates check constraint");
    // The invitation really was removed, so there is no orphan to report and
    // no second failure to name.
    expect(failure).not.toContain("could not be removed");
  });
});

describe("member management — add, edit, remove (local Supabase)", () => {
  /** A derived-name invitation with the members named, returned as created. */
  async function makeInvitation(
    senderId: string,
    names: readonly { fullName: string; nickname: string | null }[],
  ) {
    return createInvitation(createServerSupabaseClient(), {
      ownerSenderId: senderId,
      displayName: "Familia Guzmán",
      greetingName: "",
      greetingNameSource: "derived",
      rsvpDeadline: null,
      guests: names.map((name, index) => ({
        fullName: name.fullName,
        nickname: name.nickname,
        phoneE164: index === 0 ? "+573001234567" : null,
        isPrimary: index === 0,
        isChild: false,
      })),
    });
  }

  async function storedGreeting(invitationId: string) {
    return withDb(
      async (db) =>
        (
          await db.query<{
            greeting_name: string;
            greeting_name_source: string;
          }>(
            "select greeting_name, greeting_name_source from invitations where id = $1",
            [invitationId],
          )
        ).rows[0],
    );
  }

  it("adds a member and re-derives the group name", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await makeInvitation(senderId, [
        { fullName: "Luis Guzmán", nickname: "Lucho" },
        { fullName: "Inés Guzmán", nickname: null },
      ]);

      const added = await addMember(
        createServerSupabaseClient(),
        invitation.id,
        {
          fullName: "Fernando Guzmán",
          nickname: "Fer",
          phoneE164: null,
          isChild: false,
        },
      );

      const reread = await findInvitationBySlug(
        createServerSupabaseClient(),
        invitation.slug,
      );

      // THE ROW SURVIVES THE NEW SHAPE. `addMember` answers with refusals AND
      // the record, because it is the only one of the three writes that creates
      // a row and the id it mints exists nowhere else yet. Asserting the record
      // here is what stops a later tidy-up from deleting it for symmetry.
      expect(added.refusals).toEqual([]);
      expect(added.guest?.fullName).toBe("Fernando Guzmán");
      expect(reread?.guests).toHaveLength(3);
      expect((await storedGreeting(invitation.id)).greeting_name).toBe(
        "Lucho, Inés y Fer",
      );
    });
  });

  it("refuses a member with no name and ANSWERS with the code, writing nothing", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await makeInvitation(senderId, [
        { fullName: "Luis Guzmán", nickname: null },
      ]);

      const added = await addMember(
        createServerSupabaseClient(),
        invitation.id,
        { fullName: "   ", nickname: null, phoneE164: null, isChild: false },
      );

      expect(added.refusals).toEqual(["member_without_name"]);
      // Null exactly when the refusals are not empty: there is no row to hand
      // back, because the return happens where the insert would have been.
      expect(added.guest).toBeNull();

      const survivors = await findInvitationBySlug(
        createServerSupabaseClient(),
        invitation.slug,
      );

      expect(survivors?.guests.map((guest) => guest.fullName)).toEqual([
        "Luis Guzmán",
      ]);
    });
  });

  it("edits a member's nickname and re-derives the group name", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await makeInvitation(senderId, [
        { fullName: "Luis Guzmán", nickname: null },
        { fullName: "Inés Guzmán", nickname: null },
      ]);
      const luis = invitation.guests.find(
        (guest) => guest.fullName === "Luis Guzmán",
      );

      await editMember(createServerSupabaseClient(), invitation.id, luis!.id, {
        nickname: "Lucho",
      });

      const stored = await storedGreeting(invitation.id);

      expect(stored.greeting_name).toBe("Lucho e Inés");
      expect(stored.greeting_name_source).toBe("derived");
    });
  });

  it("never overwrites a custom group name when a member changes", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await createInvitation(createServerSupabaseClient(), {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "Los del salón",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      });

      await addMember(createServerSupabaseClient(), invitation.id, {
        fullName: "Inés Guzmán",
        nickname: null,
        phoneE164: null,
        isChild: false,
      });

      const stored = await storedGreeting(invitation.id);

      expect(stored.greeting_name).toBe("Los del salón");
      expect(stored.greeting_name_source).toBe("custom");
    });
  });

  it("refuses to remove the LAST member and ANSWERS with the code", async () => {
    // THE REFUSAL IS RETURNED, NOT THROWN.
    //
    // A thrown refusal is replaced by an opaque `digest` in production
    // expressly to keep server text out of the browser, so the operator would
    // be told "check your connection" about a rule that will refuse identically
    // on every retry. The CODE travels and the console owns the copy — which is
    // also why this asserts `no_members` rather than an English sentence: the
    // sentence belonged to the throw, and the operator never read it.
    await withSenderFixture(async (senderId) => {
      const invitation = await makeInvitation(senderId, [
        { fullName: "Luis Guzmán", nickname: null },
      ]);

      const refusals = await removeMember(
        createServerSupabaseClient(),
        invitation.id,
        invitation.guests[0].id,
      );

      expect(refusals).toEqual(["no_members"]);

      const survivors = await findInvitationBySlug(
        createServerSupabaseClient(),
        invitation.slug,
      );

      expect(survivors?.guests.map((guest) => guest.fullName)).toEqual([
        "Luis Guzmán",
      ]);
    });
  });

  it("removes a member from a two-member invitation and re-derives", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await makeInvitation(senderId, [
        { fullName: "Luis Guzmán", nickname: null },
        { fullName: "Inés Guzmán", nickname: null },
      ]);
      const ines = invitation.guests.find(
        (guest) => guest.fullName === "Inés Guzmán",
      );

      await removeMember(createServerSupabaseClient(), invitation.id, ines!.id);

      const survivors = await findInvitationBySlug(
        createServerSupabaseClient(),
        invitation.slug,
      );

      expect(survivors?.guests.map((guest) => guest.fullName)).toEqual([
        "Luis Guzmán",
      ]);
      // One member left, so the SOLO fallback applies: the full name, not "Luis".
      expect((await storedGreeting(invitation.id)).greeting_name).toBe(
        "Luis Guzmán",
      );
    });
  });

  it("refuses to blank out a member's name and ANSWERS with the code", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await makeInvitation(senderId, [
        { fullName: "Luis Guzmán", nickname: null },
        { fullName: "Inés Guzmán", nickname: null },
      ]);

      const refusals = await editMember(
        createServerSupabaseClient(),
        invitation.id,
        invitation.guests[0].id,
        { fullName: "   " },
      );

      expect(refusals).toEqual(["member_without_name"]);

      const survivors = await findInvitationBySlug(
        createServerSupabaseClient(),
        invitation.slug,
      );

      expect(survivors?.guests.map((guest) => guest.fullName).sort()).toEqual([
        "Inés Guzmán",
        "Luis Guzmán",
      ]);
    });
  });
});

describe("moveMemberToInvitation — D25, a refused move is never a statement", () => {
  it("refuses a move that would empty the source and issues NO call at all", async () => {
    const { calls, client } = makeFakeClient();

    const failure = await captureError(() =>
      moveMemberToInvitation(client, {
        sourceInvitationId: "11111111-1111-4111-8111-111111111111",
        destinationInvitationId: "22222222-2222-4222-8222-222222222222",
        memberId: "33333333-3333-4333-8333-333333333333",
        sourceMemberIds: ["33333333-3333-4333-8333-333333333333"],
        sourceRecipientGuestId: "33333333-3333-4333-8333-333333333333",
      }),
    );

    // The refusal is what the operator is told, and the database was never
    // asked anything: the emptiness rule and the clearing trigger can never
    // contend, because there is no statement for the trigger to fire on.
    expect(failure).toMatch(/delete the invitation/i);
    expect(calls).toEqual([]);
  });

  it("names the refusal rather than crashing on a zero-member derivation", async () => {
    const { client } = makeFakeClient();

    const failure = await captureError(() =>
      moveMemberToInvitation(client, {
        sourceInvitationId: "11111111-1111-4111-8111-111111111111",
        destinationInvitationId: "22222222-2222-4222-8222-222222222222",
        memberId: "33333333-3333-4333-8333-333333333333",
        sourceMemberIds: ["33333333-3333-4333-8333-333333333333"],
        sourceRecipientGuestId: null,
      }),
    );

    // `deriveGreetingName([])` throws by design. It must be UNREACHABLE here:
    // the member-count refusal always runs first, so the operator reads the
    // refusal and its named reason rather than a derivation crash.
    expect(failure).toContain("would_empty_source");
    expect(failure).not.toMatch(/cannot derive a greeting name/i);
  });

  it("refuses a move to the SAME invitation without touching the database", async () => {
    const { calls, client } = makeFakeClient();

    const failure = await captureError(() =>
      moveMemberToInvitation(client, {
        sourceInvitationId: "11111111-1111-4111-8111-111111111111",
        destinationInvitationId: "11111111-1111-4111-8111-111111111111",
        memberId: "33333333-3333-4333-8333-333333333333",
        sourceMemberIds: [
          "33333333-3333-4333-8333-333333333333",
          "44444444-4444-4444-8444-444444444444",
        ],
        sourceRecipientGuestId: null,
      }),
    );

    expect(failure).toContain("same_invitation");
    expect(calls).toEqual([]);
  });
});

describe("moveMemberToInvitation — a permitted move (local Supabase)", () => {
  it("moves the member, clears the SOURCE's recipient and leaves the destination's alone", async () => {
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();

      const source = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "",
        greetingNameSource: "derived",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            nickname: "Lucho",
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
          member("Inés Guzmán", { phoneE164: "+573001234568" }),
        ],
      });
      const destination = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Peña",
        greetingName: "",
        greetingNameSource: "derived",
        rsvpDeadline: null,
        guests: [
          member("Ana Peña", { phoneE164: "+573001234569", isPrimary: true }),
        ],
      });

      const moved = source.guests.find(
        (guest) => guest.fullName === "Inés Guzmán",
      )!;
      const destinationOwn = destination.guests[0];

      // Both invitations have a chosen recipient before the move.
      await chooseRecipient(client, source.id, moved.id);
      await chooseRecipient(client, destination.id, destinationOwn.id);

      await moveMemberToInvitation(client, {
        sourceInvitationId: source.id,
        destinationInvitationId: destination.id,
        memberId: moved.id,
        sourceMemberIds: source.guests.map((guest) => guest.id),
        sourceRecipientGuestId: moved.id,
      });

      const rows = await withDb(
        async (db) =>
          (
            await db.query<{
              id: string;
              greeting_name: string;
              dispatch_recipient_guest_id: string | null;
              members: number;
            }>(
              `select i.id, i.greeting_name, i.dispatch_recipient_guest_id,
                    (select count(*)::int from invitation_guests g where g.invitation_id = i.id) as members
               from invitations i where i.id = any($1)`,
              [[source.id, destination.id]],
            )
          ).rows,
      );
      const after = (id: string) => rows.find((row) => row.id === id)!;

      expect(after(source.id).members).toBe(1);
      expect(after(destination.id).members).toBe(2);
      // The trigger cleared the source's choice; the destination's is untouched,
      // never carried across (D25).
      expect(after(source.id).dispatch_recipient_guest_id).toBeNull();
      expect(after(destination.id).dispatch_recipient_guest_id).toBe(
        destinationOwn.id,
      );
      // Both derived names now describe the membership each one actually has.
      // One member left, so the SOLO fallback applies — and Luis has a
      // nickname, which is what a solo address uses before his full name.
      expect(after(source.id).greeting_name).toBe("Lucho");
      expect(after(destination.id).greeting_name).toBe("Ana e Inés");
    });
  });
});

describe("chooseRecipient — the composite FK does the refusing (local Supabase)", () => {
  it("accepts a member of the SAME invitation and refuses one from another", async () => {
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();

      const ours = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "Familia Guzmán",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      });
      const theirs = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Peña",
        greetingName: "Familia Peña",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Ana Peña", { phoneE164: "+573001234569", isPrimary: true }),
        ],
      });

      // The permitting counterpart, so the refusal below can fail if the
      // constraint is ever dropped.
      await chooseRecipient(client, ours.id, ours.guests[0].id);

      const failure = await captureError(() =>
        chooseRecipient(client, ours.id, theirs.guests[0].id),
      );

      expect(failure).toMatch(/foreign key constraint/i);

      const stored = await withDb(
        async (db) =>
          (
            await db.query<{ dispatch_recipient_guest_id: string | null }>(
              "select dispatch_recipient_guest_id from invitations where id = $1",
              [ours.id],
            )
          ).rows[0].dispatch_recipient_guest_id,
      );

      // Unchanged: the refused write left the earlier, valid choice in place.
      expect(stored).toBe(ours.guests[0].id);
    });
  });
});

describe("deleteInvitation — refused by ANY dispatch history (local Supabase)", () => {
  async function makeDeletable(senderId: string) {
    return createInvitation(createServerSupabaseClient(), {
      ownerSenderId: senderId,
      displayName: "Familia Guzmán",
      greetingName: "Familia Guzmán",
      greetingNameSource: "custom",
      rsvpDeadline: null,
      guests: [
        member("Luis Guzmán", { phoneE164: "+573001234567", isPrimary: true }),
      ],
    });
  }

  async function recordEvent(
    invitationId: string,
    senderId: string,
    kind: string,
  ): Promise<void> {
    await withDb(async (db) => {
      await db.query(
        `insert into dispatch_events (invitation_id, actor_sender_id, kind, client_event_id)
         values ($1, $2, $3, gen_random_uuid())`,
        [invitationId, senderId, kind],
      );
    });
  }

  it("deletes an invitation with zero dispatch events, members included", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await makeDeletable(senderId);

      const outcome = await deleteInvitation(
        createServerSupabaseClient(),
        invitation.id,
      );

      // The permitted case ANSWERS too, and its answer is what tells the
      // console the invitation is gone — which is the only thing that may
      // revalidate and navigate away from a page that no longer has a row.
      expect(outcome).toEqual({ ok: true });

      const remaining = await withDb(async (db) => ({
        invitations: (
          await db.query("select 1 from invitations where id = $1", [
            invitation.id,
          ])
        ).rowCount,
        guests: (
          await db.query(
            "select 1 from invitation_guests where invitation_id = $1",
            [invitation.id],
          )
        ).rowCount,
      }));

      expect(remaining).toEqual({ invitations: 0, guests: 0 });
    });
  });

  it.each(["marked_sent", "link_opened", "marked_failed"])(
    "RETURNS the refusal for a %s event alone, naming the kind it found",
    async (kind) => {
      await withSenderFixture(async (senderId) => {
        const invitation = await makeDeletable(senderId);
        await recordEvent(invitation.id, senderId, kind);

        // THE REFUSAL IS DATA, NOT AN EXCEPTION.
        //
        // It used to be thrown with the operator's advice spelled out in
        // English inside the message. Next replaces a thrown message with an
        // opaque `digest` before it reaches a browser, so that sentence could
        // only ever be read by a developer. What the console needs is the
        // REASON and the kinds, which is exactly what `canDeleteInvitation`
        // already returns — so it travels as itself and the Spanish copy lives
        // where copy lives.
        const outcome = await deleteInvitation(
          createServerSupabaseClient(),
          invitation.id,
        );

        expect(outcome).toEqual({
          ok: false,
          reason: "already_dispatched",
          eventKinds: [kind],
        });

        const survived = await withDb(
          async (db) =>
            (
              await db.query("select 1 from invitations where id = $1", [
                invitation.id,
              ])
            ).rowCount,
        );

        expect(survived).toBe(1);
      });
    },
  );
});

describe("rotateInvitationSlug — a new address for the same invitation (local Supabase)", () => {
  it("keeps a household's members in a stable order after one of them is edited", async () => {
    // POSTGRES HAS NO DEFAULT ROW ORDER, and an UPDATE moves the row to the end
    // of the heap. Without an explicit ORDER BY, editing one member silently
    // reorders the whole household everywhere it is read — the list the guest
    // reads on their own invitation (which slice 1a made the authoritative
    // record of who is invited), the console list, and worst of all
    // `deriveGreetingName`, whose y/e conjunction is decided by the LAST name.
    // A household could be greeted "Ana, Beto e Inés" one day and
    // "Beto, Inés y Ana" the next, with nobody having renamed anyone.
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();
      const invitation = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Orden",
        greetingName: "Familia Orden",
        greetingNameSource: "derived",
        rsvpDeadline: null,
        guests: [
          member("Ana Orden", { isPrimary: true }),
          member("Beto Orden"),
          member("Inés Orden"),
        ],
      });

      const before = (await findInvitationBySlug(client, invitation.slug))!;
      const namesBefore = before.guests.map((guest) => guest.fullName);

      // Touch the FIRST member. Postgres relocates that row in the heap.
      await withDb(async (db) => {
        await db.query(
          "update invitation_guests set full_name = full_name where invitation_id = $1 and full_name = $2",
          [invitation.id, "Ana Orden"],
        );
      });

      const after = (await findInvitationBySlug(client, invitation.slug))!;
      expect(after.guests.map((guest) => guest.fullName)).toEqual(namesBefore);
    });
  });

  it("returns the new slug even when warming rejects, because the slug already changed", async () => {
    // THE CONTRACT THIS FUNCTION'S OWN DOCBLOCK PROMISES.
    //
    // Warming is a network call. If it is allowed to fail the rotation, the row
    // has ALREADY been updated by then: the operator sees a thrown error while
    // the old link is dead and the new slug — this function's only return value
    // — is gone with the exception. The natural response is to retry, which
    // mints and persists a THIRD slug. Rotation is the recovery path for
    // "dispatched by mistake"; a recovery path that loses its own result is
    // worse than the mistake it recovers from.
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();
      const invitation = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Rojas",
        greetingName: "Familia Rojas",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [member("Ana Rojas", { phoneE164: "+573001234567" })],
      });

      const newSlug = await rotateInvitationSlug(client, invitation.id, {
        warm: async () => {
          throw new Error("og warm endpoint unreachable");
        },
      });

      expect(newSlug).toMatch(/^[a-z2-7]{16}$/);
      expect(newSlug).not.toBe(invitation.slug);

      // And the row really did rotate, so the caller can trust what it was given.
      await withDb(async (db) => {
        const stored = await db.query<{ slug: string }>(
          "select slug from invitations where id = $1",
          [invitation.id],
        );
        expect(stored.rows[0].slug).toBe(newSlug);
      });
    });
  });

  it("returns the new slug when warming answers false rather than throwing", async () => {
    // A warm that reports failure without raising is the same situation wearing
    // different clothes, and the boolean was discarded either way.
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();
      const invitation = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Rojas",
        greetingName: "Familia Rojas",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [member("Ana Rojas", { phoneE164: "+573001234567" })],
      });

      const newSlug = await rotateInvitationSlug(client, invitation.id, {
        warm: async () => false,
      });

      expect(newSlug).toMatch(/^[a-z2-7]{16}$/);
      expect(newSlug).not.toBe(invitation.slug);
    });
  });

  it("mints a new slug, records the rotation, re-warms the new URL and keeps everything else", async () => {
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();
      const invitation = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "Familia Guzmán",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
        ],
      });

      await withDb(async (db) => {
        await db.query(
          `insert into dispatch_events (invitation_id, actor_sender_id, kind, client_event_id)
           values ($1, $2, 'marked_sent', gen_random_uuid())`,
          [invitation.id, senderId],
        );
        await db.query(
          "update invitations set og_warmed_at = now() where id = $1",
          [invitation.id],
        );
      });

      const warmed: string[] = [];
      const newSlug = await rotateInvitationSlug(client, invitation.id, {
        warm: async (slug) => {
          warmed.push(slug);
          return true;
        },
      });

      expect(newSlug).not.toBe(invitation.slug);
      expect(newSlug).toMatch(/^[a-z2-7]{16}$/);
      // The new URL is a new CDN key, so the card is cold until it is warmed —
      // and it is the NEW slug that gets warmed, never the retired one.
      expect(warmed).toEqual([newSlug]);

      const stored = await withDb(
        async (db) =>
          (
            await db.query<{
              slug: string;
              slug_rotated_at: string | null;
              og_warmed_at: string | null;
              greeting_name: string;
              events: number;
              members: number;
            }>(
              `select i.slug, i.slug_rotated_at, i.og_warmed_at, i.greeting_name,
                    (select count(*)::int from dispatch_events e where e.invitation_id = i.id) as events,
                    (select count(*)::int from invitation_guests g where g.invitation_id = i.id) as members
               from invitations i where i.id = $1`,
              [invitation.id],
            )
          ).rows[0],
      );

      expect(stored.slug).toBe(newSlug);
      expect(stored.slug_rotated_at).not.toBeNull();
      expect(stored.og_warmed_at).toBeNull();
      // Rotation is a new address, not a new invitation: the history it was
      // offered as an alternative to deleting is exactly what it preserves.
      expect(stored.events).toBe(1);
      expect(stored.members).toBe(1);
      expect(stored.greeting_name).toBe("Familia Guzmán");

      // The old slug no longer names anything.
      expect(await findInvitationBySlug(client, invitation.slug)).toBeNull();
      expect((await findInvitationBySlug(client, newSlug))?.id).toBe(
        invitation.id,
      );
    });
  });

  it("still refuses to delete a rotated invitation that was dispatched", async () => {
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();
      const invitation = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Peña",
        greetingName: "Familia Peña",
        greetingNameSource: "custom",
        rsvpDeadline: null,
        guests: [
          member("Ana Peña", { phoneE164: "+573001234569", isPrimary: true }),
        ],
      });

      await withDb(async (db) => {
        await db.query(
          `insert into dispatch_events (invitation_id, actor_sender_id, kind, client_event_id)
           values ($1, $2, 'marked_sent', gen_random_uuid())`,
          [invitation.id, senderId],
        );
      });

      await rotateInvitationSlug(client, invitation.id, {
        warm: async () => true,
      });

      expect(await deleteInvitation(client, invitation.id)).toEqual({
        ok: false,
        reason: "already_dispatched",
        eventKinds: ["marked_sent"],
      });
    });
  });
});

/**
 * The invitation's OWN fields, which the member functions never touch.
 *
 * `greeting_name` and `greeting_name_source` are written here by the same
 * `greetingNameColumns` pair every other write path uses (design §8), so a
 * `derived` invitation re-derives from its current members and a `custom` one
 * stores exactly what the operator typed. The submitted string is ignored for
 * a derived name on purpose: the form shows the derived value live, and
 * trusting the round-tripped copy of it is how a stale field overwrites a name
 * the members no longer agree with.
 */
describe("updateInvitation — the invitation's own fields (local Supabase)", () => {
  async function seed(senderId: string) {
    return createInvitation(createServerSupabaseClient(), {
      ownerSenderId: senderId,
      displayName: "Familia Guzmán",
      greetingName: "Familia Guzmán",
      greetingNameSource: "custom",
      rsvpDeadline: null,
      guests: [
        member("Luis Guzmán", { nickname: "Lucho", isPrimary: true }),
        member("Ana Guzmán", { nickname: null }),
      ],
    });
  }

  async function readNaming(invitationId: string) {
    return withDb(
      async (db) =>
        (
          await db.query<{
            display_name: string;
            greeting_name: string;
            greeting_name_source: string;
            rsvp_deadline: string | null;
          }>(
            "select display_name, greeting_name, greeting_name_source, " +
              "to_char(rsvp_deadline, 'YYYY-MM-DD') as rsvp_deadline " +
              "from invitations where id = $1",
            [invitationId],
          )
        ).rows[0],
    );
  }

  it("stores a custom name exactly as typed, with its source and deadline", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await seed(senderId);

      await updateInvitation(createServerSupabaseClient(), invitation.id, {
        displayName: "Familia Guzmán Peña",
        greetingName: "Los Guzmán de siempre",
        greetingNameSource: "custom",
        rsvpDeadline: "2026-05-01",
      });

      const stored = await readNaming(invitation.id);
      expect(stored.display_name).toBe("Familia Guzmán Peña");
      expect(stored.greeting_name).toBe("Los Guzmán de siempre");
      expect(stored.greeting_name_source).toBe("custom");
      expect(stored.rsvp_deadline).toBe("2026-05-01");
    });
  });

  it("re-derives the name from the CURRENT members when the source is derived", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await seed(senderId);

      await updateInvitation(createServerSupabaseClient(), invitation.id, {
        displayName: "Familia Guzmán",
        // Deliberately a lie. A derived name comes from the members, never
        // from the copy the form round-tripped.
        greetingName: "lo que sea",
        greetingNameSource: "derived",
        rsvpDeadline: null,
      });

      const stored = await readNaming(invitation.id);
      expect(stored.greeting_name).toBe("Lucho y Ana");
      expect(stored.greeting_name_source).toBe("derived");
    });
  });

  it("refuses an empty custom name and leaves the stored one alone", async () => {
    await withSenderFixture(async (senderId) => {
      const invitation = await seed(senderId);

      const failure = await captureError(() =>
        updateInvitation(createServerSupabaseClient(), invitation.id, {
          displayName: "Familia Guzmán",
          greetingName: "   ",
          greetingNameSource: "custom",
          rsvpDeadline: null,
        }),
      );

      expect(failure).toMatch(/custom_name_empty/);

      const stored = await readNaming(invitation.id);
      expect(stored.greeting_name).toBe("Familia Guzmán");
    });
  });
});

/**
 * The imported nickname has to survive the whole way to the row.
 *
 * Migration 0012 gave `import_invitations` a `nickname` to read, and
 * `validateImportRow` now carries one through — but the payload that reaches
 * the function is assembled here, and a field missing from THAT map is dropped
 * in silence with every other layer looking correct.
 */
describe("importInvitations — the nickname reaches the row (local Supabase)", () => {
  it("stores the supplied nickname and null for a guest without one", async () => {
    await withSenderFixture(async (senderId) => {
      const sourceKey = `nickname-${Date.now()}.${Math.random()}`;

      const imported = await importInvitations(createServerSupabaseClient(), [
        {
          ownerSenderId: senderId,
          sourceKey,
          displayName: "Familia Guzmán",
          greetingName: "Familia Guzmán",
          rsvpDeadline: null,
          guests: [
            member("Luis Guzmán", { nickname: "Lucho", isPrimary: true }),
            member("Ana Guzmán"),
          ],
        },
      ]);

      expect(imported[0].created).toBe(true);

      const stored = await withDb(
        async (db) =>
          (
            await db.query<{ full_name: string; nickname: string | null }>(
              `select g.full_name, g.nickname from invitation_guests g
                 join invitations i on i.id = g.invitation_id
                where i.source_key = $1
                order by g.full_name`,
              [sourceKey],
            )
          ).rows,
      );

      expect(stored).toEqual([
        { full_name: "Ana Guzmán", nickname: null },
        { full_name: "Luis Guzmán", nickname: "Lucho" },
      ]);
    });
  });
});

describe("findInvitationMembership — what the invitation editor loads", () => {
  it("returns the nicknames and the name source the form must not invent", async () => {
    // The console list projection carries neither: it has no `nickname` column
    // in its select and no `greeting_name_source` at all. A form that loaded
    // from there would show every nickname as blank and would re-derive a name
    // a person had written by hand.
    await withSenderFixture(async (senderId) => {
      const client = createServerSupabaseClient();

      const created = await createInvitation(client, {
        ownerSenderId: senderId,
        displayName: "Familia Guzmán",
        greetingName: "",
        greetingNameSource: "derived",
        rsvpDeadline: null,
        guests: [
          member("Luis Guzmán", {
            nickname: "Lucho",
            phoneE164: "+573001234567",
            isPrimary: true,
          }),
          member("Inés Guzmán"),
        ],
      });

      const membership = await findInvitationMembership(client, created.id);

      expect(membership?.greetingNameSource).toBe("derived");
      expect(membership?.members.map((each) => each.nickname)).toEqual([
        "Lucho",
        null,
      ]);
      expect(membership?.dispatchRecipientGuestId).toBeNull();
      expect(membership?.displayName).toBe("Familia Guzmán");
    });
  });

  it("answers null for an invitation nobody has, instead of throwing", async () => {
    // The page turns that into a 404. A throw would render the error boundary,
    // which tells an operator who mistyped a URL that the server is broken.
    await withSenderFixture(async () => {
      const client = createServerSupabaseClient();

      await expect(
        findInvitationMembership(
          client,
          "00000000-0000-4000-8000-000000000000",
        ),
      ).resolves.toBeNull();
    });
  });
});
