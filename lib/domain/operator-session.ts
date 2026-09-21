/**
 * The console session, as pure decisions.
 *
 * Two things live here, and both are here for the same reason: they must run
 * unchanged in the Next.js proxy (an edge-style runtime with no Node built-ins)
 * AND in ordinary Node server code, and they must be testable without a
 * request, a response, or a Supabase project.
 *
 *  1. `resolveConsoleRedirect` — where a request to a console path should go,
 *     given only the path and whether anyone is signed in. Keeping this a pure
 *     function is what makes the redirect branches of the proxy testable at
 *     all; a redirect decision buried inside an async handler is a decision
 *     nobody ever writes a test for.
 *  2. The forwarded operator identity — signed, because a header is not
 *     evidence. See `signOperatorIdentity` below.
 *
 * No Node imports on purpose (`node:crypto` is unavailable in the proxy
 * runtime): the HMAC is Web Crypto, which both runtimes provide as a global.
 */

/** The console landing page. */
export const CONSOLE_ROOT_PATH = "/console";

/** Sign-in form. The only console page an anonymous visitor may see. */
export const CONSOLE_LOGIN_PATH = "/console/login";

/**
 * Everything under here destroys a session and must never be redirected away
 * from. `/console/auth/sign-out` is the only exit from the state where somebody
 * holds a valid Supabase session that is not an operator: a redirect would
 * leave the console and the login page trading that request forever.
 *
 * A session is CREATED by the Server Action behind `/console/login`, which
 * needs no exemption because the login page already has one.
 */
export const CONSOLE_AUTH_PATH_PREFIX = "/console/auth";

/**
 * Request header carrying the operator identity from the proxy to the route
 * that renders.
 *
 * REQUEST, never response. The same header on a response would ship the
 * operator's id and address to the browser for no reason at all.
 */
/**
 * The operator's body-preview route for one invitation.
 *
 * A SEPARATE admin-only route, deliberately, and the separation is the whole
 * security decision. Three alternatives were considered for previewing the
 * unlocked invitation body and all three were rejected:
 *
 *  - `?preview=1` on the public route — a guessable, permanently open hole
 *    appended to a URL every guest already holds;
 *  - a signed short-lived preview token — still a second unlock path on the
 *    public route, and a token that unlocks a real guest's invitation is the
 *    same capability as the phone gate with no rate limit, leaking through
 *    browser history and `Referer`;
 *  - an admin-session bypass inside the public route — no new secret, but it
 *    makes the public route's authorization depend on two independent
 *    identities, which is exactly where authorization bugs live.
 *
 * This adds no new authorization axis at all: it is an ordinary console page
 * behind the same `requireOperator()` as every other one, and the public gated
 * route is never taught the word "preview". Only the UNLOCKED body needs it —
 * the gate screen itself needs no preview mechanism, because an operator can
 * open `/i/{slug}` and read it exactly as a guest does.
 */
export function consolePreviewPath(invitationId: string): string {
  return `${CONSOLE_ROOT_PATH}/preview/${invitationId}`;
}

/**
 * Where an invitation is edited — members, names, and who receives the message.
 *
 * Built here rather than interpolated at each call site for the same reason
 * `consolePreviewPath` is: the guest list, the dispatch screen and the form all
 * link to it, and a route that moves should break the build rather than only the
 * links somebody remembered to grep for.
 */
export function consoleInvitationEditPath(invitationId: string): string {
  return `${CONSOLE_ROOT_PATH}/invitations/${invitationId}/edit`;
}

/** Where an invitation is created by hand, rather than by the importer. */
export const CONSOLE_NEW_INVITATION_PATH = `${CONSOLE_ROOT_PATH}/invitations/new`;

/**
 * The directory of people, which is not the list of invitations.
 *
 * `/console` lists HOUSEHOLDS; this lists PEOPLE, including the ones who belong
 * to no household yet — a state that could not exist before migration 0015.
 */
export const CONSOLE_GUESTS_PATH = `${CONSOLE_ROOT_PATH}/guests`;

/**
 * Console routes that answer machines rather than people.
 *
 * Everything under here is a route handler, and every one of them authenticates
 * itself and answers with a STATUS. The proxy must not redirect them, because a
 * redirect to a login form is meaningless to a machine caller — worse than
 * meaningless: `navigator.sendBeacon` follows it, receives the login page with
 * a 200, and reports success while nothing was recorded at all. The beacon
 * route's 401 was written for exactly that reason and was unreachable until
 * this exemption existed.
 *
 * The obligation this creates is explicit: a route handler added under
 * `/console/api` gets NO redirect from the proxy and MUST establish the
 * operator itself, the way `app/console/api/dispatch-event/route.ts` does with
 * `currentOperator()`.
 */
export const CONSOLE_API_PATH_PREFIX = "/console/api";

export const OPERATOR_IDENTITY_HEADER = "x-operator-identity";

/** Who is operating, as established by Supabase Auth. Not yet authorized. */
export interface OperatorIdentity {
  readonly authUserId: string;
  readonly email: string;
}

