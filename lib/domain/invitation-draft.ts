import type { GreetingNameSource } from "./greeting-name";

/**
 * What an invitation edit is allowed to save, and what it is only told about.
 *
 * REFUSALS AND ADVISORIES ARE NOT THE SAME THING
 *
 * A REFUSAL is a state the model does not permit to exist: an invitation with
 * no members, a member with no name, two rows claiming the same guest, a chosen
 * recipient the household does not contain, a custom name that is blank. None
 * of these can be stored and later made sense of.
 *
 * An ADVISORY is a fact the operator should see and then decide about. Two
 * members sharing a nickname is twins. A chosen recipient with no number yet is
 * a half-finished record, which is what a record looks like while somebody is
 * filling it in. Refusing either would teach the couple to work around the tool,
 * which is the failure mode this whole capability was written against.
 *
 * Everything here is pure: no I/O, no clock, no randomness. `canMoveMember` in
 * particular runs entirely BEFORE any SQL is issued (design D25), so a refused
 * move never becomes a statement and can never contend with the
 * `clear_recipient_on_guest_move` trigger.
 *
 * Identifiers and comments are English; the names in the data are the couple's.
 */

/** One row of the member editor, saved or not yet. */
export interface InvitationDraftMember {
  /** `null` for a row the form added that has never been written. */
  readonly id: string | null;
  readonly fullName: string;
  readonly nickname: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
  /** From `classifyPhoneDispatchability`, computed upstream as elsewhere. */
  readonly dispatchable: boolean;
}

/** One invitation as the form holds it, before anything is written. */
export interface InvitationDraft {
  readonly displayName: string;
  readonly greetingName: string;
  readonly greetingNameSource: GreetingNameSource;
  /**
   * OPTIONAL, AND ON ITS WAY OUT.
   *
   * The console stopped asking for it: there is one wedding, so there is one
   * deadline, derived in `lib/domain/wedding-day.ts` and read by every
   * invitation. `invitations.rsvp_deadline` is still a column — dropping it is
   * a separate, destructive step, the way 0012 and 0013 split the last one —
   * and the paths that still carry a stored value keep type-checking through
   * this field.
   */
  readonly rsvpDeadline?: string | null;
  readonly members: readonly InvitationDraftMember[];
  readonly dispatchRecipientGuestId: string | null;
}

/** A state the model does not permit. The save does not happen. */
export type DraftRefusal =
  | "no_members"
  | "member_without_name"
  | "duplicate_member_id"
  | "recipient_not_a_member"
  | "custom_name_empty";

/** A fact worth showing. The save happens regardless. */
export type DraftAdvisory =
  | "duplicate_nickname"
  | "recipient_has_no_phone"
  | "recipient_phone_unreachable";

export interface DraftValidation {
  readonly refusals: readonly DraftRefusal[];
  readonly advisories: readonly DraftAdvisory[];
}

/** A nickname that is actually set — an emptied form field is not one. */
function usableNickname(member: InvitationDraftMember): string | null {
  const trimmed = member.nickname?.trim() ?? "";

  return trimmed === "" ? null : trimmed.toLocaleLowerCase("es");
}

function hasDuplicateNickname(
  members: readonly InvitationDraftMember[],
): boolean {
  const seen = new Set<string>();

  for (const member of members) {
    const nickname = usableNickname(member);

    if (nickname === null) {
      continue;
    }

    if (seen.has(nickname)) {
      return true;
    }

    seen.add(nickname);
  }

  return false;
}

function hasDuplicateId(members: readonly InvitationDraftMember[]): boolean {
  // `null` is deliberately not compared: two unsaved rows are two people, not
  // one person listed twice.
  const ids = members
    .map((member) => member.id)
    .filter((id): id is string => id !== null);

  return new Set(ids).size !== ids.length;
}

/**
 * Every problem the draft has, not the first one.
 *
 * An operator who fixes one problem, re-submits, and discovers the next is
 * being made to do the validator's work one round-trip at a time.
 */
export function validateInvitationDraft(
  draft: InvitationDraft,
): DraftValidation {
  const refusals: DraftRefusal[] = [];
  const advisories: DraftAdvisory[] = [];

  if (draft.members.length === 0) {
    refusals.push("no_members");
  }

  if (draft.members.some((member) => member.fullName.trim() === "")) {
    refusals.push("member_without_name");
  }

  if (hasDuplicateId(draft.members)) {
    refusals.push("duplicate_member_id");
  }

  const recipient =
    draft.dispatchRecipientGuestId === null
      ? null
      : (draft.members.find(
          (member) => member.id === draft.dispatchRecipientGuestId,
        ) ?? null);

  if (draft.dispatchRecipientGuestId !== null && recipient === null) {
    refusals.push("recipient_not_a_member");
  }

  // Only a CUSTOM name is a string a person typed and can be asked to fix. A
  // derived name is recomputed from the members and its stored copy is ignored.
  if (
    draft.greetingNameSource === "custom" &&
    draft.greetingName.trim() === ""
  ) {
    refusals.push("custom_name_empty");
  }

  if (hasDuplicateNickname(draft.members)) {
    advisories.push("duplicate_nickname");
  }

  if (recipient !== null) {
    if (recipient.phoneE164 === null || recipient.phoneE164 === "") {
      advisories.push("recipient_has_no_phone");
    } else if (!recipient.dispatchable) {
      advisories.push("recipient_phone_unreachable");
    }
  }

  return { refusals, advisories };
}

