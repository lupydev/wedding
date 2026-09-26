/**
 * The wedding's facts, and what counts as an acceptable value for each.
 *
 * Pure on purpose, and in `lib/domain` for the same reason the Open Graph card
 * model is: these four values are the whole content of the invitation, they
 * reach a guest through four separate surfaces, and one of those surfaces — the
 * Open Graph card — is served immutably and cached by WhatsApp per URL. What may
 * be stored is therefore a rule about the product rather than a detail of one
 * form handler, and it belongs somewhere testable without a database, a browser
 * or a session.
 *
 * No React, no storage vendor, no `zod`. `lib/domain` is vendor-free by project
 * rule, and what these rules need — trim, non-blank, a length the database
 * agrees with, and no control characters — is shorter written out than wired up.
 *
 * WHERE THIS SITS IN THE CHAIN
 *
 * The browser's `required` and `maxLength` attributes are a convenience and
 * never a boundary. This function is the boundary: the server action calls it on
 * every submission. The `ceremony` table's own non-blank and length checks
 * (migration 0011) are the line behind it, so a write that somehow skipped this
 * still cannot store a blank venue.
 *
 * Operator-facing labels and messages are Spanish, neutral register.
 * Identifiers and comments stay English.
 */

/**
 * Where the console edits them.
 *
 * One literal, several call sites — the nav item, the page, the action's
 * revalidation and the E2E suite. It lives beside the rules it belongs to, the
 * same way `CONSOLE_DEVICE_PATH` lives beside the device declaration.
 */
export const CONSOLE_WEDDING_PATH = "/console/wedding";

/**
 * The four values, in the order the console's form presents them.
 *
 * THE DAY AND THE HOUR ARE DELIBERATELY ABSENT. `ceremonyDate` and
 * `ceremonyTime` were here, and nothing a guest could open rendered either:
 * every caller of `StreamDetails` passed `showDate={false} showTime={false}`.
 * The day a guest reads comes from `WEDDING_INSTANT` in `lib/domain/
 * wedding-day.ts`, which also drives the countdown, the RSVP deadline and the
 * add-to-calendar link. Migration 0018 dropped both columns, so a field added
 * back here would validate something nothing stores.
 */
export const WEDDING_FACT_FIELDS = [
  "coupleNames",
  "venueName",
  "venueAddress",
  "streamUrl",
] as const;

export type WeddingFactField = (typeof WEDDING_FACT_FIELDS)[number];

/**
 * A complete, validated set of facts.
 *
 * Structurally `CeremonyDetails` from `lib/server/ceremony.ts`, deliberately not
 * imported from there: `lib/domain` may not depend on `lib/server`, and that is
 * what lets a component and a Server Action share this type. The field-list test
 * asserts the two agree.
 */
export type WeddingFacts = Readonly<Record<WeddingFactField, string>>;

/**
 * The maximum length of each value, in CHARACTERS.
 *
 * Identical to migration 0011's `char_length` checks. Two different numbers here
 * and there would mean a value this function accepts and Postgres refuses, which
 * reaches the operator as a database error instead of a message beside the
 * field.
 *
 * The address is allowed more room than anything else: a street plus a
 * neighbourhood plus a landmark is the one value that plausibly runs past 200
 * characters, and a truncated address is the half-correct one that sends a car
 * to the wrong gate.
 */
export const WEDDING_FACT_MAX_LENGTHS: Readonly<
  Record<WeddingFactField, number>
> = {
  coupleNames: 200,
  venueName: 200,
  venueAddress: 300,
  streamUrl: 500,
};

/** What each field is called on the operator's screen and in its own errors. */
export const WEDDING_FACT_LABELS: Readonly<Record<WeddingFactField, string>> = {
  coupleNames: "Nombres de la pareja",
  venueName: "Lugar",
  venueAddress: "Dirección",
  streamUrl: "Enlace de Google Meet",
};

/** One message per broken field. A valid field is absent, not empty. */
export type WeddingFactErrors = Partial<Record<WeddingFactField, string>>;

export type WeddingFactsParse =
  | { readonly ok: true; readonly facts: WeddingFacts }
  | { readonly ok: false; readonly errors: WeddingFactErrors };

