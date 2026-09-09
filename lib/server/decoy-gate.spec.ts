import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gateFeedbackMessages } from "@/lib/domain/gate-copy";
import type { GateAttempt } from "@/lib/domain/rate-limit";

import {
  DECOY_SLUG_CAPACITY,
  decoyUnlockOutcome,
  resetDecoyGate,
} from "./decoy-gate";
import {
  attemptUnlock,
  toGateFeedback,
  type GateAttemptsStore,
  type UnlockOutcome,
} from "./gate";

/**
 * The unknown-invitation decoy.
 *
 * A forged action call against a slug that does not exist used to answer with a
 * constant `attemptsRemaining: 0`, while a real invitation answered a wrong
 * number with a counter that walks 7, 6, 5 … 0 and then a lockout. The SHAPE
 * matched; the VALUES gave the answer away on the very first call, which is
 * exactly the existence oracle the gate was built to avoid.
 *
 * These tests compare whole SEQUENCES, not single calls. A single-call
 * assertion is what let the defect through the first time.
 *
 * The honest constraint, stated rather than dressed up: nothing is persisted
 * for a slug that has no row, and persisting attempts for attacker-chosen slugs
 * would be its own abuse vector — an unbounded, unauthenticated write channel
 * into a table that exists to slow attackers down. So the decoy counts in
 * bounded process memory. Within one warm instance it is indistinguishable;
 * across a cold start or a second instance it resets, while a real invitation's
 * counter does not. That residual gap is measured by the last tests in this
 * file rather than hidden.
 */

const UNKNOWN_SLUG = "zzzzzzzzzzzzzzzz";
const OTHER_UNKNOWN_SLUG = "yyyyyyyyyyyyyyyy";
const INVITATION = "11111111-1111-4111-8111-111111111111";
const IP = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_IP = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NOW = Date.UTC(2026, 8, 9, 12, 0, 0);
const SECOND = 1_000;
const MINUTE = 60_000;

/** A real household. One guest has no stored phone, as real data does. */
const GUESTS = [
  { phone_last8: "55512345" },
  { phone_last8: "55567890" },
  { phone_last8: null },
];

/** Numbers that belong to nobody on the invitation above. */
const WRONG_NUMBERS = [
  "+573005550001",
  "+573005550002",
  "+573005550003",
  "+573005550004",
  "+573005550005",
  "+573005550006",
  "+573005550007",
  "+573005550008",
  "+573005550009",
  "+573005550010",
  "+573005550011",
  "+573005550012",
];

/** The attempt log, faked. Returns snapshots, exactly as a real read does. */
function fakeStore(): GateAttemptsStore {
  const rows: GateAttempt[] = [];

  return {
    async recentAttempts() {
      return [...rows];
    },
    async recordAttempt(attempt) {
      rows.push({
        ipHash: attempt.ipHash,
        succeeded: attempt.succeeded,
        attemptedAt: attempt.attemptedAt,
      });
    },
  };
}

/** What a guest sees: the outcome the action returns, as rendered Spanish. */
function rendered(outcome: UnlockOutcome): readonly string[] {
  if (outcome.status === "unlocked") {
    throw new Error("An unlocked outcome renders no gate feedback");
  }

  return gateFeedbackMessages(toGateFeedback(outcome));
}

/** `count` wrong numbers against a REAL invitation, one per second. */
async function realSequence(
  count: number,
  ipHash = IP,
): Promise<readonly UnlockOutcome[]> {
  const store = fakeStore();
  const outcomes: UnlockOutcome[] = [];

  for (let index = 0; index < count; index += 1) {
    outcomes.push(
      await attemptUnlock(store, {
        invitationId: INVITATION,
        guests: GUESTS,
        rawPhone: WRONG_NUMBERS[index % WRONG_NUMBERS.length],
        ipHash,
        now: NOW + index * SECOND,
      }),
    );
  }

  return outcomes;
}

