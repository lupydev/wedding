import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { operatorSessionSecret, unlockCookieSecret } from "./env";

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

/**
 * ── The per-device WhatsApp declaration cookie ──────────────────────────────
 *
 * A second cookie on a different surface, answering a different question: which
 * WhatsApp account the operator says is installed on THIS handset. It exists
 * because `wa.me` addresses the recipient only — there is no sender parameter —
 * so which account sends is a physical property of the phone, not something the
 * application can route.
 *
 * It authorizes NOTHING. Console access, guest-phone visibility and
 * `actor_sender_id` all come from the verified session; this value gates one
 * human-facing interstitial (see `lib/domain/device-declaration.ts`). It is
 * still signed, for the ordinary reason any browser-held value is: an unsigned
 * one is a value its holder chooses, and a device that could silently claim to
 * be the other operator would remove the one warning the couple gets.
 *
 * `httpOnly` because no script needs it, `path=/console` because no guest route
 * does, and a year because a phone stays the same phone.
 */

/** Cookie name. Per device, never per session. */
export const DEVICE_SENDER_COOKIE_NAME = "device_sender";

/** One year: this is a property of the handset, not of a sign-in. */
export const DEVICE_SENDER_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Domain separation for the HMAC.
 *
 * This cookie and the forwarded operator-identity header are keyed with the SAME
 * secret (`OPERATOR_SESSION_SECRET`), because both are console-session plumbing
 * and a second secret is a second thing to rotate and forget. Signing distinct
 * message spaces is what keeps one from being replayable as the other: a valid
 * identity header presented as a device cookie fails the signature check here,
 * because the string that was signed there never carried this prefix.
 */
const DEVICE_SENDER_SIGNING_PREFIX = "device_sender.v1:";

interface DeviceSenderPayload {
  readonly senderId: string;
}

function signDeviceSender(encodedPayload: string): string {
  return createHmac("sha256", operatorSessionSecret())
    .update(`${DEVICE_SENDER_SIGNING_PREFIX}${encodedPayload}`)
    .digest("hex");
}

/** Mints the declaration this device will carry. */
export function signDeviceSenderCookie(senderId: string): string {
  const payload: DeviceSenderPayload = { senderId };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${encoded}.${signDeviceSender(encoded)}`;
}

/**
 * The sender this device declared, or `null`.
 *
 * `null` for every failure AND for no cookie at all, which is deliberate: the
 * caller does not need to tell a forged declaration from an absent one, because
 * both mean "this device has not answered the question". It DOES need to tell
 * either of those from a declaration naming the other operator, and it can —
 * that one returns a sender id. `classifyDeviceDeclaration` makes the
 * distinction; see its "fail to the picker, never to a default" rule.
 *
 * Never throws. The value is fully browser-controlled.
 */
export function readDeviceSenderCookie(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const parts = value.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encoded, signature] = parts;

  if (encoded === "" || signature === "") {
    return null;
  }

  if (!signaturesMatch(signDeviceSender(encoded), signature)) {
    return null;
  }

  let payload: DeviceSenderPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as DeviceSenderPayload;
  } catch {
    return null;
  }

  if (typeof payload?.senderId !== "string" || payload.senderId.trim() === "") {
    return null;
  }

  return payload.senderId;
}

/** Exactly the attributes `cookies().set` needs for the declaration. */
export interface DeviceSenderCookieOptions {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: string;
  readonly maxAge: number;
}

/** Cookie attributes for the declaration. */
export function deviceSenderCookieOptions(): DeviceSenderCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` rather than `strict`: the operator arrives at the console from a
    // magic link in their mail client, which is a cross-site top-level
    // navigation. `strict` would withhold the declaration on exactly that
    // navigation and re-ask on every sign-in.
    sameSite: "lax",
    path: "/console",
    maxAge: DEVICE_SENDER_COOKIE_MAX_AGE_SECONDS,
  };
}
