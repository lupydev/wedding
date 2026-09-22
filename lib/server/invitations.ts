import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountryCode } from "libphonenumber-js";

import {
  assembleConsoleRows,
  type ConsoleDispatchEvent,
  type ConsoleLatestAnswer,
  type ConsoleListRow,
} from "@/lib/domain/console-list";
import {
  resolveGreetingName,
  type GreetingNameSource,
} from "@/lib/domain/greeting-name";
import {
  canMoveMember,
  validateInvitationDraft,
  type DraftRefusal,
  type InvitationDraftMember,
  type MoveRefusal,
} from "@/lib/domain/invitation-draft";
import {
  canDeleteInvitation,
  type DeletionOutcome,
} from "@/lib/domain/invitation-deletion";
import { normalizeForStorage, type GuestPhoneRef } from "@/lib/domain/phone";

import { placeGuestInInvitation } from "./guest-directory";
import { encodeSlug, SLUG_BYTE_LENGTH } from "@/lib/domain/slug";
import { nextFreeSlug, slugifyName } from "@/lib/domain/slug-from-name";
import { isWellFormedUuid } from "@/lib/domain/uuid";
import { warmOgCard } from "@/lib/server/og-warm";

/**
 * Invitation repository and import validation.
 *
 * Two responsibilities that must not be confused:
 *
 *  - `validateImportRow` is the STRICT side of the boundary. It runs once, at
 *    import, and fails loudly. An unusable owner or an unnormalizable phone
 *    must stop the import at the row that introduced it, not surface weeks
 *    later as a guest who cannot open their own invitation.
 *  - `toGuestFacingInvitation` is the read side. It exists so that no code path
 *    can accidentally hand a phone number to a browser: the mapper simply has
 *    no phone field to leak.
 */

export interface ImportGuest {
  readonly fullName: string;
  /** How this person is actually called. Absent for most guests. */
  readonly nickname?: string | null;
  readonly phone?: string;
  readonly isPrimary?: boolean;
  readonly isChild?: boolean;
}

export interface ImportRow {
  readonly ownerEmail: string;
  readonly displayName: string;
  readonly greetingName: string;
  /**
   * Optional stable identity of this household in the source file.
   *
   * Omitted, it is derived from owner + display name, which is what makes a
   * re-run of the same source a no-op instead of a duplicate. Two genuinely
   * different households that share both an owner and a display name must
   * declare their own keys — the import refuses the file otherwise rather than
   * quietly importing one of them.
   */
  readonly sourceKey?: string;
  readonly guests: readonly ImportGuest[];
}

/** Allowlisted operator email → `senders.id`. Built from the senders table. */
export type SenderDirectory = Readonly<Record<string, string>>;

export interface NewInvitationGuest {
  readonly fullName: string;
  /**
   * Set when this member is somebody the DIRECTORY already holds.
   *
   * Since migration 0015 a guest can be written down before any household
   * exists, so creating an invitation is no longer only "type these people".
   * A member carrying an id is MOVED into the new household; one without is
   * written for the first time. The name still travels either way, for
   * validation and for the error messages, but for a picked member it is
   * display only — the directory owns their details.
   */
  readonly existingGuestId?: string | null;
  /** How this member is addressed. Absent for most guests. */
  readonly nickname?: string | null;
  readonly phoneE164: string | null;
  readonly isPrimary: boolean;
  readonly isChild: boolean;
}

export interface NewInvitation {
  readonly ownerSenderId: string;
  /**
   * Set for every imported invitation; absent for any created by another path.
   * `importInvitations` requires it, because idempotency has no meaning
   * without a key to be idempotent on.
   */
  readonly sourceKey?: string | null;
  /**
   * The console's own label for this household.
   *
   * OPTIONAL, because the form stopped asking for it. Left out, it becomes the
   * greeting the invitation resolved to — which is what every screen shows
   * anyway. The importer still supplies one, because its file is the source of
   * truth for the households it describes.
   */
  readonly displayName?: string;
  readonly greetingName: string;
  /**
   * Why `greetingName` says what it says. Defaults to `imported`, the column's
   * own default: a script wrote the name and nobody has looked at it yet, so
   * nothing may overwrite it. A console draft states `derived` or `custom`.
   */
  readonly greetingNameSource?: GreetingNameSource;
  /**
   * Who receives the message, given as a POSITION in `guests`.
   *
   * A position and not an id, because at the moment the console's form is
   * submitted there are no ids: these people are written by this very call.
   * Left out by the importer, which has no opinion about who to write to.
   */
  readonly dispatchRecipientIndex?: number;
  readonly guests: readonly NewInvitationGuest[];
}

export interface InvitationGuestRecord extends NewInvitationGuest {
  readonly id: string;
  readonly phoneLast8: string | null;
}

export interface InvitationRecord {
  readonly id: string;
  readonly slug: string;
  readonly ownerSenderId: string;
  readonly displayName: string;
  readonly greetingName: string;
  readonly guests: readonly InvitationGuestRecord[];
}

/** Exactly what a guest-facing surface is allowed to see. No phone field exists. */
export interface GuestFacingGuest {
  readonly id: string;
  readonly fullName: string;
  readonly isChild: boolean;
}

export interface GuestFacingInvitation {
  readonly slug: string;
  readonly displayName: string;
  readonly greetingName: string;
  readonly guests: readonly GuestFacingGuest[];
}

function requireText(value: string | undefined, field: string): string {
  const trimmed = value?.trim() ?? "";

  if (trimmed === "") {
    throw new Error(`Import row is missing a value for ${field}.`);
  }

  return trimmed;
}

/**
 * The nickname an import row supplies, or `null` for one that supplies none.
 *
 * Never `undefined`: the column is nullable and a guest with no nickname falls
 * through to the guest-naming capability's full-name and first-name fallbacks,
 * which is a different thing from a field that was never considered. An
 * emptied value is the absence of a nickname, not a nickname that is blank.
 */
function importedNickname(guest: ImportGuest): string | null {
  return guest.nickname?.trim() || null;
}

/**
 * Validates one import row and resolves its owner to a single sender id.
 *
 * Sender ownership is mandatory at creation: `invitations.owner_sender_id` is
 * NOT NULL and there is no unassigned queue and no claim flow. A row with a
 * missing or unrecognized owner is therefore a hard failure, never an
 * invitation created without one.
 */
export function validateImportRow(
  row: ImportRow,
  senders: SenderDirectory,
  defaultCountry: CountryCode,
): NewInvitation {
  const displayName = requireText(row.displayName, "display_name");
  const greetingName = requireText(row.greetingName, "greeting_name");
  const ownerEmail = requireText(row.ownerEmail, "owner").toLowerCase();
  const ownerSenderId = senders[ownerEmail];

  if (!ownerSenderId) {
    throw new Error(
      `Import row "${displayName}" has an unrecognized owner: ${ownerEmail}. Every invitation must be owned by a known sender.`,
    );
  }

  if (row.guests.length === 0) {
    throw new Error(
      `Import row "${displayName}" lists no guests. An invitation is a household of at least one named guest.`,
    );
  }

  const primaries = row.guests.filter((guest) => guest.isPrimary === true);
  if (primaries.length > 1) {
    throw new Error(
      `Import row "${displayName}" marks ${primaries.length} guests as primary. At most one primary guest is allowed per invitation.`,
    );
  }

  const guests = row.guests.map((guest) => {
    const fullName = requireText(guest.fullName, "full_name");
    const raw = guest.phone?.trim() ?? "";

    if (raw === "") {
      // A phone-less guest is legitimate — a child, or a household member who
      // shares the link. `phone_e164` stays NULL, and the DB's generated
      // `phone_last8` is NULL too, so nothing at the gate can ever match them.
      return {
        fullName,
        nickname: importedNickname(guest),
        phoneE164: null,
        isPrimary: guest.isPrimary === true,
        isChild: guest.isChild === true,
      };
    }

    let phoneE164: string;
    try {
      phoneE164 = normalizeForStorage(raw, defaultCountry);
    } catch (cause) {
      // The raw number is deliberately kept out of the message: guest phone
      // numbers are personal data and import errors reach logs.
      throw new Error(
        `Import row "${displayName}" has an unusable phone for guest "${fullName}": ${(cause as Error).message}`,
      );
    }

    return {
      fullName,
      nickname: importedNickname(guest),
      phoneE164,
      isPrimary: guest.isPrimary === true,
      isChild: guest.isChild === true,
    };
  });

  return {
    ownerSenderId,
    sourceKey:
      row.sourceKey?.trim() || deriveSourceKey(ownerEmail, displayName),
    displayName,
    greetingName,
    guests,
  };
}

/**
 * The household's identity in the source file, when the file does not state one.
 *
 * Owner plus display name, because that is what a person editing the source
 * would call the same household on a second run. It deliberately excludes
 * seats, deadline and guest list: re-running after fixing a typo must not
 * create a second invitation for the same family.
 */
function deriveSourceKey(ownerEmail: string, displayName: string): string {
  return `${ownerEmail}|${displayName.toLowerCase()}`;
}

