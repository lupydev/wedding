/**
 * The ceremony as a calendar entry — pure.
 *
 * A guest who joins by stream has no venue to travel to and nothing to arrange,
 * which is exactly why the date slips: there is no journey to plan around it.
 * So the stream invitation offers the entry itself, with alarms attached — a
 * note in a calendar that nobody is reminded of is a note nobody reads.
 *
 * Every value here is derived from arguments, including the timestamp, so the
 * output is byte-for-byte reproducible and the whole format is testable without
 * a clock or a server.
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
  /** When the entry was produced. Injected so output is reproducible. */
  readonly stamp: Date;
}

/** The stream half of the `ceremony` row, plus who is getting married. */
export interface StreamCalendarFacts {
  readonly coupleNames: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

/**
 * Measures a string in UTF-8 octets.
 *
 * `TextEncoder`, and deliberately not Node's byte-length helper. `lib/domain`
 * is forbidden Node built-ins so that a client component may import anything in
 * it — the rule is in `eslint.config.mjs` — and that helper is one. The linter
 * cannot catch it, because it is reached through a global rather than an
 * import, so the only thing enforcing the rule here is knowing it. `TextEncoder`
 * is a web standard and exists in both runtimes.
 *
 * One encoder at module scope: `fold` asks per character, and an allocation per
 * character of every folded line is a cost with nothing to buy.
 */
const UTF8 = new TextEncoder();

function octets(value: string): number {
  return UTF8.encode(value).length;
}

/** `YYYYMMDDTHHMMSSZ` — the iCalendar UTC form, and Google's `dates` form. */
function asUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function endOf(event: CalendarEvent): Date {
  return new Date(event.start.getTime() + event.durationMinutes * 60_000);
}

/**
 * Escapes an iCalendar TEXT value.
 *
 * The backslash goes FIRST. Escaping commas before backslashes would then
 * escape the backslashes it had just written, turning `a,b` into `a\\,b` — a
 * literal backslash followed by an unescaped separator, which is both wrong
 * values and wrong text.
 *
 * A raw comma is a value SEPARATOR in iCalendar, so an unescaped one silently
 * truncates the rest of the property. In a description ending with a passcode,
 * the passcode is what disappears.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line to 75 OCTETS, per RFC 5545 §3.1.
 *
 * Octets, not characters, and that distinction is the whole reason this is not
 * a `slice(0, 75)`. This copy is Spanish: every "ó" and "ñ" is two bytes in
 * UTF-8, so a character count overruns the limit — and a cut landing inside a
 * multi-byte sequence hands the calendar invalid UTF-8 and a description that
 * ends in a replacement character.
 *
 * So it walks code points, tracks the byte cost of each, and breaks before the
 * one that would not fit. Continuation lines begin with a single space, which
 * the reader strips.
 */
function fold(line: string): string {
  const LIMIT = 75;
  const out: string[] = [];

  let current = "";
  let bytes = 0;
  // The leading space of a continuation line costs one of its 75 octets.
  let budget = LIMIT;

  for (const char of line) {
    const cost = octets(char);

    if (bytes + cost > budget) {
      out.push(current);
      current = "";
      bytes = 0;
      budget = LIMIT - 1;
    }

    current += char;
    bytes += cost;
  }

  out.push(current);

  return out.join("\r\n ");
}

/** The ceremony, as the entry a stream guest adds to their calendar. */
export function buildStreamCalendarEvent(
  facts: StreamCalendarFacts,
  start: Date,
  stamp: Date,
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
    stamp,
  };
}

/**
 * The event as an `.ics` file.
 *
 * Two alarms, not one: the day before, when there is still time to arrange the
 * evening, and an hour before, when it is time to find the laptop. A calendar
 * entry with no alarm is a note the guest has to remember to look at, which is
 * the problem this was added to solve.
 */
export function buildIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//invitacion.boda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${asUtcStamp(event.stamp)}`,
    `DTSTART:${asUtcStamp(event.start)}`,
    `DTEND:${asUtcStamp(endOf(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-P1D",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT1H",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // A trailing CRLF as well: every content line ends with one, the last
  // included, and a file that stops mid-line is a file some readers reject.
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/**
 * The same event as a Google Calendar link.
 *
 * Offered beside the file because they fail in opposite places: a `.ics` opens
 * natively on iOS and in Outlook and is a downloaded file to be found on a
 * desktop browser, while this is one tap for anybody already signed in to
 * Google and nothing at all for anybody who is not.
 *
 * NOT escaped as iCalendar TEXT. This is a query parameter, so the backslashes
 * the file format needs would arrive as literal backslashes in the guest's
 * event. `URLSearchParams` does the encoding this one needs.
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
