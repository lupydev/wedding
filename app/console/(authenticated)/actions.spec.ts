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
const listConsoleInvitations = vi.fn();
const createInvitation = vi.fn();
const updateInvitation = vi.fn();
const addMember = vi.fn();
const editMember = vi.fn();
const removeMember = vi.fn();
const moveMemberToInvitation = vi.fn();
const chooseRecipient = vi.fn();
const deleteInvitation = vi.fn();
const rotateInvitationSlug = vi.fn();
vi.mock("@/lib/server/invitations", () => ({
  findConsoleInvitation: (...args: unknown[]) => findConsoleInvitation(...args),
  findGuestInvitationOwner: (...args: unknown[]) =>
    findGuestInvitationOwner(...args),
  updateGuestPhone: (...args: unknown[]) => updateGuestPhone(...args),
  listConsoleInvitations: (...args: unknown[]) =>
    listConsoleInvitations(...args),
  createInvitation: (...args: unknown[]) => createInvitation(...args),
  updateInvitation: (...args: unknown[]) => updateInvitation(...args),
  addMember: (...args: unknown[]) => addMember(...args),
  editMember: (...args: unknown[]) => editMember(...args),
  removeMember: (...args: unknown[]) => removeMember(...args),
  moveMemberToInvitation: (...args: unknown[]) =>
    moveMemberToInvitation(...args),
  chooseRecipient: (...args: unknown[]) => chooseRecipient(...args),
  deleteInvitation: (...args: unknown[]) => deleteInvitation(...args),
  rotateInvitationSlug: (...args: unknown[]) => rotateInvitationSlug(...args),
}));

