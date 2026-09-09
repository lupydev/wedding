import { describe, expect, it } from "vitest";

import {
  INVITATION_SCOPE,
  IP_SCOPE,
  evaluateGate,
  remainingAttempts,
  type GateAttempt,
} from "./rate-limit";

// `now` is injected (design decision D2), so lockout windows are deterministic
// and need no fake timers.

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
const IP = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_IP = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function failures(
  count: number,
  options: {
    ipHash?: string;
    minutesAgo?: number;
    spacingMinutes?: number;
  } = {},
): GateAttempt[] {
  const { ipHash = IP, minutesAgo = 1, spacingMinutes = 0 } = options;

  return Array.from({ length: count }, (_unused, index) => ({
    ipHash,
    succeeded: false,
    attemptedAt: NOW - (minutesAgo + index * spacingMinutes) * MINUTE,
  }));
}

describe("evaluateGate — scope thresholds", () => {
  it("exposes the documented per-IP window, threshold and lockout", () => {
    expect(IP_SCOPE).toEqual({
      windowMs: 15 * MINUTE,
      threshold: 8,
      lockoutMs: 30 * MINUTE,
    });
  });

  it("exposes the documented all-IP window, threshold and lockout", () => {
    expect(INVITATION_SCOPE).toEqual({
      windowMs: 60 * MINUTE,
      threshold: 30,
      lockoutMs: 60 * MINUTE,
    });
  });
});

describe("evaluateGate — (invitation, ip_hash) scope", () => {
  it("allows a first attempt with no history", () => {
    expect(evaluateGate({ ipHash: IP, attempts: [] }, NOW)).toEqual({
      allowed: true,
    });
  });

  it("allows the 8th attempt after 7 failures in the window", () => {
    const result = evaluateGate({ ipHash: IP, attempts: failures(7) }, NOW);

    expect(result.allowed).toBe(true);
  });

  it("rejects the 9th attempt after 8 failures in the window", () => {
    const result = evaluateGate({ ipHash: IP, attempts: failures(8) }, NOW);

    expect(result).toEqual({
      allowed: false,
      scope: "ip",
      retryAfterMs: 29 * MINUTE,
    });
  });

  it("keeps the lockout for the full 30 minutes, past the 15 minute window", () => {
    // The 8 failures are 20 minutes old: outside the counting window, but the
    // lockout they triggered has 10 minutes left. Expiring the window must not
    // expire the lockout.
    const attempts = failures(8, { minutesAgo: 20 });
    const result = evaluateGate({ ipHash: IP, attempts }, NOW);

    expect(result).toEqual({
      allowed: false,
      scope: "ip",
      retryAfterMs: 10 * MINUTE,
    });
  });

  it("allows again once the 30 minute lockout has elapsed", () => {
    const attempts = failures(8, { minutesAgo: 31 });

    expect(evaluateGate({ ipHash: IP, attempts }, NOW).allowed).toBe(true);
  });

  it("does not count failures spread beyond the 15 minute window", () => {
    // 8 failures, one every 5 minutes: never 8 within any 15 minute window.
    const attempts = failures(8, { minutesAgo: 1, spacingMinutes: 5 });

    expect(evaluateGate({ ipHash: IP, attempts }, NOW).allowed).toBe(true);
  });

  it("counts only failures, never successful unlocks", () => {
    const attempts: GateAttempt[] = [
      ...failures(7),
      { ipHash: IP, succeeded: true, attemptedAt: NOW - MINUTE },
      { ipHash: IP, succeeded: true, attemptedAt: NOW - MINUTE },
    ];

    expect(evaluateGate({ ipHash: IP, attempts }, NOW).allowed).toBe(true);
  });

  it("does not punish one IP for another IP's failures", () => {
    const attempts = failures(8, { ipHash: OTHER_IP });

    expect(evaluateGate({ ipHash: IP, attempts }, NOW).allowed).toBe(true);
  });
});

