import "server-only";

import type { GateAttempt } from "@/lib/domain/rate-limit";

import {
  attemptUnlock,
  type FailedUnlockOutcome,
  type GateAttemptsStore,
} from "./gate";

/**
 * The answer a forged attempt against a slug that does not exist receives.
 *
 * WHY THIS EXISTS. An unknown slug renders a friendly "we could not find this
 * invitation" page with no form, so nobody reaches this code by accident — it
 * takes a forged Server Action call. The previous answer to such a call was a
 * constant `{ status: "rejected", attemptsRemaining: 0 }`. The SHAPE matched a
 * real invitation's rejection, and a comment claimed the two were therefore
 * indistinguishable. They were not. A real invitation answers a wrong number
 * with a counter that walks 7, 6, 5 … 0 and then a lockout, so the very first
 * forged call separated the two: "te quedan 7 intentos" meant the slug was
 * real. An oracle that leaks through the values rather than the structure is
 * still an oracle.
 *
 * HOW IT IS CLOSED. Not by hand-writing a matching counter — a second
 * implementation of the same arithmetic drifts from the first, and drift here
 * is a silent security regression. Instead the decoy runs the REAL gate:
 * `attemptUnlock`, the real `evaluateGate`, the real `remainingAttempts`,
 * against a household with no guests at all. Nothing can match an empty guest
 * list, so every attempt is a rejection, and the counter, the lockout moment
 * and the retry duration are identical BY CONSTRUCTION rather than by
 * agreement.
 *
 * THE HONEST CONSTRAINT. There is no row to record against, and there must not
 * be one: writing `gate_attempts` rows for attacker-chosen slugs would hand an
 * unauthenticated caller an unbounded write channel into the table that exists
 * to slow attackers down — trading an existence oracle for a storage-abuse
 * vector. So the decoy counts in bounded process memory instead. Inside one
 * warm instance it is indistinguishable across a whole attempt sequence. Across
 * a cold start, a second concurrent instance, or after roughly
 * `DECOY_SLUG_CAPACITY` other slugs have been probed, it resets — while a real
 * invitation's counter, which lives in Postgres, does not. That residual gap is
 * real, it is measured in `decoy-gate.spec.ts`, and it is the price of not
 * building the abuse vector. It is a far smaller signal than a constant zero on
 * the first call, and reading it requires an attacker to already be forging
 * action calls against a 80-bit slug they have no reason to believe exists.
 */

/**
 * A household with nobody on it.
 *
 * `matchesInvitation` asks whether any guest's stored last-8 equals the
 * submitted one; over an empty list that is false for every input, including a
 * number the attacker knows belongs to a real guest somewhere else.
 */
const NO_GUESTS = [] as const;

/**
 * How many distinct unknown slugs are remembered at once.
 *
 * A cap is not optional: the keys are attacker-chosen, so an uncapped map is a
 * memory-exhaustion vector on a serverless function with a fixed memory limit.
 * Eviction is least-recently-used, so the slug actually being probed stays
 * resident and the entries evicted are the drive-by ones.
 */
export const DECOY_SLUG_CAPACITY = 512;

/** Attempts against unknown slugs, newest activity last. Never persisted. */
const decoyHistory = new Map<string, GateAttempt[]>();

/** Drops the whole decoy history. Test seam; never called in production. */
export function resetDecoyGate(): void {
  decoyHistory.clear();
}

function touch(slug: string): GateAttempt[] {
  const existing = decoyHistory.get(slug);

  if (existing !== undefined) {
    // Re-inserting moves the key to the end of the Map's iteration order, which
    // is what makes the eviction below least-recently-used.
    decoyHistory.delete(slug);
    decoyHistory.set(slug, existing);

    return existing;
  }

  const fresh: GateAttempt[] = [];
  decoyHistory.set(slug, fresh);

  while (decoyHistory.size > DECOY_SLUG_CAPACITY) {
    const coldest = decoyHistory.keys().next();

    if (coldest.done === true) {
      break;
    }

    decoyHistory.delete(coldest.value);
  }

  return fresh;
}

/**
 * The in-memory attempt log, shaped as the same port the real gate uses.
 *
 * Pruning honours the `since` bound `attemptUnlock` computes from
 * `GATE_HISTORY_WINDOW_MS` — the horizon the Postgres-backed store is given
 * too, rather than a second copy of it — so a decoy cannot be told apart by
 * waiting for old failures to age out at a different moment. Discarding them
 * from the array as well as from the returned snapshot is what keeps one
 * long-probed slug from growing without bound.
 */
function ephemeralStore(): GateAttemptsStore {
  return {
    async recentAttempts(slug, since) {
      const rows = touch(slug);
      const live = rows.filter((attempt) => attempt.attemptedAt >= since);

      if (live.length !== rows.length) {
        rows.splice(0, rows.length, ...live);
      }

      // A snapshot, exactly as the Postgres-backed store returns: the caller
      // must never hold a live view that the write below mutates underneath it.
      return [...live];
    },

    async recordAttempt(attempt) {
      touch(attempt.invitationId).push({
        ipHash: attempt.ipHash,
        succeeded: attempt.succeeded,
        attemptedAt: attempt.attemptedAt,
      });
    },
  };
}

export interface DecoyUnlockRequest {
  /** The slug that resolved to nothing. Used only as an in-memory key. */
  readonly slug: string;
  readonly rawPhone: string;
  readonly ipHash: string;
  /** Epoch milliseconds, supplied by the caller (design decision D2). */
  readonly now: number;
}

/**
 * The outcome a forged attempt against an unknown slug receives.
 *
 * Never `unlocked`: an empty guest list matches nothing. The submitted phone is
 * passed straight into the same comparison the real gate uses and then dropped,
 * exactly as it is there — it is never stored, logged or returned.
 */
export async function decoyUnlockOutcome(
  request: DecoyUnlockRequest,
): Promise<FailedUnlockOutcome> {
  const outcome = await attemptUnlock(ephemeralStore(), {
    invitationId: request.slug,
    guests: NO_GUESTS,
    rawPhone: request.rawPhone,
    ipHash: request.ipHash,
    now: request.now,
  });

  // `matchesInvitation` over an empty guest list is false for every input, so
  // `unlocked` is unreachable — but the compiler cannot see that through
  // `attemptUnlock`'s signature. The assertion records the reason where the
  // reason lives instead of adding a dead branch that no test could ever run,
  // and `decoy-gate.spec.ts` keeps it honest from the outside: it submits an
  // empty string, a bare last-8, a full E.164 belonging to a real guest and a
  // string that is not a phone at all, and asserts none of them unlocks.
  return outcome as FailedUnlockOutcome;
}
