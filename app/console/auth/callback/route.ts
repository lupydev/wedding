import { NextResponse, type NextRequest } from "next/server";

import {
  CONSOLE_LOGIN_PATH,
  CONSOLE_ROOT_PATH,
} from "@/lib/domain/operator-session";
import {
  resolveOperator,
  sessionIdentityOf,
  supabaseOperatorDirectory,
} from "@/lib/server/auth";
import { createOperatorAuthClient } from "@/lib/server/console-session";

/**
 * Magic-link exchange.
 *
 * A Route Handler rather than a page because this is the one place in the
 * console that must WRITE cookies: it turns the one-time code into a session,
 * and — when the resulting identity turns out not to be an operator — destroys
 * it again. A Server Component could do neither.
 *
 * The belt-and-braces re-check lives here. The address that decides
 * authorization is read back out of the established SESSION, never out of the
 * form field that started the flow. Those are normally the same address; when
 * they are not, the session is signed out rather than trusted.
 */

const DENIED_LOGIN_URL = `${CONSOLE_LOGIN_PATH}?denied=1`;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");

  if (code === null) {
    return NextResponse.redirect(new URL(CONSOLE_LOGIN_PATH, origin));
  }

  const supabase = await createOperatorAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // An expired, replayed or tampered link. No detail reaches the visitor:
    // "this code was already used" and "this code never existed" are the same
    // sentence on the login page.
    return NextResponse.redirect(new URL(CONSOLE_LOGIN_PATH, origin));
  }

  const identity = sessionIdentityOf(data.user);
  const operator =
    identity === null
      ? null
      : await resolveOperator(supabaseOperatorDirectory(), identity);

  if (operator === null) {
    await supabase.auth.signOut();

    return NextResponse.redirect(new URL(DENIED_LOGIN_URL, origin));
  }

  return NextResponse.redirect(new URL(CONSOLE_ROOT_PATH, origin));
}
