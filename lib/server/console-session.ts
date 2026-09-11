import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  CONSOLE_DEVICE_PATH,
  classifyDeviceDeclaration,
  type DeviceDeclarationStatus,
} from "@/lib/domain/device-declaration";
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
import { DEVICE_SENDER_COOKIE_NAME, readDeviceSenderCookie } from "./cookies";
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

/**
 * ── The per-device WhatsApp declaration ─────────────────────────────────────
 *
 * The second of the two questions in `design.md`'s "Operator Identity" table.
 * Authentication above answers "who is operating?" and is a verified fact. This
 * answers "which WhatsApp account is installed on this handset?" and is a
 * self-declaration the server can never check, because `wa.me` has no sender
 * parameter and the sending account is a physical property of the phone.
 *
 * It is therefore NOT an authorization input. It does not narrow the query, it
 * does not decide whether phone numbers are visible, and it will not decide
 * `actor_sender_id`. It gates one human-facing interstitial. Making it an
 * authorization input would mean a value its holder chooses deciding who may
 * read every guest's phone number.
 */

/** What this device declared, and how that compares to the session. */
export interface DeviceDeclaration {
  readonly status: DeviceDeclarationStatus;
  /** The declared sender, or `null` when the cookie is absent or unusable. */
  readonly declaredSenderId: string | null;
}

/**
 * Reads this device's declaration and compares it to the signed-in operator.
 *
 * Never redirects and never throws: the two callers want different things from
 * the same answer — the layout redirects an undeclared device to the picker, and
 * the page renders read-only on a mismatch.
 */
export async function readDeviceDeclaration(
  sessionSenderId: string,
): Promise<DeviceDeclaration> {
  const cookieStore = await cookies();
  const declaredSenderId = readDeviceSenderCookie(
    cookieStore.get(DEVICE_SENDER_COOKIE_NAME)?.value,
  );

  return {
    status: classifyDeviceDeclaration(declaredSenderId, sessionSenderId),
    declaredSenderId,
  };
}

/**
 * The declaration, or the picker.
 *
 * FAILS TO THE PICKER, NEVER TO A DEFAULT. An absent declaration is a question
 * that has not been answered, so it gets asked again — clearing site data must
 * not silently nominate whoever happens to be signed in.
 *
 * A MISMATCH IS NOT A REDIRECT. It returns, so the caller can render the
 * interstitial over a read-only view. Bouncing the operator to the picker would
 * hide the disagreement behind a form, and the disagreement is the finding.
 */
export async function requireDeclaredDevice(
  sessionSenderId: string,
): Promise<DeviceDeclaration> {
  const declaration = await readDeviceDeclaration(sessionSenderId);

  if (declaration.status === "undeclared") {
    redirect(CONSOLE_DEVICE_PATH);
  }

  return declaration;
}