/** Is this path served by the console? */
export function isConsolePath(pathname: string): boolean {
  return (
    pathname === CONSOLE_ROOT_PATH ||
    pathname.startsWith(`${CONSOLE_ROOT_PATH}/`)
  );
}

/**
 * Where should this console request go? `null` means "carry on".
 *
 * Deliberately ignorant of authorization: it knows whether SOMEONE is signed
 * in, not whether that someone is an operator. The allowlist lives in the
 * database and the proxy holds no privileged key, so the allowlist check
 * belongs to `requireOperator()` on the server. Splitting it this way keeps one
 * source of truth (design decision D7) instead of a second, weaker copy at the
 * edge that could disagree with it.
 */
export function resolveConsoleRedirect(
  pathname: string,
  isAuthenticated: boolean,
): string | null {
  if (!isConsolePath(pathname)) {
    return null;
  }

  if (
    pathname === CONSOLE_AUTH_PATH_PREFIX ||
    pathname.startsWith(`${CONSOLE_AUTH_PATH_PREFIX}/`)
  ) {
    return null;
  }

  // Machine callers, never redirected. The `/` in the prefix test is
  // load-bearing: a bare `startsWith` would also exempt a page called
  // `/console/apiary` and leave it with no login bounce at all.
  if (
    pathname === CONSOLE_API_PATH_PREFIX ||
    pathname.startsWith(`${CONSOLE_API_PATH_PREFIX}/`)
  ) {
    return null;
  }

  if (pathname === CONSOLE_LOGIN_PATH) {
    return isAuthenticated ? CONSOLE_ROOT_PATH : null;
  }

  return isAuthenticated ? null : CONSOLE_LOGIN_PATH;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return toBase64Url(new Uint8Array(signature));
}

/** Length-independent, byte-by-byte-independent comparison. */
function signaturesMatch(expected: string, received: string): boolean {
  if (expected.length !== received.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }

  return difference === 0;
}

/**
 * Signs the identity the proxy forwards to the rendering route.
 *
 * The signature is the whole point. A plain `x-operator-user-id` header is only
 * trustworthy while EVERY route that reads it sits behind the proxy that sets
 * it — and the proxy matcher is deliberately narrow (`/console/*`), so a server
 * action reached from anywhere else would be reading a header the visitor wrote
 * themselves. Signing removes that coupling: the header is evidence on its own
 * terms, or it is discarded.
 */
export async function signOperatorIdentity(
  secret: string,
  identity: OperatorIdentity,
): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        authUserId: identity.authUserId,
        email: identity.email,
      }),
    ),
  );

  return `${payload}.${await hmac(secret, payload)}`;
}

/**
 * Reads a forwarded identity back, or `null`.
 *
 * Never throws: the value can be fully attacker-controlled, so an exception
 * here would be a denial of service on every console route.
 */
export async function verifyOperatorIdentity(
  secret: string,
  value: string,
): Promise<OperatorIdentity | null> {
  const parts = value.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;

  if (payload === "" || signature === "") {
    return null;
  }

  if (!signaturesMatch(await hmac(secret, payload), signature)) {
    return null;
  }

  const decoded = fromBase64Url(payload);

  if (decoded === null) {
    return null;
  }

  let parsed: Partial<OperatorIdentity>;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(decoded),
    ) as Partial<OperatorIdentity>;
  } catch {
    return null;
  }

  if (
    typeof parsed?.authUserId !== "string" ||
    typeof parsed.email !== "string" ||
    parsed.authUserId === "" ||
    parsed.email === ""
  ) {
    return null;
  }

  return { authUserId: parsed.authUserId, email: parsed.email };
}

/**
 * Puts the forwarded identity on request headers, removing whatever was there.
 *
 * The unconditional delete is not defensive tidying — it is the guarantee. A
 * visitor may send this header; after this call, the only value present is one
 * we produced.
 */
export async function applyOperatorIdentityHeader(
  headers: Headers,
  secret: string,
  identity: OperatorIdentity | null,
): Promise<void> {
  headers.delete(OPERATOR_IDENTITY_HEADER);

  if (identity === null) {
    return;
  }

  headers.set(
    OPERATOR_IDENTITY_HEADER,
    await signOperatorIdentity(secret, identity),
  );
}

/** The forwarded identity, if the header carries a valid signature. */
export async function readOperatorIdentityHeader(
  headers: Headers,
  secret: string,
): Promise<OperatorIdentity | null> {
  const value = headers.get(OPERATOR_IDENTITY_HEADER);

  if (value === null) {
    return null;
  }

  return verifyOperatorIdentity(secret, value);
}

/**
 * The canonical form of an operator address.
 *
 * `senders.allowlisted_email` carries a `= lower(allowlisted_email)` CHECK, so
 * a lookup that skipped this would silently miss on `Ana@Example.test` and the
 * operator would be told, accurately and uselessly, that nothing happened.
 */
export function normalizeAllowlistEmail(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim().toLowerCase() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return null;
  }

  return value;
}
