import type { ReactNode } from "react";

import { cn } from "cn";

/**
 * A titled panel, and the title is NOT optional.
 *
 * WHY A REQUIRED PROP RATHER THAN A CONVENTION
 *
 * A reference console shipped boxes whose purpose could only be worked out by
 * using them. This console is operated by exactly two people, twice in their
 * lives — once as a rehearsal and once on the night — and neither of them will
 * remember what an unlabelled box does the second time. A convention would be
 * followed until the screen somebody built in a hurry; a required prop is
 * followed by the type checker.
 *
 * WHY THE HINT HAS A MEASURE CAP
 *
 * A hint that runs the full width of a desktop panel is a paragraph, and a
 * paragraph nobody asked for is a paragraph nobody reads. 48ch is about a line
 * and a half of body text — long enough for one real sentence, short enough that
 * writing two feels wrong.
 */

/** Roughly how many characters of body text a hint may run to per line. */
export const PANEL_HINT_MAX_CH = 48;

/**
 * The hint's measure cap, as an inline style.
 *
 * Inline rather than a utility class ON PURPOSE: this is the one rule about the
 * hint that is worth asserting, and `element.style.maxWidth` is a value a test
 * can read while a class name is an implementation detail a refactor renames.
 *
 * `ch` and not `px`: `48ch` means "about 48 characters of THIS typeface at THIS
 * size", which is the thing being limited. A pixel cap is 48 characters at one
 * size and 30 at another.
 */
export function panelHintStyle(): { readonly maxWidth: string } {
  return { maxWidth: `${PANEL_HINT_MAX_CH}ch` };
}

/** Which heading level this panel's title occupies in the page outline. */
export type PanelHeadingLevel = 2 | 3 | 4;

export interface PanelProps {
  /** REQUIRED. A panel with nothing to say about itself must not compile. */
  readonly title: string;
  /** One line, at most, explaining what this panel is for. */
  readonly hint?: string;
  /**
   * Where the title sits in the page outline.
   *
   * The console's pages already own `h1` and `h2`, so a panel that always
   * rendered `h2` would produce an outline with two competing second levels.
   */
  readonly headingLevel?: PanelHeadingLevel;
  /** Rendered on the same line as the title: one action, or none. */
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Panel({
  title,
  hint,
  headingLevel = 2,
  action,
  className,
  children,
}: PanelProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <section
      data-slot="panel"
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="text-base leading-snug font-normal">
            {title}
          </Heading>

          {hint === undefined ? null : (
            <p
              data-slot="panel-hint"
              className="mt-1 text-sm text-hint"
              style={panelHintStyle()}
            >
              {hint}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}
