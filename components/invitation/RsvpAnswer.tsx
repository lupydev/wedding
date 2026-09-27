"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { greetingLine } from "@/lib/domain/greeting-name";
import {
  currentRsvpSentence,
  rsvpChoiceCopy,
  rsvpConfirmedHeading,
  rsvpDeadlineSentence,
  rsvpFeedbackMessages,
  seatsSelectionSentence,
  type RsvpFeedback,
} from "@/lib/domain/rsvp-copy";

import { CeremonyStream, type CeremonyStreamDetails } from "./CeremonyStream";
import { InvitationGreeting } from "./InvitationGreeting";
import { RsvpConfirmed } from "./RsvpConfirmed";

/**
 * The RSVP surface, and the state machine behind the invitation's four screens.
 *
 * The second and last Client Component on the public route, and — like
 * `GateForm` — it holds no invitation data beyond what it renders and receives
 * its action as a prop. The page binds the slug to the Server Action on the
 * server, so the household being answered for is never a client-supplied value.
 *
 * ONE SCREEN AT A TIME, AND THAT IS THE CHANGE THIS FILE EXISTS TO CARRY.
 *
 * Everything below used to be one document: the announcement, the household's
 * names, the question, the venue, the map, the attendee checkboxes, the submit
 * button and a deadline footnote, stacked. On an iPhone 14 that was 1663 pixels
 * against 664 of screen — two and a half viewports — while the landing page the
 * couple asked this to match is exactly one. Close to every guest opens this
 * from a WhatsApp message on a phone, so "below the fold" here means "most
 * people never see it".
 *
 * So the question is asked one screen at a time:
 *
 *   `question`  — the announcement, and one question with two answers.
 *   `attendees` — who is coming, and the send button. Nothing else.
 *   `confirmed` — when, what to wear, and where to go.
 *   `stream`    — for a household that cannot come, how to be there anyway.
 *
 * AND THE TOP LINE OF THE SCREEN IS THIS COMPONENT'S TOO, WHICH IT WAS NOT.
 * `InvitationBody` painted "¡Hola, <name>!" above the slot on every screen
 * alike. The couple asked the LAST one to say "Te esperamos, <name>" in that
 * same place — and which screen is showing is state only this component holds,
 * so the body hands the placement over (`greetingOwner="step"`) and the line
 * is chosen here, beside the `step` that decides it.
 *
 * Each screen carries only what a household needs in order to do the one thing
 * it is being asked to do, which is also why the announcement is a SLOT rather
 * than an import: it belongs to the first screen and is 250 pixels the other
 * three must not pay for.
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

/** What the household has answered, as far as this page knows. */
type Answer = "yes" | "no" | "";

/**
 * Which of the invitation's four screens is showing.
 *
 * Derived, never stored. Two pieces of state decide it — the answer ON FILE and
 * the answer being given — and a third variable that had to be kept in step
 * with them would be the one that got it wrong.
 */
type RsvpStep = "question" | "attendees" | "confirmed" | "stream";

