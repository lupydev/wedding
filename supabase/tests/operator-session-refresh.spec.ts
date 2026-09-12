import { randomUUID } from "node:crypto";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  OPERATOR_IDENTITY_HEADER,
  verifyOperatorIdentity,
} from "@/lib/domain/operator-session";
import { updateOperatorSession } from "@/lib/proxy/operator-session";

import { resolveLocalKeys } from "./helpers/local-keys";

/**
 * The hourly-logout regression, as an executable test.
 *
 * A reference project with this exact stack logged its operators out every
 * sixty minutes — the Supabase access-token lifetime, which is the whole tell.
 * Its middleware built a `NextResponse` in a closure; `getUser()` renewed the
 * expiring access token, which ROTATES the refresh token and burns the old one
 * server-side; and the admin branch then returned a freshly constructed
 * `NextResponse`, discarding the one carrying the new pair. The browser kept a
 * refresh token that no longer existed anywhere, and the next request bounced
 * to the login page.
 *
 * The rule that prevents it: every return path out of the proxy carries
 * the cookies Supabase wrote — redirects included. The redirect is the one
 * people forget, and it is the one asserted hardest below.
 *
 * A test that only checks "a signed-in operator can see the page" cannot detect
 * any of this, because it passes for the entire first hour.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const OPERATOR_SESSION_SECRET = "operator-session-secret-for-tests-only-32+";

/** Every `sb-*-auth-token` cookie, chunked or not. */
const AUTH_COOKIE_PATTERN = /^sb-.*-auth-token(\.\d+)?$/;

const STORED_SESSION_PREFIX = "base64-";

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  [key: string]: unknown;
}

let admin: SupabaseClient;
let anonKey: string;
let authUserId: string;
const password = randomUUID();
const email = `session-refresh-${randomUUID()}@example.test`;

function authCookieNames(jar: ReadonlyMap<string, string>): string[] {
  return [...jar.keys()]
    .filter((name) => AUTH_COOKIE_PATTERN.test(name))
    .sort();
}

/** Reassembles the stored session from however many chunks it was split into. */
function readStoredSession(jar: ReadonlyMap<string, string>): StoredSession {
  const combined = authCookieNames(jar)
    .map((name) => jar.get(name) ?? "")
    .join("");

  expect(combined.startsWith(STORED_SESSION_PREFIX)).toBe(true);

  return JSON.parse(
    Buffer.from(
      combined.slice(STORED_SESSION_PREFIX.length),
      "base64url",
    ).toString("utf8"),
  ) as StoredSession;
}

function encodeStoredSession(session: StoredSession): string {
  return (
    STORED_SESSION_PREFIX +
    Buffer.from(JSON.stringify(session), "utf8").toString("base64url")
  );
}

