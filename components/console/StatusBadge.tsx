import type { ConsoleTone } from "@/lib/design/console-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

/**
 * One status, wearing the only colour its tone permits.
 *
 * IT HAS NO COLOUR DECISION TO MAKE, AND THAT IS THE POINT.
 *
 * The tone arrives already decided by `lib/design/console-status.ts`, a total
 * function over the dispatch, answer and readiness unions. Every colour defect in
 * the reference console was a call site choosing for itself — four green buttons on
 * a row because "sent" felt positive to whoever wrote that row. A component that
 * cannot choose cannot choose wrong.
 *
 * The tone is also written to `data-tone`, so the mapping is visible to a test
 * without asserting on class names.
 */

const TONE_CLASSES: Record<ConsoleTone, string> = {
  /* Gold: this needs your attention. */
  attention: "border-primary/40 bg-primary/15 text-primary",
  /* Green: done. */
  done: "border-success/40 bg-success/15 text-success",
  /* Red: broken or missing. */
  broken: "border-destructive/40 bg-destructive/15 text-destructive",
  /* No signal. Most statuses are this one. */
  quiet: "border-border bg-muted text-muted-foreground",
};

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone: ConsoleTone;
  readonly className?: string;
}

export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <Badge
      className={cn("border", TONE_CLASSES[tone], className)}
      data-tone={tone}
      variant="outline"
    >
      {label}
    </Badge>
  );
}
