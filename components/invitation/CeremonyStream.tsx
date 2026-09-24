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
 * The invitation to the stream, in the number the household answered in.
 *
 * The couple asked for "un mejor copy como 'los esperamos por Zoom', similar a
 * lo que aparece en /transmision". That page had already been cut to one
 * sentence — "La ceremonia se va a transmitir a través de Zoom. Te esperamos."
 * — and this is the same offer, made to somebody who has just said they cannot
 * be in the room. "Gracias por contarnos" stays: it is the only line that
 * acknowledges the answer they just gave.
 */
function welcome(memberCount: number): string {
  return memberCount === 1
    ? "Gracias por contarnos. La ceremonia se va a transmitir en vivo, así que puedas acompañarnos desde donde estés."
    : "Gracias por contarnos. La ceremonia se va a transmitir en vivo, así que puedan acompañarnos desde donde estén.";
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
    <div className="rsvp__stream flex flex-col items-center gap-4 text-center">
      <h2 className="font-display text-xl text-[#f6efe2] sm:text-2xl">
        Los esperamos por Google Meet
      </h2>
      <p className="max-w-sm text-sm text-[#f6efe2]/85">
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
        names the day and counts down to it and a details list that states it
        again. A third statement is not reassurance, it is noise.
      */}
      <StreamDetails
        ceremony={ceremony}
        className="w-full max-w-sm"
        showDate={false}
        showTime={false}
      />

      <p className="rsvp__reconsider text-xs text-[#f6efe2]/70">
        {reconsiderSentence(memberCount)}
      </p>
      <button
        type="button"
        onClick={onReconsider}
        className="
          rounded-full border border-[#f6efe2]/30 bg-black/30 px-5 py-2.5
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
