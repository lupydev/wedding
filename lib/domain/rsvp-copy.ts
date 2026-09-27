import type { RsvpRejectionReason } from "./seats";
import { RSVP_DEADLINE_TEXT } from "./wedding-day";

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

/*
  A SENTENCE COUNTING THE REMAINING SEATS STOOD HERE, AND THE COUPLE DELETED
  IT.

  `seatsSelectionSentence` — "Puedes seleccionar 2 personas más." while a
  household still had room, "Ya seleccionaron las 3." once they did not. It
  existed because the form disables the remaining checkboxes when the
  allowance is spent, and a control that stops responding without a word
  reads as a broken page.

  MIGRATION 0012 HAD ALREADY TAKEN ITS SUBJECT AWAY. The cap became the
  MEMBERSHIP, so the list is exactly the people the invitation names and they
  all arrive ticked: the "N more" half was unreachable until a household
  unticked somebody, and the "all selected" half was the first thing every
  household read. The couple removed it on sight.

  Deleted rather than left unexported. It had one caller, and a domain
  function with none is a sentence this product no longer says.
*/

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
  /** The affirmative, which is now one line whatever the number. */
  readonly yes: string;
  /** And the refusal, which is still in the reader's own number. */
  readonly no: string;
}

/**
 * The answer a household says yes with, and it is the same line for everybody.
 *
 * THE COUPLE NAMED IT EXACTLY, AND THE OPENING MARK IS PART OF IT. "¡Sí,
 * acepto!" — with the `¡`, which is how every other exclamation in this
 * product is written ("¡Hola, Familia Aguirre!", "¡Listo!"). A line set with
 * only the closing mark reads as a typo on the one control the whole screen
 * exists to have pressed.
 *
 * AND IT IS DELIBERATELY NOT INFLECTED, WHICH REVERSES PART OF AN EARLIER
 * DECISION. The affirmative used to be "Sí, allá estaré" for one guest and
 * "Sí, allá estaremos" for a household, because a guest invited alone was
 * being made to answer in the plural on the one page addressed to them by
 * name. The couple have now asked for one line on both, so the choice reads
 * "¡Sí, acepto!" beside a question and a refusal that are still inflected —
 * "¿Podrán acompañarnos?", "No podemos acompañarlos".
 *
 * THE MIXTURE WAS PUT TO THEM AND THEY CONFIRMED IT. This note used to end
 * by offering "¡Sí, aceptamos!" as a one-line change "if they want the
 * voices to agree again", which left a settled decision reading like an
 * oversight waiting to be tidied. It was asked explicitly — a household of
 * four is addressed in the plural and answers in the singular — and the
 * answer was to keep `¡Sí, acepto!` for every invitation, whatever its size.
 * It is the couple's own string and it stays.
 */
const YES = "¡Sí, acepto!";

/**
 * The question, and the two answers, in the number the reader answers in.
 *
 * Every line here was plural, because an invitation was assumed to be a
 * household. It is not: a guest invited alone was made to answer "Sí, allá
 * estaremos" on the one page in the product addressed to them by name. The
 * couple asked for both voices — and then, for the affirmative alone, asked
 * for one voice again. See `YES` above.
 *
 * ZERO READS AS A HOUSEHOLD, AND THAT IS DELIBERATE. An invitation with no
 * members is refused long before this function is reached, so the branch is
 * unreachable — but written as `memberCount === 1` rather than `<= 1`, a count
 * that somehow arrived as zero would address a group in the singular. The cost
 * of being wrong in the other direction is nothing.
 */
/**
 * The last day to answer, said where the question is asked.
 *
 * IT WAS A GREY FOOTNOTE AT THE BOTTOM OF A SCROLLING PAGE, and on a phone that
 * meant most households never reached it: the invitation was two and a half
 * screens tall and this was the last line of the third. The couple asked for
 * the date to be part of the question — a household reading "¿Podrán
 * acompañarnos?" should be able to see, without moving, how long they have to
 * decide.
 *
 * In the reader's own number, like the question above it. A guest invited alone
 * being told "confirmen" is the same small wrongness `rsvpChoiceCopy` exists to
 * fix.
 *
 * The date itself comes from `RSVP_DEADLINE_TEXT`, which is derived from the
 * wedding instant — so this sentence and the server-side gate in
 * `lib/server/rsvp.ts` cannot name different days.
 */
export function rsvpDeadlineSentence(memberCount: number): string {
  return memberCount === 1
    ? `Confirma antes del ${RSVP_DEADLINE_TEXT}.`
    : `Confirmen antes del ${RSVP_DEADLINE_TEXT}.`;
}

/**
 * What the screen after an acceptance opens with.
 *
 * The household has just said they are coming, so the answer is not "thank
 * you" — it is where to go. This line says the couple are expecting them and
 * hands over to the day, the dress code and the venue beneath it.
 *
 * IT IS THE TOP LINE OF THE SCREEN, NOT A SECOND HEADING UNDER ONE. Every
 * other screen opens with `greetingLine` — "¡Hola, Familia Aguirre!" — and the
 * couple asked for this one to say something else in that same place: "en vez
 * de decir: hola, nombre de la invitación debería ser… Te esperamos, nombre de
 * la invitación". So it carries the household's name itself, and the greeting
 * it replaces is not rendered above it.
 *
 * THE NUMBER IS THE INVITATION'S, NOT THE ANSWER'S, and that is the couple's
 * own rule read literally: "si la invitación es 2 personas o más". A household
 * of three of whom only one can come is still "los esperamos" — the invitation
 * is addressed to the three of them, and a line that switched to the singular
 * because two boxes came unticked would read as the couple striking people off
 * a list. `memberCount` is `guests.length`, which is the membership itself
 * since migration 0012, so there is nothing else it could accidentally be.
 *
 * ZERO READS AS A HOUSEHOLD, for the reason `rsvpChoiceCopy` gives below: the
 * branch is unreachable, and being wrong in the plural costs nothing.
 *
 * The comma is a vocative one and the line takes no exclamation marks. "¡Te
 * esperamos!" is an exclamation shouted at somebody who has just answered
 * politely; the couple wrote it flat, and flat is the register the rest of
 * this surface is written in.
 */
export function rsvpConfirmedHeading(
  memberCount: number,
  greetingName: string,
): string {
  return memberCount === 1
    ? `Te esperamos, ${greetingName}`
    : `Los esperamos, ${greetingName}`;
}

export function rsvpChoiceCopy(memberCount: number): RsvpChoiceCopy {
  return memberCount === 1
    ? {
        question: "¿Podrás acompañarnos?",
        yes: YES,
        no: "No puedo acompañarlos",
      }
    : {
        question: "¿Podrán acompañarnos?",
        yes: YES,
        no: "No podemos acompañarlos",
      };
}
