"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  currentRsvpSentence,
  rsvpChoiceCopy,
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

/*
  THE ONE PART OF THIS PAGE THAT IS TYPED, NOT READ.

  `/transmision` took its credentials OFF a cream card, and was right to: an
  opaque island in the middle of the photograph is what broke the two pages
  looking like one, and its content is four values to copy.

  This is a radio group, a checkbox per member and a free-text field. A
  textarea with no border on a photograph is invisible, and a bare radio on a
  dark ground is a five-pixel target on a phone. So the form gets a surface —
  but a DEEPENING of the same ground rather than a sheet of paper laid on it:
  the photograph still shows through, and the controls have something to sit on.

  The control language is `StreamLink`'s pill, already the guest-facing one on
  `/` and `/transmision`. A third would have been a third wedding.
*/
const PANEL = `
  rounded-2xl bg-black/25 p-5 ring-1 ring-white/10 backdrop-blur-sm
  sm:p-6
`;

/*
  A CHOICE, AS A FULL-WIDTH ROW.

  The native input stays visible and is only sized and coloured. Hiding it
  behind a drawn substitute means re-implementing focus, and the 27 tests in
  this component's spec find every control by ROLE and accessible name — which
  is exactly what a hidden input quietly costs.

  `has-[:checked]:` lifts the row the moment its own input is checked, so the
  selected answer is legible at arm's length rather than by squinting at a dot.
*/
const CHOICE = `
  flex cursor-pointer items-center gap-3 rounded-xl border
  border-[#f6efe2]/20 bg-black/20 px-4 py-3 text-sm text-[#f6efe2]/90
  transition-colors duration-(--console-motion-fast)
  ease-(--ease-console-out)
  has-[:checked]:border-[#f6efe2]/60 has-[:checked]:bg-black/40
  has-[:checked]:text-[#f6efe2]
  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
  has-[:focus-visible]:outline-[#f6efe2]
`;

/** The small, quiet labels the invitation already uses for its three facts. */
const LEGEND = "text-xs tracking-[0.18em] text-[#f6efe2]/60 uppercase";

const CONTROL = "size-4 shrink-0 accent-[#f6efe2]";

/** Where the wedding happens. Only an attending household is told. */
export interface RsvpAnswerVenue {
  readonly name: string;
  readonly address: string;
}

