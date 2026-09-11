import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The console Server Actions — specifically, the GUARDS in front of the writes.
 *
 * These four checks were written and reviewed and then never proved. That is a
 * real gap and not a bookkeeping one: `markDispatchSentAction` is the only thing
 * in this product that can assert a message was sent, and the invitation id it
 * acts on arrives in a hidden form field, which is a value the browser holds.
 * Everything standing between that field and a row in an append-only audit table
 * is the code in this file.
 *
 * What is asserted here is only what the actions themselves decide:
 *
 *  - the acting identity comes from the verified session and never from the form;
 *  - ownership is resolved SERVER-side from the submitted id, and a mismatch
 *    refuses before anything is written;
 *  - ownership is applied as part of the lookup rather than compared afterwards,
 *    so the other operator's household is never read into memory at all;
 *  - a device-declaration mismatch blocks BOTH confirmations, because they
 *    record a dispatch, which is the exact thing that gate exists to stop;
 *  - and it blocks NEITHER the phone editor, because editing a number sends
 *    nothing, and the preflight sends the operator to fix that data precisely
 *    when they may be on the other handset.
 *
 * The repository functions these compose are tested against a real database in
 * `lib/server/invitations.spec.ts` and `lib/server/dispatch.spec.ts`. Two
 * impeccable halves and an unexamined join is how a guard gets removed by a
 * refactor and nothing turns red.
 */

const requireOperator = vi.fn();
const readDeviceDeclaration = vi.fn();
vi.mock("@/lib/server/console-session", () => ({
  requireOperator: () => requireOperator(),
  readDeviceDeclaration: (senderId: string) => readDeviceDeclaration(senderId),
}));

const markSent = vi.fn();
const markFailed = vi.fn();
vi.mock("@/lib/server/dispatch", () => ({
  markSent: (...args: unknown[]) => markSent(...args),
  markFailed: (...args: unknown[]) => markFailed(...args),
}));

const findConsoleInvitation = vi.fn();
const findGuestInvitationOwner = vi.fn();
const updateGuestPhone = vi.fn();
vi.mock("@/lib/server/invitations", () => ({
  findConsoleInvitation: (...args: unknown[]) => findConsoleInvitation(...args),
  findGuestInvitationOwner: (...args: unknown[]) =>
    findGuestInvitationOwner(...args),
  updateGuestPhone: (...args: unknown[]) => updateGuestPhone(...args),
}));

