import { describe, expect, it } from "vitest";

import { whyDisabled } from "./why-disabled";

/**
 * A disabled control that does not say why is a dead end.
 *
 * The operator cannot proceed and cannot find out what would let them. This
 * console has exactly the disabled controls where that hurts most — a send button
 * withheld because a phone number is missing, a submit withheld because a form is
 * in flight — so the reason travels with the `disabled` attribute rather than
 * beside it in someone's memory.
 *
 * A pure function, so the rule is enforced once and tested without a DOM.
 */

describe("whyDisabled", () => {
  it("carries the reason as a title when the control is disabled", () => {
    expect(whyDisabled("Falta el número de teléfono.")).toEqual({
      disabled: true,
      title: "Falta el número de teléfono.",
    });
  });

  it("leaves an enabled control with no disabled attribute and no title", () => {
    expect(whyDisabled(null)).toEqual({ disabled: false });
  });

  it("refuses to disable a control without a stated reason", () => {
    // An empty reason is the failure mode this function exists to prevent, so it
    // throws rather than producing a silent dead end.
    expect(() => whyDisabled("")).toThrow(/reason/i);
    expect(() => whyDisabled("   ")).toThrow(/reason/i);
  });

  it("trims the reason, so stray whitespace does not reach a tooltip", () => {
    expect(whyDisabled("  Ya se envió.  ")).toEqual({
      disabled: true,
      title: "Ya se envió.",
    });
  });
});
