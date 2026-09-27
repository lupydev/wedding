import {
  WEDDING_DRESS_CODE,
  formatWeddingDate,
  formatWeddingTime,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";

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
const LABEL = "text-xs tracking-[0.18em] text-[#f6efe2]/75 uppercase";

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
  onReconsider,
}: {
  /** The place, from the `ceremony` row, rendered exactly as it is stored. */
  readonly venueName: string;
  readonly onReconsider: () => void;
}) {
  return (
    <div className="rsvp__confirmed flex flex-1 flex-col justify-between gap-6 text-center">
      {/*
        WHAT THE HOUSEHOLD HAS TO KNOW, DIRECTLY UNDER THE LINE THAT NAMES
        THEM. The couple's own ordering: the day, then what to wear.
      */}
      <div className="flex flex-col gap-4">
        {/*
          SAID PLAINLY, BECAUSE THE SCREEN CHANGING IS NOT A RECEIPT.

          The form's own "¡Listo! Guardamos su respuesta." used to appear under
          the controls the household had just used. They are gone now — this
          screen replaces them — so a guest who is not comfortable with phones
          would have nothing but a new heading to tell them the answer landed.

          IT IS NOT ON THE COUPLE'S LIST and it is kept anyway, which is worth
          stating so they can overrule it: a confirmation screen that never
          says anything was confirmed is the one failure on this page a guest
          cannot recover from on their own. It is one line of `text-sm`, and
          the screen has room for it.

          Unconditional, and true: this screen is reachable only from an
          acceptance the server recorded. `su` rather than a plural rule,
          because it addresses one guest and a household of five equally well.
        */}
        <p className={`rsvp__saved text-sm text-[#f6efe2]/80 ${SHADOW}`}>
          Su respuesta quedó guardada.
        </p>

        <dl className="rsvp__when m-0 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className={`${LABEL} ${SHADOW}`}>Cuándo</dt>
            {/*
              THE DAY AND THE HOUR IN ONE LINE, AND THE HOUR IS NEW HERE.

              Until this screen existed no surface had ever printed the time:
              the countdown consumed the instant and migration 0018 dropped the
              column a household would have read. `formatWeddingTime` carries
              the note about why the couple were asked to confirm it.

              NO `<time dateTime>`, deliberately, and it is the one place on
              this page where that needs saying. The announcement states the
              machine day once, from the same instant; a second `<time>` here
              would have to carry the hour too, and a `dateTime` less precise
              than the words beside it is the error on this page that cannot be
              caught by looking.
            */}
            <dd className={`${VALUE} ${SHADOW}`}>
              {formatWeddingWeekday()}, {formatWeddingDate()},{" "}
              {formatWeddingTime()}
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <dt className={`${LABEL} ${SHADOW}`}>Código de vestimenta</dt>
            <dd className={`${VALUE} ${SHADOW}`}>{WEDDING_DRESS_CODE}</dd>
          </div>
        </dl>
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
          taken off the shot. Under `Lugar` on an iPhone 14 that pixel is
          #838380 — Luis's lit trouser leg, at 78%–84% of the screen, where the
          stage's bottom scrim has barely begun. Cream on it measures 3.3:1 AT
          FULL STRENGTH, which no opacity can fix: WCAG holds body text to
          4.5:1, so the words needed something under them or a different place
          to stand.

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
            -inset-y-3 -z-10 rounded-3xl bg-[#0d1114]/60 ring-1 ring-white/10
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
          THE ANSWER IS NEVER FINAL, AND THE WAY BACK SITS BESIDE IT.

          A household that lands here has said yes — on one tap, if the
          invitation names one person. The same reasoning `CeremonyStream`
          gives for its own "Volver a responder" applies unchanged: responses
          are append-only, so a correction writes a new row and the couple
          still see that the household changed its mind.

          Quieter than the control above it, because here there is nothing to
          do. It is an escape hatch, not the point of the screen.

          THE SAME WORDS THE DECLINING SCREEN USES, and number-neutral for the
          same reason: "volver a responder" reads correctly to one guest and to
          a household of five, so the one control that appears on both endings
          does not need a plural rule of its own.
        */}
        <button
          className={`
            rsvp__reconsider self-center text-xs text-[#f6efe2] underline
            underline-offset-4 transition-colors
            duration-(--console-motion-fast)
            hover:text-[#f6efe2]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#f6efe2]
            ${SHADOW}
          `}
          onClick={onReconsider}
          type="button"
        >
          Volver a responder
        </button>
      </div>
    </div>
  );
}
