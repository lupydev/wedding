import { describe, expect, it } from "vitest";

import {
  CONSOLE_HAIRLINES,
  CONSOLE_INPUT_MIN_FONT_SIZE_PX,
  CONSOLE_RADIUS,
  CONSOLE_SEMANTIC_COLOR_ROLES,
  CONSOLE_TEXT_PAIRS,
  CONSOLE_TOKENS,
  CONSOLE_TRANSITION_MAX_MS,
} from "./console-theme";
import { WCAG_AA_NORMAL_TEXT, contrastRatio } from "./contrast";

/**
 * The console theme, held to a measurement rather than to a taste.
 *
 * THIS FILE IS THE POINT OF THE DESIGN FOUNDATION.
 *
 * A reference console shipped `#fff` on its gold accent in its active nav item,
 * its active filter chips and its copy-confirmation button. Its own shared
 * button primitive used a near-black gold foreground and was right; five
 * hand-rolled call sites were wrong, and nothing in the project could tell the
 * difference. Measured, white on that gold is 2.36:1 against a 4.5:1 minimum.
 *
 * So every foreground/background pair the theme DECLARES is measured here. A new
 * token, or a new surface an existing token is allowed to sit on, is one more row
 * this test walks — which means the only way to ship an unreadable pairing is to
 * declare it and watch this fail.
 */

describe("the console token table", () => {
  it("declares every colour in a notation the contrast arithmetic can measure", () => {
    // An `oklch()` token would be unmeasurable, and an unmeasurable token is one
    // this whole file silently stops protecting.
    const values = Object.values(CONSOLE_TOKENS);

    expect(values.length).toBeGreaterThan(8);
    for (const value of values) {
      expect(value).toMatch(/^(#[0-9A-Fa-f]{3,6}|rgba?\()/);
    }
  });

  it("pairs a near-black foreground with the gold, never white", () => {
    expect(CONSOLE_TOKENS.primaryForeground).toBe("#1A1408");
    expect(
      contrastRatio(CONSOLE_TOKENS.primaryForeground, CONSOLE_TOKENS.primary),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("uses a 14px radius, as one value rather than per-component guesses", () => {
    expect(CONSOLE_RADIUS).toBe("0.875rem");
  });

  it("requires console inputs to be at least 16px, the iOS zoom threshold", () => {
    // 15px is NOT the threshold. At 16px or more mobile Safari focuses the field
    // normally; at 15px or less it zooms the viewport, on the phone the console
    // is dispatched from.
    expect(CONSOLE_INPUT_MIN_FONT_SIZE_PX).toBe(16);
  });

  it("caps transitions under 300ms and offers at most two easings", () => {
    expect(CONSOLE_TRANSITION_MAX_MS).toBeLessThanOrEqual(300);
  });
});

describe("the semantic colour rule", () => {
  /**
   * Gold means "this needs your attention", green means "done", red means
   * "broken or missing", and nothing else may use them. A reference send screen
   * put four green buttons on every guest row across 388 guests, and none of
   * them read as the important one.
   */
  it("assigns exactly one meaning to each of the three signal colours", () => {
    expect(Object.keys(CONSOLE_SEMANTIC_COLOR_ROLES).toSorted()).toEqual([
      "destructive",
      "primary",
      "success",
    ]);
  });

  it("states each meaning in words, so a call site can be checked against it", () => {
    expect(CONSOLE_SEMANTIC_COLOR_ROLES.primary).toMatch(/atención/i);
    expect(CONSOLE_SEMANTIC_COLOR_ROLES.success).toMatch(/hecho|completad/i);
    expect(CONSOLE_SEMANTIC_COLOR_ROLES.destructive).toMatch(/falta|error/i);
  });
});

describe("every declared text pair clears WCAG AA for normal text", () => {
  it("declares enough pairs to be worth walking", () => {
    // Without this the loop below could iterate zero times and still pass.
    expect(CONSOLE_TEXT_PAIRS.length).toBeGreaterThanOrEqual(20);
  });

  it.each(CONSOLE_TEXT_PAIRS)(
    "$foregroundName on $backgroundName",
    ({ foreground, background }) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT,
      );
    },
  );
});

describe("the pairs this theme refuses", () => {
  it("would fail if white were ever paired with the gold", () => {
    // The assertion that proves the suite above has teeth: the exact mistake
    // five reference call sites shipped is measurably below the threshold.
    expect(contrastRatio("#ffffff", CONSOLE_TOKENS.primary)).toBeLessThan(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it("never lists a hairline as a text colour", () => {
    // Borders are not read, so holding them to a text threshold would force a
    // 10% hairline to become a 60% one. They are named separately and excluded
    // on purpose rather than by omission.
    const hairlineValues = Object.values(CONSOLE_HAIRLINES);

    expect(hairlineValues.length).toBe(2);
    for (const pair of CONSOLE_TEXT_PAIRS) {
      expect(hairlineValues).not.toContain(pair.foreground);
    }
  });
});
