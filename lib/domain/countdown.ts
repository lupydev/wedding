/**
 * Countdown arithmetic — pure.
 *
 * Deliberately a function of two instants rather than a function of one that
 * reads the clock. `now` is a parameter, so every case below is an ordinary
 * assertion with no fake timers, and the component that ticks owns the only
 * call to `Date.now()` in the feature.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * What is left, already split into the units a reader sees.
 *
 * Every unit carries only its own remainder: `hours` is 0–23, `minutes` and
 * `seconds` are 0–59. A figure that has not been reduced says the same thing
 * twice — "2 días" beside "48 horas" — and a reader has to work out which one
 * to believe.
 */
export interface Remaining {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  /** True from the target instant onwards. The surface switches copy on it. */
  readonly hasArrived: boolean;
}

/** Every unit at rest — the shape returned once the day is here. */
const ARRIVED: Remaining = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  hasArrived: true,
};

/**
 * How long from `now` until `target`.
 *
 * Truncated, never rounded: "faltan 4 segundos" promises that at least four
 * seconds remain. Rounding upwards shows a second that has already passed, and
 * the display then appears to skip one when the next tick corrects it.
 *
 * Clamped at zero rather than going negative, because the day of the wedding is
 * not a countdown in deficit — it is a different thing to say, and `hasArrived`
 * is how the surface is told to say it.
 *
 * An invalid instant throws. `NaN` propagates silently through every operation
 * here, so the alternative is a guest reading "NaN días" on a page whose tests
 * are all green.
 */
export function remainingUntil(target: Date, now: Date): Remaining {
  const targetMs = target.getTime();
  const nowMs = now.getTime();

  if (Number.isNaN(targetMs) || Number.isNaN(nowMs)) {
    throw new Error("Countdown received an invalid instant.");
  }

  const gap = targetMs - nowMs;

  if (gap <= 0) {
    return ARRIVED;
  }

  return {
    days: Math.floor(gap / DAY),
    hours: Math.floor(gap / HOUR) % 24,
    minutes: Math.floor(gap / MINUTE) % 60,
    seconds: Math.floor(gap / SECOND) % 60,
    hasArrived: false,
  };
}
