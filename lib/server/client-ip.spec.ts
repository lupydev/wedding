import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHARED_RATE_LIMIT_BUCKET,
  TRUSTED_IP_HEADERS,
  trustedClientIp,
} from "./client-ip";

/**
 * The rate limiter's address, and who is allowed to choose it.
 *
 * The per-IP scope is one of the gate's two locks. It is only a lock if the
 * visitor cannot pick their own bucket: a value read from a header the client
 * sends means an attacker rotates buckets per request and the scope stops
 * counting anything.
 *
 * What the platform actually guarantees, verified rather than assumed
 * (`https://vercel.com/docs/headers/request-headers`, last updated
 * 2025-12-13):
 *
 *  - `x-forwarded-for`: "If you are trying to use Vercel behind a proxy, we
 *    currently overwrite the X-Forwarded-For header and do not forward external
 *    IPs." That overwrite is opt-out on Enterprise via the paid Trusted Proxy
 *    feature, which exists precisely to let a customer's own proxy supply this
 *    value. It is therefore the one header whose trustworthiness depends on
 *    billing configuration, so this module never reads it.
 *  - `x-vercel-forwarded-for`: "identical to the x-forwarded-for header.
 *    However, x-forwarded-for could be overwritten if you're using a proxy on
 *    top of Vercel." It is the value the platform itself computed, which is why
 *    it is preferred here.
 *  - `x-real-ip`: "identical to the x-forwarded-for header", documented in
 *    `@vercel/functions` as "Client IP as calculated by Vercel Proxy". That
 *    package's `ipAddress()` reads this header and nothing else
 *    (`IP_HEADER_NAME = "x-real-ip"` in `headers.js`, v3.9.6), so it is the
 *    fallback rather than a third opinion.
 *
 * None of those guarantees exist off Vercel. On a developer's machine or any
 * self-hosted Node server every one of these headers is just something the
 * client typed, so the whole set is only consulted when the platform says it
 * is running the process.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
});

function onVercel() {
  vi.stubEnv("VERCEL", "1");
}

function headers(values: Record<string, string>) {
  return {
    get(name: string): string | null {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("trustedClientIp on Vercel", () => {
  it("uses the platform's own forwarded-for value", () => {
    onVercel();

    expect(
      trustedClientIp(headers({ "x-vercel-forwarded-for": "203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, the header @vercel/functions reads", () => {
    onVercel();

    expect(trustedClientIp(headers({ "x-real-ip": "198.51.100.22" }))).toBe(
      "198.51.100.22",
    );
  });

  it("prefers the Vercel header when a proxy on top of Vercel disagrees", () => {
    onVercel();

    expect(
      trustedClientIp(
        headers({
          "x-vercel-forwarded-for": "203.0.113.7",
          "x-real-ip": "198.51.100.22",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("ignores a forged x-forwarded-for entirely", () => {
    // The defect this test exists for: the previous implementation returned the
    // left-most `x-forwarded-for` entry, so this request bought itself a fresh
    // rate-limit bucket and the per-IP lock counted nothing.
    onVercel();

    expect(trustedClientIp(headers({ "x-forwarded-for": "1.2.3.4" }))).toBe(
      SHARED_RATE_LIMIT_BUCKET,
    );
  });

  it("does not let a forged x-forwarded-for move the bucket", () => {
    onVercel();

    const platform = { "x-vercel-forwarded-for": "203.0.113.7" };
    const honest = trustedClientIp(headers(platform));
    const forged = trustedClientIp(
      headers({ ...platform, "x-forwarded-for": "1.2.3.4" }),
    );
    const forgedAgain = trustedClientIp(
      headers({ ...platform, "x-forwarded-for": "5.6.7.8, 9.10.11.12" }),
    );

    expect(honest).toBe("203.0.113.7");
    expect(forged).toBe(honest);
    expect(forgedAgain).toBe(honest);
  });

  it("does not let any other client-supplied forwarding header move it", () => {
    onVercel();

    const platform = { "x-real-ip": "198.51.100.22" };

    for (const forgeable of [
      "x-forwarded-for",
      "forwarded",
      "x-client-ip",
      "true-client-ip",
      "cf-connecting-ip",
      "x-cluster-client-ip",
    ]) {
      expect(
        trustedClientIp(headers({ ...platform, [forgeable]: "1.2.3.4" })),
      ).toBe("198.51.100.22");
    }
  });

  it("trims surrounding whitespace so one client is one bucket", () => {
    onVercel();

    expect(
      trustedClientIp(headers({ "x-vercel-forwarded-for": "  203.0.113.7 " })),
    ).toBe("203.0.113.7");
  });

  it("shares one bucket when the platform sent nothing usable", () => {
    onVercel();

    expect(trustedClientIp(headers({ "x-vercel-forwarded-for": "   " }))).toBe(
      SHARED_RATE_LIMIT_BUCKET,
    );
    expect(trustedClientIp(headers({}))).toBe(SHARED_RATE_LIMIT_BUCKET);
  });
});

describe("trustedClientIp off Vercel", () => {
  it("shares one bucket even when every header is present", () => {
    // Local development and any self-hosted run. Nothing here was computed by a
    // proxy we control, so every visitor sharing one lockout scope is the
    // conservative answer; a client-chosen bucket is not.
    vi.stubEnv("VERCEL", "");

    expect(
      trustedClientIp(
        headers({
          "x-vercel-forwarded-for": "203.0.113.7",
          "x-real-ip": "198.51.100.22",
          "x-forwarded-for": "1.2.3.4",
        }),
      ),
    ).toBe(SHARED_RATE_LIMIT_BUCKET);
  });

  it("shares one bucket when VERCEL is set to anything but 1", () => {
    vi.stubEnv("VERCEL", "0");

    expect(trustedClientIp(headers({ "x-real-ip": "198.51.100.22" }))).toBe(
      SHARED_RATE_LIMIT_BUCKET,
    );
  });
});

describe("the trusted header list", () => {
  it("never contains a header a client can set on Vercel", () => {
    expect([...TRUSTED_IP_HEADERS]).toEqual([
      "x-vercel-forwarded-for",
      "x-real-ip",
    ]);
    expect([...TRUSTED_IP_HEADERS]).not.toContain("x-forwarded-for");
  });

  it("names a bucket that is not a valid address, so it cannot collide", () => {
    // A real client IP must never hash into the shared bucket by accident.
    expect(SHARED_RATE_LIMIT_BUCKET).toBe("shared-untrusted-origin");
  });
});