/**
 * Validates a whole source file, not just a row.
 *
 * The extra guarantee over mapping `validateImportRow` is collision detection.
 * Two rows sharing a source key would be collapsed into one by the idempotent
 * insert, and one household would silently never be invited — a failure that
 * looks exactly like a successful import. It is a hard error instead.
 */
export function validateImportRows(
  rows: readonly ImportRow[],
  senders: SenderDirectory,
  defaultCountry: CountryCode,
): NewInvitation[] {
  const validated = rows.map((row) =>
    validateImportRow(row, senders, defaultCountry),
  );

  const seen = new Map<string, string>();
  for (const invitation of validated) {
    const key = invitation.sourceKey ?? "";
    const previous = seen.get(key);

    if (previous !== undefined) {
      throw new Error(
        `Import rows "${previous}" and "${invitation.displayName}" share one source key: ${key}. ` +
          "Give at least one of them an explicit sourceKey so both are imported.",
      );
    }

    seen.set(key, nameOf(invitation));
  }

  return validated;
}

/**
 * What to call an invitation in a message about it.
 *
 * `displayName` became optional when the console stopped asking for it, and an
 * error naming "undefined" is worse than one naming the greeting. Every import
 * row carries a display name, but the type cannot know that.
 */
function nameOf(invitation: NewInvitation): string {
  return invitation.displayName?.trim() || invitation.greetingName;
}

/**
 * Projects an invitation onto exactly what a guest may see.
 *
 * `phone_e164` and `phone_last8` are dropped here, at the only place a record
 * crosses into guest-facing rendering. The mapper is a projection rather than a
 * redaction on purpose: an added column cannot leak by being forgotten,
 * because it is never copied in the first place.
 */
export function toGuestFacingInvitation(
  record: InvitationRecord,
): GuestFacingInvitation {
  return {
    slug: record.slug,
    displayName: record.displayName,
    greetingName: record.greetingName,
    guests: record.guests.map((guest) => ({
      id: guest.id,
      fullName: guest.fullName,
      isChild: guest.isChild,
    })),
  };
}

/**
 * The server-side counterpart: the last-8 refs the phone gate compares against.
 *
 * Deliberately a separate function from `toGuestFacingInvitation` so the two
 * audiences can never be confused by a single "options" flag.
 */
export function toGatePhoneRefs(
  record: InvitationRecord,
): readonly GuestPhoneRef[] {
  return record.guests.map((guest) => ({ phone_last8: guest.phoneLast8 }));
}

/** Mints a fresh 80-bit slug. Randomness comes from the adapter (design D2). */
export function mintSlug(): string {
  return encodeSlug(randomBytes(SLUG_BYTE_LENGTH));
}

/**
 * The address a new invitation is created at, derived from its own name.
 *
 * `/i/familia-guzman-pena` rather than `/i/k22eth3lvkzptcco`, because that is a
 * link two people send to their families over WhatsApp.
 *
 * DERIVED ONCE, HERE, AND NEVER AGAIN. Nothing recomputes it when the name is
 * edited: an address that followed the name would die the moment somebody
 * corrected a typo, and it would die SILENTLY — the console shows nothing
 * wrong, and only the guest meets "no encontramos esta invitación".
 * `rotateInvitationSlug` stays random, which is what an address should be once
 * it has had to be changed at all.
 *
 * One indexed query for the names already taken, then pure arithmetic in
 * `nextFreeSlug`. A name that spells nothing a URL can carry — emoji, say —
 * falls back to a random slug: uglier, and working.
 */
export async function readableSlugFor(
  client: SupabaseClient,
  name: string,
  alsoTaken: ReadonlySet<string> = new Set(),
): Promise<string> {
  const base = slugifyName(name);

  if (base === "") {
    return mintSlug();
  }

  /*
   * `eq` OR `like`, because the counter is a suffix: "familia-ruiz" and
   * "familia-ruiz-2" both belong to this family of names, and "familia-ruiza"
   * does not. The base holds only `[a-z0-9-]`, so it carries no `like`
   * wildcards of its own.
   */
  const { data, error } = await client
    .from("invitations")
    .select("slug")
    .or(`slug.eq.${base},slug.like.${base}-%`);

  if (error) {
    throw new Error(`Could not read the addresses in use: ${error.message}`);
  }

  const taken = new Set<string>(alsoTaken);

  for (const row of (data ?? []) as readonly { slug: string }[]) {
    taken.add(row.slug);
  }

  return nextFreeSlug(base, taken);
}

interface InvitationRow {
  id: string;
  slug: string;
  owner_sender_id: string;
  display_name: string;
  greeting_name: string;
  invitation_guests: {
    id: string;
    full_name: string;
    nickname: string | null;
    phone_e164: string | null;
    phone_last8: string | null;
    is_primary: boolean;
    is_child: boolean;
  }[];
}

// The embed names its FOREIGN KEY, not just the table. Since 0012 two
// constraints join these tables in opposite directions — a guest's
// `invitation_id` and an invitation's `dispatch_recipient_guest_id` — and
// PostgREST refuses an ambiguous embed with "more than one relationship was
// found". Naming the constraint says which direction this read means.
const INVITATION_SELECT =
  "id, slug, owner_sender_id, display_name, greeting_name, " +
  /*
    THE NICKNAME IS IN HERE NOW, AND ITS ABSENCE WAS A REAL DEFECT.

    The couple reported "le puse apodo, sin embargo en la creación de la
    invitación no registró el apodo". It WAS registered — the member row holds
    it and the greeting is derived from it, both proven against the database.
    This projection simply never asked for it, so the one screen they spend
    their time on could not show it, which from the outside is
    indistinguishable from not having been saved.
  */
  "invitation_guests!invitation_guests_invitation_id_fkey(id, full_name, nickname, phone_e164, phone_last8, is_primary, is_child)";

function toRecord(row: InvitationRow): InvitationRecord {
  return {
    id: row.id,
    slug: row.slug,
    ownerSenderId: row.owner_sender_id,
    displayName: row.display_name,
    greetingName: row.greeting_name,
    guests: row.invitation_guests.map((guest) => ({
      id: guest.id,
      fullName: guest.full_name,
      nickname: guest.nickname,
      phoneE164: guest.phone_e164,
      phoneLast8: guest.phone_last8,
      isPrimary: guest.is_primary,
      isChild: guest.is_child,
    })),
  };
}

/**
 * The `greeting_name` / `greeting_name_source` column pair — the ONE place the
 * two are produced (design.md §8).
 *
 * They are returned together, from one function, because that is the whole
 * mitigation: two write sites is how a stored name and the source that explains
 * it drift apart, and `greeting_name_source` exists precisely so "should this be
 * re-derived?" is a stored fact rather than a guess made from the text.
 *
 * At `derived` the stored string is ignored and the name is recomputed from the
 * members handed in. `deriveGreetingName` throws on an empty list by design, and
 * every caller here refuses a memberless invitation BEFORE reaching this
 * function, so that throw is unreachable through the write path.
 */
function greetingNameColumns(input: {
  readonly source: GreetingNameSource;
  readonly stored: string;
  readonly members: readonly InvitationDraftMember[];
}): { greeting_name: string; greeting_name_source: GreetingNameSource } {
  return {
    greeting_name: resolveGreetingName({
      source: input.source,
      stored: input.stored,
      members: input.members,
    }),
    greeting_name_source: input.source,
  };
}

/** One new guest as the pure draft validator sees them: no id yet, by definition. */
function toDraftMember(guest: NewInvitationGuest): InvitationDraftMember {
  return {
    id: null,
    fullName: guest.fullName,
    nickname: guest.nickname ?? null,
    phoneE164: guest.phoneE164,
    isChild: guest.isChild,
    // Reachability is an advisory about a CHOSEN recipient, and a member who
    // has no id yet cannot have been chosen. Nothing here can consume it.
    dispatchable: guest.phoneE164 !== null,
  };
}

/**
 * Creates an invitation and its guests.
 *
 * ONE WRITE PATH FOR A SOLO GUEST AND FOR A GROUP
 *
 * A solo guest is a one-member invitation, not a different kind of thing, so
 * there is no second function and no mode flag for them. The member count only
 * ever changes what `deriveGreetingName` produces.
 *
 * The draft is validated by the same pure `validateInvitationDraft` the form and
 * the Server Action use, BEFORE the first statement is issued: a refusal must
 * cost nothing and leave nothing behind.
 *
 * If the guest insert fails the invitation row is removed again, because an
 * invitation with no guests can never be unlocked by anyone and would sit in
 * the console looking valid. Postgres has no cross-statement transaction over
 * PostgREST, so the compensation is explicit.
 */
