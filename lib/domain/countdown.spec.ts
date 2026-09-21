import { describe, expect, it } from "vitest";

import { remainingUntil } from "./countdown";

const TARGET = new Date("2026-11-28T05:00:00.000Z");

/** `TARGET` minus the given offset, so each case reads as "this long before". */
function before({
  days = 0,
  hours = 0,
  minutes = 0,
  seconds = 0,
  millis = 0,
}: {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  millis?: number;
}): Date {
  return new Date(
    TARGET.getTime() -
      (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000 -
      millis,
  );
}

describe("remainingUntil", () => {
  it("splits the gap into whole days, hours, minutes and seconds", () => {
    expect(
      remainingUntil(
        TARGET,
        before({ days: 3, hours: 2, minutes: 5, seconds: 9 }),
      ),
    ).toEqual({
      days: 3,
      hours: 2,
      minutes: 5,
      seconds: 9,
      hasArrived: false,
    });
  });

  /**
   * Each unit carries only its own remainder.
   *
   * The failure this pins is the one every hand-rolled countdown ships at least
   * once: hours computed as `floor(diff / 3600000)` with no `% 24`, so a page
   * two days out announces "48 horas" beside "2 días" and says the same thing
   * twice in different units.
   */
  it("carries no unit into the next", () => {
    expect(remainingUntil(TARGET, before({ hours: 49 }))).toEqual({
      days: 2,
      hours: 1,
      minutes: 0,
      seconds: 0,
      hasArrived: false,
    });
  });

  /**
   * Truncation, not rounding.
   *
   * "Faltan 4 segundos" must mean at least four seconds remain. Rounding 4.5s up
   * to 5 makes the last visible figure a second that has already gone, and the
   * countdown then appears to skip one when it corrects itself.
   */
  it("truncates a partial second rather than rounding it", () => {
    expect(remainingUntil(TARGET, before({ seconds: 4, millis: 500 }))).toEqual(
      {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 4,
        hasArrived: false,
      },
    );
  });

  it("reports arrival at the exact instant, with every unit at zero", () => {
    expect(remainingUntil(TARGET, TARGET)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      hasArrived: true,
    });
  });

  /**
   * The day of the wedding is not a countdown that has gone negative.
   *
   * Left unclamped this is what a guest opening the page during the reception
   * reads: "faltan -1 días". Every unit is pinned to zero and `hasArrived` is
   * the flag the surface switches on.
   */
  it("stays at zero once the wedding is behind us", () => {
    expect(
      remainingUntil(TARGET, new Date("2026-12-25T00:00:00.000Z")),
    ).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      hasArrived: true,
    });
  });

  /**
   * An invalid date is a loud failure, never a rendered one.
   *
   * `new Date("nonsense").getTime()` is `NaN`, and `NaN` propagates through
   * every arithmetic operation below without throwing. Unguarded, the page
   * renders "NaN días" to a guest — a defect visible to everybody except the
   * suite.
   */
  it("refuses an invalid instant on either side", () => {
    expect(() => remainingUntil(new Date("nonsense"), TARGET)).toThrow(
      /invalid instant/i,
    );
    expect(() => remainingUntil(TARGET, new Date("nonsense"))).toThrow(
      /invalid instant/i,
    );
  });
});
