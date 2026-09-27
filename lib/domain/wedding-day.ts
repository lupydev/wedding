/**
 * The wedding day itself — pure.
 *
 * TWO VALUES LIVE HERE AND THEY ARE THE ONLY PLACE THE LANDING PAGE STATES A
 * FACT ABOUT THIS WEDDING.
 *
 * Every other surface reads `ceremony` (`supabase/migrations/0009_ceremony.sql`,
 * whose own comment says so in as many words) for WHERE the wedding is. Nothing
 * reads it for WHEN any more. The row used to carry `ceremony_date` and
 * `ceremony_time` as `text` — free prose an operator typed into the console —
 * and a countdown needs an INSTANT: recovering one from prose means parsing
 * "28 de noviembre de 2026", a guess that fails silently on the first wording
 * the parser did not anticipate, leaving a page that counts confidently towards
 * the wrong day.
 *
 * THE COLUMNS ARE GONE, AND THAT IS THE DECISION RATHER THAN A STEP TOWARDS
 * ONE. This comment used to promise a `timestamptz` on that row as the end
 * state, edited in the console and read here.
 * `supabase/migrations/0018_drop_ceremony_date_time.sql` settled it the other
 * way: the wedding's day and hour live in `WEDDING_INSTANT` below and nowhere
 * else, so moving the wedding is a deploy rather than an `UPDATE`. That answers
 * `odd/tasks/wedding-landing.md`'s open question in the negative, and
 * `odd/tasks/invitation-design.md` (U31) records the trade in full.
 *
 * THE DRIFT THIS FILE ONCE CALLED HYPOTHETICAL ACTUALLY HAPPENED. It claimed
 * there was nothing to drift from because the row still held its seeded
 * placeholder, untouched. By the time 0018 ran, the couple had filled it in —
 * the migration's own `raise notice` printed a real date and a real hour on the
 * way out — so for a while the database and this constant both stated the day,
 * separately, with nothing keeping them equal. One statement of the day is the
 * point; that is why there is exactly one below.
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

/**
 * How long before the wedding the RSVP closes.
 *
 * The couple said "hasta una semana antes de la boda" — a RULE, not a date — so
 * the code says the rule and derives the date. A literal "2026-11-21" would be
 * the same answer today and the wrong one the moment the wedding moved, and it
 * would be wrong silently: nothing about a stale deadline looks broken until a
 * household is refused an answer it should have been allowed to give.
 *
 * It happens to be the same seven days as `STREAM_WINDOW_DAYS`, and they are
 * NOT shared. Two decisions that coincide today are still two decisions:
 * widening the stream's window must not quietly move the day the RSVP closes.
 */
export const RSVP_DEADLINE_DAYS_BEFORE = 7;

/**
 * The last day a household may answer, as a calendar day where the wedding is.
 *
 * `YYYY-MM-DD`, because that is what `isRsvpOpen` demands and that function
 * THROWS on anything else — a deadline it could not parse would take the RSVP
 * down for everybody. Open through the END of this day in `WEDDING_TIME_ZONE`:
 * a guest answering on the evening of the 21st in Bogota is on time.
 *
 * ONE VALUE FOR THE WHOLE WEDDING, AND IT USED TO BE ONE PER INVITATION.
 * `invitations.rsvp_deadline` meant the couple typed the same date into every
 * household they created, and a forgotten one meant an invitation that never
 * closed. There is one wedding, so there is one deadline.
 */
export const RSVP_DEADLINE = calendarDateInZone(
  new Date(WEDDING_INSTANT.getTime() - RSVP_DEADLINE_DAYS_BEFORE * 86_400_000),
  WEDDING_TIME_ZONE,
);

/**
 * The deadline as a guest reads it: "21 de noviembre de 2026".
 *
 * The invitation used to print the ISO day verbatim — "Confirmen su asistencia
 * antes del 2026-11-21" — which is a machine's spelling of a date on the one
 * page written for people. Derived from the same instant, so the sentence and
 * the gate can never name different days.
 */
