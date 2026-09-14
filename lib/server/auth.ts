import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeAllowlistEmail,
  type OperatorIdentity,
} from "@/lib/domain/operator-session";

import { createServerSupabaseClient } from "./supabase";

/**
 * Operator authorization.
 *
 * `senders` IS the allowlist (design decision D7). There is deliberately no
 * `OPERATOR_EMAILS` environment variable: two allowlists that can disagree is a
 * class of authorization bug, and the failure mode is nasty — a validly
 * authenticated operator bounced at the door because a redeploy lagged behind a
 * row, or worse, the reverse. Adding an operator is an `INSERT`.
 *
 * Nothing in this module reads a request, a cookie or a header. The identity it
 * is given always comes from a verified Supabase session; supplying it as an
 * argument is what keeps every decision here testable without a browser, and
 * what makes it impossible for a submitted form field to be mistaken for one.
 */

/** A sender row, as authorization cares about it. */
export interface OperatorRecord {
  readonly id: string;
  readonly displayName: string;
  readonly role: "partner_a" | "partner_b" | "helper";
  readonly allowlistedEmail: string;
  /** `null` until the first allowlisted sign-in binds it. */
  readonly authUserId: string | null;
}

/** An authorized operator: a sender row with a bound auth identity. */
export interface Operator extends OperatorRecord {
  readonly authUserId: string;
}

/**
 * The allowlist, as a port.
 *
 * A port rather than a direct Supabase call because the decisions worth testing
 * are "deny", "bind once" and "never re-bind", and testing those through a
 * mocked query builder would be testing the mock. The real implementation is
 * `supabaseOperatorDirectory` below and is exercised by `e2e/console-auth`.
 */
export interface OperatorDirectory {
  findByAllowlistedEmail(email: string): Promise<OperatorRecord | null>;
  bindAuthUserId(senderId: string, authUserId: string): Promise<void>;
}

/**
 * Verifies a password and carries the resulting session.
 *
 * A port rather than a direct Supabase call for the same reason the directory
 * is one: the decisions worth testing are "refuse", "refuse identically" and
 * "destroy the session a valid non-operator just obtained", and none of them
 * should need a live auth server to assert.
 *
 * `signOut` belongs here rather than at the call site because it is part of
 * one refusal, not a separate act of tidying. A correct password for an address
 * that is not in `senders` DOES authenticate; what makes that outcome identical
 * to a wrong password is that the session never survives the call.
 */
export interface OperatorPasswordAuthenticator {
  signIn(email: string, password: string): Promise<OperatorIdentity | null>;
  signOut(): Promise<void>;
}

/**
 * The one answer every refused sign-in gets.
 *
 * Identical for a wrong password, a correct password belonging to somebody who
 * is not an operator, and an address with no account at all. Anything else — a
 * different sentence, an extra field, a visible error, a surviving cookie —
 * turns this form into an oracle that answers "is this person one of the two
 * people who can see every guest's phone number?".
 */
export const SIGN_IN_NOTICE =
  "No fue posible iniciar sesión con los datos indicados. Verifique el correo electrónico y la contraseña.";

/**
 * The authenticated user's own identity, or `null`.
 *
 * The belt-and-braces re-check the console depends on: once credentials have
 * been verified, the address that decides authorization is read back out of the
 * SESSION here, never out of the form that started the flow. Those two are
 * normally the same address; when they are not, something is wrong and the
 * caller signs the session out.
 */
export function sessionIdentityOf(
  user: { id: string; email?: string | null } | null | undefined,
): OperatorIdentity | null {
  if (!user?.id || !user.email) {
    return null;
  }

  return { authUserId: user.id, email: user.email };
}

/**
 * Is this authenticated identity one of the operators? If so, which one?
 *
 * Returns `null` for every denial, and the caller treats every `null` the same
 * way: sign the session out and send the visitor to the login page. There are
 * three denials and they must not be distinguishable to the visitor — an
 * unknown address, an address that is not shaped like one, and an identity
 * trying to claim a sender row that already belongs to a different auth user.
 */
export async function resolveOperator(
  directory: OperatorDirectory,
  identity: OperatorIdentity,
): Promise<Operator | null> {
  const email = normalizeAllowlistEmail(identity.email);

  if (email === null) {
    return null;
  }

  const record = await directory.findByAllowlistedEmail(email);

  if (record === null) {
    return null;
  }

  if (record.authUserId === null) {
    await directory.bindAuthUserId(record.id, identity.authUserId);

    return { ...record, authUserId: identity.authUserId };
  }

  if (record.authUserId !== identity.authUserId) {
    // Exactly one identity per sender. Re-binding here would let whoever signed
    // in most recently inherit the other operator's guests.
    return null;
  }

  return { ...record, authUserId: record.authUserId };
}

