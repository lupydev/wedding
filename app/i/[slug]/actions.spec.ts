import { beforeEach, describe, expect, it, vi } from "vitest";

import { GATE_GENERIC_FAILURE } from "@/lib/domain/gate-copy";
import { gateFeedbackMessages } from "@/lib/domain/gate-copy";
import { UNLOCK_COOKIE_NAME } from "@/lib/server/cookies";

/**
 * The route's Server Actions — specifically, the SEAMS between them.
 *
 * Every piece these actions compose is tested in isolation and tested well:
 * the real gate in `lib/server/gate.spec.ts`, the decoy in
 * `lib/server/decoy-gate.spec.ts`, the RSVP rules in `lib/server/rsvp.spec.ts`.
 * None of that says anything about the wiring. Two impeccable components and an
 * unexamined join is how an unknown slug ends up at the real gate — which would
 * hand back a database error instead of the decoy's counter, and turn the
 * existence oracle back on after all the work spent closing it.
 *
 * So what is asserted here is only what the actions themselves decide:
 *
 *  - an UNKNOWN slug goes to the decoy and never touches the database;
 *  - a KNOWN slug goes to the real gate and never touches the decoy;
 *  - both paths hand back byte-identical feedback for the same outcome;
 *  - the RSVP action projects the invitation the SERVER resolved from the slug,
 *    never anything the caller supplied, and refuses an unknown slug outright.
 */

const REDIRECTED = "NEXT_REDIRECT";

const cookieJar = {
  get: vi.fn<(name: string) => { value: string } | undefined>(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar,
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    // Next's `redirect` throws to unwind the render; the test needs the same
    // control flow, or code after a redirect would run here and nowhere else.
    throw new Error(`${REDIRECTED}:${url}`);
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/server/supabase", () => ({
  createServerSupabaseClient: () => ({ marker: "supabase-client" }),
}));

const loadInvitationRecord = vi.fn();
vi.mock("./load-invitation", () => ({
  loadInvitationRecord: (slug: string) => loadInvitationRecord(slug),
}));

const attemptUnlock = vi.fn();
vi.mock("@/lib/server/gate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/gate")>();

  return {
    ...actual,
    // The real `toGateFeedback` and `hashClientIp` stay: they are the mapping
    // whose sameness across both paths is the point of the seam assertion.
    createGateAttemptsStore: () => ({ marker: "attempts-store" }),
    attemptUnlock: (...args: unknown[]) => attemptUnlock(...args),
  };
});

const decoyUnlockOutcome = vi.fn();
vi.mock("@/lib/server/decoy-gate", () => ({
  decoyUnlockOutcome: (...args: unknown[]) => decoyUnlockOutcome(...args),
}));

const submitRsvp = vi.fn();
vi.mock("@/lib/server/rsvp", () => ({
  createRsvpStore: () => ({ marker: "rsvp-store" }),
  submitRsvp: (...args: unknown[]) => submitRsvp(...args),
}));

process.env.GATE_IP_PEPPER = "p".repeat(40);
process.env.UNLOCK_COOKIE_SECRET = "s".repeat(40);

const KNOWN_SLUG = "aaaaaaaaaaaaaaaa";
const UNKNOWN_SLUG = "zzzzzzzzzzzzzzzz";
const INVITATION_ID = "11111111-1111-4111-8111-111111111111";
const GUEST_ID = "aaaaaaaa-1111-4111-8111-111111111111";

const RECORD = {
  id: INVITATION_ID,
  slug: KNOWN_SLUG,
  ownerSenderId: "22222222-2222-4222-8222-222222222222",
  displayName: "Familia Aguirre",
  greetingName: "Familia Aguirre",
  rsvpDeadline: "2026-05-01",
  guests: [
    {
      id: GUEST_ID,
      fullName: "Camila Aguirre",
      phoneE164: "+573005551111",
      phoneLast8: "05551111",
      isPrimary: true,
      isChild: false,
    },
  ],
};

function phoneForm(value = "3005551111"): FormData {
  const data = new FormData();
  data.set("phone", value);

  return data;
}

function rsvpForm(): FormData {
  const data = new FormData();
  data.set("attending", "yes");
  data.append("attendee", GUEST_ID);

  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.get.mockReturnValue(undefined);
  loadInvitationRecord.mockResolvedValue(null);
});

