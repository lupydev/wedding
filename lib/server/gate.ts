import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GateFeedback } from "@/lib/domain/gate-copy";
import { matchesInvitation, type GuestPhoneRef } from "@/lib/domain/phone";
import {
  INVITATION_SCOPE,
  IP_SCOPE,
  evaluateGate,
  remainingAttempts,
  type GateAttempt,
} from "@/lib/domain/rate-limit";

import { gateIpPepper } from "./env";

/**
 * The phone gate adapter.
 *
 * Every decision here is made by a pure function that is already tested without
 * a database: `matchesInvitation` compares the last eight digits, `evaluateGate`
 * decides whether the request is locked out, and `remainingAttempts` says how
 * many tries are left. This module only supplies them with stored state and a
 * clock, and writes the outcome back.
 *
 * Two rules this file exists to enforce:
 *
 *  1. The submitted phone NEVER leaves this module — not into a log line, not
 *     into an error message, not into a returned value. Failures reach the
 *     guest as one generic outcome that cannot distinguish a wrong number from
 *     a guest with no phone on file from an invitation that does not exist.
 *  2. The lockout is consulted BEFORE any comparison, so a locked-out attacker
 *     cannot use a correct guess to learn anything or to get in.
 */

/**
 * The furthest back any scope counts, so one read serves both.
 *
 * Exported because `decoy-gate.ts` must prune its in-memory history on exactly
 * the same horizon; a decoy that remembered longer than the real gate would be
 * distinguishable by waiting.
 */
export const GATE_HISTORY_WINDOW_MS = Math.max(
  IP_SCOPE.windowMs,
  INVITATION_SCOPE.windowMs,
);

/**
 * Length of the stored `ip_hash`, in hex characters.
 *
 * Truncation is deliberate: 128 bits is far beyond what distinguishing visitors
 * requires, and a shorter stored value is a smaller amount of derived personal
 * data kept for longer than the attempt itself matters.
 */
const IP_HASH_LENGTH = 32;

/**
 * `HMAC-SHA256(GATE_IP_PEPPER, ip)`, truncated.
 *
 * A plain hash of an IPv4 address is not anonymization: the whole address space
 * is four billion values and a laptop enumerates it in seconds. The pepper is
 * what makes the stored value unrecoverable without the deployment secret, and
 * `lib/server/env.ts` refuses a pepper too short to serve as one.
 */
export function hashClientIp(ip: string): string {
  return createHmac("sha256", gateIpPepper())
    .update(ip)
    .digest("hex")
    .slice(0, IP_HASH_LENGTH);
}

export interface RecordedGateAttempt {
  readonly invitationId: string;
  readonly ipHash: string;
  readonly succeeded: boolean;
  /** Epoch milliseconds. Supplied by the caller (design decision D2). */
  readonly attemptedAt: number;
}

/**
 * The durable attempt log, as a port.
 *
 * A port rather than a direct Supabase call because the lockout arithmetic is
 * the part worth testing, and testing it through a mocked query builder would
 * be testing the mock. The real implementation is exercised end to end by
 * `e2e/phone-gate.spec.ts`.
 */
export interface GateAttemptsStore {
  recentAttempts(
    invitationId: string,
    since: number,
  ): Promise<readonly GateAttempt[]>;
  recordAttempt(attempt: RecordedGateAttempt): Promise<void>;
}

interface GateAttemptRow {
  ip_hash: string;
  succeeded: boolean;
  attempted_at: string;
}

/**
 * The `gate_attempts`-backed store.
 *
 * A table, not process memory: serverless instances share no memory, so an
 * in-memory counter would reset on every cold start and the lockout would be
 * defeated by nothing more than waiting a moment.
 */
