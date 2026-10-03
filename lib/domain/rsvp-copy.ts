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
 * AND THE SAME DATE, SAID TO A HOUSEHOLD THAT HAS ALREADY ANSWERED NO.
 *
 * IT USED TO PROMISE SOMETHING THE PRODUCT DOES NOT DO. The declined screen
 * said "Si cambias de opinión, puedes volver a responder cuando quieras." —
 * *whenever you like*. `RSVP_DEADLINE_DAYS_BEFORE` is 7, so the answer is
 * frozen from the 21st of November and the sentence was false for the last
 * week before the wedding: exactly the week a household that had said no is
 * most likely to change its mind, and exactly the week the page would have
 * been telling them they still could.
 *
 * HERE RATHER THAN IN THE COMPONENT, and that is the whole reason it moved:
 * the question screen already names this date through
 * `rsvpDeadlineSentence`, and two screens naming the same deadline from two
 * places is two dates waiting to disagree. Both read `RSVP_DEADLINE_TEXT`,
 * which is derived from the wedding's own instant, so neither can be edited
 * into a different day.
 */
/**
 * WHAT THE INVITATION SAYS ONCE THE ANSWERS ARE CLOSED, PER ENDING.
 *
 * "Confirmaciones cerradas" was a headline over an empty screen, and it was
 * the only thing on it. The screen carries the venue or the stream now — see
 * `RsvpClosed` for the defect that made it necessary — so a headline
 * announcing an absence would read as an error message above working
 * content. One quiet line instead: the answers are closed, and here is what
 * is still true for you.
 *
 * THREE LINES BECAUSE THERE ARE THREE ENDINGS, and the difference is what the
 * household can still do rather than how sorry the sentence is. The one that
 * never answered is offered the stream rather than told about it: nothing has
 * been said to them yet, and this is the last thing the page can offer.
 *
 * `RSVP_CLOSED_MESSAGE` STAYS AND IS NOT THIS. That one answers a submission
 * that arrives after the deadline — a household that had the form open when
 * the day turned — and it tells them to write by WhatsApp. This is the
 * standing state of a screen, not the answer to an attempt.
 */
export function rsvpClosedNote(
  state: "accepted" | "declined" | "unanswered",
  memberCount: number,
): string {
  const one = memberCount === 1;

  switch (state) {
    case "accepted":
      return one
        ? "Ya cerramos las confirmaciones. Aquí está todo lo que necesitas para acompañarnos."
        : "Ya cerramos las confirmaciones. Aquí está todo lo que necesitan para acompañarnos.";
    case "declined":
      return one
        ? "Ya cerramos las confirmaciones. Te esperamos por la transmisión."
        : "Ya cerramos las confirmaciones. Los esperamos por la transmisión.";
    case "unanswered":
      return one
        ? "Ya cerramos las confirmaciones. Si quieres, puedes acompañarnos por la transmisión."
        : "Ya cerramos las confirmaciones. Si quieren, pueden acompañarnos por la transmisión.";
  }
}

