import Link from "next/link";

import { SaveTheDate } from "@/components/landing/SaveTheDate";

import { StreamDetails, type StreamDetailsValues } from "./StreamDetails";

/**
 * The invitation for everybody who joins the ceremony over Zoom.
 *
 * THIS SURFACE IS PUBLIC AND UNGATED, AND ITS PROP TYPE IS THE SECURITY
 * BOUNDARY.
 *
 * `/i/[slug]` knows which household is reading it, because a phone number got
 * them through the gate. This page knows nothing: whoever holds the link may
 * open it. So the guarantee cannot be "we remembered not to render the
 * address" — it has to be that there is no address here to render. The prop
 * type below carries five fields and has no place for a guest name, a phone
 * number, a venue or a street, and a component cannot leak what it was never
 * handed.
 *
 * That is the same reasoning `InvitationBody` states for phone numbers, applied
 * where it matters more.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: ask anybody to confirm. Seats are the
 * reason the RSVP exists, and a stream has none — there is nothing to count and
 * nothing to plan, so asking would be a question with no purpose and one more
 * thing for a guest to get wrong.
 *
 * Props-only and synchronous, so the route owns all data access and this stays
 * directly unit-testable.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */
/**
 * Exactly the stream half of the `ceremony` row, and nothing more.
 *
 * `coupleNames` used to be here, for an `<h1>` this component rendered itself.
 * The announcement is `SaveTheDate` now — the landing's own block, shared so
 * the two pages are identical rather than similar — and it reads the couple
 * from the domain. An unused prop is a lie about where a value comes from, so
 * it went with the heading.
 */
export type StreamInvitationCeremony = StreamDetailsValues;

/**
 * Where "add it to my calendar" points.
 *
 * Built by the route rather than here, so this component stays props-only and
 * testable with one plain string.
 */
export interface StreamInvitationCalendar {
  readonly googleHref: string;
}

