import type { RsvpRejectionReason } from "./seats";

/**
 * What the RSVP says to a guest, as pure text.
 *
 * Pure and here rather than inside the component, exactly like `gate-copy.ts`,
 * because the pluralization and the "you already answered" sentence are real
 * logic worth testing without a DOM.
 *
 * The one deliberate difference from the gate: this surface SAYS WHY. The gate
 * must not, because a specific failure there turns a forwarded link into a
 * phone-number checker. Here the guest is already through the gate, reading
 * their own household's invitation, and there is nothing left to disclose — so
 * a refusal that does not say which box to change is simply a form nobody
 * finishes.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/**
 * Why a submission was refused.
 *
 * The seat reasons come from `seats.ts` unchanged rather than being re-listed,
 * so a reason added there cannot silently lose its message here: this file
 * stops compiling until it is mapped.
 */
export type RsvpFailureReason =
  | RsvpRejectionReason
  /** The payload was not the shape the form produces. */
  | "invalid_input"
  /** A named attendee does not belong to this invitation. */
  | "unknown_guest";

export type RsvpFeedback =
  | { readonly status: "idle" }
  | { readonly status: "recorded" }
  | { readonly status: "not_authorized" }
  | { readonly status: "closed" }
  | { readonly status: "rejected"; readonly reason: RsvpFailureReason };

/**
 * What the page says once the deadline has passed.
 *
 * A contact message, not a dead end. The couple can still seat a household that
 * answers late; what they cannot do is keep collecting answers silently after
 * they have given the venue a number.
 */
export const RSVP_CLOSED_MESSAGE =
  "Ya cerramos las confirmaciones para poder organizar todo. Si necesitan " +
  "cambiar su respuesta, escríbannos directamente por WhatsApp.";

const GENERIC_FAILURE =
  "No pudimos guardar la respuesta. Revisa las opciones e inténtalo de nuevo.";

function rejectionSentence(reason: RsvpFailureReason): string {
  switch (reason) {
    case "seats_exceed_allowed":
    case "attendees_exceed_allowed":
      return "Seleccionaron más personas de las que tenemos reservadas para ustedes.";

    case "attending_without_seats":
      return "Selecciona quiénes asisten, al menos una persona.";

    // Every remaining reason describes a payload the form cannot produce: the
    // seat count is DERIVED from the checked boxes, so a mismatch, a duplicate
    // or a negative count means the submission did not come from the form. The
    // guest still gets one actionable sentence rather than a silent failure.
    case "invalid_input":
    case "unknown_guest":
    case "duplicate_attendees":
    case "declined_with_seats":
    case "seats_do_not_match_attendees":
    case "seats_negative":
    case "seats_not_an_integer":
      return GENERIC_FAILURE;
  }
}

/** The lines to show under the RSVP form, in order. Empty before the first try. */
export function rsvpFeedbackMessages(
  feedback: RsvpFeedback,
): readonly string[] {
  switch (feedback.status) {
    case "idle":
      return [];
    case "recorded":
      return ["¡Listo! Guardamos su respuesta."];
    case "not_authorized":
      return [
        "Tu sesión ya no está activa. Abre de nuevo el enlace de la invitación y confirma tu número.",
      ];
    case "closed":
      return [RSVP_CLOSED_MESSAGE];
    case "rejected":
      return [rejectionSentence(feedback.reason)];
  }
}

/**
 * How many more people this household may still select.
 *
 * The sentence exists because the form DISABLES the remaining checkboxes once
 * everybody on the invitation is selected (the hard cap has no "request more"
 * affordance, by confirmed decision). A control that stops responding without a
 * word reads as a broken page, so the moment it happens is stated in words.
 *
 * `memberCount` is the invitation's own membership since migration 0012, which
 * is why the completed sentence names the PEOPLE rather than reserved seats:
 * there is no allowance separate from the names to report.
 */
export function seatsSelectionSentence(
  selected: number,
  memberCount: number,
): string {
  const remaining = memberCount - selected;

  if (remaining <= 0) {
    return memberCount === 1
      ? "Ya seleccionaron a la única persona."
      : `Ya seleccionaron las ${memberCount}.`;
  }

  return remaining === 1
    ? "Puedes seleccionar 1 persona más."
    : `Puedes seleccionar ${remaining} personas más.`;
}

/** The parts of a stored answer this sentence needs. */
export interface CurrentRsvpSummary {
  readonly attending: boolean;
  readonly seatsConfirmed: number;
}

/**
 * The household's answer as it stands right now, or `null` if they have none.
 *
 * `null` rather than a placeholder: showing "aún no han respondido" styled like
 * an answer invites a guest to read a state that does not exist. A household
 * that has not answered simply sees the form.
 */
export function currentRsvpSentence(
  current: CurrentRsvpSummary | null,
): string | null {
  if (current === null) {
    return null;
  }

  if (!current.attending) {
    return "Tu respuesta actual: no pueden acompañarnos.";
  }

  return current.seatsConfirmed === 1
    ? "Tu respuesta actual: asiste 1 persona."
    : `Tu respuesta actual: asisten ${current.seatsConfirmed} personas.`;
}

/** The three lines the household's own size decides. */
export interface RsvpChoiceCopy {
  /** The question above the two choices. */
  readonly question: string;
  /** The affirmative, in the inviting household's own number. */
  readonly yes: string;
  /** And the refusal. */
  readonly no: string;
}

/**
 * The question, and the two answers, in the number the reader answers in.
 *
 * Every line here was plural, because an invitation was assumed to be a
 * household. It is not: a guest invited alone was made to answer "Sí, allá
 * estaremos" on the one page in the product addressed to them by name. The
 * couple asked for both voices.
 *
 * ZERO READS AS A HOUSEHOLD, AND THAT IS DELIBERATE. An invitation with no
 * members is refused long before this function is reached, so the branch is
 * unreachable — but written as `memberCount === 1` rather than `<= 1`, a count
 * that somehow arrived as zero would address a group in the singular. The cost
 * of being wrong in the other direction is nothing.
 */
export function rsvpChoiceCopy(memberCount: number): RsvpChoiceCopy {
  return memberCount === 1
    ? {
        question: "¿Podrás acompañarnos?",
        yes: "Sí, allá estaré",
        no: "No puedo acompañarlos",
      }
    : {
        question: "¿Podrán acompañarnos?",
        yes: "Sí, allá estaremos",
        no: "No podemos acompañarlos",
      };
}
