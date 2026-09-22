/**
 * The directory of guests — pure.
 *
 * WHY A GUEST EXISTS OUTSIDE AN INVITATION AT ALL.
 *
 * Until migration 0015 a guest could not: `invitation_guests.invitation_id` was
 * `not null`, so the only way to write a person down was to build the household
 * around them first. The couple's words were "no veo la lista de invitados por
 * ninguna parte", and this is why there was none to see.
 *
 * A guest with no household is a NORMAL resting state, not an error waiting to
 * be repaired. It is where somebody starts when they are written down before
 * anybody decides who they sit with, and where they return when the invitation
 * holding them is deleted.
 *
 * WHAT THIS MODULE IS NOT. It does not enforce "one guest, one invitation".
 * That is the shape of the column — one row carries one `invitation_id` — and
 * `invitations_dispatch_recipient_fk` refuses to address anybody whose
 * invitation is NULL. What lives here is what the console READS to avoid
 * offering a person it would then have to refuse.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */

import {
  countsAsOperatorAssertedSend,
  type DispatchState,
} from "./dispatch-state";
import type { DraftRefusal } from "./invitation-draft";

/** The invitation a guest belongs to, named as the console names it. */
export interface DirectoryHousehold {
  readonly invitationId: string;
  readonly greetingName: string;
  /**
   * Who may DISPATCH it. Administration is shared between the two operators;
   * sending is not, and the dispatch route answers `notFound()` to anybody
   * else — so a send affordance shown without this points at a 404.
   */
  readonly ownerSenderId: string;
  /** The member this invitation is addressed to, or nobody yet. */
  readonly recipientGuestId: string | null;
  /**
   * What has happened to this invitation's message, derived from its events.
   *
   * A fact about the INVITATION, which is why the directory cannot hand it
   * straight to every member: the message reached one phone, the one the
   * invitation is addressed to.
   */
  readonly dispatchState: DispatchState;
}

export interface DirectoryGuest {
  readonly id: string;
  readonly fullName: string;
  readonly nickname: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
  /** The household holding them, or NULL for somebody in the directory only. */
  readonly household: DirectoryHousehold | null;
  /** When the row was written. ISO 8601, as the database returns it. */
  readonly createdAt: string;
}

/**
 * One guest as the directory shows them — their own record plus the one thing
 * only the whole list can answer: who actually receives their household's
 * message.
 */
export interface DirectoryEntry extends DirectoryGuest {
  /** Whether this person is the one their invitation is addressed to. */
  readonly isRecipient: boolean;
  /**
   * The name of whoever receives that message, this person or another member.
   *
   * NULL when there is no household, when nobody has been chosen, or when the
   * chosen member is not in the list — the last of which should not happen,
   * since the composite foreign key ties the choice to a member of that same
   * invitation, and answering with a name that was not found would be an
   * invention rather than a fallback.
   */
  readonly recipientName: string | null;
  /**
   * Whether a message was actually sent to THIS person.
   *
   * The couple asked for it: "a la persona a la que se le envía esa invitación,
   * en invitados debería aparecer como que ya se le envió". Both halves of the
   * conjunction are load-bearing — `marked_sent` is a fact about the
   * invitation, so handing it to all four members of a household would tell
   * three of them a thing that never happened.
   *
   * `countsAsOperatorAssertedSend` is the only predicate allowed to answer
   * "has been invited": an opened link is evidence the link escaped, not
   * evidence anybody sent it, and a send reported as failed asserts the
   * opposite.
   */
  readonly wasWrittenTo: boolean;
}

export interface GuestDirectory {
  /** Everybody, in one alphabetical order. */
  readonly guests: readonly DirectoryEntry[];
  readonly total: number;
  /** How many belong to no invitation yet. */
  readonly unassigned: number;
}

/** What the viewer's own session says, for deciding a send affordance. */
export interface DirectoryViewer {
  readonly viewerSenderId: string;
  /** True when this handset carries the other operator's WhatsApp account. */
  readonly dispatchBlocked: boolean;
}