const getCurrentRsvp = vi.fn();
vi.mock("@/lib/server/rsvp", () => ({
  getCurrentRsvp: (...args: unknown[]) => getCurrentRsvp(...args),
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
  addMemberAction,
  chooseRecipientAction,
  createInvitationAction,
  deleteInvitationAction,
  editMemberAction,
  markDispatchFailedAction,
  markDispatchSentAction,
  moveMemberAction,
  removeMemberAction,
  rotateSlugAction,
  updateGuestPhoneAction,
  updateInvitationAction,
} = await import("./actions");

const ANA = { id: "aaaaaaaa-1111-4111-8111-111111111111", displayName: "Ana" };
const BETO = {
  id: "eeeeeeee-5555-4555-8555-555555555555",
  displayName: "Beto",
};
const BETO_GUEST_ID = "dddddddd-4444-4444-8444-444444444444";
const INVITATION_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const OTHER_INVITATION_ID = "ffffffff-6666-4666-8666-666666666666";
const GUEST_ID = "cccccccc-3333-4333-8333-333333333333";
const SECOND_GUEST_ID = "99999999-7777-4777-8777-777777777777";
const STRANGER_GUEST_ID = "88888888-8888-4888-8888-888888888888";

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
  // Invitation X, owned by ANA, with two members. Every administration test
  // below acts on it while the SESSION is BETO.
  listConsoleInvitations.mockResolvedValue([
    {
      invitationId: INVITATION_ID,
      ownerSenderId: ANA.id,
      dispatchRecipientGuestId: null,
      guests: [{ id: GUEST_ID }, { id: SECOND_GUEST_ID }],
    },
  ]);
  getCurrentRsvp.mockResolvedValue(null);
  createInvitation.mockResolvedValue({
    id: INVITATION_ID,
    slug: "aaaaaaaaaaaaaaaa",
  });
  updateInvitation.mockResolvedValue(undefined);
  // The three membership writes ANSWER now, so their defaults are the shape a
  // permitted write returns: no refusals. `addMember` also hands back the row it
  // created, because it is the only one of the three that mints an id.
  addMember.mockResolvedValue({ refusals: [], guest: { id: GUEST_ID } });
  editMember.mockResolvedValue([]);
  removeMember.mockResolvedValue([]);
  moveMemberToInvitation.mockResolvedValue(undefined);
  chooseRecipient.mockResolvedValue(undefined);
  // A permitted deletion ANSWERS, like every other write that can be refused.
  deleteInvitation.mockResolvedValue({ ok: true });
  rotateInvitationSlug.mockResolvedValue("zzzzzzzzzzzzzzzz");
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

/**
 * Confirmed decision 4: ownership no longer gates a console WRITE.
 *
 * Administration carries no send risk. The couple are two people sharing one
 * guest list, and an operator who cannot fix a typo in the other's household
 * either waits for them or asks them to do it — which is how a guest list ends
 * up maintained outside the tool. What ownership still decides is DISPATCH,
 * because a message leaves from whichever WhatsApp account is installed on the
 * handset and `wa.me` has no sender parameter to correct that.
 *
 * Removing an authorization check is exactly the kind of change that looks
 * fine and is not, so the proof here is not "no error was thrown". The SESSION
 * is BETO throughout and every invitation acted on is owned by ANA, the write
 * is asserted to have actually been issued with the submitted values, and the
 * owner-scoped lookup is asserted NEVER to have been consulted. "No ownership
 * check" is still not "no auth check": the session requirement is proved
 * separately, for every one of these actions.
 */
describe("console writes are not owner-scoped (confirmed decision 4)", () => {
  beforeEach(() => {
    requireOperator.mockResolvedValue(BETO);
    // The owner-scoped lookup answers NULL for BETO on ANA's invitation,
    // because that is the truth: it applies `owner_sender_id = viewer` as a
    // WHERE. Any action below that consulted it would therefore refuse, and
    // every assertion in this block would fail. That is the point — the tests
    // cannot pass by accident while an ownership check is still in place.
    findConsoleInvitation.mockResolvedValue(null);
  });

  it("lets the non-owning operator create an invitation", async () => {
    await createInvitationAction(
      form({
        displayName: "Familia Restrepo",
        greetingName: "Familia Restrepo",
        greetingNameSource: "derived",
        memberFullName: "Ana Restrepo",
        memberNickname: "",
        memberPhone: "3001234567",
      }),
    );

    expect(createInvitation).toHaveBeenCalledTimes(1);
    expect(createInvitation.mock.calls[0][1]).toMatchObject({
      ownerSenderId: BETO.id,
      displayName: "Familia Restrepo",
      greetingNameSource: "derived",
      guests: [
        {
          fullName: "Ana Restrepo",
          nickname: null,
          phoneE164: "+573001234567",
          isChild: false,
        },
      ],
    });
  });

  it("lets the non-owning operator edit an invitation ANA owns", async () => {
    await updateInvitationAction(
      form({
        invitationId: INVITATION_ID,
        displayName: "Familia Restrepo Gómez",
        greetingName: "Los Restrepo",
        greetingNameSource: "custom",
      }),
    );

    expect(updateInvitation).toHaveBeenCalledTimes(1);
    expect(updateInvitation.mock.calls[0].slice(1)).toEqual([
      INVITATION_ID,
      {
        displayName: "Familia Restrepo Gómez",
        greetingName: "Los Restrepo",
        greetingNameSource: "custom",
      },
    ]);
  });

  it("lets the non-owning operator add a member to ANA's invitation", async () => {
    await addMemberAction(
      form({
        invitationId: INVITATION_ID,
        fullName: "Luis Restrepo",
        nickname: "Lucho",
        phone: "3009876543",
        isChild: "on",
      }),
    );

    expect(addMember.mock.calls[0].slice(1)).toEqual([
      INVITATION_ID,
      {
        fullName: "Luis Restrepo",
        nickname: "Lucho",
        phoneE164: "+573009876543",
        isChild: true,
      },
    ]);
  });

  it("lets the non-owning operator edit a member of ANA's invitation", async () => {
    await editMemberAction(
      form({
        invitationId: INVITATION_ID,
        guestId: GUEST_ID,
        fullName: "Ana María Restrepo",
        nickname: "",
        phone: "",
      }),
    );

    expect(editMember.mock.calls[0].slice(1)).toEqual([
      INVITATION_ID,
      GUEST_ID,
      {
        fullName: "Ana María Restrepo",
        nickname: null,
        phoneE164: null,
        isChild: false,
      },
    ]);
  });

  it("lets the non-owning operator remove a member of ANA's invitation", async () => {
    await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );

    expect(removeMember.mock.calls[0].slice(1)).toEqual([
      INVITATION_ID,
      GUEST_ID,
    ]);
  });

  it("lets the non-owning operator move a member out of ANA's invitation", async () => {
    await moveMemberAction(
      form({
        invitationId: INVITATION_ID,
        destinationInvitationId: OTHER_INVITATION_ID,
        guestId: GUEST_ID,
      }),
    );

    expect(moveMemberToInvitation.mock.calls[0][1]).toEqual({
      sourceInvitationId: INVITATION_ID,
      destinationInvitationId: OTHER_INVITATION_ID,
      memberId: GUEST_ID,
      sourceMemberIds: [GUEST_ID, SECOND_GUEST_ID],
      sourceRecipientGuestId: null,
    });
  });

  it("lets the non-owning operator choose the recipient of ANA's invitation", async () => {
    await chooseRecipientAction(
      form({ invitationId: INVITATION_ID, guestId: SECOND_GUEST_ID }),
    );

    expect(chooseRecipient.mock.calls[0].slice(1)).toEqual([
      INVITATION_ID,
      SECOND_GUEST_ID,
    ]);
  });

  it("lets the non-owning operator delete ANA's invitation", async () => {
    await deleteInvitationAction(form({ invitationId: INVITATION_ID }));

    expect(deleteInvitation.mock.calls[0][1]).toBe(INVITATION_ID);
  });

  it("lets the non-owning operator rotate ANA's slug", async () => {
    const slug = await rotateSlugAction(form({ invitationId: INVITATION_ID }));

    expect(rotateInvitationSlug.mock.calls[0][1]).toBe(INVITATION_ID);
    expect(slug).toBe("zzzzzzzzzzzzzzzz");
  });

  it("never consults the owner-scoped lookup on any administration write", async () => {
    // `findConsoleInvitation` applies `owner_sender_id = viewer` as a WHERE. A
    // console write that called it would be owner-scoped whatever this file's
    // other assertions said, so its absence is asserted directly.
    await addMemberAction(
      form({ invitationId: INVITATION_ID, fullName: "Luis", phone: "" }),
    );
    await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );
    await deleteInvitationAction(form({ invitationId: INVITATION_ID }));

    expect(findConsoleInvitation).not.toHaveBeenCalled();
  });

  it("reads the invitation WITHOUT the owner partition when it needs its members", async () => {
    await moveMemberAction(
      form({
        invitationId: INVITATION_ID,
        destinationInvitationId: OTHER_INVITATION_ID,
        guestId: GUEST_ID,
      }),
    );

    expect(listConsoleInvitations.mock.calls[0][1]).toMatchObject({
      invitationId: INVITATION_ID,
      ownedOnly: false,
    });
  });

  it("does not read the device declaration for an administration write", async () => {
    // The declaration gates a SEND. Nothing here sends anything, and gating
    // data entry on it is the mistake the phone editor already documents.
    await editMemberAction(
      form({
        invitationId: INVITATION_ID,
        guestId: GUEST_ID,
        fullName: "Ana",
      }),
    );

    expect(readDeviceDeclaration).not.toHaveBeenCalled();
  });
});

