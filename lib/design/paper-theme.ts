/**
 * The guest-facing palette: paper, ink and a dark gold.
 *
 * TWO PALETTES, AND THIS IS THE OTHER ONE.
 *
 * The console is graphite because it is a back room an operator works in, on a
 * phone, possibly outdoors. The invitation is the thing a guest is given, and it
 * is light and papery. Nothing about the console's surface should leak onto it —
 * a wedding invitation that arrives looking like an admin panel is a worse
 * outcome than an unstyled one.
 *
 * WHAT THE TWO SHARE IS THE TYPE, NOT THE COLOUR. Yeseva One for display, Hanken
 * Grotesk for body, Caveat for script accents, on both surfaces. That is what
 * makes the console legible as the back room OF THIS EVENT rather than a generic
 * tool that happens to be pointed at it.
 *
 * THE ACCENT CANNOT BE SHARED, AND THAT IS MEASURED. The console gold `#D79E4F`
 * reads at 6.62:1 on graphite and below the 4.5:1 minimum on paper. Reusing it
 * here would be the same class of mistake as white on gold: a colour carried from
 * the surface it was chosen for onto one it was never measured against.
 */

/**
 * The paper surfaces and the ink allowed on them.
 *
 * This is the DOCUMENT DEFAULT. `:root` in `app/globals.css` carries these
 * values and the console opts INTO graphite with a scope class, rather than the
 * other way round. That ordering means the guest-facing routes needed no edit at
 * all to keep their light surface — which is exactly the property this work unit
 * was told to preserve.
 */
export const PAPER_TOKENS = {
  /** The page: warm off-white, not a clinical `#fff`. */
  background: "#FAF7F1",
  /** A card lifted off the page. */
  card: "#FFFFFF",
  /** A sunk well: quoted blocks, quiet rows. */
  muted: "#F1ECE2",

  /** Body ink. */
  foreground: "#2A2620",
  /** Secondary ink: metadata, captions. */
  mutedForeground: "#6B6358",
  /**
   * Hints.
   *
   * `#716A5F` rather than the lighter `#7A7266` first drafted: that measured
   * 4.03:1 on the sunk surface, and a hint sitting in a quoted block is exactly
   * where it would have been used.
   */
  hint: "#716A5F",

  /**
   * The paper accent: a dark gold, deliberately not the console's.
   *
   * `#7F5B1A`. The obvious `#8A6520` measured 4.50:1 on the sunk surface —
   * technically passing and one rounding away from not, which is not a margin to
   * ship a whole palette on.
   */
  primary: "#7F5B1A",
  /** "Done" on paper: a confirmed answer. */
  success: "#2F6B45",
  /** "Broken or missing" on paper: a refused submission, a closed deadline. */
  destructive: "#A33A26",
} as const;

/** One readable pairing the paper palette permits. */
export interface PaperTextPair {
  readonly foregroundName: string;
  readonly foreground: string;
  readonly backgroundName: string;
  readonly background: string;
}

const SURFACES = [
  ["background", PAPER_TOKENS.background],
  ["card", PAPER_TOKENS.card],
  ["muted", PAPER_TOKENS.muted],
] as const;

const INKS = [
  ["foreground", PAPER_TOKENS.foreground],
  ["mutedForeground", PAPER_TOKENS.mutedForeground],
  ["hint", PAPER_TOKENS.hint],
  ["primary", PAPER_TOKENS.primary],
  ["success", PAPER_TOKENS.success],
  ["destructive", PAPER_TOKENS.destructive],
] as const;

/** Every foreground/background pair the paper palette permits. */
export const PAPER_TEXT_PAIRS: readonly PaperTextPair[] = [
  ...INKS.flatMap(([foregroundName, foreground]) =>
    SURFACES.map(([backgroundName, background]) => ({
      foregroundName,
      foreground,
      backgroundName,
      background,
    })),
  ),
  // The one filled pairing on paper: white on the dark gold.
  {
    foregroundName: "card",
    foreground: PAPER_TOKENS.card,
    backgroundName: "primary",
    background: PAPER_TOKENS.primary,
  },
];