describe("unlockAction routing", () => {
  it("sends an unknown slug to the decoy and never to the database", async () => {
    const { unlockAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(null);
    decoyUnlockOutcome.mockResolvedValue({
      status: "rejected",
      attemptsRemaining: 7,
    });

    const feedback = await unlockAction(
      UNKNOWN_SLUG,
      { status: "idle" },
      phoneForm(),
    );

    expect(decoyUnlockOutcome).toHaveBeenCalledTimes(1);
    expect(decoyUnlockOutcome.mock.calls[0][0]).toMatchObject({
      slug: UNKNOWN_SLUG,
      rawPhone: "3005551111",
    });
    expect(attemptUnlock).not.toHaveBeenCalled();
    expect(feedback).toEqual({ status: "rejected", attemptsRemaining: 7 });
  });

  it("sends a known slug to the real gate and never to the decoy", async () => {
    const { unlockAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    attemptUnlock.mockResolvedValue({
      status: "rejected",
      attemptsRemaining: 6,
    });

    const feedback = await unlockAction(
      KNOWN_SLUG,
      { status: "idle" },
      phoneForm(),
    );

    expect(attemptUnlock).toHaveBeenCalledTimes(1);
    expect(attemptUnlock.mock.calls[0][1]).toMatchObject({
      invitationId: INVITATION_ID,
      // Last-8 references only: the action must never hand the gate an E.164.
      guests: [{ phone_last8: "05551111" }],
      rawPhone: "3005551111",
    });
    expect(decoyUnlockOutcome).not.toHaveBeenCalled();
    expect(feedback).toEqual({ status: "rejected", attemptsRemaining: 6 });
  });

  it("answers both paths with the same words for the same outcome", async () => {
    // The reason the decoy exists at all. If the two routes ever produced
    // different copy for one outcome, the first forged call would reveal which
    // slugs are real — the exact leak the decoy was built to close.
    const { unlockAction } = await import("./actions");
    const outcome = { status: "locked", retryAfterMs: 12 * 60_000 };

    loadInvitationRecord.mockResolvedValue(null);
    decoyUnlockOutcome.mockResolvedValue(outcome);
    const decoyFeedback = await unlockAction(
      UNKNOWN_SLUG,
      { status: "idle" },
      phoneForm(),
    );

    loadInvitationRecord.mockResolvedValue(RECORD);
    attemptUnlock.mockResolvedValue(outcome);
    const realFeedback = await unlockAction(
      KNOWN_SLUG,
      { status: "idle" },
      phoneForm(),
    );

    expect(decoyFeedback).toEqual(realFeedback);
    expect(gateFeedbackMessages(decoyFeedback)).toEqual(
      gateFeedbackMessages(realFeedback),
    );
  });

  it("never echoes the submitted number back into the feedback", async () => {
    const { unlockAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    attemptUnlock.mockResolvedValue({
      status: "rejected",
      attemptsRemaining: 5,
    });

    const feedback = await unlockAction(
      KNOWN_SLUG,
      { status: "idle" },
      phoneForm("3009998888"),
    );

    expect(JSON.stringify(feedback)).not.toContain("3009998888");
    expect(gateFeedbackMessages(feedback)[0]).toBe(GATE_GENERIC_FAILURE);
  });

  it("mints the cookie and redirects only on a successful unlock", async () => {
    const { unlockAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    attemptUnlock.mockResolvedValue({ status: "unlocked" });

    await expect(
      unlockAction(KNOWN_SLUG, { status: "idle" }, phoneForm()),
    ).rejects.toThrow(`${REDIRECTED}:/i/${KNOWN_SLUG}`);

    expect(cookieJar.set).toHaveBeenCalledTimes(1);
    expect(cookieJar.set.mock.calls[0][0]).toBe(UNLOCK_COOKIE_NAME);
    expect(cookieJar.set.mock.calls[0][2]).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: `/i/${KNOWN_SLUG}`,
    });
  });

  it("mints no cookie when the gate rejects", async () => {
    const { unlockAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    attemptUnlock.mockResolvedValue({
      status: "rejected",
      attemptsRemaining: 4,
    });

    await unlockAction(KNOWN_SLUG, { status: "idle" }, phoneForm());

    expect(cookieJar.set).not.toHaveBeenCalled();
  });
});

describe("submitRsvpAction routing", () => {
  it("refuses an unknown slug without reaching the RSVP code at all", async () => {
    const { submitRsvpAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(null);

    const feedback = await submitRsvpAction(
      UNKNOWN_SLUG,
      { status: "idle" },
      rsvpForm(),
    );

    expect(feedback).toEqual({ status: "not_authorized" });
    expect(submitRsvp).not.toHaveBeenCalled();
  });

  it("passes the invitation the server resolved, not anything submitted", async () => {
    // The slug is bound on the server and the record is read from it, so the
    // household being answered for is never a client-supplied value. A payload
    // naming another invitation has nowhere to put that claim.
    const { submitRsvpAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    cookieJar.get.mockReturnValue({ value: "cookie-value" });
    submitRsvp.mockResolvedValue({ status: "recorded" });

    const formData = rsvpForm();
    formData.set("invitationId", "99999999-9999-4999-8999-999999999999");

    const feedback = await submitRsvpAction(
      KNOWN_SLUG,
      { status: "idle" },
      formData,
    );

    expect(feedback).toEqual({ status: "recorded" });
    expect(submitRsvp).toHaveBeenCalledTimes(1);

    const request = submitRsvp.mock.calls[0][1];

    expect(request.invitation).toEqual({
      id: INVITATION_ID,
      rsvpDeadline: "2026-05-01",
      guestIds: [GUEST_ID],
    });
    expect(request.unlockCookie).toBe("cookie-value");
    expect(request.now).toBeInstanceOf(Date);
  });

  it("treats a missing cookie as an empty one rather than crashing", async () => {
    const { submitRsvpAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    cookieJar.get.mockReturnValue(undefined);
    submitRsvp.mockResolvedValue({ status: "not_authorized" });

    const feedback = await submitRsvpAction(
      KNOWN_SLUG,
      { status: "idle" },
      rsvpForm(),
    );

    expect(submitRsvp.mock.calls[0][1].unlockCookie).toBe("");
    expect(feedback).toEqual({ status: "not_authorized" });
  });

  it("hands the outcome back to the form unchanged", async () => {
    const { submitRsvpAction } = await import("./actions");
    loadInvitationRecord.mockResolvedValue(RECORD);
    submitRsvp.mockResolvedValue({
      status: "rejected",
      reason: "seats_exceed_allowed",
    });

    await expect(
      submitRsvpAction(KNOWN_SLUG, { status: "idle" }, rsvpForm()),
    ).resolves.toEqual({
      status: "rejected",
      reason: "seats_exceed_allowed",
    });
  });
});
