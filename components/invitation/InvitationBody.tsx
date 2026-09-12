/**
 * The invitation itself, as a guest reads it.
 *
 * ONE component, rendered by two routes: the public `/i/[slug]` page (after the
 * phone gate lets the guest through) and the operator preview at
 * `/console/preview/[invitationId]`. Two implementations would drift, and the
 * operator would approve copy that no guest ever sees.
 *
 * Synchronous and props-only, deliberately. It performs no data access, so it
 * cannot be handed a phone number by accident: its prop type has no field for
 * one. That is also what makes it directly unit-testable.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */

export interface InvitationBodyGuest {
  readonly id: string;
  readonly fullName: string;
  readonly isChild: boolean;
}

/**
 * Structurally the guest-facing projection from `lib/server/invitations.ts`,
 * declared here rather than imported: `components/**` must not reach into
 * `lib/server/**`, which is what allows the public and console routes to share
 * this component.
 */
export interface InvitationBodyInvitation {
  readonly displayName: string;
  readonly greetingName: string;
  readonly seatsAllowed: number;
  readonly rsvpDeadline: string | null;
  readonly guests: readonly InvitationBodyGuest[];
}

/**
 * The wedding's own facts, supplied by the route from the `ceremony` row.
 *
 * THESE WERE FOUR MODULE CONSTANTS AND THAT WAS THE BUG
 *
 * They held four brace-wrapped placeholders awaiting the couple — the right
 * instinct, since inventing a date ships a wrong invitation that reads as a
 * correct one, in the wrong place. The `ceremony` row
 * already held this wedding's date and its stream credentials, so the same event
 * was described in two places: one an operator can correct with an UPDATE, one
 * only a redeploy can touch. A fact stored twice is a fact that will drift, and
 * a reference project's WhatsApp template drifted exactly this way — it kept
 * announcing a venue the event had already left.
 *
 * Values still arrive verbatim, placeholders included. An unfinished value must
 * stay visibly unfinished; hiding or prettifying it turns an obviously
 * incomplete invitation into a plausible wrong one.
 *
 * FOUR FIELDS AND NOT SEVEN. The row also carries the Zoom meeting id and its
 * passcode, which this component does not render — so its prop type has no field
 * for them, exactly as it has no field for a phone number. A component cannot
 * leak what it was never handed.
 */
export interface InvitationBodyWedding {
  readonly coupleNames: string;
  /**
   * The wedding date. It is `ceremony_date`: one day, one column, one place to
   * correct it. A second `wedding_date` would be the drift again.
   */
  readonly ceremonyDate: string;
  readonly venueName: string;
  readonly venueAddress: string;
}

function seatsSentence(seatsAllowed: number): string {
  return seatsAllowed === 1
    ? "Tienen 1 lugar reservado."
    : `Tienen ${seatsAllowed} lugares reservados.`;
}

export function InvitationBody({
  invitation,
  wedding,
  rsvp,
}: {
  invitation: InvitationBodyInvitation;
  /** The one row every surface reads. Never restated here. */
  wedding: InvitationBodyWedding;
  /**
   * The RSVP surface, composed by the route.
   *
   * A slot rather than the form itself, for the reason this component is
   * props-only in the first place: the RSVP needs a bound Server Action and the
   * household's current answer, and `components/**` may not reach into
   * `lib/server/**`. The body decides only WHERE an answer belongs — after the
   * guest list, before the deadline line — and the public route fills it with
   * the form or the closed message. The operator preview passes nothing, and
   * then nothing renders: a preview must not show a control no guest can use.
   */
  rsvp?: React.ReactNode;
}) {
  return (
    <article className="invitation">
      <p className="invitation__couple">{wedding.coupleNames}</p>
      <h1 className="invitation__greeting">{invitation.greetingName}</h1>
      <p className="invitation__lead">
        Nos alegra mucho invitarlos a celebrar nuestro matrimonio.
      </p>

      <dl className="invitation__details">
        <dt>Fecha</dt>
        <dd>{wedding.ceremonyDate}</dd>
        <dt>Lugar</dt>
        <dd>{wedding.venueName}</dd>
        <dt>Dirección</dt>
        <dd>{wedding.venueAddress}</dd>
      </dl>

      <section className="invitation__household">
        <h2>Esta invitación es para {invitation.displayName}</h2>
        <p>{seatsSentence(invitation.seatsAllowed)}</p>
        <ul>
          {invitation.guests.map((guest) => (
            <li key={guest.id}>
              {guest.fullName}
              {guest.isChild ? " (niño o niña)" : ""}
            </li>
          ))}
        </ul>
      </section>

      {rsvp === undefined ? null : (
        <section className="invitation__rsvp">{rsvp}</section>
      )}

      {invitation.rsvpDeadline === null ? null : (
        <p className="invitation__deadline">
          Confirmen su asistencia antes del {invitation.rsvpDeadline}.
        </p>
      )}
    </article>
  );
}
