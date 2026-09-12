import { cn } from "cn";

/**
 * One figure and the label it belongs to.
 *
 * WHY THERE IS AN `emphasis` PROP AT ALL
 *
 * Five figures at the same size are a list, not a summary. One of them is today's
 * work — how many invitations still have to go out — and the other four are the
 * context that makes it mean something. A reference console rendered all of them
 * identically and an operator had to read five numbers to find the one they had
 * opened the page for.
 *
 * Emphasis is opt-IN. A default of "primary" would end with five emphasised
 * figures, which is the same screen with bigger type.
 *
 * WHY TABULAR NUMERALS
 *
 * These counts change while somebody is looking at them — a dispatch lands, a
 * household answers. In proportional numerals `1` is narrower than `8`, so the
 * whole figure shifts sideways when a count ticks over and the eye reads it as
 * movement rather than as a number. `tabular-nums` gives every digit the same
 * advance, so only the digit changes.
 */

/** How loudly one figure speaks. Two values, because three would be a gradient. */
export type StatEmphasis = "primary" | "secondary";

const FIGURE_FONT_SIZES: Record<StatEmphasis, string> = {
  /** The one figure that represents the work in front of the operator. */
  primary: "2rem",
  /** Everything else: context, at body-adjacent size. */
  secondary: "1.125rem",
};

/**
 * The figure's font size for a given emphasis.
 *
 * `rem`, not `px`: a reader who has raised their browser's base text size has
 * asked for larger figures too, and a pixel size refuses them.
 */
export function statFigureFontSize(emphasis: StatEmphasis): string {
  return FIGURE_FONT_SIZES[emphasis];
}

export interface StatProps {
  readonly label: string;
  /**
   * The figure, ALREADY FORMATTED.
   *
   * A string and not a number, deliberately. Every count in this console is
   * reduced and worded upstream — `lib/domain/console-list.ts` owns the
   * arithmetic and the population it was taken over — and a component that could
   * format a number would be a second place where a count gets decided.
   */
  readonly value: string;
  readonly emphasis?: StatEmphasis;
  /** The population this figure was taken over, when it is not obvious. */
  readonly hint?: string;
  readonly className?: string;
}

export function Stat({
  label,
  value,
  emphasis = "secondary",
  hint,
  className,
}: StatProps) {
  return (
    <div data-slot="stat" className={cn("min-w-0", className)}>
      <dt className="truncate text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 leading-tight",
          emphasis === "primary"
            ? "font-display text-primary"
            : "font-medium text-foreground",
        )}
        // Inline, like `Panel`'s hint cap: these two declarations are the rule
        // this component exists to enforce, and a test can read them off the
        // element instead of grepping for a class name.
        style={{
          fontSize: statFigureFontSize(emphasis),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </dd>
      {hint === undefined ? null : (
        <p className="mt-0.5 text-xs text-hint">{hint}</p>
      )}
    </div>
  );
}
