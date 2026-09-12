"use server";

import { revalidatePath } from "next/cache";

import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import {
  CONSOLE_WEDDING_PATH,
  WEDDING_FACT_FIELDS,
  parseWeddingFacts,
} from "@/lib/domain/wedding-facts";
import { updateCeremony } from "@/lib/server/ceremony";
import { requireOperator } from "@/lib/server/console-session";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import type { WeddingFactsState } from "./wedding-facts-state";

/**
 * Rewrites the wedding's seven facts from the console editor.
 *
 * THREE THINGS HAPPEN, IN THIS ORDER, AND THE ORDER IS THE POINT
 *
 * 1. `requireOperator()` — before the form is touched at all. This action
 *    rewrites the couple's names, which reach guests through a card that nothing
 *    can correct after dispatch. Validating first and refusing second would also
 *    let an unauthenticated POST learn which field names this row has, from the
 *    errors it got back.
 * 2. `parseWeddingFacts` — on the SERVER. The form's `required` and `maxLength`
 *    attributes are a convenience; a hand-rolled request carries whatever it
 *    likes, and a blank venue stored here renders as an invitation that looks
 *    finished and names no place. A refusal writes nothing — not even the six
 *    fields that were fine, because six saved values and one refused is exactly
 *    the partial state one-form-one-save exists to prevent.
 * 3. `updateCeremony` — one UPDATE of the singleton, all seven columns together.
 *
 * NO OWNERSHIP CHECK, AND THAT IS DELIBERATE RATHER THAN FORGOTTEN. The
 * `ceremony` row belongs to the wedding, not to a sender: unlike an invitation,
 * it has no `owner_sender_id` to compare against. Two people are getting married
 * and either of them may correct the venue; an approval workflow between them
 * would be a queue with nobody in it.
 *
 * NOTHING IS LOGGED. Not the values, not a summary of them, not on the failure
 * path. One of the seven is the Zoom passcode, and a log line is a copy of it in
 * a place nobody will remember to rotate. The whole-form notice below carries no
 * submitted value either, for the same reason: an error message is rendered into
 * a page and pasted into a bug report.
 *
 * IT RETURNS STATE RATHER THAN THROWING, unlike `updateGuestPhoneAction`. The
 * difference is what a refusal means to the operator: a phone number the
 * repository rejects is one field, and Next.js's error boundary is an honest
 * answer. Here there are seven fields, one of which may be wrong, and an error
 * page would discard the other six the operator just typed.
 */
export async function saveWeddingFactsAction(
  _previous: WeddingFactsState,
  formData: FormData,
): Promise<WeddingFactsState> {
  await requireOperator();

  // Read as `unknown` per field and handed straight to the validator. A `String()`
  // here would turn a `File` into "[object File]" and an absent field into
  // "null", both of which are non-blank strings the validator would then accept.
  const submission: Record<string, unknown> = {};

  for (const field of WEDDING_FACT_FIELDS) {
    submission[field] = formData.get(field);
  }

  const parsed = parseWeddingFacts(submission);

  if (!parsed.ok) {
    // Nothing written and nothing revalidated: the stored row is unchanged, so
    // there is no cache anywhere holding anything new.
    return { errors: parsed.errors, notice: null, saved: false };
  }

  try {
    await updateCeremony(createServerSupabaseClient(), parsed.facts);
  } catch {
    // The caught error is deliberately not read. It carries the database's own
    // message, which is safe, but reading it is one edit away from interpolating
    // it — and the constraint names it would show mean nothing to an operator
    // anyway. The pure validator has already covered every refusal this form can
    // produce, so reaching here means something unforeseen, and "try again" is
    // the only honest instruction.
    return {
      errors: {},
      notice:
        "No se pudieron guardar los datos de la boda. Vuelvan a intentarlo; " +
        "si sigue fallando, nada se guardó a medias.",
      saved: false,
    };
  }

  // Both surfaces that render these values. Without the second one, an operator
  // saves successfully and the console's own screens keep showing the old text,
  // which reads exactly like a save that did not happen.
  revalidatePath(CONSOLE_WEDDING_PATH);
  revalidatePath(CONSOLE_ROOT_PATH);

  return { errors: {}, notice: null, saved: true };
}
