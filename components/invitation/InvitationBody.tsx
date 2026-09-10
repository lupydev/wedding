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
 * Unresolved values the couple has not supplied yet.
 *
 * They are rendered verbatim, as visibly unfinished text. Inventing a date or a
 * venue would ship a wrong invitation that reads as a correct one, and nobody
 * would notice until a guest arrived on the wrong day.
 */
const COUPLE_NAMES = "{{COUPLE_NAMES}}";
const WEDDING_DATE = "{{WEDDING_DATE}}";
const VENUE_NAME = "{{VENUE_NAME}}";
const VENUE_ADDRESS = "{{VENUE_ADDRESS}}";

function seatsSentence(seatsAllowed: number): string {
  return seatsAllowed === 1
    ? "Tienen 1 lugar reservado."
    : `Tienen ${seatsAllowed} lugares reservados.`;
}

export function InvitationBody({
  invitation,
  rsvp,
}: {
  invitation: InvitationBodyInvitation;
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
      <p className="invitation__couple">{COUPLE_NAMES}</p>
      <h1 className="invitation__greeting">{invitation.greetingName}</h1>
      <p className="invitation__lead">
        Nos alegra mucho invitarlos a celebrar nuestro matrimonio.
      </p>

      <dl className="invitation__details">
        <dt>Fecha</dt>
        <dd>{WEDDING_DATE}</dd>
        <dt>Lugar</dt>
        <dd>{VENUE_NAME}</dd>
        <dt>Dirección</dt>
        <dd>{VENUE_ADDRESS}</dd>
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
