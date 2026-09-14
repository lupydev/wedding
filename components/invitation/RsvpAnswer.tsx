"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  currentRsvpSentence,
  rsvpFeedbackMessages,
  seatsSelectionSentence,
  type RsvpFeedback,
} from "@/lib/domain/rsvp-copy";

import { CeremonyStream, type CeremonyStreamDetails } from "./CeremonyStream";

/**
 * The RSVP surface.
 *
 * The second and last Client Component on the public route, and — like
 * `GateForm` — it holds no invitation data beyond what it renders and receives
 * its action as a prop. The page binds the slug to the Server Action on the
 * server, so the household being answered for is never a client-supplied value.
 *
 * THE SEAT COUNT IS NOT A FIELD. Every seat on this guest list belongs to a
 * named person, so the honest input is which of those people are coming. The
 * form submits names; the server derives `seats_confirmed` from them. That is
 * not a simplification — the database requires the count to EQUAL the number of
 * names (migration 0007) and to stay within the allowance (0003), and the only
 * way a form can be guaranteed to satisfy both is to have no way to disagree.
 *
 * THE CAP HAS NO AFFORDANCE. Once the allowance is spent the unchecked boxes
 * are disabled, and the sentence above them says so. There is no "request more
 * seats" control, because the cap is a confirmed product decision rather than a
 * suggestion, and a control that always fails is worse than no control.
 *
 * THERE IS NO MESSAGE BOX. This whole flow begins in the guest's own WhatsApp
 * thread and arrives from the couple's own personal numbers, so the guest
 * already holds their contact. A free-text field here competes with the chat
 * they are already in — and loses, because a WhatsApp reply reaches the couple
 * where they actually are, while a form field waits for somebody to remember to
 * check it. Migration 0010 removed the column too. `dietaryNotes` STAYS: that
 * is not a message, it is operational data the catering needs and a guest will
 * not think to send unprompted.
 *
 * A DECLINE IS NOT A FORM. It submits on the first tap and the answer is
 * replaced by the ceremony stream details — see `declineNow` and
 * `CeremonyStream` below for both halves of the reasoning.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** One named person on the invitation. No phone field exists on this type. */
export interface RsvpAnswerGuest {
  readonly id: string;
  readonly fullName: string;
  readonly isChild?: boolean;
}

/** The household's answer as it currently stands, or `null` if they have none. */
export interface RsvpAnswerCurrent {
  readonly attending: boolean;
  readonly seatsConfirmed: number;
  readonly attendeeGuestIds: readonly string[];
  readonly dietaryNotes: string | null;
}

export type RsvpAnswerAction = (
  previous: RsvpFeedback,
  formData: FormData,
) => Promise<RsvpFeedback>;

const IDLE: RsvpFeedback = { status: "idle" };

/** Mirrors the `char_length` CHECK constraint on `rsvp_responses`. */
const DIETARY_NOTES_MAX_LENGTH = 500;

/** What the household has answered, as far as this page knows. */
type Answer = "yes" | "no" | "";

