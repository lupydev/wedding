import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  flatten,
  parseCssColor,
  relativeLuminance,
} from "./contrast";

/**
 * WCAG 2.x contrast arithmetic, tested against values the specification itself
 * publishes.
 *
 * This module exists because "is this readable?" is a CALCULATION and not an
 * opinion. Every colour decision in the console theme is checked by it, so the
 * arithmetic has to be pinned by numbers that come from outside this repository
 * rather than from its own output.
 */

describe("parseCssColor", () => {
  it("reads a six-digit hex triplet as opaque channels", () => {
    expect(parseCssColor("#D79E4F")).toEqual({
      red: 215,
      green: 158,
      blue: 79,
      alpha: 1,
    });
  });

  it("accepts lower-case hex, because CSS is case-insensitive", () => {
    expect(parseCssColor("#ede9e1")).toEqual({
      red: 237,
      green: 233,
      blue: 225,
      alpha: 1,
    });
  });

  it("expands a three-digit hex shorthand by doubling each digit", () => {
    expect(parseCssColor("#fff")).toEqual({
      red: 255,
      green: 255,
      blue: 255,
      alpha: 1,
    });
  });

  it("reads the alpha channel of an rgba() colour", () => {
    expect(parseCssColor("rgba(233, 228, 217, .10)")).toEqual({
      red: 233,
      green: 228,
      blue: 217,
      alpha: 0.1,
    });
  });

  it("refuses a colour notation it cannot measure, instead of guessing", () => {
    expect(() => parseCssColor("oklch(0.5 0.1 240)")).toThrow(
      /unsupported colour/i,
    );
  });
});

describe("relativeLuminance", () => {
  it("measures white as the maximum", () => {
    expect(relativeLuminance(parseCssColor("#ffffff"))).toBeCloseTo(1, 5);
  });

  it("measures black as zero", () => {
    expect(relativeLuminance(parseCssColor("#000000"))).toBeCloseTo(0, 5);
  });

  it("weights green far above blue, as the sRGB coefficients do", () => {
    const green = relativeLuminance(parseCssColor("#00ff00"));
    const blue = relativeLuminance(parseCssColor("#0000ff"));

    expect(green).toBeCloseTo(0.7152, 4);
    expect(blue).toBeCloseTo(0.0722, 4);
  });
});

describe("flatten", () => {
  it("returns a fully opaque colour unchanged", () => {
    expect(flatten(parseCssColor("#D79E4F"), parseCssColor("#1E242C"))).toEqual(
      {
        red: 215,
        green: 158,
        blue: 79,
        alpha: 1,
      },
    );
  });

  it("composites a translucent colour over its backdrop", () => {
    // 50% white over black is the midpoint of every channel.
    expect(
      flatten(parseCssColor("rgba(255,255,255,0.5)"), parseCssColor("#000000")),
    ).toEqual({ red: 127.5, green: 127.5, blue: 127.5, alpha: 1 });
  });
});

describe("contrastRatio", () => {
  it("measures black on white as 21:1, the maximum the formula produces", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
  });

  it("is symmetric: which colour is the text does not change the ratio", () => {
    expect(contrastRatio("#D79E4F", "#1E242C")).toBeCloseTo(
      contrastRatio("#1E242C", "#D79E4F"),
      10,
    );
  });

  it("measures a colour against itself as 1:1", () => {
    expect(contrastRatio("#1E242C", "#1E242C")).toBeCloseTo(1, 10);
  });

  it("composites a translucent foreground over the given background first", () => {
    // Pure white at 50% over black flattens to #808080-ish, which is nowhere
    // near white-on-black's 21:1.
    const translucent = contrastRatio("rgba(255,255,255,0.5)", "#000000");

    expect(translucent).toBeLessThan(21);
    expect(translucent).toBeCloseTo(contrastRatio("#808080", "#000000"), 1);
  });
});
