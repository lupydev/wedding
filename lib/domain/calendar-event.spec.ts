import { describe, expect, it } from "vitest";

import {
  CEREMONY_MINUTES,
  buildIcs,
  buildStreamCalendarEvent,
  googleCalendarUrl,
} from "./calendar-event";

const START = new Date("2026-11-28T17:00:00-05:00");
const STAMP = new Date("2026-09-20T12:00:00.000Z");

const FACTS = {
  coupleNames: "Luis & Michell",
  streamMeetingId: "123 4567 8901",
  streamPasscode: "boda2026",
};

const EVENT = buildStreamCalendarEvent(FACTS, START, STAMP);

/** The unfolded body, for assertions about content rather than layout. */
function unfolded(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

describe("buildStreamCalendarEvent", () => {
  it("names the couple in the title", () => {
    expect(EVENT.title).toContain("Luis & Michell");
  });

  it("carries the joining details in the description", () => {
    expect(EVENT.description).toContain(FACTS.streamMeetingId);
    expect(EVENT.description).toContain(FACTS.streamPasscode);
  });

  /**
   * The identifier is derived from the instant, not random.
   *
   * A calendar treats UID as the identity of the event: a guest who downloads
   * the file twice should end up with ONE entry that got updated, not two that
   * both fire. A fresh random id each request guarantees the duplicate.
   */
  it("gives the event a stable identity", () => {
    const again = buildStreamCalendarEvent(FACTS, START, new Date());

    expect(again.uid).toBe(EVENT.uid);
    expect(EVENT.uid).toMatch(/20261128T220000Z/);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(EVENT);

  it("is a complete VCALENDAR with one VEVENT", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(unfolded(ics)).toContain("VERSION:2.0");
    expect(unfolded(ics)).toContain("BEGIN:VEVENT");
    expect(unfolded(ics)).toContain("END:VEVENT");
  });

  /**
   * CRLF, EVERY LINE, WITHOUT EXCEPTION.
   *
   * RFC 5545 §3.1 specifies CRLF, and this is not pedantry that only a
   * validator would notice: Outlook rejects a bare-LF file outright, and the
   * guest sees a calendar that silently declines to import their invitation.
   */
  it("ends every line with CRLF", () => {
    expect(ics).not.toMatch(/(?<!\r)\n/);
  });

  it("writes the start and end as UTC instants", () => {
    const body = unfolded(ics);

    // 17:00 in Bogota is 22:00 UTC, and the ceremony runs an hour by default.
    expect(body).toContain("DTSTART:20261128T220000Z");
    expect(body).toContain("DTEND:20261128T230000Z");
    expect(CEREMONY_MINUTES).toBe(60);
  });

  /**
   * A REMINDER, WHICH IS THE WHOLE POINT OF ADDING IT TO A CALENDAR.
   *
   * An entry with no alarm is a note a guest has to remember to look at. Two:
   * the day before, to arrange the evening, and an hour before, to find the
   * laptop.
   */
  it("carries alarms the day before and an hour before", () => {
    const body = unfolded(ics);

    expect(body).toContain("BEGIN:VALARM");
    expect(body).toContain("TRIGGER:-P1D");
    expect(body).toContain("TRIGGER:-PT1H");
    expect(body.match(/BEGIN:VALARM/g)).toHaveLength(2);
  });

  /**
   * TEXT values are escaped, and getting this wrong corrupts the file.
   *
   * A comma inside a DESCRIPTION is a value SEPARATOR in iCalendar unless it is
   * escaped, so an unescaped one silently truncates everything after it — the
   * passcode, usually, because it is last.
   */
  it("escapes commas, semicolons, backslashes and newlines", () => {
    const awkward = buildIcs({
      ...EVENT,
      description: "uno, dos; tres\\cuatro\ncinco",
    });

    expect(unfolded(awkward)).toContain(
      "DESCRIPTION:uno\\, dos\\; tres\\\\cuatro\\ncinco",
    );
  });

  /**
   * Long lines are folded at 75 octets, and the fold counts BYTES.
   *
   * RFC 5545 measures the limit in octets, and this description is Spanish —
   * every "ó" and "á" is two bytes. A fold that counted characters would
   * overrun the limit, and worse, a fold placed mid-sequence would cut a
   * multi-byte character in half and hand the calendar invalid UTF-8.
   */
  it("folds long lines without splitting a multi-byte character", () => {
    const long = buildIcs({
      ...EVENT,
      description: "árbol ñandú öö ".repeat(20),
    });

    for (const line of long.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }

    // Every continuation line begins with the single space that marks it, and
    // unfolding restores the original text exactly.
    expect(unfolded(long)).toContain("árbol ñandú öö ".repeat(20).trimEnd());
  });
});

describe("googleCalendarUrl", () => {
  const url = new URL(googleCalendarUrl(EVENT));

  it("points at Google's event template", () => {
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.pathname).toBe("/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });

  it("carries the same instants as the file", () => {
    expect(url.searchParams.get("dates")).toBe(
      "20261128T220000Z/20261128T230000Z",
    );
  });

  it("carries the joining details, encoded rather than escaped", () => {
    const details = url.searchParams.get("details") ?? "";

    // Google reads a query parameter, not an iCalendar TEXT value, so the
    // backslash escaping that the file needs would arrive as literal
    // backslashes in the guest's event.
    expect(details).toContain(FACTS.streamMeetingId);
    expect(details).not.toContain("\\,");
  });
});