export function createGateAttemptsStore(
  client: SupabaseClient,
): GateAttemptsStore {
  return {
    async recentAttempts(invitationId, since) {
      const { data, error } = await client
        .from("gate_attempts")
        .select("ip_hash, succeeded, attempted_at")
        .eq("invitation_id", invitationId)
        .gte("attempted_at", new Date(since).toISOString())
        .order("attempted_at", { ascending: false })
        .returns<GateAttemptRow[]>();

      if (error) {
        throw new Error(`Could not read gate attempts: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        ipHash: row.ip_hash,
        succeeded: row.succeeded,
        attemptedAt: Date.parse(row.attempted_at),
      }));
    },

    async recordAttempt(attempt) {
      const { error } = await client.from("gate_attempts").insert({
        invitation_id: attempt.invitationId,
        ip_hash: attempt.ipHash,
        succeeded: attempt.succeeded,
        attempted_at: new Date(attempt.attemptedAt).toISOString(),
      });

      if (error) {
        // The submitted phone is deliberately absent from this message: gate
        // errors reach logs, and a guest's number must never be in one.
        throw new Error(`Could not record a gate attempt: ${error.message}`);
      }
    },
  };
}

export interface UnlockRequest {
  readonly invitationId: string;
  /** Last-8 references only. The projection that produces these has no E.164. */
  readonly guests: readonly GuestPhoneRef[];
  readonly rawPhone: string;
  readonly ipHash: string;
  readonly now: number;
}

/**
 * The outcome of one unlock attempt.
 *
 * `rejected` carries no reason. There is exactly one failure shape, whether the
 * number was wrong, the guest has no phone on file, or the invitation does not
 * exist — otherwise a forwarded link becomes a phone-number checker for that
 * household, which is precisely the leak this gate is supposed to prevent.
 */
export type UnlockOutcome =
  | { readonly status: "unlocked" }
  | { readonly status: "rejected"; readonly attemptsRemaining: number }
  | { readonly status: "locked"; readonly retryAfterMs: number };

/** Every outcome that leaves the guest outside the gate. */
export type FailedUnlockOutcome = Exclude<
  UnlockOutcome,
  { readonly status: "unlocked" }
>;

/**
 * The failed outcome, as the feedback the form renders.
 *
 * One function rather than a mapping written out at each call site, because the
 * real gate and the unknown-invitation decoy in `decoy-gate.ts` must produce
 * byte-identical feedback. Two hand-written mappings drift; one cannot.
 */
export function toGateFeedback(outcome: FailedUnlockOutcome): GateFeedback {
  return outcome.status === "locked"
    ? { status: "locked", retryAfterMs: outcome.retryAfterMs }
    : { status: "rejected", attemptsRemaining: outcome.attemptsRemaining };
}

/**
 * Attempts to unlock one invitation with one submitted phone.
 *
 * Order matters and is the security property: read history, decide the lockout,
 * and only then compare digits. A locked request is answered without recording
 * a new failure, so a lockout cannot renew itself indefinitely against a guest
 * who keeps refreshing the page.
 */
export async function attemptUnlock(
  store: GateAttemptsStore,
  request: UnlockRequest,
): Promise<UnlockOutcome> {
  const { invitationId, guests, rawPhone, ipHash, now } = request;

  const attempts = await store.recentAttempts(
    invitationId,
    now - GATE_HISTORY_WINDOW_MS,
  );
  const context = { ipHash, attempts };
  const verdict = evaluateGate(context, now);

  if (!verdict.allowed) {
    return { status: "locked", retryAfterMs: verdict.retryAfterMs };
  }

  const succeeded = matchesInvitation(rawPhone, guests);

  await store.recordAttempt({
    invitationId,
    ipHash,
    succeeded,
    attemptedAt: now,
  });

  if (succeeded) {
    return { status: "unlocked" };
  }

  return {
    status: "rejected",
    attemptsRemaining: remainingAttempts(
      {
        ipHash,
        attempts: [...attempts, { ipHash, succeeded: false, attemptedAt: now }],
      },
      now,
    ),
  };
}