/** The same `count` attempts against a slug that does not exist. */
async function decoySequence(
  count: number,
  slug = UNKNOWN_SLUG,
  ipHash = IP,
): Promise<readonly UnlockOutcome[]> {
  const outcomes: UnlockOutcome[] = [];

  for (let index = 0; index < count; index += 1) {
    outcomes.push(
      await decoyUnlockOutcome({
        slug,
        rawPhone: WRONG_NUMBERS[index % WRONG_NUMBERS.length],
        ipHash,
        now: NOW + index * SECOND,
      }),
    );
  }

  return outcomes;
}

beforeEach(() => {
  resetDecoyGate();
});

afterEach(() => {
  resetDecoyGate();
});

describe("an unknown slug answers exactly like a wrong number", () => {
  it("matches the real invitation at every step of a 12-attempt sequence", async () => {
    const real = await realSequence(12);
    const decoy = await decoySequence(12);

    // The whole sequence, compared as one value. The counter walking down and
    // then the lockout are both inside this equality.
    expect(decoy).toEqual(real);
  });

  it("actually walks the counter down rather than both being constant", async () => {
    // Guards the equality above from passing because both sides are flat. If
    // this ever holds while the equality holds, the equality proved nothing.
    const decoy = await decoySequence(8);

    expect(decoy.map((outcome) => JSON.stringify(outcome))).toEqual([
      '{"status":"rejected","attemptsRemaining":7}',
      '{"status":"rejected","attemptsRemaining":6}',
      '{"status":"rejected","attemptsRemaining":5}',
      '{"status":"rejected","attemptsRemaining":4}',
      '{"status":"rejected","attemptsRemaining":3}',
      '{"status":"rejected","attemptsRemaining":2}',
      '{"status":"rejected","attemptsRemaining":1}',
      '{"status":"rejected","attemptsRemaining":0}',
    ]);
  });

  it("would have been caught on the FIRST call by this comparison", async () => {
    // The negative control: the behaviour that shipped. A single call is enough
    // to separate it from a real invitation, which is why the fix was needed
    // and why a single-call assertion was never enough to prove it absent.
    const shipped: UnlockOutcome = { status: "rejected", attemptsRemaining: 0 };
    const [firstReal] = await realSequence(1);

    expect(shipped).not.toEqual(firstReal);
  });

  it("renders identical Spanish copy at every step, lockout included", async () => {
    const real = await realSequence(10);
    const decoy = await decoySequence(10);

    expect(decoy.map(rendered)).toEqual(real.map(rendered));
    // And the copy is the real copy, not two identical empty arrays.
    expect(decoy[0].status).toBe("rejected");
    expect(rendered(decoy[0])).toEqual([
      "No pudimos confirmar ese número. Revisa que sea el celular que compartiste con nosotros e inténtalo de nuevo.",
      "Te quedan 7 intentos.",
    ]);
  });

  it("locks out on the same attempt and for the same duration", async () => {
    const real = await realSequence(9);
    const decoy = await decoySequence(9);

    expect(real[8].status).toBe("locked");
    expect(decoy[8]).toEqual(real[8]);
    // The per-IP lockout runs thirty minutes from the eighth failure, which
    // happened at NOW + 7s; the ninth attempt asks at NOW + 8s.
    expect(decoy[8]).toEqual({
      status: "locked",
      retryAfterMs: 30 * MINUTE - SECOND,
    });
  });

  it("rejects a number that IS on some real invitation, like a wrong one", async () => {
    // An attacker probing an unknown slug with a number they know is real must
    // learn nothing from it. The decoy holds no guests, so nothing matches.
    const outcome = await decoyUnlockOutcome({
      slug: UNKNOWN_SLUG,
      rawPhone: "+573005551234",
      ipHash: IP,
      now: NOW,
    });

    expect(outcome).toEqual({ status: "rejected", attemptsRemaining: 7 });
  });

  it("never unlocks, whatever is submitted", async () => {
    for (const submitted of ["", "55512345", "+573005567890", "not a phone"]) {
      const outcome = await decoyUnlockOutcome({
        slug: OTHER_UNKNOWN_SLUG,
        rawPhone: submitted,
        ipHash: OTHER_IP,
        now: NOW,
      });

      expect(outcome.status).toBe("rejected");
    }
  });
});

