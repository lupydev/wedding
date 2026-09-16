"use server";

import { revalidatePath } from "next/cache";

import { dispatchIsBlockedBy } from "@/lib/domain/device-declaration";
import { consoleDispatchPath } from "@/lib/domain/dispatch-message";
import {
  classifyMembershipChangeImpact,
  type MembershipChangeImpact,
} from "@/lib/domain/invitation-draft";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { normalizeForStorage } from "@/lib/domain/phone";
import {
  readDeviceDeclaration,
  requireOperator,
} from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import { markFailed, markSent } from "@/lib/server/dispatch";
import {
  addMember,
  chooseRecipient,
  createInvitation,
  deleteInvitation,
  editMember,
  findConsoleInvitation,
  findGuestInvitationOwner,
  listConsoleInvitations,
  moveMemberToInvitation,
  removeMember,
  rotateInvitationSlug,
  updateGuestPhone,
  updateInvitation,
} from "@/lib/server/invitations";
import { getCurrentRsvp } from "@/lib/server/rsvp";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * Rewrites one guest's phone number from the console's inline editor.
 *
 * THREE CHECKS, IN THIS ORDER, AND NONE OF THEM TRUSTS THE FORM
 *
 * 1. `requireOperator()` — the acting identity comes from the verified session.
 * 2. The guest must belong to a household THIS operator owns. The form submits a
 *    guest id, which the browser holds, so ownership is resolved server-side
 *    from that id instead of taken on trust. Without this the partition would be
 *    presentation only.
 * 3. `updateGuestPhone` normalizes strictly, with the same function the import
 *    uses. An unusable number is refused rather than stored.
 *
 * THE DEVICE DECLARATION IS DELIBERATELY NOT ONE OF THEM
 *
 * It used to be, and that was wrong. The declaration gate exists so a message
 * does not leave from the wrong WhatsApp account — `wa.me` has no sender
 * parameter, so the account is whichever one is installed on the handset.
 * Correcting a typo in a phone number sends nothing, from any account. As
 * originally wired, being on the wrong handset prevented fixing exactly the data
 * the send preflight tells the operator to go and fix, which is the state where
 * entering it matters most. Dispatch stays blocked on a mismatch; data entry
 * does not.
 *
 * A refusal throws. The operator sees Next.js's error boundary rather than a
 * form that silently did nothing, which is the right outcome for a number that
 * would otherwise look saved and reach nobody.
 */
