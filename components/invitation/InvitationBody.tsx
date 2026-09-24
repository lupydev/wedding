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

import { RSVP_DEADLINE_TEXT } from "@/lib/domain/wedding-day";
import { SaveTheDate } from "@/components/landing/SaveTheDate";

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
  readonly greetingName: string;
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
  /*
    THE DAY, THE VENUE AND ITS ADDRESS USED TO BE DECLARED HERE TOO.

    The day is stated by the announcement now, and the venue and its address
    reach `RsvpAnswer` directly, because only a household that says it is
    coming is told where to go. A prop this component no longer renders is a
    lie about where a value comes from.
  */
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
    /*
      THE LANDING'S LANGUAGE, ON THE INVITATION.

      Cream on the photograph's own darkness, the script face for the couple's
      line, the display face for the salutation. The three public pages are read
      one after another, so a guest arriving here from a message and walking to
      the stream page from inside it should not cross three visual identities.

      The classes the browser suite and the console preview point at —
      `invitation__rsvp`, `invitation__household` — are kept exactly. They are
      how those tests tell one section from another, and a rename here is a
      silent failure over there.

      `lg:py-[7dvh]` MATCHES THE PRINT'S OWN OFFSET. The framed photograph
      sticks at `top-[7dvh]`, so the same measure here puts the couple's line
      level with the top of the picture instead of against the browser chrome.
      One number, used twice, rather than two that drift.
    */
    <article
      /*
        THE MEASURE IS THE PHONE'S, AND IT LIFTS AT `lg` FOR THE SAME REASON
        THE GATE'S DOES.

        `max-w-md` — 448px — keeps the lines readable on a narrow screen. Now
        that this page carries the announcement, the names are set at
        `text-6xl` above the breakpoint, and "Luis & Michell" at that size does
        not fit in 448px: it broke after the ampersand, which reads as a
        mistake in the middle of the couple's own names. Exactly the defect
        `InvitationGate` records and fixes the same way; the grid column has
        the room.
      */
      className="
        invitation mx-auto flex w-full max-w-md flex-col gap-8 px-6 pt-8
        pb-[max(1.75rem,env(safe-area-inset-bottom))] text-[#f6efe2]
        sm:pt-12 sm:pb-10
        lg:max-w-none lg:justify-center lg:px-4 lg:py-[7dvh]
      "
    >
      {/*
        THE ANNOUNCEMENT THE GATE MAKES, KEPT ON THE PAGE BEHIND IT.

        The couple, having read both a tap apart: "quisiera que en esta última
        página se conserve". The gate opened with the greeting, "Nos casamos",
        the names, the day and the counter; this page opened with a household's
        name and a line of prose. A guest who answers the question is the one
        person guaranteed to read this page, so it is the last place the
        announcement should be the thinner of the two.

        SHARED RATHER THAN REPRODUCED, for the reason `SaveTheDate` gives for
        its own existence: four copies of those elements would match today and
        drift on the first tweak to any of them.

        THE SCRIPT COUPLE LINE THAT USED TO BE HERE IS GONE, AND THAT IS NOT A
        DELETION. `SaveTheDate` renders the same names, larger, and now from
        this page's own `ceremony` row rather than from the constant — so the
        fact is still here, said once instead of twice, and still the one an
        operator can correct.
      */}
      <header className="flex flex-col items-center gap-6 text-center">
        {/*
          ON A LAPTOP ONLY, BECAUSE ON A PHONE IT IS ON THE PHOTOGRAPH.

          The couple asked for the greeting to sit over the picture on a phone:
          in `band` the photograph is a strip and the words start beneath it, so
          this line sat under the picture with a band of empty ground above it.
          The route passes the same greeting to the stage's `overPhoto` slot,
          which renders it over the strip and hides itself at `lg`.

          TWO ELEMENTS, ONE STRING, AND ONLY ONE IS EVER ANNOUNCED. Both are
          `display: none` on the side they do not belong to, which assistive
          technology honours — so a reader meets the greeting once, wherever
          they are. Placing ONE element in both cells is not something a grid
          can do.
        */}
        <h2
          className="
            invitation__greeting hidden font-display text-3xl
            leading-[1.05] text-balance text-[#f6efe2]
            [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
            lg:block
            sm:text-4xl
          "
        >
          ¡Hola, {invitation.greetingName}!
        </h2>

        {/*
          THE WHOLE BLOCK, DATE LINE INCLUDED, EXACTLY AS THE GATE SHOWS IT.

          The couple read the two screens side by side: "debería ser igual a la
          primera pantalla… para tener una misma consistencia."

          IT USED TO PASS `showDate={false}`, and the reversal is the right way
          round. The line was hidden because a details list below stated the day
          too, from the `ceremony` row rather than from `WEDDING_INSTANT` —
          hiding the one the guest reads FIRST to protect the one beneath it got
          the priority backwards. The list is the part that went.
        */}
        <SaveTheDate coupleNames={wedding.coupleNames} />

        <p
          className="
            invitation__lead max-w-sm text-sm text-[#f6efe2]/85
            [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]
            sm:text-base
          "
        >
          Nos alegra mucho invitarlos a celebrar nuestro matrimonio.
        </p>
      </header>

      {/*
        THE DETAILS LIST STOOD HERE AND HELD THREE LABELLED FACTS.

        Fecha, Lugar and Dirección. The day is stated by the announcement above
        now, so the row repeating it had to go — and the two that remain answer
        a question this household has not been asked yet. They moved into the
        RSVP's affirmative branch, where somebody has just said they are coming:
        a household that cannot come does not need a street, and handing one to
        everybody before the question is answered buries the question.
      */}

      {/* WHO THIS IS FOR, SAID ONCE.
       * The greeting above already names this household and the list below
       * already names every member. A "Esta invitación es para …" heading and a
       * "La invitación es para N personas." count each restated that same fact,
       * so the section carried four lines all answering the same question. The
       * list is the authoritative record; the greeting is the salutation. */}
      <section className="invitation__household">
        {/*
          A hairline above the names, borrowed from `SaveTheDate`: it separates
          the salutation from the list of people without a heading that would
          restate what the greeting already said.
        */}
        <span
          aria-hidden="true"
          className="mx-auto mb-5 block h-px w-16 bg-[#f6efe2]/30 sm:w-24"
        />
        <ul className="m-0 flex list-none flex-col items-center gap-1.5 p-0">
          {invitation.guests.map((guest) => (
            <li
              className="text-sm text-[#f6efe2] [text-shadow:0_1px_12px_rgba(0,0,0,0.6)] sm:text-base"
              key={guest.id}
            >
              {guest.fullName}
              {guest.isChild ? (
                <>
                  {" "}
                  <span className="text-[#f6efe2]/60">(niño o niña)</span>
                </>
              ) : (
                ""
              )}
            </li>
          ))}
        </ul>
      </section>

      {rsvp === undefined ? null : (
        <section className="invitation__rsvp">{rsvp}</section>
      )}

      {/*
        ONE DEADLINE FOR THE WHOLE WEDDING, AND IT IS NOT A PROP.

        It used to arrive per household, which meant the couple typed the same
        date into every invitation they created — and one they forgot was an
        invitation that said nothing and never closed. There is one wedding, so
        it comes from the wedding's own facts.

        And it is spelled the way a person writes a date. The ISO day went
        straight onto the page before this: "Confirmen su asistencia antes del
        2026-11-21", a machine's spelling on the one surface written for people.
        Both this sentence and the gate in `lib/server/rsvp.ts` derive from the
        same instant, so they cannot name different days.
      */}
      <p className="invitation__deadline text-center text-xs text-[#f6efe2]/70">
        Confirmen su asistencia antes del {RSVP_DEADLINE_TEXT}.
      </p>
    </article>
  );
}
