import { describe, expect, it } from "vitest";

import { GUEST_SOURCE_PATH, parseGuestSource } from "./import-guests";

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