export function rsvpReconsiderSentence(memberCount: number): string {
  return memberCount === 1
    ? `Si cambias de opinión, puedes volver a responder hasta el ${RSVP_DEADLINE_TEXT}.`
    : `Si cambian de opinión, pueden volver a responder hasta el ${RSVP_DEADLINE_TEXT}.`;
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

/**
 * And what the OTHER ending opens with, which is the same line in the other
 * direction.
 *
 * "Los vamos a extrañar, {name}" for two or more, "Te vamos a extrañar,
 * {name}" for one. It replaces "¡Hola, {name}!" in the same place, keys off
 * the same `memberCount`, takes the same vocative comma and the same flat
 * register with no exclamation marks — everything written above
 * `rsvpConfirmedHeading` applies here unchanged, which is why the two sit
 * next to each other rather than in two files.
 *
 * A PAIR, AND THE PAIR IS THE POINT. The two endings of this invitation are
 * the same sentence about the same people: one says we are expecting you, one
 * says we will miss you. A future reader changing the tone of either should
 * see the other immediately.
 *
 * IT ALSO TOOK OVER FROM A HEADING INSIDE THE CARD. The declined screen used
 * to open "¡Hola, {name}!" and then say "Los esperamos por Google Meet" over
 * the stream block. Two headings, one of which greeted and neither of which
 * said the thing the screen is for. The couple replaced both with this, and
 * `CeremonyStream` no longer renders a heading of its own.
 */
export function rsvpDeclinedHeading(
  memberCount: number,
  greetingName: string,
): string {
  return memberCount === 1
    ? `Te vamos a extrañar, ${greetingName}`
    : `Los vamos a extrañar, ${greetingName}`;
}

/**
 * The Spanish for each size an invitation can plausibly be, written out.
 *
 * `una` RATHER THAN `un` AT INDEX ONE, because the noun it agrees with is
 * `persona`. The first form of this sentence counted `lugares` and took the
 * masculine; the couple rewrote it to count people, and Spanish followed.
 *
 * ZERO IS IN THE TABLE SO THAT AN EMPTY INVITATION SAYS SO. It is unreachable
 * — an invitation with no members is refused long before any of this — and if
 * one ever arrives, "cero (0) personas" is visibly broken rather than a
 * plausible lie.
 *
 * ELEVEN AND UP FALL BACK TO THE NUMERAL, so the sentence reads "11 (11)
 * personas". That looks like a mistake and it is one: nothing in this product
 * enforces the stated ceiling of three, so a size that large means somebody
 * entered a household nobody planned for. A table that silently ran out would
 * hide it.
 */
const SIZE_IN_WORDS: readonly string[] = [
  "cero",
  "una",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
];

/**
 * AND HOW MANY PEOPLE THAT INVITATION IS FOR, WHICH IT NEVER SAID ANYWHERE.
 *
 * THIS IS A DEFECT REAL GUESTS FOUND IN REAL INVITATIONS. The couple had
 * already started sending them when they came back with it: "las personas
 * estan interpretando que van a poder invitar a mas personas." Nothing in the
 * whole flow stated the size of the invitation, so "¿Podrán acompañarnos?"
 * read to some households as something they could extend. Their instruction,
 * twice: "agregar que la invitacion es para la cantidad de personas a la cual
 * se agrego de invitados por invitacion para que sea mas especifica", and then
 * "si en todo el flujo debe ser super claro el numero de personas inclusive en
 * el mensaje de whatsapp."
 *
 * THE WORDING IS THEIRS AND IT REPLACED A WARMER ONE. This shipped first as
 * "Reservamos tres lugares para ustedes." — chosen so that a guest was told
 * the ceiling without being read a rule. They saw it rendered and asked for
 * the other register: "debe decir la invitación es para una (1) persona. y si
 * es dos o mas debe decir el numero en letras y el digito entre ()." It is
 * contract-like on purpose, which is exactly right for a message a household
 * forwards and argues about. Whether the two SCREENS should keep the warmer
 * form is an open question in the feature document; the cost of splitting
 * them is a second function and two sentences that can drift.
 *
 * THE WORD AND THE DIGIT TOGETHER IS NOT REDUNDANCY. A word cannot be misread
 * as a different number and a digit cannot be skimmed past.
 *
 * ONE FUNCTION FOR EVERY SURFACE, AND THE PLURAL IS THE REASON. Spanish needs
 * agreement in two places here — the numeral word and `persona`/`personas` —
 * and needed a third, `ti`/`ustedes`, before this form dropped the second
 * person entirely. A surface that interpolated a bare count into its own
 * sentence would eventually ship "1 personas". The number never leaves this
 * function; every caller receives a finished sentence, including the WhatsApp
 * template, whose `{{invitation_size}}` carries this string rather than a
 * count.
 *
 * IT IS PERSON-NEUTRAL, WHICH IS WHY ONE SENTENCE CAN SERVE THREE SURFACES.
 * "La invitación es para …" talks about the invitation rather than to the
 * reader, so the message, the question screen and the confirmation can all
 * say it without choosing a voice.
 *
 * NAMED WITHOUT THE `rsvp` PREFIX THE REST OF THIS FILE CARRIES, because two
 * of its three call sites are RSVP screens and the third is the message that
 * arrives before any of them. It lives here anyway: it keys off the same
 * `memberCount` as the two headings above, switches at the same boundary, and
 * belongs beside them rather than in a file of its own.
 *
 * THE NUMBER IS THE INVITATION'S, NOT THE ANSWER'S, exactly as in
 * `rsvpConfirmedHeading`, and here that is the whole point rather than a
 * grammatical detail. A household of three that confirms two still reads
 * three: three is the ceiling they are being told about, and saying it also
 * quietly invites the third back. The signature carries one number and every
 * caller passes the membership, so there is no seat count it could reach.
 *
 * WHERE IT MATTERS MOST IS THE SOLO INVITATION, and that is why the singular
 * is not the plural with an `s` removed. A household of two or three passes
 * through `¿Quiénes asisten?` and meets its own members by name, so the set is
 * explicit there whatever this line says. Since `1e460f8` an invitation naming
 * ONE person confirms on the first tap and skips that screen entirely — that
 * guest sees no list, no name and no number anywhere in the flow, and this
 * sentence is the only thing in the product that tells them.
 *
 * EXACTLY ONE PARENTHESISED NUMBER AND NO LOOSE DIGIT, which is a contract
 * with `dispatch-message.spec.ts` rather than a detail. That file used to
 * assert that the only digits in a rendered WhatsApp draft came from the
 * invitation URL — the rule that keeps a date or a street number out of an
 * approved template and outliving its correction. The couple have now asked
 * for a digit in the body, so the guard was NARROWED to "the only digits
 * outside the URL are the ones inside the size sentence's parentheses". That
 * is only safe while this function keeps its shape, which `rsvp-copy.spec.ts`
 * asserts for every size it can produce.
 */
export function invitationSizeSentence(memberCount: number): string {
  const size = SIZE_IN_WORDS[memberCount] ?? `${memberCount}`;
  const people = memberCount === 1 ? "persona" : "personas";

  return `La invitación es para ${size} (${memberCount}) ${people}.`;
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
