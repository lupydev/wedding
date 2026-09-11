"use server";

import { revalidatePath } from "next/cache";

import { dispatchIsBlockedBy } from "@/lib/domain/device-declaration";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import {
  readDeviceDeclaration,
  requireOperator,
} from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import {
  findGuestInvitationOwner,
  updateGuestPhone,
} from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * Rewrites one guest's phone number from the console's inline editor.
 *
 * FOUR CHECKS, IN THIS ORDER, AND NONE OF THEM TRUSTS THE FORM
 *
 * 1. `requireOperator()` — the acting identity comes from the verified session.
 * 2. The device declaration must MATCH. A mismatch leaves the console read-only,
 *    and that has to be enforced here rather than by omitting the button: the
 *    button is markup, and markup is not a boundary.
 * 3. The guest must belong to a household THIS operator owns. The form submits a
 *    guest id, which the browser holds, so ownership is resolved server-side
 *    from that id instead of taken on trust. Without this the partition would be
 *    presentation only.
 * 4. `updateGuestPhone` normalizes strictly, with the same function the import
 *    uses. An unusable number is refused rather than stored.
 *
 * A refusal throws. The operator sees Next.js's error boundary rather than a
 * form that silently did nothing, which is the right outcome for a number that
 * would otherwise look saved and reach nobody.
 */
export async function updateGuestPhoneAction(
  formData: FormData,
): Promise<void> {
  const operator = await requireOperator();
  const declaration = await readDeviceDeclaration(operator.id);

  if (dispatchIsBlockedBy(declaration.status)) {
    throw new Error(
      "La declaración de WhatsApp de este dispositivo no coincide con la sesión, así que el panel está en modo solo lectura.",
    );
  }

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
