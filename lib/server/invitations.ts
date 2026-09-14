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
import { normalizeForStorage, type GuestPhoneRef } from "@/lib/domain/phone";
import { encodeSlug, SLUG_BYTE_LENGTH } from "@/lib/domain/slug";
import { isWellFormedUuid } from "@/lib/domain/uuid";

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
  readonly phone?: string;
  readonly isPrimary?: boolean;
  readonly isChild?: boolean;
}

export interface ImportRow {
  readonly ownerEmail: string;
  readonly displayName: string;
  readonly greetingName: string;
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

// The embed names its FOREIGN KEY, not just the table. Since 0012 two
// constraints join these tables in opposite directions — a guest's
// `invitation_id` and an invitation's `dispatch_recipient_guest_id` — and
// PostgREST refuses an ambiguous embed with "more than one relationship was
// found". Naming the constraint says which direction this read means.
const INVITATION_SELECT =
  "id, slug, owner_sender_id, display_name, greeting_name, rsvp_deadline, " +
  "invitation_guests!invitation_guests_invitation_id_fkey(id, full_name, phone_e164, phone_last8, is_primary, is_child)";

function toRecord(row: InvitationRow): InvitationRecord {
  return {
    id: row.id,
    slug: row.slug,
    ownerSenderId: row.owner_sender_id,
    displayName: row.display_name,
    greetingName: row.greeting_name,
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
  rsvp_deadline: string | null;
  dispatch_recipient_guest_id: string | null;
  senders: { display_name: string } | null;
  invitation_guests: {
    id: string;
    full_name: string;
    phone_e164: string | null;
    is_child: boolean;
    is_primary: boolean;
  }[];
}

const CONSOLE_INVITATION_SELECT =
  "id, slug, owner_sender_id, display_name, greeting_name, rsvp_deadline, " +
  "dispatch_recipient_guest_id, senders(display_name), " +
  "invitation_guests!invitation_guests_invitation_id_fkey(id, full_name, phone_e164, is_child, is_primary)";

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
    .order("display_name");

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
    rsvpDeadline: row.rsvp_deadline,
    ownerSenderId: row.owner_sender_id,
    // The FK is NOT NULL, so a missing name means the embed failed rather than
    // that an invitation has no owner. Saying so beats rendering "undefined".
    ownerDisplayName: row.senders?.display_name ?? "Propietario desconocido",
    // Read, never defaulted. `null` is the real starting state and stays until
    // an operator chooses, which is what makes the preflight's
    // `no_recipient_chosen` group mean something on day one.
    dispatchRecipientGuestId: row.dispatch_recipient_guest_id,
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
async function readLatestAnswers(
  client: SupabaseClient,
  invitationIds: readonly string[],
): Promise<readonly ConsoleLatestAnswer[]> {
  const { data, error } = await client
    .from("rsvp_latest")
    .select("invitation_id, attending, seats_confirmed, submitted_at")
    .in("invitation_id", invitationIds);

  if (error) {
    throw new Error(`Could not read the current RSVPs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    invitationId: row.invitation_id as string,
    attending: row.attending as boolean,
    seatsConfirmed: row.seats_confirmed as number,
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
  const { data, error } = await client
    .from("dispatch_events")
    .select("invitation_id, kind, occurred_at")
    .in("invitation_id", invitationIds);

  if (error) {
    throw new Error(`Could not read the dispatch log: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
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
