/**
 * The frame every screen of the invitation stands in.
 *
 * ONE component, rendered by two routes: the public `/i/[slug]` page (after the
 * phone gate lets the guest through) and the operator preview at
 * `/console/preview/[invitationId]`. Two implementations would drift, and the
 * operator would approve copy that no guest ever sees.
 *
 * IT USED TO BE THE WHOLE INVITATION AND IS NOW THE FRAME AROUND ONE SCREEN OF
 * IT.
 *
 * It held the announcement, the household's names, the RSVP slot and a deadline
 * footnote, stacked into a single document. On an iPhone 14 that document was
 * 1663 pixels tall once a household accepted, against 664 of screen. The
 * invitation is a sequence of screens now — the question, who is coming, and
 * where to go — and which one is showing is CLIENT state, owned by `RsvpAnswer`
 * and unknowable to a Server Component. So what is left here is what every
 * screen shares: the measure, the padding, and the household's own name at the
 * top of it.
 *
 * WHAT THE CONSOLE PREVIEW GETS, AND WHY IT IS NOT THE SAME PICTURE ANY MORE.
 *
 * The preview passes no RSVP, because answering there would answer on a
 * household's behalf. With the invitation stepped, that leaves it the standing
 * content: the greeting, the announcement and the deadline — which is the first
 * screen a guest reads, minus the two controls. The household's names moved
 * into the form's own checkboxes, so the preview no longer lists them; the
 * console already shows an operator who is on an invitation, in three places
 * built for it.
 *
 * `e2e/console-preview.spec.ts` compared the two documents byte for byte and
 * now compares the announcement, which is the block they still both render.
 *
 * Synchronous and props-only, deliberately. It performs no data access, so it
 * cannot be handed a phone number by accident: its prop type has no field for
 * one. That is also what makes it directly unit-testable.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */

import { rsvpDeadlineSentence } from "@/lib/domain/rsvp-copy";

import { InvitationAnnouncement } from "./InvitationAnnouncement";

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
 * ONE FIELD, AND NOT THE WHOLE ROW. The row also carries the stream link, the
 * venue and its street, which this component does not render — so its prop type
 * has no field for them, exactly as it has no field for a phone number. A
 * component cannot leak what it was never handed.
 */
