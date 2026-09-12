import { cn } from "cn";

/**
 * The one place an error is announced.
 *
 * THE REGION IS MOUNTED BEFORE THERE IS A MESSAGE, AND THAT IS THE POINT.
 *
 * A live region is announced when its CONTENTS change. A region rendered for the
 * first time together with its first message is a region the assistive technology
 * was not yet observing, so nothing is read out — which is how most `aria-live`
 * markup ends up doing nothing at all. Rendering the container unconditionally
 * and only the text conditionally is what makes it work.
 *
 * `polite`, not `assertive`. An operator typing a phone number into a field on a
 * phone should be allowed to finish the number.
 */

export interface ErrorRegionProps {
  /** The message, or `null` when there is nothing to say. */
  readonly message: string | null;
  readonly className?: string;
}

export function ErrorRegion({ message, className }: ErrorRegionProps) {
  return (
    <div
      data-slot="error-region"
      // `role="status"` rather than `role="alert"`: `alert` is implicitly
      // assertive and interrupts. The politeness is stated explicitly anyway,
      // because implicit values differ between screen readers.
      role="status"
      aria-live="polite"
      className={cn(
        // `min-h-0` and no padding while empty: an always-mounted region must not
        // leave a permanent gap in the layout it is waiting inside.
        "empty:hidden text-sm text-destructive",
        className,
      )}
    >
      {message}
    </div>
  );
}
