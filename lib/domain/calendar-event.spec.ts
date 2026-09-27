import { describe, expect, it } from "vitest";

import {
  CEREMONY_MINUTES,
  buildCeremonyCalendarEvent,
  buildIcs,
  buildStreamCalendarEvent,
  googleCalendarUrl,
} from "./calendar-event";
import { VENUE_COORDINATES } from "./wedding-day";

const START = new Date("2026-11-28T17:00:00-05:00");
const FACTS = {
  coupleNames: "Luis & Michell",
  streamUrl: "https://meet.google.com/abc-defg-hij",
};

const EVENT = buildStreamCalendarEvent(FACTS, START);

describe("buildStreamCalendarEvent", () => {
  it("names the couple in the title", () => {
    expect(EVENT.title).toContain("Luis & Michell");
  });

  it("carries the joining details in the description", () => {
    expect(EVENT.description).toContain(FACTS.streamUrl);
  });

  /**
   * The identifier is derived from the instant, not random.
   *
   * A calendar treats UID as the identity of the event: a guest who adds it
   * twice should end up with ONE entry that got updated, not two that both
   * fire. A fresh random id per request guarantees the duplicate.
   */
  it("gives the event a stable identity", () => {
    const again = buildStreamCalendarEvent(FACTS, START);

    expect(again.uid).toBe(EVENT.uid);
    expect(EVENT.uid).toMatch(/20261128T220000Z/);
  });
});

