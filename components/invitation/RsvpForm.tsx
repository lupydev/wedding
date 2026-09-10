"use client";

import { useActionState, useState } from "react";

import {
  currentRsvpSentence,
  rsvpFeedbackMessages,
  seatsSelectionSentence,
  type RsvpFeedback,
} from "@/lib/domain/rsvp-copy";

/**
 * The RSVP form.
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
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** One named person on the invitation. No phone field exists on this type. */
export interface RsvpFormGuest {
  readonly id: string;
  readonly fullName: string;
  readonly isChild?: boolean;
}

/** The household's answer as it currently stands, or `null` if they have none. */
export interface RsvpFormCurrent {
  readonly attending: boolean;
  readonly seatsConfirmed: number;
  readonly attendeeGuestIds: readonly string[];
  readonly dietaryNotes: string | null;
  readonly message: string | null;
}

export type RsvpFormAction = (
  previous: RsvpFeedback,
  formData: FormData,
) => Promise<RsvpFeedback>;

const IDLE: RsvpFeedback = { status: "idle" };

/** Mirrors the `char_length` CHECK constraints on `rsvp_responses`. */
const DIETARY_NOTES_MAX_LENGTH = 500;
const MESSAGE_MAX_LENGTH = 1000;

export function RsvpForm({
  guests,
  seatsAllowed,
  current,
  action,
}: {
  readonly guests: readonly RsvpFormGuest[];
  readonly seatsAllowed: number;
  readonly current: RsvpFormCurrent | null;
  readonly action: RsvpFormAction;
}) {
  const [feedback, submit, pending] = useActionState(action, IDLE);

  // The attendance choice and the checked set are local state rather than
  // uncontrolled inputs because both drive what the rest of the form allows:
  // declining disables the list, and spending the allowance disables what is
  // left of it. A disabled control that the browser then omits from the
  // payload is exactly the behaviour wanted here — a decline submits no names.
  const [attending, setAttending] = useState<"yes" | "no" | "">(
    current === null ? "" : current.attending ? "yes" : "no",
  );
  const [selected, setSelected] = useState<readonly string[]>(
    current?.attendeeGuestIds ?? [],
  );

  const isAttending = attending === "yes";
  const allowanceSpent = selected.length >= seatsAllowed;
  const answered = currentRsvpSentence(current);
  const messages = rsvpFeedbackMessages(feedback);

  function toggle(guestId: string, checked: boolean) {
    setSelected((previous) =>
      checked
        ? previous.includes(guestId)
          ? previous
          : [...previous, guestId]
        : previous.filter((id) => id !== guestId),
    );
  }

  return (
    <form action={submit} className="rsvp__form">
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
            onChange={() => setAttending("no")}
            required
          />
          No podremos acompañarlos
        </label>
      </fieldset>

      <fieldset className="rsvp__attendees" disabled={!isAttending}>
        <legend>¿Quiénes asisten?</legend>
        <p className="rsvp__seats">
          {seatsSelectionSentence(selected.length, seatsAllowed)}
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

      <label htmlFor="rsvp-message">Mensaje para los novios (opcional)</label>
      <textarea
        id="rsvp-message"
        name="message"
        maxLength={MESSAGE_MAX_LENGTH}
        defaultValue={current?.message ?? ""}
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
