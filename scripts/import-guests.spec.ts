import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { NewInvitation } from "@/lib/server/invitations";

import {
  buildImportAdvisory,
  formatImportAdvisory,
  GUEST_SOURCE_PATH,
  parseGuestSource,
  warmCreatedInvitations,
} from "./import-guests";

describe("parseGuestSource", () => {
  it("reads a well-formed source into import rows", () => {
    const rows = parseGuestSource(
      JSON.stringify({
        invitations: [
          {
            ownerEmail: "ana@example.test",
            displayName: "Familia Restrepo",
            greetingName: "Familia Restrepo",
            seatsAllowed: 3,
            guests: [{ fullName: "Ana Restrepo", phone: "3001234567" }],
          },
        ],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].ownerEmail).toBe("ana@example.test");
    expect(rows[0].guests[0].fullName).toBe("Ana Restrepo");
  });

  it("rejects a source that is not valid JSON, naming the file", () => {
    expect(() => parseGuestSource("{ not json")).toThrow(
      new RegExp(GUEST_SOURCE_PATH),
    );
  });

  it("rejects a source with no invitations array", () => {
    expect(() => parseGuestSource(JSON.stringify({ rows: [] }))).toThrow(
      /invitations/,
    );
  });

  it("rejects an empty invitations array rather than reporting success on nothing", () => {
    expect(() => parseGuestSource(JSON.stringify({ invitations: [] }))).toThrow(
      /no invitations/i,
    );
  });

  it("points at a source path that is git-ignored", () => {
    // The real guest list must never enter the repository. The path itself is
    // asserted here so a rename cannot silently move it back into tracking.
    expect(GUEST_SOURCE_PATH).toBe("data/guests.source.json");
  });
});

describe("warmCreatedInvitations", () => {
  const imported = [
    { sourceKey: "a", slug: "aaaaaaaaaaaaaaaa", created: true },
    { sourceKey: "b", slug: "bbbbbbbbbbbbbbbb", created: false },
    { sourceKey: "c", slug: "cccccccccccccccc", created: true },
  ] as const;

  it("warms the card of every newly created invitation", async () => {
    const warmed: string[] = [];

    const count = await warmCreatedInvitations(
      {} as SupabaseClient,
      imported,
      async (_client, slug) => {
        warmed.push(slug);
        return true;
      },
    );

    expect(warmed).toEqual(["aaaaaaaaaaaaaaaa", "cccccccccccccccc"]);
    expect(count).toBe(2);
  });

  it("leaves an already-present invitation alone", async () => {
    const warmed: string[] = [];

    await warmCreatedInvitations(
      {} as SupabaseClient,
      imported,
      async (_client, slug) => {
        warmed.push(slug);
        return true;
      },
    );

    // Its card was warmed when it was first created, and `next/og` answers
    // immutable, so re-fetching it buys nothing.
    expect(warmed).not.toContain("bbbbbbbbbbbbbbbb");
  });

  it("keeps the import successful when a warm fails", async () => {
    const attempted: string[] = [];

    const count = await warmCreatedInvitations(
      {} as SupabaseClient,
      imported,
      async (_client, slug) => {
        attempted.push(slug);
        return slug !== "aaaaaaaaaaaaaaaa";
      },
    );

    // The households are imported either way; a cold card is a slow preview,
    // not a guest who was never invited.
    expect(attempted).toEqual(["aaaaaaaaaaaaaaaa", "cccccccccccccccc"]);
    expect(count).toBe(1);
  });

  it("warms nothing when every household was already present", async () => {
    const attempted: string[] = [];

    const count = await warmCreatedInvitations(
      {} as SupabaseClient,
      [{ sourceKey: "b", slug: "bbbbbbbbbbbbbbbb", created: false }],
      async (_client, slug) => {
        attempted.push(slug);
        return true;
      },
    );

    expect(attempted).toEqual([]);
    expect(count).toBe(0);
  });
});

/**
 * Two data faults that are invisible until the day they matter.
 *
 * A landline normalizes, stores and builds a `wa.me` link exactly like a
 * mobile, and the invitation reaches nobody while the console reports it sent.
 * A household whose `seats_allowed` disagrees with the number of names entered
 * is a typo that surfaces as a guest who cannot confirm their own household.
 *
 * Both are ADVISORY at import: reported and counted, never a hard rejection.
 * The import is atomic, so blocking on one bad row would refuse the whole
 * guest list over a single aunt's landline.
 */
describe("buildImportAdvisory", () => {
  const household = (
    displayName: string,
    seatsAllowed: number,
    guests: readonly { fullName: string; phoneE164: string | null }[],
  ): NewInvitation => ({
    ownerSenderId: "00000000-0000-0000-0000-000000000001",
    sourceKey: displayName,
    displayName,
    greetingName: displayName,
    seatsAllowed,
    rsvpDeadline: null,
    guests: guests.map((guest) => ({
      fullName: guest.fullName,
      phoneE164: guest.phoneE164,
      isPrimary: false,
      isChild: false,
    })),
  });

  it("flags a Colombian landline while leaving the mobiles alone", () => {
    const advisory = buildImportAdvisory(
      [
        household("Familia Restrepo", 2, [
          { fullName: "Ana Restrepo", phoneE164: "+573001234567" },
          { fullName: "Luis Restrepo", phoneE164: "+576012345678" },
        ]),
      ],
      "CO",
    );

    expect(advisory.guestCount).toBe(2);
    expect(advisory.undispatchablePhones).toEqual([
      {
        displayName: "Familia Restrepo",
        fullName: "Luis Restrepo",
        lineType: "fixed_line",
      },
    ]);
  });

  it("does not flag a guest who has no phone at all", () => {
    // A phone-less guest is legitimate — a child, or someone who shares the
    // link. There is no dispatch to fail, so there is nothing to warn about.
    const advisory = buildImportAdvisory(
      [
        household("Familia Ruiz", 2, [
          { fullName: "Sara Ruiz", phoneE164: "+573101234567" },
          { fullName: "Niña Ruiz", phoneE164: null },
        ]),
      ],
      "CO",
    );

    expect(advisory.undispatchablePhones).toEqual([]);
  });

  it("flags a household whose seats disagree with the names entered", () => {
    // Every seat corresponds to a named person in this guest list, so a
    // mismatch is a data-entry typo, not a legitimate unnamed seat.
    const advisory = buildImportAdvisory(
      [
        household("Familia Pérez", 4, [
          { fullName: "Juan Pérez", phoneE164: "+573001112233" },
          { fullName: "Marta Pérez", phoneE164: "+573001112244" },
        ]),
        household("Familia Gómez", 2, [
          { fullName: "Iván Gómez", phoneE164: "+573001112255" },
          { fullName: "Rosa Gómez", phoneE164: "+573001112266" },
        ]),
      ],
      "CO",
    );

    expect(advisory.householdCount).toBe(2);
    expect(advisory.seatMismatches).toEqual([
      { displayName: "Familia Pérez", seatsAllowed: 4, namedGuests: 2 },
    ]);
  });

  it("reports nothing for a clean guest list", () => {
    const advisory = buildImportAdvisory(
      [
        household("Familia Ruiz", 1, [
          { fullName: "Sara Ruiz", phoneE164: "+573101234567" },
        ]),
      ],
      "CO",
    );

    expect(advisory).toEqual({
      householdCount: 1,
      guestCount: 1,
      undispatchablePhones: [],
      seatMismatches: [],
    });
  });
});

describe("formatImportAdvisory", () => {
  it("states both counts and names the households, never a digit", () => {
    const lines = formatImportAdvisory({
      householdCount: 2,
      guestCount: 3,
      undispatchablePhones: [
        {
          displayName: "Familia Restrepo",
          fullName: "Luis Restrepo",
          lineType: "fixed_line",
        },
      ],
      seatMismatches: [
        { displayName: "Familia Pérez", seatsAllowed: 4, namedGuests: 2 },
      ],
    });

    const text = lines.join("\n");

    expect(text).toContain("1 of 3");
    expect(text).toContain("Luis Restrepo");
    expect(text).toContain("fixed_line");
    expect(text).toContain("Familia Pérez");
    expect(text).toContain("4");
    // Phone numbers are personal data and this output reaches logs.
    expect(text).not.toMatch(/\d{7,}/);
  });

  it("says so plainly when there is nothing to report", () => {
    const lines = formatImportAdvisory({
      householdCount: 1,
      guestCount: 1,
      undispatchablePhones: [],
      seatMismatches: [],
    });

    expect(lines.join("\n")).toMatch(
      /every stored phone can receive WhatsApp/i,
    );
  });
});
