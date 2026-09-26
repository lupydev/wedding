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
 * The household's answer is never final.
 *
 * Declining submits on the first tap, so a mis-tap records a decline instantly.
 * The way back therefore lives here, beside the consequence, rather than
 * somewhere the guest would have to go looking for it. Responses are
 * append-only, so correcting one writes a new row and the couple still sees
 * that the household changed its mind.
 */
function reconsiderSentence(memberCount: number): string {
  return memberCount === 1
    ? "Si cambias de opinión, puedes volver a responder cuando quieras."
    : "Si cambian de opinión, pueden volver a responder cuando quieran.";
}

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
    <div className="rsvp__stream mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <h2 className="font-display text-xl text-[#f6efe2] sm:text-2xl">
        Los esperamos por Google Meet
      </h2>
      <p className="text-sm text-[#f6efe2]/85">{welcome(memberCount)}</p>

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

      <p className="rsvp__reconsider text-xs text-[#f6efe2]/70">
        {reconsiderSentence(memberCount)}
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
          block w-full rounded-full border border-[#f6efe2]/30 bg-black/30
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
  );
}
