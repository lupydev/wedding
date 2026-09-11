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

/** The ceremony row, as this card renders it. */
export interface CeremonyStreamDetails {
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

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
        The four values are rendered exactly as the row holds them, including
        the seeded `{{...}}` placeholders. Hiding or prettifying an unfinished
        value would turn an obviously incomplete invitation into a plausible
        wrong one, and nobody would notice until a guest joined a call that does
        not exist.
      */}
      <dl
        className="rsvp__stream-details"
        role="group"
        aria-label="Detalles de la transmisión"
      >
        <dt>Fecha</dt>
        <dd>{ceremony.ceremonyDate}</dd>
        <dt>Hora</dt>
        <dd>{ceremony.ceremonyTime}</dd>
        <dt>ID de la reunión</dt>
        <dd>{ceremony.streamMeetingId}</dd>
        <dt>Clave de acceso</dt>
        <dd>{ceremony.streamPasscode}</dd>
      </dl>

      <p className="rsvp__reconsider">{RECONSIDER_SENTENCE}</p>
      <button type="button" onClick={onReconsider}>
        Volver a responder
      </button>
    </div>
  );
}
