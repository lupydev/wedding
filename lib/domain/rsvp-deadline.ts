/**
 * RSVP deadline evaluation — pure.
 *
 * `invitations.rsvp_deadline` is a bare `date`, which is the right type: the
 * couple chose a DAY, not an instant. The defect is in reading it. Compared
 * against a timestamp, `2026-05-01` becomes 2026-05-01T00:00:00Z, which is
 * 19:00 on 30 April in Bogota — the form closes five hours before the chosen
 * day has even begun, and a guest answering on the evening of the first is told
 * they are late.
 *
 * The rule here is the one the couple actually meant: the invitation stays open
 * until the end of that calendar day where the wedding is.
 *
 * The zone is encoded, never the offset. Colombia does not observe daylight
 * saving today, so `-05:00` would produce identical answers — until the day it
 * does not, and then every boundary case is silently an hour wrong. `Intl`
 * carries the rules; a hard-coded offset carries only today's consequence of
 * them.
 */

/** Where the wedding is, and therefore where a day ends. */
export const RSVP_TIME_ZONE = "America/Bogota";

/** `date` values are ISO calendar days, exactly as Postgres renders them. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The civil calendar date at `instant`, as seen in `timeZone`.
 *
 * `en-CA` is used because its short date format IS `YYYY-MM-DD`, which makes
 * the result directly comparable to a Postgres `date` as a string: ISO calendar
 * days sort lexicographically in the same order they sort chronologically, so
 * the comparison needs no date arithmetic and no second time-zone conversion.
 */
export function calendarDateInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Is the RSVP still open?
 *
 * Open through the END of the deadline day in `timeZone`; closed from the first
 * moment of the next day. A null deadline means the invitation never closes,
 * which is what an invitation with no stated deadline promises.
 *
 * A malformed deadline throws rather than defaulting either way. Defaulting to
 * open would silently accept answers the couple believes are closed; defaulting
 * to closed would lock out a whole household over a typo. Both are worse than a
 * loud failure at the row that introduced it.
 */
export function isRsvpOpen(
  deadline: string | null,
  now: Date,
  timeZone: string = RSVP_TIME_ZONE,
): boolean {
  if (deadline === null) {
    return true;
  }

  const day = deadline.trim();

  if (!ISO_DATE.test(day)) {
    throw new Error(
      `RSVP deadline is not an ISO calendar day (YYYY-MM-DD): ${day}`,
    );
  }

  return calendarDateInZone(now, timeZone) <= day;
}
