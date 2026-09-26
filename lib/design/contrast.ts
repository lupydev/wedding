/**
 * WCAG 2.x contrast arithmetic.
 *
 * WHY THIS IS CODE AND NOT A DESIGN REVIEW
 *
 * "Is this readable?" is a calculation with a published formula and a published
 * threshold. A reference console shipped `#fff` on its gold accent in five
 * hand-rolled call sites — its own shared button primitive had the right
 * foreground all along — and nobody caught it, because catching it by eye means
 * noticing that one particular pale-on-pale pairing is worse than the dozen
 * others that look similar. Measured, it is 2.36:1 against a 4.5:1 minimum and
 * the answer is not a matter of taste.
 *
 * Pure and dependency-free on purpose: it takes strings and returns numbers, so
 * every theme token can be checked in a plain node test with no DOM, no browser
 * and no screenshot.
 */

/** A colour measured in sRGB channels, 0-255, plus a 0-1 alpha. */
export interface Rgba {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const HEX_LONG = /^#([0-9a-f]{6})$/i;
const HEX_SHORT = /^#([0-9a-f]{3})$/i;
const RGB_FUNCTION = /^rgba?\(([^)]*)\)$/i;

/** sRGB luminance coefficients, from the WCAG 2.x relative luminance formula. */
const LUMINANCE_COEFFICIENTS = {
  red: 0.2126,
  green: 0.7152,
  blue: 0.0722,
} as const;

/**
 * The WCAG minimum for normal-size body text.
 *
 * Exported so the theme test and the tokens themselves cannot disagree about
 * which threshold they are being held to.
 */
export const WCAG_AA_NORMAL_TEXT = 4.5;

/**
 * The WCAG minimum for the parts of a control that are not text.
 *
 * The edge of an input, the outline of a checkbox, the boundary that says
 * "this is where you type". Success criterion 1.4.11 holds them to 3:1 rather
 * than 4.5:1 — a shape is easier to resolve than a letterform — and that is a
 * different question from whether the words inside them can be read. A field
 * whose text passes and whose edge does not is a field nobody finds.
 */
export const WCAG_AA_NON_TEXT = 3;

function parseChannel(raw: string): number {
  const trimmed = raw.trim();
  const value = Number(trimmed);

  if (trimmed === "" || Number.isNaN(value)) {
    throw new Error(`unsupported colour channel: ${raw}`);
  }

  return value;
}

function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) {
    return 1;
  }

  const trimmed = raw.trim();

  if (trimmed.endsWith("%")) {
    return parseChannel(trimmed.slice(0, -1)) / 100;
  }

  return parseChannel(trimmed);
}

/**
 * Reads a CSS colour this project actually uses into measurable channels.
 *
 * Hex and `rgb()`/`rgba()` only. `oklch()` is deliberately REFUSED rather than
 * approximated: a wrong conversion would produce a confident number for an
 * unreadable pairing, which is worse than an error nobody can ignore. Every
 * token in the console theme is therefore written in a notation this function
 * can measure — that constraint is the point, not a limitation.
 */
export function parseCssColor(value: string): Rgba {
  const input = value.trim();
  const long = HEX_LONG.exec(input);

  if (long !== null) {
    const digits = long[1];

    return {
      red: Number.parseInt(digits.slice(0, 2), 16),
      green: Number.parseInt(digits.slice(2, 4), 16),
      blue: Number.parseInt(digits.slice(4, 6), 16),
      alpha: 1,
    };
  }

  const short = HEX_SHORT.exec(input);

  if (short !== null) {
    const digits = short[1];

    return {
      red: Number.parseInt(`${digits[0]}${digits[0]}`, 16),
      green: Number.parseInt(`${digits[1]}${digits[1]}`, 16),
      blue: Number.parseInt(`${digits[2]}${digits[2]}`, 16),
      alpha: 1,
    };
  }

  const functional = RGB_FUNCTION.exec(input);

  if (functional !== null) {
    const parts = functional[1]
      .replace(/\//g, " ")
      .split(/[,\s]+/)
      .filter((part) => part !== "");

    if (parts.length < 3) {
      throw new Error(`unsupported colour notation: ${value}`);
    }

    return {
      red: parseChannel(parts[0]),
      green: parseChannel(parts[1]),
      blue: parseChannel(parts[2]),
      alpha: parseAlpha(parts[3]),
    };
  }

  throw new Error(`unsupported colour notation: ${value}`);
}

function linearize(channel: number): number {
  const normalized = channel / 255;

  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/** The WCAG relative luminance of a colour, 0 for black and 1 for white. */
export function relativeLuminance(color: Rgba): number {
  return (
    LUMINANCE_COEFFICIENTS.red * linearize(color.red) +
    LUMINANCE_COEFFICIENTS.green * linearize(color.green) +
    LUMINANCE_COEFFICIENTS.blue * linearize(color.blue)
  );
}

/**
 * Composites a possibly translucent colour over an opaque backdrop.
 *
 * Contrast is a property of what the eye receives, and what the eye receives
 * from a 10% hairline is the hairline mixed with whatever is behind it. Measuring
 * the declared `rgba()` as if it were opaque would flatter every translucent
 * token in the theme.
 */
export function flatten(color: Rgba, backdrop: Rgba): Rgba {
  if (color.alpha >= 1) {
    return color;
  }

  const mix = (channel: keyof Omit<Rgba, "alpha">): number =>
    color.alpha * color[channel] + (1 - color.alpha) * backdrop[channel];

  return {
    red: mix("red"),
    green: mix("green"),
    blue: mix("blue"),
    alpha: 1,
  };
}

/**
 * The contrast ratio between a foreground and a background, 1:1 to 21:1.
 *
 * The foreground is composited over the background first, so a translucent text
 * colour is measured as it will actually appear.
 */
export function contrastRatio(foreground: string, background: string): number {
  const backdrop = parseCssColor(background);
  const front = flatten(parseCssColor(foreground), backdrop);
  const lighter = Math.max(
    relativeLuminance(front),
    relativeLuminance(backdrop),
  );
  const darker = Math.min(
    relativeLuminance(front),
    relativeLuminance(backdrop),
  );

  return (lighter + 0.05) / (darker + 0.05);
}
