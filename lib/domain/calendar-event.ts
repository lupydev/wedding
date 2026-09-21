/**
 * The ceremony as a calendar entry — pure.
 *
 * ONE DESTINATION, AND IT DOWNLOADS NOTHING. This module also built an `.ics`
 * file, with its own folding, escaping and alarms; the couple removed that
 * action because a tap that drops a file into a downloads folder helps nobody
 * reading an invitation on a phone, and an unreachable endpoint is worse than
 * an absent one. Git holds it if the Apple and Outlook guests ever need it
 * back.
 *
 * A guest who joins by stream has no venue to travel to and nothing to arrange,
 * which is exactly why the date slips: there is no journey to plan around it.
 * So the stream invitation offers the entry itself, with alarms attached — a
 * note in a calendar that nobody is reminded of is a note nobody reads.
 *
 * Every value is derived from arguments, so the output is reproducible and the
 * whole thing is testable without a clock or a server.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/**
 * How long the entry blocks out.
 *
 * AN ASSUMPTION, AND RECORDED AS ONE. The couple gave a start and nobody has
 * said how long the ceremony runs. An hour is the ordinary length and, more to
 * the point, the END of a calendar entry is not what a guest acts on — the
 * start and the alarms are. Correcting it later is this line.
 */
export const CEREMONY_MINUTES = 60;

/** An event, in the small shape both outputs need. */
export interface CalendarEvent {
  readonly uid: string;
  readonly start: Date;
  readonly durationMinutes: number;
  readonly title: string;
  readonly description: string;
}

/** The stream half of the `ceremony` row, plus who is getting married. */
export interface StreamCalendarFacts {
  readonly coupleNames: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

/** `YYYYMMDDTHHMMSSZ` — the iCalendar UTC form, and Google's `dates` form. */
function asUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function endOf(event: CalendarEvent): Date {
  return new Date(event.start.getTime() + event.durationMinutes * 60_000);
}

/** The ceremony, as the entry a stream guest adds to their calendar. */
export function buildStreamCalendarEvent(
  facts: StreamCalendarFacts,
  start: Date,
): CalendarEvent {
  return {
    /*
     * Derived from the instant, never random.
     *
     * A calendar treats UID as the event's identity: a guest who saves the file
     * twice should end up with ONE entry that was updated, not two that both
     * ring. A fresh id per request guarantees the duplicate.
     */
    uid: `boda-${asUtcStamp(start)}@invitacion.boda`,
    start,
    durationMinutes: CEREMONY_MINUTES,
    title: `Matrimonio de ${facts.coupleNames}`,
    description: [
      "Nos casamos y los acompañamos por Zoom.",
      "",
      `ID de la reunión: ${facts.streamMeetingId}`,
      `Clave de acceso: ${facts.streamPasscode}`,
    ].join("\n"),
  };
}

/**
 * The event as a Google Calendar link.
 *
 * One tap for anybody already signed in to Google, and nothing at all for
 * anybody who is not — a gap the page names rather than hides.
 *
 * `URLSearchParams` does the encoding. There is deliberately no iCalendar-style
 * escaping here: this is a query parameter, and the backslashes that format
 * needs would arrive as literal backslashes in the guest's event.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${asUtcStamp(event.start)}/${asUtcStamp(endOf(event))}`,
    details: event.description,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
