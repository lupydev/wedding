import { flatten, parseCssColor, type Rgba } from "./contrast";

/**
 * Reading a colour back off a rendered Tailwind class name.
 *
 * WHY A COLOUR HAS TO BE READ RATHER THAN WRITTEN DOWN. The two surfaces this
 * serves — `app/i/[slug]/gate-legibility.spec.tsx` and its sibling for the
 * accepted screen — measure whether words on a PHOTOGRAPH can be read. The
 * photograph's side of that sum is a constant, measured once off the rendered
 * page and written down with how it was taken. The component's side must not
 * be: a spec holding its own copy of `text-[#f6efe2]/60` goes on passing after
 * somebody changes the component to `/40`, which is exactly the regression it
 * exists to catch.
 *
 * WHY THIS IS A MODULE AND NOT A COPY. It was written inside the gate's spec,
 * where it was the only caller. The couple then asked the accepted screen to
 * be rebuilt, that screen needed the same measurement, and a second copy of a
 * parser is two parsers that agree until somebody fixes a bug in one of them.
 * (The same reasoning ran the other way for `readJpegSize`, which came BACK
 * into its only caller when its second one was deleted. One caller is a module
 * nobody needs; two is a module that earns itself.)
 *
 * It is not runtime code and does not pretend to be a general CSS parser: it
 * understands the notations this repository's guest-facing surfaces actually
 * write, and throws on everything else.
 */

/** The named colours these class names are allowed to use. */
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
};

/** Which Tailwind utility a colour is being read from. */
export type ColorUtility = "bg" | "text" | "border" | "ring";

function rgbaString(color: Rgba): string {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
}

/** `color` painted on top of `backdrop`, as one opaque colour the sum can take. */
export function over(color: string, backdrop: string): string {
  return rgbaString(flatten(parseCssColor(color), parseCssColor(backdrop)));
}

/**
 * The colour an element DECLARES for one utility, as an `rgba()` string.
 *
 * `bg-[#0d1114]/60`, `border-[#f6efe2]/40`, `bg-black/25`. Conditional
 * variants — `focus-visible:`, `hover:`, `lg:` — are skipped: this measures
 * the RESTING state, which is the one a guest who has not touched anything is
 * looking at, and on the phone where these pages are read.
 *
 * It throws rather than guessing, for the reason the specs above exist: a
 * silent zero here would be a confident pass for an unreadable pairing.
 */
export function declaredColor(element: Element, utility: ColorUtility): string {
  const pattern = new RegExp(
    `^${utility}-(?:\\[(#[0-9a-f]{3,8})\\]|(black|white))(?:/(\\d{1,3}))?$`,
    "i",
  );
  const found = Array.from(element.classList)
    .filter((token) => !token.includes(":"))
    .map((token) => pattern.exec(token))
    .filter((match): match is RegExpExecArray => match !== null);

  if (found.length !== 1) {
    throw new Error(
      `expected exactly one unconditional \`${utility}-\` colour on ` +
        `<${element.tagName.toLowerCase()} class="${element.className}">, ` +
        `found ${found.length}. This spec measures the colour the component ` +
        "declares, so it cannot fall back to a default.",
    );
  }

  const [, hex, name, opacity] = found[0];
  const base = hex ?? NAMED_COLORS[name.toLowerCase()];
  const { red, green, blue } = parseCssColor(base);
  const alpha = opacity === undefined ? 1 : Number(opacity) / 100;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
