import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  applyOperatorIdentityHeader,
  resolveConsoleRedirect,
  type OperatorIdentity,
} from "@/lib/domain/operator-session";

/**
 * Console session refresh, for the `proxy.ts` file convention.
 *
 * This file is not under `lib/server/**` and therefore does not carry
 * `import 'server-only'`, for one mechanical reason: the proxy is not a React
 * Server Component environment, so `server-only` resolves to the module that
 * throws rather than to its empty react-server build. Nothing secret lives
 * here to compensate — the client below is built with the PUBLISHABLE key, the
 * same one a browser would hold, and the allowlist check that actually
 * authorizes anybody happens on the server with the secret key.
 *
 * ── The bug this file exists to not have ────────────────────────────────────
 *
 * `supabase.auth.getUser()` does not merely read a session: when the access
 * token is expiring it renews it, and renewal ROTATES the refresh token and
 * burns the old one server-side. The new pair arrives through the `setAll`
 * callback and has to reach the browser, or the browser is left holding a
 * refresh token that no longer exists — and it finds out exactly one
 * access-token lifetime later, by being signed out.
 *
 * So there is ONE response object here and every return path carries the
 * cookies Supabase wrote. Redirects included. The redirect is the path people
 * forget, because a redirect feels like "we are not returning the page anyway",
 * and it is precisely the path a refreshing session takes on the way to a
 * login-page bounce.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not set. The console session cannot be read.`);
  }

  return value;
}

/**
 * Refreshes the operator session and routes the request.
 *
 * Exported separately from `proxy.ts` so the cookie-carrying behaviour can
 * be driven directly by a test holding a deliberately stale session, which is
 * the only way to observe the regression above before it ships.
 */
export async function updateOperatorSession(
  request: NextRequest,
): Promise<NextResponse> {
  const forwardedHeaders = new Headers(request.headers);
  const identitySecret = requireEnv("OPERATOR_SESSION_SECRET");

  // Before anything else, and unconditionally: a visitor may send this header
  // themselves. After this call the only value that can be present is one this
  // proxy produced.
  await applyOperatorIdentityHeader(forwardedHeaders, identitySecret, null);

  const writtenCookies: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];

  const supabase = createServerClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const cookie of cookies) {
            // Kept on the request too, so anything later in this same pass
            // reads the refreshed session rather than the burned one.
            request.cookies.set(cookie.name, cookie.value);
          }

          writtenCookies.push(...cookies);
        },
      },
    },
  );

  // The call that may rotate the tokens. Nothing between here and the return
  // may construct a response that is not the one returned.
  const { data } = await supabase.auth.getUser();
  const identity: OperatorIdentity | null =
    data.user?.id && data.user.email
      ? { authUserId: data.user.id, email: data.user.email }
      : null;

  await applyOperatorIdentityHeader(forwardedHeaders, identitySecret, identity);

  const redirectTo = resolveConsoleRedirect(
    request.nextUrl.pathname,
    identity !== null,
  );

  const response =
    redirectTo === null
      ? NextResponse.next({ request: { headers: forwardedHeaders } })
      : NextResponse.redirect(new URL(redirectTo, request.url));

  // The rule, applied once, to whichever response was built.
  for (const cookie of writtenCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}