export interface InvitationBodyWedding {
  readonly coupleNames: string;
  /*
    THE DAY, THE VENUE AND ITS ADDRESS USED TO BE DECLARED HERE TOO.

    The venue reaches `RsvpAnswer` directly, because only a household that says
    it is coming is told where to go. A prop this component no longer renders is
    a lie about where a value comes from.

    THE DAY IS NOT A PROP BECAUSE IT IS NO LONGER A COLUMN. A doc comment stood
    here calling it `ceremony_date` — "one day, one column, one place to correct
    it" — above no field at all. The announcement states the day from
    `WEDDING_INSTANT`, nothing ever rendered the typed value, and migration 0018
    dropped the column.
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
   * The current screen, composed by the route.
   *
   * A slot rather than the form itself, for the reason this component is
   * props-only in the first place: the RSVP needs a bound Server Action and the
   * household's current answer, and `components/**` may not reach into
   * `lib/server/**`.
   *
   * It is the whole of the invitation below the greeting now. The operator
   * preview passes nothing and gets the standing content instead: a preview
   * must not show a control no guest can use, and must not show an empty page
   * either.
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

      ONE VIEWPORT, AND NOT ONE PIXEL MORE — that is what `min-h-dvh` plus a
      column that pushes its content to the foot buys, and it is the whole
      purpose of the unit this file was rewritten in.

      `min-h-dvh` RATHER THAN `h-dvh`, AND THE DIFFERENCE IS NOT COSMETIC. A
      locked height clips whatever does not fit; an unlocked one that happens to
      fit is identical on every screen it was measured on and degrades to
      scrolling on the one it was not — a household of nine, a guest who has
      raised their system font. Clipping the send button is a dead end. Scrolling
      to reach it is a worse screen than the couple asked for, and still a screen
      that works.

      `dvh`, NEVER `vh`: on a phone `100vh` is the viewport with the browser
      chrome HIDDEN, so the last line sits under the address bar until the
      visitor scrolls. `PhotoStage` carries the long version of that note.

      `lg:py-[7dvh]` MATCHES THE PRINT'S OWN OFFSET. The framed photograph
      sticks at `top-[7dvh]`, so the same measure here puts the greeting level
      with the top of the picture instead of against the browser chrome.
    */
    <article
      /*
        THE MEASURE IS THE PHONE'S, AND IT LIFTS AT `lg`.

        `max-w-md` — 448px — keeps the lines readable on a narrow screen and is
        wrong above the breakpoint: the announcement's names are set at
        `text-6xl` there, and "Luis & Michell" at that size does not fit in
        448px — it broke after the ampersand, which reads as a mistake in the
        middle of the couple's own names. The grid column has the room.
      */
      className="
        invitation mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6
        pt-[max(1.25rem,env(safe-area-inset-top))]
        pb-[max(1.75rem,env(safe-area-inset-bottom))] text-[#f6efe2]
        sm:gap-6
        lg:min-h-0 lg:max-w-none lg:justify-center lg:px-4 lg:py-[7dvh]
      "
    >
      {/*
        THE HOUSEHOLD'S OWN NAME, AT THE TOP OF EVERY SCREEN.

        ONE ELEMENT NOW, WHERE THERE WERE TWO. This greeting used to be rendered
        twice — hidden below `lg` here, and again through the stage's
        `overPhoto` slot for phones — because the photograph was a band across
        the top and a line rendered beneath it sat under the picture with a
        stripe of empty ground above. The photograph fills the screen now, so
        the words are already on it and the duplicate has gone with the slot
        that needed it.

        `px-10` ON TOP OF THE ARTICLE'S `px-6` IS 64 PIXELS, AND IT IS MEASURED.
        The music control is fixed at `right-5` and is 44px across, so it
        occupies the last 64px of the row; a centred line reaching further would
        run underneath it. `PhotoStage` applied the same gutter to the slot this
        replaces, for the same reason. Symmetric, so the line stays centred.
      */}
      <header className="flex shrink-0 flex-col items-center px-10 text-center lg:px-0">
        <h2
          className="
            invitation__greeting font-display text-2xl leading-[1.05]
            text-balance text-[#f6efe2]
            [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
            sm:text-3xl
          "
        >
          ¡Hola, {invitation.greetingName}!
        </h2>
      </header>

      {rsvp === undefined ? (
        /*
          THE OPERATOR'S PREVIEW, WHICH IS NOT ONE OF THE GUEST'S SCREENS.

          Everything a guest reads before they answer, with the two controls
          removed. It is deliberately NOT wrapped in `invitation__rsvp`: the
          browser suite asserts that class is absent here, and that assertion is
          how "the preview offers no way to answer on a household's behalf" is
          checked rather than promised.
        */
        <div className="flex flex-col items-center gap-5 text-center">
          <InvitationAnnouncement coupleNames={wedding.coupleNames} />

          <p className="invitation__deadline text-sm text-[#f6efe2]">
            {rsvpDeadlineSentence(invitation.guests.length)}
          </p>
        </div>
      ) : (
        /*
          `flex-1` SO THE SCREEN CAN PUSH ITS CONTROLS TO THE FOOT OF ITSELF.

          The section is the whole of the article below the greeting, and what
          goes in it decides its own vertical arrangement: the question screen
          puts the announcement at the top and the answers at the bottom, the
          way the landing page does; the screens with no announcement put their
          single group at the bottom. Neither can do that without a box the
          height of the space that is left.
        */
        <section className="invitation__rsvp flex flex-1 flex-col">
          {rsvp}
        </section>
      )}
    </article>
  );
}
