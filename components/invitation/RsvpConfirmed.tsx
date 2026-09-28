import {
  WEDDING_DRESS_CODE,
  formatWeddingDate,
  formatWeddingTime,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";

import type { CalendarEvent } from "@/lib/domain/calendar-event";

import { Countdown } from "@/components/landing/Countdown";
import {
  ANNOUNCEMENT_LINE,
  ANNOUNCEMENT_RULE,
} from "@/components/landing/SaveTheDate";

import { CalendarActions } from "./CalendarActions";
import { VenueMap } from "./VenueMap";

/**
 * The last screen: when to be there, what to wear, and where to go.
 *
 * IT IS A SCREEN OF ITS OWN BECAUSE OF WHAT IT COST AS PART OF THE FORM.
 *
 * The venue used to open INSIDE the form the moment a household chose "yes",
 * above the checkboxes they still had to tick. Three things were wrong with
 * that and only the third was ever noticed. It told people where to go before
 * they had said they were coming. It pushed the submit button 322 pixels down
 * the page, which is why `RsvpAnswer` grew a `scrollIntoView` call — "se abre
 * y se pierde la información, toca hacer un scroll", in the couple's words.
 * And it made the accepted invitation two and a half viewports tall on an
 * iPhone, against the landing page's one.
 *
 * Answering is a question; this is the answer. Separating them gives the
 * directions the whole screen they need and leaves the question with nothing
 * on it but the question.
 *
 * THE ORDER IS THE COUPLE'S, READ OFF THEIR OWN SENTENCE. "Te esperamos,
 * nombre de la invitación, seguido la fecha y el código de vestimenta y en la
 * parte de abajo de la pantalla lugar y solamente el botón de cómo llegar." So
 * the screen is two groups pushed apart rather than one stack pushed down:
 * what a household has to KNOW is at the top, under the line that names them,
 * and what they have to DO is at the foot of the screen under their thumb.
 *
 * `justify-between` RATHER THAN `justify-end`, AND THE SPACE BETWEEN THEM IS
 * THE POINT. The map that used to sit in the middle of this screen was 188
 * pixels of picture; the couple asked for it to go, and the room it leaves is
 * spent on air rather than on another block. It is also the safest place for
 * it: `PhotoStage`'s two scrims fade towards each other around 55%–62% of the
 * screen, which is the brightest ground on the page and now the part of it
 * with no words on it at all.
 *
 * THE HEADING IS NOT HERE. "Te esperamos, <name>" is the top line of the
 * screen — the place every other screen greets the household in — so it is
 * painted by `InvitationGreeting` above this block, from `RsvpAnswer`, which
 * is the only thing that knows this screen is showing. A second heading here
 * would say the same thing twice.
 *
 * WHAT IS DELIBERATELY NOT HERE EITHER. `Dirección`: the venue has no street
 * address — `VenueMap` opens with that fact and the whole component exists
 * because of it — so the row's `venue_address` was a second answer to the
 * question the link already answers, and the one a guest cannot act on. In
 * production it still holds its seeded placeholder, so what it actually put on
 * this screen was a pair of braces.
 *
 * Props-only and synchronous. It takes the venue's NAME and nothing else from
 * the row, so there is no field on it through which anything else could leak.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/**
 * The small, quiet labels the invitation uses for a stated fact.
 *
 * `/75` RATHER THAN THE `/60` THIS SHIPPED AT, and the number is measured
 * rather than felt. These words sit on the photograph with no card under them.
 * At 60% the label of the venue came back at 3.0:1 against the brightest pixel
 * behind it on a Pixel 7 — under the 4.5:1 WCAG holds body text to, and the
 * same failure `app/i/[slug]/gate-legibility.spec.tsx` exists because of.
 * `app/i/[slug]/confirm-legibility.spec.tsx` measures this screen the same
 * way, so the figure is a floor rather than a preference.
 */
/*
  `/85` RATHER THAN THE `/75` THIS SHIPPED WITH, AND IT IS A MEASUREMENT.

  These three words — CUÁNDO, CÓDIGO DE VESTIMENTA, LUGAR — were measured on
  the screen a household reaches by accepting, where they sit high on the
  photograph and `/75` was comfortable. The same component is what a household
  that accepted sees AFTER the deadline too, and there it sits one line lower:
  `app/i/[slug]/closed-legibility.spec.tsx` found the day's label at 4.10:1 on
  #5C5E47, under the floor.

  Lifting the shared value rather than giving the closed screen its own copy,
  because a second `RsvpConfirmed` is two weddings waiting to disagree about
  an hour. It is 4.75:1 there now and better than it was on the open screen,
  where nothing about it got worse.
*/
const LABEL = "text-xs tracking-[0.18em] text-[#f6efe2]/85 uppercase";

const VALUE = "m-0 text-sm text-[#f6efe2] sm:text-base";

/**
 * The shadow every line on this screen carries, and what it is NOT for.
 *
 * It is the one the landing's own blocks use — `SaveTheDate`, `StreamLink`,
 * the greeting above this screen — and it does real work on a photograph. It
 * is deliberately not counted in any of the ratios `confirm-legibility` takes:
 * WCAG has no term for a text shadow, and a floor that credits an
 * unmeasurable is not a floor. The opacities above clear 4.5:1 without it.
 */
const SHADOW = "[text-shadow:0_1px_12px_rgba(0,0,0,0.6)]";

export function RsvpConfirmed({
  venueName,
  calendar,
  countdown = true,
}: {
  /** The place, from the `ceremony` row, rendered exactly as it is stored. */
  readonly venueName: string;
  /**
   * The two ways to keep the date, for the one household allowed the venue.
   *
   * The event is built by the caller rather than here, because the caller is
   * the only one that knows it may carry a location: `buildCeremonyCalendarEvent`
   * is reachable from an accepted household's screen and from nowhere else.
   * Optional, so the operator preview and any future caller that has no
   * invitation behind it can render this screen without inventing one.
   */
  readonly calendar?: { readonly event: CalendarEvent };
  /**
   * Whether this screen counts down, which is true everywhere but one.
   *
   * The couple asked for the counter here — "importante que en la ultima
   * pagina de afirmacion tambien tenga la cuenta regresiva" — and it is on
   * by default for exactly that reason.
   *
   * THE CLOSED SCREEN TURNS IT OFF, AND THE REASON IS A MEASUREMENT RATHER
   * THAN AN OPINION. `RsvpClosed` renders this same component under a line
   * saying the answers are closed, which pushes the whole block down into
   * the gap between `PhotoStage`'s two scrims: the counter's own box sits on
   * #A6A57D there, where its figures measure **2.2:1** at full cream. There
   * is no opacity that fixes that — the fix is a ground the counter does not
   * have on any screen — so on the one screen where it is unreadable it is
   * not shown, and the day and the hour are stated immediately above it
   * either way. The feature document carries the defect; when the counter
   * gets a ground this flag goes.
   */
  readonly countdown?: boolean;
}) {
  return (
    <div className="rsvp__confirmed flex flex-1 flex-col justify-between gap-6 text-center">
      {/*
        WHAT THE HOUSEHOLD HAS TO KNOW, DIRECTLY UNDER THE LINE THAT NAMES
        THEM. The couple's own ordering: the day, then what to wear.
      */}
      <div className="flex flex-col gap-4">
        {/*
          "Su respuesta quedó guardada." STOOD HERE AND THE COUPLE REMOVED IT.

          U36 kept it against their list and said so in as many words, so that
          they could overrule it; they have. The argument for it was that a
          guest who is not comfortable with phones would otherwise have only a
          new screen to tell them the answer landed. What they are left with
          is the line above — "Los esperamos, Familia Aguirre" — which says
          the couple are expecting them, and the day, the dress code and the
          way to the venue underneath it. That IS the receipt; it just does
          not use the word.

          The refusal path is untouched: `RsvpAnswer`'s alert region still
          carries a submission that failed, on the screen the household is
          standing on. Nothing here was the only report of an error.
        */}

        {/*
          THE DAY, THE HOUR AND THE DRESS CODE, IN THE VOICE THE OTHER THREE
          SCREENS USE.

          THIS WAS A SPEC SHEET AND THE COUPLE SAID SO: "importante que en la
          ultima pagina de afirmacion tambien tenga la cuenta regresiva,
          siento que esa pagina se ve muy diferente a las demas y se ve un
          poco fea."

          They are right about the cause, and it was not the countdown's
          absence alone. This block was a `dl` of label-over-value pairs —
          CUÁNDO over the date, CÓDIGO DE VESTIMENTA over the value — while
          the gate, the question and the list of who is coming all open with
          `SaveTheDate`: a script line, the couple's names, one quiet line of
          spaced caps, a hairline and the counter. Same facts, different
          voice. Adding a countdown under a spec sheet would have left a spec
          sheet with a countdown under it.

          So the pairs are gone and the facts are said in the announcement's
          own line — `ANNOUNCEMENT_LINE`, imported rather than copied, so
          tuning that type on the landing tunes it here too. The hairline and
          the counter close the block exactly as they close the other three.

          EVERY FACT THE COUPLE ASKED FOR IS STILL HERE. The day, the hour and
          the dress code are the three they named; what went is two label
          lines that repeated in small caps what the values say plainly.

          NO `<time dateTime>`, STILL, and the reason is unchanged by the
          restyling: the announcement states the machine day once, from the
          same instant, and a `dateTime` here would have to carry the hour too
          — a machine date less precise than the words beside it is the one
          error on this page that cannot be caught by looking.
        */}
        <div className="rsvp__when flex flex-col items-center gap-3 sm:gap-4">
          <p className={`${ANNOUNCEMENT_LINE} ${SHADOW}`}>
            {formatWeddingWeekday()}, {formatWeddingDate()}
          </p>

          <p className={`${ANNOUNCEMENT_LINE} ${SHADOW}`}>
            {formatWeddingTime()} · {WEDDING_DRESS_CODE}
          </p>

          {countdown ? (
            <span aria-hidden="true" className={ANNOUNCEMENT_RULE} />
          ) : null}

          {/*
            THE COUNTDOWN THE COUPLE ASKED FOR, AND IT IS THE SAME ONE.

            `Countdown` is the landing's own client component — the only
            client boundary in that feature — so this screen counts to the
            same instant with the same ticking, rather than to a second
            reading of the same date.
          */}
          {countdown ? <Countdown /> : null}
        </div>
      </div>

      {/*
        AND WHAT THEY HAVE TO DO, AT THE FOOT OF THE SCREEN.

        "En la parte de abajo de la pantalla lugar y solamente el botón de cómo
        llegar." The place is named above the control that goes there, because
        "Villa Campestre" is what a guest repeats to a driver and the button is
        what they press when they are already on their way.
      */}
      <div className="rsvp__foot relative isolate flex flex-col gap-4">
        {/*
          THE GROUND THE FOOT OF THIS SCREEN STANDS ON, AND THE MEASUREMENT
          THAT PUT IT THERE.

          Measured the way `app/i/[slug]/gate-legibility.spec.tsx` measures the
          gate: the screen rendered at both phone presets with every glyph made
          transparent, and the brightest pixel inside each element's own box
          taken off the shot. Under `Lugar` on an iPhone 14 that pixel was
          #838380 — Luis's lit trouser leg, at 78%–84% of the screen, where the
          stage's bottom scrim has barely begun. Cream on it measures 3.3:1 AT
          FULL STRENGTH, which no opacity can fix: WCAG holds body text to
          4.5:1, so the words needed something under them or a different place
          to stand.

          THE GROUP HAS SINCE DROPPED THREE PERCENT, because the couple
          removed the "Volver a responder" that stood under it, and the pixel
          inside its box with it — #535453 now. That does NOT retire this
          ground, and the spec says why at length: where this group sits
          depends on how many lines the venue's name takes, the couple have
          not filled that field in yet, and one line more puts `Lugar` back
          on the trouser leg. The floor is measured across the bottom quarter
          of the screen rather than against today's box.

          THIS IS A CONSEQUENCE OF THE MAP LEAVING, and worth saying plainly.
          The venue used to sit above 188 pixels of picture in a
          bottom-justified stack, higher up the screen and over darker ground.
          Pushing it to the foot is what the couple asked for and is better for
          a thumb; it also moved it onto the brightest thing down there.

          THE TOP GROUP HAS NO SUCH GROUND, and that is measured too rather
          than assumed: the brightest pixel under any of it is #66684c, which
          full cream clears at 5.0:1. A card there would dim the couple on the
          one screen that is otherwise just them and four short lines, for no
          reader's benefit. `confirm-legibility.spec.tsx` holds both halves of
          that claim.

          PAINTED, NOT LAID OUT. Absolutely positioned with negative insets and
          `-z-10`, so it costs no height on a screen whose whole promise is
          that it is exactly one viewport tall. `isolate` is load-bearing and
          its absence is silent: without a stacking context of its own a
          `-z-10` ground paints below every positioned element in the page,
          including the photograph, and the screen renders exactly as it did
          before with no error anywhere.

          `/60` RATHER THAN THE GATE'S `/70`, because it has less work to do:
          the gate's panel lands at 60%–72%, in the gap where neither of
          `PhotoStage`'s scrims is carrying anything, and this sits low enough
          that the bottom one already is. At `/60` the label reads 6.1:1 and
          the venue's own name 9.3:1.

          AND IT LETS GO AT `lg`, where the words are in their own column
          beside a framed print and the ground would be a dark card floating on
          a dark page — the same reason `PhotoStage` drops its scrims there.
        */}
        <div
          aria-hidden="true"
          className="
            rsvp__foot-ground pointer-events-none absolute -inset-x-4
            -inset-y-3 -z-10 rounded-3xl bg-[#0d1114]/75 ring-1 ring-white/10
            shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm
            lg:hidden
          "
        />

        {/*
          A `dl` with one row rather than a bare line: "Lugar" is not
          self-evident from the shape of a venue's name, and a guest scanning
          for where to go needs the word as much as the value. The class is the
          one the browser suite already points at.
        */}
        <dl className="rsvp__venue m-0 flex flex-col gap-0.5">
          <dt className={`${LABEL} ${SHADOW}`}>Lugar</dt>
          <dd className={`${VALUE} ${SHADOW}`}>{venueName}</dd>
        </dl>

        {/*
          THE WAY THERE, WHICH IS THE ONLY DIRECTIONS THERE ACTUALLY ARE.

          INSIDE THIS SCREEN, WHICH IS THE WHOLE OF ITS ACCESS CONTROL. The
          venue is told only to a household that has said it is coming, and
          this screen is reachable only from a recorded acceptance. It is easy
          to get wrong in a way nothing notices, which is why
          `RsvpAnswer.spec.tsx` asserts the link's ABSENCE in every state a
          household can reach without accepting.
        */}
        <VenueMap />

        {/*
          AND THE TWO WAYS TO KEEP THE DATE, UNDER THE WAY TO GET THERE.

          The couple asked for both on this screen: the Google entry, which
          carries the name, the day, the hour, the joining link and — only
          here — the venue's location, and the `.ics`, which is the only one
          of the two that can carry an alarm.

          THE LOCATION IS THE REASON THIS BLOCK IS NOT THE STREAM'S. The
          entry offered on the declined and stream screens has no venue in it
          at all: a calendar file is forwarded exactly like a link, so an
          address in a declining household's entry would travel further than
          anything the page shows them. `CalendarActions` takes the event
          rather than building it, so the difference is visible at the call
          site instead of hidden in a flag.
        */}
        {calendar === undefined ? null : (
          <CalendarActions event={calendar.event} />
        )}

        {/*
          A "Volver a responder" STOOD HERE AND THE COUPLE REMOVED IT.

          THIS IS THE ONE DELETION ON THE LIST WITH A CONSEQUENCE BEYOND THE
          SCREEN, AND IT WAS STATED TO THEM BEFORE IT WAS MADE. An accepted
          answer can no longer be changed from inside the invitation at all.
          Responses are still append-only and the console still records
          whatever is stored, but a household that taps yes and then finds
          somebody cannot come has nothing on this page to press: they are
          back to the WhatsApp thread the invitation arrived in.

          It is not a general removal. `CeremonyStream` — the screen a
          declining household lands on — keeps its own `Volver a responder`,
          for the reason it always had: a decline auto-submits on the first
          tap, so a mis-tap is recorded instantly and the way back sits beside
          the consequence. An acceptance passes through a send button, which
          is the check this ending has and that one does not.
        */}
      </div>
    </div>
  );
}
