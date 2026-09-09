import { describe, expect, it } from "vitest";

import { GATE_HELP_TEMPLATE, buildGateRecoveryLink } from "./recovery-message";

/**
 * The recovery path is the whole fallback: there is no OTP, no email, and no
 * second unlock mechanism. A guest who cannot match their own number reaches a
 * human over the channel the invitation already arrived on.
 *
 * Two properties are load-bearing and are what these tests pin:
 *
 *  1. the recipient is the OWNING sender's contact number, never a guest's;
 *  2. the draft names the household, so the operator can act without asking
 *     "who is this?" — which is also why a missing greeting name is a hard
 *     failure rather than a message reading "Hola, undefined".
 */

const OWNER = "+573005550000";

describe("buildGateRecoveryLink", () => {
  it("addresses the owning sender's contact number", () => {
    const link = buildGateRecoveryLink(OWNER, "Ñoño Muñóz");

    expect(link.startsWith("https://wa.me/573005550000?text=")).toBe(true);
  });

  it("addresses a different owner when the invitation belongs to one", () => {
    const link = buildGateRecoveryLink("+573015551111", "Familia Restrepo");

    expect(link.startsWith("https://wa.me/573015551111?text=")).toBe(true);
  });

  it("names the household inside the prepared message", () => {
    const link = buildGateRecoveryLink(OWNER, "Familia Restrepo");
    const text = new URL(link).searchParams.get("text") ?? "";

    expect(text).toContain("Familia Restrepo");
    expect(text).toContain("no puedo abrir mi invitación");
  });

  it("percent-encodes an accented household name rather than emitting it raw", () => {
    const link = buildGateRecoveryLink(OWNER, "Ñoño Muñóz");

    expect(link).not.toContain("Ñoño");
    expect(new URL(link).searchParams.get("text")).toContain("Ñoño Muñóz");
  });

  it("refuses to build a link for a non-E.164 owner contact", () => {
    expect(() =>
      buildGateRecoveryLink("3005550000", "Familia Restrepo"),
    ).toThrow(/E\.164/);
  });

  it("refuses to build a link with no household name, rather than saying 'undefined'", () => {
    expect(() => buildGateRecoveryLink(OWNER, "")).toThrow(/greeting_name/);
  });

  it("keeps greeting_name as the template's only variable", () => {
    const variables = [
      ...GATE_HELP_TEMPLATE.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
    ].map((match) => match[1]);

    expect(variables).toEqual(["greeting_name"]);
  });
});
