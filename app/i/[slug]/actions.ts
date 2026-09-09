"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { GateFeedback } from "@/lib/domain/gate-copy";
import { toGatePhoneRefs } from "@/lib/server/invitations";
import {
  UNLOCK_COOKIE_NAME,
  signUnlockCookie,
  unlockCookieOptions,
} from "@/lib/server/cookies";
import {
  attemptUnlock,
  createGateAttemptsStore,
  hashClientIp,
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
 * The feedback a failed attempt against an unknown invitation produces.
 *
 * Reaching it requires forging an action call, since an unknown slug renders
 * the friendly contact page and no form. It exists so that even a forged call
 * cannot distinguish "no such invitation" from "wrong number": both come back
 * as the same generic rejection, with no attempt recorded because there is no
 * invitation to record it against.
 */
const UNKNOWN_INVITATION: GateFeedback = {
  status: "rejected",
  attemptsRemaining: 0,
};

/**
 * The requesting address, as the platform reports it.
 *
 * Only ever passed to `hashClientIp`; the raw value is never stored or logged.
 * A missing header yields a constant bucket rather than an error: on a platform
 * that does not forward one, every visitor shares a lockout scope, which is
 * conservative in the right direction.
 */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  if (forwarded) {
    // The left-most entry is the original client; the rest are proxies.
    return forwarded.split(",")[0].trim();
  }

  return headerList.get("x-real-ip")?.trim() || "unknown";
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

  if (record === null) {
    return UNKNOWN_INVITATION;
  }

  const client = createServerSupabaseClient();
  const outcome = await attemptUnlock(createGateAttemptsStore(client), {
    invitationId: record.id,
    guests: toGatePhoneRefs(record),
    rawPhone,
    ipHash: hashClientIp(await clientIp()),
    now: Date.now(),
  });

  if (outcome.status === "locked") {
    return { status: "locked", retryAfterMs: outcome.retryAfterMs };
  }

  if (outcome.status === "rejected") {
    return {
      status: "rejected",
      attemptsRemaining: outcome.attemptsRemaining,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    UNLOCK_COOKIE_NAME,
    signUnlockCookie(record.id, Date.now()),
    unlockCookieOptions(slug),
  );

  // A redirect rather than relying on the action's own re-render: the guest
  // comes back with the cookie attached, so the page that renders the body is
  // an ordinary unlocked visit and follows exactly the same code path as every
  // later return visit. One path, tested once.
  redirect(`/i/${slug}`);
}
