import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountryCode } from "libphonenumber-js";

import type { DirectoryGuest } from "@/lib/domain/guest-directory";
import { validateDirectoryGuest } from "@/lib/domain/guest-directory";
import type { DraftRefusal } from "@/lib/domain/invitation-draft";
import { normalizeForStorage } from "@/lib/domain/phone";

/**
 * Reading and writing guests as PEOPLE, not as members of a household.
 *
 * `lib/server/invitations.ts` reaches the same table through the invitation
 * that owns them: `addMember`, `editMember` and `removeMember` all take an
 * `invitationId` first and refuse a guest that does not belong to it. That is
 * the right shape for editing a household and the wrong one for a directory,
 * where the whole point is the guest who belongs to no household at all.
 *
 * So this is a separate repository rather than four more functions in a file of
 * nineteen hundred lines, and the boundary is real: nothing here takes an
 * invitation id, and nothing here moves anybody between households. Placing a
 * guest is the invitation's business and stays there.
 *
 * Migration 0015 is what makes any of it storable — before it,
 * `invitation_guests.invitation_id` was `not null`.
 */

/** A guest's own details. No invitation, because that is not edited here. */
export interface DirectoryGuestInput {
  readonly fullName: string;
  readonly nickname: string | null;
  /** As typed. Normalised to E.164 here, exactly as every other path does. */
  readonly phone: string;
  readonly isChild: boolean;
}

/** The columns a directory row needs, plus the household it may sit in. */
const DIRECTORY_COLUMNS =
  "id, full_name, nickname, phone_e164, is_child, created_at, " +
  // `owner_sender_id` and `dispatch_recipient_guest_id` are what let a row
  // decide whether a send can honestly be offered on it, and who that send
  // would actually reach. Both are answered by `lib/domain/guest-directory.ts`.
  "invitations!invitation_guests_invitation_id_fkey(" +
  "id, greeting_name, owner_sender_id, dispatch_recipient_guest_id)";

interface DirectoryRow {
  id: string;
  full_name: string;
  nickname: string | null;
  phone_e164: string | null;
  is_child: boolean;
  created_at: string;
  /**
   * PostgREST embeds a to-one relationship as an object, or NULL when the
   * foreign key is NULL — which, since 0015, is the directory's normal case.
   */
  invitations: {
    id: string;
    greeting_name: string;
    owner_sender_id: string;
    dispatch_recipient_guest_id: string | null;
  } | null;
}

function toDirectoryGuest(row: DirectoryRow): DirectoryGuest {
  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    phoneE164: row.phone_e164,
    isChild: row.is_child,
    createdAt: row.created_at,
    household:
      row.invitations === null
        ? null
        : {
            invitationId: row.invitations.id,
            greetingName: row.invitations.greeting_name,
            ownerSenderId: row.invitations.owner_sender_id,
            recipientGuestId: row.invitations.dispatch_recipient_guest_id,
          },
  };
}

/**
 * Every guest at this wedding, placed or not.
 *
 * UNORDERED ON PURPOSE. `buildGuestDirectory` sorts with a Spanish collator,
 * which Postgres cannot be relied on to match: the ordering a reader sees is a
 * presentation decision, it is unit-tested where it is made, and having the
 * database also have an opinion is how two orders drift apart.
 */
export async function listGuestDirectory(
  client: SupabaseClient,
): Promise<readonly DirectoryGuest[]> {
  const { data, error } = await client
    .from("invitation_guests")
    .select(DIRECTORY_COLUMNS);

  if (error) {
    throw new Error(`Could not read the guest directory: ${error.message}`);
  }

  return (data as unknown as DirectoryRow[]).map(toDirectoryGuest);
}

/**
 * The people an invitation may still take.
 *
 * A filtered query rather than reading everybody and discarding most of them:
 * migration 0015 created `invitation_guests_unassigned_idx` over exactly these
 * rows, and this is the read it was created for.
 *
 * It answers the FIRST half of the couple's rule — "no se debería poder
 * escoger en una próxima invitación" — by never offering somebody already
 * placed. `placeGuestInInvitation` answers the second half, which is the one
 * that survives a stale page.
 */
export async function listFreeGuests(
  client: SupabaseClient,
): Promise<readonly DirectoryGuest[]> {
  const { data, error } = await client
    .from("invitation_guests")
    .select(DIRECTORY_COLUMNS)
    .is("invitation_id", null);

  if (error) {
    throw new Error(`Could not read the free guests: ${error.message}`);
  }

  return (data as unknown as DirectoryRow[]).map(toDirectoryGuest);
}

