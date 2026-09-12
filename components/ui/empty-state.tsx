import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * TWO empty states, because they are two different problems.
 *
 * "There is nothing here yet" is frequently the correct state of a console before
 * an import runs, and its exit is elsewhere in the product. "Nothing matches what
 * you asked for" is a state the operator created one tap ago, and its exit is
 * undoing that tap.
 *
 * A single shared component with softer copy cannot serve both: an operator who
 * reads "no hay invitaciones" on a filtered list concludes the data is gone, and
 * the only thing that corrects that conclusion is keeping the filter on screen
 * next to a control that removes it.
 */

export interface EmptyStateProps {
  readonly title: string;
  readonly body: string;
  /** An exit, when the product has one to offer. Often there is none. */
  readonly action?: ReactNode;
  readonly className?: string;
}

/** Nothing exists yet. Not a failure, and not announced as one. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center",
        className,
      )}
    >
      <p className="font-display text-base text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted-foreground">
        {body}
      </p>
      {action === undefined ? null : <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface NoMatchesStateProps {
  /** The filter that is hiding the data, in the operator's own words. */
  readonly filterSummary: string;
  readonly clearLabel: string;
  readonly onClear: () => void;
  readonly className?: string;
}

/**
 * The data exists; this view is hiding it.
 *
 * The filter stays on screen because it is the cause, and the control that
 * removes it is the whole remedy — not a link to somewhere else.
 */
export function NoMatchesState({
  filterSummary,
  clearLabel,
  onClear,
  className,
}: NoMatchesStateProps) {
  return (
    <div
      data-slot="no-matches-state"
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center",
        className,
      )}
    >
      <p className="font-display text-base text-foreground">
        Ningún resultado coincide con el filtro
      </p>
      <p className="mx-auto mt-2 max-w-[48ch] text-sm text-muted-foreground">
        Filtro activo: {filterSummary}. Los datos siguen ahí; esta vista los
        está ocultando.
      </p>
      <Button
        className="mt-4"
        onClick={onClear}
        type="button"
        variant="outline"
      >
        {clearLabel}
      </Button>
    </div>
  );
}
