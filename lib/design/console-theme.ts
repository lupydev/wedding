/**
 * The console's design tokens, as data.
 *
 * WHY THE TOKENS LIVE IN TYPESCRIPT AND NOT ONLY IN CSS
 *
 * A CSS custom property is a string nothing can check. These same values are
 * emitted into `app/globals.css` — `tools/console-theme-css.spec.ts` asserts the
 * two cannot drift — and holding them here as data is what lets
 * `console-theme.spec.ts` MEASURE every readable pairing the theme permits
 * instead of trusting that somebody eyeballed it.
 *
 * TWO PALETTES, DELIBERATELY. This file is the console's, and the console only:
 * a graphite back room. The guest-facing invitation and both preview panes stay
 * light and papery, and are bound to this surface by sharing the TYPE, not the
 * colour. A single palette stretched across both would make the invitation look
 * like an admin tool or the console look like a wedding card.
 *
 * EVERY VALUE IS HEX OR `rgba()`, NEVER `oklch()`. Not a stylistic preference:
 * `lib/design/contrast.ts` refuses notations it cannot measure exactly, so an
 * `oklch()` token would be a token this theme's contrast suite silently stops
 * protecting.
 */

/**
 * THE COLOUR RULE, AND IT HAS EXACTLY THREE ENTRIES.
 *
 * `primary` (gold) means "this needs your attention". `success` (green) means
 * "done". `destructive` (red) means "broken or missing". NOTHING ELSE MAY USE
 * THESE THREE COLOURS — not a decorative accent, not a brand flourish, not a
 * heading, not a hover state.
 *
 * The rule is written down because a reference console learned it the expensive
 * way: its send screen put four green buttons on every guest row, across 388
 * guests, and not one of them read as the important one. A colour that means
 * three things means nothing.
 *
 * The strings are operator-facing Spanish because they are the words a reviewer
 * checks a call site against.
 */
export const CONSOLE_SEMANTIC_COLOR_ROLES = {
  primary: "Requiere tu atención: la acción principal de la pantalla.",
  success: "Hecho: algo que ya quedó completado y no necesita intervención.",
  destructive:
    "Roto o falta: un dato ausente, un error o una acción que destruye.",
} as const;

/**
 * The graphite surfaces and the text that is allowed on them.
 *
 * Measured on the card surface (`#1E242C`), the text tokens land at 12.91:1
 * (`foreground`), 6.18:1 (`mutedForeground`), 5.17:1 (`hint`), 6.62:1
 * (`primary`), 5.54:1 (`success`) and 5.14:1 (`destructive`). Those numbers are
 * not maintained by hand — `console-theme.spec.ts` recomputes every pair.
 */
export const CONSOLE_TOKENS = {
  /** The app background: the darkest surface, behind everything. */
  background: "#161A1F",
  /** A panel surface, lifted off the background. */
  card: "#1E242C",
  /** A SUNK surface: inputs, alternate rows, wells. */
  muted: "#191E24",
  /** A RAISED surface: menus, sheets, popovers. The lightest of the four. */
  popover: "#262E38",

  /** Primary text. */
  foreground: "#EDE9E1",
  /** Secondary text: labels, metadata, anything subordinate to a figure. */
  mutedForeground: "#9AA4B0",
  /**
   * Hints: the one-line explanation under a panel title.
   *
   * `#8C95A3` rather than the `#8892A0` this palette was first drafted with. The
   * draft measured 4.36:1 on the RAISED surface — under the 4.5:1 minimum — and
   * a hint is not a token that may be readable on three surfaces out of four.
   */
  hint: "#8C95A3",

  /** Gold. "This needs your attention", and nothing else. */
  primary: "#D79E4F",
  /**
   * The only foreground permitted on the gold.
   *
   * Measured 7.75:1. White on this gold is 2.36:1 — a reference console shipped
   * exactly that in five hand-rolled call sites while its own shared button
   * primitive already had this value. The primitive was right.
   */
  primaryForeground: "#1A1408",

  /** Green. "Done", and nothing else. */
  success: "#5FA97B",
  /**
   * Red. "Broken or missing", and nothing else.
   *
   * `#DA7965` rather than the `#D8735F` first drafted: that measured 4.27:1 on
   * the raised surface, and a destructive label in a menu or a sheet is exactly
   * where this token has to stay readable.
   */
  destructive: "#DA7965",
} as const;