/** Why a member cannot be moved out of their current invitation. */
export type MoveRefusal =
  "would_empty_source" | "member_not_in_source" | "same_invitation";

export type MoveOutcome =
  | { readonly ok: true; readonly clearsSourceRecipient: boolean }
  | { readonly ok: false; readonly reason: MoveRefusal };

/**
 * Decision 11's refusal, and D25's ordering.
 *
 * This runs BEFORE any SQL is issued, so a refused move never becomes a
 * statement and can never contend with `clear_recipient_on_guest_move`.
 * `clearsSourceRecipient` is what the UI warns about up front; the trigger is
 * what actually performs the clear.
 *
 * The emptiness check is FIRST on purpose. A move that would both empty the
 * source and clear its recipient has exactly one answer — it does not happen —
 * and reporting the recipient consequence of a move that will not occur would
 * be telling the operator about a future that was already refused.
 *
 * The destination's own recipient is never touched: carrying the choice across
 * is an auto-pick nobody made, which is the inference this capability removed.
 */
export function canMoveMember(input: {
  readonly sourceMemberIds: readonly string[];
  readonly memberId: string;
  readonly sourceRecipientGuestId: string | null;
  readonly destinationInvitationId: string;
  readonly sourceInvitationId: string;
}): MoveOutcome {
  if (input.destinationInvitationId === input.sourceInvitationId) {
    return { ok: false, reason: "same_invitation" };
  }

  if (!input.sourceMemberIds.includes(input.memberId)) {
    return { ok: false, reason: "member_not_in_source" };
  }

  if (input.sourceMemberIds.length <= 1) {
    return { ok: false, reason: "would_empty_source" };
  }

  return {
    ok: true,
    clearsSourceRecipient: input.sourceRecipientGuestId === input.memberId,
  };
}

/** One stored answer the current member list no longer agrees with. */
export interface ContradictedAnswer {
  readonly rsvpResponseId: string;
  readonly seatsConfirmed: number;
  /** Attendee ids no longer belonging to this invitation. Never dropped. */
  readonly danglingGuestIds: readonly string[];
}

/**
 * The attendees a stored answer names who are no longer members.
 *
 * The rule alone, with no answer identity in it. Deciding "does this answer
 * still agree with this membership" needs the two lists and nothing else, and
 * two callers ask it for different reasons: a removal reports what it just
 * contradicted, and the console list reports what is contradicted right now.
 *
 * Extracted because the second caller has no `rsvp_responses.id` to offer. It
 * had been passing the INVITATION id into a field named for the response id and
 * discarding the result — contained, commented, and still a value of the wrong
 * kind travelling through a typed field that cannot tell two strings apart.
 */
export function danglingAttendeeIds(
  attendeeGuestIds: readonly string[],
  memberIds: readonly string[],
): readonly string[] {
  const members = new Set(memberIds);

  return attendeeGuestIds.filter((guestId) => !members.has(guestId));
}

export interface MembershipChangeImpact {
  readonly removedGuestIds: readonly string[];
  readonly contradictedAnswers: readonly ContradictedAnswer[];
  readonly seatsConfirmedExceedsMembers: boolean;
}

/**
 * What a membership change did to the invitation's stored answer (design D19).
 *
 * Reports, never refuses. "Fer already said yes, but now he cannot come — take
 * him off" is the couple's actual workflow, and an edit refused for consistency
 * only teaches them to work around the tool. The stored history is never
 * rewritten either: this describes the forward-looking state, and the answer
 * stays exactly as it was given.
 *
 * A record rather than a boolean, because the badge has to NAME the removed
 * guest and the contradicted answer. A boolean cannot, and an operator who is
 * told only that something is inconsistent cannot act on it.
 */
export function classifyMembershipChangeImpact(input: {
  readonly memberIdsBefore: readonly string[];
  readonly memberIdsAfter: readonly string[];
  readonly latestAnswer: {
    readonly id: string;
    readonly attending: boolean;
    readonly seatsConfirmed: number;
    readonly attendeeGuestIds: readonly string[];
  } | null;
}): MembershipChangeImpact {
  const after = new Set(input.memberIdsAfter);
  const removedGuestIds = input.memberIdsBefore.filter((id) => !after.has(id));
  const answer = input.latestAnswer;

  // A declined answer confirms nobody, so nothing it names can be contradicted
  // by a membership change.
  if (answer === null || !answer.attending) {
    return {
      removedGuestIds,
      contradictedAnswers: [],
      seatsConfirmedExceedsMembers: false,
    };
  }

  const danglingGuestIds = danglingAttendeeIds(
    answer.attendeeGuestIds,
    input.memberIdsAfter,
  );

  return {
    removedGuestIds,
    contradictedAnswers:
      danglingGuestIds.length === 0
        ? []
        : [
            {
              rsvpResponseId: answer.id,
              seatsConfirmed: answer.seatsConfirmed,
              danglingGuestIds,
            },
          ],
    // Tracked separately from the dangling ids: a household can shrink below
    // what it confirmed without any NAMED attendee leaving, and that is just as
    // inconsistent and just as invisible if nothing says so.
    seatsConfirmedExceedsMembers:
      answer.seatsConfirmed > input.memberIdsAfter.length,
  };
}