describe("every administration write still requires an operator session", () => {
  const writes: readonly [string, () => Promise<unknown>][] = [
    [
      "createInvitationAction",
      () =>
        createInvitationAction(
          form({
            displayName: "X",
            greetingName: "X",
            memberFullName: "Ana",
            memberPhone: "",
          }),
        ),
    ],
    [
      "updateInvitationAction",
      () =>
        updateInvitationAction(
          form({
            invitationId: INVITATION_ID,
            displayName: "X",
            greetingName: "X",
          }),
        ),
    ],
    [
      "addMemberAction",
      () =>
        addMemberAction(
          form({ invitationId: INVITATION_ID, fullName: "Ana", phone: "" }),
        ),
    ],
    [
      "editMemberAction",
      () =>
        editMemberAction(
          form({
            invitationId: INVITATION_ID,
            guestId: GUEST_ID,
            fullName: "Ana",
          }),
        ),
    ],
    [
      "removeMemberAction",
      () =>
        removeMemberAction(
          form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
        ),
    ],
    [
      "moveMemberAction",
      () =>
        moveMemberAction(
          form({
            invitationId: INVITATION_ID,
            destinationInvitationId: OTHER_INVITATION_ID,
            guestId: GUEST_ID,
          }),
        ),
    ],
    [
      "chooseRecipientAction",
      () =>
        chooseRecipientAction(
          form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
        ),
    ],
    [
      "deleteInvitationAction",
      () => deleteInvitationAction(form({ invitationId: INVITATION_ID })),
    ],
    [
      "rotateSlugAction",
      () => rotateSlugAction(form({ invitationId: INVITATION_ID })),
    ],
  ];

  it("covers every action this slice adds", () => {
    // Guards the loop below against becoming a ghost: an action dropped from
    // this table would otherwise silently stop being checked.
    expect(writes.map(([name]) => name)).toHaveLength(9);
  });

  it.each(writes)(
    "refuses %s with no session, and writes nothing",
    async (_name, invoke) => {
      requireOperator.mockRejectedValue(
        new Error("No hay sesión de operador."),
      );

      await expect(invoke()).rejects.toThrow(/sesión de operador/i);

      for (const write of [
        createInvitation,
        updateInvitation,
        addMember,
        editMember,
        removeMember,
        moveMemberToInvitation,
        chooseRecipient,
        deleteInvitation,
        rotateInvitationSlug,
      ]) {
        expect(write).not.toHaveBeenCalled();
      }
    },
  );
});