/**
 * Whether a send can honestly be offered on this person's row.
 *
 * THREE CONDITIONS, EACH REMOVING A DIFFERENT LIE. Without a household there is
 * no invitation and nothing to send. Dispatch is owner-scoped — the dispatch
 * route answers `notFound()` to the other operator — so a link shown without
 * that check points at a 404, which is an affordance that lies. And a
 * device-declaration mismatch blocks the send itself, which is the one thing
 * that gate exists for.
 *
 * `GuestList` applies exactly these on a household's row. Stated as a function
 * because the directory now needs the same answer about a PERSON, and two
 * copies of a rule are two rules.
 */
export function canOfferSend(
  guest: DirectoryGuest,
  viewer: DirectoryViewer,
): boolean {
  return (
    guest.household !== null &&
    guest.household.ownerSenderId === viewer.viewerSenderId &&
    !viewer.dispatchBlocked
  );
}

/**
 * The whole directory, ordered and counted.
 *
 * NEWEST FIRST, AND THE ALPHABET WAS THE WRONG ANSWER.
 *
 * This used to sort by name through a Spanish collator, reasoning that a
 * directory is where somebody is looked up. That is true of a FINISHED list and
 * false of the one being built: the couple type forty people in one sitting,
 * and between one entry and the next the only question is "did that one land?"
 * — whose answer is on screen only if the newest row is at the top. They asked
 * for it in those terms: "organizada por fecha de creación DESC".
 *
 * THE ID BREAKS A TIE, and the tie is ordinary rather than exotic: `created_at`
 * defaults to `now()`, and an import writes a whole file inside one statement,
 * so identical timestamps are normal. Without a tiebreak the list can reshuffle
 * between two renders of the same data — the kind of flicker that makes a
 * screen feel broken without ever being wrong.
 */
export function buildGuestDirectory(
  guests: readonly DirectoryGuest[],
): GuestDirectory {
  const ordered = [...guests].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
  /*
    WHO RECEIVES EACH HOUSEHOLD'S MESSAGE, RESOLVED ONCE.

    A send goes to the member its invitation is ADDRESSED to, and this list is
    alphabetical rather than grouped — so the member who is the recipient sits
    nowhere near the others in their household. Their name has to travel with
    every row of that household, or a send button would be offered beside a
    person the message will not reach.

    Every guest is already in hand, so this costs no query.
  */
  const nameById = new Map(ordered.map((guest) => [guest.id, guest.fullName]));

  return {
    guests: ordered.map((guest) => ({
      ...guest,
      isRecipient:
        guest.household !== null &&
        guest.household.recipientGuestId === guest.id,
      wasWrittenTo:
        guest.household !== null &&
        guest.household.recipientGuestId === guest.id &&
        countsAsOperatorAssertedSend(guest.household.dispatchState),
      recipientName:
        guest.household?.recipientGuestId === undefined ||
        guest.household?.recipientGuestId === null
          ? null
          : (nameById.get(guest.household.recipientGuestId) ?? null),
    })),
    total: ordered.length,
    unassigned: ordered.filter(isFreeToInvite).length,
  };
}

/**
 * Whether this person can still be put into an invitation.
 *
 * The couple's rule — "cuando un invitado pertenece a una invitación no debe
 * poder pertenecer a otra, no se debería poder escoger en una próxima
 * invitación" — is already unrepresentable in the database. This is not the
 * enforcement; it is what the picker reads so it never OFFERS somebody it would
 * then have to refuse, which is a worse way to learn the same rule.
 */
export function isFreeToInvite(guest: DirectoryGuest): boolean {
  return guest.household === null;
}

/**
 * What the directory refuses to store.
 *
 * ONLY THE NAME IS REQUIRED, and that is deliberate. A phone number is what the
 * guest gate matches and what a dispatch needs, and neither happens from here —
 * so demanding one would stop an operator writing down a cousin whose number
 * they have not asked for yet, which is most of what a directory is for.
 *
 * It answers in `DraftRefusal`, the vocabulary the invitation forms already
 * speak, so one refusal does not need two Spanish translations.
 */
export function validateDirectoryGuest(candidate: {
  readonly fullName: string;
}): readonly DraftRefusal[] {
  // Trimmed, because a field holding spaces looks filled on the screen the
  // operator is looking at. That is the case worth refusing here rather than
  // storing and puzzling over later.
  return candidate.fullName.trim() === "" ? ["member_without_name"] : [];
}
