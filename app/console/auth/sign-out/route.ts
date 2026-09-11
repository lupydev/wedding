import { NextResponse, type NextRequest } from "next/server";

import { CONSOLE_LOGIN_PATH } from "@/lib/domain/operator-session";
import { createOperatorAuthClient } from "@/lib/server/console-session";

/**
 * Destroys the console session.
 *
 * It sits under `/console/auth/**`, which the middleware never redirects, and
 * it is a Route Handler, which may write cookies. Both matter: this is the exit
 * from the state where somebody holds a valid Supabase session that is not an
 * operator. A Server Component "signing out" would clear nothing, the
 * middleware would keep seeing a signed-in visitor, and the console and the
 * login page would trade the request forever.
 *
 * `GET`, because it is a redirect target. The worst a forged cross-site request
 * can do here is sign an operator out, which they can also do by clicking the
 * button; nothing is created, read or destroyed beyond the session itself.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createOperatorAuthClient();
  await supabase.auth.signOut();

  // `?denied=1` only when the console sent the visitor here because their
  // identity is no longer an operator. A voluntary sign-out gets the ordinary
  // login page: telling someone who just clicked "cerrar sesión" that their
  // access was withdrawn would be alarming and false.
  const denied = request.nextUrl.searchParams.get("denied") === "1";

  return NextResponse.redirect(
    new URL(
      denied ? `${CONSOLE_LOGIN_PATH}?denied=1` : CONSOLE_LOGIN_PATH,
      request.nextUrl.origin,
    ),
  );
}