describe("dispatch is still owner-scoped and still device-gated", () => {
  // The half of confirmed decision 4 that did NOT change. If administration's
  // relaxation ever leaks into these two actions, this is what turns red.
  beforeEach(() => {
    requireOperator.mockResolvedValue(BETO);
  });

  it("refuses BETO's send on an invitation ANA owns", async () => {
    findConsoleInvitation.mockResolvedValue(null);

    await expect(
      markDispatchSentAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow(/la gestiona la otra cuenta/i);

    expect(markSent).not.toHaveBeenCalled();
  });

  it("refuses BETO's failure record on an invitation ANA owns", async () => {
    findConsoleInvitation.mockResolvedValue(null);

    await expect(
      markDispatchFailedAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow(/la gestiona la otra cuenta/i);

    expect(markFailed).not.toHaveBeenCalled();
  });

  it("still applies the per-device WhatsApp gate to BETO", async () => {
    readDeviceDeclaration.mockResolvedValue({
      status: "mismatch",
      declaredSenderId: ANA.id,
    });

    await expect(
      markDispatchSentAction(form({ invitationId: INVITATION_ID })),
    ).rejects.toThrow(/no coincide con la sesión/i);

    expect(findConsoleInvitation).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });
});

describe("moveMemberAction — the advisory a move owes, exactly as a removal does", () => {
  // A MOVE IS A REMOVAL FROM THE SOURCE.
  //
  // The spec states the requirement for BOTH operations: a member named in a
  // confirmed answer may be removed OR MOVED, and either way the resulting
  // inconsistency must be reported visibly. `removeMemberAction` implemented it;
  // the move half returned void and read no answer at all, so moving Fer out of
  // a household that had already confirmed him left the seat count wrong with
  // nothing anywhere saying so. Slice 4b only RENDERS what this produces, so a
  // move produced nothing to render.
  it("reports the contradicted answer the move leaves behind in the source", async () => {
    getCurrentRsvp.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      attending: true,
      seatsConfirmed: 2,
      attendeeGuestIds: [GUEST_ID, SECOND_GUEST_ID],
    });

    const impact = await moveMemberAction(
      form({
        invitationId: INVITATION_ID,
        guestId: GUEST_ID,
        destinationInvitationId: OTHER_INVITATION_ID,
      }),
    );

    expect(moveMemberToInvitation).toHaveBeenCalledTimes(1);
    expect(impact).toEqual({
      removedGuestIds: [GUEST_ID],
      contradictedAnswers: [
        {
          rsvpResponseId: "11111111-1111-4111-8111-111111111111",
          seatsConfirmed: 2,
          danglingGuestIds: [GUEST_ID],
        },
      ],
      seatsConfirmedExceedsMembers: true,
    });
  });

  it("reports nothing to act on when the source's answer never named the moved member", async () => {
    // The permitting counterpart in the same block: a report that always
    // reports is as useless as one that never does.
    getCurrentRsvp.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      attending: true,
      seatsConfirmed: 1,
      attendeeGuestIds: [SECOND_GUEST_ID],
    });

    const impact = await moveMemberAction(
      form({
        invitationId: INVITATION_ID,
        guestId: GUEST_ID,
        destinationInvitationId: OTHER_INVITATION_ID,
      }),
    );

    expect(impact.contradictedAnswers).toEqual([]);
    expect(impact.seatsConfirmedExceedsMembers).toBe(false);
  });
});

