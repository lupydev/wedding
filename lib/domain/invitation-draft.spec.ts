import { describe, expect, it } from "vitest";

import {
  canMoveMember,
  classifyMembershipChangeImpact,
  validateInvitationDraft,
  type InvitationDraft,
  type InvitationDraftMember,
} from "./invitation-draft";

/**
 * What an invitation edit is allowed to save, and what it is only told about.
 *
 * TWO CATEGORIES, AND THE LINE BETWEEN THEM IS THE POINT
 *
 * A REFUSAL means the draft describes a state the model does not permit — zero
 * members, a nameless person, a recipient who is not in the household. An
 * ADVISORY means the draft is perfectly savable and the operator should know
 * something about it: two members share a nickname, or the chosen recipient
 * cannot currently be reached.
 *
 * Getting that line wrong in either direction is a real failure. Refusing a
 * duplicate nickname refuses twins. Silently allowing a recipient who is not a
 * member stores a choice that resolves to nothing.
 *
 * EVERY REFUSAL IS ASSERTED BESIDE ITS PERMITTING CASE, IN THE SAME TEST. A
 * test that only proves the function refuses cannot tell you it refuses the
 * RIGHT thing — a validator that refused everything would pass all of them.
 */

function member(
  overrides: Partial<InvitationDraftMember> = {},
): InvitationDraftMember {
  return {
    id: "g1",
    fullName: "Ana Muñóz",
    nickname: null,
    phoneE164: "+573001234567",
    isChild: false,
    dispatchable: true,
    ...overrides,
  };
}

function draft(overrides: Partial<InvitationDraft> = {}): InvitationDraft {
  return {
    displayName: "Familia Muñóz",
    greetingName: "Familia Muñóz",
    greetingNameSource: "derived",
    members: [member()],
    dispatchRecipientGuestId: null,
    ...overrides,
  };
}

