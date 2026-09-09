import { describe, expect, it } from "vitest";

import {
  isRsvpOpen,
  RSVP_TIME_ZONE,
  calendarDateInZone,
} from "./rsvp-deadline";

/**
 * The deadline the couple chose is a DAY, and a day ends when it ends where the
 * wedding is. Evaluated naively, `2026-05-01` becomes midnight UTC, which is
 * 19:00 on 30 April in Bogota — the form would close five hours before the day
 * the couple picked had even started.
 */
describe("isRsvpOpen", () => {
  it("is still open late on the deadline day in Bogota, though UTC has rolled over", () => {
    // 2026-05-02T02:00Z is 2026-05-01 21:00 in Bogota: the guest is still on
    // the deadline day, and a guest answering at nine in the evening is the
    // normal case, not an edge case.
    expect(isRsvpOpen("2026-05-01", new Date("2026-05-02T02:00:00.000Z"))).toBe(
      true,
    );
  });

  it("is open at the last second of the deadline day in Bogota", () => {
    expect(isRsvpOpen("2026-05-01", new Date("2026-05-02T04:59:59.999Z"))).toBe(
      true,
    );
  });

  it("is closed at the first second of the following day in Bogota", () => {
    expect(isRsvpOpen("2026-05-01", new Date("2026-05-02T05:00:00.000Z"))).toBe(
      false,
    );
  });

  it("is closed well after the deadline day", () => {
    expect(isRsvpOpen("2026-05-01", new Date("2026-05-09T12:00:00.000Z"))).toBe(
      false,
    );
  });

  it("is open before the deadline day", () => {
    expect(isRsvpOpen("2026-05-01", new Date("2026-04-28T12:00:00.000Z"))).toBe(
      true,
    );
  });

  it("is open when the invitation has no deadline at all", () => {
    expect(isRsvpOpen(null, new Date("2030-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("evaluates the boundary in a different zone when one is given", () => {
    // The zone is a parameter, not a constant baked into the rule: the same
    // instant is still 1 May in Bogota and already 2 May in Madrid.
    const instant = new Date("2026-05-02T02:00:00.000Z");

    expect(isRsvpOpen("2026-05-01", instant, "America/Bogota")).toBe(true);
    expect(isRsvpOpen("2026-05-01", instant, "Europe/Madrid")).toBe(false);
  });

  it("refuses a malformed deadline rather than guessing at it", () => {
    expect(() => isRsvpOpen("01/05/2026", new Date())).toThrow(/YYYY-MM-DD/);
  });
});

describe("calendarDateInZone", () => {
  it("reports the civil date in the zone, not the UTC date", () => {
    expect(
      calendarDateInZone(new Date("2026-05-02T02:00:00.000Z"), RSVP_TIME_ZONE),
    ).toBe("2026-05-01");
  });

  it("agrees with UTC when the instant is mid-afternoon in Bogota", () => {
    expect(
      calendarDateInZone(new Date("2026-05-01T18:00:00.000Z"), RSVP_TIME_ZONE),
    ).toBe("2026-05-01");
  });

  it("names the zone rather than an offset", () => {
    // Colombia does not observe daylight saving today. Encoding -05:00 would
    // bake that in and quietly break the day it stops being true.
    expect(RSVP_TIME_ZONE).toBe("America/Bogota");
  });
});
