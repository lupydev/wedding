import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { unlockCookieSecret } from "./env";

/**
 * The signed unlock cookie.
 *
 * This is the whole session model for the guest surface: there is no login, no
 * account and no server-side session table. A guest proves once that they hold
 * the phone number on the invitation, and this cookie remembers it.
 *
 * Value shape: `base64url(payload) + '.' + hex(HMAC-SHA256(secret, payload))`
 * with `payload = { invitationId, exp }`. The payload is readable — it is not
 * meant to be secret — but it is not forgeable, and the server checks BOTH the
 * signature and that the invitation it names is the one resolved from the slug
 * currently being requested.
 */

/** Cookie name. Short and boring on purpose; it carries no guest data. */
export const UNLOCK_COOKIE_NAME = "inv_unlock";

/**
 * Cookie lifetime: 180 days.
 *
 * The event this gates is months away, and the guest who unlocks today is the
 * same guest who comes back the week of the wedding to re-read the address. A
 * short lifetime does not add security here — the capability being protected is
 * the slug, which the guest still holds either way — it only re-gates people
 * who already proved they own the number. A fresh cookie is minted on every
 * successful unlock, so a guest who ever re-enters their number restarts the
 * clock; a guest who never needs to will still be inside 180 days.
 */
export const UNLOCK_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

interface UnlockPayload {
  readonly invitationId: string;
  /** Expiry in epoch milliseconds. Enforced by the SERVER, not the browser. */
  readonly exp: number;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", unlockCookieSecret())
    .update(encodedPayload)
    .digest("hex");
}

/** Constant-time comparison; a byte-by-byte one leaks the signature. */
function signaturesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");

  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, receivedBytes);
}

/** Mints the cookie value for one invitation, valid from `now`. */
export function signUnlockCookie(invitationId: string, now: number): string {
  const payload: UnlockPayload = {
    invitationId,
    exp: now + UNLOCK_COOKIE_MAX_AGE_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${encoded}.${sign(encoded)}`;
}

/**
 * Is this cookie a valid unlock for THIS invitation, right now?
 *
 * Returns `false` for every failure — forged, expired, malformed, or minted for
 * a different household — and never throws. A visitor fully controls this
 * value, so an exception here would be a denial-of-service on the route.
 *
 * The `invitationId` cross-check is what stops a person who legitimately holds
 * two links from unlocking the second household with the first one's cookie.
 * The path scope narrows the browser's behaviour; this decides the server's.
 */
export function verifyUnlockCookie(
  value: string,
  invitationId: string,
  now: number,
): boolean {
  const parts = value.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [encoded, signature] = parts;

  if (encoded === "" || signature === "") {
    return false;
  }

  if (!signaturesMatch(sign(encoded), signature)) {
    return false;
  }

  let payload: UnlockPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as UnlockPayload;
  } catch {
    return false;
  }

  if (typeof payload?.invitationId !== "string") {
    return false;
  }

  if (typeof payload.exp !== "number" || payload.exp <= now) {
    return false;
  }

  return payload.invitationId === invitationId;
}

/** Exactly the attributes `cookies().set` needs, without importing Next here. */
export interface UnlockCookieOptions {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: string;
  readonly maxAge: number;
}

/**
 * Cookie attributes for one slug.
 *
 * `sameSite: 'lax'` is deliberate and is NOT a weaker default: the guest
 * arrives by a cross-site top-level navigation from WhatsApp, and `strict`
 * withholds the cookie on exactly that navigation — the guest would be re-gated
 * every single time they reopen the link from the chat, which is the failure
 * this cookie exists to prevent.
 *
 * The path binds the cookie to the slug it was unlocked from, so rotating a
 * slug makes the old cookie unreachable with no revocation list to maintain.
 */
export function unlockCookieOptions(slug: string): UnlockCookieOptions {
  return {
    httpOnly: true,
    // Plain HTTP exists only on a developer's machine. Production is HTTPS, and
    // an unlock cookie travelling in the clear there would be capturable.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/i/${slug}`,
    maxAge: UNLOCK_COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * Is this cookie a valid unlock for this invitation, as of now?
 *
 * The clock lives HERE rather than at the call site: `verifyUnlockCookie` takes
 * `now` as an argument so it stays deterministically testable (design decision
 * D2), and a Server Component must not read the clock during render. This is
 * the adapter that supplies it.
 */
export function unlockCookieUnlocks(
  value: string,
  invitationId: string,
): boolean {
  return verifyUnlockCookie(value, invitationId, Date.now());
}
