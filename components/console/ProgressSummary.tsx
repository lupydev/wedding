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
 */

export interface ProgressSummaryProps {
  readonly heading: string;
  readonly metrics: readonly ScopedMetric[];
}

export function ProgressSummary({ heading, metrics }: ProgressSummaryProps) {
  return (
    <section className="progress-summary">
      <h3>{heading}</h3>
      <ul>
        {metrics.map((metric) => (
          <li key={metric.key}>{metric.text}</li>
        ))}
      </ul>
    </section>
  );
}