export async function createInvitation(
  client: SupabaseClient,
  input: NewInvitation,
): Promise<InvitationRecord> {
  const members = input.guests.map(toDraftMember);
  const source = input.greetingNameSource ?? "imported";
  /*
    ONE NAME, NOT TWO.

    The console used to ask for a "nombre del hogar" AND a "nombre del grupo".
    Only the second is ever shown — every list, heading and label reads
    `greeting_name`, and `display_name` surfaces on exactly one screen, in the
    sentence confirming a deletion. So the form asked a non-technical operator
    to invent a value she would never see again, with nothing on screen saying
    so.

    The column stays: it is what error messages and that sentence name. It just
    stops being asked for, and falls back to the greeting the invitation
    actually resolved to, so the internal label and the name on screen can no
    longer disagree. A caller that supplies one on purpose — the importer,
    whose file is the source of truth for the households it describes — keeps
    it.
  */
  const naming = greetingNameColumns({
    source,
    stored: input.greetingName,
    members,
  });
  const displayName = input.displayName?.trim() || naming.greeting_name;
  const { refusals } = validateInvitationDraft({
    displayName,
    greetingName: input.greetingName,
    greetingNameSource: source,
    members,
    // A member that has never been written cannot have been chosen to receive
    // the message, so creation never carries a recipient.
    dispatchRecipientGuestId: null,
  });

  if (refusals.length > 0) {
    throw new Error(
      `Could not create invitation "${displayName}": ${refusalMessage(refusals)}. Nothing was written.`,
    );
  }

  // Derived from the household's own name, and frozen from here on.
  const slug = await readableSlugFor(client, input.greetingName);

  const { data: invitation, error: invitationError } = await client
    .from("invitations")
    .insert({
      slug,
      owner_sender_id: input.ownerSenderId,
      display_name: displayName,
      ...naming,
      source_key: input.sourceKey ?? null,
    })
    .select("id")
    .single();

  if (invitationError || !invitation) {
    throw new Error(
      `Could not create invitation "${input.displayName}": ${invitationError?.message ?? "no row returned"}`,
    );
  }

  /*
    PICKED PEOPLE ARE MOVED FIRST, TYPED PEOPLE ARE WRITTEN SECOND.

    The order is the whole reason a refusal leaves nothing behind. A member
    already in the directory can be taken by the other operator between the
    moment this form rendered and the moment it was submitted — the picker only
    offers free guests, but a page that was correct when it loaded can be wrong
    when it is sent. If that happens, the compensation below deletes the
    invitation, which RELEASES every member already moved back into the
    directory where they came from (0015: `on delete set null`), and no typed
    person has been written yet, so nothing is created and nothing leaks.

    Doing it the other way round would leave the typed names stranded in the
    directory as people nobody meant to put there.
  */
  for (const guest of input.guests) {
    if (!guest.existingGuestId) {
      continue;
    }

    const placed = await placeGuestInInvitation(
      client,
      guest.existingGuestId,
      invitation.id,
    );

    if (placed) {
      continue;
    }

    await client.from("invitations").delete().eq("id", invitation.id);

    throw new Error(
      `No se pudo crear «${input.displayName}»: ${guest.fullName} ya pertenece a otra invitación. Actualizá la lista y volvé a intentarlo.`,
    );
  }

  const typedGuests = input.guests.filter((guest) => !guest.existingGuestId);

  /*
    THE INSERTED ROWS COME BACK, BECAUSE A POSITION HAS TO BECOME A PERSON.

    The form answers "who receives the message" with a position — it has no ids
    to offer for somebody being written right now — and `RETURNING` hands the
    rows back in the order they were given, which is what turns that position
    into the id recorded below.
  */
  const { data: insertedGuests, error: guestsError } =
    typedGuests.length === 0
      ? { data: [] as { id: string }[], error: null }
      : await client
          .from("invitation_guests")
          .insert(
            typedGuests.map((guest) => ({
              invitation_id: invitation.id,
              full_name: guest.fullName,
              nickname: guest.nickname ?? null,
              phone_e164: guest.phoneE164,
              is_primary: guest.isPrimary,
              is_child: guest.isChild,
            })),
          )
          .select("id");

  if (guestsError) {
    // D21. The compensation's OWN result is captured, not discarded. A failed
    // compensation leaves a guestless invitation that can never be unlocked and
    // that looks valid in the console, so the operator is told it exists and is
    // given the two values needed to find it — otherwise they are told the
    // wrong thing and handed no row to act on.
    const { error: compensationError } = await client
      .from("invitations")
      .delete()
      .eq("id", invitation.id);

    if (compensationError) {
      throw new Error(
        `Could not create guests for invitation "${input.displayName}": ${guestsError.message}. ` +
          `The empty invitation could not be removed either: ${compensationError.message}. ` +
          `It is still present with id ${invitation.id} and slug ${slug}, has no members, ` +
          "and must be deleted by hand.",
      );
    }

    throw new Error(
      `Could not create guests for invitation "${input.displayName}": ${guestsError.message}`,
    );
  }

  /*
    THE CHOICE, RESOLVED AND RECORDED.

    A separate statement, because the invitation row exists before its members
    do and there was no id to point at until the insert above returned. The
    composite foreign key on `(id, dispatch_recipient_guest_id)` refuses anyone
    outside this household, which is what makes resolving by position safe.

    Without this every invitation born in the console arrived unchosen — listed
    under "Sin destinatario elegido", waiting for somebody to reopen it and
    finish what they thought they had already finished.

    A failure here leaves the invitation created and unchosen: exactly that old
    state, recoverable from the edit screen, and not worth deleting a household
    somebody just typed in. So it is reported, not compensated.
  */
  /*
    THE FORM'S ORDER, REBUILT — because the index means a position in the list
    the operator was looking at, and that list interleaves the two kinds. An
    index resolved against only the freshly inserted rows would name the wrong
    person whenever a picked member sits earlier in the list, which is a defect
    that looks exactly like a working one.
  */
  let nextInserted = 0;
  const memberIds = input.guests.map(
    (guest) => guest.existingGuestId ?? insertedGuests?.[nextInserted++]?.id,
  );
  const chosen = memberIds[input.dispatchRecipientIndex ?? -1];

  if (chosen) {
    const { error: recipientError } = await client
      .from("invitations")
      .update({ dispatch_recipient_guest_id: chosen })
      .eq("id", invitation.id);

    if (recipientError) {
      throw new Error(
        `Invitation "${input.displayName}" was created, but nobody could be recorded as the recipient: ${recipientError.message}. Choose one from the edit screen.`,
      );
    }
  }

  const created = await findInvitationBySlug(client, slug);

  if (!created) {
    throw new Error(
      `Invitation "${input.displayName}" was created but could not be read back.`,
    );
  }

  return created;
}

/** The invitation's OWN fields an operator may rewrite from the edit form. */
export interface InvitationEdit {
  /** Optional for the same reason as on creation: the form stopped asking. */
  readonly displayName?: string;
  readonly greetingName: string;
  readonly greetingNameSource: GreetingNameSource;
}

/**
 * Rewrites one invitation's own fields — never its membership.
 *
 * The greeting pair is written by `greetingNameColumns`, exactly as creation
 * and every membership change write it (design §8), so a `derived` invitation
 * re-derives from the members it actually has right now and the submitted
 * string is ignored. Trusting the round-tripped copy instead is how a field the
 * browser has been holding since page load overwrites a name the current
 * members no longer agree with.
 *
 * The draft is validated before the statement, by the same pure function the
 * form and the Server Action call, so a refusal costs nothing and leaves the
 * stored name exactly as it was.
 */
/**
 * One guest, their own invitation, in one press.
 *
 * The couple asked for it in those terms: "enviar la invitación individual… sin
 * necesidad de pertenecer a una invitación, estas son para grupos familiares de
 * 2 o más personas". An invitation is still the thing that gets sent — it
 * carries the address, the phone gate and the audit trail — so this mints a
 * ONE-PERSON one rather than inventing a second kind of send that would need
 * its own copy of every guard.
 *
 * THE ADDRESS IS THEIR FULL NAME AND THE GREETING IS THEIR NICKNAME, which is
 * not an inconsistency: `greetingName` feeds the slug, and a `derived` source
 * makes the STORED greeting come from the member instead. So Marta Ruiz, known
 * as Tita, lives at `/i/marta-ruiz` and is greeted as "Tita" — the couple's own
 * rule, "el slug sea… el de la persona individual el nombre completo".
 *
 * It composes `createInvitation` rather than writing rows of its own, so the
 * refusal for a guest somebody else already took, the compensation that leaves
 * nothing behind, and the recipient being recorded all come for free.
 */
