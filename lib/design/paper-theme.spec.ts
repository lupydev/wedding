import { describe, expect, it } from "vitest";

import { PAPER_TEXT_PAIRS, PAPER_TOKENS } from "./paper-theme";
import { WCAG_AA_NORMAL_TEXT, contrastRatio } from "./contrast";

/**
 * The guest-facing palette, held to the same measurement as the console's.
 *
 * There are TWO palettes in this product on purpose: the console is a graphite
 * back room and the invitation is light and papery. They are bound by sharing the
 * TYPE, not the colour. What they also share is this file's rule — a light
 * palette is exactly as able to ship 2.36:1 text as a dark one, and "it looked
 * fine on my screen" is the same non-answer in both.
 */

describe("the paper token table", () => {
  it("declares every colour in a measurable notation", () => {
    for (const value of Object.values(PAPER_TOKENS)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{3,6}$/);
    }
  });

  it("is genuinely light, not the console palette under another name", () => {
    // The guest-facing surface must never arrive dark. Asserted as a measurement
    // rather than trusted: this is the one rule the console's own styling could
    // break by accident, by scoping a graphite token too widely.
    expect(contrastRatio(PAPER_TOKENS.foreground, "#FFFFFF")).toBeGreaterThan(
      contrastRatio(PAPER_TOKENS.foreground, "#000000"),
    );
    expect(contrastRatio(PAPER_TOKENS.background, "#FFFFFF")).toBeLessThan(1.2);
  });
});

describe("every declared paper text pair clears WCAG AA", () => {
  it("declares enough pairs to be worth walking", () => {
    expect(PAPER_TEXT_PAIRS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(PAPER_TEXT_PAIRS)(
    "$foregroundName on $backgroundName",
    ({ foreground, background }) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT,
      );
    },
  );
});

describe("the pairs the paper palette refuses", () => {
  it("would fail if the console's gold were reused on paper", () => {
    // `#D79E4F` reads at 6.62:1 on graphite and is unreadable on paper. The two
    // palettes cannot share an accent, and this is the assertion that says why.
    expect(contrastRatio("#D79E4F", PAPER_TOKENS.card)).toBeLessThan(
      WCAG_AA_NORMAL_TEXT,
    );
  });
});
