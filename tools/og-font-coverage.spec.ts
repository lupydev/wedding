import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { glyphIdForCodepoint } from "./ttf-cmap";

/**
 * Tofu guard for the Open Graph card.
 *
 * `next/og` rasterizes text with Satori, which draws a placeholder box — tofu —
 * for any codepoint the active font has no glyph for. The card renders guest
 * names, and Spanish guest names carry `ñ`, `Ñ` and accented vowels, so a font
 * missing those produces a preview card full of boxes with no error anywhere.
 *
 * The card deliberately ships NO custom font: it uses the one `next/og` bundles
 * as its fallback, which is why this test asserts against that exact file. If a
 * Next.js upgrade moves or replaces it, this test fails loudly instead of the
 * product silently regressing to boxes.
 *
 * Asserting on the font's character map is stronger than eyeballing a rendered
 * PNG: tofu happens exactly when the codepoint maps to glyph id 0, which is the
 * condition measured here.
 */

/** Resolves the font `next/og` falls back to when no `fonts` option is given. */
function readBundledOgFallbackFont(): Uint8Array {
  const require = createRequire(import.meta.url);
  const ogEntry =
    require.resolve("next/dist/compiled/@vercel/og/index.node.js");
  const fontPath = ogEntry.replace(/index\.node\.js$/, "Geist-Regular.ttf");

  return new Uint8Array(readFileSync(fontPath));
}

/**
 * Every character a Spanish household name can contain beyond plain ASCII.
 *
 * Both cases are listed because the card may be styled with uppercase names,
 * and a font can carry `ñ` while missing `Ñ`.
 */
const SPANISH_CODEPOINTS = [..."áéíóúüñ", ..."ÁÉÍÓÚÜÑ", "¡", "¿"] as const;

describe("Open Graph card font coverage", () => {
  const font = readBundledOgFallbackFont();

  it("maps every Spanish character the card can render to a real glyph", () => {
    const missing = SPANISH_CODEPOINTS.filter(
      (character) => glyphIdForCodepoint(font, character.codePointAt(0)!) === 0,
    );

    expect(missing).toEqual([]);
  });

  it("maps the exact fixture name used by the E2E card test", () => {
    // The E2E fixture is "Ñoño Muñóz": enye in both cases plus an accented o.
    const missing = [...new Set("Ñoño Muñóz")].filter(
      (character) => glyphIdForCodepoint(font, character.codePointAt(0)!) === 0,
    );

    expect(missing).toEqual([]);
  });

  it("reports no glyph for a codepoint the font genuinely lacks", () => {
    // A CJK ideograph: absent from a Latin font, so a parser that always
    // reported a glyph would be caught here rather than passing everything.
    expect(glyphIdForCodepoint(font, 0x4e2d)).toBe(0);
  });

  it("distinguishes an accented vowel from its unaccented counterpart", () => {
    // Identical glyph ids would mean the accent is being dropped rather than
    // drawn, which reads as correct in a byte-length assertion.
    expect(glyphIdForCodepoint(font, "ó".codePointAt(0)!)).not.toBe(
      glyphIdForCodepoint(font, "o".codePointAt(0)!),
    );
    expect(glyphIdForCodepoint(font, "ñ".codePointAt(0)!)).not.toBe(
      glyphIdForCodepoint(font, "n".codePointAt(0)!),
    );
  });
});