/**
 * Puts a guest from the directory into a household.
 *
 * THE GUARD IS A `WHERE`, NOT A READ FOLLOWED BY A WRITE, and that is the whole
 * design. `invitation_id is null` travels inside the UPDATE, so two operators
 * submitting the same person from two phones cannot both win: one statement
 * matches a row and the other matches none. A read-then-write leaves a window
 * between the check and the write in which the honest answer changes, and the
 * loser silently takes somebody out of the other household.
 *
 * Answers `false` rather than throwing, because "somebody got there first" is
 * news for the operator and not a fault — and a thrown message would reach them
 * as an opaque digest anyway.
 */
export async function placeGuestInInvitation(
  client: SupabaseClient,
  guestId: string,
  invitationId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("invitation_guests")
    .update({ invitation_id: invitationId })
    .eq("id", guestId)
    .is("invitation_id", null)
    .select("id");

  if (error) {
    throw new Error(
      `Could not add guest ${guestId} to invitation ${invitationId}: ${error.message}`,
    );
  }

  return (data ?? []).length === 1;
}

/**
 * Writes a person down, belonging to nobody yet.
 *
 * The refusal is RETURNED rather than thrown, the way `addMember` returns its
 * own: Next replaces a thrown message with an opaque digest before it reaches a
 * browser, so prose thrown from here is readable only in a server log. The
 * Spanish lives in the console beside the field it is about.
 */
export async function createDirectoryGuest(
  client: SupabaseClient,
  input: DirectoryGuestInput,
  defaultCountry: CountryCode,
): Promise<{
  readonly refusals: readonly DraftRefusal[];
  readonly guest: DirectoryGuest | null;
}> {
  const refusals = validateDirectoryGuest(input);

  if (refusals.length > 0) {
    return { refusals, guest: null };
  }

  const { data, error } = await client
    .from("invitation_guests")
    .insert({
      // The whole point of this repository. 0015 made the column nullable so a
      // guest can be written down before anybody decides who they sit with.
      invitation_id: null,
      full_name: input.fullName.trim(),
      nickname: usableNickname(input.nickname),
      phone_e164: storablePhone(input.phone, defaultCountry),
      // Meaningless for somebody in no household — the one-primary index is
      // scoped to an invitation — and false is the honest value for it.
      is_primary: false,
      is_child: input.isChild,
    })
    .select(DIRECTORY_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(
      `Could not add "${input.fullName}" to the directory: ${error?.message ?? "no row returned"}`,
    );
  }

  return {
    refusals: [],
    guest: toDirectoryGuest(data as unknown as DirectoryRow),
  };
}

/**
 * Corrects a guest's own details.
 *
 * `invitation_id` IS NOT IN THE UPDATE, and its absence is the point. Correcting
 * a name from the directory must never move somebody out of the household they
 * are in — that would empty an invitation as a side effect of fixing a typo,
 * and it would do it silently.
 */
export async function updateDirectoryGuest(
  client: SupabaseClient,
  guestId: string,
  edit: DirectoryGuestInput,
  defaultCountry: CountryCode,
): Promise<readonly DraftRefusal[]> {
  const refusals = validateDirectoryGuest(edit);

  if (refusals.length > 0) {
    return refusals;
  }

  const { error } = await client
    .from("invitation_guests")
    .update({
      full_name: edit.fullName.trim(),
      nickname: usableNickname(edit.nickname),
      phone_e164: storablePhone(edit.phone, defaultCountry),
      is_child: edit.isChild,
    })
    .eq("id", guestId);

  if (error) {
    throw new Error(`Could not update guest ${guestId}: ${error.message}`);
  }

  return [];
}

/**
 * Removes a person from the wedding entirely.
 *
 * IT DELETES A PLACED GUEST TOO, and the invitation survives it. Refusing until
 * they were removed from their household first would sound safer and be worse:
 * the operator would have to go and do, in another screen, the exact thing they
 * just asked for. An invitation losing a member is the ordinary case the
 * console has always handled — and if that member was its chosen recipient,
 * `invitations_dispatch_recipient_fk` clears the choice rather than cascading.
 */
export async function deleteDirectoryGuest(
  client: SupabaseClient,
  guestId: string,
): Promise<void> {
  const { error } = await client
    .from("invitation_guests")
    .delete()
    .eq("id", guestId);

  if (error) {
    throw new Error(`Could not delete guest ${guestId}: ${error.message}`);
  }
}

/** An emptied field is not a nickname; it is the absence of one. */
function usableNickname(nickname: string | null): string | null {
  const trimmed = nickname?.trim() ?? "";

  return trimmed === "" ? null : trimmed;
}

/**
 * The same strict normalisation the importer and the inline editor use.
 *
 * A directory that stored whatever a phone keyboard produced would become a
 * second way for a badly-shaped number into the database, and the gate matches
 * on the last eight digits of what is stored.
 */
function storablePhone(
  raw: string,
  defaultCountry: CountryCode,
): string | null {
  const trimmed = raw.trim();

  return trimmed === "" ? null : normalizeForStorage(trimmed, defaultCountry);
}
