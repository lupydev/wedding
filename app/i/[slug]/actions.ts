"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { GateFeedback } from "@/lib/domain/gate-copy";
import { toGatePhoneRefs } from "@/lib/server/invitations";
import { trustedClientIp } from "@/lib/server/client-ip";
import {
  UNLOCK_COOKIE_NAME,
  signUnlockCookie,
  unlockCookieOptions,
} from "@/lib/server/cookies";
import { decoyUnlockOutcome } from "@/lib/server/decoy-gate";
import {
  attemptUnlock,
  createGateAttemptsStore,
  hashClientIp,
  toGateFeedback,
} from "@/lib/server/gate";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import { loadInvitationRecord } from "./load-invitation";

/**
 * The ONE unlock path on the public route.
 *
 * There is no query parameter, no header, no token and no admin session that
 * reaches this code or produces an unlock cookie. `page.tsx` reads exactly one
 * piece of unlock state — the signed cookie — and this action is the only thing
 * that can ever mint one. That is the one-unlock-path invariant, and it is
 * tested rather than merely intended.
 *
 * The submitted phone number is read here, compared inside `lib/server/gate.ts`
 * and then dropped. It is never logged, never returned, never re-rendered into
 * the page and never stored.
 */

/**
 * The requesting address, hashed, as the rate limiter's bucket.
 *
 * The raw value is never stored or logged, and — the part that makes the
 * per-IP scope a lock rather than a decoration — it is never a value the client
 * chose. `lib/server/client-ip.ts` carries the reasoning and the citations.
 */
async function clientIpHash(): Promise<string> {
  return hashClientIp(trustedClientIp(await headers()));
}

/**
 * Attempts to unlock `slug` with the submitted phone number.
 *
 * The slug is BOUND on the server by `page.tsx`, not submitted by the form, so
 * a client cannot aim this action at a different household than the page it is
 * looking at.
 */
export async function unlockAction(
  slug: string,
  _previous: GateFeedback,
  formData: FormData,
): Promise<GateFeedback> {
  const rawPhone = String(formData.get("phone") ?? "");
  const record = await loadInvitationRecord(slug);
  const ipHash = await clientIpHash();
  const now = Date.now();

  if (record === null) {
    // Reaching this needs a forged action call: an unknown slug renders the
    // friendly contact page with no form. The decoy answers it with the same
    // counter, the same lockout and the same Spanish copy a real invitation
    // gives a wrong number, so a forged sequence learns nothing. See
    // `lib/server/decoy-gate.ts` for what it does and does not guarantee.
    return toGateFeedback(
      await decoyUnlockOutcome({ slug, rawPhone, ipHash, now }),
    );
  }

  const client = createServerSupabaseClient();
  const outcome = await attemptUnlock(createGateAttemptsStore(client), {
    invitationId: record.id,
    guests: toGatePhoneRefs(record),
    rawPhone,
    ipHash,
    now,
  });

  if (outcome.status !== "unlocked") {
    // The SAME mapping the decoy above goes through, deliberately: two
    // hand-written translations of the same outcome are how the values drifted
    // apart the first time.
    return toGateFeedback(outcome);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    UNLOCK_COOKIE_NAME,
    signUnlockCookie(record.id, now),
    unlockCookieOptions(slug),
  );

  // A redirect rather than relying on the action's own re-render: the guest
  // comes back with the cookie attached, so the page that renders the body is
  // an ordinary unlocked visit and follows exactly the same code path as every
  // later return visit. One path, tested once.
  redirect(`/i/${slug}`);
}
