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
export interface StreamInvitationCeremony extends StreamDetailsValues {
  readonly coupleNames: string;
}

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
  return (
    <article className="flex w-full max-w-md flex-col items-center gap-7 text-center">
      <p className="font-script text-3xl text-[#f6efe2]/90 [text-shadow:0_1px_14px_rgba(0,0,0,0.6)] sm:text-4xl">
        Nos casamos
      </p>

      <h1 className="font-display text-4xl leading-[1.05] text-[#f6efe2] [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl">
        {ceremony.coupleNames}
      </h1>

      {/*
        WARMTH FIRST, THE PRACTICAL FACT SECOND.
        
        This page is read by the guests who cannot be in the room. Opened with
        the logistics it reads as a calendar entry; opened with "te esperamos"
        it reads as what it is, and the streaming is then the answer to how.
        
        SINGULAR, AND THAT IS A DELIBERATE BREAK FROM THE REST OF THE PRODUCT.
        `/i/[slug]` says "ustedes" throughout and is right to: that invitation
        belongs to a household and names every member of it. This page is read
        by one person at a time, so it speaks to one person.
      */}
      <p className="max-w-sm text-[#f6efe2]/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
        Te esperamos. Vamos a transmitir la ceremonia en vivo para que puedas
        acompañarnos desde donde estés.
      </p>

      {/*
        A PAPER ISLAND, AND NOT FOR DECORATION.

        Everything above is read once. These four values are COPIED — an eleven
        digit meeting id and a passcode, typed into another application, often
        on a phone, often in a hurry. Cream on near-black with a text shadow is
        a fine surface for a sentence and a poor one for a string somebody has
        to transcribe without a mistake.

        `.paper-surface` already exists in `app/globals.css` for exactly this —
        it is what puts the guest-facing preview on a cream ground inside the
        graphite console — so the mechanism is reused rather than reinvented.
        It re-declares the palette, so the block below needs no colours of its
        own.
      */}
      <div className="paper-surface w-full rounded-[var(--radius)] px-6 py-7 text-left shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
        <h2 className="mb-4 text-center font-display text-lg">
          Para entrar a la transmisión
        </h2>

        {/*
          No grid here any more. `StreamDetails` owns its own arrangement now
          that its four values are no longer four equal rows — a caption for the
          date and time, and the two credentials as the content — and a layout
          imposed from outside would fight it.
        */}
        <StreamDetails ceremony={ceremony} className="block" />
      </div>

      {/*
        THE REMINDER, WHICH IS THE ONLY THING ON THIS PAGE THAT SPEAKS UP BY
        ITSELF.

        A guest joining by stream has no journey to plan, and that is precisely
        why the date slips: nothing else in their week points at it. Everything
        above has to be remembered; a calendar entry does the remembering.

        ONE ACTION, AND IT DOWNLOADS NOTHING. A `.ics` file sat beside this and
        was removed on the couple's instruction — answering a tap by dropping a
        file into a downloads folder has not helped anybody reading a wedding
        invitation on their phone.

        The cost is named rather than hidden: a guest on Apple Calendar or
        Outlook with no Google account gets no entry from this page. That was
        the couple's call to make, and `StreamInvitation.spec.tsx` holds the
        rule so the file cannot drift back in without one.
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
          rounded-full border border-[#f6efe2]/30 bg-black/25 px-5 py-2.5
          text-sm text-[#f6efe2] backdrop-blur-sm transition-colors
          duration-(--console-motion-fast) ease-(--ease-console-out)
          hover:bg-black/45
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[#f6efe2]
        "
      >
        Agregar a Google Calendar
      </a>
    </article>
  );
}