describe("the decoy counts the way the real gate counts", () => {
  it("scopes the counter per slug, as the real one scopes per invitation", async () => {
    await decoySequence(5, UNKNOWN_SLUG);
    const [fresh] = await decoySequence(1, OTHER_UNKNOWN_SLUG);

    expect(fresh).toEqual({ status: "rejected", attemptsRemaining: 7 });
  });

  it("gives a second address its own allowance on the same slug", async () => {
    const real = await realSequence(4, IP);

    await decoySequence(4, UNKNOWN_SLUG, IP);
    const decoyOther = await decoySequence(1, UNKNOWN_SLUG, OTHER_IP);
    const realOther = await realSequence(1, OTHER_IP);

    expect(real[3]).toEqual({ status: "rejected", attemptsRemaining: 4 });
    expect(decoyOther[0]).toEqual(realOther[0]);
  });

  it("forgets failures that aged out of the counting window", async () => {
    await decoySequence(5);

    const afterTheWindow = await decoyUnlockOutcome({
      slug: UNKNOWN_SLUG,
      rawPhone: WRONG_NUMBERS[0],
      ipHash: IP,
      now: NOW + 61 * MINUTE,
    });

    expect(afterTheWindow).toEqual({
      status: "rejected",
      attemptsRemaining: 7,
    });
  });
});

describe("the decoy cannot be used to exhaust memory", () => {
  it("keeps at most DECOY_SLUG_CAPACITY slugs, evicting the coldest", async () => {
    // The residual gap, measured rather than described away: a real
    // invitation's counter lives in Postgres and cannot be evicted, while an
    // attacker who touches DECOY_SLUG_CAPACITY other slugs resets this one.
    // Bounded memory was chosen over a counter that an unauthenticated caller
    // could grow without limit.
    await decoySequence(5, UNKNOWN_SLUG);

    for (let index = 0; index < DECOY_SLUG_CAPACITY; index += 1) {
      await decoyUnlockOutcome({
        slug: `filler${String(index).padStart(10, "0")}`,
        rawPhone: WRONG_NUMBERS[0],
        ipHash: IP,
        now: NOW + index * SECOND,
      });
    }

    const evicted = await decoyUnlockOutcome({
      slug: UNKNOWN_SLUG,
      rawPhone: WRONG_NUMBERS[0],
      ipHash: IP,
      now: NOW + DECOY_SLUG_CAPACITY * SECOND,
    });

    expect(evicted).toEqual({ status: "rejected", attemptsRemaining: 7 });
  });

  it("keeps an actively probed slug hot instead of evicting it first", async () => {
    await decoySequence(3, UNKNOWN_SLUG);

    for (let index = 0; index < DECOY_SLUG_CAPACITY - 1; index += 1) {
      await decoyUnlockOutcome({
        slug: `filler${String(index).padStart(10, "0")}`,
        rawPhone: WRONG_NUMBERS[0],
        ipHash: IP,
        now: NOW + index * SECOND,
      });

      // Touching the slug under attack keeps it the most recently used entry.
      await decoyUnlockOutcome({
        slug: UNKNOWN_SLUG,
        rawPhone: WRONG_NUMBERS[0],
        ipHash: OTHER_IP,
        now: NOW + index * SECOND,
      });
    }

    const stillCounting = await decoyUnlockOutcome({
      slug: UNKNOWN_SLUG,
      rawPhone: WRONG_NUMBERS[0],
      ipHash: IP,
      now: NOW + DECOY_SLUG_CAPACITY * SECOND,
    });

    // Four, not seven: the three original failures from this address are still
    // remembered and this is the fourth. Seven would mean the entry had been
    // evicted and the attacker had reset their own counter for free — which is
    // exactly what the previous test shows happens once a slug goes cold.
    expect(stillCounting).toEqual({ status: "rejected", attemptsRemaining: 4 });
  });
});
