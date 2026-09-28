import {
  googleCalendarUrl,
  type CalendarEvent,
} from "@/lib/domain/calendar-event";

/**
 * The one way to keep the date.
 *
 * Google Calendar: one tap for anybody already signed in to Google, and
 * nothing at all for anybody who is not. It carries the name, the day, the
 * hour, the joining link and — on the entry that is allowed one — the venue's
 * location.
 *
 * IT CARRIES NO REMINDER, AND NOW NOTHING DOES. `TEMPLATE` has no parameter
 * for one, so the entry inherits whatever default the guest has set on their
 * own calendar — which may be nothing. A `.ics` stood beside this button
 * for exactly one pass, carrying the two alarms they chose, and they removed
 * it after testing it on a real phone: "el .ics realmente intenta descargar
 * un archivo, entonces descartemos ese boton." That was the reason they
 * deleted it the FIRST time too, and the experiment they asked for answered
 * its own question.
 *
 * So the alarms are gone with it. That is a knowing loss rather than an
 * oversight — it is the only thing the file could do that this cannot — and
 * `lib/domain/calendar-event.ts` records it beside the rest.
 *
 * WHY THIS IS STILL A COMPONENT WITH ONE CHILD. The accepted screen and the
 * stream block both offer it, and the two entries they offer are NOT the same
 * entry: one carries the venue's location and one must never. The difference
 * belongs in the `event` passed in, where it is visible at the call site,
 * rather than in two copies of an anchor that could drift into agreeing.
 *
 * Props-only and synchronous.
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
  className,
}: {
  readonly event: CalendarEvent;
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
    </div>
  );
}