/**
 * C0 and C1 control characters, which include `\n`, `\r` and `\t`.
 *
 * Every one of these values is rendered as a single line: a `dd` in the
 * invitation body, one line of card copy, and — for the couple's names — a
 * segment of a `wa.me` query string, where a newline is percent-encoded and
 * arrives in the recipient's draft as a literal break. A bell character is
 * invisible in a text input and in a database row and still travels to the card
 * that cannot be corrected.
 *
 * Refused rather than collapsed to a space: a silent collapse stores something
 * the operator did not type, and a refusal says which field to fix.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * The character count Postgres will apply.
 *
 * `String.length` counts UTF-16 code units, so one emoji costs two. Postgres
 * `char_length` counts characters. Measuring with `.length` would accept a value
 * of 200 characters carrying astral symbols and let the database refuse it, and
 * the operator would read a constraint name instead of a sentence.
 */
function characterCount(value: string): number {
  return [...value].length;
}

/**
 * Validates one submitted field, returning its error or `null`.
 *
 * The order of the checks is the order the operator can act on: a field that is
 * absent entirely is reported as missing rather than as too short, and a field
 * carrying a line break is reported as such rather than being trimmed into
 * something that passes.
 */
/**
 * Is this an address a guest's browser can actually open?
 *
 * THE ONE FACT ON THIS FORM THAT IS NOT PROSE. Every other value is something a
 * human reads — a name, a date, a street — and a typo in it looks like a typo.
 * This one is followed by a browser, so a mistake looks like a button that does
 * nothing, discovered on the morning of the wedding.
 *
 * Zoom needed no such check: an operator typed a meeting id and a passcode and
 * the guest transcribed them into an app that said so when they were wrong. A
 * Meet link is pressed, not read, so this is the only place the mistake can
 * surface.
 *
 * `https` ONLY, and that is not pedantry: the page doing the linking is served
 * over https, a plain-http destination is blocked as mixed content by some
 * browsers, and it is a downgrade nobody chose. Rejecting every other scheme
 * also rules out `javascript:` — which is the one that turns an operator's
 * paste into script running on a guest's page.
 *
 * THE HOST IS DELIBERATELY NOT PINNED. Requiring `meet.google.com` would catch
 * a wrong-provider paste, and would make the next change of provider a
 * migration rather than an edit. This checks what is about correctness, not
 * what is about today's choice.
 */
function isJoinableAddress(value: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    // Not absolute, or not a URL at all — "meet.google.com/abc" among them,
    // which is exactly what somebody pastes from an address bar.
    return false;
  }

  return parsed.protocol === "https:";
}

function fieldError(field: WeddingFactField, raw: unknown): string | null {
  const label = WEDDING_FACT_LABELS[field];

  // `FormData.get` yields a `File` for a file input and `null` for an absent
  // one. Coercing either would store "[object File]" or "null" as the venue.
  if (typeof raw !== "string") {
    return `Falta ${label}.`;
  }

  const value = raw.trim();

  if (value === "") {
    // Blank, not merely short: an empty venue renders as an invitation that
    // looks finished and names no place, which reads to a guest as a venue
    // nobody has been told yet rather than as something broken.
    return `${label} no puede quedar vacío.`;
  }

  if (CONTROL_CHARACTERS.test(value)) {
    return `${label} debe ir en una sola línea, sin saltos de línea.`;
  }

  const max = WEDDING_FACT_MAX_LENGTHS[field];

  if (characterCount(value) > max) {
    return `${label} no puede pasar de ${max} caracteres.`;
  }

  if (field === "streamUrl" && !isJoinableAddress(value)) {
    return `${label} debe ser un enlace que empiece por https://`;
  }

  return null;
}

/**
 * Validates a whole submission.
 *
 * EVERY BROKEN FIELD AT ONCE, NOT THE FIRST. Four fields and one error per
 * round trip, on venue Wi-Fi, is how a form stops getting filled in — and these
 * are the values without which no invitation can be sent at all.
 *
 * On success the returned values are TRIMMED. A pasted value arrives with a
 * trailing space more often than not, and a trailing space in the couple's names
 * is a trailing space on a card that can no longer be changed.
 */
export function parseWeddingFacts(
  submission: Readonly<Record<string, unknown>>,
): WeddingFactsParse {
  const errors: Record<string, string> = {};
  const facts: Record<string, string> = {};

  for (const field of WEDDING_FACT_FIELDS) {
    const raw = submission[field];
    const error = fieldError(field, raw);

    if (error === null) {
      facts[field] = (raw as string).trim();
    } else {
      errors[field] = error;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as WeddingFactErrors };
  }

  return { ok: true, facts: facts as WeddingFacts };
}
