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

export interface GuestDirectory {
  /** Everybody, in one alphabetical order. */
  readonly guests: readonly DirectoryGuest[];
  readonly total: number;
  /** How many belong to no invitation yet. */
  readonly unassigned: number;
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

  return {
    guests: ordered,
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
