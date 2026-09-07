import "server-only";

import type { CountryCode } from "libphonenumber-js";

import { resolveDefaultCountry } from "@/lib/domain/phone";

/**
 * Typed accessors for every environment variable this application reads.
 *
 * This module is the single boundary where a raw environment string is turned
 * into a validated value. Nothing downstream ever handles a raw string: call
 * sites receive a `CountryCode`, a checked secret, or a normalized origin, so a
 * misconfiguration surfaces here — loudly and once — rather than as a guest who
 * silently cannot open their own invitation.
 */

/**
 * Minimum length for an HMAC key or a hashing pepper.
 *
 * 32 characters is not arbitrary: `GATE_IP_PEPPER` protects a value drawn from
 * a space small enough to enumerate exhaustively (an IPv4 address), so a short
 * pepper is equivalent to no pepper at all.
 */
const MIN_SECRET_LENGTH = 32;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return value;
}

function requireSecret(name: string): string {
  const value = requireEnv(name);

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters long.`,
    );
  }

  return value;
}

/**
 * The default country used to normalize nationally formatted guest phones.
 *
 * Resolved here, ONCE, through the domain's own validator. Call sites take the
 * returned `CountryCode`, never `process.env.DEFAULT_PHONE_COUNTRY`, because a
 * silently wrong default country mis-normalizes every phone entered in national
 * format and those guests would never match at the gate.
 */
export function requiredDefaultPhoneCountry(): CountryCode {
  return resolveDefaultCountry(process.env.DEFAULT_PHONE_COUNTRY);
}

/** HMAC key for the signed `inv_unlock` cookie. */
export function unlockCookieSecret(): string {
  return requireSecret("UNLOCK_COOKIE_SECRET");
}

/** Pepper for `ip_hash = HMAC-SHA256(pepper, ip)` in `gate_attempts`. */
export function gateIpPepper(): string {
  return requireSecret("GATE_IP_PEPPER");
}

/**
 * The deployed origin, without a trailing slash.
 *
 * Must be absolute: it becomes `metadataBase`, and a relative value leaves the
 * file-convention `og:image` relative too, which WhatsApp cannot fetch.
 */
export function siteOrigin(): string {
  const value = requireEnv("NEXT_PUBLIC_SITE_ORIGIN");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SITE_ORIGIN must be an absolute origin, for example https://example.com. Received: ${value}`,
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `NEXT_PUBLIC_SITE_ORIGIN must be an absolute http(s) origin. Received: ${value}`,
    );
  }

  return value.replace(/\/+$/, "");
}
