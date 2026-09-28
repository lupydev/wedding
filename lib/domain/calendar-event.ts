/**
 * The ceremony as a calendar entry — pure.
 *
 * ONE DESTINATION NOW, AND THIS HEADER HAS LIED ABOUT THAT TWICE, SO IT IS
 * WORTH BEING PLAIN. Everything here ends up as a Google Calendar link: one
 * tap for anybody already signed in to Google, and nothing at all for anybody
 * who is not. That gap is named on the page rather than hidden.
 *
 * WHAT THE SECOND DESTINATION WAS, AND WHAT DELETING IT COST. An `.ics` file
 * stood beside the link — twice. It was built here with its own folding,
 * escaping and two alarms, removed in `2cb43cb`, restored at the couple's
 * request as an experiment on real phones, and removed again once they had
 * their answer: "el .ics realmente intenta descargar un archivo, entonces
 * descartemos ese boton." The experiment confirmed the original reason. A tap
 * that drops a file into a downloads folder has not helped anybody reading a
 * wedding invitation on their phone.
 *
 * THE COST IS THE REMINDER, AND NOTHING REPLACES IT. The file was the only
 * output that could carry an alarm. Google's `TEMPLATE` endpoint accepts
 * `action`, `text`, `dates`, `details` and `location` and has no parameter
 * for a reminder at all, so an entry saved through the link inherits whatever
 * default the guest has on their own calendar, which may be nothing. A guest
 * who joins by stream has no journey to plan around the date, which is
 * exactly the guest the alarms were added for; they now get their own
 * default and no more. That is not something this code can change,
 * and the honest thing is to say so here rather than to imply an alarm the
 * link never sets.
 *
 * AND THE TWO ENTRIES ARE NOT THE SAME ENTRY. See `buildCeremonyCalendarEvent`
 * and `buildStreamCalendarEvent`: one carries the venue's location and one
 * must never. A calendar entry is forwarded exactly like a link — more
 * durably, in fact, since it lands in an app rather than in a chat — so the
 * address in a declining household's entry would travel further than anything
 * the page ever showed them.
 *
 * Every value is derived from arguments, so the output is reproducible and the
 * whole thing is testable without a clock or a server.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

import { VENUE_COORDINATES } from "./wedding-day";

/**
 * How long the entry blocks out.
 *
 * AN ASSUMPTION, AND RECORDED AS ONE. The couple gave a start and nobody has
 * said how long the ceremony runs. An hour is the ordinary length and, more to
 * the point, the END of a calendar entry is not what a guest acts on — the
 * start is. Correcting it later is this line.
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

/*
  THE FILE'S OWN MACHINERY STOOD HERE, TWICE, AND IS GONE TWICE.

  An octet-accurate line folder, an iCalendar TEXT escaper, a UTF-8 measurer
  and the derivation that put an alarm at eight in the evening wherever the
  wedding is. All of it existed to serve `buildIcs`, and `buildIcs` existed
  because the Google link cannot carry a reminder.

  The couple deleted the file in `2cb43cb`, asked for it back as an experiment
  — "volvé al .ics con las dos alarmas para que probemos qué sucede en un
  android e iphone" — and deleted it again once they had their answer: "el
  .ics realmente intenta descargar un archivo, entonces descartemos ese
  boton." The experiment was the point, and it confirmed the original reason.

  Nothing here is kept against a third return. Code with no consumer is a
  thing to maintain and a thing to wonder about, and git holds every line of
  it twice over.
*/

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
    /*
      WHAT THE ENTRY SAYS, AND IT USED TO SAY THE WRONG THING TO HALF ITS
      READERS.

      "Nos casamos y los acompañamos por Google Meet." — the couple, looking
      at it on their phone: "el comentario esta horrible". It was worse than
      ugly: the screenshot they sent was the ACCEPTED household's entry, which
      carries the venue, and it spoke in the stream's voice as though they
      were watching from home.

      Two entries, two audiences, two sentences. This is the one a guest who
      is watching reads; `buildCeremonyCalendarEvent` writes the other.
    */
    description: [
      "Transmitimos la ceremonia en vivo para que puedan acompañarnos desde donde estén.",
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
 * The name is NOT beside the numbers; it is in the description. See the
 * comment on `location` below, which is where that cost real guests a venue.
 */
export function buildCeremonyCalendarEvent(
  facts: CeremonyCalendarFacts,
  start: Date,
): CalendarEvent {
  return {
    ...buildStreamCalendarEvent(facts, start),
    /*
      BARE COORDINATES, AND THE NAME IS DELIBERATELY NOT HERE.

      This read the venue's NAME with the coordinates in brackets after it
      for exactly one pass, and the couple found it on their phone: tapping
      it opened a DIFFERENT venue. Google text-searched the name and treated the
      parenthesised pair as decoration — the link they were sent carries
      `ftid=0x8e38599a77a5ec99:...` while their own venue is
      `0x8e39e561ae218207:...`. Two different places, confidently.

      Google's own URL documentation is unambiguous about the fix: a query
      "may be a place name, address, or comma-separated latitude/longitude
      coordinates", and a bare pair is the coordinate form. `venue_name` is
      "Villa Campestre" in production, which matches a dozen places in
      Colombia; a pair of decimals matches one point on the earth.

      A WRONG PIN IS WORSE THAN NO PIN. It sends fifty people confidently to
      the wrong town, and nothing about it looks wrong until they arrive.

      So the numbers go here, where the maps application reads them, and the
      venue's NAME goes in the description, where the guest reads it. A
      calendar entry showing only decimals helps nobody either.
    */
    location: VENUE_COORDINATES,
    description: [
      `Los esperamos en ${facts.venueName}.`,
      "",
      `También transmitimos la ceremonia en vivo: ${facts.streamUrl}`,
    ].join("\n"),
  };
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
 * calendar. Nothing in this module compensates for that any more — the `.ics`
 * that used to is gone — and nothing here claims otherwise.
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
