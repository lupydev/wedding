import { describe, expect, it } from "vitest";

import { GATE_GENERIC_FAILURE, gateFeedbackMessages } from "./gate-copy";

/**
 * The gate's failure copy is a security surface, not decoration.
 *
 * A message that says "this number is not on the guest list" turns a forwarded
 * link into a phone-number checker for that household: anyone holding the link
 * can test numbers until one answers differently. So there is exactly ONE
 * failure sentence, and it is identical whether the number was wrong, the guest
 * has no phone on file, or the invitation does not exist.
 *
 * What the guest IS told is the concrete state of their own attempts. "Try
 * again later" is useless to someone who mistyped their own number; "you have
 * two tries left" and "wait 12 minutes" are actionable and leak nothing.
 */

const MINUTE = 60_000;

describe("gateFeedbackMessages", () => {
  it("says nothing before the guest has submitted anything", () => {
    expect(gateFeedbackMessages({ status: "idle" })).toEqual([]);
  });

  it("leads a rejection with the single generic failure sentence", () => {
    const messages = gateFeedbackMessages({
      status: "rejected",
      attemptsRemaining: 5,
    });

    expect(messages[0]).toBe(GATE_GENERIC_FAILURE);
  });

  it("tells the guest how many attempts are left", () => {
    expect(
      gateFeedbackMessages({ status: "rejected", attemptsRemaining: 2 })[1],
    ).toBe("Te quedan 2 intentos.");
  });

  it("switches to the singular for the last attempt", () => {
    expect(
      gateFeedbackMessages({ status: "rejected", attemptsRemaining: 1 })[1],
    ).toBe("Te queda 1 intento.");
  });

  it("warns plainly when the allowance is spent instead of promising a count", () => {
    expect(
      gateFeedbackMessages({ status: "rejected", attemptsRemaining: 0 })[1],
    ).toBe("Ese fue el último intento disponible por ahora.");
  });

  it("gives a lockout a concrete wait in minutes, rounded up", () => {
    expect(
      gateFeedbackMessages({
        status: "locked",
        retryAfterMs: 11 * MINUTE + 30_000,
      }),
    ).toEqual([
      "Por seguridad, espera 12 minutos antes de intentarlo de nuevo.",
    ]);
  });

  it("uses the singular for a wait under a minute, never 'espera 0 minutos'", () => {
    expect(
      gateFeedbackMessages({ status: "locked", retryAfterMs: 5_000 }),
    ).toEqual(["Por seguridad, espera 1 minuto antes de intentarlo de nuevo."]);
  });

  it("reports a long lockout in its own minutes rather than a vague 'later'", () => {
    expect(
      gateFeedbackMessages({ status: "locked", retryAfterMs: 30 * MINUTE }),
    ).toEqual([
      "Por seguridad, espera 30 minutos antes de intentarlo de nuevo.",
    ]);
  });

  it("never names a reason a rejection could be attributed to", () => {
    const everything = [
      ...gateFeedbackMessages({ status: "rejected", attemptsRemaining: 3 }),
      ...gateFeedbackMessages({ status: "locked", retryAfterMs: MINUTE }),
    ].join(" ");

    for (const leak of [
      "lista de invitados",
      "no está registrado",
      "no existe",
      "no encontramos esta invitación",
    ]) {
      expect(everything.toLowerCase()).not.toContain(leak);
    }
  });
});
