import { afterEach, describe, expect, it } from "vitest";

import type { GateAttempt } from "@/lib/domain/rate-limit";

import { attemptUnlock, hashClientIp, type GateAttemptsStore } from "./gate";

/**
 * The gate adapter: the one place a submitted phone is compared against stored
 * data, and the one place attempts are counted.
 *
 * Everything that decides anything is pure and already tested — `matchesInvitation`
 * in `lib/domain/phone.ts`, `evaluateGate` and `remainingAttempts` in
 * `lib/domain/rate-limit.ts`. What is tested HERE is the wiring: that the
 * lockout is consulted BEFORE the comparison (so a locked-out attacker learns
 * nothing from a correct guess), that every real attempt is durably recorded,
 * and that a locked attempt does not extend its own lockout forever.
 *
 * The attempt store is a port. A fake one keeps this a two-mock test instead of
 * a Supabase-shaped puppet show, and the real implementation is exercised
 * end-to-end by `e2e/phone-gate.spec.ts`.
 */

const ORIGINAL_ENV = { ...process.env };
const PEPPER = "p".repeat(40);
const INVITATION = "11111111-1111-4111-8111-111111111111";
const IP = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_IP = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);

/** Three guests, one of them with no stored phone at all. */
const GUESTS = [
  { phone_last8: "55512345" },
  { phone_last8: "55567890" },
  { phone_last8: null },
];

process.env.GATE_IP_PEPPER = PEPPER;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV, GATE_IP_PEPPER: PEPPER };
});

interface RecordedAttempt {
  readonly invitationId: string;
  readonly ipHash: string;
  readonly succeeded: boolean;
}

function fakeStore(history: readonly GateAttempt[] = []) {
  const recorded: RecordedAttempt[] = [];
  const rows = [...history];

  const store: GateAttemptsStore = {
    async recentAttempts() {
      // A snapshot, exactly as a database read returns: the caller must never
      // be handed a live view that a later write mutates underneath it.
      return [...rows];
    },
    async recordAttempt(attempt) {
      recorded.push({
        invitationId: attempt.invitationId,
        ipHash: attempt.ipHash,
        succeeded: attempt.succeeded,
      });
      rows.push({
        ipHash: attempt.ipHash,
        succeeded: attempt.succeeded,
        attemptedAt: attempt.attemptedAt,
      });
    },
  };

  return { store, recorded };
}

function failures(
  count: number,
  options: { ipHash?: string; minutesAgo?: number } = {},
): GateAttempt[] {
  const { ipHash = IP, minutesAgo = 1 } = options;

  return Array.from({ length: count }, () => ({
    ipHash,
    succeeded: false,
    attemptedAt: NOW - minutesAgo * MINUTE,
  }));
}

function unlockWith(
  store: GateAttemptsStore,
  rawPhone: string,
  guests: ReadonlyArray<{ phone_last8: string | null }> = GUESTS,
) {
  return attemptUnlock(store, {
    invitationId: INVITATION,
    guests,
    rawPhone,
    ipHash: IP,
    now: NOW,
  });
}

describe("attemptUnlock — matching", () => {
  it("unlocks for the last 8 digits of the FIRST guest's number", async () => {
    const { store } = fakeStore();

    expect(await unlockWith(store, "300 555 12345")).toEqual({
      status: "unlocked",
    });
  });

  it("unlocks for a second guest's number, not only a primary contact", async () => {
    const { store } = fakeStore();

    expect(await unlockWith(store, "+57 300 5556 7890")).toEqual({
      status: "unlocked",
    });
  });

  it("rejects a one-digit near miss", async () => {
    const { store } = fakeStore();

    expect(await unlockWith(store, "+573005556 7891")).toEqual({
      status: "rejected",
      attemptsRemaining: 7,
    });
  });

  it("rejects a blank submission rather than matching the phone-less guest", async () => {
    const { store } = fakeStore();

    const result = await unlockWith(store, "");

    expect(result.status).toBe("rejected");
  });

  it("rejects an invitation whose guests all lack a stored phone", async () => {
    const { store } = fakeStore();

    const result = await unlockWith(store, "3005551234", [
      { phone_last8: null },
      { phone_last8: null },
    ]);

    expect(result.status).toBe("rejected");
  });
});

