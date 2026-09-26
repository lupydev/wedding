"use client";

import { useEffect, useState } from "react";

import { type Remaining, remainingUntil } from "@/lib/domain/countdown";
import { WEDDING_INSTANT } from "@/lib/domain/wedding-day";

/**
 * The live countdown to the wedding.
 *
 * A CLIENT COMPONENT THAT RENDERS NOTHING ON THE SERVER, DELIBERATELY.
 *
 * `/` is statically generated: whatever this renders on the server is computed
 * once, at build time, and then served unchanged for weeks. A server-rendered
 * figure would therefore be stale by construction, and React would have to
 * replace it during hydration — a text mismatch on every visit and a visible
 * flicker for the visitor.
 *
 * So the first render, on both sides, holds no figures at all. `useEffect` does
 * not run on the server and runs after hydration on the client, which makes the
 * markup identical on both sides by construction rather than by luck. The cost
 * is a skeleton for one frame; the alternative is a wrong number for weeks.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/** One row of the countdown: its figure and the word under it. */
interface Unit {
  readonly value: number;
  readonly label: string;
}

/**
 * The four units, singular and plural.
 *
 * A table rather than four ternaries at the call site: "1 días" is the classic
 * tell of a countdown nobody proofread, and it appears exactly when one unit's
 * singular form was forgotten. Kept together, a missing form is visible.
 */
const UNIT_WORDS: readonly (readonly [singular: string, plural: string])[] = [
  ["día", "días"],
  ["hora", "horas"],
  ["minuto", "minutos"],
  ["segundo", "segundos"],
];

function unitsOf(remaining: Remaining): readonly Unit[] {
  const values = [
    remaining.days,
    remaining.hours,
    remaining.minutes,
    remaining.seconds,
  ];

  return values.map((value, index) => {
    const [singular, plural] = UNIT_WORDS[index];

    return { value, label: value === 1 ? singular : plural };
  });
}

/** What a screen reader is told. Changes at most once a day. */
function summaryOf(remaining: Remaining | null): string {
  if (remaining === null) {
    return "Cuenta regresiva para el día de la boda.";
  }

  if (remaining.hasArrived) {
    return "Hoy nos casamos.";
  }

  const days = remaining.days;

  return `Faltan ${days} ${days === 1 ? "día" : "días"} para la boda.`;
}

export function Countdown({
  target = WEDDING_INSTANT,
}: {
  /** Injectable so the spec can pin an instant. Production uses the default. */
  readonly target?: Date;
}) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  /**
   * `target.getTime()` rather than `target` in the dependency list.
   *
   * Two `Date` objects for the same instant are different references, so a
   * parent that built one inline would tear down and rebuild the interval on
   * every render. The number is the identity that actually matters here.
   */
  const targetMs = target.getTime();

  useEffect(() => {
    const instant = new Date(targetMs);
    const tick = () => setRemaining(remainingUntil(instant, new Date()));

    // Once immediately: waiting a second before the first paint would leave the
    // skeleton on screen for a beat longer than it needs to be.
    tick();

    const timer = setInterval(tick, 1_000);

    // Released on unmount. Left running, the callback fires against an
    // unmounted tree and one more interval accumulates per visit back here.
    return () => clearInterval(timer);
  }, [targetMs]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/*
        The accessible truth, and the only part of this block a screen reader
        reads. It is NOT a live region: the figures below change every second,
        and announced they would talk over the rest of the page without pause.
      */}
      <p className="sr-only" data-testid="countdown-summary">
        {summaryOf(remaining)}
      </p>

      {remaining?.hasArrived === true ? (
        <p
          data-testid="countdown-arrived"
          className="font-display text-2xl text-[#f6efe2] sm:text-3xl"
        >
          ¡Hoy nos casamos!
        </p>
      ) : (
        <ol
          aria-hidden="true"
          data-testid="countdown-figures"
          className="flex items-start justify-center gap-5 sm:gap-8"
        >
          {remaining === null
            ? UNIT_WORDS.map(([, plural]) => (
                <li key={plural} data-testid="countdown-skeleton">
                  <Figure figure="··" label={plural} />
                </li>
              ))
            : unitsOf(remaining).map((unit) => (
                <li key={unit.label} data-testid="countdown-unit">
                  <Figure figure={String(unit.value)} label={unit.label} />
                </li>
              ))}
        </ol>
      )}
    </div>
  );
}

/**
 * One figure and its word.
 *
 * `tabular-nums` is not decoration. Proportional digits are different widths,
 * so a seconds figure ticking 9 → 8 → 7 makes the whole row shift sideways
 * every second. The feature is a number that changes constantly; the one type
 * setting that matters is the one that stops it from dancing.
 */
function Figure({ figure, label }: { figure: string; label: string }) {
  return (
    <div className="flex min-w-14 flex-col items-center gap-1 sm:min-w-20">
      <span
        data-testid="countdown-figure"
        className="font-display text-3xl leading-none tabular-nums text-[#f6efe2] sm:text-5xl"
      >
        {figure}
      </span>
      <span
        data-testid="countdown-label"
        className="text-[0.65rem] uppercase tracking-[0.18em] text-[#f6efe2]/65 sm:text-xs"
      >
        {label}
      </span>
    </div>
  );
}
