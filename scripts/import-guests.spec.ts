import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  validateImportRow,
  type NewInvitation,
} from "@/lib/server/invitations";

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
 * The data fault that is invisible until the day it matters.
 *
 * A landline normalizes, stores and builds a `wa.me` link exactly like a
 * mobile, and the invitation reaches nobody while the console reports it sent.
 *
 * It is ADVISORY at import: reported and counted, never a hard rejection. The
 * import is atomic, so blocking on one bad row would refuse the whole guest
 * list over a single aunt's landline.
 */
describe("buildImportAdvisory", () => {
  const household = (
    displayName: string,
    guests: readonly { fullName: string; phoneE164: string | null }[],
  ): NewInvitation => ({
    ownerSenderId: "00000000-0000-0000-0000-000000000001",
    sourceKey: displayName,
    displayName,
    greetingName: displayName,
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
        household("Familia Restrepo", [
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
        household("Familia Ruiz", [
          { fullName: "Sara Ruiz", phoneE164: "+573101234567" },
          { fullName: "Niña Ruiz", phoneE164: null },
        ]),
      ],
      "CO",
    );

    expect(advisory.undispatchablePhones).toEqual([]);
  });

  it("reports nothing for a clean guest list", () => {
    const advisory = buildImportAdvisory(
      [
        household("Familia Ruiz", [
          { fullName: "Sara Ruiz", phoneE164: "+573101234567" },
        ]),
      ],
      "CO",
    );

    expect(advisory).toEqual({
      householdCount: 1,
      guestCount: 1,
      undispatchablePhones: [],
    });
  });
});

describe("formatImportAdvisory", () => {
  it("states the count and names the household, never a digit", () => {
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
    });

    const text = lines.join("\n");

    expect(text).toContain("1 of 3");
    expect(text).toContain("Luis Restrepo");
    expect(text).toContain("fixed_line");
    // Phone numbers are personal data and this output reaches logs.
    expect(text).not.toMatch(/\d{7,}/);
  });

  it("says so plainly when there is nothing to report", () => {
    const lines = formatImportAdvisory({
      householdCount: 1,
      guestCount: 1,
      undispatchablePhones: [],
    });

    expect(lines.join("\n")).toMatch(
      /every stored phone can receive WhatsApp/i,
    );
  });
});

/**
 * The source file's shape, checked before anything reads it (design D22).
 *
 * `parseGuestSource` used to end in `return invitations as ImportRow[]` after
 * checking only that the array existed and was not empty. A malformed row
 * therefore survived the parse and failed much later as a bare
 * `TypeError: Cannot read properties of undefined (reading 'length')`, naming
 * no row, no field and no file — against a requirement whose whole point is
 * stopping at the row that introduced the problem.
 *
 * FIRST ISSUE ONLY. `ZodError.issues` for a malformed array is dominated by
 * cascade noise from the first bad row, and a wall of issues is the same
 * unusable output in a different shape.
 */