describe("attemptUnlock — recording", () => {
  it("records the successful attempt against the invitation and IP", async () => {
    const { store, recorded } = fakeStore();

    await unlockWith(store, "30055512345");

    expect(recorded).toEqual([
      { invitationId: INVITATION, ipHash: IP, succeeded: true },
    ]);
  });

  it("records a failed attempt so the lockout can ever trigger", async () => {
    const { store, recorded } = fakeStore();

    await unlockWith(store, "30055500000");

    expect(recorded).toEqual([
      { invitationId: INVITATION, ipHash: IP, succeeded: false },
    ]);
  });

  it("counts the attempt it just recorded when reporting what is left", async () => {
    const { store } = fakeStore(failures(5));

    expect(await unlockWith(store, "30055500000")).toEqual({
      status: "rejected",
      attemptsRemaining: 2,
    });
  });

  it("reports the last remaining attempt before the lockout", async () => {
    const { store } = fakeStore(failures(6));

    expect(await unlockWith(store, "30055500000")).toEqual({
      status: "rejected",
      attemptsRemaining: 1,
    });
  });
});

describe("attemptUnlock — rate limiting", () => {
  it("locks the 9th attempt from one IP after 8 failures in 15 minutes", async () => {
    const { store } = fakeStore(failures(8));

    const result = await unlockWith(store, "30055500000");

    expect(result).toEqual({ status: "locked", retryAfterMs: 29 * MINUTE });
  });

  it("locks the 9th attempt even when the submitted number is CORRECT", async () => {
    // The whole point: a locked-out attacker must learn nothing from guessing
    // right, and must not be let in by it either.
    const { store, recorded } = fakeStore(failures(8));

    const result = await unlockWith(store, "30055512345");

    expect(result.status).toBe("locked");
    expect(recorded).toEqual([]);
  });

  it("does not record the locked attempt, so a lockout cannot extend itself forever", async () => {
    const { store, recorded } = fakeStore(failures(8));

    await unlockWith(store, "30055500000");
    await unlockWith(store, "30055500001");

    expect(recorded).toEqual([]);
  });

  it("locks on the all-IP scope after 30 failures in an hour from rotating IPs", async () => {
    const spread = Array.from({ length: 30 }, (_unused, index) => ({
      ipHash: `ip-${index}`,
      succeeded: false,
      attemptedAt: NOW - MINUTE,
    }));
    const { store } = fakeStore(spread);

    const result = await attemptUnlock(store, {
      invitationId: INVITATION,
      guests: GUESTS,
      rawPhone: "30055500000",
      ipHash: OTHER_IP,
      now: NOW,
    });

    expect(result).toEqual({ status: "locked", retryAfterMs: 59 * MINUTE });
  });

  it("lets a fresh IP through while another IP is locked out", async () => {
    const { store } = fakeStore(failures(8, { ipHash: OTHER_IP }));

    const result = await unlockWith(store, "30055512345");

    expect(result).toEqual({ status: "unlocked" });
  });

  it("consults the lockout BEFORE reading any stored phone digit", async () => {
    // With no guests supplied at all a correct match is impossible, so a
    // `locked` verdict here can only have come from the rate limiter.
    const { store } = fakeStore(failures(8));

    const result = await unlockWith(store, "30055512345", []);

    expect(result.status).toBe("locked");
  });
});

describe("hashClientIp", () => {
  it("produces 32 hexadecimal characters", () => {
    expect(hashClientIp("203.0.113.7")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic for the same address", () => {
    expect(hashClientIp("203.0.113.7")).toBe(hashClientIp("203.0.113.7"));
  });

  it("separates two different addresses", () => {
    expect(hashClientIp("203.0.113.7")).not.toBe(hashClientIp("203.0.113.8"));
  });

  it("never contains the address it hashed", () => {
    expect(hashClientIp("203.0.113.7")).not.toContain("203");
  });

  it("changes completely when the pepper changes, so the hash is not enumerable", () => {
    const withPepper = hashClientIp("203.0.113.7");
    process.env.GATE_IP_PEPPER = "q".repeat(40);

    expect(hashClientIp("203.0.113.7")).not.toBe(withPepper);
  });

  it("refuses to hash without a configured pepper", () => {
    delete process.env.GATE_IP_PEPPER;

    expect(() => hashClientIp("203.0.113.7")).toThrow(/GATE_IP_PEPPER/);
  });
});
