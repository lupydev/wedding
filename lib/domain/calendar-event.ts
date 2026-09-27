/**
 * The ceremony as a calendar entry — pure.
 *
 * TWO DESTINATIONS, AND THEY DO DIFFERENT JOBS. A `.ics` file, which carries
 * its own alarms and opens natively on iOS and in Outlook; and a Google
 * Calendar link, which is one tap for anybody already signed in to Google and
 * nothing at all for anybody who is not.
 *
 * THE FILE WAS HERE, WAS REMOVED, AND IS BACK — DELIBERATELY, AS AN
 * EXPERIMENT. This module built an `.ics` with its own folding, escaping and
 * alarms until `2cb43cb`, and the couple removed it with a reason worth
 * quoting exactly: "a browser that answers a tap by dropping a file into a
 * downloads folder has not helped anybody reading a wedding invitation on
 * their phone." They have reversed that knowingly — "volvé al .ics con las dos
 * alarmas para que probemos qué sucede en un android e iphone" — because what
 * each phone actually does with the file is the thing they want to see. The
 * implementation is the one git held, recovered rather than rewritten: the
 * octet-accurate folding and the escaping order below are easy to get subtly
 * wrong and were already right.
 *
 * WHICH ONE CARRIES A REMINDER, STATED HONESTLY BECAUSE THIS FILE USED TO GET
 * IT WRONG. The header said the entry went "with alarms attached", which was
 * true of the `.ics` and never of the link: Google's TEMPLATE endpoint takes
 * `action`, `text`, `dates`, `details` and `location`, and has no parameter
 * for a reminder at all. An entry saved through it inherits whatever default
 * the guest has set on their own calendar — often ten minutes, sometimes
 * nothing. That is not a failure and it is not something this code can change;
 * it is simply what that button does, and saying so is the difference between
 * a guest who sets their own alarm and one who assumes we set it for them.
 *
 * A guest who joins by stream has no venue to travel to and nothing to
 * arrange, which is exactly why the date slips: there is no journey to plan
 * around it. It is the guest the alarms were added for.
 *
 * AND THE TWO ENTRIES ARE NOT THE SAME ENTRY. See `buildCeremonyCalendarEvent`
 * and `buildStreamCalendarEvent`: one carries the venue's location and one
 * must never. A calendar file is forwarded exactly like a link, so the address
 * in a declining household's entry would leak further, and more durably, than
 * anything the page itself shows them.
 *
 * Every value is derived from arguments, so the output is reproducible and the
 * whole thing is testable without a clock or a server.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

import { VENUE_COORDINATES, WEDDING_TIME_ZONE } from "./wedding-day";

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
  /**
   * Where it is, and it is ABSENT far more often than it is present.
   *
   * Only the entry an accepted household saves carries this. The venue is
   * gated behind saying you are coming — that gate is why `RsvpAnswer` shows
   * the address at all, and why the closed screen withholds it from a
   * household that never answered — and a calendar entry is forwarded exactly
   * like a link. Optional, so the stream entry cannot acquire one by
   * forgetting to remove it.
   */
  readonly location?: string;
}

/** The stream half of the `ceremony` row, plus who is getting married. */
export interface StreamCalendarFacts {
  readonly coupleNames: string;
  readonly streamUrl: string;
}

/** And the venue's own name, for the one entry that is allowed to say where. */
export interface CeremonyCalendarFacts extends StreamCalendarFacts {
  readonly venueName: string;
}

/**
 * The evening alarm's hour, where the wedding is. The couple said eight.
 */
const EVENING_ALARM_HOUR = 20;

/**
 * And how long before the start the second one rings. The couple said three.
 */
const HOURS_BEFORE_ALARM = 3;

/**
 * Measures a string in UTF-8 octets.
 *
 * `TextEncoder`, and deliberately not Node's byte-length helper. `lib/domain`
 * is forbidden Node built-ins so that a client component may import anything
 * in it — the rule is in `eslint.config.mjs` — and that helper is one. The
 * linter cannot catch it, because it is reached through a global rather than
 * an import, so the only thing enforcing the rule here is knowing it.
 * `TextEncoder` is a web standard and exists in both runtimes.
 *
 * One encoder at module scope: `fold` asks per character, and an allocation
 * per character of every folded line is a cost with nothing to buy.
 */
const UTF8 = new TextEncoder();

function octets(value: string): number {
  return UTF8.encode(value).length;
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
 * truncates the rest of the property. In a LOCATION that is a latitude and a
 * longitude with a comma between them, an unescaped one throws the longitude
 * away and drops the guest a few hundred kilometres west, in the Pacific.
 *
 * The pair itself is deliberately not quoted here. `VENUE_COORDINATES` is the
 * one source that names it and `tools/venue-coordinates.spec.ts` holds that
 * to exactly one file — a comment repeating the digits is a second copy for
 * every purpose except the one that would notice.
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

/**
 * THE EVENING BEFORE, AT A WALL-CLOCK HOUR RATHER THAN A DURATION.
 *
 * The couple asked for two alarms: "the day before at 8:00 p.m." and "three
 * hours before the start". The second is a duration and iCalendar says it in
 * one token, `-PT3H`. The first is not: 8:00 p.m. is a time of day where the
 * wedding is, and encoding it as the 21 hours it happens to be today would
 * quietly become 9:00 p.m. if the ceremony moved an hour later.
 *
 * So it is derived — the wedding's own local time of day, read in
 * `WEDDING_TIME_ZONE`, is what decides how far back to step. Move the
 * ceremony and the alarm stays at eight in the evening; the spec asserts the
 * resulting INSTANT rather than the token, so that promise is checked rather
 * than described.
 *
 * Bogota has no daylight saving, so stepping back across midnight cannot
 * change the offset. Written down because a zone that did would need the
 * arithmetic done in local parts rather than in milliseconds.
 */
function eveningBefore(start: Date, timeZone: string, hour: number): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(start);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const minutesIntoTheDay = value("hour") * 60 + value("minute");
  const minutesBack = minutesIntoTheDay + (24 - hour) * 60;

  return new Date(start.getTime() - minutesBack * 60_000);
}