/*
  THE ONE PART OF THIS PAGE THAT IS TYPED, NOT READ.

  `/transmision` took its credentials OFF a cream card, and was right to: an
  opaque island in the middle of the photograph is what broke the two pages
  looking like one, and its content is four values to copy.

  This is a radio group and a checkbox per member. A bare radio on a dark ground
  is a five-pixel target on a phone. So the controls get a surface — but a
  DEEPENING of the same ground rather than a sheet of paper laid on it: the
  photograph still shows through, and the controls have something to sit on.

  It earns more now than it did. The photograph is no longer a strip at the top
  of the page; it fills the screen behind every one of these words, so the panel
  is what keeps a radio legible over a lit waterfall.

  The control language is `StreamLink`'s pill, already the guest-facing one on
  `/` and `/transmision`. A third would have been a third wedding.

  IT CARRIES A CLASS OF ITS OWN NOW, and it is not decoration: both screens
  moved this pass — the question's card to the foot of the photograph, the
  list of who is coming to the top of it — so what is BEHIND the card changed
  on each. `app/i/[slug]/step-legibility.spec.tsx` measures the words on it
  against the pixels at its new position, and it needs something to find it
  by. The gate's ground has had one since U35 for the same reason.

  AND `bg-black/25` WAS NOT A GROUND, WHICH THE MEASUREMENT FOUND RATHER THAN
  THE MOVE. U35 wrote that this panel "has been fine at `bg-black/25` since
  U34: it sits at 70%–95%, where the bottom scrim is already carrying 60% to
  90% of the load." Both halves are wrong, and nothing had ever measured
  them. On an iPhone 14 the question's card was at 57%–96% BEFORE this pass —
  measured against a build of `19d67f2` — so it already covered the brightest
  pixel in the frame, the #FAF8EF edge of Michell's dress at 62%, the same
  pixel U35 gave the gate a card for. Cream on `bg-black/25` over that is
  2.5:1; the screens moved this pass, and at their new positions it is 1.7:1.
  WCAG holds body text to 4.5:1 either way.

  So the card takes the gate's own ground — `#0d1114` at 70%, which measures
  6.4:1 against that same pixel — and the four quiet opacities that sat on it
  came up with it: the line naming the current answer and the seats sentence
  to `/80`, the child marker to `/70`, the send button's edge to `/60`. Each
  of those is a number in `step-legibility.spec.tsx` rather than a
  preference.

  `lg:bg-black/25` PUTS THE DESKTOP BACK. Above the breakpoint the words are
  in their own column beside a framed print, where the brightest pixel under
  the card is #2F271F and the old value already measures 5.8:1 — the same
  reason `PhotoStage` drops its scrims and the gate drops its ground at `lg`.
  `declaredColor` reads the unconditional token and ignores the variant, so
  what the spec measures is the phone, which is where this is read.
*/
const PANEL = `
  rsvp__panel rounded-2xl bg-[#0d1114]/70 p-5 ring-1 ring-white/10
  backdrop-blur-sm
  sm:p-6
  lg:bg-black/25
`;

/*
  A CHOICE, AS A FULL-WIDTH ROW.

  The native input stays visible and is only sized and coloured. Hiding it
  behind a drawn substitute means re-implementing focus, and the tests in this
  component's spec find every control by ROLE and accessible name — which is
  exactly what a hidden input quietly costs.

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

/*
  A `LEGEND` CONSTANT STOOD HERE — the small uppercase label the form used for
  its three fieldsets and for the venue's own list.

  Two of those three legends are the HEADING of their screen now, so they are
  set in the display face at the size the question deserves; the third moved to
  `RsvpConfirmed` with the venue. Nothing left in this file uses the quiet
  style, and a shared constant with one caller is a shared constant waiting to
  be reached for by mistake.
*/

const CONTROL = "size-4 shrink-0 accent-[#f6efe2]";

const SEND = `
  w-full rounded-full border border-[#f6efe2]/60 bg-[#f6efe2]/10
  px-5 py-3 text-sm text-[#f6efe2] backdrop-blur-sm
  transition-colors duration-(--console-motion-fast)
  ease-(--ease-console-out)
  hover:bg-[#f6efe2]/20
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-[#f6efe2]
  disabled:opacity-50
`;

/** Where the wedding happens. Only an attending household is told. */
export interface RsvpAnswerVenue {
  readonly name: string;
}

