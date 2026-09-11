import { describe, expect, it } from "vitest";

import {
  CONSOLE_LOGIN_PATH,
  CONSOLE_ROOT_PATH,
  OPERATOR_IDENTITY_HEADER,
  applyOperatorIdentityHeader,
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
    ["/console/auth/callback", true],
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

  it("never redirects the magic-link callback, authenticated or not", () => {
    // The callback is the route that CREATES the session. Redirecting an
    // unauthenticated request away from it makes signing in impossible.
    expect(resolveConsoleRedirect("/console/auth/callback", false)).toBeNull();
    expect(resolveConsoleRedirect("/console/auth/callback", true)).toBeNull();
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