export function StreamInvitation({
  ceremony,
  calendar,
}: {
  readonly ceremony: StreamInvitationCeremony;
  readonly calendar: StreamInvitationCalendar;
}) {
  /*
   * TWO GROUPS AND NO WRAPPER, SO THE PAGE CAN PUT ONE AT EACH END.
   *
   * A fragment rather than a container: the page's column is
   * `justify-between`, and a single wrapper would be one flex item that pushed
   * nothing apart. These two become the flex items themselves, exactly as the
   * landing's announcement and its door do.
   *
   * The split is the same measurement the landing uses. On the photograph the
   * couple occupy from 52% to 88% of its height; above 45% there is sky, the
   * waterfall and the lantern, and below 88% there is the path. The welcome
   * takes the top band and the joining details take the foot.
   */
  return (
    <>
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/*
          THE "Nos casamos" SCRIPT LINE USED TO BE RIGHT HERE, ABOVE THE BLOCK.

          It belonged to this file back when each page wrote its own. The line
          then moved INTO `SaveTheDate`, so the gate could make the same
          announcement without one block living as two halves in two files —
          and the landing dropped its copy while this one was missed. This page
          said it twice, one line directly under the other.

          Nothing failed. Two components each rendered one correct line, and
          every component test asserted its own line was present. It took the
          couple opening the page to see it, which is why `e2e/public-pages.spec.ts`
          now counts the announcement on both pages.
        */}

        {/*
          THE LANDING'S OWN ANNOUNCEMENT, SHARED RATHER THAN REPRODUCED.

          The couple asked for this page to open exactly as `/` does, countdown
          included. Rebuilding those four elements here would have matched today
          and diverged on the first tweak to either — the failure this session
          has already paid for twice. One component, two pages.

          It reads the couple and the date from `lib/domain/wedding-day.ts`
          rather than from the `ceremony` row, which is the same known debt the
          landing carries: when that row gains a machine-readable instant, both
          pages start reading it together.
        */}
        <SaveTheDate />

        {/*
          THE LEAD THAT STOOD HERE IS GONE, ON THE COUPLE'S OWN INSTRUCTION:
          "esto lo podemos quitar".

          It read "La ceremonia se va a transmitir por Google Meet. Te
          esperamos." and it was written to answer the question the reader
          arrives with — how do I attend? — back when the answer below it was a
          meeting id and a passcode to transcribe into an app.

          The block below now carries a control that says "Entrar a la
          transmisión", above the Google Meet address itself. It answers that
          question by being pressable. A sentence explaining that the ceremony
          arrives by Google Meet, sitting above a button whose destination is a
          Google Meet address, is the page saying the same thing twice.

          The announcement above still says this is an invitation rather than a
          set of credentials, which is the job the sentence was doing that the
          control cannot.
        */}
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-6 text-[#f6efe2]">
        {/*
          ON THE DARK GROUND, NOT ON A CREAM CARD.

          The card was a paper island, chosen because these two values are
          COPIED rather than read and cream is the better surface to transcribe
          from. The couple asked for the two pages to look like one, and an
          opaque card in the middle of the photograph is the thing that broke
          that — so the ground is the photograph now, and legibility comes from
          the scrim beneath and the weight of the type instead.

          `StreamDetails` carries no colours of its own, so it simply becomes
          cream here and stays near-black on the invitation's paper.
        */}
        <StreamDetails
          ceremony={ceremony}
          className="block w-full text-left"
          /*
            NEITHER THE DAY NOR THE HOUR IS REPEATED HERE.

            The announcement above names the day in prose, and the countdown
            beside it runs to the ceremony instant — so the hour is already on
            screen, ticking. The add-to-calendar button carries the precise
            time for anybody who wants to keep it.
          */
          showDate={false}
          showTime={false}
        />

        {/*
          THE REMINDER, WHICH IS THE ONLY THING ON THIS PAGE THAT SPEAKS UP BY
          ITSELF.

          A guest joining by stream has no journey to plan, and that is
          precisely why the date slips: nothing else in their week points at it.

          ONE ACTION, AND IT DOWNLOADS NOTHING. A `.ics` file sat beside this
          and was removed on the couple's instruction — answering a tap by
          dropping a file into a downloads folder has not helped anybody reading
          a wedding invitation on their phone.

          The cost is named rather than hidden: a guest on Apple Calendar or
          Outlook with no Google account gets no entry from this page. That was
          the couple's call, and `StreamInvitation.spec.tsx` holds the rule so
          the file cannot drift back in without one.
        */}
        <a
          href={calendar.googleHref}
          target="_blank"
          /*
           * `noopener` first, and it is not decoration: without it the new tab
           * can reach back into this one through `window.opener`. `noreferrer`
           * implies it on modern browsers and is set for its own sake as well.
           */
          rel="noopener noreferrer"
          className="
            rounded-full border border-[#f6efe2]/30 bg-black/30 px-5 py-2.5
            text-sm text-[#f6efe2] backdrop-blur-sm transition-colors
            duration-(--console-motion-fast) ease-(--ease-console-out)
            hover:bg-black/50
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#f6efe2]
          "
        >
          Agregar a Google Calendar
        </a>

        {/*
          THE WAY BACK, AND `<Link>` RATHER THAN `<a>` IS THE WHOLE POINT.

          A guest reaches this page from WhatsApp as often as from the landing,
          so without it there is nowhere to go but the browser's back button —
          which goes nowhere at all when this was the first page they opened.

          A plain anchor would reload the document and take the song with it:
          the audio element lives in `app/(public)/layout.tsx` precisely so it
          survives navigation between these two pages, and a full page load is
          the one thing that defeats that.
        */}
        <Link
          href="/"
          className="
            text-xs text-[#f6efe2]/65 underline underline-offset-4
            transition-colors duration-(--console-motion-fast)
            hover:text-[#f6efe2]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#f6efe2]
          "
        >
          Volver al inicio
        </Link>
      </div>
    </>
  );
}
