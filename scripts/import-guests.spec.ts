import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
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
