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
}

export interface DirectoryGuest {
  readonly id: string;
  readonly fullName: string;
  readonly nickname: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
  /** The household holding them, or NULL for somebody in the directory only. */
  readonly household: DirectoryHousehold | null;
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
 * Spanish collation, which is not the same as comparing code points.
 *
 * `"Ñ" > "Z"` and `"Á" > "Z"` by code point, so the default comparison files
 * Muñóz and Álvaro after Zulema — in a guest list for a Colombian wedding,
 * where those letters are ordinary rather than exotic. A reader looking for
 * "Peña" looks between N and O, and this is what puts it there.
 */
const byName = new Intl.Collator("es", { sensitivity: "base" });

/**
 * The whole directory, ordered and counted.
 *
 * ONE ORDER, AND IT IS THE FINDABLE ONE. This is where somebody goes to look
 * for a person by name, so it sorts by name. Floating the unassigned guests to
 * the top would order the list by something the reader cannot see in the name
 * they are scanning for, and a list whose order is a puzzle gets scrolled past
 * rather than read. Who is still unplaced is answered by `unassigned` and by
 * each row saying so, neither of which costs the list its order.
 */
export function buildGuestDirectory(
  guests: readonly DirectoryGuest[],
): GuestDirectory {
  const ordered = [...guests].sort((left, right) =>
    byName.compare(left.fullName, right.fullName),
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