describe("googleCalendarUrl", () => {
  const url = new URL(googleCalendarUrl(EVENT));

  it("points at Google's event template", () => {
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.pathname).toBe("/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });

  it("spans the ceremony, an hour by default", () => {
    expect(CEREMONY_MINUTES).toBe(60);
    expect(url.searchParams.get("dates")).toBe(
      "20261128T220000Z/20261128T230000Z",
    );
  });

  it("carries the joining details, encoded rather than escaped", () => {
    const details = url.searchParams.get("details") ?? "";

    // Google reads a query parameter, not an iCalendar TEXT value, so the
    // backslash escaping that the file needs would arrive as literal
    // backslashes in the guest's event.
    expect(details).toContain(FACTS.streamUrl);
    expect(details).not.toContain("\\,");
  });
});

/**
 * THE FILE, WHICH WAS DELETED AND IS BACK BY THE COUPLE'S OWN DECISION.
 *
 * "Volvé al .ics con las dos alarmas para que probemos qué sucede en un
 * android e iphone." It is an experiment: what each phone does with the file
 * is the thing they want to see. The implementation is the one git held —
 * `2cb43cb` removed it — recovered rather than rewritten, because the
 * octet-accurate folding and the escaping order are easy to get subtly wrong
 * and were already right.
 */
describe("buildIcs", () => {
  const STAMP = new Date("2026-09-27T12:00:00Z");
  const ics = buildIcs(EVENT, STAMP);
  const unfold = (value: string) => value.replace(/\r\n /g, "");
  const lines = unfold(ics).split("\r\n");

  it("is a calendar with one event in it", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    // Every content line ends with CRLF, the last one included: a file that
    // stops mid-line is a file some readers reject.
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("states the same instants the Google entry states", () => {
    expect(lines).toContain("DTSTART:20261128T220000Z");
    expect(lines).toContain("DTEND:20261128T230000Z");
    expect(lines).toContain("DTSTAMP:20260927T120000Z");
  });

  /**
   * THE TWO ALARMS, ASSERTED AS INSTANTS RATHER THAN AS TRIGGER SYNTAX.
   *
   * The couple asked for "the day before at 8:00 p.m." and "three hours
   * before the start". Asserting `-PT21H` would pass while meaning the wrong
   * thing the moment the ceremony moved an hour: the evening alarm is a time
   * of DAY and the other is a duration, so what is checked here is where each
   * one actually lands, computed from the wedding's own instant.
   */
  it("rings the evening before at eight, where the wedding is", () => {
    const trigger = lines.find((line) =>
      line.startsWith("TRIGGER;VALUE=DATE-TIME:"),
    );

    expect(trigger).toBeDefined();

    const stamp = trigger!.split(":")[1];
    const when = new Date(
      `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`,
    );

    expect(when.toISOString()).toBe(
      new Date("2026-11-27T20:00:00-05:00").toISOString(),
    );
    // And it is the evening BEFORE, not the evening of.
    expect(when.getTime()).toBeLessThan(START.getTime());
  });

  it("rings again three hours before the start", () => {
    expect(lines).toContain("TRIGGER:-PT3H");

    const threeHoursBefore = new Date(START.getTime() - 3 * 60 * 60_000);

    expect(threeHoursBefore.toISOString()).toBe(
      new Date("2026-11-28T14:00:00-05:00").toISOString(),
    );
  });

  /**
   * AND THE EVENING ALARM MOVES WITH THE CEREMONY RATHER THAN DRIFTING.
   *
   * The failure this guards is silent: a relative trigger keeps its distance
   * from the start, so a wedding moved to 7pm would ring at 10pm the night
   * before and nothing would say so. Two hours later in the day, same alarm
   * time.
   */
  it("still rings at eight if the ceremony moves", () => {
    const later = buildStreamCalendarEvent(
      FACTS,
      new Date("2026-11-28T19:00:00-05:00"),
    );
    const trigger = unfold(buildIcs(later, STAMP))
      .split("\r\n")
      .find((line) => line.startsWith("TRIGGER;VALUE=DATE-TIME:"))!;

    expect(trigger).toBe("TRIGGER;VALUE=DATE-TIME:20261128T010000Z");
  });

  /** 75 octets, counted in bytes rather than characters — this copy is Spanish. */
  it("folds every line to 75 octets", () => {
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("escapes the separators iCalendar would otherwise read", () => {
    const event = buildStreamCalendarEvent(
      { coupleNames: "A, B; C\\D", streamUrl: FACTS.streamUrl },
      START,
    );
    const summary = unfold(buildIcs(event, STAMP))
      .split("\r\n")
      .find((line) => line.startsWith("SUMMARY:"))!;

    // The backslash is escaped FIRST, so the comma's escape is not itself
    // escaped: `a\,b` rather than `a\\,b`.
    expect(summary).toBe("SUMMARY:Matrimonio de A\\, B\\; C\\\\D");
  });
});

/**
 * THE PRIVACY LINE, WHICH IS THE ONE THING IN THIS FILE THAT IS NOT A
 * CONVENIENCE.
 *
 * The venue is told only to a household that says it is coming. A calendar
 * entry is forwarded exactly like a link — more durably, in fact, since it
 * lands in a file and an app rather than in a chat — so an address in a
 * declining household's entry travels further than anything the page ever
 * showed them.
 *
 * Asserted from both directions: the ceremony entry HAS the location, and the
 * stream entry has no trace of it in either output.
 */
describe("which entry may name the venue", () => {
  const CEREMONY_EVENT = buildCeremonyCalendarEvent(
    { ...FACTS, venueName: "Salón para Eventos Villa Campestre" },
    START,
  );
  const STAMP = new Date("2026-09-27T12:00:00Z");

  it("gives an accepted household the place, by name and by coordinate", () => {
    expect(CEREMONY_EVENT.location).toContain(
      "Salón para Eventos Villa Campestre",
    );
    expect(CEREMONY_EVENT.location).toContain(VENUE_COORDINATES);

    const url = new URL(googleCalendarUrl(CEREMONY_EVENT));

    expect(url.searchParams.get("location")).toBe(CEREMONY_EVENT.location);
    expect(buildIcs(CEREMONY_EVENT, STAMP)).toContain("LOCATION:");
  });

  /**
   * THE SAME COORDINATE THE DIRECTIONS BUTTON USES, which is why it lives in
   * the domain now rather than inside `VenueMap`. Two copies are two venues
   * the day somebody edits one, and the guest finds out on the afternoon of
   * the wedding.
   */
  it("sends the calendar to the same point the map does", () => {
    expect(VENUE_COORDINATES).toBe("3.853778,-76.2971633");
    expect(CEREMONY_EVENT.location).toContain(VENUE_COORDINATES);
  });

  it("tells a stream guest nothing about where it is", () => {
    const ics = buildIcs(EVENT, STAMP);
    const url = googleCalendarUrl(EVENT);

    expect(EVENT.location).toBeUndefined();
    expect(url).not.toContain("location=");
    expect(ics).not.toContain("LOCATION");

    // Not by name and not by number, in either output — the coordinate is the
    // one that would survive a search-and-replace of the venue's name.
    for (const output of [ics, url, decodeURIComponent(url)]) {
      expect(output).not.toContain(VENUE_COORDINATES);
      expect(output).not.toContain("3.853778");
      expect(output).not.toContain("Villa Campestre");
    }
  });

  /**
   * AND AN EMPTY LOCATION IS NOT THE SAME AS NO LOCATION — the negative
   * control for the way this could regress.
   *
   * The obvious "simplification" is one builder with `location: facts.venueName
   * ?? ""`, which writes `LOCATION:` into every stream entry and `location=`
   * into every stream URL. Readers treat the property as present and some
   * render the blank; more to the point, the next edit that fills the empty
   * string in would leak the venue to everybody without touching a call site.
   */
  it("writes no empty location for the entry that has none", () => {
    const ics = buildIcs(EVENT, STAMP);

    expect(ics.split("\r\n").some((line) => line.startsWith("LOCATION"))).toBe(
      false,
    );
    expect(new URL(googleCalendarUrl(EVENT)).searchParams.has("location")).toBe(
      false,
    );
  });
});
