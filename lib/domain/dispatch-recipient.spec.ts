import { describe, expect, it } from "vitest";

import {
  resolveDispatchRecipient,
  type IdentifiedDispatchGuest,
} from "./dispatch-recipient";

/**
 * Resolving the recipient an operator CHOSE — not picking one for them.
 *
 * The removed `selectDispatchRecipient` answered "who can this go to" and
 * auto-picked the first household member carrying a dispatchable number. This
 * answers a different, larger question: "can it go to the person who was
 * chosen". A choice can be missing, stale or dead as well as unreachable, so
 * the failure space grows from two reasons to four.
 *
 * The function takes PLAIN ARRAYS and a plain id. It trusts no caller
 * invariant, including the composite foreign key that makes
 * `recipient_not_in_household` unwritable in the database: a pure function that
 * assumes its caller's invariant holds is one refactor away from being wrong
 * the day it does not.
 */

function guest(
  overrides: Partial<IdentifiedDispatchGuest> = {},
): IdentifiedDispatchGuest {
  return {
    id: "g1",
    fullName: "Ana Muñóz",
    phoneE164: "+573001234567",
    dispatchable: true,
    ...overrides,
  };
}

describe("resolveDispatchRecipient", () => {
  /**
   * Both halves in ONE test, as the dispatch-recipient spec requires: a
   * function that always returned `no_recipient_chosen` would pass the refusal
   * alone, and nothing would say the resolution never works.
   */
  it("refuses an unchosen recipient and resolves a chosen, dispatchable one", () => {
    const reachable = guest({ id: "g1", fullName: "Ana Muñóz" });
    const household = [reachable, guest({ id: "g2", fullName: "Beto Muñóz" })];

    expect(resolveDispatchRecipient(household, null)).toEqual({
      ok: false,
      reason: "no_recipient_chosen",
    });
    expect(resolveDispatchRecipient(household, "g1")).toEqual({
      ok: true,
      guest: reachable,
      phoneE164: "+573001234567",
    });
  });

  it("resolves the chosen member, not the first reachable one", () => {
    // The removed auto-pick would have returned `g1`. The choice is what
    // decides, and asserting the SECOND member proves no ordering rule survived.
    const chosen = guest({
      id: "g2",
      fullName: "Beto Muñóz",
      phoneE164: "+573009999999",
    });

    expect(resolveDispatchRecipient([guest(), chosen], "g2")).toEqual({
      ok: true,
      guest: chosen,
      phoneE164: "+573009999999",
    });
  });

  it("reports a chosen id that names nobody in the household", () => {
    // Unwritable through the composite FK (design D23) and resolved anyway,
    // because this signature cannot see that constraint.
    expect(resolveDispatchRecipient([guest()], "ghost")).toEqual({
      ok: false,
      reason: "recipient_not_in_household",
    });
  });

  it("reports a chosen id against an empty household the same way", () => {
    expect(resolveDispatchRecipient([], "g1")).toEqual({
      ok: false,
      reason: "recipient_not_in_household",
    });
  });

  it("reports a chosen guest carrying no stored number", () => {
    const household = [
      guest({ id: "g1", phoneE164: null, dispatchable: false }),
      guest({ id: "g2", fullName: "Beto Muñóz" }),
    ];

    // The meaning that changed: the household HAS a reachable number, on the
    // partner. The chosen person does not, so this is blocked.
    expect(resolveDispatchRecipient(household, "g1")).toEqual({
      ok: false,
      reason: "recipient_has_no_phone",
    });
  });

  it("treats a cleared phone field as no number rather than as a number", () => {
    expect(
      resolveDispatchRecipient(
        [guest({ phoneE164: "", dispatchable: false })],
        "g1",
      ),
    ).toEqual({ ok: false, reason: "recipient_has_no_phone" });
  });

  it("separates a landline from a missing number", () => {
    // A Colombian landline is a valid E.164 number no WhatsApp will answer.
    // Sending anyway records a dispatch nobody received.
    expect(
      resolveDispatchRecipient(
        [guest({ phoneE164: "+576012345678", dispatchable: false })],
        "g1",
      ),
    ).toEqual({ ok: false, reason: "recipient_phone_unreachable" });
  });

  it("reports the unchosen recipient even when the household is empty", () => {
    expect(resolveDispatchRecipient([], null)).toEqual({
      ok: false,
      reason: "no_recipient_chosen",
    });
  });
});
