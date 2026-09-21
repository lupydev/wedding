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
 * `InvitationBody` is props-only because two routes render it with different
 * households. This has exactly one caller and its facts are module constants,
 * so props would be a wiring step with nothing to wire — and one more place for
 * the right value to be passed to the wrong parameter. The spec asserts against
 * the same constants, which is what keeps it honest when the couple corrects a
 * date.
 *
 * The only client boundary in the feature is `Countdown`, which owns the tick.
 * Everything here is static text and ships as HTML.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */
export function SaveTheDate() {
  return (
    <div className="flex flex-col items-center gap-6 text-center sm:gap-8">
      <h1
        className="
          font-display text-4xl leading-[1.05] text-[#f6efe2]
          [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
          sm:text-6xl
        "
      >
        {COUPLE_NAMES}
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

      <span
        aria-hidden="true"
        className="block h-px w-16 bg-[#f6efe2]/30 sm:w-24"
      />

      <Countdown />
    </div>
  );
}
