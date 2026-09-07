import {
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Pure phone helpers. No React, no Next.js, no storage vendor, no Node built-ins.
 *
 * `libphonenumber-js` is imported directly on purpose (design decision D1): it is
 * a deterministic, I/O-free computation dependency, not a vendor SDK. Hand-rolled
 * E.164 normalization is banned — this is the highest-risk pure function in the
 * product, and a guest who fails to match cannot open their own invitation.
 */

/** Number of trailing digits used as the gate key and as `phone_last8`. */
export const PHONE_LAST8_LENGTH = 8;

export type NormalizePhoneFailureReason = "empty" | "unparseable" | "invalid";

export type NormalizePhoneResult =
  | { readonly ok: true; readonly e164: string; readonly last8: string }
  | { readonly ok: false; readonly reason: NormalizePhoneFailureReason };

/** A guest as far as the gate is concerned: only the derived last-8 value. */
export interface GuestPhoneRef {
  readonly phone_last8: string | null;
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalizes an arbitrary phone input into E.164 plus its last 8 digits.
 *
 * Never throws on guest DATA: every input failure is reported through the
 * returned discriminated union so callers cannot accidentally crash a request
 * on bad guest data. A misconfigured `defaultCountry` is a different class of
 * problem — a deployment fault — and `resolveDefaultCountry` throws on it,
 * because casting an unsupported value would mis-normalize every nationally
 * formatted phone and those guests would never match at the gate.
 */
export function normalizePhone(
  input: string,
  defaultCountry: string,
): NormalizePhoneResult {
  if (input.trim() === "") {
    return { ok: false, reason: "empty" };
  }

  const country = resolveDefaultCountry(defaultCountry);
  const parsed = parsePhoneNumberFromString(input, country);

  if (!parsed) {
    return { ok: false, reason: "unparseable" };
  }

  if (!parsed.isValid()) {
    return { ok: false, reason: "invalid" };
  }

  const e164 = parsed.number;

  return { ok: true, e164, last8: e164.slice(-PHONE_LAST8_LENGTH) };
}

/**
 * Validates the configured default country and returns it as an ISO 3166-1
 * alpha-2 code.
 *
 * `DEFAULT_PHONE_COUNTRY` is an environment variable whose production value is
 * still undecided, so no value is hard-coded here. The domain stays pure and
 * never reads the environment itself: the server-side accessor passes the raw
 * value in. An unset or unsupported value throws rather than defaulting,
 * because a silently wrong default country mis-normalizes every phone that was
 * entered in national format — and those guests would simply never match.
 */
export function resolveDefaultCountry(raw: string | undefined): CountryCode {
  const value = raw?.trim() ?? "";

  if (value === "") {
    throw new Error(
      "DEFAULT_PHONE_COUNTRY is not set. Set it to an ISO 3166-1 alpha-2 country code (for example MX, AR or US).",
    );
  }

  const candidate = value.toUpperCase();

  if (!isSupportedCountry(candidate)) {
    throw new Error(
      `DEFAULT_PHONE_COUNTRY is not a supported ISO 3166-1 alpha-2 country code: ${candidate}`,
    );
  }

  return candidate;
}

/**
 * Normalizes a phone for STORAGE and throws when it cannot be normalized.
 *
 * Storage is the strict side of the boundary: an unusable `phone_e164` silently
 * locks a guest out of their own invitation, so the import must fail loudly at
 * the point the bad value is introduced rather than at the gate weeks later.
 *
 * The raw input is deliberately kept out of the error message: guest phone
 * numbers are personal data and errors reach logs.
 */
export function normalizeForStorage(
  input: string,
  defaultCountry: string,
): string {
  const result = normalizePhone(input, defaultCountry);

  if (!result.ok) {
    throw new Error(`Phone cannot be normalized (reason: ${result.reason})`);
  }

  return result.e164;
}

/**
 * Derives the gate key from whatever the guest typed.
 *
 * Deliberately LENIENT (design decision D3): the gate compares only the final
 * eight digits, so it accepts any punctuation, country code, or none at all. A
 * guest recalling their own number under WhatsApp's UI should not have to guess
 * a format. Returns `null` when there are not enough digits to compare, which
 * is what keeps a blank submission from matching a phone-less guest.
 */
export function deriveGateKey(input: string): string | null {
  const digits = digitsOf(input);

  if (digits.length < PHONE_LAST8_LENGTH) {
    return null;
  }

  return digits.slice(-PHONE_LAST8_LENGTH);
}

/**
 * Does the submitted phone match ANY guest on this invitation?
 *
 * Any guest, not only the primary contact: an invitation addressed to a couple
 * is opened by whichever of them has the link in hand. Guests with no stored
 * phone (`phone_last8 === null`) can never match, which mirrors the DB's
 * `nullif(...)` on the generated column.
 */
export function matchesInvitation(
  input: string,
  guests: readonly GuestPhoneRef[],
): boolean {
  const key = deriveGateKey(input);

  if (key === null) {
    return false;
  }

  return guests.some((guest) => guest.phone_last8 === key);
}
