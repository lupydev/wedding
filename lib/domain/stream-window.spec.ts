import { describe, expect, it } from "vitest";

import {
  STREAM_PATH,
  STREAM_WINDOW_DAYS,
  streamLinkIsOpen,
  streamLinkOpensAt,
} from "./stream-window";

/** The ceremony instant used throughout: 2026-11-28, 17:00 in Bogota. */
const CEREMONY = new Date("2026-11-28T17:00:00-05:00");

/** The instant the given number of whole days before the ceremony. */
function daysBefore(days: number): Date {
  return new Date(CEREMONY.getTime() - days * 86_400_000);
}

describe("streamLinkOpensAt", () => {
  it("is one week before the ceremony, to the minute", () => {
    expect(streamLinkOpensAt(CEREMONY).toISOString()).toBe(
      "2026-11-21T22:00:00.000Z",
    );
  });

  it("is derived from the ceremony rather than written down", () => {
    const other = new Date("2030-01-15T12:00:00Z");

    expect(streamLinkOpensAt(other).getTime()).toBe(
      other.getTime() - STREAM_WINDOW_DAYS * 86_400_000,
    );
  });
});

describe("streamLinkIsOpen", () => {
  it("is closed while more than a week remains", () => {
    expect(streamLinkIsOpen(CEREMONY, daysBefore(8))).toBe(false);
  });

  /**
   * The boundary is inclusive, and it is asserted on both sides.
   *
   * "Faltando una semana se habilita" reads as: at one week, it is on. A
   * strictly-greater comparison would hold it shut for one more millisecond,
   * which nobody would ever notice — and that is exactly why it would never be
   * caught if the comparison were wrong in the other direction by a whole day.
   */
  it("opens exactly one week before, and not a millisecond earlier", () => {
    expect(streamLinkIsOpen(CEREMONY, daysBefore(7))).toBe(true);
    expect(
      streamLinkIsOpen(CEREMONY, new Date(daysBefore(7).getTime() - 1)),
    ).toBe(false);
  });

  it("is open through the final week", () => {
    expect(streamLinkIsOpen(CEREMONY, daysBefore(3))).toBe(true);
    expect(streamLinkIsOpen(CEREMONY, daysBefore(0))).toBe(true);
  });

  /**
   * IT NEVER CLOSES AGAIN.
   *
   * The ceremony starts and the stream is the whole point for these guests —
   * a window that shut at 17:00 would hide the joining details from everybody
   * still trying to get in, at the precise moment they need them.
   */
  it("stays open during and after the ceremony", () => {
    expect(
      streamLinkIsOpen(CEREMONY, new Date("2026-11-28T18:30:00-05:00")),
    ).toBe(true);
    expect(streamLinkIsOpen(CEREMONY, new Date("2026-12-25T00:00:00Z"))).toBe(
      true,
    );
  });

  it("refuses an invalid instant rather than guessing", () => {
    expect(() => streamLinkIsOpen(CEREMONY, new Date("nonsense"))).toThrow(
      /invalid instant/i,
    );
  });
});

describe("STREAM_PATH", () => {
  it("is the path robots.txt disallows", () => {
    expect(STREAM_PATH).toBe("/transmision");
  });
});
