import { StatBar } from "@/components/ui/stat-bar";
import type { ConsoleSummary } from "@/lib/domain/console-list";

/**
 * The four numbers the couple run the wedding on.
 *
 * WHAT THIS REPLACED, AND WHY FOUR RATHER THAN TWENTY.
 *
 * The console home rendered two `ProgressSummary` blocks of ten sentences each.
 * The two scopes overlapped — one operator's households, then every household
 * including those — so "Confirmadas" appeared twice on one screen with
 * different denominators, and eight of the ten lines were dispatch-state and
 * RSVP breakdowns that a two-person team reads once and never again.
 *
 * TWO FIGURES, AND THERE WERE FOUR.
 *
 * The couple asked for "invitaciones enviadas y asistentes" and got two extra
 * tiles nobody requested — "Sin enviar" and "Sin responder" — and those two are
 * what made the row unreadable. Beside "Invitaciones enviadas: 0 de 3" sat "Sin
 * enviar: 2 de 3", and a reader is entitled to ask where the third went. The
 * answer is that its link was opened but nobody confirmed the send, so it
 * counts as neither — true, documented, and no business being a puzzle on the
 * first screen of a console two people share.
 *
 * NOT ONE NEW QUERY OR ONE NEW SUM. Every field comes from
 * `summarizeConsoleList`, which already computed all of it —
 * `operatorAssertedSends` had been computed and thrown away since the day it
 * was written.
 *
 * Props-only and synchronous: it performs no data access, so it is directly
 * unit-testable, unlike the async page that feeds it.
 *
 * Operator-facing copy is Spanish. Identifiers and comments stay English.
 */

interface Tile {
  readonly label: string;
  readonly count: number;
  readonly outOf: number;
}

export function ConsoleDashboard({
  summary,
}: {
  readonly summary: ConsoleSummary;
}) {
  const tiles: readonly Tile[] = [
    {
      label: "Invitaciones enviadas",
      /*
       * `operatorAssertedSends`, NOT the sum of every dispatch event.
       *
       * It counts `marked_sent` and `resent` and deliberately excludes
       * `link_opened`, because the app cannot observe a send — an opened link
       * is a click on WhatsApp, not a message that left. `dispatch-state.ts`
       * calls this "the ONLY predicate a 'has been invited' filter may use",
       * and a tile that ignored it would tell the couple that families were
       * invited who never were.
       */
      count: summary.operatorAssertedSends,
      outOf: summary.total,
    },
    {
      label: "Personas confirmadas",
      /*
       * People, not households, and it is a true headcount rather than an
       * allowance: migration 0007 enforces
       * `seats_confirmed = cardinality(attendee_guest_ids)` in the database
       * itself, so this figure cannot drift away from the names behind it.
       */
      count: summary.seatsConfirmed,
      outOf: summary.seats,
    },
  ];

  return (
    <StatBar className="rounded-lg border border-border bg-card px-4 py-4">
      {tiles.map((tile) => (
        /*
         * A `div` wrapping each pair, which is valid inside a `dl` and is what
         * keeps a label glued to its own figure when the grid wraps. Without
         * it the terms and definitions are siblings in one grid and a narrow
         * screen can lay a label above somebody else's number.
         */
        <div className="min-w-0" key={tile.label}>
          <dt className="text-xs text-muted-foreground">{tile.label}</dt>

          {/*
            NO FIGURE WITHOUT ITS POPULATION — this console's oldest rule, and
            the reason `ProgressSummary` rendered whole sentences and refused to
            render a bare count. The defect it guarded against was a headline
            reading "42 confirmadas" out of a population nobody could see. A
            tile is a smaller shape, so the population rides in the figure
            itself: "17 de 30", never "17".

            `tabular-nums` because these change while an operator watches, and
            proportional digits make a changing number look like it is moving
            rather than counting.
          */}
          <dd className="mt-0.5 text-xl leading-tight font-semibold tabular-nums">
            {tile.count} de {tile.outOf}
          </dd>
        </div>
      ))}
    </StatBar>
  );
}
