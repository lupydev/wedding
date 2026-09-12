import { Skeleton } from "@/components/ui/skeleton";
import { statBarTemplate } from "@/components/ui/stat-bar";

/**
 * The console's loading state, shaped like the console.
 *
 * WHY THIS IS A COMPONENT AND NOT A `loading.tsx`
 *
 * A `loading.tsx` at `app/console/(authenticated)/` places a Suspense boundary
 * around EVERY route in that group, including the compose and preview routes — and
 * both of those answer `notFound()` for a household the operator does not own. Once
 * a boundary exists above the throw, Next has already flushed the shell with a 200
 * and the not-found UI arrives as streamed content. An end-to-end run caught exactly
 * that: "belongs to the other operator" started answering 200 instead of 404, which
 * is the response those routes deliberately make indistinguishable from "does not
 * exist". A skeleton is not worth weakening that.
 *
 * So the boundary is explicit and local: the console root page wraps its own data
 * fetch in `<Suspense>`, and the routes that answer 404 keep no boundary above them.
 *
 * WHY NOT A SPINNER
 *
 * A spinner says something is happening and nothing about what. A skeleton in the
 * shape of the summary, the readiness panel and the first guest rows says what is
 * arriving — and, more usefully on a phone, it reserves the space so the layout does
 * not jump when the real content lands. A layout that jumps is a tap that misses.
 *
 * WHY IT CONTAINS NO COPY
 *
 * An unauthenticated request to `/console` must answer a redirect and nothing else,
 * and the standing end-to-end suite asserts that response carries none of the
 * console's headings. A skeleton made of shapes cannot leak one by accident. The
 * shapes are `aria-hidden`, with a single live status announcing the wait — eleven
 * empty boxes read aloud is worse than silence.
 */
export function ConsoleSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <p aria-live="polite" className="sr-only" role="status">
        Cargando el panel de envíos.
      </p>

      <div aria-hidden="true" className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <Skeleton className="h-6 w-44" />

          <div
            className="grid gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-4"
            data-slot="skeleton-summary"
            style={{ gridTemplateColumns: statBarTemplate() }}
          >
            {[0, 1, 2, 3, 4].map((slot) => (
              <Skeleton className="h-9" key={slot} />
            ))}
          </div>

          <div
            className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4"
            data-slot="skeleton-preflight"
          >
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-full max-w-[48ch]" />
            <Skeleton className="h-16" />
          </div>

          {/*
            Four rows, because four is what fits above the fold on the phone these
            operators dispatch from. More would be shapes nobody sees; fewer would
            leave the page growing upward as the list arrives.
          */}
          {[0, 1, 2, 3].map((slot) => (
            <div
              className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3"
              data-slot="skeleton-guest-row"
              key={slot}
            >
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
