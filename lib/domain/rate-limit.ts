/**
 * Phone-gate rate limiting — pure.
 *
 * Both the attempt history and the current time are arguments (design decision
 * D2), so lockout windows are deterministic and testable with no fake timers,
 * and the domain never touches the clock or the database.
 *
 * Two scopes, because the first is trivially defeated by rotating source IPs:
 *
 * | Scope                  | Window | Failures | Lockout |
 * |------------------------|--------|----------|---------|
 * | (invitation, ip_hash)  | 15 min | 8        | 30 min  |
 * | invitation, all IPs    | 60 min | 30       | 60 min  |
 *
 * Only FAILURES count, so a guest who unlocks successfully and comes back later
 * is never punished for their own earlier typos.
 */

const MINUTE = 60_000;

export interface ScopeLimit {
  /** How far back failures are counted. */
  readonly windowMs: number;
  /** Failures within the window that trigger a lockout. */
  readonly threshold: number;
  /** How long the lockout lasts, measured from the triggering failure. */
  readonly lockoutMs: number;
}

export const IP_SCOPE: ScopeLimit = {
  windowMs: 15 * MINUTE,
  threshold: 8,
  lockoutMs: 30 * MINUTE,
};

export const INVITATION_SCOPE: ScopeLimit = {
  windowMs: 60 * MINUTE,
  threshold: 30,
  lockoutMs: 60 * MINUTE,
};

/** One row of `gate_attempts`. The raw IP is never present, only its HMAC. */
export interface GateAttempt {
  readonly ipHash: string;
  readonly succeeded: boolean;
  /** Epoch milliseconds. */
  readonly attemptedAt: number;
}

export interface GateContext {
  /** The HMAC of the requesting IP, for the narrower scope. */
  readonly ipHash: string;
  /** Recent attempts on this invitation, in any order. */
  readonly attempts: readonly GateAttempt[];
}

export type GateScope = "ip" | "invitation";

export type GateVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly scope: GateScope;
      readonly retryAfterMs: number;
    };

/**
 * When does the lockout triggered by these failures expire?
 *
 * Returns 0 when the threshold was never reached. Scanning newest-first, a
 * lockout starts at the failure that completed a run of `threshold` failures
 * inside one window, and lasts `lockoutMs` from that moment. The window and the
 * lockout are separate: failures aging out of the counting window do NOT release
 * a lockout they already triggered.
 */
function lockedUntil(
  failures: readonly number[],
  { windowMs, threshold, lockoutMs }: ScopeLimit,
): number {
  const newestFirst = [...failures].sort((a, b) => b - a);
  let expiry = 0;

  for (let i = 0; i + threshold - 1 < newestFirst.length; i += 1) {
    const newest = newestFirst[i];
    const oldest = newestFirst[i + threshold - 1];

    if (newest - oldest <= windowMs) {
      expiry = Math.max(expiry, newest + lockoutMs);
    }
  }

  return expiry;
}

/**
 * May this request attempt an unlock?
 *
 * When both scopes are locked the one expiring LAST is reported: telling a guest
 * to retry at a moment they would still be blocked is worse than telling them
 * nothing.
 */
export function evaluateGate(context: GateContext, now: number): GateVerdict {
  const failures = context.attempts.filter((attempt) => !attempt.succeeded);

  const candidates: ReadonlyArray<readonly [GateScope, number]> = [
    [
      "ip",
      lockedUntil(
        failures
          .filter((attempt) => attempt.ipHash === context.ipHash)
          .map((attempt) => attempt.attemptedAt),
        IP_SCOPE,
      ),
    ],
    [
      "invitation",
      lockedUntil(
        failures.map((attempt) => attempt.attemptedAt),
        INVITATION_SCOPE,
      ),
    ],
  ];

  let bindingScope: GateScope | null = null;
  let bindingExpiry = now;

  for (const [scope, expiry] of candidates) {
    if (expiry > bindingExpiry) {
      bindingScope = scope;
      bindingExpiry = expiry;
    }
  }

  if (bindingScope === null) {
    return { allowed: true };
  }

  return {
    allowed: false,
    scope: bindingScope,
    retryAfterMs: bindingExpiry - now,
  };
}
