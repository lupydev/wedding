import {
  googleCalendarUrl,
  type CalendarEvent,
} from "@/lib/domain/calendar-event";

/**
 * The two ways to keep the date, which are two different promises.
 *
 * ONE BLOCK BECAUSE THE PAIR IS THE POINT. A guest gets a reminder from
 * exactly one of these, and which one depends on the phone in their hand:
 *
 *   Google Calendar — one tap for anybody already signed in to Google, and
 *   nothing at all for anybody who is not. It carries the name, the day, the
 *   hour, the joining link and (on the entry that is allowed one) the venue's
 *   location — but NOT a reminder. `TEMPLATE` has no parameter for one, so the
 *   entry inherits whatever default the guest's own calendar applies.
 *
 *   The `.ics` file — the only one of the two that carries alarms, which is
 *   why it is back after being removed. It opens natively on iOS and in
 *   Outlook and lands in a downloads folder on a desktop browser.
 *
 * THE FILE WAS DELETED ONCE, ON THE COUPLE'S INSTRUCTION, and is back on
 * theirs: "volvé al .ics con las dos alarmas para que probemos qué sucede en
 * un android e iphone." What a phone actually does with it is the thing they
 * are testing. `lib/domain/calendar-event.ts` holds the reversal and the
 * original reason for the removal.
 *
 * WHY THIS IS A COMPONENT RATHER THAN TWO ANCHORS COPIED TWICE. The accepted
 * screen and the stream block both offer them, and the two entries they offer
 * are NOT the same entry — one carries the venue's location and one must never
 * — so the difference belongs in the `event` passed in, where it is visible,
 * rather than in two copies of the markup that could drift into agreeing.
 *
 * Props-only and synchronous. It reads no clock: `DTSTAMP` is a fact about a
 * file rather than about the wedding, so it is the endpoint's to supply.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/*
  THE SAME PILL THE REST OF THE INVITATION PRESSES.

  `min-h-11` is the 44-pixel floor declared rather than inherited from the
  padding — the browser suite caught these exact controls at 42 pixels once,
  and a later change to the padding must not be able to lower them again.
*/
const ACTION = `
  flex min-h-11 w-full items-center justify-center rounded-full border
  border-current/60 bg-black/55 px-5 py-2.5 text-center text-sm
  backdrop-blur-sm transition-colors duration-(--console-motion-fast)
  ease-(--ease-console-out)
  hover:bg-black/65
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-current
`;

export function CalendarActions({
  event,
  icsHref,
  className,
}: {
  readonly event: CalendarEvent;
  /**
   * Where the `.ics` for THIS household is served, if it is offered at all.
   *
   * Optional, and absent on `/transmision`: that page has no invitation and
   * therefore no household whose answer decides what the file may contain.
   * The endpoint is per-invitation for exactly that reason — see
   * `app/i/[slug]/evento.ics/route.ts`.
   */
  readonly icsHref?: string;
  /** The host surface's own spacing. Never its colours. */
  readonly className?: string;
}) {
  return (
    <div
      data-testid="calendar-actions"
      className={`flex flex-col gap-3 ${className ?? ""}`}
    >
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        /*
         * `noopener` first, and it is not decoration: without it the new tab
         * can reach back into this one through `window.opener`, and one of
         * the surfaces that renders this sits behind a phone gate.
         */
        rel="noopener noreferrer"
        className={ACTION}
      >
        Agregar a Google Calendar
      </a>

      {icsHref === undefined ? null : (
        /*
          `download`, AND THE FILENAME IS THE ONE THE ENDPOINT ALREADY SENDS.

          The response carries `Content-Disposition: attachment` with the same
          name, so this attribute changes nothing where the header is honoured
          and says the right thing where a browser prefers the markup. Not
          `target="_blank"`: a download that opens a tab first leaves an empty
          one behind on every phone that honours it.
        */
        <a href={icsHref} download="boda.ics" className={ACTION}>
          Descargar el evento (.ics)
        </a>
      )}
    </div>
  );
}