export function RsvpAnswer({
  guests,
  current,
  ceremony,
  venue,
  action,
}: {
  readonly guests: readonly RsvpAnswerGuest[];
  readonly current: RsvpAnswerCurrent | null;
  /** The ceremony stream, shown in place of the form to a declining household. */
  readonly ceremony: CeremonyStreamDetails;
  /**
   * The place and its address, shown only once somebody says they are coming.
   *
   * IT LIVED IN THE INVITATION'S BODY, above this form, and every household saw
   * it before anybody had been asked anything. A household that cannot come does
   * not need a street, and handing one to everybody buries the question under
   * directions.
   *
   * It had to move HERE rather than stay there, and that is not arbitrary: the
   * answer is client state owned by this component, and the body is a Server
   * Component that cannot see it. The alternative was lifting the answer out of
   * the form, which would make a mostly-static page depend on a client boundary.
   */
  readonly venue: RsvpAnswerVenue;
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
    /*
      EVERYBODY, WHEN THERE IS NO ANSWER ON FILE YET.

      The boxes used to start EMPTY, so a household of three tapped five times:
      yes, three boxes, send. The invitation already NAMES those three — an
      empty list asked the household to repeat it back. Unchecking somebody who
      cannot come is the exception, and it is one tap.

      An answer already on file wins, obviously: a household that said two of
      three are coming must find that, not a form that quietly re-added the
      third.
    */
    current?.attendeeGuestIds ?? guests.map((guest) => guest.id),
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
  const openedRef = useRef<HTMLDivElement>(null);
  // A counter rather than a boolean: two answers in a row are two distinct
  // requests, and a boolean that is already `true` would produce no change for
  // the effect below to act on.
  //
  // It counts BOTH self-submitting answers now — a decline, and an acceptance
  // from an invitation that names one person. Both are answers with nothing
  // left to fill in.
  const [selfSubmits, setSelfSubmits] = useState(0);

  useEffect(() => {
    if (selfSubmits === 0) {
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
  }, [selfSubmits]);

  /**
   * WHAT OPENS IS BROUGHT INTO VIEW.
   *
   * The couple, on a phone: "se abre y se pierde la información, toca hacer un
   * scroll." The revealed block lands below the fold, so a household taps yes
   * and the screen appears not to have changed.
   *
   * `block: "nearest"` rather than `"start"`: the question they just answered
   * should stay on screen above what it opened, not be pushed off the top by
   * it.
   *
   * GUARDED, because `scrollIntoView` is not implemented in every environment
   * this renders in — jsdom has no layout at all — and a screen that scrolls is
   * worth nothing if the page throws on the way.
   */
  useEffect(() => {
    if (attending !== "yes") {
      return;
    }

    openedRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
    });
  }, [attending]);

  useEffect(() => {
    if (feedback.status !== "recorded") {
      return;
    }

    setAnswerOnFile(submittedAnswer.current);
    setReconsidering(false);
  }, [feedback]);

  const isAttending = attending === "yes";
  /*
    ONE PERSON IS ASKED A DIFFERENT QUESTION, AND SHOWN A SHORTER FORM.

    The copy is the domain's, beside the other two sentences a member count
    already decides. The list of who is coming is not rendered at all: there is
    no choice to make, because the only person who could attend has just said
    they are. A checkbox there is a question with one answer that the guest
    still has to find and press before the form will submit.
  */
  const soloGuest = guests.length === 1 ? guests[0] : undefined;
  const choice = rsvpChoiceCopy(guests.length);
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
    setSelfSubmits((requests) => requests + 1);
  }

  /**
   * A SOLO INVITATION CONFIRMS ON THE FIRST TAP, LIKE A DECLINE.
   *
   * There is nothing left to choose: one person, one seat, and the hidden field
   * below already names them. The second tap carried no information, which is
   * the definition of friction — the couple counted it: "evitándose un click de
   * más".
   *
   * SAFE FOR THE REASON THE DECLINE IS SAFE, and only for that reason. A
   * mis-tap here cannot store a wrong NUMBER, because the only person who could
   * attend is attending. A HOUSEHOLD keeps its explicit send: there a mis-tap
   * would confirm seats the couple then cook for, and the send is the one place
   * a wrong number can be caught before it is recorded.
   */
  function acceptNow() {
    setAttending("yes");
    setSelfSubmits((requests) => requests + 1);
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
    return (
      <CeremonyStream
        ceremony={ceremony}
        memberCount={guests.length}
        onReconsider={reconsider}
      />
    );
  }

  return (
    <form
      ref={formRef}
      action={record}
      className={`rsvp__form flex flex-col gap-5 ${PANEL}`}
    >
      <h2 className="font-display text-xl text-[#f6efe2] sm:text-2xl">
        Confirmen su asistencia
      </h2>

      {answered === null ? null : (
        <p className="rsvp__current text-sm text-[#f6efe2]/75">{answered}</p>
      )}

      <fieldset className="rsvp__attending m-0 flex flex-col gap-2 border-0 p-0">
        <legend className={LEGEND}>{choice.question}</legend>
        <label className={CHOICE}>
          <input
            className={CONTROL}
            type="radio"
            name="attending"
            value="yes"
            checked={attending === "yes"}
            onChange={
              soloGuest === undefined ? () => setAttending("yes") : acceptNow
            }
            required
          />
          {choice.yes}
        </label>
        <label className={CHOICE}>
          <input
            className={CONTROL}
            type="radio"
            name="attending"
            value="no"
            checked={attending === "no"}
            onChange={declineNow}
            required
          />
          {choice.no}
        </label>
      </fieldset>

      {/*
        NOTHING BELOW EXISTS UNTIL THE QUESTION ABOVE IS ANSWERED YES.

        This whole block used to be on screen from the first paint, with the
        attendee list `disabled` and dimmed. The browser honoured that and a
        reader did not: it looked like a control refusing to work rather than
        like a question that was not theirs yet. The couple asked for the rest
        to open only "una vez den click en lo afirmativo".

        A decline needs none of it. It submits on the first tap — see
        `declineNow` — and a decline names nobody and holds no seats, so there
        is genuinely nothing here for it to fill in.

        REMOVED RATHER THAN DISABLED, and that makes `declineNow`'s own note
        about payload timing stronger rather than obsolete: a fieldset that is
        not mounted cannot contribute a name to the payload at all.
      */}
      {!isAttending ? null : (
        <div ref={openedRef} className="flex flex-col gap-5">
          {/*
            WHERE TO GO, NOW THAT THEY HAVE SAID THEY ARE COMING.

            A list rather than a paragraph, because that is what it is: two
            labels and two values, with the value carrying the weight so the
            eye lands on the street rather than on the word "Dirección".

            The labels are visible rather than `sr-only`. A venue name and a
            street address are not self-evident from their shape, and a guest
            scanning for where to go needs the word as much as the value.
          */}
          <dl className="rsvp__venue m-0 flex flex-col gap-3 text-center">
            <div className="flex flex-col gap-0.5">
              <dt className={LEGEND}>Lugar</dt>
              <dd className="m-0 text-sm text-[#f6efe2] sm:text-base">
                {venue.name}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className={LEGEND}>Dirección</dt>
              <dd className="m-0 text-sm text-[#f6efe2] sm:text-base">
                {venue.address}
              </dd>
            </div>
          </dl>

          {soloGuest === undefined ? (
            <fieldset className="rsvp__attendees m-0 flex flex-col gap-2 border-0 p-0">
              <legend className={LEGEND}>¿Quiénes asisten?</legend>
              <p className="rsvp__seats text-xs text-[#f6efe2]/70">
                {seatsSelectionSentence(selected.length, guests.length)}
              </p>
              {guests.map((guest) => {
                const checked = selected.includes(guest.id);

                return (
                  <label className={CHOICE} key={guest.id}>
                    <input
                      className={CONTROL}
                      type="checkbox"
                      name="attendee"
                      value={guest.id}
                      checked={checked}
                      // The cap, enforced as an absence: an unchecked box stops being
                      // selectable once the allowance is spent. Already-checked boxes
                      // stay live so the household can swap one person for another.
                      disabled={!checked && allowanceSpent}
                      onChange={(event) =>
                        toggle(guest.id, event.target.checked)
                      }
                    />
                    {guest.fullName}
                    {/*
                THE SPACE IS OUTSIDE THE SPAN, AND THAT IS NOT FUSSINESS.

                Accessible-name computation TRIMS each element's text before
                joining, so a space inside the span is discarded and a screen
                reader announces "Sara Aguirre(niño o niña)". As a sibling text
                node it survives. The spec asserting that the form and the
                couple's own list read alike caught exactly this.
              */}
                    {guest.isChild ? (
                      <>
                        {" "}
                        <span className="text-[#f6efe2]/60">(niño o niña)</span>
                      </>
                    ) : (
                      ""
                    )}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            /*
              THE SEAT IS STILL NAMED, BECAUSE THE DATABASE COUNTS NAMES.

              `seats_confirmed` is derived from the attendees and must EQUAL
              their number (migration 0007). A solo invitation that submitted
              no name would record an accepted answer holding zero seats — a
              household the couple would then cook for nobody. The payload is
              byte for byte the one a single ticked box produced.
            */
            <input type="hidden" name="attendee" value={soloGuest.id} />
          )}

          {/*
            THE DIETARY FIELD STOOD HERE, AND THE COUPLE REMOVED IT: "podríamos
            quitar lo de restricciones alimentarias."

            It was the one thing on this form that asked a household to TYPE
            rather than to choose, and it asked it of everybody who said yes.

            `rsvp_responses.dietary_notes` STAYS. The column is nullable, the
            payload schema accepts a missing value as null, and dropping a
            column to remove a field is a migration that buys nothing — and
            forecloses asking again.
          */}

          {/*
            FULL WIDTH, because on a phone this is the one thing the whole page
            exists to have pressed, and it sat inline at the end of a
            paragraph.
          */}
          <button
            className="
              w-full rounded-full border border-[#f6efe2]/40 bg-[#f6efe2]/10
              px-5 py-3 text-sm text-[#f6efe2] backdrop-blur-sm
              transition-colors duration-(--console-motion-fast)
              ease-(--ease-console-out)
              hover:bg-[#f6efe2]/20
              focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[#f6efe2]
              disabled:opacity-50
            "
            type="submit"
            disabled={pending}
          >
            Enviar respuesta
          </button>
        </div>
      )}

      {messages.length === 0 ? null : (
        // `role="alert"` so a screen reader announces the outcome; a guest who
        // cannot see the message has no other way to learn whether their answer
        // was saved.
        <div
          role="alert"
          className="rsvp__feedback flex flex-col gap-1 text-sm text-[#f6efe2]"
        >
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </form>
  );
}