describe("removeMemberAction — the advisory it hands back", () => {
  it("reports the contradicted answer instead of refusing the removal", async () => {
    // "Fer already said yes, but now he cannot come — take him off" is the
    // couple's real workflow. The removal happens; what it broke is REPORTED.
    getCurrentRsvp.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      attending: true,
      seatsConfirmed: 2,
      attendeeGuestIds: [GUEST_ID, SECOND_GUEST_ID],
    });

    const { impact } = await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );

    expect(removeMember).toHaveBeenCalledTimes(1);
    expect(impact).toEqual({
      removedGuestIds: [GUEST_ID],
      contradictedAnswers: [
        {
          rsvpResponseId: "11111111-1111-4111-8111-111111111111",
          seatsConfirmed: 2,
          danglingGuestIds: [GUEST_ID],
        },
      ],
      seatsConfirmedExceedsMembers: true,
    });
  });

  it("reports nothing to act on when the answer never named the removed member", async () => {
    getCurrentRsvp.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      attending: true,
      seatsConfirmed: 1,
      attendeeGuestIds: [SECOND_GUEST_ID],
    });

    const { impact } = await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );

    expect(impact?.contradictedAnswers).toEqual([]);
    expect(impact?.seatsConfirmedExceedsMembers).toBe(false);
    expect(impact?.removedGuestIds).toEqual([GUEST_ID]);
  });

  it("reads the members BEFORE the removal, so the impact can name who left", async () => {
    const order: string[] = [];
    listConsoleInvitations.mockImplementation(async () => {
      order.push("read");
      return [
        {
          invitationId: INVITATION_ID,
          ownerSenderId: ANA.id,
          dispatchRecipientGuestId: null,
          guests: [{ id: GUEST_ID }, { id: SECOND_GUEST_ID }],
        },
      ];
    });
    removeMember.mockImplementation(async () => {
      order.push("remove");

      // The permitted answer. `removeMember` returns the refusals now, so a
      // stand-in that returned nothing would be asserting the OLD contract.
      return [];
    });

    await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );

    expect(order).toEqual(["read", "remove"]);
  });
});

