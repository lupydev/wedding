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
 * drift from yet: the row still holds `{{CEREMONY_DATE}}`.
 */

/** Where the wedding is, and therefore whose midnight starts the day. */
export const WEDDING_TIME_ZONE = "America/Bogota";

/**
 * The first moment of the wedding day.
 *
 * THE COUPLE GAVE A DAY, NOT AN HOUR. Midnight is an assumption and it is
 * recorded as one, here and in the task document. It is the reading that makes
 * a "faltan N días" figure say what a reader expects it to say: N is the number
 * of sleeps left, not a number measured from a ceremony hour nobody has fixed.
 * When the hour is known, change this line and the guard in the spec.
 *
 * Written with an offset rather than a zone, which is the one place this file
 * departs from `rsvp-deadline.ts`'s rule. `wedding-day.spec.ts` asserts that the
 * offset still lands on midnight in `WEDDING_TIME_ZONE`, so the day the rule
 * bites — Colombia adopting daylight saving — the suite says so.
 */
export const WEDDING_INSTANT = new Date("2026-11-28T00:00:00-05:00");

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