/**
 * Hairlines. NOT text, and excluded from the contrast suite on purpose.
 *
 * Holding a 1px divider to a 4.5:1 text threshold would force it to 60% opacity
 * and turn every panel into a wireframe. The exclusion is named here rather than
 * achieved by leaving them out of a list, so that a reader can see it was a
 * decision.
 */
export const CONSOLE_HAIRLINES = {
  /** Dividers and panel edges. */
  border: "rgba(233, 228, 217, .10)",
  /** Controls and quiet buttons: twice the border, so a control reads as one. */
  input: "rgba(233, 228, 217, .20)",
} as const;

/** One corner radius for the whole console: 14px. */
export const CONSOLE_RADIUS = "0.875rem";

/**
 * The minimum computed font size for any console input, in pixels.
 *
 * 16, not 15. A reference console's rule said 15px and its comment said "below
 * 16 and iOS zooms" — the rule and its own comment contradicted each other, and
 * the comment was right. At 16px or larger mobile Safari focuses the field
 * normally; at 15px or less it zooms the viewport. Its console zoomed on every
 * field focus, on the phone it was built for. Operators dispatch from a phone
 * here too, because `wa.me` needs WhatsApp on the same handset, so this is the
 * primary case rather than an adaptation.
 */
export const CONSOLE_INPUT_MIN_FONT_SIZE_PX = 16;

/** No transition in the console may run longer than this. */
export const CONSOLE_TRANSITION_MAX_MS = 200;

/** One readable pairing the theme permits. */
export interface TextPair {
  readonly foregroundName: string;
  readonly foreground: string;
  readonly backgroundName: string;
  readonly background: string;
}

/** The four surfaces a text token may be placed on. */
const SURFACES = [
  ["background", CONSOLE_TOKENS.background],
  ["card", CONSOLE_TOKENS.card],
  ["muted", CONSOLE_TOKENS.muted],
  ["popover", CONSOLE_TOKENS.popover],
] as const;

/**
 * Every text token, each permitted on EVERY surface.
 *
 * Not "on the surfaces we currently use it on". A token that is only readable on
 * three of the four is a trap for the next screen, and the next screen is the one
 * nobody will re-measure.
 */
const TEXT_TOKENS = [
  ["foreground", CONSOLE_TOKENS.foreground],
  ["mutedForeground", CONSOLE_TOKENS.mutedForeground],
  ["hint", CONSOLE_TOKENS.hint],
  ["primary", CONSOLE_TOKENS.primary],
  ["success", CONSOLE_TOKENS.success],
  ["destructive", CONSOLE_TOKENS.destructive],
] as const;

/**
 * Pairs where the BACKGROUND is itself a signal colour: a filled gold button, a
 * filled success or destructive chip. This is where the reference console's bug
 * lived, so these are listed explicitly rather than derived.
 */
const ON_SIGNAL_PAIRS: readonly TextPair[] = [
  {
    foregroundName: "primaryForeground",
    foreground: CONSOLE_TOKENS.primaryForeground,
    backgroundName: "primary",
    background: CONSOLE_TOKENS.primary,
  },
  {
    foregroundName: "primaryForeground",
    foreground: CONSOLE_TOKENS.primaryForeground,
    backgroundName: "success",
    background: CONSOLE_TOKENS.success,
  },
  {
    foregroundName: "primaryForeground",
    foreground: CONSOLE_TOKENS.primaryForeground,
    backgroundName: "destructive",
    background: CONSOLE_TOKENS.destructive,
  },
];

/** Every foreground/background pair this theme permits, as data to walk. */
export const CONSOLE_TEXT_PAIRS: readonly TextPair[] = [
  ...TEXT_TOKENS.flatMap(([foregroundName, foreground]) =>
    SURFACES.map(([backgroundName, background]) => ({
      foregroundName,
      foreground,
      backgroundName,
      background,
    })),
  ),
  ...ON_SIGNAL_PAIRS,
];
