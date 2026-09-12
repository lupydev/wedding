import { statBarTemplate } from "@/components/ui/stat-bar";
import type { ScopedMetric } from "@/lib/domain/console-list";

/**
 * The progress figures — presentational, props only.
 *
 * It renders `metric.text` verbatim and has no way to render a number on its
 * own. That is the design, not laziness: the whole defect this guards against
 * is a headline like "42 confirmadas" whose population nobody can see. A
 * component that could render `metric.count` by itself would let that defect
 * back in one render at a time.
 *
 * The arithmetic lives in `scopedMetrics`, so what is shown here and what is
 * asserted in `lib/domain/console-list.spec.ts` are the same sentences.
 *
 * WHY THIS REUSES `statBarTemplate()` INSTEAD OF THE `StatBar` PRIMITIVE
 *
 * `StatBar`/`Stat` are a `dl`/`dt`/`dd` triple, which needs the figure and its label
 * as two separate values. This component renders one whole SENTENCE per metric,
 * deliberately — a figure with no population beside it is the defect the sentence
 * exists to prevent — and the standing end-to-end suite walks
 * `section.progress-summary li` to assert every line names its population. So the
 * list keeps its shape and borrows the primitive's LAYOUT RULE, which is the part
 * worth sharing: `repeat(auto-fit, minmax(88px, 1fr))` rather than `flex-wrap`,
 * which strands the last figure alone with a hole beside it.
 *
 * `tabular-nums` for the same reason `Stat` uses it: these counts change while an
 * operator watches, and proportional digits make a changing number look like it is
 * moving rather than counting.
 */

export interface ProgressSummaryProps {
  readonly heading: string;
  readonly metrics: readonly ScopedMetric[];
}

export function ProgressSummary({ heading, metrics }: ProgressSummaryProps) {
  return (
    <section className="progress-summary rounded-lg border border-border bg-card px-4 py-4">
      <h3 className="text-base leading-snug">{heading}</h3>

      <ul
        className="mt-3 grid gap-x-4 gap-y-2"
        style={{
          gridTemplateColumns: statBarTemplate(),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {metrics.map((metric) => (
          <li
            className="min-w-0 rounded-md bg-muted px-2.5 py-2 text-sm text-foreground"
            key={metric.key}
          >
            {metric.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
