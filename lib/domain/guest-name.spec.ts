import { describe, expect, it } from "vitest";

import { firstName, listMemberName, soloAddressName } from "./guest-name";

describe("firstName", () => {
  it("takes the first whitespace-separated token of a full name", () => {
    expect(firstName("Luis Guzmán")).toBe("Luis");
  });

  it("keeps a single-token name whole", () => {
    expect(firstName("Luzma")).toBe("Luzma");
  });

  it("keeps only the first token of a four-part name", () => {
    // Two given names and two surnames is the ordinary Colombian shape. The
    // first TOKEN is taken, not the first half: a household list reads
    // "Luis, Ana y Fer", never "Luis Alberto, Ana María y Fer".
    expect(firstName("Luis Alberto Guzmán Restrepo")).toBe("Luis");
  });

  it("ignores surrounding and repeated whitespace from a paste", () => {
    expect(firstName("  Luis   Guzmán ")).toBe("Luis");
  });
});

describe("soloAddressName and listMemberName", () => {
  it("resolves the SAME guest differently solo and as a list member", () => {
    // Asserted in ONE test on ONE guest on purpose. Split across two tests,
    // an edit to either fallback could change one and leave the other
    // silently agreeing — the exact drift these two functions exist to
    // prevent. The contrast is the behaviour, so the contrast is the test.
    const guest = { fullName: "Luis Guzmán", nickname: null };

    expect(soloAddressName(guest)).toBe("Luis Guzmán");
    expect(listMemberName(guest)).toBe("Luis");
  });

  it("lets a nickname win in BOTH fallbacks, again on the same guest", () => {
    const guest = { fullName: "Luis Guzmán", nickname: "Luigi" };

    expect(soloAddressName(guest)).toBe("Luigi");
    expect(listMemberName(guest)).toBe("Luigi");
  });

  it("treats an empty-string nickname as no nickname in both fallbacks", () => {
    // A form that clears the field can submit `""` rather than `null`, and an
    // invitation addressed to nobody is worse than one addressed formally.
    const guest = { fullName: "Luis Guzmán", nickname: "" };

    expect(soloAddressName(guest)).toBe("Luis Guzmán");
    expect(listMemberName(guest)).toBe("Luis");
  });

  it("falls back to the full name for a single-token name when solo", () => {
    const guest = { fullName: "Luzma", nickname: null };

    expect(soloAddressName(guest)).toBe("Luzma");
    expect(listMemberName(guest)).toBe("Luzma");
  });
});
