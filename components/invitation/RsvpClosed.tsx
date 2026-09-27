import type { CalendarEvent } from "@/lib/domain/calendar-event";
import { greetingLine } from "@/lib/domain/greeting-name";
import {
  rsvpClosedNote,
  rsvpConfirmedHeading,
  rsvpDeclinedHeading,
} from "@/lib/domain/rsvp-copy";

import { InvitationGreeting } from "./InvitationGreeting";
import { RsvpConfirmed } from "./RsvpConfirmed";
import { StreamDetails, type StreamDetailsValues } from "./StreamDetails";

/**
 * What the invitation shows once the RSVP deadline has passed.
 *
 * IT USED TO BLANK THE INVITATION, AND THAT IS THE DEFECT THIS FILE EXISTS TO
 * FIX. This component was an `h2` reading "Confirmaciones cerradas" and one
 * paragraph, and the route substituted it for the WHOLE stepper. So from the
 * 21st of November — the seven days when a guest most needs the page — a
 * household that had accepted lost the venue, the map, `Cómo llegar`, the
 * hour and the dress code, and a household that had declined lost `Entrar a
 * la transmisión` and the calendar. Everyone opening their invitation in the
 * final week got a greeting, the announcement, and the words "confirmaciones
 * cerradas". Nothing anybody needed in order to reach the wedding survived
 * the deadline.
 *
 * Nobody was careless. The deadline is derived from a constant in the future
 * and the decision is made on the server during render, so no browser test
 * could reach this state — see `rsvpClockOverride` in `lib/server/env.ts`,
 * which is the seam this unit added so that it can.
 *
 * WHAT THE COUPLE DECIDED IT SHOULD DO, put to them and confirmed: the
 * deadline closes THE ABILITY TO CHANGE AN ANSWER, not the invitation.
 *
 *   accepted      — the venue, the map, the day, the hour and the dress code,
 *                   with no way to change the answer.
 *   declined      — the stream link and the calendar, same.
 *   never answered — the stream link and the calendar, and NOT the venue.
 *
 * THE THIRD CASE IS A DECISION NOBODY ASKED FOR AND IT IS FLAGGED RATHER THAN
 * BURIED. The couple named the first two. A household that never answered can
 * still watch, so they get the stream — but the venue is gated behind saying
 * you are coming, and a deadline passing is not a confirmation. Handing the
 * address to everyone who ignored the invitation would undo the rule the
 * whole `confirmed` screen exists to enforce. It is written in the feature
 * document as an open question so the couple can overrule it.
 *
 * NOTHING HERE IS A SECOND COPY. The accepted ending is `RsvpConfirmed`, the
 * same component the open flow hands a household that has just said yes; the
 * two stream endings are `StreamDetails`, the same block `/transmision` and
 * the declining screen render. A closed-state copy of either would be two
 * weddings waiting to disagree about a venue or an hour —
 * `components/landing/photos.ts` makes that argument for the photographs and
 * it is sharper here, because these are the screens a guest reads on the way
 * to the ceremony.
 *
 * WHAT IS DELIBERATELY NOT REUSED IS `CeremonyStream`. That component is the
 * DECLINING flow: it carries "Comprendemos que no puedan acompañarnos" and
 * the way back, and both are wrong here — one addresses a decision being
 * made, the other offers a change that is no longer possible. So this file
 * composes the shared block directly and says the one sentence that is true
 * after the deadline.
 *
 * No `wa.me` link, as before. The message tells the household to write to the
 * couple and they already hold that chat: this invitation arrived in it.
 *
 * Synchronous and props-only. The clock stays in the route.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** What the household answered before the deadline, if they answered. */
export interface RsvpClosedAnswer {
  readonly attending: boolean;
}

export function RsvpClosed({
  answer,
  ceremony,
  venue,
  memberCount,
  greetingName,
  calendar,
}: {
  readonly answer: RsvpClosedAnswer | null;
  readonly ceremony: StreamDetailsValues;
  /** Shown only to a household that said yes before the deadline. */
  readonly venue: { readonly name: string };
  readonly memberCount: number;
  readonly greetingName: string;
  /** The two ways to keep the date, for the accepted ending only. */
  readonly calendar?: {
    readonly event: CalendarEvent;
    readonly icsHref: string;
  };
}) {
  const state =
    answer === null ? "unanswered" : answer.attending ? "accepted" : "declined";

  /*
    THE SAME THREE LINES THE OPEN FLOW USES, CHOSEN THE SAME WAY.

    A household that accepted reads "Los esperamos, <name>" whether they are
    looking at it the day they answered or the week of the wedding; one that
    declined reads "Los vamos a extrañar, <name>". Only the household that
    never answered still gets the plain greeting, because nothing has been
    said to them yet. The deadline changes what they can DO, not who they are
    to the couple.
  */
  const heading =
    state === "accepted"
      ? rsvpConfirmedHeading(memberCount, greetingName)
      : state === "declined"
        ? rsvpDeclinedHeading(memberCount, greetingName)
        : greetingLine(greetingName);

  return (
    <>
      <InvitationGreeting>{heading}</InvitationGreeting>
      <div
        className="rsvp rsvp__closed flex flex-1 flex-col justify-between gap-4"
        data-rsvp-closed={state}
      >
        {/*
          THE ONE SENTENCE THAT IS TRUE AFTER THE DEADLINE, AT THE TOP.

          "Confirmaciones cerradas" was a headline over an empty screen. With
          the screen carrying the venue or the stream underneath it, a
          headline announcing an absence reads as an error message above
          working content — so it is one quiet line that says the answers are
          closed and what is still here, and the heading above it does the
          greeting.

          Full cream with the shadow every other line on bare photograph
          carries, and measured there rather than assumed:
          `app/i/[slug]/closed-legibility.spec.tsx`.
        */}
        <p className="rsvp__closed-note text-center text-sm text-[#f6efe2] [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
          {rsvpClosedNote(state, memberCount)}
        </p>

        {state === "accepted" ? (
          <RsvpConfirmed venueName={venue.name} calendar={calendar} />
        ) : (
          /*
            THE STREAM, FOR BOTH OF THE OTHER TWO, AND NO VENUE FOR EITHER.

            A household that declined asked for this. A household that never
            answered is being offered it rather than shown the address: the
            venue is behind an acceptance, and the deadline passing is not
            one.
          */
          <StreamDetails
            ceremony={ceremony}
            className="mx-auto w-full max-w-sm"
          />
        )}
      </div>
    </>
  );
}
