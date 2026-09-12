"use server";

import { redirect } from "next/navigation";

import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import {
  SIGN_IN_NOTICE,
  signInOperator,
  supabaseOperatorDirectory,
  supabaseOperatorPasswordAuthenticator,
} from "@/lib/server/auth";
import { createOperatorAuthClient } from "@/lib/server/console-session";

import type { SignInState } from "./sign-in-state";

/** A submitted text field, or `null` when the browser sent something else. */
function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);

  return typeof value === "string" ? value : null;
}

/**
 * The console sign-in.
 *
 * A Server Action rather than a Route Handler because a Server Action may write
 * cookies, which is the whole reason the magic-link callback route existed: the
 * session is established here, in the same request that checks the allowlist,
 * and the round trip through a mailbox is gone.
 *
 * Every refusal returns the same constant. `signInOperator` has already made
 * the three refusals indistinguishable on the server — including destroying the
 * session a valid non-operator credential just created — and this is the last
 * place that could give the difference away by saying something else.
 *
 * The redirect on success is deliberate and is NOT a state: a returned "you are
 * in" would leave the browser on the login page holding a session, which is
 * precisely the state the proxy has to untangle.
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const supabase = await createOperatorAuthClient();

  const operator = await signInOperator(
    supabaseOperatorDirectory(),
    supabaseOperatorPasswordAuthenticator(supabase),
    textField(formData, "email"),
    textField(formData, "password"),
  );

  if (operator === null) {
    return { notice: SIGN_IN_NOTICE };
  }

  redirect(CONSOLE_ROOT_PATH);
}
