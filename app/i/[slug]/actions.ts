"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { GateFeedback } from "@/lib/domain/gate-copy";
import type { RsvpFeedback } from "@/lib/domain/rsvp-copy";
import { createRsvpStore, submitRsvp } from "@/lib/server/rsvp";
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

/**
 * Records the household's RSVP.
 *
 * The slug is BOUND on the server by `page.tsx`, exactly as it is for the
 * unlock, and the invitation is read from it here. Nothing the caller submits
 * names a household: a payload carrying an `invitationId` has nowhere to put
 * that claim, because this action never reads one.
 *
 * The write goes through `lib/server/rsvp.ts` rather than a client-side
 * Supabase insert. The browser holds no Supabase client for guest data at all,
 * and an `anon` INSERT policy keyed on a slug the caller already holds would be
 * an unauthenticated write endpoint, not authorization.
 */
export async function submitRsvpAction(
  slug: string,
  _previous: RsvpFeedback,
  formData: FormData,
): Promise<RsvpFeedback> {
  const record = await loadInvitationRecord(slug);

  if (record === null) {
    // An unknown slug renders the friendly contact page with no form, so
    // reaching this needs a forged action call. Unlike the gate, there is no
    // oracle to protect here — the caller is not asking whether the slug
    // exists, they are asking to write against it, and both answers are "no".
    return { status: "not_authorized" };
  }

  const outcome = await submitRsvp(
    createRsvpStore(createServerSupabaseClient()),
    {
      invitation: {
        id: record.id,
        // Every guest named on this invitation, and nobody else. The array
        // column `attendee_guest_ids` is not a foreign key, so this list is the
        // only thing standing between a forged payload and a stranger being
        // seated with this household.
        guestIds: record.guests.map((guest) => guest.id),
      },
      unlockCookie: (await cookies()).get(UNLOCK_COOKIE_NAME)?.value ?? "",
      formData,
      now: new Date(),
    },
  );

  if (outcome.status === "recorded") {
    // So the page re-reads the household's CURRENT answer. Without this the
    // guest sees their old answer echoed back beside the confirmation that the
    // new one was saved, which reads as the save having failed.
    revalidatePath(`/i/${slug}`);
  }

  return outcome;
}