describe("the three member writes answer with the refusal instead of throwing prose", () => {
  // THE SAME CHANNEL `chooseRecipientAction` ALREADY USES, FOR THE OTHER THREE.
  //
  // A thrown refusal is replaced by an opaque `digest` in production expressly
  // to keep server text out of the browser, so the operator was shown "revisá la
  // conexión" for a rule that refuses identically on every retry. The CODE
  // travels and the console owns the copy.
  //
  // AND `revalidatePath` MUST NOT RUN ON A REFUSAL. A throw skipped it for free;
  // a return has to mean it on purpose, and re-seeding the form over a refused
  // write would throw away whatever the operator is still typing.
  it("hands back addMemberAction's refusal and revalidates nothing", async () => {
    addMember.mockResolvedValue({
      refusals: ["member_without_name"],
      guest: null,
    });

    const refusals = await addMemberAction(
      form({ invitationId: INVITATION_ID, fullName: "Ana", phone: "" }),
    );

    expect(refusals).toEqual(["member_without_name"]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hands back editMemberAction's refusal and revalidates nothing", async () => {
    editMember.mockResolvedValue(["member_without_name"]);

    const refusals = await editMemberAction(
      form({
        invitationId: INVITATION_ID,
        guestId: GUEST_ID,
        fullName: "Ana",
      }),
    );

    expect(refusals).toEqual(["member_without_name"]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("hands back removeMemberAction's refusal, with no impact to report", async () => {
    // A REFUSED REMOVAL CONTRADICTED NOTHING.
    //
    // This action answers two questions at once — which rules refused it, and
    // what a removal that HAPPENED left inconsistent — so the second answer must
    // be absent rather than a classification of a removal that never occurred.
    removeMember.mockResolvedValue(["no_members"]);
    getCurrentRsvp.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      attending: true,
      seatsConfirmed: 2,
      attendeeGuestIds: [GUEST_ID, SECOND_GUEST_ID],
    });

    const { refusals, impact } = await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );

    expect(refusals).toEqual(["no_members"]);
    expect(impact).toBeNull();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // THE PERMITTING COUNTERPARTS, so the three above cannot pass by never
  // revalidating anything at all.
  it("revalidates and answers empty when the three writes are permitted", async () => {
    const addRefusals = await addMemberAction(
      form({ invitationId: INVITATION_ID, fullName: "Ana", phone: "" }),
    );
    const editRefusals = await editMemberAction(
      form({
        invitationId: INVITATION_ID,
        guestId: GUEST_ID,
        fullName: "Ana",
      }),
    );
    const removal = await removeMemberAction(
      form({ invitationId: INVITATION_ID, guestId: GUEST_ID }),
    );

    expect(addRefusals).toEqual([]);
    expect(editRefusals).toEqual([]);
    expect(removal.refusals).toEqual([]);
    expect(removal.impact).not.toBeNull();
    expect(revalidatePath.mock.calls.map((call) => call[0])).toEqual([
      "/console",
      "/console",
      "/console",
    ]);
  });
});

/**
 * THE FORM ANSWERS "WHO RECEIVES THE MESSAGE" NOW, AND ANSWERS IT WITH A
 * POSITION.
 *
 * It cannot answer with an id: at the moment it is submitted none of these
 * people exist, so there is nothing to point at. Until this existed, every
 * invitation created in the console was born unchosen — listed under "Sin
 * destinatario elegido" and needing somebody to reopen it and finish what they
 * thought they had already finished.
 *
 * `chooseRecipientAction` below is the OTHER half, and stays: it takes a real
 * id and is what an operator uses to change their mind afterwards.
 */
describe("createInvitationAction — who receives the message", () => {
  function household(recipientIndex?: string): FormData {
    const data = new FormData();

    data.set("displayName", "Familia Restrepo");
    data.set("greetingName", "Familia Restrepo");
    data.set("greetingNameSource", "derived");

    for (const fullName of ["Ana Restrepo", "Beto Restrepo"]) {
      data.append("memberFullName", fullName);
      data.append("memberNickname", "");
      data.append("memberPhone", "3001234567");
    }

    if (recipientIndex !== undefined) {
      data.set("recipientIndex", recipientIndex);
    }

    return data;
  }

  it("carries the chosen position through to the repository", async () => {
    await createInvitationAction(household("1"));

    expect(createInvitation.mock.calls[0][1]).toMatchObject({
      dispatchRecipientIndex: 1,
      guests: [
        expect.objectContaining({ fullName: "Ana Restrepo" }),
        expect.objectContaining({ fullName: "Beto Restrepo" }),
      ],
    });
  });

  /**
   * A caller that is not the form still gets a recipient, and gets the one the
   * household itself designates: row zero is written with `isPrimary: true`
   * five lines away, by the same rule and for the same reason.
   */
  it("falls back to the household's first member when nothing was chosen", async () => {
    await createInvitationAction(household());

    expect(createInvitation.mock.calls[0][1]).toMatchObject({
      dispatchRecipientIndex: 0,
    });
  });

  /**
   * Text where a position belongs is not a choice, so it is treated as none
   * rather than silently resolving to somebody. Out-of-range numbers need no
   * guard here: the repository looks the position up among the rows it just
   * wrote and finds nobody, which leaves the invitation unchosen — the old
   * state, and recoverable from the edit screen.
   */
  it("treats an unreadable position as no choice at all", async () => {
    await createInvitationAction(household("segunda"));

    expect(createInvitation.mock.calls[0][1]).toMatchObject({
      dispatchRecipientIndex: 0,
    });
  });
});

describe("chooseRecipientAction — the member must belong to the invitation", () => {
  it("accepts a guest the invitation currently names", async () => {
    await chooseRecipientAction(
      form({ invitationId: INVITATION_ID, guestId: SECOND_GUEST_ID }),
    );

    expect(chooseRecipient.mock.calls[0].slice(1)).toEqual([
      INVITATION_ID,
      SECOND_GUEST_ID,
    ]);
  });

  // A REFUSAL IS RETURNED, NOT THROWN.
  //
  // Next replaces a thrown message with an opaque digest in production, so a
  // thrown refusal never reaches the browser — and a thrown value carries no
  // proof of who wrote it, since a transport TypeError is also an Error with a
  // non-empty message. The code travels instead, and the console owns the copy:
  // `recipient_not_a_member` already exists in DraftRefusal and already has
  // Spanish copy in InvitationForm's REFUSAL_COPY.
  it("answers with the refusal code instead of throwing prose", async () => {
    const refusals = await chooseRecipientAction(
      form({ invitationId: INVITATION_ID, guestId: STRANGER_GUEST_ID }),
    );

    expect(refusals).toEqual(["recipient_not_a_member"]);
    expect(chooseRecipient).not.toHaveBeenCalled();
    // And nothing is revalidated, because nothing changed. A throw used to skip
    // this for free; a return has to mean it on purpose.
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

/**
 * WHY THIS DESCRIBE CHANGED SHAPE.
 *
 * It used to assert that the refusal was thrown and reached the caller as a
 * thrown message — "surfaces the repository's refusal verbatim". The intent was
 * right and the mechanism was dead: Next replaces a thrown message with an
 * opaque `digest` before it crosses to a browser, so the sentence naming the
 * event kinds and offering rotation was readable only in a server log. The four
 * membership writes were converted for this exact reason; this is the fifth.
 *
 * So the assertions moved rather than relaxed. The refusal is now DATA whose
 * reason and kinds are pinned exactly, instead of a sentence matched by regex,
 * and the console owns the Spanish it is rendered as.
 */
describe("deleteInvitationAction — the refusal it must RETURN", () => {
  it("deletes an invitation with no dispatch history, and says so", async () => {
    const outcome = await deleteInvitationAction(
      form({ invitationId: INVITATION_ID }),
    );

    expect(outcome).toEqual({ ok: true });
    expect(deleteInvitation).toHaveBeenCalledTimes(1);
    expect(rotateInvitationSlug).not.toHaveBeenCalled();
    expect(revalidatePath.mock.calls.map((call) => call[0])).toContain(
      "/console",
    );
  });

  it("RETURNS the repository's refusal, kinds and all, instead of throwing it", async () => {
    // `canDeleteInvitation` names the event kinds it found, and an operator
    // shown "no se pudo eliminar" instead has been told nothing they can act
    // on. A thrown sentence tells them nothing either, because production
    // replaces it with a digest — so the codes travel and the console
    // translates them beside the rotation button that is the actual exit.
    deleteInvitation.mockResolvedValue({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["link_opened", "marked_failed"],
    });

    await expect(
      deleteInvitationAction(form({ invitationId: INVITATION_ID })),
    ).resolves.toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["link_opened", "marked_failed"],
    });
  });

  it("revalidates NOTHING when the deletion was refused", async () => {
    // A throw skipped `revalidatePath` for free. A return has to mean it on
    // purpose: the invitation is still there, so re-reading the console list
    // would cost a round trip to display exactly what is already on screen.
    deleteInvitation.mockResolvedValue({
      ok: false,
      reason: "already_answered",
      eventKinds: [],
    });

    await deleteInvitationAction(form({ invitationId: INVITATION_ID }));

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rotateSlugAction", () => {
  it("returns the new slug and records no dispatch event", async () => {
    const slug = await rotateSlugAction(form({ invitationId: INVITATION_ID }));

    expect(slug).toBe("zzzzzzzzzzzzzzzz");
    expect(markSent).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(deleteInvitation).not.toHaveBeenCalled();
  });

  it("refuses a missing invitation id and rotates nothing", async () => {
    await expect(rotateSlugAction(form({}))).rejects.toThrow(/no se indicó/i);

    expect(rotateInvitationSlug).not.toHaveBeenCalled();
  });
});
