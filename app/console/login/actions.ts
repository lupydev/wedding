"use server";

import {
  requestOperatorMagicLink,
  supabaseMagicLinkMailer,
  supabaseOperatorDirectory,
} from "@/lib/server/auth";
import { createOperatorAuthClient } from "@/lib/server/console-session";
import { consoleOrigin } from "@/lib/server/env";

import type { MagicLinkState } from "./magic-link-state";

/**
 * The magic-link request.
 *
 * The allowlist is consulted here, on the server, before a single message is
 * sent — and the answer handed back to the browser is the same constant string
 * whether the address is an operator, a stranger, a typo, or whether delivery
 * failed outright. Telling the two apart would publish the answer to "who can
 * see every guest's phone number?" to anyone with a form.
 */
export async function requestMagicLinkAction(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const submitted = formData.get("email");
  const supabase = await createOperatorAuthClient();

  const notice = await requestOperatorMagicLink(
    supabaseOperatorDirectory(),
    supabaseMagicLinkMailer(
      supabase,
      `${consoleOrigin()}/console/auth/callback`,
    ),
    typeof submitted === "string" ? submitted : null,
  );

  return { notice };
}