vi.mock("@/lib/server/supabase", () => ({
  createServerSupabaseClient: () => ({ marker: "supabase-client" }),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

process.env.DEFAULT_PHONE_COUNTRY = "CO";

const {
  markDispatchFailedAction,
  markDispatchSentAction,
  updateGuestPhoneAction,
} = await import("./actions");

const ANA = { id: "aaaaaaaa-1111-4111-8111-111111111111", displayName: "Ana" };
const BETO_GUEST_ID = "dddddddd-4444-4444-8444-444444444444";
const INVITATION_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const GUEST_ID = "cccccccc-3333-4333-8333-333333333333";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOperator.mockResolvedValue(ANA);
  readDeviceDeclaration.mockResolvedValue({
    status: "match",
    declaredSenderId: ANA.id,
  });
  findConsoleInvitation.mockResolvedValue({
    invitationId: INVITATION_ID,
    greetingName: "Familia Muñóz",
  });
  findGuestInvitationOwner.mockResolvedValue(ANA.id);
  markSent.mockResolvedValue(undefined);
  markFailed.mockResolvedValue(undefined);
  updateGuestPhone.mockResolvedValue(undefined);
});

describe("markDispatchSentAction — the four checks", () => {
  it("records the send for an owned invitation on a matching device", async () => {
    await markDispatchSentAction(form({ invitationId: INVITATION_ID }));

    expect(markSent).toHaveBeenCalledTimes(1);
    expect(markSent.mock.calls[0][1]).toEqual({
      actorSenderId: ANA.id,
      invitationId: INVITATION_ID,
    });
  });

  it("attributes the send to the SESSION, ignoring an actor named in the form", async () => {
    await markDispatchSentAction(
      form({
        invitationId: INVITATION_ID,
        actorSenderId: BETO_GUEST_ID,
      }),
    );

    expect(markSent.mock.calls[0][1]).toMatchObject({
      actorSenderId: ANA.id,
    });
  });

  it("resolves ownership through the lookup itself, scoped to the session", async () => {
    // Applied as part of the query, not compared after it. A fetch-then-compare
    // would already have read the other operator's household into memory before
    // deciding it should not have.
    await markDispatchSentAction(form({ invitationId: INVITATION_ID }));

    expect(findConsoleInvitation.mock.calls[0][1]).toMatchObject({
      invitationId: INVITATION_ID,
      viewerSenderId: ANA.id,
    });
  });

  it("refuses an invitation the session does not own, and writes nothing", async () => {
    // `findConsoleInvitation` applies ownership as a WHERE, so "not yours" and
    // "does not exist" are the same null — and the same refusal.
    findConsoleInvitation.mockResolvedValue(null);

    await expect(
      markDispatchSentAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow(/no existe o la gestiona la otra cuenta/i);

    expect(markSent).not.toHaveBeenCalled();
  });

  it("refuses a missing invitation id and writes nothing", async () => {
    await expect(markDispatchSentAction(form({}))).rejects.toThrow(
      /no se indicó/i,
    );

    expect(findConsoleInvitation).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });

  it("refuses a blank invitation id and writes nothing", async () => {
    await expect(
      markDispatchSentAction(form({ invitationId: "   " })),
    ).rejects.toThrow(/no se indicó/i);

    expect(markSent).not.toHaveBeenCalled();
  });

  it("refuses when the declared WhatsApp account does not match the session", async () => {
    // These actions record a dispatch, which is the exact thing the declaration
    // gate exists to stop. Refused at the server, not merely hidden in markup.
    readDeviceDeclaration.mockResolvedValue({
      status: "mismatch",
      declaredSenderId: "eeeeeeee-5555-4555-8555-555555555555",
    });

    await expect(
      markDispatchSentAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow(/no coincide con la sesión/i);

    expect(findConsoleInvitation).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });

  it("refuses when this device has declared no WhatsApp account at all", async () => {
    readDeviceDeclaration.mockResolvedValue({
      status: "undeclared",
      declaredSenderId: null,
    });

    await expect(
      markDispatchSentAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow();

    expect(markSent).not.toHaveBeenCalled();
  });

  it("refreshes both the dashboard and the compose view after a send", async () => {
    await markDispatchSentAction(form({ invitationId: INVITATION_ID }));

    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toContain("/console");
    expect(paths).toContain(`/console/dispatch/${INVITATION_ID}`);
  });
});

describe("markDispatchFailedAction — the same four checks", () => {
  it("records the failure for an owned invitation on a matching device", async () => {
    await markDispatchFailedAction(form({ invitationId: INVITATION_ID }));

    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(markFailed.mock.calls[0][1]).toEqual({
      actorSenderId: ANA.id,
      invitationId: INVITATION_ID,
    });
  });

  it("refuses an invitation the session does not own, and writes nothing", async () => {
    findConsoleInvitation.mockResolvedValue(null);

    await expect(
      markDispatchFailedAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow();

    expect(markFailed).not.toHaveBeenCalled();
  });

  it("refuses on a device-declaration mismatch, and writes nothing", async () => {
    readDeviceDeclaration.mockResolvedValue({
      status: "mismatch",
      declaredSenderId: "eeeeeeee-5555-4555-8555-555555555555",
    });

    await expect(
      markDispatchFailedAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow(/no coincide con la sesión/i);

    expect(markFailed).not.toHaveBeenCalled();
  });

  it("never records a send when asked to record a failure", async () => {
    await markDispatchFailedAction(form({ invitationId: INVITATION_ID }));

    expect(markSent).not.toHaveBeenCalled();
  });
});

describe("updateGuestPhoneAction — ownership without the declaration gate", () => {
  it("stores the number for a guest the session's operator owns", async () => {
    await updateGuestPhoneAction(
      form({ guestId: GUEST_ID, phone: "3001234567" }),
    );

    expect(updateGuestPhone).toHaveBeenCalledTimes(1);
    expect(updateGuestPhone.mock.calls[0].slice(1, 4)).toEqual([
      GUEST_ID,
      "3001234567",
      "CO",
    ]);
  });

  it("resolves the guest's owner on the SERVER from the submitted id", async () => {
    await updateGuestPhoneAction(
      form({ guestId: GUEST_ID, phone: "3001234567" }),
    );

    expect(findGuestInvitationOwner.mock.calls[0][1]).toBe(GUEST_ID);
  });

  it("refuses a guest belonging to the other operator, and writes nothing", async () => {
    findGuestInvitationOwner.mockResolvedValue(
      "eeeeeeee-5555-4555-8555-555555555555",
    );

    await expect(
      updateGuestPhoneAction(form({ guestId: GUEST_ID, phone: "3001234567" })),
    ).rejects.toThrow(/gestiona la otra cuenta/i);

    expect(updateGuestPhone).not.toHaveBeenCalled();
  });

  it("refuses a guest that belongs to no invitation at all", async () => {
    findGuestInvitationOwner.mockResolvedValue(null);

    await expect(
      updateGuestPhoneAction(form({ guestId: GUEST_ID, phone: "3001234567" })),
    ).rejects.toThrow();

    expect(updateGuestPhone).not.toHaveBeenCalled();
  });

  it("refuses a missing guest id and writes nothing", async () => {
    await expect(
      updateGuestPhoneAction(form({ phone: "3001234567" })),
    ).rejects.toThrow(/no se indicó/i);

    expect(findGuestInvitationOwner).not.toHaveBeenCalled();
    expect(updateGuestPhone).not.toHaveBeenCalled();
  });

  it("still stores the number on a MISMATCHED device", async () => {
    // Deliberate, and the opposite of the dispatch actions above. Correcting a
    // typo in a phone number sends nothing, from any account. Gated on the
    // declaration, being on the wrong handset would prevent fixing exactly the
    // data the send preflight tells the operator to go and fix.
    readDeviceDeclaration.mockResolvedValue({
      status: "mismatch",
      declaredSenderId: "eeeeeeee-5555-4555-8555-555555555555",
    });

    await updateGuestPhoneAction(
      form({ guestId: GUEST_ID, phone: "3001234567" }),
    );

    expect(updateGuestPhone).toHaveBeenCalledTimes(1);
  });

  it("does not even read the device declaration", async () => {
    await updateGuestPhoneAction(
      form({ guestId: GUEST_ID, phone: "3001234567" }),
    );

    expect(readDeviceDeclaration).not.toHaveBeenCalled();
  });

  it("passes an empty submission through, so a number can be cleared", async () => {
    // `updateGuestPhone` stores NULL rather than `''`: `phone_last8` is
    // `nullif(right(...), '')`, and a stored empty string would make an empty
    // gate submission match the guest.
    await updateGuestPhoneAction(form({ guestId: GUEST_ID, phone: "" }));

    expect(updateGuestPhone.mock.calls[0][2]).toBe("");
  });
});