export const RSVP_DEADLINE_TEXT = formatWeddingDate(
  new Date(WEDDING_INSTANT.getTime() - RSVP_DEADLINE_DAYS_BEFORE * 86_400_000),
);

/** How the couple's names are written, exactly as they gave them. */
export const COUPLE_NAMES = "Luis & Michell";

/**
 * What the couple asked their guests to wear.
 *
 * A FIXED FACT, ON THE SAME TERMS AS THE DAY AND THE HOUR ABOVE. It is not a
 * `ceremony` column and deliberately not one: migration 0018 settled that the
 * wedding's own unchanging facts live in this module, so moving any of them is
 * a deploy rather than an `UPDATE`. The couple accepted that price for the date
 * and accepted it again for this. Adding a column and a console field for a
 * two-word phrase that will not change before the wedding would buy a form
 * nobody fills in and a second place a reader has to look.
 *
 * It is written capitalised because it is printed as the VALUE under a label,
 * where a lowercase phrase reads as a fragment rather than as an answer.
 */
export const WEDDING_DRESS_CODE = "Formal elegante";

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

/**
 * When the ceremony begins, as a guest reads it: "5:00 p. m.".
 *
 * THIS IS THE FIRST TIME THE HOUR REACHES A GUEST, and that is why the couple
 * were asked to confirm it before this function existed. `WEDDING_INSTANT` has
 * carried five in the afternoon since they gave it, but nothing ever PRINTED
 * it: the countdown consumed the instant and rendered "0 días, 9 horas", the
 * announcement printed only the day, and migration 0018 dropped the
 * `ceremony_time` column a household would otherwise have read. A wrong hour
 * was therefore invisible until now — a guest could only have been an hour
 * early or an hour late by inference. From the invitation's last screen
 * onwards it is a sentence somebody plans their afternoon around, so it is
 * their own answer rather than a default this file chose.
 *
 * `es-CO` and the zone, for the reason `formatWeddingDate` gives: the locale
 * that matches where the wedding is renders the forms its guests read, which
 * here means `5:00 p. m.` rather than `5:00 PM` or a 24-hour clock. The
 * parameters exist so the spec can prove the zone is applied rather than
 * decorative.
 */
export function formatWeddingTime(
  instant: Date = WEDDING_INSTANT,
  timeZone: string = WEDDING_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeStyle: "short",
    timeZone,
  }).format(instant);
}

/**
 * WHERE THE WEDDING IS, DECLARED ONCE.
 *
 * WGS84 decimal degrees, "lat,lon" — the form Google Maps expects. Two copies
 * become two venues the day somebody edits one, and that failure is silent: a
 * guest sent to the wrong side of Buga finds out on the afternoon of the
 * wedding. `tools/venue-coordinates.spec.ts` asserts this file is the only
 * source that names the latitude, and that it names it once.
 *
 * WHY THIS IS IN THE SOURCE AT ALL, WHEN `tools/no-source-placeholders.spec.ts`
 * ARGUES THE OPPOSITE. That rule exists because the venue's NAME lives in the
 * `ceremony` row, where an operator corrects it with an UPDATE and no
 * redeploy. A coordinate is not that kind of fact: it is not a name anybody
 * proofreads, an operator typing one has no way to see whether it landed on
 * the right field, and a wrong one fails silently in a way a wrong name never
 * does. Binding it to a commit is the trade, and the price is stated plainly —
 * MOVING THE WEDDING MEANS A DEPLOY, not editing a row. Taken knowingly, on a
 * wedding whose venue is booked.
 *
 * A COMMITTED PICTURE OF THIS POINT STOOD BESIDE IT and is gone; the
 * paragraphs above say why. What the deletion removes from this constant is
 * the older, stronger argument for keeping it in the source — that a
 * coordinate in the database would move the link while the committed image
 * went on showing the old place. There is no image to disagree with any more,
 * so the reason is the one written above and nothing else.
 */
export const VENUE_COORDINATES = "3.853778,-76.2971633";
