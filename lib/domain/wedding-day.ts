/**
 * The wedding day itself — pure.
 *
 * TWO VALUES LIVE HERE AND THEY ARE THE ONLY PLACE THE LANDING PAGE STATES A
 * FACT ABOUT THIS WEDDING.
 *
 * Every other surface reads `ceremony` (`supabase/migrations/0009_ceremony.sql`,
 * whose own comment says so in as many words). The landing page cannot, and the
 * reason is the column type: `ceremony_date` is `text`, free prose an operator
 * types into the console. A countdown needs an INSTANT, and recovering one from
 * prose means parsing "28 de noviembre de 2026" — a guess that fails silently on
 * the first wording the parser did not anticipate, leaving a page that counts
 * confidently towards the wrong day.
 *
 * The end state is a `timestamptz` on that row, edited in the console, read
 * here. Until it exists this file is the single place to correct, and
 * `odd/tasks/wedding-landing.md` records the trade in full. There is nothing to
 * drift from yet: the row still holds its seeded placeholder, untouched.
 *
 * The literal placeholder token is deliberately NOT written above.
 * `tools/no-source-placeholders.spec.ts` scans comments as well as code, and it
 * is right to: a comment naming one teaches the next reader that the value is a
 * compile-time constant, which is the belief that guard exists to remove.
 */

import { calendarDateInZone } from "./rsvp-deadline";

/** Where the wedding is, and therefore whose midnight starts the day. */
export const WEDDING_TIME_ZONE = "America/Bogota";

/**
 * When the ceremony begins: five in the afternoon, Bogota time.
 *
 * GIVEN BY THE COUPLE, NOT ASSUMED. It was midnight for one commit, marked as
 * an assumption in both this comment and the task document, because a day had
 * been chosen and an hour had not. It is the real hour now, and the difference
 * is not cosmetic: the countdown reaches zero when the two of them start
 * walking, so on the morning of the 28th it reads "0 días, 9 horas" — which is
 * the truth a guest wants that morning — instead of having expired at midnight.
 *
 * Written with an offset rather than a zone, which is the one place this file
 * departs from `rsvp-deadline.ts`'s rule. `wedding-day.spec.ts` asserts that the
 * offset still lands on 17:00 in `WEDDING_TIME_ZONE`, so the day the rule
 * bites — Colombia adopting daylight saving — the suite says so rather than the
 * page counting to an hour that has moved.
 */
export const WEDDING_INSTANT = new Date("2026-11-28T17:00:00-05:00");

/**
 * The wedding day as `YYYY-MM-DD`, for a `<time dateTime>` attribute.
 *
 * DERIVED, never written a second time. A literal here would be a third place
 * holding this date, and the one that drifts is always the one a reader cannot
 * see — a machine date disagreeing with the prose beside it is invisible on the
 * page and wrong in every calendar that reads it.
 */
export const WEDDING_ISO_DAY = calendarDateInZone(
  WEDDING_INSTANT,
  WEDDING_TIME_ZONE,
);

/** How the couple's names are written, exactly as they gave them. */
export const COUPLE_NAMES = "Luis & Michell";

/**
 * The wedding day as Spanish prose: "28 de noviembre de 2026".
 *
 * `es-CO` rather than `es`, for the same reason the zone is named: the locale
 * that matches where the wedding is renders the forms its guests read. The
 * parameter exists so the spec can prove the zone is applied rather than
 * decorative.
 */
export function formatWeddingDate(
  instant: Date = WEDDING_INSTANT,
  timeZone: string = WEDDING_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeZone,
  }).format(instant);
}

/**
 * The day of the week, lowercase: "sábado".
 *
 * Spanish does not capitalise weekdays, and `Intl` correctly does not. Any
 * capital belongs to the surface that starts a line with it, through CSS, so
 * that the value stays correct prose wherever else it is used.
 */
export function formatWeddingWeekday(
  instant: Date = WEDDING_INSTANT,
  timeZone: string = WEDDING_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    timeZone,
  }).format(instant);
}
