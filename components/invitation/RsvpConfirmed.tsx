import {
  WEDDING_DRESS_CODE,
  formatWeddingDate,
  formatWeddingTime,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";
import { rsvpConfirmedHeading } from "@/lib/domain/rsvp-copy";

import { VenueMap } from "./VenueMap";

/**
 * The last screen: where to go, when, and what to wear.
 *
 * IT IS A SCREEN OF ITS OWN BECAUSE OF WHAT IT COST AS PART OF THE FORM.
 *
 * The venue and the map used to open INSIDE the form the moment a household
 * chose "yes", above the checkboxes they still had to tick. Three things were
 * wrong with that and only the third was ever noticed. It told people where to
 * go before they had said they were coming. It pushed the submit button 322
 * pixels down the page, which is why `RsvpAnswer` grew a `scrollIntoView` call
 * — "se abre y se pierde la información, toca hacer un scroll", in the couple's
 * words. And it made the accepted invitation two and a half viewports tall on
 * an iPhone, against the landing page's one.
 *
 * Answering is a question; this is the answer. Separating them gives the
 * directions the whole screen they need and leaves the question with nothing on
 * it but the question.
 *
 * WHAT IS HERE AND WHAT IS DELIBERATELY NOT.
 *
 * The couple named the contents: the place, the map, the day AND the hour, and
 * the dress code. `Dirección` is not among them and is gone. The venue has no
 * street address — `VenueMap` opens with that fact and the whole component
 * exists because of it — so the row's `venue_address` was a second answer to
 * the question the map already answers, and the one a guest cannot act on. In
 * production it still holds its seeded placeholder, so what it actually put on
 * this screen was a pair of braces.
 *
 * Props-only and synchronous. It takes the venue's NAME and nothing else from
 * the row, so there is no field on it through which anything else could leak.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/** The small, quiet labels the invitation uses for a stated fact. */
const LABEL = "text-xs tracking-[0.18em] text-[#f6efe2]/60 uppercase";

const VALUE = "m-0 text-sm text-[#f6efe2] sm:text-base";

export function RsvpConfirmed({
  venueName,
  memberCount,
  onReconsider,
}: {
  /** The place, from the `ceremony` row, rendered exactly as it is stored. */
  readonly venueName: string;
  /** How many people this invitation names, which decides the number. */
  readonly memberCount: number;
  readonly onReconsider: () => void;
}) {
  return (
    <div className="rsvp__confirmed flex flex-1 flex-col justify-end gap-4 text-center">
      <h2 className="font-display text-xl text-[#f6efe2] sm:text-2xl">
        {rsvpConfirmedHeading(memberCount)}
      </h2>

      {/*
        SAID PLAINLY, BECAUSE THE SCREEN CHANGING IS NOT A RECEIPT.

        The form's own "¡Listo! Guardamos su respuesta." used to appear under
        the controls the household had just used. They are gone now — this
        screen replaces them — so a guest who is not comfortable with phones
        would have nothing but a new heading to tell them the answer landed.

        Unconditional, and true: this screen is reachable only from an
        acceptance the server recorded. `su` rather than a plural rule, because
        it addresses one guest and a household of five equally well.
      */}
      <p className="rsvp__saved text-sm text-[#f6efe2]/75">
        Su respuesta quedó guardada.
      </p>

      {/*
        THE PLACE, NAMED ABOVE THE PICTURE OF IT.

        A `dl` with one row rather than a bare line: "Lugar" is not
        self-evident from the shape of a venue's name, and a guest scanning for
        where to go needs the word as much as the value. The class is the one
        the browser suite already points at.
      */}
      <dl className="rsvp__venue m-0 flex flex-col gap-0.5">
        <dt className={LABEL}>Lugar</dt>
        <dd className={VALUE}>{venueName}</dd>
      </dl>

      {/*
        AND THE MAP, WHICH IS THE ONLY DIRECTIONS THERE ACTUALLY ARE.

        INSIDE THIS SCREEN, WHICH IS THE WHOLE OF ITS ACCESS CONTROL. The venue
        is told only to a household that has said it is coming, and this screen
        is reachable only from a recorded acceptance. It is easy to get wrong in
        a way nothing notices — the map is an image and a link, so every
        assertion about the venue that reads TEXT would stay green while a map
        rendered outside this branch leaked the location to everybody.
        `RsvpAnswer.spec.tsx` therefore asserts its ABSENCE in every state a
        household can reach without accepting.
      */}
      <VenueMap />

      <dl className="rsvp__when m-0 flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <dt className={LABEL}>Cuándo</dt>
          {/*
            THE DAY AND THE HOUR IN ONE LINE, AND THE HOUR IS NEW HERE.

            Until this screen existed no surface had ever printed the time: the
            countdown consumed the instant and migration 0018 dropped the
            column a household would have read. `formatWeddingTime` carries the
            note about why the couple were asked to confirm it.

            NO `<time dateTime>`, deliberately, and it is the one place on this
            page where that needs saying. The announcement states the machine
            day once, from the same instant; a second `<time>` here would have
            to carry the hour too, and a `dateTime` less precise than the words
            beside it is the error on this page that cannot be caught by
            looking.
          */}
          <dd className={VALUE}>
            {formatWeddingWeekday()}, {formatWeddingDate()},{" "}
            {formatWeddingTime()}
          </dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className={LABEL}>Código de vestimenta</dt>
          <dd className={VALUE}>{WEDDING_DRESS_CODE}</dd>
        </div>
      </dl>

      {/*
        THE ANSWER IS NEVER FINAL, AND THE WAY BACK SITS BESIDE IT.

        A household that lands here has said yes — on one tap, if the invitation
        names one person. The same reasoning `CeremonyStream` gives for its own
        "Volver a responder" applies unchanged: responses are append-only, so a
        correction writes a new row and the couple still see that the household
        changed its mind.

        Quieter than the controls on the screens before it, because here there
        is nothing to do. It is an escape hatch, not the point of the screen.

        THE SAME WORDS THE DECLINING SCREEN USES, and number-neutral for the
        same reason: "volver a responder" reads correctly to one guest and to a
        household of five, so the one control that appears on both endings does
        not need a plural rule of its own.
      */}
      <button
        className="
          rsvp__reconsider self-center text-xs text-[#f6efe2]/70 underline
          underline-offset-4 transition-colors
          duration-(--console-motion-fast)
          hover:text-[#f6efe2]
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[#f6efe2]
        "
        onClick={onReconsider}
        type="button"
      >
        Volver a responder
      </button>
    </div>
  );
}