describe("validateInvitationDraft", () => {
  it("refuses a draft with no members and permits the one-member draft beside it", () => {
    // The permitting half is what makes the refusal meaningful: a solo guest IS
    // a one-member invitation, and it saves through this same path.
    expect(validateInvitationDraft(draft({ members: [] })).refusals).toEqual([
      "no_members",
    ]);
    expect(validateInvitationDraft(draft()).refusals).toEqual([]);
  });

  it("refuses a blank member name and permits a named one", () => {
    expect(
      validateInvitationDraft(draft({ members: [member({ fullName: "   " })] }))
        .refusals,
    ).toEqual(["member_without_name"]);
    expect(
      validateInvitationDraft(draft({ members: [member({ fullName: "Ana" })] }))
        .refusals,
    ).toEqual([]);
  });

  it("refuses two members carrying the same id and permits two distinct ids", () => {
    const duplicated = draft({
      members: [member({ id: "g1" }), member({ id: "g1", fullName: "Beto" })],
    });
    const distinct = draft({
      members: [member({ id: "g1" }), member({ id: "g2", fullName: "Beto" })],
    });

    expect(validateInvitationDraft(duplicated).refusals).toEqual([
      "duplicate_member_id",
    ]);
    expect(validateInvitationDraft(distinct).refusals).toEqual([]);
  });

  it("does not mistake two unsaved rows for a duplicate id", () => {
    // A row the form just added has `id: null` until it is written. Two of them
    // are two different people, not one person listed twice.
    const unsaved = draft({
      members: [
        member({ id: null, fullName: "Ana" }),
        member({ id: null, fullName: "Beto" }),
      ],
    });

    expect(validateInvitationDraft(unsaved).refusals).toEqual([]);
  });

  it("refuses a chosen recipient who is not a member and permits one who is", () => {
    const stranger = draft({ dispatchRecipientGuestId: "someone-else" });
    const insider = draft({ dispatchRecipientGuestId: "g1" });

    expect(validateInvitationDraft(stranger).refusals).toEqual([
      "recipient_not_a_member",
    ]);
    expect(validateInvitationDraft(insider).refusals).toEqual([]);
  });

  it("refuses a blank custom name and permits a typed one", () => {
    const blank = draft({ greetingNameSource: "custom", greetingName: "  " });
    const typed = draft({
      greetingNameSource: "custom",
      greetingName: "Los Muñóz",
    });

    expect(validateInvitationDraft(blank).refusals).toEqual([
      "custom_name_empty",
    ]);
    expect(validateInvitationDraft(typed).refusals).toEqual([]);
  });

  it("does not apply the custom-name rule to a derived name", () => {
    // A derived name is recomputed from the members and the stored string is
    // ignored, so an empty one is not a thing an operator can be asked to fix.
    const derived = draft({ greetingNameSource: "derived", greetingName: "" });

    expect(validateInvitationDraft(derived).refusals).toEqual([]);
  });

  it("reports a duplicate nickname as an advisory and saves it anyway", () => {
    // Twins, or a shared family nickname. A plausible real fact, and not this
    // capability's business to prevent.
    const twins = draft({
      members: [
        member({ id: "g1", fullName: "Nicolás Muñóz", nickname: "Nico" }),
        member({ id: "g2", fullName: "Nicolasa Muñóz", nickname: "Nico" }),
      ],
    });
    const result = validateInvitationDraft(twins);

    expect(result.refusals).toEqual([]);
    expect(result.advisories).toEqual(["duplicate_nickname"]);
  });

  it("does not report distinct nicknames, nor two members with none", () => {
    const distinct = draft({
      members: [
        member({ id: "g1", nickname: "Ana" }),
        member({ id: "g2", fullName: "Beto Muñóz", nickname: "Beto" }),
      ],
    });
    const unnicknamed = draft({
      members: [
        member({ id: "g1", nickname: null }),
        member({ id: "g2", fullName: "Beto Muñóz", nickname: null }),
      ],
    });

    expect(validateInvitationDraft(distinct).advisories).toEqual([]);
    expect(validateInvitationDraft(unnicknamed).advisories).toEqual([]);
  });

  it("reports a chosen recipient with no number as an advisory, never a refusal", () => {
    const unreachable = draft({
      dispatchRecipientGuestId: "g1",
      members: [member({ id: "g1", phoneE164: null, dispatchable: false })],
    });
    const result = validateInvitationDraft(unreachable);

    // The save goes through. A household whose numbers are not typed in yet is
    // an ordinary half-finished record, and refusing it would make the form
    // unusable exactly when it is most needed.
    expect(result.refusals).toEqual([]);
    expect(result.advisories).toEqual(["recipient_has_no_phone"]);
  });

  it("reports a chosen recipient whose line cannot receive WhatsApp as an advisory", () => {
    const landline = draft({
      dispatchRecipientGuestId: "g1",
      members: [
        member({ id: "g1", phoneE164: "+576012345678", dispatchable: false }),
      ],
    });
    const reachable = draft({ dispatchRecipientGuestId: "g1" });

    expect(validateInvitationDraft(landline).advisories).toEqual([
      "recipient_phone_unreachable",
    ]);
    expect(validateInvitationDraft(reachable).advisories).toEqual([]);
  });

  it("reports every refusal a draft earns, rather than the first one", () => {
    // An operator fixing one problem at a time, re-submitting to discover the
    // next, is how a form teaches people to dread it.
    const bad = draft({
      members: [member({ id: "g1", fullName: "" }), member({ id: "g1" })],
      dispatchRecipientGuestId: "nobody",
      greetingNameSource: "custom",
      greetingName: "",
    });

    expect(bad.members).toHaveLength(2);
    expect(validateInvitationDraft(bad).refusals).toEqual([
      "member_without_name",
      "duplicate_member_id",
      "recipient_not_a_member",
      "custom_name_empty",
    ]);
  });
});

describe("canMoveMember", () => {
  function move(overrides: Partial<Parameters<typeof canMoveMember>[0]> = {}) {
    return canMoveMember({
      sourceMemberIds: ["g1", "g2", "g3"],
      memberId: "g1",
      sourceRecipientGuestId: null,
      sourceInvitationId: "inv-a",
      destinationInvitationId: "inv-b",
      ...overrides,
    });
  }

  it("refuses a move that would empty a two-member source and permits it from three", () => {
    // The refusal points at deleting the invitation instead: an invitation with
    // zero members could never be unlocked by anybody, and would sit in the
    // console looking valid while being unreachable.
    expect(move({ sourceMemberIds: ["g1"] })).toEqual({
      ok: false,
      reason: "would_empty_source",
    });
    expect(move({ sourceMemberIds: ["g1", "g2", "g3"] })).toEqual({
      ok: true,
      clearsSourceRecipient: false,
    });
  });

  it("permits a move that leaves exactly one member behind", () => {
    // The boundary the refusal sits on. Two members is the smallest source a
    // move is allowed to leave; an off-by-one here refuses an ordinary edit.
    expect(move({ sourceMemberIds: ["g1", "g2"] })).toEqual({
      ok: true,
      clearsSourceRecipient: false,
    });
  });

  it("reports clearsSourceRecipient only for the guest who was chosen", () => {
    expect(move({ memberId: "g1", sourceRecipientGuestId: "g1" })).toEqual({
      ok: true,
      clearsSourceRecipient: true,
    });
    expect(move({ memberId: "g2", sourceRecipientGuestId: "g1" })).toEqual({
      ok: true,
      clearsSourceRecipient: false,
    });
  });

  it("refuses a move to the same invitation and permits one to a different invitation", () => {
    expect(move({ destinationInvitationId: "inv-a" })).toEqual({
      ok: false,
      reason: "same_invitation",
    });
    expect(move({ destinationInvitationId: "inv-b" })).toMatchObject({
      ok: true,
    });
  });

  it("refuses moving a member the source does not have and permits one it does", () => {
    expect(move({ memberId: "ghost" })).toEqual({
      ok: false,
      reason: "member_not_in_source",
    });
    expect(move({ memberId: "g3" })).toMatchObject({ ok: true });
  });

  it("refuses emptying the source before it looks at the recipient at all", () => {
    // Design D25: the emptiness refusal runs FIRST, in the application, so no
    // UPDATE is ever issued and the `clear_recipient_on_guest_move` trigger
    // never fires. The two checks cannot contend because a refused move never
    // becomes a statement.
    expect(
      move({ sourceMemberIds: ["g1"], sourceRecipientGuestId: "g1" }),
    ).toEqual({ ok: false, reason: "would_empty_source" });
  });
});

