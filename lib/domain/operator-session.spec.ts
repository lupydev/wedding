import { describe, expect, it } from "vitest";

import {
  CONSOLE_LOGIN_PATH,
  CONSOLE_ROOT_PATH,
  OPERATOR_IDENTITY_HEADER,
  applyOperatorIdentityHeader,
  consolePreviewPath,
  isConsolePath,
  normalizeAllowlistEmail,
  readOperatorIdentityHeader,
  resolveConsoleRedirect,
  signOperatorIdentity,
  verifyOperatorIdentity,
  type OperatorIdentity,
} from "./operator-session";

const SECRET = "a-test-secret-at-least-32-characters-long";
const OTHER_SECRET = "a-different-secret-also-32-characters-long";

const IDENTITY: OperatorIdentity = {
  authUserId: "11111111-2222-3333-4444-555555555555",
  email: "ana@example.test",
};

describe("isConsolePath", () => {
  it.each([
    ["/console", true],
    ["/console/", true],
    ["/console/login", true],
    ["/console/auth/sign-out", true],
    ["/console/dispatch/abc", true],
    ["/consolelike", false],
    ["/console-archive", false],
    ["/i/abcdefghijklmnop", false],
    ["/", false],
    ["", false],
  ])("treats %s as a console path: %s", (pathname, expected) => {
    expect(isConsolePath(pathname)).toBe(expected);
  });
});

describe("resolveConsoleRedirect", () => {
  it("sends an unauthenticated visitor from the console to the login page", () => {
    expect(resolveConsoleRedirect("/console", false)).toBe(CONSOLE_LOGIN_PATH);
  });

  it("sends an unauthenticated visitor from a nested console route to the login page", () => {
    expect(resolveConsoleRedirect("/console/dispatch/abc", false)).toBe(
      CONSOLE_LOGIN_PATH,
    );
  });

  it("lets an authenticated visitor through to the console", () => {
    expect(resolveConsoleRedirect("/console", true)).toBeNull();
  });

  it("does not redirect an unauthenticated visitor who is already at the login page", () => {
    // Redirecting here would be an infinite loop, which is how a login page
    // becomes unreachable and the console becomes unrecoverable.
    expect(resolveConsoleRedirect(CONSOLE_LOGIN_PATH, false)).toBeNull();
  });

  it("sends an already-authenticated visitor away from the login page", () => {
    expect(resolveConsoleRedirect(CONSOLE_LOGIN_PATH, true)).toBe(
      CONSOLE_ROOT_PATH,
    );
  });

  it("never redirects the session-destroying route, authenticated or not", () => {
    // The callback is the route that CREATES the session. Redirecting an
    // unauthenticated request away from it makes signing in impossible.
    expect(resolveConsoleRedirect("/console/auth/sign-out", false)).toBeNull();
    expect(resolveConsoleRedirect("/console/auth/sign-out", true)).toBeNull();
  });

  it("leaves the guest surface alone, signed in or not", () => {
    expect(resolveConsoleRedirect("/i/abcdefghijklmnop", false)).toBeNull();
    expect(resolveConsoleRedirect("/i/abcdefghijklmnop", true)).toBeNull();
  });
});