export async function updateGuestPhoneAction(
  formData: FormData,
): Promise<void> {
  const operator = await requireOperator();

  const guestId = String(formData.get("guestId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "");

  if (guestId === "") {
    throw new Error(
      "No se indicó a qué persona invitada corresponde el número.",
    );
  }

  const client = createServerSupabaseClient();
  const ownerSenderId = await findGuestInvitationOwner(client, guestId);

  if (ownerSenderId !== operator.id) {
    throw new Error(
      "Esa persona invitada pertenece a una invitación que gestiona la otra cuenta.",
    );
  }

  await updateGuestPhone(client, guestId, phone, requiredDefaultPhoneCountry());

  revalidatePath(CONSOLE_ROOT_PATH);
}

/**
 * The shared guard behind both operator confirmations.
 *
 * FOUR CHECKS, AND THE DECLARATION IS ONE OF THEM HERE
 *
 * Unlike the phone editor above, these actions record a dispatch — the exact
 * thing the device declaration exists to gate. A confirmation written from a
 * handset carrying the other operator's WhatsApp would attest to a send that
 * left from an account the guest may not recognise, so it is refused at the
 * server and not merely hidden in the markup.
 *
 * Ownership is resolved through `findConsoleInvitation`, which applies the
 * partition as a `WHERE`: the invitation id arrives from a hidden form field,
 * and a check performed after the fetch would already have read another
 * operator's household.
 */
async function requireOwnedDispatch(formData: FormData): Promise<{
  readonly actorSenderId: string;
  readonly invitationId: string;
}> {
  const operator = await requireOperator();
  const declaration = await readDeviceDeclaration(operator.id);

  if (dispatchIsBlockedBy(declaration.status)) {
    throw new Error(
      "La cuenta de WhatsApp declarada en este dispositivo no coincide con la sesión, así que los envíos están bloqueados.",
    );
  }

  const invitationId = String(formData.get("invitationId") ?? "").trim();

  if (invitationId === "") {
    throw new Error("No se indicó a qué invitación corresponde el envío.");
  }

  const invitation = await findConsoleInvitation(createServerSupabaseClient(), {
    invitationId,
    viewerSenderId: operator.id,
    defaultCountry: requiredDefaultPhoneCountry(),
  });

  if (invitation === null) {
    throw new Error("Esa invitación no existe o la gestiona la otra cuenta.");
  }

  return { actorSenderId: operator.id, invitationId };
}

/**
 * Records the operator's own testimony that the message went out.
 *
 * The application never observes a send. This action is the only thing in the
 * product that can assert one, and what it asserts is that a person says so —
 * which is why `link_opened` is a separate kind and never satisfies a
 * "has been invited" filter on its own.
 */
export async function markDispatchSentAction(
  formData: FormData,
): Promise<void> {
  const { actorSenderId, invitationId } = await requireOwnedDispatch(formData);

  await markSent(createServerSupabaseClient(), { actorSenderId, invitationId });

  revalidatePath(CONSOLE_ROOT_PATH);
  revalidatePath(consoleDispatchPath(invitationId));
}

/** Records the operator's own testimony that it did not go out. */
export async function markDispatchFailedAction(
  formData: FormData,
): Promise<void> {
  const { actorSenderId, invitationId } = await requireOwnedDispatch(formData);

  await markFailed(createServerSupabaseClient(), {
    actorSenderId,
    invitationId,
  });

  revalidatePath(CONSOLE_ROOT_PATH);
  revalidatePath(consoleDispatchPath(invitationId));
}

/**
 * ── Administration ─────────────────────────────────────────────────────────
 *
 * OWNERSHIP GATES DISPATCH. IT DOES NOT GATE ADMINISTRATION.
 *
 * Confirmed decision 4. Either operator may create an invitation and edit, move
 * members on, or delete ANY invitation, including one the other operator owns,
 * because administration carries no send risk: nothing below puts a message in
 * front of a guest. The two actions above are the ones that record a dispatch,
 * and they keep both the ownership lookup and the per-device WhatsApp
 * declaration gate exactly as they were.
 *
 * "No ownership check" is emphatically NOT "no auth check". Every action here
 * still begins with `requireOperator()`, so the acting identity comes from the
 * verified session and an unauthenticated caller writes nothing at all.
 *
 * These actions are THIN by design. The refusals live in `lib/domain` and are
 * applied by `lib/server/invitations.ts` before its first statement; repeating
 * them here would be a second copy of each rule, and the copy that is forgotten
 * during a change is the one that decides.
 */

/** The invitation id every administration action acts on. */
function requiredInvitationId(formData: FormData): string {
  const invitationId = String(formData.get("invitationId") ?? "").trim();

  if (invitationId === "") {
    throw new Error("No se indicó sobre qué invitación se está actuando.");
  }

  return invitationId;
}

function text(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "").trim();
}

function requiredText(formData: FormData, field: string, what: string): string {
  const value = text(formData, field);

  if (value === "") {
    throw new Error(`No se indicó ${what}.`);
  }

  return value;
}

/** An emptied form field is not a nickname; it is the absence of one. */
function optionalText(formData: FormData, field: string): string | null {
  const value = text(formData, field);

  return value === "" ? null : value;
}

/** A checkbox-shaped value. The form submits it for every row, always. */
function flag(raw: string): boolean {
  return raw === "on" || raw === "true" || raw === "1";
}

/**
 * The stored number, or `null` — normalized by the SAME strict function the
 * importer uses, so an unusable number is refused here exactly as it is in a
 * file rather than stored and discovered when a dispatch reaches nobody.
 */
function storedPhone(raw: string): string | null {
  const trimmed = raw.trim();

  return trimmed === ""
    ? null
    : normalizeForStorage(trimmed, requiredDefaultPhoneCountry());
}

/**
 * The member rows of the creation form, as four parallel fields.
 *
 * Parallel and therefore checked: a secondary field that is present with a
 * DIFFERENT length than the names would silently attach one person's phone to
 * another person's row, which is the kind of fault nobody reads back. The form
 * emits every secondary field for every row — including an explicit value for
 * the child flag, because an unchecked checkbox submits nothing and would
 * shift every row after it.
 */
function readMemberRows(formData: FormData): readonly {
  readonly fullName: string;
  readonly nickname: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
}[] {
  const names = formData.getAll("memberFullName").map((value) => String(value));

  if (names.length === 0) {
    throw new Error("No se indicó ninguna persona invitada.");
  }

  const column = (field: string): string[] => {
    const values = formData.getAll(field).map((value) => String(value));

    if (values.length !== 0 && values.length !== names.length) {
      throw new Error(
        `El formulario envió ${values.length} valores de ${field} para ${names.length} personas, así que no se puede saber a quién corresponde cada uno.`,
      );
    }

    return values;
  };

  const nicknames = column("memberNickname");
  const phones = column("memberPhone");
  const children = column("memberIsChild");

  return names.map((fullName, index) => ({
    fullName: fullName.trim(),
    nickname: (nicknames[index] ?? "").trim() || null,
    phoneE164: storedPhone(phones[index] ?? ""),
    isChild: flag(children[index] ?? ""),
  }));
}

/**
 * Reads one invitation WITHOUT the owner partition.
 *
 * `findConsoleInvitation` is deliberately not used: it applies
 * `owner_sender_id = viewer` as a `WHERE`, which is right for the compose view
 * and wrong for administration. What is needed here is the invitation's current
 * membership and recipient, for whichever operator is looking.
 */
async function readInvitation(operatorSenderId: string, invitationId: string) {
  const rows = await listConsoleInvitations(createServerSupabaseClient(), {
    viewerSenderId: operatorSenderId,
    ownedOnly: false,
    invitationId,
    defaultCountry: requiredDefaultPhoneCountry(),
  });
  const invitation = rows[0];

  if (invitation === undefined) {
    throw new Error("Esa invitación no existe.");
  }

  return invitation;
}

/** Creates an invitation and its members through the one write path. */
export async function createInvitationAction(
  formData: FormData,
): Promise<void> {
  const operator = await requireOperator();
  const members = readMemberRows(formData);

  await createInvitation(createServerSupabaseClient(), {
    // The session's operator owns what the session creates. Ownership decides
    // which partition the invitation appears in and who may dispatch it; it no
    // longer decides who may edit it.
    ownerSenderId: operator.id,
    displayName: requiredText(formData, "displayName", "el nombre del hogar"),
    greetingName: text(formData, "greetingName"),
    greetingNameSource:
      text(formData, "greetingNameSource") === "custom" ? "custom" : "derived",
    rsvpDeadline: optionalText(formData, "rsvpDeadline"),
    guests: members.map((member, index) => ({
      fullName: member.fullName,
      nickname: member.nickname,
      phoneE164: member.phoneE164,
      // The first row is the household's primary contact. There is no separate
      // control for it, because a form that asks twice gets two answers.
      isPrimary: index === 0,
      isChild: member.isChild,
    })),
  });

  revalidatePath(CONSOLE_ROOT_PATH);
}

/** Rewrites the invitation's own fields. Membership has its own actions. */
export async function updateInvitationAction(
  formData: FormData,
): Promise<void> {
  await requireOperator();

  const invitationId = requiredInvitationId(formData);

  await updateInvitation(createServerSupabaseClient(), invitationId, {
    displayName: requiredText(formData, "displayName", "el nombre del hogar"),
    greetingName: text(formData, "greetingName"),
    greetingNameSource:
      text(formData, "greetingNameSource") === "custom" ? "custom" : "derived",
    rsvpDeadline: optionalText(formData, "rsvpDeadline"),
  });

  revalidatePath(CONSOLE_ROOT_PATH);
}

/** Adds one member to an existing invitation. */
export async function addMemberAction(formData: FormData): Promise<void> {
  await requireOperator();

  const invitationId = requiredInvitationId(formData);

  await addMember(createServerSupabaseClient(), invitationId, {
    fullName: requiredText(formData, "fullName", "el nombre de la persona"),
    nickname: optionalText(formData, "nickname"),
    phoneE164: storedPhone(text(formData, "phone")),
    isChild: flag(text(formData, "isChild")),
  });

  revalidatePath(CONSOLE_ROOT_PATH);
}

/** Rewrites one member's own fields. */
export async function editMemberAction(formData: FormData): Promise<void> {
  await requireOperator();

  const invitationId = requiredInvitationId(formData);
  const guestId = requiredText(formData, "guestId", "a qué persona se edita");

  await editMember(createServerSupabaseClient(), invitationId, guestId, {
    fullName: requiredText(formData, "fullName", "el nombre de la persona"),
    nickname: optionalText(formData, "nickname"),
    phoneE164: storedPhone(text(formData, "phone")),
    isChild: flag(text(formData, "isChild")),
  });

  revalidatePath(CONSOLE_ROOT_PATH);
}

/**
 * Removes one member, and REPORTS what the removal contradicted.
 *
 * Never refuses for consistency. "Fer already said yes, but now he cannot come
 * — take him off" is the couple's actual workflow, and an edit refused on that
 * ground only teaches them to keep the guest list somewhere else. The stored
 * answer is not rewritten either; what is returned describes the
 * forward-looking state so the console can show a badge that NAMES who left.
 *
 * The membership is read BEFORE the removal, because afterwards there is
 * nothing left to say who was removed.
 */
export async function removeMemberAction(
  formData: FormData,
): Promise<MembershipChangeImpact> {
  const operator = await requireOperator();

  const invitationId = requiredInvitationId(formData);
  const guestId = requiredText(formData, "guestId", "a qué persona se quita");

  const invitation = await readInvitation(operator.id, invitationId);
  const memberIdsBefore = invitation.guests.map((guest) => guest.id);
  const latestAnswer = await getCurrentRsvp(
    createServerSupabaseClient(),
    invitationId,
  );

  await removeMember(createServerSupabaseClient(), invitationId, guestId);

  revalidatePath(CONSOLE_ROOT_PATH);

  return classifyMembershipChangeImpact({
    memberIdsBefore,
    memberIdsAfter: memberIdsBefore.filter((id) => id !== guestId),
    latestAnswer:
      latestAnswer === null
        ? null
        : {
            id: latestAnswer.id,
            attending: latestAnswer.attending,
            seatsConfirmed: latestAnswer.seatsConfirmed,
            attendeeGuestIds: latestAnswer.attendeeGuestIds,
          },
  });
}

/**
 * Moves one member to another invitation.
 *
 * The source's current member ids and recipient are read here and handed down,
 * because `canMoveMember` decides on them BEFORE the repository issues any
 * statement (design D25): a refused move never becomes SQL and can never
 * contend with the `clear_recipient_on_guest_move` trigger.
 */
export async function moveMemberAction(
  formData: FormData,
): Promise<MembershipChangeImpact> {
  const operator = await requireOperator();

  const invitationId = requiredInvitationId(formData);
  const guestId = requiredText(formData, "guestId", "a qué persona se mueve");
  const destinationInvitationId = requiredText(
    formData,
    "destinationInvitationId",
    "a qué invitación se mueve",
  );

  const source = await readInvitation(operator.id, invitationId);
  const memberIdsBefore = source.guests.map((guest) => guest.id);

  // A MOVE IS A REMOVAL AS FAR AS THE SOURCE IS CONCERNED.
  //
  // The spec states this requirement for removing OR moving a member named in a
  // confirmed answer: both are permitted, and both must report the seat count
  // they leave inconsistent. Only the removal half was implemented, so moving
  // somebody out of a household that had already confirmed them left the answer
  // contradicted with nothing anywhere saying so — and the console badge that
  // renders this can only show what the action returns.
  const latestAnswer = await getCurrentRsvp(
    createServerSupabaseClient(),
    invitationId,
  );

  await moveMemberToInvitation(createServerSupabaseClient(), {
    sourceInvitationId: invitationId,
    destinationInvitationId,
    memberId: guestId,
    sourceMemberIds: memberIdsBefore,
    sourceRecipientGuestId: source.dispatchRecipientGuestId,
  });

  revalidatePath(CONSOLE_ROOT_PATH);

  return classifyMembershipChangeImpact({
    memberIdsBefore,
    memberIdsAfter: memberIdsBefore.filter((id) => id !== guestId),
    latestAnswer:
      latestAnswer === null
        ? null
        : {
            id: latestAnswer.id,
            attending: latestAnswer.attending,
            seatsConfirmed: latestAnswer.seatsConfirmed,
            attendeeGuestIds: latestAnswer.attendeeGuestIds,
          },
  });
}

/**
 * Records which member receives the invitation's WhatsApp message.
 *
 * The guest id arrives from a form, so the membership is established
 * server-side before the write. The composite foreign key refuses a foreign
 * member regardless — this check exists so the operator is told which fact was
 * wrong instead of being shown a constraint violation.
 */
export async function chooseRecipientAction(formData: FormData): Promise<void> {
  const operator = await requireOperator();

  const invitationId = requiredInvitationId(formData);
  const guestId = requiredText(formData, "guestId", "quién recibe el mensaje");

  const invitation = await readInvitation(operator.id, invitationId);

  if (!invitation.guests.some((guest) => guest.id === guestId)) {
    throw new Error(
      "Esa persona no pertenece a esta invitación, así que no puede recibir su mensaje.",
    );
  }

  await chooseRecipient(createServerSupabaseClient(), invitationId, guestId);

  revalidatePath(CONSOLE_ROOT_PATH);
  revalidatePath(consoleDispatchPath(invitationId));
}

/**
 * Permanently deletes an invitation — or lets the repository refuse it.
 *
 * The refusal is deliberately NOT caught and reworded. `canDeleteInvitation`
 * names the dispatch event kinds it found and points at slug rotation, and an
 * operator shown a generic failure instead has been told nothing they can act
 * on.
 */
export async function deleteInvitationAction(
  formData: FormData,
): Promise<void> {
  await requireOperator();

  const invitationId = requiredInvitationId(formData);

  await deleteInvitation(createServerSupabaseClient(), invitationId);

  revalidatePath(CONSOLE_ROOT_PATH);
}

/**
 * Gives one invitation a new address — the exit for "dispatched by mistake".
 *
 * Returns the new slug, which is the only place it exists after the write, and
 * records no dispatch event: rotation changes where the invitation lives, not
 * what was sent.
 */
export async function rotateSlugAction(formData: FormData): Promise<string> {
  await requireOperator();

  const invitationId = requiredInvitationId(formData);

  const slug = await rotateInvitationSlug(
    createServerSupabaseClient(),
    invitationId,
  );

  revalidatePath(CONSOLE_ROOT_PATH);
  revalidatePath(consoleDispatchPath(invitationId));

  return slug;
}