/** `YYYYMMDDTHHMMSSZ` — the iCalendar UTC form, and Google's `dates` form. */
function asUtcStamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function endOf(event: CalendarEvent): Date {
  return new Date(event.start.getTime() + event.durationMinutes * 60_000);
}

/**
 * The ceremony, as the entry a STREAM guest adds to their calendar.
 *
 * NO LOCATION, AND THAT IS THE POINT OF THERE BEING TWO BUILDERS. This is the
 * entry offered on `/transmision`, on the screen a household reaches by
 * declining, and on the closed screen to anybody who did not accept. None of
 * those people has been told where the wedding is, and a calendar entry is
 * forwarded exactly like a link — more durably, in fact, because it lands in
 * a file and an app rather than in a chat. `buildCeremonyCalendarEvent` is
 * the one that carries an address, and it is reachable only from the screen
 * that already shows one.
 */
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
      "Nos casamos y los acompañamos por Google Meet.",
      "",
      `Enlace: ${facts.streamUrl}`,
    ].join("\n"),
  };
}

/**
 * And the entry a household that ACCEPTED saves, which is the same day with
 * an address on it.
 *
 * The couple asked for the calendar entry to carry "the event name, the Meet
 * url, the location". The first two are the stream entry's already; this adds
 * the third, and it is the whole difference between the two builders.
 *
 * WHY COORDINATES RATHER THAN THE VENUE'S NAME. `venue_name` is "Villa
 * Campestre" in production, which a maps search will happily resolve to a
 * dozen places in Colombia; `venue_address` holds a placeholder the couple
 * have decided they will never fill. A location a guest taps that opens the
 * wrong town is worse than no location, so this is the same
 * `VENUE_COORDINATES` the directions button uses — one definition, so the
 * entry and the map cannot point at two places.
 *
 * The name goes in FRONT of the coordinates, separated by the comma
 * iCalendar escapes and `URLSearchParams` encodes: a guest reading the entry
 * sees a place with a name, and their maps application uses the numbers.
 */
export function buildCeremonyCalendarEvent(
  facts: CeremonyCalendarFacts,
  start: Date,
): CalendarEvent {
  return {
    ...buildStreamCalendarEvent(facts, start),
    location: `${facts.venueName} (${VENUE_COORDINATES})`,
  };
}

/**
 * The event as an `.ics` file.
 *
 * TWO ALARMS, AND THE COUPLE CHOSE BOTH TIMES. The evening before at eight,
 * when there is still time to arrange the next day, and three hours before
 * the start, which is when a guest who has to travel begins to. A calendar
 * entry with no alarm is a note the guest has to remember to look at, which
 * is the problem the file exists to solve — and the reason it is back after
 * being removed: the Google link cannot carry a reminder at all.
 *
 * ONE ABSOLUTE AND ONE RELATIVE, for the reason `eveningBefore` gives: eight
 * in the evening is a time of day and three hours before is a duration, and
 * encoding either as the other is what makes an alarm drift when the ceremony
 * moves.
 *
 * `stamp` IS AN ARGUMENT OF THE FILE RATHER THAN A FIELD OF THE EVENT.
 * `DTSTAMP` says when this iCalendar object was written, which is a fact
 * about the serialization and not about the wedding — and keeping it out of
 * `CalendarEvent` is what lets the Google link be built during a render
 * without reading a clock, where a server and a client disagreeing about the
 * time would be a hydration mismatch in an href.
 */
export function buildIcs(event: CalendarEvent, stamp: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//invitacion.boda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${asUtcStamp(stamp)}`,
    `DTSTART:${asUtcStamp(event.start)}`,
    `DTEND:${asUtcStamp(endOf(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    /*
      AND THE ADDRESS ONLY WHEN THE ENTRY HAS ONE.

      An empty `LOCATION:` is not the same as no `LOCATION`: some readers
      render the blank as a line in the event, and all of them treat the
      property as present. The stream entry must carry no trace of a venue,
      not an empty box where one would go.
    */
    ...(event.location === undefined
      ? []
      : [`LOCATION:${escapeText(event.location)}`]),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER;VALUE=DATE-TIME:${asUtcStamp(
      eveningBefore(event.start, WEDDING_TIME_ZONE, EVENING_ALARM_HOUR),
    )}`,
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:-PT${HOURS_BEFORE_ALARM}H`,
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
 * The event as a Google Calendar link.
 *
 * One tap for anybody already signed in to Google, and nothing at all for
 * anybody who is not — a gap the page names rather than hides.
 *
 * IT CARRIES NO ALARM AND CANNOT. `TEMPLATE` accepts `action`, `text`,
 * `dates`, `details` and `location`; there is no reminder parameter, so an
 * entry saved this way gets whatever default the guest has set on their own
 * calendar. That is why the `.ics` exists beside it rather than instead of
 * it, and why nothing in this file claims otherwise any more.
 *
 * `URLSearchParams` does the encoding. There is deliberately no
 * iCalendar-style escaping here: this is a query parameter, and the
 * backslashes that format needs would arrive as literal backslashes in the
 * guest's event.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${asUtcStamp(event.start)}/${asUtcStamp(endOf(event))}`,
    details: event.description,
    // Present only on the entry that is allowed one. `URLSearchParams` would
    // happily write `location=` for an absent value, which is a parameter
    // Google reads as an empty place rather than as no place.
    ...(event.location === undefined ? {} : { location: event.location }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