export function RsvpAnswer({
  guests,
  greetingName,
  current,
  ceremony,
  venue,
  announcement,
  action,
}: {
  readonly guests: readonly RsvpAnswerGuest[];
  /**
   * How this household is addressed, which is the top line of every screen.
   *
   * A string rather than a rendered node, because this component does not
   * merely place it — it CHOOSES it: three of the four screens greet the
   * household and the fourth tells them they are expected. A node handed down
   * ready-made could only ever be the greeting.
   *
   * It is the same value `InvitationBody` and the gate are given, resolved
   * once on the server. Nothing here derives or reformats it.
   */
  readonly greetingName: string;
  readonly current: RsvpAnswerCurrent | null;
  /** The ceremony stream, shown in place of the form to a declining household. */
  readonly ceremony: CeremonyStreamDetails;
  /**
   * The place, shown only once somebody says they are coming.
   *
   * IT LIVED IN THE INVITATION'S BODY, above this form, and every household saw
   * it before anybody had been asked anything. A household that cannot come does
   * not need directions, and handing them to everybody buries the question.
   *
   * It had to move HERE rather than stay there, and that is not arbitrary: the
   * answer is client state owned by this component, and the body is a Server
   * Component that cannot see it.
   *
   * THE STREET IS GONE FROM IT. It used to carry `address` too; `RsvpConfirmed`
   * records why a venue with no street address is better served by a map alone.
   */
  readonly venue: RsvpAnswerVenue;
  /**
   * The wedding, announced — rendered on the FIRST screen and on no other.
   *
   * A slot rather than an import, for two reasons that point the same way. It
   * is a Server Component tree (`SaveTheDate` and its countdown), so composing
   * it here would pull it across the client boundary for no gain. And the
   * operator preview renders the same block without ever rendering this
   * component, so the announcement has to be something a route can hand to
   * either surface.
   *
   * Optional, because the console preview passes no RSVP at all and a future
   * caller that wants only the question should not have to invent one.
   */
  readonly announcement?: ReactNode;
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

      An ACCEPTED answer already on file wins, obviously: a household that said
      two of three are coming must find that, not a form that quietly re-added
      the third.

      A DECLINE IS NOT AN ANSWER ABOUT WHO, and `??` does not fall back for an
      empty array. A recorded decline stores an empty attendee list by
      construction — it confirms zero seats — so seeding from it handed a
      household that declines and then reconsiders an empty set of boxes: the
      exact friction this default removes, in the one case where somebody is
      changing their mind, which is when a form should be at its most helpful.
    */
    current !== null && current.attending
      ? current.attendeeGuestIds
      : guests.map((guest) => guest.id),
  );

  // The answer ON FILE, which is what decides the screen. It starts as the row
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
    // builds the payload AFTER React has swapped the screen. A synchronous
    // `requestSubmit` would send the boxes the household had checked under
    // their previous "yes" — the server drops them anyway, but a payload that
    // says "we cannot come, and here are two of us" is a payload one refactor
    // away from reaching the database and failing its
    // `rsvp_declined_has_zero_seats` constraint as a 500.
    formRef.current?.requestSubmit();
  }, [selfSubmits]);

  /*
    A `scrollIntoView` EFFECT STOOD HERE, AND ITS REMOVAL IS THE POINT OF THE
    WHOLE UNIT.

    "se abre y se pierde la información, toca hacer un scroll" — the couple, on
    a phone, watching the venue and the map open 322 pixels below the fold. The
    effect brought the revealed block into view, which was the right fix for a
    page that scrolled.

    Nothing opens below the fold any more: choosing an answer REPLACES the
    screen rather than extending it. Code that scrolls a document the layout
    guarantees is exactly one viewport tall is code that can only ever move a
    page that has gone wrong, and `e2e/invitation-one-screen.spec.ts` is what
    says it has not.
  */

  useEffect(() => {
    if (feedback.status !== "recorded") {
      return;
    }

    setAnswerOnFile(submittedAnswer.current);
    setReconsidering(false);
  }, [feedback]);

  /*
    ONE PERSON IS ASKED A DIFFERENT QUESTION, AND SHOWN A SHORTER FORM.

    The copy is the domain's, beside the other sentences a member count already
    decides. The list of who is coming is not rendered at all: there is no
    choice to make, because the only person who could attend has just said they
    are. A checkbox there is a question with one answer that the guest still has
    to find and press before the form will submit.
  */
  const soloGuest = guests.length === 1 ? guests[0] : undefined;
  const choice = rsvpChoiceCopy(guests.length);
  // The cap IS this household's membership since migration 0012, so there is
  // nothing to compare the selection against but the list already rendered.
  const allowanceSpent = selected.length >= guests.length;
  const answered = currentRsvpSentence(current);
  const messages = rsvpFeedbackMessages(feedback);

  /*
    THE SCREEN, DERIVED FROM THE TWO ANSWERS THIS COMPONENT KNOWS ABOUT.

    `answerOnFile` is what the couple's list says and it wins, unless the
    household has explicitly asked to answer again. Only then does the answer
    being GIVEN decide anything, and the only thing it decides is whether the
    household is still choosing yes-or-no or is already choosing who.

    A refused submission leaves `answerOnFile` untouched on purpose, so a
    rejection keeps the household on the screen whose control it needs to
    change rather than advancing them past it.
  */
  /*
    AND A SOLO INVITATION HAS NO THIRD SCREEN AT ALL, WHICH IS THE COUPLE'S
    OWN INSTRUCTION READ LITERALLY.

    It used to pass THROUGH `attendees` on its way to the directions. Nobody
    had to tap anything there — `acceptNow` submits from an effect — but the
    screen still rendered for as long as the Server Action was in flight: a
    card holding one hidden field, a send button that was pressing itself, and
    a way back. A flash of a screen that exists for a choice this household
    does not have.

    So the affirmative submits from the QUESTION screen instead, exactly the
    way a decline already did, and `soloGuest` never reaches `attendees`. The
    hidden `attendee` field moved to the question screen with it, so the
    payload is byte for byte the one that screen used to send.
  */
  const settled = !reconsidering;
  const step: RsvpStep =
    settled && answerOnFile === "no"
      ? "stream"
      : settled && answerOnFile === "yes"
        ? "confirmed"
        : attending === "yes" && soloGuest === undefined
          ? "attendees"
          : "question";

  /*
    THE TOP LINE OF WHICHEVER SCREEN IS SHOWING.

    Three of the four greet the household. The fourth replaces the greeting
    rather than adding a heading under it — "en vez de decir: hola, nombre de
    la invitación", the couple — so this is one element with two possible
    lines, never two elements with one hidden.

    The plural keys off `guests.length`, which is the size of the INVITATION.
    Not `selected`, and not the seats the answer recorded: a household of three
    of whom one can come is still addressed as the three people the couple
    invited. `rsvpConfirmedHeading` carries the long version of that.
  */
  const greeting = (
    <InvitationGreeting>
      {step === "confirmed"
        ? rsvpConfirmedHeading(guests.length, greetingName)
        : greetingLine(greetingName)}
    </InvitationGreeting>
  );

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
   * on the next screen already names them. The second tap carried no
   * information, which is the definition of friction — the couple counted it:
   * "evitándose un click de más".
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
   * Back to the question, with nothing preselected.
   *
   * Auto-submitting means one mis-tap records a decline instantly, so the way
   * back sits beside the consequence — on the stream screen and, since the
   * accepted answer got a screen of its own, on that one too.
   *
   * Clearing the choice is deliberate: a mis-tap must not be one more tap away
   * from repeating itself, and re-choosing "no" has to be a real change that
   * fires the auto-submit again.
   *
   * Responses are append-only, so a correction writes a NEW row. The couple
   * still sees that the household changed its mind, which is the information
   * they want and the reason offering this is safe.
   */
  function reconsider() {
    setReconsidering(true);
    setAttending("");
  }

  /**
   * WHAT A SUBMISSION SAID, WHEN IT WENT WRONG.
   *
   * Rendered on whichever screen the household is standing on, because a
   * refusal they cannot see is a form that silently does nothing. Never on the
   * two screens that come AFTER a recorded answer: "¡Listo! Guardamos su
   * respuesta." under a heading that already says the couple are expecting them
   * is the same sentence twice.
   *
   * IT RESERVES ITS OWN SPACE, and that is the whole reason it is a function
   * rather than three copies of a `<div>`. An alert that mounts on submit adds
   * height with no warning — 82 pixels, measured — and this page's promise is
   * that a screen is a screen. The slot is there from the first paint, holding
   * nothing.
   */
  function feedbackRegion() {
    return (
      <div
        // `role="alert"` so a screen reader announces the outcome; a guest who
        // cannot see the message has no other way to learn whether their answer
        // was saved.
        role="alert"
        className="rsvp__feedback flex min-h-10 flex-col justify-center gap-1 text-sm text-[#f6efe2]"
      >
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    );
  }

  if (step === "stream") {
    return (
      <>
        {greeting}
        <div
          className="rsvp flex flex-1 flex-col justify-end"
          data-rsvp-step={step}
        >
          <CeremonyStream
            ceremony={ceremony}
            memberCount={guests.length}
            onReconsider={reconsider}
          />
        </div>
      </>
    );
  }

  if (step === "confirmed") {
    return (
      <>
        {greeting}
        <div className="rsvp flex flex-1 flex-col" data-rsvp-step={step}>
          {/*
            NO WAY BACK FROM HERE, ON THE COUPLE'S INSTRUCTION.

            This screen used to take `onReconsider` and offer "Volver a
            responder" the way the stream screen does. `RsvpConfirmed` records
            what that costs a household that changes its mind. `reconsider`
            itself stays: the stream screen and the way back from the list of
            who is coming both still call it.
          */}
          <RsvpConfirmed venueName={venue.name} />
        </div>
      </>
    );
  }

  const asking = step === "question";

  return (
    /*
      THE FORM SPANS THE SCREEN AND PUTS ITS TWO GROUPS AT THE TWO ENDS OF IT.

      The landing page's composition, which is what the couple asked this page
      to look like — and, since they looked at it on a phone, what they asked
      for a second time and for a different reason: "los bloques quedan sobre
      la mitad de la foto y nos tapan". Everything used to sit in one block
      near the middle of the frame, which is exactly where the two of them are
      standing.

      So every screen here is `justify-between` over two children, and the
      middle belongs to the photograph. On the question screen that is the
      announcement and the card with the two answers under it; on the screen
      that asks who is coming it is the card and the way back.
    */
    <>
      {greeting}
      <form
        ref={formRef}
        action={record}
        data-rsvp-step={step}
        className="rsvp rsvp__form flex flex-1 flex-col justify-between gap-6"
      >
        {asking ? (
          <>
            {announcement}

            {/*
              THE CARD AND THE DEADLINE, AS ONE GROUP AT THE FOOT.

              Two siblings of the announcement rather than one would spread
              three ways and put the card back in the middle of the
              photograph, which is the thing being fixed.
            */}
            <div className="flex flex-col gap-3">
              <div className={`flex flex-col gap-4 ${PANEL}`}>
                {answered === null ? null : (
                  <p className="rsvp__current text-sm text-[#f6efe2]/80">
                    {answered}
                  </p>
                )}

                <fieldset className="rsvp__attending m-0 flex flex-col gap-2 border-0 p-0">
                  {/*
                    THE QUESTION IS THE `h2` OF THIS SCREEN NOW.

                    "Confirmen su asistencia" stood above it as a heading,
                    which said the same thing as the question underneath in
                    slightly different words. One screen, one question, asked
                    once.
                  */}
                  <legend className="font-display text-xl text-[#f6efe2] sm:text-2xl">
                    {choice.question}
                  </legend>
                  <label className={CHOICE}>
                    <input
                      className={CONTROL}
                      type="radio"
                      name="attending"
                      value="yes"
                      checked={attending === "yes"}
                      onChange={
                        soloGuest === undefined
                          ? () => setAttending("yes")
                          : acceptNow
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
                  THE SEAT A SOLO INVITATION CONFIRMS, NAMED FROM THIS SCREEN.

                  `seats_confirmed` is derived from the attendees and must
                  EQUAL their number (migration 0007), so an acceptance that
                  named nobody would record a household the couple then cook
                  for nobody. This used to live on the screen after the
                  question; a solo invitation no longer has one, so the field
                  came here with the submission.

                  Only while the answer is "yes". A decline auto-submits from
                  this same screen, and a payload reading "we cannot come, and
                  here is one of us" is one refactor away from failing the
                  `rsvp_declined_has_zero_seats` constraint as a 500.
                */}
                {soloGuest !== undefined && attending === "yes" ? (
                  <input type="hidden" name="attendee" value={soloGuest.id} />
                ) : null}

                {feedbackRegion()}
              </div>

              {/*
                THE DEADLINE, OUT OF THE CARD AND UNDER IT.

                It was the last line of a page two and a half screens tall, set
                in `text-xs` at 70% opacity — small print under content most
                guests never reached. U34 brought it up beside the question;
                the couple have now asked for the card to hold the two answers
                and nothing else, so the sentence sits on the photograph
                directly below it. Full-strength cream with the shadow every
                other line on bare photograph carries, and measured there
                rather than assumed: see `step-legibility.spec.tsx`.
              */}
              <p className="rsvp__deadline text-sm text-[#f6efe2] [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
                {rsvpDeadlineSentence(guests.length)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className={`flex flex-col gap-4 ${PANEL}`}>
              {/*
              THE ANSWER TRAVELS AS A HIDDEN FIELD ONCE THE RADIOS ARE GONE.

              The radio group belongs to the screen before this one, and an
              unmounted control contributes nothing to a payload — so the
              affirmative has to be restated here or the server would receive a
              submission with no `attending` at all. The value is not a second
              opinion: this branch is only reachable while `attending` is
              "yes".
            */}
              <input type="hidden" name="attending" value="yes" />

              <fieldset className="rsvp__attendees m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="font-display text-xl text-[#f6efe2] sm:text-2xl">
                  ¿Quiénes asisten?
                </legend>
                <p className="rsvp__seats text-xs text-[#f6efe2]/80">
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
                        THE SPACE IS OUTSIDE THE SPAN, AND THAT IS NOT
                        FUSSINESS.

                        Accessible-name computation TRIMS each element's text
                        before joining, so a space inside the span is
                        discarded and a screen reader announces "Sara
                        Aguirre(niño o niña)". As a sibling text node it
                        survives. The spec asserting that the form and the
                        couple's own list read alike caught exactly this.
                      */}
                      {guest.isChild ? (
                        <>
                          {" "}
                          <span className="text-[#f6efe2]/70">
                            (niño o niña)
                          </span>
                        </>
                      ) : (
                        ""
                      )}
                    </label>
                  );
                })}
              </fieldset>

              {/*
                FULL WIDTH, because on a phone this is the one thing the whole
                screen exists to have pressed.
              */}
              <button className={SEND} type="submit" disabled={pending}>
                Enviar respuesta
              </button>

              {feedbackRegion()}
            </div>

            {/*
              THE WAY BACK, AT THE FOOT OF THE SCREEN AND OUTSIDE THE CARD.

              The radio group used to stay visible above the checkboxes, so a
              household that tapped "yes" by mistake simply tapped "no". With
              one screen per step that escape disappeared, and a household
              with no way to change its mind would have to close the
              invitation and open it again.

              The couple moved it off the card: "el bloque de quiénes asisten
              arriba, y volver a la pregunta abajo." So it stands alone on the
              photograph, which is a different reading surface — full cream
              with the shadow the other bare-photograph lines carry, measured
              in `step-legibility.spec.tsx` rather than assumed. It was 70%
              cream while it sat on the card; U35 recorded the same move for
              the gate's own way out, and the same answer.
            */}
            <button
              className="
                rsvp__back self-center text-xs text-[#f6efe2] underline
                underline-offset-4 transition-colors
                duration-(--console-motion-fast)
                [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]
                hover:text-[#f6efe2]
                focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-[#f6efe2]
              "
              onClick={reconsider}
              type="button"
            >
              Volver a la pregunta
            </button>
          </>
        )}
      </form>
    </>
  );
}
