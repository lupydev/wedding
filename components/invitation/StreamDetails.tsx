/**
 * The four values a guest needs in order to join the ceremony.
 *
 * ONE BLOCK, TWO SURFACES, AND THAT IS THE WHOLE REASON IT EXISTS.
 *
 * `CeremonyStream` shows these to a household behind the phone gate that told
 * us they cannot come in person. `/transmision` shows them to everybody else,
 * publicly. Migration 0009 states the rule for the row itself — "every surface
 * that shows them MUST read this row; never restate a value" — and this file is
 * that rule one level up: the labels, their order, and the decision to render
 * values verbatim are written once instead of twice.
 *
 * Two copies would drift, and the way they would drift is one surface calling
 * it "Clave" and the other "Contraseña" while a guest reads both and wonders
 * which call they are joining.
 *
 * Props-only and synchronous. It performs no data access, and its prop type has
 * no field for a phone number or a guest, so neither can reach it by accident.
 *
 * NO COLOURS AND NO PALETTE. It inherits both from whatever surface renders it
 * — cream paper inside the invitation, a paper island on the dark stream page.
 * A component that decided its own colours could only be right on one of them.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/** The stream half of the `ceremony` row, as a component renders it. */
export interface StreamDetailsValues {
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

export function StreamDetails({
  ceremony,
  className,
}: {
  readonly ceremony: StreamDetailsValues;
  /** The host surface's own spacing and type. Never its colours. */
  readonly className?: string;
}) {
  return (
    /*
     * The values are rendered exactly as the row holds them, including the
     * seeded `{{...}}` placeholders. Hiding or prettifying an unfinished value
     * would turn an obviously incomplete invitation into a plausible wrong one,
     * and nobody would notice until a guest joined a call that does not exist.
     *
     * `role="group"` with a name, rather than a bare `<dl>`: it gives assistive
     * technology one addressable thing called "Detalles de la transmisión"
     * instead of four loose term/definition pairs adrift on the page.
     */
    <dl
      className={className ?? "rsvp__stream-details"}
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
  );
}
