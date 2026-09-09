import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountryCode } from "libphonenumber-js";

import { normalizeForStorage, type GuestPhoneRef } from "@/lib/domain/phone";
import { encodeSlug, SLUG_BYTE_LENGTH } from "@/lib/domain/slug";

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

/** Maximum seats an invitation may allow, matching the DB CHECK constraint. */
export const MAX_SEATS_ALLOWED = 12;

export interface ImportGuest {
  readonly fullName: string;
  readonly phone?: string;
  readonly isPrimary?: boolean;
  readonly isChild?: boolean;
}

export interface ImportRow {
  readonly ownerEmail: string;
  readonly displayName: string;
  readonly greetingName: string;
  readonly seatsAllowed: number;
  readonly rsvpDeadline?: string | null;
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
  readonly displayName: string;
  readonly greetingName: string;
  readonly seatsAllowed: number;
  readonly rsvpDeadline: string | null;
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
  readonly seatsAllowed: number;
  readonly rsvpDeadline: string | null;
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
  readonly seatsAllowed: number;
  readonly rsvpDeadline: string | null;
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

  if (
    !Number.isInteger(row.seatsAllowed) ||
    row.seatsAllowed < 1 ||
    row.seatsAllowed > MAX_SEATS_ALLOWED
  ) {
    throw new Error(
      `Import row "${displayName}" has an invalid seats_allowed: ${row.seatsAllowed}. It must be an integer between 1 and ${MAX_SEATS_ALLOWED}.`,
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
    seatsAllowed: row.seatsAllowed,
    rsvpDeadline: row.rsvpDeadline?.trim() || null,
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

    seen.set(key, invitation.displayName);
  }

  return validated;
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
    seatsAllowed: record.seatsAllowed,
    rsvpDeadline: record.rsvpDeadline,
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

interface InvitationRow {
  id: string;
  slug: string;
  owner_sender_id: string;
  display_name: string;
  greeting_name: string;
  seats_allowed: number;
  rsvp_deadline: string | null;
  invitation_guests: {
    id: string;
    full_name: string;
    phone_e164: string | null;
    phone_last8: string | null;
    is_primary: boolean;
    is_child: boolean;
  }[];
}

const INVITATION_SELECT =
  "id, slug, owner_sender_id, display_name, greeting_name, seats_allowed, rsvp_deadline, " +
  "invitation_guests(id, full_name, phone_e164, phone_last8, is_primary, is_child)";

function toRecord(row: InvitationRow): InvitationRecord {
  return {
    id: row.id,
    slug: row.slug,
    ownerSenderId: row.owner_sender_id,
    displayName: row.display_name,
    greetingName: row.greeting_name,
    seatsAllowed: row.seats_allowed,
    rsvpDeadline: row.rsvp_deadline,
    guests: row.invitation_guests.map((guest) => ({
      id: guest.id,
      fullName: guest.full_name,
      phoneE164: guest.phone_e164,
      phoneLast8: guest.phone_last8,
      isPrimary: guest.is_primary,
      isChild: guest.is_child,
    })),
  };
}

/**
 * Creates an invitation and its guests.
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
  const slug = mintSlug();

  const { data: invitation, error: invitationError } = await client
    .from("invitations")
    .insert({
      slug,
      owner_sender_id: input.ownerSenderId,
      display_name: input.displayName,
      greeting_name: input.greetingName,
      seats_allowed: input.seatsAllowed,
      rsvp_deadline: input.rsvpDeadline,
      source_key: input.sourceKey ?? null,
    })
    .select("id")
    .single();

  if (invitationError || !invitation) {
    throw new Error(
      `Could not create invitation "${input.displayName}": ${invitationError?.message ?? "no row returned"}`,
    );
  }

  const { error: guestsError } = await client.from("invitation_guests").insert(
    input.guests.map((guest) => ({
      invitation_id: invitation.id,
      full_name: guest.fullName,
      phone_e164: guest.phoneE164,
      is_primary: guest.isPrimary,
      is_child: guest.isChild,
    })),
  );

  if (guestsError) {
    await client.from("invitations").delete().eq("id", invitation.id);
    throw new Error(
      `Could not create guests for invitation "${input.displayName}": ${guestsError.message}`,
    );
  }

  const created = await findInvitationBySlug(client, slug);

  if (!created) {
    throw new Error(
      `Invitation "${input.displayName}" was created but could not be read back.`,
    );
  }

  return created;
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

  const payload = invitations.map((invitation) => {
    const sourceKey = invitation.sourceKey?.trim();

    if (!sourceKey) {
      throw new Error(
        `Invitation "${invitation.displayName}" has no source key, so importing it could not be re-run safely.`,
      );
    }

    return {
      source_key: sourceKey,
      slug: mintSlug(),
      owner_sender_id: invitation.ownerSenderId,
      display_name: invitation.displayName,
      greeting_name: invitation.greetingName,
      seats_allowed: invitation.seatsAllowed,
      rsvp_deadline: invitation.rsvpDeadline,
      guests: invitation.guests.map((guest) => ({
        full_name: guest.fullName,
        phone_e164: guest.phoneE164,
        is_primary: guest.isPrimary,
        is_child: guest.isChild,
      })),
    };
  });

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