describe("signOperatorIdentity / verifyOperatorIdentity", () => {
  it("round-trips an identity through the signed header value", async () => {
    const signed = await signOperatorIdentity(SECRET, IDENTITY);

    await expect(verifyOperatorIdentity(SECRET, signed)).resolves.toEqual(
      IDENTITY,
    );
  });

  it("produces a different value for a different identity", async () => {
    const first = await signOperatorIdentity(SECRET, IDENTITY);
    const second = await signOperatorIdentity(SECRET, {
      authUserId: IDENTITY.authUserId,
      email: "beto@example.test",
    });

    expect(second).not.toBe(first);
    await expect(verifyOperatorIdentity(SECRET, second)).resolves.toEqual({
      authUserId: IDENTITY.authUserId,
      email: "beto@example.test",
    });
  });

  it("rejects a value signed with a different secret", async () => {
    const signed = await signOperatorIdentity(OTHER_SECRET, IDENTITY);

    await expect(verifyOperatorIdentity(SECRET, signed)).resolves.toBeNull();
  });

  it("rejects a forged payload carrying a borrowed signature", async () => {
    const signed = await signOperatorIdentity(SECRET, IDENTITY);
    const signature = signed.split(".")[1];
    const forgedPayload = btoa(
      JSON.stringify({
        authUserId: "00000000-0000-0000-0000-000000000000",
        email: "attacker@example.test",
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await expect(
      verifyOperatorIdentity(SECRET, `${forgedPayload}.${signature}`),
    ).resolves.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const [payload, signature] = (
      await signOperatorIdentity(SECRET, IDENTITY)
    ).split(".");
    const flipped = signature.startsWith("a")
      ? `b${signature.slice(1)}`
      : `a${signature.slice(1)}`;

    await expect(
      verifyOperatorIdentity(SECRET, `${payload}.${flipped}`),
    ).resolves.toBeNull();
  });

  it.each([
    { value: "", reason: "an empty value" },
    { value: "not-signed-at-all", reason: "an unsigned value" },
    { value: "a.b.c", reason: "an over-segmented value" },
    { value: ".", reason: "two empty halves" },
    { value: "!!!.abc", reason: "an undecodable payload" },
  ])("rejects $reason rather than throwing", async ({ value }) => {
    await expect(verifyOperatorIdentity(SECRET, value)).resolves.toBeNull();
  });
});

describe("applyOperatorIdentityHeader", () => {
  it("strips an inbound forgery when there is no authenticated operator", async () => {
    // A visitor can send any header they like. The forwarded identity is only
    // trustworthy because it is removed unconditionally before it is set.
    const headers = new Headers({
      [OPERATOR_IDENTITY_HEADER]: "forged-by-the-client",
    });

    await applyOperatorIdentityHeader(headers, SECRET, null);

    expect(headers.get(OPERATOR_IDENTITY_HEADER)).toBeNull();
  });

  it("overwrites an inbound forgery with the real signed identity", async () => {
    const headers = new Headers({
      [OPERATOR_IDENTITY_HEADER]: "forged-by-the-client",
    });

    await applyOperatorIdentityHeader(headers, SECRET, IDENTITY);

    const forwarded = headers.get(OPERATOR_IDENTITY_HEADER);
    expect(forwarded).not.toBe("forged-by-the-client");
    await expect(
      verifyOperatorIdentity(SECRET, forwarded ?? ""),
    ).resolves.toEqual(IDENTITY);
  });
});

describe("readOperatorIdentityHeader", () => {
  it("reads back an identity this module forwarded", async () => {
    const headers = new Headers();
    await applyOperatorIdentityHeader(headers, SECRET, IDENTITY);

    await expect(readOperatorIdentityHeader(headers, SECRET)).resolves.toEqual(
      IDENTITY,
    );
  });

  it("returns null for a client-supplied header that was never signed", async () => {
    const headers = new Headers({
      [OPERATOR_IDENTITY_HEADER]: btoa(JSON.stringify(IDENTITY)),
    });

    await expect(
      readOperatorIdentityHeader(headers, SECRET),
    ).resolves.toBeNull();
  });

  it("returns null when the header is absent", async () => {
    await expect(
      readOperatorIdentityHeader(new Headers(), SECRET),
    ).resolves.toBeNull();
  });
});

describe("normalizeAllowlistEmail", () => {
  it.each([
    ["  Ana@Example.Test  ", "ana@example.test"],
    ["BETO@example.test", "beto@example.test"],
    ["ana@example.test", "ana@example.test"],
  ])("normalizes %s to %s", (raw, expected) => {
    expect(normalizeAllowlistEmail(raw)).toBe(expected);
  });

  it.each([
    { raw: "", reason: "an empty string" },
    { raw: "   ", reason: "a blank string" },
    { raw: "no-at-sign", reason: "no @" },
    { raw: "@example.test", reason: "no local part" },
    { raw: "ana@", reason: "no domain" },
    { raw: "ana@example", reason: "no dot in the domain" },
    { raw: "ana beto@example.test", reason: "an embedded space" },
    { raw: null, reason: "null" },
    { raw: undefined, reason: "undefined" },
  ])("rejects $reason", ({ raw }) => {
    expect(normalizeAllowlistEmail(raw)).toBeNull();
  });
});

/**
 * The operator's body-preview route.
 *
 * A SEPARATE admin-only path, and that separation is the security decision the
 * exploration settled. Three alternatives were considered and rejected for the
 * public route: `?preview=1` is a guessable, permanently open hole on a URL
 * every guest already holds; a signed preview token is the same capability as
 * the phone gate with no rate limit, and it leaks through history and referrers;
 * and an admin-session bypass would make the public route's authorization depend
 * on two independent identities, which is exactly where authorization bugs live.
 * A separate console path adds no new authorization axis at all — it is behind
 * the same `requireOperator()` as every other console page.
 */
describe("consolePreviewPath", () => {
  it("builds the preview path for one invitation", () => {
    expect(consolePreviewPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/console/preview/11111111-1111-4111-8111-111111111111",
    );
  });

  it("builds a different path for a different invitation", () => {
    expect(consolePreviewPath("22222222-2222-4222-8222-222222222222")).toBe(
      "/console/preview/22222222-2222-4222-8222-222222222222",
    );
  });

  it("stays inside the console, so the console's auth gate covers it", () => {
    expect(
      isConsolePath(consolePreviewPath("11111111-1111-4111-8111-111111111111")),
    ).toBe(true);
  });

  it("carries no query parameter, because it needs no bypass", () => {
    // The public route is never told the word "preview". This path is a
    // different route, not a different mode of the gated one.
    expect(
      consolePreviewPath("11111111-1111-4111-8111-111111111111"),
    ).not.toContain("?");
  });
});

/**
 * Console API routes must never be redirected.
 *
 * Found by the end-to-end test for the beacon route's refusals, and it was a
 * real defect rather than a test detail. `app/console/api/dispatch-event`
 * deliberately answers an unauthenticated post with 401 and never with a
 * redirect, because `navigator.sendBeacon` cannot act on a redirect: it follows
 * it, receives the login page with a 200, and reports success while nothing was
 * recorded at all. The proxy sat in front of that route and redirected first,
 * so the 401 the route was written to send was unreachable in production and
 * every unauthenticated `link_opened` was silently lost.
 *
 * The redirect exists to put a PERSON in front of a login form. A machine
 * caller is not a person, and these routes each authenticate themselves.
 */
describe("resolveConsoleRedirect — console API routes", () => {
  it("never redirects an unauthenticated console API request", () => {
    expect(
      resolveConsoleRedirect("/console/api/dispatch-event", false),
    ).toBeNull();
  });

  it("never redirects an authenticated console API request either", () => {
    expect(
      resolveConsoleRedirect("/console/api/dispatch-event", true),
    ).toBeNull();
  });

  it("leaves any other console API route alone as well", () => {
    expect(resolveConsoleRedirect("/console/api", false)).toBeNull();
    expect(
      resolveConsoleRedirect("/console/api/anything/else", false),
    ).toBeNull();
  });

  it("still redirects an unauthenticated console PAGE to the login form", () => {
    // The complement: the exemption must be the API prefix and not the console.
    expect(resolveConsoleRedirect("/console", false)).toBe(CONSOLE_LOGIN_PATH);
    expect(resolveConsoleRedirect("/console/preview/abc", false)).toBe(
      CONSOLE_LOGIN_PATH,
    );
  });

  it("does not exempt a page whose name merely starts with the prefix", () => {
    // `/console/apiary` is a page, not an API route. A `startsWith` without the
    // separator would hand it the exemption and leave it unguarded.
    expect(resolveConsoleRedirect("/console/apiary", false)).toBe(
      CONSOLE_LOGIN_PATH,
    );
  });
});
