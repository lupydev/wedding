import {
  COUPLE_NAMES,
  WEDDING_ISO_DAY,
  formatWeddingDate,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";

import { Countdown } from "./Countdown";

/**
 * Everything the landing page says, in one block.
 *
 * A SERVER COMPONENT THAT READS ITS FACTS RATHER THAN RECEIVING THEM.
 *
 * It read every fact from module constants and took no props, on the reasoning
 * that it had one caller and nothing to wire. It has four now — `/`, the gate,
 * the stream invitation and the invitation itself — and the last of them
 * already held the couple's names in a form an operator can CORRECT, from the
 * `ceremony` row. Rendering the constant beside that would put two couple names
 * on one page, and two different ones the first time somebody fixes a spelling.
 *
 * So the two facts that exist in an editable form are optional props, and the
 * constants remain the default: the three pages with nothing to read still read
 * nothing, and nothing is passed to the wrong parameter because there is
 * nothing to pass.
 *
 * The only client boundary in the feature is `Countdown`, which owns the tick.
 * Everything here is static text and ships as HTML.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */
export function SaveTheDate({
  coupleNames = COUPLE_NAMES,
  showDate = true,
}: {
  /**
   * Who is getting married, when a caller holds a correctable answer.
   *
   * The invitation reads the `ceremony` row; the landing and the gate have
   * only the constant, which is what this defaults to.
   */
  readonly coupleNames?: string;
  /**
   * Whether this block states the day.
   *
   * `false` for the invitation, whose details list states it immediately
   * below from the operator's own value. The line here is built from
   * `WEDDING_INSTANT`, so showing both is a duplication today and a
   * contradiction the first time the two disagree. The COUNTDOWN stays either
   * way: it runs to the instant and there is nothing else on the page that
   * says how long is left.
   */
  readonly showDate?: boolean;
} = {}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center sm:gap-8">
      {/*
        THE SCRIPT LINE MOVED IN HERE, AND IT BELONGED HERE ALL ALONG.

        It sat in `app/(public)/page.tsx`, above this component — which was
        fine while the landing was the only page that made the announcement.
        The gate now makes it too, and two halves of one block in two files is
        how they drift: a tweak to the type on one page, and the other page's
        announcement quietly stops matching.
      */}
      <p
        className="
          font-script text-3xl text-[#f6efe2]/90
          [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]
          sm:text-4xl
        "
      >
        Nos casamos
      </p>

      <h1
        className="
          font-display text-4xl leading-[1.05] text-[#f6efe2]
          [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
          sm:text-6xl
        "
      >
        {coupleNames}
      </h1>

      {/*
        The prose and the machine date in ONE element.

        A `<time>` whose `dateTime` disagrees with the words inside it is the
        single error on this page that cannot be caught by looking: the page
        reads correctly and every calendar that parses it is wrong. They are
        rendered together, from the same instant, and `SaveTheDate.spec.tsx`
        asserts both.

        THE WHOLE LINE IS UPPERCASE, AND THE WEEKDAY GETS NO SPAN OF ITS OWN.

        It had one, carrying `capitalize`, on the reasoning that Spanish does
        not capitalise weekdays and the capital belonged to CSS. Correct
        reasoning, wrong result: `text-transform` on a child OVERRIDES the
        inherited one, so the line rendered "Sábado, 28 DE NOVIEMBRE DE 2026" —
        two cases in one sentence, which reads as a mistake because it is one.
        Uppercase settles it for the whole line and the source stays correct
        Spanish prose.

        The tracking is smaller than it wants to be, and measured. At 14px with
        0.3em this line is ~366px wide; a 390px phone leaves 342px after the
        gutters, so it wrapped and left "2026" alone on the second line. 12px at
        0.18em is ~267px and fits with room to spare, and the wider setting
        comes back at the `sm` breakpoint where there is space for it.
      */}
      {showDate ? (
        <time
          dateTime={WEDDING_ISO_DAY}
          data-testid="save-the-date-when"
          className="
          text-xs tracking-[0.18em] text-[#f6efe2]/85 uppercase
          [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]
          sm:text-sm sm:tracking-[0.25em]
        "
        >
          {formatWeddingWeekday()}
          {", "}
          {formatWeddingDate()}
        </time>
      ) : null}

      <span
        aria-hidden="true"
        className="block h-px w-16 bg-[#f6efe2]/30 sm:w-24"
      />

      <Countdown />
    </div>
  );
}