/**
 * Signs an operator in with an email address and a password.
 *
 * `null` for every refusal, and every refusal must be indistinguishable to the
 * person at the form. Three things make that true, and all three are load
 * bearing:
 *
 *  1. **The password is verified first, always.** Consulting `senders` first
 *     would let a non-operator address be refused without any password check —
 *     a measurably faster answer, and a timing oracle no amount of identical
 *     wording can hide.
 *  2. **The session is destroyed when the authenticated identity is not an
 *     operator.** Those credentials really are valid, so a session really is
 *     issued; leaving it would give a stranger a signed-in browser and make
 *     their outcome trivially distinguishable from a wrong password.
 *  3. **The identity comes from the session, never from the form.** The address
 *     that decides authorization is the one the auth server confirmed. That is
 *     the same belt-and-braces re-check the magic-link exchange used to do.
 *
 * There is deliberately no sign-up and no reset, and the claim that matters is
 * bigger than this form. `signInWithPassword` never creates a user, so nothing
 * typed HERE can make an `auth.users` row appear — but the form was never the
 * boundary. `POST /auth/v1/signup` is reachable by anyone holding the
 * publishable key, which is printed in the page source of every invitation, so
 * the endpoint has to be shut on the INSTANCE, and no source file can do that
 * for an instance it does not configure.
 *
 * What is proven, and exactly where the proof stops. `supabase/config.toml` sets
 * `[auth] enable_signup = false`, and `e2e/invariants/auth-signup.spec.ts` probes
 * a running instance to assert the refusal rather than trusting the flag. That
 * config file governs the containers the Supabase CLI starts LOCALLY, and the
 * probe reaches whatever `SUPABASE_URL` names, which is the local stack unless it
 * is pointed elsewhere. A hosted project carries its own auth settings, which
 * nothing in this repository writes — so a deployed project's signup posture is
 * neither configured nor observed here. Closing it is a deploy-time step, tracked
 * as task 7.4. Until that step is done, a deployed project can still mint an
 * unvetted identity while every command in this repository stays green, which is
 * the failure mode this paragraph exists to keep visible.
 *
 * Operator accounts are created once, out of band, by
 * `scripts/seed-operators.ts` through the admin API, which that flag does not
 * affect.
 */
export async function signInOperator(
  directory: OperatorDirectory,
  authenticator: OperatorPasswordAuthenticator,
  rawEmail: string | null | undefined,
  rawPassword: string | null | undefined,
): Promise<Operator | null> {
  const email = normalizeAllowlistEmail(rawEmail);

  // A password is an opaque byte string: it is never trimmed, lowercased or
  // otherwise rewritten. Only its presence is checked here.
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (email === null || password === "") {
    // Neither of these can identify an operator — `allowlisted_email` is
    // constrained to a well-formed lowercase address, and an empty password
    // authenticates nobody — so refusing without a round trip reveals only that
    // the form was incomplete, which the visitor already knows.
    return null;
  }

  const identity = await authenticator.signIn(email, password);

  if (identity === null) {
    return null;
  }

  const operator = await resolveOperator(directory, identity);

  if (operator === null) {
    await authenticator.signOut();

    return null;
  }

  return operator;
}

interface SenderRow {
  readonly id: string;
  readonly display_name: string;
  readonly role: OperatorRecord["role"];
  readonly allowlisted_email: string;
  readonly auth_user_id: string | null;
}

/** The real allowlist, read with the secret key (`senders` is default-deny). */
export function supabaseOperatorDirectory(
  client: SupabaseClient = createServerSupabaseClient(),
): OperatorDirectory {
  return {
    async findByAllowlistedEmail(email) {
      const { data, error } = await client
        .from("senders")
        .select("id, display_name, role, allowlisted_email, auth_user_id")
        .eq("allowlisted_email", email)
        .maybeSingle<SenderRow>();

      if (error) {
        throw new Error(
          `Could not read the operator allowlist: ${error.message}`,
        );
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        displayName: data.display_name,
        role: data.role,
        allowlistedEmail: data.allowlisted_email,
        authUserId: data.auth_user_id,
      };
    },

    async bindAuthUserId(senderId, authUserId) {
      // `is('auth_user_id', null)` makes the binding a compare-and-set: two
      // simultaneous first sign-ins cannot both win, and the loser is denied
      // by `resolveOperator` on its next read rather than overwriting.
      const { error } = await client
        .from("senders")
        .update({ auth_user_id: authUserId })
        .eq("id", senderId)
        .is("auth_user_id", null);

      if (error) {
        throw new Error(
          `Could not bind the operator identity: ${error.message}`,
        );
      }
    },
  };
}

/**
 * The real password check, through Supabase Auth.
 *
 * The client passed in must be the one built with the PUBLISHABLE key and
 * bound to this request's cookies: signing in writes the session, and signing
 * out has to clear the very cookies that sign-in wrote.
 *
 * Every failure collapses to `null`. The reason Supabase gives — wrong
 * password, unknown user, unconfirmed address, rate limited — is exactly the
 * information this form exists not to publish.
 */
export function supabaseOperatorPasswordAuthenticator(
  client: SupabaseClient,
): OperatorPasswordAuthenticator {
  return {
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return null;
      }

      return sessionIdentityOf(data.user);
    },

    async signOut() {
      await client.auth.signOut();
    },
  };
}
