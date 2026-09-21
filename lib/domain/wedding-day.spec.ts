import { describe, expect, it } from "vitest";

import { calendarDateInZone } from "./rsvp-deadline";
import {
  WEDDING_INSTANT,
  WEDDING_TIME_ZONE,
  formatWeddingDate,
  formatWeddingWeekday,
} from "./wedding-day";

/**
 * The hour of day at `instant`, as a 24-hour wall clock in `timeZone`.
 *
 * `en-GB` with `hour12: false` because its 24-hour rendering is `00:00` at
 * midnight. `en-US` renders the same instant as `24:00`, which reads as the END
 * of the previous day and would make the guard below assert the wrong thing.
 */
function wallClockInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

describe("WEDDING_INSTANT", () => {
  /**
   * THIS IS THE GUARD THE WRITTEN OFFSET NEEDS.
   *
   * `lib/domain/rsvp-deadline.ts` states the project's rule: encode the zone,
   * never the offset, because Colombia does not observe daylight saving TODAY
   * and a hard-coded `-05:00` carries only today's consequence of that.
   *
   * The constant is nonetheless written with an offset, because a countdown
   * needs one instant and deriving it from a civil day would cost a date
   * library this project does not have. This test is the price of that choice:
   * it asserts what the offset is SUPPOSED to mean. If Colombia ever adopts
   * daylight saving and the platform's tzdata learns about it, the offset stops
   * landing on five in the afternoon and this test goes red — loudly, in CI,
   * rather than silently on the page.
   *
   * The wall clock is asserted as well as the day, and that is the half that
   * matters most now. An offset that drifted by an hour would still land on the
   * 28th, so a test checking only the calendar day would stay green while the
   * countdown reached zero an hour before the ceremony began.
   */
  it("is the hour the ceremony begins, where the wedding is", () => {
    expect(calendarDateInZone(WEDDING_INSTANT, WEDDING_TIME_ZONE)).toBe(
      "2026-11-28",
    );
    expect(wallClockInZone(WEDDING_INSTANT, WEDDING_TIME_ZONE)).toBe("17:00");
  });

  it("is a valid instant", () => {
    expect(Number.isNaN(WEDDING_INSTANT.getTime())).toBe(false);
  });
});

describe("formatWeddingDate", () => {
  it("reads as a Spanish long date", () => {
    expect(formatWeddingDate(WEDDING_INSTANT)).toBe("28 de noviembre de 2026");
  });

  /**
   * The zone is applied, not merely accepted.
   *
   * A zone silently ignored would still produce "28 de noviembre" for almost
   * anywhere on earth, and the test would pass while proving nothing. So the
   * assertion needs a zone where this instant falls on a DIFFERENT calendar
   * day, and only then does it bite.
   *
   * It was Honolulu while the ceremony was pencilled in at midnight: 17:00 the
   * previous day there, so the 27th. Five in the afternoon moved the instant
   * five hours later and Honolulu became noon on the 28th — the assertion went
   * red for a correct reason, which is the guard doing its job. Kiritimati is
   * UTC+14, nineteen hours ahead of Bogota, so it is already the 29th there and
   * the test bites again.
   */
  it("renders the calendar day of the zone it is given", () => {
    expect(formatWeddingDate(WEDDING_INSTANT, "Pacific/Kiritimati")).toBe(
      "29 de noviembre de 2026",
    );
  });
});

describe("formatWeddingWeekday", () => {
  it("names the day of the week in Spanish, uncapitalised", () => {
    expect(formatWeddingWeekday(WEDDING_INSTANT)).toBe("sábado");
  });
});
