import { describe, expect, it } from "vitest";

import type { NameableGuest } from "./guest-name";
import { deriveGreetingName, resolveGreetingName } from "./greeting-name";

function member(
  fullName: string,
  nickname: string | null = null,
): NameableGuest {
  return { fullName, nickname };
}

describe("deriveGreetingName", () => {
  it("uses the SOLO fallback for a single member, keeping the full name", () => {
    expect(deriveGreetingName([member("Ana López")])).toBe("Ana López");
  });

  it("uses the LIST fallback and the conjunction rule for three members", () => {
    expect(
      deriveGreetingName([
        member("Lucho Restrepo"),
        member("Luzma Guzmán"),
        member("Fernando Restrepo", "Fer"),
      ]),
    ).toBe("Lucho, Luzma y Fer");
  });

  it("applies the y → e rule to whichever member lands last", () => {
    expect(
      deriveGreetingName([member("Lucho Restrepo"), member("Inés Guzmán")]),
    ).toBe("Lucho e Inés");
  });

  it("throws on an empty member list rather than returning any string", () => {
    // An invitation with zero members is already an invalid state that member
    // management refuses to create. Returning "" here would let a caller that
    // reached that state carry on quietly.
    expect(() => deriveGreetingName([])).toThrow();
  });
});

describe("resolveGreetingName", () => {
  const members = [member("Lucho Restrepo"), member("Inés Guzmán")];

  it("returns the stored string at 'custom' AND recomputes at 'derived'", () => {
    // ONE test, two sources, the SAME stored string and the SAME members.
    // Asserting only the 'custom' half would be satisfied by a function that
    // always returns `stored` and never looks at the members — which is
    // precisely the bug that makes `greeting_name_source` a stored fact rather
    // than a guess made at write time.
    const stored = "Familia Restrepo";

    expect(resolveGreetingName({ source: "custom", stored, members })).toBe(
      "Familia Restrepo",
    );
    expect(resolveGreetingName({ source: "derived", stored, members })).toBe(
      "Lucho e Inés",
    );
  });

  it("ignores a stale stored name at 'derived' after a membership change", () => {
    expect(
      resolveGreetingName({
        source: "derived",
        stored: "Lucho y Luzma",
        members: [
          member("Lucho Restrepo"),
          member("Luzma Guzmán"),
          member("Fernando Restrepo", "Fer"),
        ],
      }),
    ).toBe("Lucho, Luzma y Fer");
  });

  it("leaves an 'imported' name alone, exactly as a custom one", () => {
    // 'imported' means a script wrote this and no human has looked at it. Only
    // 'derived' re-derives; 'imported' is protected until an operator acts.
    expect(
      resolveGreetingName({
        source: "imported",
        stored: "FAMILIA RESTREPO GUZMAN",
        members,
      }),
    ).toBe("FAMILIA RESTREPO GUZMAN");
  });
});
