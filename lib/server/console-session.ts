import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  CONSOLE_LOGIN_PATH,
  readOperatorIdentityHeader,
  type OperatorIdentity,
} from "@/lib/domain/operator-session";

import {
  resolveOperator,
  sessionIdentityOf,
  supabaseOperatorDirectory,
  type Operator,
} from "./auth";
import { operatorSessionSecret, supabasePublishableKey } from "./env";

/**
 * The console session, bound to one Next.js request.
 *
 * Split out of `auth.ts` on purpose: everything in `auth.ts` is a decision that
 * can be made with a fake directory and no request at all, and it stays unit
 * tested. Everything here needs `next/headers`, so it is exercised end to end
 * by `e2e/console-auth.spec.ts` instead. Keeping the two apart is what lets the
 * authorization rules be tested at all.
 */

/**
 * Where a denied-but-authenticated visitor goes.
 *
 * Not straight to the login page: a Server Component cannot write cookies, so a
 * layout that "signs out" and redirects would leave the session intact, the
 * proxy would see a signed-in visitor at `/console/login`, bounce them
 * back to `/console`, and the two would trade the request forever. The route
 * handler below CAN clear the cookies, so the loop has an exit.
 */
export const CONSOLE_SIGN_OUT_PATH = "/console/auth/sign-out?denied=1";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not set. The console session cannot be read.`);
  }

  return value;
}

/**
 * A Supabase client that acts as the signed-in operator.
 *
 * Publishable key, never the secret one: this client exists to carry the
 * visitor's own session, and the authorization decision that follows is made
 * separately against `senders` with the privileged client.
 */
export async function createOperatorAuthClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("SUPABASE_URL"),
    supabasePublishableKey(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const cookie of toSet) {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            }
          } catch {
            // Server Components may not write cookies. That is not a lost
            // refresh: the proxy already refreshed this session and put
            // the rotated pair on the response before the render began.
          }
        },
      },
    },
  );
}

/**
 * Who is signed in, according to the proxy or — failing that — Supabase.
 *
 * The header is the fast path: the proxy already resolved this identity and
 * signed it, so a console render costs no second auth round-trip. The fallback
 * is not decoration. The proxy matcher covers `/console/*` only, and a server
 * action can be invoked from a route outside it; without the fallback the
 * authorization check would fail open or closed depending on which page the
 * operator happened to be on.
 */
export async function readSessionIdentity(): Promise<OperatorIdentity | null> {
  const forwarded = await readOperatorIdentityHeader(
    await headers(),
    operatorSessionSecret(),
  );

  if (forwarded !== null) {
    return forwarded;
  }

  const supabase = await createOperatorAuthClient();
  const { data } = await supabase.auth.getUser();

  return sessionIdentityOf(data.user);
}

/** The authorized operator for this request, or `null`. */
export async function currentOperator(): Promise<Operator | null> {
  const identity = await readSessionIdentity();

  if (identity === null) {
    return null;
  }

  return resolveOperator(supabaseOperatorDirectory(), identity);
}

/**
 * The authorized operator, or no render at all.
 *
 * Two distinct denials, two distinct exits: nobody is signed in (go and sign
 * in), versus somebody is signed in who is not an operator (that session must
 * be destroyed before anything else happens).
 */
export async function requireOperator(): Promise<Operator> {
  const identity = await readSessionIdentity();

  if (identity === null) {
    redirect(CONSOLE_LOGIN_PATH);
  }

  const operator = await resolveOperator(supabaseOperatorDirectory(), identity);

  if (operator === null) {
    redirect(CONSOLE_SIGN_OUT_PATH);
  }

  return operator;
}
