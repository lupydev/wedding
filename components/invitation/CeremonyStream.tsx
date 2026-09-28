/**
 * The ceremony stream, shown to a household that cannot come in person.
 *
 * WHY THIS IS WHERE A DECLINE LANDS
 *
 * The couple is streaming the ceremony over Zoom for the people who cannot be
 * there. Rather than maintaining a second audience list — which is a list that
 * goes out of date the moment the first one changes — a guest who declines a
 * personal invitation simply becomes a stream viewer. So this card replaces the
 * form rather than sitting beside it: the answer is recorded, and the only
 * thing left to say is how to join.
 *
 * For these guests the Zoom details sit BEHIND the phone gate, which is better
 * protected than the public ceremony page that will serve everyone else later.
 * Both surfaces read the same `ceremony` row (migration 0009); neither restates
 * a value.
 *
 * Synchronous and props-only, like `InvitationBody`. It performs no data access
 * and its prop type has no field for a phone number, so it cannot leak one.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

import { rsvpReconsiderSentence } from "@/lib/domain/rsvp-copy";

import { StreamDetails, type StreamDetailsValues } from "./StreamDetails";

/**
 * The ceremony row, as this card renders it.
 *
 * An alias rather than a second declaration of the same four fields. The public
 * stream page renders the identical block, so the shape is declared once in
 * `StreamDetails` and named here for the callers that already import this name.
 */
export type CeremonyStreamDetails = StreamDetailsValues;

/**
 * What this screen says to a household that has just said no.
 *
 * THANKS IS NOT THE SAME AS UNDERSTANDING, and the couple named the
 * difference: "un mensaje más ameno como 'comprendemos que no puedan asistir,
 * la ceremonia se transmitirá en vivo así pueden acompañarnos'."
 *
 * It opened with "Gracias por contarnos" and went straight to the stream.
 * Somebody telling the couple they cannot come to their wedding has usually
 * just decided something they are sorry about; the screen that answers them
 * should say it understands before it says anything practical.
 *
 * The stream follows in the same breath rather than in a second paragraph, so
 * the answer reads as one sentence: we understand, and here is the way to be
 * here anyway.
 */
function welcome(memberCount: number): string {
  return memberCount === 1
    ? "Comprendemos que no puedas acompañarnos ese día. Vamos a transmitir la ceremonia en vivo, así que puedes estar con nosotros desde donde estés."
    : "Comprendemos que no puedan acompañarnos ese día. Vamos a transmitir la ceremonia en vivo, así que pueden estar con nosotros desde donde estén.";
}

export function CeremonyStream({
  ceremony,
  memberCount,
  onReconsider,
}: {
  readonly ceremony: CeremonyStreamDetails;
  /** How many people this invitation names, which decides the number. */
  readonly memberCount: number;
  readonly onReconsider: () => void;
}) {
  return (
    /*
      THE MEASURE LIVES HERE, ON THE CARD, AND NOWHERE INSIDE IT.

      The couple counted the difference: "los botones tienen diferentes anchos,
      deben quedar del mismo ancho." Both WERE `w-full` — of two different
      boxes. "Entrar a la transmisión" sits inside the stream block, which this
      card was capping at `max-w-sm`; "Volver a responder" is a sibling of that
      block and inherited the card's full width.

      One capping element is what makes "the same width" survive somebody adding
      a third control: every child is `w-full` of the same box by construction,
      rather than by three places agreeing.
    */
    <div className="rsvp__stream mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-between gap-4 text-center">
      {/*
        TWO GROUPS, ONE AT EACH END, WHICH IS THE SHAPE EVERY OTHER SCREEN OF
        THIS INVITATION ALREADY HAS.

        Everything used to sit in one block pushed to the foot: the heading,
        the paragraph, the way in, then the sentence about changing your mind
        and the button under it. The couple asked for the stream itself to go
        to the TOP — "el bloque de la transmisión arriba" — and the way back
        to stay where it is, because it is the one mind-change a guest can
        still make and it belongs beside the consequence.

        So the middle of the photograph is the photograph's again, the way
        U37 made it on the other three screens.
      */}
      <div className="flex w-full flex-col items-center gap-4">
        {/*
          A HEADING STOOD HERE AND THE SCREEN'S TOP LINE SAYS IT NOW.

          "Los esperamos por Google Meet", under "¡Hola, {name}!" — two
          headings, one of which greeted and neither of which said the thing
          this screen is for. The couple replaced both with one line in the
          greeting's own place: "Los vamos a extrañar, {name}", the pair to
          "Los esperamos" on the accepted screen. `rsvpDeclinedHeading` holds
          it, next to its twin, and `RsvpAnswer` paints it — only the stepper
          knows which screen is showing.

          The paragraph stands on its own once the heading says the feeling.
        */}
        <p className="rsvp__stream-welcome text-sm text-[#f6efe2]">
          {welcome(memberCount)}
        </p>

        {/*
        The same block the public stream page renders, so the two surfaces
        cannot disagree about what these values are called or which order they
        come in. It renders them verbatim, placeholders included; the reasoning
        lives in `StreamDetails`.
      */}
        {/*
        NEITHER THE DAY NOR THE HOUR, FOR THE REASON `/transmision` ALREADY
        GAVE. This card sits inside the invitation, below an announcement that
        names the day and counts down to it. A second statement is not
        reassurance, it is noise.

        It used to say so with `showDate={false} showTime={false}`. `/transmision`
        passed exactly the same pair, so the block never once printed either
        value on a page a guest could open — and migration 0018 dropped the two
        columns those props read.
      */}
        <StreamDetails ceremony={ceremony} className="w-full" />
      </div>

      {/*
        AND THE ONE MIND-CHANGE A GUEST CAN STILL MAKE, KEPT AT THE FOOT.

        The couple kept this deliberately while removing every other way back
        in U37: a decline submits on the first tap, so a mis-tap is recorded
        instantly and the escape has to sit beside the consequence. Two
        browser stories in `1e460f8` are told decline-first because this is
        the only reversal the product still offers.
      */}
      <div className="flex w-full flex-col items-center gap-4">
        <p className="rsvp__reconsider text-xs text-[#f6efe2]/85">
          {rsvpReconsiderSentence(memberCount)}
        </p>
        <button
          type="button"
          onClick={onReconsider}
          /*
          FULL WIDTH, LIKE THE CONTROL ABOVE IT: "el botón debe ocupar todo el
          espacio, el de volver a responder." It sat centred at its own text
          width under a block whose other control fills the column — the same
          mismatch `/transmision` already had between its two buttons.
        */
          className="
          rsvp__reconsider-button
          flex min-h-11 w-full items-center justify-center rounded-full
          border border-[#f6efe2]/60 bg-black/30
          px-5 py-2.5 text-center
          text-sm text-[#f6efe2] backdrop-blur-sm transition-colors
          duration-(--console-motion-fast) ease-(--ease-console-out)
          hover:bg-black/50
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[#f6efe2]
        "
        >
          Volver a responder
        </button>
      </div>
    </div>
  );
}