/** Signs in for real and returns the cookie jar a browser would be holding. */
async function signInFreshly(): Promise<Map<string, string>> {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, anonKey, {
    cookies: {
      getAll: () =>
        [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) {
          jar.set(cookie.name, cookie.value);
        }
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  expect(authCookieNames(jar).length).toBeGreaterThan(0);

  return jar;
}

/**
 * The browser state that reproduces the bug: an access token that has already
 * expired, alongside a refresh token that is still live.
 *
 * One cookie rather than the chunks a browser would hold, because the SDK reads
 * both forms and the chunk boundary is not what is under test here.
 */
async function staleBrowserCookies(): Promise<{
  header: string;
  cookieName: string;
  refreshToken: string;
}> {
  const jar = await signInFreshly();
  const session = readStoredSession(jar);
  const expiredAt = Math.floor(Date.now() / 1000) - 60;
  const cookieName = authCookieNames(jar)[0].replace(/\.\d+$/, "");

  const stale: StoredSession = {
    ...session,
    expires_at: expiredAt,
    expires_in: -60,
  };

  return {
    header: `${cookieName}=${encodeStoredSession(stale)}`,
    cookieName,
    refreshToken: session.refresh_token,
  };
}

function consoleRequest(pathname: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  return new NextRequest(new URL(pathname, "http://localhost:3100"), {
    headers,
  });
}

/** The session `Set-Cookie` headers this response puts on the wire. */
function sessionSetCookies(response: Response, cookieName: string): string[] {
  return response.headers
    .getSetCookie()
    .filter((value) => value.startsWith(`${cookieName}`));
}

/** The refresh token those `Set-Cookie` headers actually deliver. */
function refreshTokenFrom(setCookies: string[]): string {
  const jar = new Map<string, string>();

  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const separator = pair.indexOf("=");
    jar.set(
      pair.slice(0, separator).trim(),
      decodeURIComponent(pair.slice(separator + 1).trim()),
    );
  }

  return readStoredSession(jar).refresh_token;
}

beforeAll(async () => {
  const keys = resolveLocalKeys();
  anonKey = keys.anonKey;

  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;
  process.env.OPERATOR_SESSION_SECRET = OPERATOR_SESSION_SECRET;

  admin = createClient(SUPABASE_URL, keys.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  expect(error).toBeNull();
  authUserId = data.user?.id ?? "";
  expect(authUserId).not.toBe("");
});

afterAll(async () => {
  if (authUserId) {
    await admin.auth.admin.deleteUser(authUserId);
  }
});

describe("updateOperatorSession — session survival", () => {
  it("writes the rotated session onto a pass-through response", async () => {
    const stale = await staleBrowserCookies();

    const response = await updateOperatorSession(
      consoleRequest("/console", stale.header),
    );

    const written = sessionSetCookies(response, stale.cookieName);
    expect(written.length).toBeGreaterThan(0);
    expect(refreshTokenFrom(written)).not.toBe(stale.refreshToken);
  });

  it("writes the rotated session onto a REDIRECT response too", async () => {
    // This is the assertion the reference project did not have. Their redirect
    // branch returned a response built from scratch, so the count here was
    // zero, the browser kept a burned refresh token, and the operator was
    // signed out exactly one access-token lifetime later.
    const stale = await staleBrowserCookies();

    const response = await updateOperatorSession(
      consoleRequest("/console/login", stale.header),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/console",
    );

    const written = sessionSetCookies(response, stale.cookieName);
    expect(written.length).toBeGreaterThan(0);
    expect(refreshTokenFrom(written)).not.toBe(stale.refreshToken);
  });

  it("writes the same number of session cookies on both paths", async () => {
    // Equality, not a magic number: what matters is that the redirect path
    // delivers exactly what the pass-through path delivers, whatever the SDK's
    // chunking happens to produce.
    const first = await staleBrowserCookies();
    const passThrough = await updateOperatorSession(
      consoleRequest("/console", first.header),
    );

    const second = await staleBrowserCookies();
    const redirected = await updateOperatorSession(
      consoleRequest("/console/login", second.header),
    );

    expect(sessionSetCookies(redirected, second.cookieName).length).toBe(
      sessionSetCookies(passThrough, first.cookieName).length,
    );
  });

  it("delivers a refresh token the server still accepts", async () => {
    // Proof that the rotated pair is genuinely usable, which is the whole
    // point: a browser holding these cookies can sign in again an hour later.
    const stale = await staleBrowserCookies();
    const response = await updateOperatorSession(
      consoleRequest("/console", stale.header),
    );

    const rotated = refreshTokenFrom(
      sessionSetCookies(response, stale.cookieName),
    );

    const follower = createClient(SUPABASE_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await follower.auth.refreshSession({
      refresh_token: rotated,
    });

    expect(error).toBeNull();
    expect(data.user?.id).toBe(authUserId);
  });
});

describe("updateOperatorSession — routing", () => {
  it("sends an anonymous visitor to the login page and writes no session", async () => {
    const response = await updateOperatorSession(consoleRequest("/console"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3100/console/login",
    );
    expect(sessionSetCookies(response, "sb-")).toEqual([]);
  });

  it("lets an anonymous visitor reach the login page", async () => {
    const response = await updateOperatorSession(
      consoleRequest("/console/login"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("never redirects the session-destroying route", async () => {
    const response = await updateOperatorSession(
      consoleRequest("/console/auth/sign-out?denied=1"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("updateOperatorSession — operator identity forwarding", () => {
  it("forwards the identity on the REQUEST, never as a plain response header", async () => {
    const stale = await staleBrowserCookies();

    const response = await updateOperatorSession(
      consoleRequest("/console", stale.header),
    );

    // Next transports overridden request headers as `x-middleware-request-*`
    // and strips them before the response reaches the browser. The leak shape
    // the reference project shipped is the BARE header name, which set the
    // operator's id and phone on the response itself.
    expect(response.headers.get(OPERATOR_IDENTITY_HEADER)).toBeNull();

    const forwarded = response.headers.get(
      `x-middleware-request-${OPERATOR_IDENTITY_HEADER}`,
    );
    expect(forwarded).not.toBeNull();
    await expect(
      verifyOperatorIdentity(OPERATOR_SESSION_SECRET, forwarded ?? ""),
    ).resolves.toEqual({ authUserId, email });
  });

  it("discards a forged inbound identity header", async () => {
    // `/console/login` so the request passes through rather than redirecting:
    // a redirect carries no forwarded request headers at all, which would make
    // this assertion pass for the wrong reason.
    const forged = await updateOperatorSession(
      new NextRequest(new URL("/console/login", "http://localhost:3100"), {
        headers: new Headers({
          [OPERATOR_IDENTITY_HEADER]: "whatever-the-attacker-likes",
          "user-agent": "forgery-probe",
        }),
      }),
    );

    // Other request headers ARE forwarded, so the override mechanism is live
    // and the operator header is absent because it was removed, not because
    // nothing was forwarded.
    const override = forged.headers.get("x-middleware-override-headers") ?? "";
    expect(override.split(",")).toContain("user-agent");
    expect(override.split(",")).not.toContain(OPERATOR_IDENTITY_HEADER);
    expect(
      forged.headers.get(`x-middleware-request-${OPERATOR_IDENTITY_HEADER}`),
    ).toBeNull();
  });
});
