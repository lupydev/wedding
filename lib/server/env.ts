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
  return requireAbsoluteOrigin("NEXT_PUBLIC_SITE_ORIGIN");
}

/**
 * The origin the operator console is reachable at.
 *
 * Usually the same as the public site origin, and it defaults to it. It is
 * separable because the console is not always served at the public invitation
 * origin — a preview deployment, a tunnel, or the end-to-end server on a free
 * port all serve it somewhere else — and the server has to be able to REACH it:
 * `resolveAdvertisedCardPath` fetches a console-rendered page over HTTP to read
 * the `og:image` it advertises, and the public origin may not resolve from
 * inside the deployment at all. Deriving it from the request's own `Origin`
 * header was rejected: that header is visitor-controlled.
 */
export function consoleOrigin(): string {
  if (process.env.CONSOLE_ORIGIN?.trim()) {
    return requireAbsoluteOrigin("CONSOLE_ORIGIN");
  }

  return siteOrigin();
}

function requireAbsoluteOrigin(name: string): string {
  const value = requireEnv(name);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `${name} must be an absolute origin, for example https://example.com. Received: ${value}`,
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `${name} must be an absolute http(s) origin. Received: ${value}`,
    );
  }

  return value.replace(/\/+$/, "");
}

/**
 * The Supabase publishable key, for the client that acts AS the operator.
 *
 * Deliberately not the secret key: that one bypasses RLS, and the auth client
 * built from this value is handed to the middleware, which runs before any
 * authorization decision has been made. The publishable key is the key a
 * browser would hold anyway, which is exactly the privilege level an
 * unauthenticated session-refresh pass should have.
 */
export function supabasePublishableKey(): string {
  const value = requireEnv("SUPABASE_PUBLISHABLE_KEY");

  if (value.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY holds the secret key. The operator auth client requires the publishable key.",
    );
  }

  return value;
}

/**
 * HMAC key for the operator identity the middleware forwards to the route that
 * renders.
 *
 * A forwarded header is only trustworthy while every reader sits behind the
 * middleware that writes it, and the console matcher is deliberately narrow.
 * Signing the value removes that coupling, and this is the key that does it.
 */
export function operatorSessionSecret(): string {
  return requireSecret("OPERATOR_SESSION_SECRET");
}
