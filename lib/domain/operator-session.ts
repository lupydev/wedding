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

/** Magic-link entry point. The only console page an anonymous visitor may see. */
export const CONSOLE_LOGIN_PATH = "/console/login";

/**
 * Everything under here creates or destroys a session and must never be
 * redirected away from: the magic-link callback is the route that turns an
 * anonymous visitor into an authenticated one, so bouncing anonymous requests
 * off it would make signing in impossible.
 */
export const CONSOLE_AUTH_PATH_PREFIX = "/console/auth";

/**
 * Request header carrying the operator identity from the proxy to the route
 * that renders.
 *
 * REQUEST, never response. The same header on a response would ship the
 * operator's id and address to the browser for no reason at all.
 */
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