describe("evaluateGate — invitation-wide scope", () => {
  it("locks the invitation after 30 failures across rotating IPs", () => {
    // The per-IP scope is trivially defeated by rotating source IPs, which is
    // exactly why the second scope exists: 6 failures each from 5 addresses.
    const attempts = Array.from({ length: 30 }, (_unused, index) => ({
      ipHash: `ip-${index % 5}`,
      succeeded: false,
      attemptedAt: NOW - (index + 1) * MINUTE,
    }));

    const result = evaluateGate({ ipHash: "ip-fresh", attempts }, NOW);

    expect(result).toEqual({
      allowed: false,
      scope: "invitation",
      retryAfterMs: 59 * MINUTE,
    });
  });

  it("allows a fresh IP after 29 invitation-wide failures", () => {
    const attempts = Array.from({ length: 29 }, (_unused, index) => ({
      ipHash: `ip-${index % 5}`,
      succeeded: false,
      attemptedAt: NOW - (index + 1) * MINUTE,
    }));

    expect(evaluateGate({ ipHash: "ip-fresh", attempts }, NOW).allowed).toBe(
      true,
    );
  });

  it("allows again once the 60 minute invitation lockout has elapsed", () => {
    const attempts = Array.from({ length: 30 }, (_unused, index) => ({
      ipHash: `ip-${index % 5}`,
      succeeded: false,
      attemptedAt: NOW - (61 + index) * MINUTE,
    }));

    expect(evaluateGate({ ipHash: "ip-fresh", attempts }, NOW).allowed).toBe(
      true,
    );
  });

  it("reports the binding scope when both scopes are locked", () => {
    // Both lockouts are active: per-IP clears at +29 min, invitation-wide at
    // +59 min. Reporting the shorter one would tell the guest to come back at a
    // moment they would still be locked out, so the longer one is authoritative.
    const attempts = Array.from({ length: 30 }, (_unused, index) => ({
      ipHash: IP,
      succeeded: false,
      attemptedAt: NOW - (index + 1) * MINUTE,
    }));

    const result = evaluateGate({ ipHash: IP, attempts }, NOW);

    expect(result).toEqual({
      allowed: false,
      scope: "invitation",
      retryAfterMs: 59 * MINUTE,
    });
  });
});

describe("evaluateGate — purity", () => {
  it("does not mutate or reorder the attempts it is given", () => {
    const attempts = failures(8, { minutesAgo: 1, spacingMinutes: 1 });
    const snapshot = attempts.map((attempt) => ({ ...attempt }));

    evaluateGate({ ipHash: IP, attempts }, NOW);

    expect(attempts).toEqual(snapshot);
  });

  it("returns the same verdict for the same inputs", () => {
    const attempts = failures(8);

    expect(evaluateGate({ ipHash: IP, attempts }, NOW)).toEqual(
      evaluateGate({ ipHash: IP, attempts }, NOW),
    );
  });
});

describe("remainingAttempts", () => {
  it("reports the full per-IP allowance when there is no history", () => {
    expect(remainingAttempts({ ipHash: IP, attempts: [] }, NOW)).toBe(8);
  });

  it("counts down as this IP accumulates failures inside the window", () => {
    expect(remainingAttempts({ ipHash: IP, attempts: failures(6) }, NOW)).toBe(
      2,
    );
  });

  it("reports one remaining attempt after seven failures", () => {
    expect(remainingAttempts({ ipHash: IP, attempts: failures(7) }, NOW)).toBe(
      1,
    );
  });

  it("never reports a negative allowance once the threshold is passed", () => {
    expect(remainingAttempts({ ipHash: IP, attempts: failures(11) }, NOW)).toBe(
      0,
    );
  });

  it("ignores failures that have aged out of the 15 minute window", () => {
    const stale = failures(6, { minutesAgo: 20, spacingMinutes: 1 });

    expect(remainingAttempts({ ipHash: IP, attempts: stale }, NOW)).toBe(8);
  });

  it("ignores failures made from another IP", () => {
    const others = failures(6, { ipHash: OTHER_IP });

    expect(remainingAttempts({ ipHash: IP, attempts: others }, NOW)).toBe(8);
  });

  it("ignores successful attempts, so a guest is never punished for returning", () => {
    const attempts: GateAttempt[] = [
      ...failures(3),
      { ipHash: IP, succeeded: true, attemptedAt: NOW - MINUTE },
      { ipHash: IP, succeeded: true, attemptedAt: NOW - 2 * MINUTE },
    ];

    expect(remainingAttempts({ ipHash: IP, attempts }, NOW)).toBe(5);
  });
});