export function RsvpAnswer({
  guests,
  current,
  ceremony,
  action,
}: {
  readonly guests: readonly RsvpAnswerGuest[];
  readonly current: RsvpAnswerCurrent | null;
  /** The ceremony stream, shown in place of the form to a declining household. */
  readonly ceremony: CeremonyStreamDetails;
  readonly action: RsvpAnswerAction;
}) {
  const [feedback, submit, pending] = useActionState(action, IDLE);

  // The attendance choice and the checked set are local state rather than
  // uncontrolled inputs because both drive what the rest of the form allows:
  // declining disables the list, and spending the allowance disables what is
  // left of it. A disabled control that the browser then omits from the
  // payload is exactly the behaviour wanted here — a decline submits no names.
  const [attending, setAttending] = useState<Answer>(
    current === null ? "" : current.attending ? "yes" : "no",
  );
  const [selected, setSelected] = useState<readonly string[]>(
    current?.attendeeGuestIds ?? [],
  );

  // The answer ON FILE, which is what decides the surface. It starts as the row
  // the server sent and moves only when a submission is actually RECORDED —
  // never on the tap. A refusal that swapped in the stream card would tell a
  // household they are expected on a call while the couple's list still has
  // them as unanswered.
  const [answerOnFile, setAnswerOnFile] = useState<Answer>(
    current === null ? "" : current.attending ? "yes" : "no",
  );
  const [reconsidering, setReconsidering] = useState(false);
  const submittedAnswer = useRef<Answer>("");

  const formRef = useRef<HTMLFormElement>(null);
  // A counter rather than a boolean: two declines in a row are two distinct
  // requests, and a boolean that is already `true` would produce no change for
  // the effect below to act on.
  const [declineRequests, setDeclineRequests] = useState(0);

  useEffect(() => {
    if (declineRequests === 0) {
      return;
    }

    // Submitted from an effect, not from the change handler, so the browser
    // builds the payload AFTER React has disabled the attendee fieldset. A
    // synchronous `requestSubmit` would send the boxes the household had
    // checked under their previous "yes" — the server drops them anyway, but a
    // payload that says "we cannot come, and here are two of us" is a payload
    // one refactor away from reaching the database and failing its
    // `rsvp_declined_has_zero_seats` constraint as a 500.
    formRef.current?.requestSubmit();
  }, [declineRequests]);

  useEffect(() => {
    if (feedback.status !== "recorded") {
      return;
    }

    setAnswerOnFile(submittedAnswer.current);
    setReconsidering(false);
  }, [feedback]);

  const isAttending = attending === "yes";
  // The cap IS this household's membership since migration 0012, so there is
  // nothing to compare the selection against but the list already rendered.
  const allowanceSpent = selected.length >= guests.length;
  const answered = currentRsvpSentence(current);
  const messages = rsvpFeedbackMessages(feedback);
  const showStream = answerOnFile === "no" && !reconsidering;

  function toggle(guestId: string, checked: boolean) {
    setSelected((previous) =>
      checked
        ? previous.includes(guestId)
          ? previous
          : [...previous, guestId]
        : previous.filter((id) => id !== guestId),
    );
  }

  /**
   * Declining answers the whole question, so it submits itself.
   *
   * There is genuinely nothing left to fill in: a decline confirms zero seats
   * and names nobody, so the seat cap (0003) and the seat/attendee parity rule
   * (0007) are both satisfied trivially. A second click would be a button whose
   * only job is to ask "are you sure" without saying so.
   *
   * Accepting still requires the explicit submit, because there the household
   * must first choose who is coming.
   */
  function declineNow() {
    setAttending("no");
    setDeclineRequests((requests) => requests + 1);
  }

  function record(formData: FormData) {
    submittedAnswer.current = formData.get("attending") === "no" ? "no" : "yes";
    submit(formData);
  }

  /**
   * Back to the form, with nothing preselected.
   *
   * Auto-submitting means one mis-tap records a decline instantly, so the way
   * back sits beside the consequence. Clearing the choice is deliberate: a
   * mis-tap must not be one more tap away from repeating itself, and
   * re-choosing "no" has to be a real change that fires the auto-submit again.
   *
   * Responses are append-only, so a correction writes a NEW row. The couple
   * still sees that the household changed its mind, which is the information
   * they want and the reason offering this is safe.
   */
  function reconsider() {
    setReconsidering(true);
    setAttending("");
  }

  if (showStream) {
    return <CeremonyStream ceremony={ceremony} onReconsider={reconsider} />;
  }

  return (
    <form ref={formRef} action={record} className="rsvp__form">
      <h2>Confirmen su asistencia</h2>

      {answered === null ? null : <p className="rsvp__current">{answered}</p>}

      <fieldset className="rsvp__attending">
        <legend>¿Podrán acompañarnos?</legend>
        <label>
          <input
            type="radio"
            name="attending"
            value="yes"
            checked={attending === "yes"}
            onChange={() => setAttending("yes")}
            required
          />
          Sí, allá estaremos
        </label>
        <label>
          <input
            type="radio"
            name="attending"
            value="no"
            checked={attending === "no"}
            onChange={declineNow}
            required
          />
          No podremos acompañarlos
        </label>
      </fieldset>

      <fieldset className="rsvp__attendees" disabled={!isAttending}>
        <legend>¿Quiénes asisten?</legend>
        <p className="rsvp__seats">
          {seatsSelectionSentence(selected.length, guests.length)}
        </p>
        {guests.map((guest) => {
          const checked = selected.includes(guest.id);

          return (
            <label key={guest.id}>
              <input
                type="checkbox"
                name="attendee"
                value={guest.id}
                checked={checked}
                // The cap, enforced as an absence: an unchecked box stops being
                // selectable once the allowance is spent. Already-checked boxes
                // stay live so the household can swap one person for another.
                disabled={!checked && allowanceSpent}
                onChange={(event) => toggle(guest.id, event.target.checked)}
              />
              {guest.fullName}
              {guest.isChild ? " (niño o niña)" : ""}
            </label>
          );
        })}
      </fieldset>

      <label htmlFor="rsvp-dietary">
        Restricciones alimentarias (opcional)
      </label>
      <textarea
        id="rsvp-dietary"
        name="dietaryNotes"
        maxLength={DIETARY_NOTES_MAX_LENGTH}
        defaultValue={current?.dietaryNotes ?? ""}
      />

      <button type="submit" disabled={pending}>
        Enviar respuesta
      </button>

      {messages.length === 0 ? null : (
        // `role="alert"` so a screen reader announces the outcome; a guest who
        // cannot see the message has no other way to learn whether their answer
        // was saved.
        <div role="alert" className="rsvp__feedback">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </form>
  );
}
