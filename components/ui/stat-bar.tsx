import type { ReactNode } from "react";

import { cn } from "cn";

/**
 * A row of figures, laid out with `grid` and deliberately not with `flex-wrap`.
 *
 * WHY THE LAYOUT MODE IS THE WHOLE POINT OF THIS FILE
 *
 * `flex-wrap` wraps the overflow onto a new line and leaves it where it fell.
 * Five figures on a narrow phone become three and then two, and those two sit
 * against the left edge with half a row of empty graphite beside them — which
 * reads as a rendering fault rather than as a layout.
 *
 * `repeat(auto-fit, minmax(88px, 1fr))` asks the grid how many 88px tracks fit
 * and then shares the remainder between them. Every row is full at every width,
 * with no breakpoints and nothing to keep in sync.
 */

/**
 * The narrowest a figure's track may get.
 *
 * 88px is a four-digit figure plus its label at the console's body size. Below
 * that the label wraps mid-word, which costs more vertical space than the extra
 * column saved.
 */
export const STAT_BAR_MIN_TRACK_PX = 88;

/** The grid template, as one string both the component and its test read. */
export function statBarTemplate(): string {
  return `repeat(auto-fit, minmax(${STAT_BAR_MIN_TRACK_PX}px, 1fr))`;
}

export interface StatBarProps {
  readonly className?: string;
  readonly children: ReactNode;
}

export function StatBar({ className, children }: StatBarProps) {
  return (
    <dl
      data-slot="stat-bar"
      className={cn("grid gap-x-4 gap-y-3", className)}
      // Inline because `statBarTemplate()` is the assertable rule. Tailwind's
      // arbitrary-value syntax would express the same thing as a class name, and
      // a class name is what a test may not assert on.
      style={{ gridTemplateColumns: statBarTemplate() }}
    >
      {children}
    </dl>
  );
}