describe("classifyMembershipChangeImpact", () => {
  const ANSWER = {
    id: "rsvp-1",
    attending: true,
    seatsConfirmed: 2,
    attendeeGuestIds: ["g1", "g2"],
  };

  it("reports a removed member who was named in a confirmed answer", () => {
    const impact = classifyMembershipChangeImpact({
      memberIdsBefore: ["g1", "g2"],
      memberIdsAfter: ["g1"],
      latestAnswer: ANSWER,
    });

    expect(impact.removedGuestIds).toEqual(["g2"]);
    expect(impact.contradictedAnswers).toEqual([
      { rsvpResponseId: "rsvp-1", seatsConfirmed: 2, danglingGuestIds: ["g2"] },
    ]);
    expect(impact.seatsConfirmedExceedsMembers).toBe(true);
  });

  it("reports no advisory when the removed member was never named in the answer", () => {
    const impact = classifyMembershipChangeImpact({
      memberIdsBefore: ["g1", "g2", "g3"],
      memberIdsAfter: ["g1", "g2"],
      latestAnswer: ANSWER,
    });

    // g3 was removed and the answer never mentioned them, so nothing about the
    // stored answer became untrue.
    expect(impact.removedGuestIds).toEqual(["g3"]);
    expect(impact.contradictedAnswers).toEqual([]);
    expect(impact.seatsConfirmedExceedsMembers).toBe(false);
  });

  it("reports no advisory when the answer names only current members", () => {
    const impact = classifyMembershipChangeImpact({
      memberIdsBefore: ["g1", "g2"],
      memberIdsAfter: ["g1", "g2", "g3"],
      latestAnswer: ANSWER,
    });

    expect(impact.removedGuestIds).toEqual([]);
    expect(impact.contradictedAnswers).toEqual([]);
  });

  it("reports nothing about an invitation that never answered", () => {
    const impact = classifyMembershipChangeImpact({
      memberIdsBefore: ["g1", "g2"],
      memberIdsAfter: ["g1"],
      latestAnswer: null,
    });

    expect(impact.removedGuestIds).toEqual(["g2"]);
    expect(impact.contradictedAnswers).toEqual([]);
    expect(impact.seatsConfirmedExceedsMembers).toBe(false);
  });

  it("ignores a declined answer, which confirms nobody", () => {
    const impact = classifyMembershipChangeImpact({
      memberIdsBefore: ["g1", "g2"],
      memberIdsAfter: ["g1"],
      latestAnswer: { ...ANSWER, attending: false, seatsConfirmed: 0 },
    });

    expect(impact.contradictedAnswers).toEqual([]);
    expect(impact.seatsConfirmedExceedsMembers).toBe(false);
  });

  it("flags a confirmed count larger than the remaining members even with no dangling id", () => {
    // Nobody named in the answer left, but the household shrank below what it
    // confirmed. The badge has to name that too, or the inconsistency is
    // invisible until somebody counts chairs.
    const impact = classifyMembershipChangeImpact({
      memberIdsBefore: ["g1", "g2", "g3"],
      memberIdsAfter: ["g1"],
      latestAnswer: { ...ANSWER, attendeeGuestIds: ["g1"], seatsConfirmed: 2 },
    });

    expect(impact.contradictedAnswers).toEqual([]);
    expect(impact.seatsConfirmedExceedsMembers).toBe(true);
  });
});
