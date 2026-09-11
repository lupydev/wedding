"use server";

import { revalidatePath } from "next/cache";

import { dispatchIsBlockedBy } from "@/lib/domain/device-declaration";
import { consoleDispatchPath } from "@/lib/domain/dispatch-message";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import {
  readDeviceDeclaration,
  requireOperator,
} from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import { markFailed, markSent } from "@/lib/server/dispatch";
import {
  findConsoleInvitation,
  findGuestInvitationOwner,
  updateGuestPhone,
} from "@/lib/server/invitations";
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
