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
const RECONSIDER_SENTENCE =
  "Si cambian de opinión, pueden volver a responder cuando quieran.";

export function CeremonyStream({
  ceremony,
  onReconsider,
}: {
  readonly ceremony: CeremonyStreamDetails;
  readonly onReconsider: () => void;
}) {
  return (
    <div className="rsvp__stream">
      <h2>Los acompañamos por transmisión</h2>
      <p>
        Gracias por contarnos. Vamos a transmitir la ceremonia en vivo por Zoom,
        así que pueden acompañarnos desde donde estén.
      </p>

      {/*
        The same block the public stream page renders, so the two surfaces
        cannot disagree about what these values are called or which order they
        come in. It renders them verbatim, placeholders included; the reasoning
        lives in `StreamDetails`.
      */}
      <StreamDetails ceremony={ceremony} />

      <p className="rsvp__reconsider">{RECONSIDER_SENTENCE}</p>
      <button type="button" onClick={onReconsider}>
        Volver a responder
      </button>
    </div>
  );
}