export async function createSoloInvitation(
  client: SupabaseClient,
  ownerSenderId: string,
  guestId: string,
): Promise<InvitationRecord> {
  const { data, error } = await client
    .from("invitation_guests")
    .select("id, full_name, nickname, phone_e164, is_child, invitation_id")
    .eq("id", guestId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read guest ${guestId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Guest ${guestId} does not exist.`);
  }

  const guest = data as {
    full_name: string;
    nickname: string | null;
    phone_e164: string | null;
    is_child: boolean;
    invitation_id: string | null;
  };

  /*
    CHECKED HERE AND AGAIN INSIDE, AND BOTH EARN THEIR PLACE.

    This one exists to give the operator a sentence they can act on. The other
    is `placeGuestInInvitation`'s `invitation_id is null`, which travels inside
    the UPDATE and is what actually makes a race impossible — this read could
    go stale between the two statements, and the second one cannot.
  */
  if (guest.invitation_id !== null) {
    throw new Error(
      `${guest.full_name} ya pertenece a una invitación, así que no se le puede crear una individual. Actualizá la lista.`,
    );
  }

  return createInvitation(client, {
    ownerSenderId,
    displayName: guest.full_name,
    // Feeds the SLUG. The stored greeting is derived from the member below.
    greetingName: guest.full_name,
    greetingNameSource: "derived",
    guests: [
      {
        fullName: guest.full_name,
        nickname: guest.nickname,
        phoneE164: guest.phone_e164,
        isPrimary: true,
        isChild: guest.is_child,
        existingGuestId: guestId,
      },
    ],
    // The only member, and therefore the only possible recipient. An invitation
    // arriving unchosen would land the operator on a dispatch screen that
    // refuses — the exact defect the create form already had once.
    dispatchRecipientIndex: 0,
  });
}

export async function updateInvitation(
  client: SupabaseClient,
  invitationId: string,
  edit: InvitationEdit,
): Promise<void> {
  const membership = await readMembership(client, invitationId);
  // The same fallback creation uses, for the same reason: the form no longer
  // asks for a separate label, and the console shows the greeting everywhere.
  const naming = greetingNameColumns({
    source: edit.greetingNameSource,
    stored: edit.greetingName,
    members: membership.members,
  });
  const displayName = edit.displayName?.trim() || naming.greeting_name;
  const { refusals } = validateInvitationDraft({
    displayName,
    greetingName: edit.greetingName,
    greetingNameSource: edit.greetingNameSource,
    members: membership.members,
    dispatchRecipientGuestId: membership.dispatchRecipientGuestId,
  });

  if (refusals.length > 0) {
    throw new Error(
      `Could not update invitation ${invitationId}: ${refusalMessage(refusals)}. Nothing was written.`,
    );
  }

  const { error } = await client
    .from("invitations")
    .update({ display_name: displayName, ...naming })
    .eq("id", invitationId);

  if (error) {
    throw new Error(
      `Could not update invitation ${invitationId}: ${error.message}`,
    );
  }
}

/**
 * ── Member management ───────────────────────────────────────────────────────
 *
 * Add, edit and remove share one shape, and the order of its steps is the rule
 * rather than an implementation detail:
 *
 *   1. read the invitation's CURRENT membership and naming,
 *   2. compute what the membership would be AFTERWARDS, in memory,
 *   3. validate that after-state with the pure `validateInvitationDraft`,
 *   4. only then issue the write, and only then re-derive the group name.
 *
 * Step 3 before step 4 is what makes `deriveGreetingName`'s empty-list throw
 * unreachable through this file: removing the last member is refused by the
 * `no_members` check, so the derivation is never reached with an empty list.
 * A re-derivation placed before the refusal would crash with "cannot derive a
 * greeting name from zero members" instead of telling the operator to delete
 * the invitation — the same action, reported as a bug.
 */

/**
 * What each refusal means, for the two THROWN messages that still exist.
 *
 * Not operator copy, and no longer read by any membership write: `createInvitation`
 * and `updateInvitation` are the last two readers, both of them the whole-form
 * save, which is a separate slice and still throws. The console owns the Spanish
 * for every one of these codes, and the member writes now return the code so it
 * gets used. Deleting this pair is what closes that slice; deleting it now would
 * only move the English into the two template strings below.
 */
const REFUSAL_EXPLANATION: Readonly<Record<DraftRefusal, string>> = {
  no_members:
    "an invitation must keep at least one member, so delete the invitation itself instead",
  member_without_name: "every member needs a name",
  duplicate_member_id: "the same member is listed twice",
  guest_already_invited: "that guest already belongs to another invitation",
  recipient_not_a_member:
    "the chosen recipient does not belong to this invitation",
  custom_name_empty: "a custom group name cannot be blank",
};

function refusalMessage(refusals: readonly DraftRefusal[]): string {
  return refusals
    .map((refusal) => `${refusal} — ${REFUSAL_EXPLANATION[refusal]}`)
    .join("; ");
}

/** An invitation's naming and membership, as the pure validator wants them. */
export interface InvitationMembership {
  readonly greetingName: string;
  readonly greetingNameSource: GreetingNameSource;
  readonly dispatchRecipientGuestId: string | null;
  readonly displayName: string;
  readonly members: readonly (InvitationDraftMember & {
    readonly id: string;
  })[];
}

interface MembershipRow {
  display_name: string;
  greeting_name: string;
  greeting_name_source: GreetingNameSource;
  dispatch_recipient_guest_id: string | null;
  invitation_guests: {
    id: string;
    full_name: string;
    nickname: string | null;
    phone_e164: string | null;
    is_child: boolean;
  }[];
}

/** The embedded resource name every guest read orders by. */
const GUESTS = "invitation_guests";

const MEMBERSHIP_SELECT =
  "display_name, greeting_name, greeting_name_source, " +
  "dispatch_recipient_guest_id, " +
  "invitation_guests!invitation_guests_invitation_id_fkey(id, full_name, nickname, phone_e164, is_child)";

/**
 * Reads one invitation's current naming and membership, or `null`.
 *
 * The read the invitation editor loads from, and the one every membership write
 * below validates against — one select, so the form and the writes can never
 * disagree about what the invitation currently IS. The console list projection
 * cannot serve here: it carries no `nickname` and no `greeting_name_source`, so
 * a form built on it would blank every nickname and re-derive a name somebody
 * wrote by hand.
 *
 * `null` rather than a throw, because a missing invitation is a 404 on a page
 * and an error boundary would report a mistyped URL as a broken server. The
 * callers that cannot proceed without one use `readMembership` below.
 */
export async function findInvitationMembership(
  client: SupabaseClient,
  invitationId: string,
): Promise<InvitationMembership | null> {
  const { data, error } = await client
    .from("invitations")
    .select(MEMBERSHIP_SELECT)
    // A HOUSEHOLD HAS AN ORDER, and Postgres does not keep one for you: an UPDATE
    // relocates the row in the heap, so an unordered read silently reshuffles the
    // household every time anyone edits a member. That reaches the list the guest
    // reads as the authoritative record of who is invited, the console list, and
    // `deriveGreetingName`, whose y/e conjunction is decided by the LAST name.
    // `is_primary` carries the intended order and nothing else (decision 12);
    // `created_at` then `id` make the rest total rather than merely usually stable.
    .order("is_primary", { referencedTable: GUESTS, ascending: false })
    .order("created_at", { referencedTable: GUESTS, ascending: true })
    .order("id", { referencedTable: GUESTS, ascending: true })
    .eq("id", invitationId)
    .maybeSingle<MembershipRow>();

  if (error) {
    throw new Error(
      `Could not read invitation ${invitationId}: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return {
    displayName: data.display_name,
    greetingName: data.greeting_name,
    greetingNameSource: data.greeting_name_source,
    dispatchRecipientGuestId: data.dispatch_recipient_guest_id,
    members: data.invitation_guests.map((guest) => ({
      id: guest.id,
      fullName: guest.full_name,
      nickname: guest.nickname,
      phoneE164: guest.phone_e164,
      isChild: guest.is_child,
      dispatchable: guest.phone_e164 !== null,
    })),
  };
}

/** The same read, for the writes that have nothing to do without it. */
async function readMembership(
  client: SupabaseClient,
  invitationId: string,
): Promise<InvitationMembership> {
  const membership = await findInvitationMembership(client, invitationId);

  if (membership === null) {
    throw new Error(`No invitation with id ${invitationId} exists.`);
  }

  return membership;
}

/**
 * The refusals the resulting membership would raise, BEFORE any statement.
 *
 * ANSWERS, RATHER THAN THROWING.
 *
 * These are the only refusals in this file an OPERATOR can act on, and a thrown
 * one reaches nobody where it matters: Next replaces a thrown message with an
 * opaque `digest` in production expressly to keep server text out of the
 * browser, so the console could only ever say "check your connection" about a
 * rule that will refuse identically on every retry. So the CODE travels and the
 * console owns the copy — the same `DraftRefusal` its client-side validator
 * already returns and already translates.
 *
 * An empty array means the change is permitted. Every OTHER failure below stays
 * a throw: a Supabase error, a missing invitation, a member who belongs to
 * another household. Those are developer-facing invariants, not operator copy.
 */
function membershipRefusals(
  membership: InvitationMembership,
  afterMembers: readonly InvitationDraftMember[],
): readonly DraftRefusal[] {
  const { refusals } = validateInvitationDraft({
    displayName: membership.displayName,
    greetingName: membership.greetingName,
    greetingNameSource: membership.greetingNameSource,
    members: afterMembers,
    // A recipient who is being removed is cleared by the FK, not refused here:
    // the stored choice is checked against the members that remain.
    dispatchRecipientGuestId: afterMembers.some(
      (member) => member.id === membership.dispatchRecipientGuestId,
    )
      ? membership.dispatchRecipientGuestId
      : null,
  });

  return refusals;
}

/**
 * Re-derives and stores the group name for the membership that now exists.
 *
 * A `custom` or `imported` name is a string a person owns; it is returned
 * untouched by `resolveGreetingName` and written back unchanged, together with
 * its source, from the single column-pair function.
 */
async function rewriteGreetingName(
  client: SupabaseClient,
  invitationId: string,
  source: GreetingNameSource,
  stored: string,
  members: readonly InvitationDraftMember[],
): Promise<void> {
  const { error } = await client
    .from("invitations")
    .update(greetingNameColumns({ source, stored, members }))
    .eq("id", invitationId);

  if (error) {
    throw new Error(
      `Members changed but the group name could not be updated on invitation ${invitationId}: ${error.message}`,
    );
  }
}

/** A member being added to an invitation that already exists. */
export interface NewMember {
  readonly fullName: string;
  readonly nickname?: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
}

/** The fields of an existing member an operator may rewrite. */
export interface MemberEdit {
  readonly fullName?: string;
  readonly nickname?: string | null;
  readonly phoneE164?: string | null;
  readonly isChild?: boolean;
}

/**
 * Adds one member to an existing invitation, re-deriving the group name.
 *
 * ANSWERS WITH BOTH THE REFUSALS AND THE ROW, AND THAT ASYMMETRY IS DELIBERATE.
 *
 * `editMember` and `removeMember` answer with codes alone, because a caller of
 * either already holds everything it needs to name what changed. This one does
 * not: it MINTS a row, and the id it mints exists nowhere else until it is
 * returned — `lib/server/invitations.spec.ts` reads it back to prove the member
 * really landed, and a console that added a member without learning their id
 * would have nothing to address the next edit to. Collapsing the three
 * signatures into one shape for the sake of symmetry would have to throw that
 * record away, so it is not collapsed.
 *
 * `guest` is null exactly when `refusals` is non-empty: the refusal returns
 * where the insert would have been, so there is no row to hand back.
 */
export async function addMember(
  client: SupabaseClient,
  invitationId: string,
  member: NewMember,
): Promise<{
  readonly refusals: readonly DraftRefusal[];
  readonly guest: InvitationGuestRecord | null;
}> {
  const membership = await readMembership(client, invitationId);
  const candidate: InvitationDraftMember = {
    id: null,
    fullName: member.fullName,
    nickname: member.nickname ?? null,
    phoneE164: member.phoneE164,
    isChild: member.isChild,
    dispatchable: member.phoneE164 !== null,
  };

  const refusals = membershipRefusals(membership, [
    ...membership.members,
    candidate,
  ]);

  // Exactly where the throw stood: before the insert, so a refused add writes
  // nothing at all rather than writing and reporting.
  if (refusals.length > 0) {
    return { refusals, guest: null };
  }

  const { data, error } = await client
    .from("invitation_guests")
    .insert({
      invitation_id: invitationId,
      full_name: member.fullName,
      nickname: member.nickname ?? null,
      phone_e164: member.phoneE164,
      is_primary: false,
      is_child: member.isChild,
    })
    .select(
      "id, full_name, nickname, phone_e164, phone_last8, is_primary, is_child",
    )
    .single<{
      id: string;
      full_name: string;
      nickname: string | null;
      phone_e164: string | null;
      phone_last8: string | null;
      is_primary: boolean;
      is_child: boolean;
    }>();

  if (error || !data) {
    throw new Error(
      `Could not add a member to invitation ${invitationId}: ${error?.message ?? "no row returned"}`,
    );
  }

  await rewriteGreetingName(
    client,
    invitationId,
    membership.greetingNameSource,
    membership.greetingName,
    [...membership.members, { ...candidate, id: data.id }],
  );

  return {
    refusals: [],
    guest: {
      id: data.id,
      fullName: data.full_name,
      nickname: data.nickname,
      phoneE164: data.phone_e164,
      phoneLast8: data.phone_last8,
      isPrimary: data.is_primary,
      isChild: data.is_child,
    },
  };
}

/**
 * Rewrites one member's own fields, re-deriving the group name.
 *
 * Answers with the refusals that stopped it; an empty array means it happened.
 */
export async function editMember(
  client: SupabaseClient,
  invitationId: string,
  guestId: string,
  edit: MemberEdit,
): Promise<readonly DraftRefusal[]> {
  const membership = await readMembership(client, invitationId);
  const current = membership.members.find((member) => member.id === guestId);

  if (!current) {
    throw new Error(
      `Member ${guestId} does not belong to invitation ${invitationId}.`,
    );
  }

  const edited = {
    ...current,
    ...(edit.fullName === undefined ? {} : { fullName: edit.fullName }),
    ...(edit.nickname === undefined ? {} : { nickname: edit.nickname }),
    ...(edit.phoneE164 === undefined
      ? {}
      : { phoneE164: edit.phoneE164, dispatchable: edit.phoneE164 !== null }),
    ...(edit.isChild === undefined ? {} : { isChild: edit.isChild }),
  };
  const afterMembers = membership.members.map((member) =>
    member.id === guestId ? edited : member,
  );

  const refusals = membershipRefusals(membership, afterMembers);

  if (refusals.length > 0) {
    return refusals;
  }

  const { error } = await client
    .from("invitation_guests")
    .update({
      ...(edit.fullName === undefined ? {} : { full_name: edit.fullName }),
      ...(edit.nickname === undefined ? {} : { nickname: edit.nickname }),
      ...(edit.phoneE164 === undefined ? {} : { phone_e164: edit.phoneE164 }),
      ...(edit.isChild === undefined ? {} : { is_child: edit.isChild }),
    })
    .eq("id", guestId);

  if (error) {
    throw new Error(`Could not edit member ${guestId}: ${error.message}`);
  }

  await rewriteGreetingName(
    client,
    invitationId,
    membership.greetingNameSource,
    membership.greetingName,
    afterMembers,
  );

  return [];
}

/**
 * Removes one member, re-deriving the group name.
 *
 * Removing the LAST member is refused with `no_members`, and the console's copy
 * for that code points at deleting the invitation — because an invitation with
 * no members can never be unlocked by anyone while still looking valid in the
 * console. Answers with the refusals; an empty array means it happened.
 */
export async function removeMember(
  client: SupabaseClient,
  invitationId: string,
  guestId: string,
): Promise<readonly DraftRefusal[]> {
  const membership = await readMembership(client, invitationId);
  const afterMembers = membership.members.filter(
    (member) => member.id !== guestId,
  );

  if (afterMembers.length === membership.members.length) {
    throw new Error(
      `Member ${guestId} does not belong to invitation ${invitationId}.`,
    );
  }

  // The member-count refusal runs HERE, before any derivation and before any
  // statement (design R3): with zero members left there is nothing to derive a
  // name from, and the operator's actual next action is deleting the invitation.
  const refusals = membershipRefusals(membership, afterMembers);

  if (refusals.length > 0) {
    return refusals;
  }

  const { error } = await client
    .from("invitation_guests")
    .delete()
    .eq("id", guestId);

  if (error) {
    throw new Error(`Could not remove member ${guestId}: ${error.message}`);
  }

  await rewriteGreetingName(
    client,
    invitationId,
    membership.greetingNameSource,
    membership.greetingName,
    afterMembers,
  );

  return [];
}

/** Why a move was refused, in the terms the operator can act on. */
const MOVE_REFUSAL_EXPLANATION: Readonly<Record<MoveRefusal, string>> = {
  would_empty_source:
    "it would leave the invitation with no members, so delete the invitation itself instead",
  member_not_in_source:
    "that member does not belong to the invitation moved from",
  same_invitation: "the member already belongs to that invitation",
};

/** One member's move between two existing invitations. */
export interface MemberMove {
  readonly sourceInvitationId: string;
  readonly destinationInvitationId: string;
  readonly memberId: string;
  /**
   * The source's CURRENT member ids and chosen recipient, as the console
   * already holds them.
   *
   * Passed in rather than read here, and that is D25's guarantee made
   * structural: `canMoveMember` decides on these values BEFORE the first
   * statement, so a refused move never becomes SQL and can never contend with
   * `clear_recipient_on_guest_move`. A repository that read them first would
   * have touched the database to answer a question it refuses on.
   */
  readonly sourceMemberIds: readonly string[];
  readonly sourceRecipientGuestId: string | null;
}

/**
 * Moves one member to another invitation.
 *
 * The source's recipient choice, if it was the moved member, is cleared by the
 * `clear_recipient_on_guest_move` trigger — not here. The trigger binds against
 * every writer, including a future script or a forgetful function; an
 * application-level clear would bind only against this one (D11).
 *
 * The destination's own recipient is never touched. Carrying the choice across
 * would be an auto-pick nobody made.
 */
export async function moveMemberToInvitation(
  client: SupabaseClient,
  move: MemberMove,
): Promise<void> {
  const outcome = canMoveMember({
    sourceMemberIds: move.sourceMemberIds,
    memberId: move.memberId,
    sourceRecipientGuestId: move.sourceRecipientGuestId,
    destinationInvitationId: move.destinationInvitationId,
    sourceInvitationId: move.sourceInvitationId,
  });

  if (!outcome.ok) {
    throw new Error(
      `Could not move member ${move.memberId}: ${outcome.reason} — ${MOVE_REFUSAL_EXPLANATION[outcome.reason]}.`,
    );
  }

  const { error } = await client
    .from("invitation_guests")
    .update({ invitation_id: move.destinationInvitationId })
    .eq("id", move.memberId);

  if (error) {
    throw new Error(
      `Could not move member ${move.memberId} to invitation ${move.destinationInvitationId}: ${error.message}`,
    );
  }

  // Both households changed shape, so both derived names are now stale. Read
  // after the move: this is the membership each one actually has.
  for (const invitationId of [
    move.sourceInvitationId,
    move.destinationInvitationId,
  ]) {
    const membership = await readMembership(client, invitationId);
    await rewriteGreetingName(
      client,
      invitationId,
      membership.greetingNameSource,
      membership.greetingName,
      membership.members,
    );
  }
}

/**
 * Records which member of an invitation receives its WhatsApp message.
 *
 * A guest belonging to a DIFFERENT invitation is refused by the composite
 * foreign key `(id, dispatch_recipient_guest_id) → invitation_guests
 * (invitation_id, id)`, which makes a cross-household recipient unrepresentable
 * rather than merely unwritten. There is deliberately no application-level
 * pre-check duplicating it: a second copy of the rule would hide whether the
 * constraint still works, and it is the constraint that binds every writer.
 */
export async function chooseRecipient(
  client: SupabaseClient,
  invitationId: string,
  guestId: string,
): Promise<void> {
  const { error } = await client
    .from("invitations")
    .update({ dispatch_recipient_guest_id: guestId })
    .eq("id", invitationId);

  if (error) {
    throw new Error(
      `Could not choose member ${guestId} as the recipient for invitation ${invitationId}: ${error.message}`,
    );
  }
}

/**
 * Permanently deletes an invitation, members and all — or refuses.
 *
 * ANY `dispatch_events` row refuses, including `link_opened` and
 * `marked_failed`: the link has demonstrably left this system's control, or the
 * operator only BELIEVES it did not arrive, and both mean a real guest may be
 * holding that URL. The refusal names the kinds it found, because "already
 * dispatched" on an invitation nobody remembers sending reads as a bug until it
 * says which events it means.
 *
 * THE REFUSAL IS RETURNED. THE FAULTS ARE STILL THROWN.
 *
 * It used to be thrown, carrying its advice as English prose in the message.
 * That advice reached nobody: Next replaces a thrown message with an opaque
 * `digest` before it crosses to a browser, expressly so server text cannot leak
 * — so the one sentence telling the operator to rotate the slug instead was
 * readable only in a server log. `canDeleteInvitation` already answers with a
 * `DeletionOutcome` carrying the reason and the kinds, so that outcome travels
 * out of here unchanged and the Spanish copy lives in the console, next to the
 * button that offers rotation.
 *
 * A Supabase failure still throws. It is not an operator's decision to make and
 * there is nothing for them to act on in it.
 *
 * Where it is permitted it is a real hard delete. There is no soft-delete
 * state, so no second definition of "exists" that one read could forget to
 * honour (migration `0005`).
 */
export async function deleteInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<DeletionOutcome> {
  const { data, error } = await client
    .from("dispatch_events")
    .select("kind")
    .eq("invitation_id", invitationId);

  if (error) {
    throw new Error(
      `Could not read the dispatch log for invitation ${invitationId}: ${error.message}`,
    );
  }

  // The SECOND piece of evidence that the link escaped, and the more reliable
  // one: `link_opened` depends on a best-effort beacon that can be lost, while
  // an answer can only exist because a guest opened the invitation and replied.
  const { data: answers, error: answerError } = await client
    .from("rsvp_latest")
    .select("id")
    .eq("invitation_id", invitationId)
    .limit(1);

  if (answerError) {
    throw new Error(
      `Could not read the stored answer for invitation ${invitationId}: ${answerError.message}`,
    );
  }

  const outcome = canDeleteInvitation(
    ((data ?? []) as { kind: string }[]).map((event) => ({ kind: event.kind })),
    { hasStoredAnswer: (answers ?? []).length > 0 },
  );

  if (!outcome.ok) {
    return outcome;
  }

  /*
    THE MEMBERS SURVIVE THIS. `invitation_guests.invitation_id` was `on delete
    cascade` until migration 0015 and is now `on delete set null`, so deleting
    the household RELEASES its people into the directory rather than deleting
    them. Asked and answered by the couple: "vuelven a la libreta".

    The invitation's answers and dispatch events still cascade away with it —
    they belong to the invitation, not to the people.
  */
  const { error: deleteError } = await client
    .from("invitations")
    .delete()
    .eq("id", invitationId);

  if (deleteError) {
    throw new Error(
      `Could not delete invitation ${invitationId}: ${deleteError.message}`,
    );
  }

  return { ok: true };
}

/** How a rotation re-warms the card for its new URL. */
export interface RotateSlugOptions {
  /** Injected so a test can watch WHICH slug is warmed without a network. */
  readonly warm?: (slug: string) => Promise<boolean>;
}

/**
 * Gives one invitation a NEW slug — the exit for "dispatched by mistake".
 *
 * THE NEW SLUG IS RANDOM, AND IT IS THE ONLY PATH THAT STILL IS. Creating an
 * invitation derives a readable address from the household's name, and since
 * this commit so does importing one. Rotation deliberately does not: it is the
 * exit for an address that has already had to change, and deriving the same
 * name again would hand back a neighbour of the address being abandoned.
 * Randomness stays in the adapter, so the database keeps no randomness policy
 * (design D2/D16). Rotation is a new ADDRESS for the same invitation: its
 * members, its greeting name, its RSVP history and its dispatch history are all
 * untouched, which is precisely why a rotated invitation is still undeletable
 * if it was ever dispatched.
 *
 * `og_warmed_at` is cleared and the new URL re-warmed, because a CDN keys on the
 * full URL: the new path is a cold cache entry no matter how warm the old one
 * was. Warming never fails the rotation — the slug has already changed by then,
 * and a cold card is a slow preview, not a broken link.
 *
 * What rotation does NOT do is invalidate a crawler's already-cached preview
 * card for the OLD url. That card lives on Meta's infrastructure, and nothing
 * here can reach it.
 */
export async function rotateInvitationSlug(
  client: SupabaseClient,
  invitationId: string,
  options: RotateSlugOptions = {},
): Promise<string> {
  const slug = mintSlug();

  const { error } = await client
    .from("invitations")
    .update({
      slug,
      slug_rotated_at: new Date().toISOString(),
      // The new URL has never been fetched by anybody. Saying otherwise would
      // make the console's "warmed" badge claim a cache entry that is empty.
      og_warmed_at: null,
    })
    .eq("id", invitationId);

  if (error) {
    throw new Error(
      `Could not rotate the slug of invitation ${invitationId}: ${error.message}`,
    );
  }

  // THE SLUG HAS ALREADY CHANGED, so nothing after this point may throw.
  //
  // Warming is a network call and the docblock above promises it never fails the
  // rotation. Without this guard it did: a rejecting warm threw AFTER the row was
  // updated, so the operator saw a failed rotation while the old link was already
  // dead and the new slug — this function's only return value — was lost with the
  // exception. Retrying then minted a THIRD slug. Rotation is the recovery path
  // for "dispatched by mistake"; it must not need recovering from itself.
  //
  // A cold card is a slow first preview. That is the whole cost of swallowing this.
  const warm = options.warm ?? ((next: string) => warmOgCard(client, next));
  try {
    await warm(slug);
  } catch {
    // Deliberately swallowed. `og_warmed_at` is already null, so the next warm
    // attempt — scheduled or manual — still knows this card is cold.
  }

  return slug;
}

/** One household's outcome from an import run. */
export interface ImportedInvitation {
  readonly sourceKey: string;
  readonly slug: string;
  /** `false` when this household was already present from an earlier run. */
  readonly created: boolean;
}

interface ImportedInvitationRow {
  source_key: string;
  slug: string;
  created: boolean;
}

/**
 * Imports every household in ONE database transaction.
 *
 * Atomic: the work happens inside the `import_invitations` SQL function, so a
 * failure on the fortieth household rolls back the first thirty-nine too.
 * `createInvitation`'s per-invitation compensation cannot give that guarantee,
 * because PostgREST has no transaction spanning two requests — it can only
 * undo the invitation whose guest insert it just watched fail.
 *
 * Idempotent: each household carries a `sourceKey`, and the function skips one
 * that is already present. Re-running the same source after a failure is
 * therefore the normal recovery, not a duplicate-producing hazard.
 *
 * Slugs are minted HERE, not in SQL: randomness stays in the adapter (design
 * D2). A skipped household reports the slug it already had, so the operator
 * still gets a usable link from a re-run.
 */
export async function importInvitations(
  client: SupabaseClient,
  invitations: readonly NewInvitation[],
): Promise<readonly ImportedInvitation[]> {
  if (invitations.length === 0) {
    return [];
  }

  /*
    THE ADDRESSES DECIDED IN THIS BATCH, WHICH THE DATABASE CANNOT SEE.

    Every household here is written by ONE `import_invitations` call, so none
    of them is visible to another's lookup. Two families called Ruiz in one
    file would therefore both be handed "familia-ruiz" — where the unique index
    refuses the second and the whole import fails, naming a constraint instead
    of the two families that share a surname.
  */
  const mintedHere = new Set<string>();
  const payload = [];

  for (const invitation of invitations) {
    const sourceKey = invitation.sourceKey?.trim();

    if (!sourceKey) {
      throw new Error(
        `Invitation "${invitation.displayName}" has no source key, so importing it could not be re-run safely.`,
      );
    }

    /*
      READABLE, EXACTLY AS THE CONSOLE'S ARE.

      This minted random base32 while `createInvitation` had been deriving
      `/i/familia-guzman-pena` from the household's name since migration 0014.
      Two ways in and two kinds of address, with the difference visible to the
      guest: families typed into the console got a link that reads like their
      name, families loaded from a file got sixteen characters that read like a
      mistake.

      SAFE ON A RE-RUN because of `on conflict (source_key) do nothing` in
      `import_invitations` (0006). A second run computes a NEW address — the
      first one is taken, so the counter advances — and that value is discarded
      rather than written, leaving the link already in a family's WhatsApp
      exactly where it was.
    */
    const slug = await readableSlugFor(
      client,
      invitation.greetingName,
      mintedHere,
    );

    mintedHere.add(slug);

    payload.push({
      source_key: sourceKey,
      slug,
      owner_sender_id: invitation.ownerSenderId,
      display_name: invitation.displayName,
      greeting_name: invitation.greetingName,
      guests: invitation.guests.map((guest) => ({
        full_name: guest.fullName,
        // `import_invitations` reads this key (migration 0012). Omitted from
        // the payload, an imported nickname is dropped in silence with every
        // other layer still looking correct.
        nickname: guest.nickname ?? null,
        phone_e164: guest.phoneE164,
        is_primary: guest.isPrimary,
        is_child: guest.isChild,
      })),
    });
  }

  const { data, error } = await client.rpc("import_invitations", { payload });

  if (error) {
    throw new Error(
      `Import failed and nothing was written: ${error.message}. Fix the source and run it again.`,
    );
  }

  return ((data ?? []) as ImportedInvitationRow[]).map((row) => ({
    sourceKey: row.source_key,
    slug: row.slug,
    created: row.created,
  }));
}

/** Reads one invitation and its guests by slug. `null` when no such slug exists. */
export async function findInvitationBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<InvitationRecord | null> {
  const { data, error } = await client
    .from("invitations")
    .select(INVITATION_SELECT)
    .order("is_primary", { referencedTable: GUESTS, ascending: false })
    .order("created_at", { referencedTable: GUESTS, ascending: true })
    .order("id", { referencedTable: GUESTS, ascending: true })
    .eq("slug", slug)
    .maybeSingle<InvitationRow>();

  if (error) {
    throw new Error(`Could not read invitation by slug: ${error.message}`);
  }

  return data ? toRecord(data) : null;
}

/**
 * Builds the allowlisted-email → sender-id directory the import validates against.
 *
 * The `senders` table IS the allowlist (design D7). Reading it here rather than
 * accepting a hand-maintained map means the import cannot assign an invitation
 * to a "sender" that does not exist as an authenticatable operator.
 */
export async function listSenderDirectory(
  client: SupabaseClient,
): Promise<SenderDirectory> {
  const { data, error } = await client
    .from("senders")
    .select("id, allowlisted_email");

  if (error) {
    throw new Error(`Could not read the sender directory: ${error.message}`);
  }

  const directory: Record<string, string> = {};
  for (const sender of data ?? []) {
    directory[sender.allowlisted_email] = sender.id;
  }

  return directory;
}

/**
 * The owning sender's WhatsApp contact number.
 *
 * Read separately from the invitation rather than joined into
 * `INVITATION_SELECT`, because it has exactly one consumer — the gate's
 * recovery link — and widening the invitation projection would put a phone
 * number inside the record every guest-facing read already loads.
 *
 * `senders.contact_wa_phone_e164` is NOT NULL and `owner_sender_id` is a
 * required foreign key, so `null` here means the owner row is gone, not that
 * the couple has no number.
 */
export async function findSenderContactPhone(
  client: SupabaseClient,
  senderId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("senders")
    .select("contact_wa_phone_e164")
    .eq("id", senderId)
    .maybeSingle<{ contact_wa_phone_e164: string }>();

  if (error) {
    throw new Error(
      `Could not read the sender contact number: ${error.message}`,
    );
  }

  return data?.contact_wa_phone_e164 ?? null;
}

/**
 * ── The console read side ───────────────────────────────────────────────────
 *
 * The console is the ONE surface authorized to read guest phone numbers: the
 * two operators are the couple, and these are the numbers they typed in. That
 * is why this read exists separately from `toGuestFacingInvitation`, which has
 * no phone field at all — the authorized projection is a different function,
 * not the same function with a flag.
 *
 * THREE READS, NOT ONE JOIN
 *
 * Invitations, current answers and dispatch events are fetched separately and
 * joined by `assembleConsoleRows`. Not for performance — it is three indexed
 * queries either way — but because the answer read MUST go through
 * `rsvp_latest` (migration 0008) and nothing else. A PostgREST embed of
 * `rsvp_responses` would return the whole append-only history per invitation,
 * and any reduction written here would be a second, drifting copy of the rule
 * the view already owns. `rsvp_latest` is one row per invitation by
 * construction, so the join below cannot double-count a household that changed
 * its mind.
 */

/** One operator, as the device picker needs to name them. */
export interface OperatorProfile {
  readonly id: string;
  readonly displayName: string;
}

/**
 * Every operator, by id and display name.
 *
 * Deliberately narrow: the device picker needs a name to put on a button and an
 * id to sign into a cookie. `contact_wa_phone_e164` is not selected, so it
 * cannot reach the page that renders the picker.
 */
export async function listOperatorProfiles(
  client: SupabaseClient,
): Promise<readonly OperatorProfile[]> {
  const { data, error } = await client
    .from("senders")
    .select("id, display_name")
    .order("display_name");

  if (error) {
    throw new Error(`Could not read the operator list: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    displayName: row.display_name as string,
  }));
}

interface ConsoleInvitationRow {
  id: string;
  slug: string;
  owner_sender_id: string;
  display_name: string;
  greeting_name: string;
  dispatch_recipient_guest_id: string | null;
  created_at: string;
  senders: { display_name: string } | null;
  invitation_guests: {
    id: string;
    full_name: string;
    nickname: string | null;
    phone_e164: string | null;
    is_child: boolean;
    is_primary: boolean;
  }[];
}

const CONSOLE_INVITATION_SELECT =
  "id, slug, owner_sender_id, display_name, greeting_name, created_at, " +
  "dispatch_recipient_guest_id, senders(display_name), " +
  // `nickname` is here because the couple reported it missing from the console.
  // It was stored and used to derive the greeting all along; this projection
  // simply never asked for it.
  "invitation_guests!invitation_guests_invitation_id_fkey(id, full_name, nickname, phone_e164, is_child, is_primary)";

export interface ConsoleListOptions {
  /** The SESSION's sender id. Never a value the browser supplied. */
  readonly viewerSenderId: string;
  /** `true` for the operator's own partition, `false` for the shared dashboard. */
  readonly ownedOnly: boolean;
  /** Narrows to one invitation. Applied as a `WHERE`, like the partition. */
  readonly invitationId?: string;
  readonly defaultCountry: CountryCode;
}

/**
 * The console guest list for one scope.
 *
 * `ownedOnly` decides the partition. It is applied as a `WHERE` here rather
 * than by filtering in the page, so a rendering mistake cannot widen it.
 *
 * The device declaration plays NO part in this query. It is an unverifiable
 * self-declaration and must never be an authorization input; what it gates is
 * the interstitial, and the interstitial exists precisely so a mismatch is
 * shown rather than silently filtered away.
 */
export async function listConsoleInvitations(
  client: SupabaseClient,
  options: ConsoleListOptions,
): Promise<readonly ConsoleListRow[]> {
  // A malformed id cannot name a row, so it is answered WITHOUT a round trip —
  // the same reasoning, and the same shape of guard, as `isWellFormedSlug` on
  // the public invitation route. `invitations.id` is a `uuid` column and
  // Postgres answers an unparseable value with `22P02 invalid input syntax for
  // type uuid` rather than with zero rows; passed through, that became a thrown
  // error and a 500, so a mistyped console URL reported a broken server instead
  // of a missing invitation. Catching `22P02` after the fact would give the same
  // answer while still paying for every probe.
  if (
    options.invitationId !== undefined &&
    !isWellFormedUuid(options.invitationId)
  ) {
    return [];
  }

  let query = client
    .from("invitations")
    .select(CONSOLE_INVITATION_SELECT)
    /*
      THE MEMBERS ARE ORDERED HERE; THE HOUSEHOLDS ARE NOT.

      A member's position inside a household is a stable fact about that
      household — primary first, then by when they were added — and the
      database is the cheapest place to settle it.

      The order of the HOUSEHOLDS themselves used to be `display_name` here.
      It is now `assembleConsoleRows`' business, newest first, stated once in
      the domain alongside the directory's identical rule. Two opinions about
      an order is how two lists that should agree drift apart.
    */
    .order("is_primary", { referencedTable: GUESTS, ascending: false })
    .order("created_at", { referencedTable: GUESTS, ascending: true })
    .order("id", { referencedTable: GUESTS, ascending: true });

  if (options.ownedOnly) {
    query = query.eq("owner_sender_id", options.viewerSenderId);
  }

  if (options.invitationId !== undefined) {
    query = query.eq("id", options.invitationId);
  }

  const { data, error } = await query.returns<ConsoleInvitationRow[]>();

  if (error) {
    throw new Error(`Could not read the console guest list: ${error.message}`);
  }

  const invitations = (data ?? []).map((row) => ({
    invitationId: row.id,
    slug: row.slug,
    greetingName: row.greeting_name,
    displayName: row.display_name,
    ownerSenderId: row.owner_sender_id,
    // The FK is NOT NULL, so a missing name means the embed failed rather than
    // that an invitation has no owner. Saying so beats rendering "undefined".
    ownerDisplayName: row.senders?.display_name ?? "Propietario desconocido",
    // Read, never defaulted. `null` is the real starting state and stays until
    // an operator chooses, which is what makes the preflight's
    // `no_recipient_chosen` group mean something on day one.
    dispatchRecipientGuestId: row.dispatch_recipient_guest_id,
    createdAt: row.created_at,
    guests: [...row.invitation_guests]
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1;
        }
        return left.full_name.localeCompare(right.full_name, "es");
      })
      .map((guest) => ({
        id: guest.id,
        fullName: guest.full_name,
        nickname: guest.nickname,
        isChild: guest.is_child,
        phoneE164: guest.phone_e164,
      })),
  }));

  if (invitations.length === 0) {
    return [];
  }

  const invitationIds = invitations.map(
    (invitation) => invitation.invitationId,
  );
  const [latestAnswers, events] = await Promise.all([
    readLatestAnswers(client, invitationIds),
    readDispatchEvents(client, invitationIds),
  ]);

  return assembleConsoleRows({
    invitations,
    latestAnswers,
    events,
    viewerSenderId: options.viewerSenderId,
    defaultCountry: options.defaultCountry,
  });
}

/** The current answers, from `rsvp_latest` and NEVER from `rsvp_responses`. */
/**
 * How many invitation ids may travel in one `in` filter.
 *
 * WHY THERE IS A LIMIT AT ALL. PostgREST puts a filter in the GET query
 * string, and a uuid costs about 39 characters there once the comma and the
 * quoting are counted. A few hundred households therefore push the URL past
 * the server's own cap, and the read comes back "URI too long" — which, for
 * two reads sitting behind the console's main screen, means the whole list
 * answers a 500 rather than degrading.
 *
 * 100 keeps a batch's filter near 4 KB, comfortably inside the 8 KB most
 * servers allow for a request line, with room for the rest of the URL. It is
 * a number chosen to be obviously safe rather than maximal: the cost of a
 * second round trip is nothing next to the screen going down.
 *
 * Found by the browser suite against a database holding 204 invitations. This
 * wedding will not reach that — which is exactly why it needed a test rather
 * than a note, because nobody meets this until they do.
 */
const IDS_PER_READ = 100;

/** The ids in batches small enough for a query string. */
function inBatches(ids: readonly string[]): readonly string[][] {
  const batches: string[][] = [];

  for (let start = 0; start < ids.length; start += IDS_PER_READ) {
    batches.push([...ids.slice(start, start + IDS_PER_READ)]);
  }

  return batches;
}

async function readLatestAnswers(
  client: SupabaseClient,
  invitationIds: readonly string[],
): Promise<readonly ConsoleLatestAnswer[]> {
  const batches = await Promise.all(
    inBatches(invitationIds).map(async (batch) => {
      const { data, error } = await client
        .from("rsvp_latest")
        .select(
          "invitation_id, attending, seats_confirmed, attendee_guest_ids, submitted_at",
        )
        .in("invitation_id", batch);

      if (error) {
        throw new Error(`Could not read the current RSVPs: ${error.message}`);
      }

      return data ?? [];
    }),
  );
  const data = batches.flat();

  return data.map((row) => ({
    invitationId: row.invitation_id as string,
    attending: row.attending as boolean,
    seatsConfirmed: row.seats_confirmed as number,
    // WHO was confirmed, and not only how many. The console is the only surface
    // that can make a stale entry here legible: the column is a bare `uuid[]`
    // (`0001`: `not null default '{}'`, so never null), Postgres cannot
    // foreign-key array elements, and `rsvp_responses` is append-only against
    // `service_role` too — so a removed member's id stays in the answer forever
    // and nothing cascades to it. Reading the count without the ids would report
    // every one of those households as perfectly consistent.
    attendeeGuestIds: row.attendee_guest_ids as string[],
    submittedAt: row.submitted_at as string,
  }));
}

/**
 * Every dispatch event for these invitations.
 *
 * The whole log, not the newest row per invitation: `deriveDispatchState` needs
 * to see that a link was opened even when a later operator confirmation
 * overrides it, and it is the one place that decides which kind wins.
 */
async function readDispatchEvents(
  client: SupabaseClient,
  invitationIds: readonly string[],
): Promise<readonly ConsoleDispatchEvent[]> {
  const batches = await Promise.all(
    inBatches(invitationIds).map(async (batch) => {
      const { data, error } = await client
        .from("dispatch_events")
        .select("invitation_id, kind, occurred_at")
        .in("invitation_id", batch);

      if (error) {
        throw new Error(`Could not read the dispatch log: ${error.message}`);
      }

      return data ?? [];
    }),
  );

  return batches.flat().map((row) => ({
    invitationId: row.invitation_id as string,
    kind: row.kind as ConsoleDispatchEvent["kind"],
    occurredAt: row.occurred_at as string,
  }));
}

/**
 * Rewrites one guest's phone number from the console's inline editor.
 *
 * Inline, and therefore this narrow, on purpose: a reference project sent the
 * operator to a full edit screen to type ten digits, and the friction meant the
 * data never got entered at all. What it must NOT become is a lenient write —
 * `normalizeForStorage` is the same strict function the import uses, so an
 * unusable number is refused here exactly as it would be refused in a file.
 *
 * An empty submission clears the number to NULL rather than to `''`. That is
 * load-bearing: `phone_last8` is `nullif(right(...), '')`, and a stored empty
 * string would make an empty gate submission match the guest.
 */
export async function updateGuestPhone(
  client: SupabaseClient,
  guestId: string,
  rawPhone: string,
  defaultCountry: CountryCode,
): Promise<string | null> {
  const trimmed = rawPhone.trim();
  const phoneE164 =
    trimmed === "" ? null : normalizeForStorage(trimmed, defaultCountry);

  const { error } = await client
    .from("invitation_guests")
    .update({ phone_e164: phoneE164 })
    .eq("id", guestId);

  if (error) {
    throw new Error(`Could not update the guest phone: ${error.message}`);
  }

  return phoneE164;
}

/**
 * Which operator owns the household this guest belongs to, or `null`.
 *
 * The authorization read behind the inline phone editor. The editor submits a
 * guest id, and a guest id is a value the browser holds — so before a write, the
 * server establishes whose partition that guest is actually in and compares it
 * to the SESSION. Without this check the partitioned list would be presentation
 * only: hiding a row would hide the affordance while leaving the write open to
 * anyone who could name a guest.
 */
export async function findGuestInvitationOwner(
  client: SupabaseClient,
  guestId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("invitation_guests")
    // Same 0012 ambiguity as INVITATION_SELECT, read from the other side: name
    // the guest's own `invitation_id` constraint so this cannot resolve through
    // `dispatch_recipient_guest_id` instead.
    .select("invitations!invitation_guests_invitation_id_fkey(owner_sender_id)")
    .eq("id", guestId)
    .maybeSingle<{ invitations: { owner_sender_id: string } | null }>();

  if (error) {
    throw new Error(`Could not read the guest's owner: ${error.message}`);
  }

  return data?.invitations?.owner_sender_id ?? null;
}

/**
 * One invitation the signed-in operator owns, or `null`.
 *
 * The compose view's read. Both the id and the ownership go into the same query
 * rather than into a comparison afterwards: the id arrives from the URL, which
 * is a value the browser holds, and a fetch-then-compare would already have read
 * another operator's household into memory before deciding it should not have.
 *
 * Reduced by exactly the same code path as the list — same join, same
 * `rsvp_latest` read, same `deriveDispatchState` — so the compose view cannot
 * show a state the list disagrees with.
 */
export async function findConsoleInvitation(
  client: SupabaseClient,
  options: {
    readonly invitationId: string;
    readonly viewerSenderId: string;
    readonly defaultCountry: CountryCode;
  },
): Promise<ConsoleListRow | null> {
  const rows = await listConsoleInvitations(client, {
    viewerSenderId: options.viewerSenderId,
    ownedOnly: true,
    invitationId: options.invitationId,
    defaultCountry: options.defaultCountry,
  });

  return rows[0] ?? null;
}
