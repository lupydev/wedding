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
  readonly ceremonyDate: string;
  readonly venueName: string;
  readonly venueAddress: string;
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
    */
    <article
      className="
        invitation mx-auto flex w-full max-w-md flex-col gap-8 px-6 pt-8
        pb-[max(1.75rem,env(safe-area-inset-bottom))] text-[#f6efe2]
        sm:pt-12 sm:pb-10
        lg:justify-center lg:px-4 lg:py-0
      "
    >
      <header className="flex flex-col items-center gap-4 text-center">
        <p
          className="
            invitation__couple font-script text-2xl text-[#f6efe2]/90
            [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]
            sm:text-3xl
          "
        >
          {wedding.coupleNames}
        </p>

        <h1
          className="
            invitation__greeting font-display text-3xl leading-[1.05]
            text-balance text-[#f6efe2]
            [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
            sm:text-4xl
          "
        >
          {invitation.greetingName}
        </h1>

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
        THE THREE FACTS, AS A LIST AND NOT AS A PARAGRAPH.

        A `dl` because that is what they are: three labels and three values.
        The label is small and quiet and the value carries the weight, so the
        eye lands on "28 de noviembre" rather than on the word "Fecha".

        `sr-only` was considered for the labels and rejected. On the stream page
        the two credentials are self-evident from their shape; a venue name and
        a street address are not, and a guest scanning for where to go needs
        the word "Dirección" as much as the address.
      */}
      <dl className="invitation__details m-0 flex flex-col gap-3 text-center">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs tracking-[0.18em] text-[#f6efe2]/60 uppercase">
            Fecha
          </dt>
          <dd className="m-0 text-sm text-[#f6efe2] sm:text-base">
            {wedding.ceremonyDate}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs tracking-[0.18em] text-[#f6efe2]/60 uppercase">
            Lugar
          </dt>
          <dd className="m-0 text-sm text-[#f6efe2] sm:text-base">
            {wedding.venueName}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs tracking-[0.18em] text-[#f6efe2]/60 uppercase">
            Dirección
          </dt>
          <dd className="m-0 text-sm text-[#f6efe2] sm:text-base">
            {wedding.venueAddress}
          </dd>
        </div>
      </dl>

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