describe("parseGuestSource — the Zod parse (D22)", () => {
  /** A well-formed household, so the malformed one is the only fault present. */
  function household(index: number) {
    return {
      ownerEmail: "ana@example.test",
      displayName: `Familia ${index}`,
      greetingName: `Familia ${index}`,
      sourceKey: `familia-${index}`,
      guests: [{ fullName: `Ana ${index}`, phone: "3001234567" }],
    };
  }

  function source(invitations: unknown[]): string {
    return JSON.stringify({ invitations });
  }

  it("names the file, the index and the field of the first bad value", () => {
    const invitations: unknown[] = Array.from({ length: 8 }, (_unused, index) =>
      household(index),
    );
    invitations[7] = {
      ...household(7),
      guests: [{ fullName: "Ana 7" }, { fullName: 42 }],
    };

    expect(() => parseGuestSource(source(invitations))).toThrow(
      "data/guests.source.json → invitations[7].guests[1].full_name: expected string, received number",
    );
  });

  it("reports only the FIRST issue, not every downstream one", () => {
    const invitations: unknown[] = [
      { ...household(0), guests: [{ fullName: 42 }] },
      { ...household(1), displayName: 99 },
    ];

    const failure = (() => {
      try {
        parseGuestSource(source(invitations));
        return "";
      } catch (cause) {
        return (cause as Error).message;
      }
    })();

    expect(failure).toContain("invitations[0].guests[0].full_name");
    // The second row is just as broken. Saying so here would bury the row the
    // operator has to go and fix.
    expect(failure).not.toContain("invitations[1]");
  });

  it("names a missing required field on the row itself", () => {
    const invitations: unknown[] = [
      { ownerEmail: "ana@example.test", displayName: "Familia 0", guests: [] },
    ];

    expect(() => parseGuestSource(source(invitations))).toThrow(
      /invitations\[0\]\.greeting_name: expected string/,
    );
  });

  it("still returns the rows when every one of them is well formed", () => {
    const rows = parseGuestSource(source([household(0), household(1)]));

    expect(rows).toHaveLength(2);
    expect(rows[1].displayName).toBe("Familia 1");
  });
});

/**
 * The importer's one-way door.
 *
 * A source file in the old format carries a seats column and no `nickname`.
 * There is no longer a stored seat allowance for it to populate — the member
 * count IS the cap since migration 0012 — so accepting the file and ignoring
 * the column is how a stale source imports wrong data and nobody learns. It is
 * rejected by name instead.
 */
describe("the source format: nickname in, seats out", () => {
  function source(guests: unknown[]): string {
    return JSON.stringify({
      invitations: [
        {
          ownerEmail: "ana@example.test",
          displayName: "Familia Guzmán",
          greetingName: "Familia Guzmán",
          guests,
        },
      ],
    });
  }

  it("accepts a new-format row carrying a nickname", () => {
    const rows = parseGuestSource(
      source([
        { fullName: "Luis Guzmán", nickname: "Lucho", phone: "3001234567" },
      ]),
    );

    expect(rows[0].guests[0].nickname).toBe("Lucho");
  });

  it("carries that nickname through validation into the new invitation", () => {
    const rows = parseGuestSource(
      source([
        { fullName: "Luis Guzmán", nickname: "Lucho", phone: "3001234567" },
        { fullName: "Ana Guzmán" },
      ]),
    );

    const validated = validateImportRow(
      rows[0],
      { "ana@example.test": "00000000-0000-0000-0000-000000000001" },
      "CO",
    );

    expect(validated.guests[0].nickname).toBe("Lucho");
    // Absent is null, never undefined: the column is nullable and a guest with
    // no nickname falls through to the full-name and first-name fallbacks.
    expect(validated.guests[1].nickname).toBeNull();
  });

  it("REJECTS an old-format row carrying a seats column", () => {
    expect(() =>
      parseGuestSource(
        source([{ fullName: "Luis Guzmán", phone: "3001234567", seats: 4 }]),
      ),
    ).toThrow(/invitations\[0\]\.guests\[0\][\s\S]*seats/);
  });

  it("REJECTS the old format's own seat column, and its near spellings", () => {
    // `seatsAllowed` is not a hypothetical: it is the exact key the pre-change
    // `ImportRow` required, so a source file written before this change carries
    // it. The other two are what a hand-edit of that file looks like.
    for (const column of ["seatsAllowed", "seats", "seatCount"]) {
      expect(() =>
        parseGuestSource(
          JSON.stringify({
            invitations: [
              {
                ownerEmail: "ana@example.test",
                displayName: "Familia Guzmán",
                greetingName: "Familia Guzmán",
                [column]: 4,
                guests: [{ fullName: "Luis Guzmán" }],
              },
            ],
          }),
        ),
      ).toThrow(new RegExp(column));
    }
  });
});
