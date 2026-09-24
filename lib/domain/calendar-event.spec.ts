import { describe, expect, it } from "vitest";

import {
  CEREMONY_MINUTES,
  buildStreamCalendarEvent,
  googleCalendarUrl,
} from "./calendar-event";

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
