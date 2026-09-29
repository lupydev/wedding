import {
  COUPLE_NAMES,
  WEDDING_ISO_DAY,
  formatWeddingDate,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";

import { Countdown } from "./Countdown";

/**
 * THE QUIET LINE OF THIS ANNOUNCEMENT, EXPORTED BECAUSE A SECOND SCREEN
 * SPEAKS IT NOW.
 *
 * The date line's setting: spaced small caps, the shadow every line on bare
 * photograph carries, and a tracking that widens at `sm`. The couple looked
 * at the accepted screen beside the other three and said it "se ve muy
 * diferente a las demás y se ve un poco fea" — and the cause was not the
 * facts on it but their FORM: label over value, twice, which reads as a spec
 * sheet where every other screen reads as an invitation.
 *
 * So `RsvpConfirmed` says the day, the hour and the dress code in this
 * setting instead. Exported rather than copied for the reason everything
 * shared here is: two copies of a type scale drift the first time one page's
 * type is tuned, and the whole complaint was that two pages did not match.
 *
 * The tracking is measured rather than chosen — see the note on the `<time>`
 * below, which is why it is 0.18em on a phone and 0.25em above it.
 *
 * AND IT IS FULL CREAM, WHERE IT WAS `/85`. The accepted screen says these
 * words lower down the photograph than the landing does, and lower again
 * once the RSVP closes and a note pushes them: measured at
 * `app/i/[slug]/closed-legibility.spec.tsx`'s position, `/85` is 4.23:1 —
 * under the floor. Full cream is 5.13:1 there and better everywhere else,
 * and the difference between 85% and 100% of this cream at 12px is not a
 * difference anybody sees.
 */
export const ANNOUNCEMENT_LINE = `
  text-xs tracking-[0.18em] text-[#f6efe2] uppercase
  [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]
  sm:text-sm sm:tracking-[0.25em]
`;

/**
 * And the hairline that closes it, before the countdown.
 *
 * IT IS PART OF THE COUNTDOWN'S OWN FURNITURE, which is why `showCountdown`
 * takes both away together rather than leaving a divider with nothing under
 * it to divide.
 */
export const ANNOUNCEMENT_RULE = "block h-px w-16 bg-[#f6efe2]/30 sm:w-24";

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
  showCountdown = true,
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
  /**
   * Whether this block ends with the counter and the hairline above it.
   *
   * THE ONE SCREEN THAT SAYS NO, AND THE MEASUREMENT BEHIND IT. The couple
   * opened the list of who is coming on a real iPhone with a three-person
   * invitation and found `Enviar respuesta` behind the browser chrome.
   * Measured on the shipped build, iPhone 14: that screen is 735 pixels on a
   * 664-pixel viewport, and this counter with its gap is 74 of them, the
   * hairline with its gap another 25. Dropping both brings it to 664 with 27
   * pixels to spare; dropping the counter alone would clear by four, which is
   * not a margin on a physical phone.
   *
   * "Sacalos solo cuando la invitación es de 3 personas, porque con dos
   * personas sí se ve bien" — so this is false on ONE screen of the
   * invitation, for households of three or more, and true everywhere else.
   * `InvitationAnnouncement` holds the threshold; this component only does as
   * it is told.
   *
   * BOTH ELEMENTS, ONE PROP. The rule exists to close the date line and
   * introduce the counter, so with no counter it separates something from
   * nothing. There is no state of this block in which one is wanted without
   * the other, and a second prop would only make that state expressible.
   */
  readonly showCountdown?: boolean;
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
          className={ANNOUNCEMENT_LINE}
        >
          {formatWeddingWeekday()}
          {", "}
          {formatWeddingDate()}
        </time>
      ) : null}

      {/*
        THE RULE AND THE COUNTER, WHICH ONE SCREEN OF THE INVITATION DOES
        WITHOUT.

        Rendered as a pair under one condition rather than as two siblings
        under two, because they are one piece of furniture: the hairline
        introduces the counter and has nothing to close without it. See
        `showCountdown` above for the measurement that took them off the list
        of who is coming, and for the reason that screen is the only one.
      */}
      {showCountdown ? (
        <>
          <span aria-hidden="true" className={ANNOUNCEMENT_RULE} />

          <Countdown />
        </>
      ) : null}
    </div>
  );
}
