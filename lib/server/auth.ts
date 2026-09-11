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

/** Sends the magic link. Separated so the allowlist check can be tested dry. */
export interface MagicLinkMailer {
  send(email: string): Promise<void>;
}

/**
 * The one answer every sign-in request gets.
 *
 * Identical for an operator, a stranger, a typo and a mail failure. Anything
 * else — a different sentence, an extra field, a visible error, a measurably
 * different latency — turns this form into an oracle that answers "is this
 * person one of the two people who can see every guest's phone number?".
 */
export const MAGIC_LINK_NOTICE =
  "Si esa dirección corresponde a una persona operadora del panel, se envió un enlace de acceso. Revise su correo.";

/**
 * The authenticated user's own identity, or `null`.
 *
 * The belt-and-braces re-check the console depends on: after a magic link is
 * exchanged, the address that decides authorization is read back out of the
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
 * Requests a magic link, for an operator only.
 *
 * The allowlist is consulted BEFORE anything is sent, so an address that is not
 * an operator never receives mail and never causes an `auth.users` row to
 * appear. The return value is a constant either way.
 */
export async function requestOperatorMagicLink(
  directory: OperatorDirectory,
  mailer: MagicLinkMailer,
  rawEmail: string | null | undefined,
): Promise<string> {
  const email = normalizeAllowlistEmail(rawEmail);

  if (email === null) {
    return MAGIC_LINK_NOTICE;
  }

  const record = await directory.findByAllowlistedEmail(email);

  if (record === null) {
    return MAGIC_LINK_NOTICE;
  }

  try {
    await mailer.send(email);
  } catch {
    // Swallowed on purpose. A rate limit or an SMTP outage must not become the
    // difference between "this address is an operator" and "it is not".
  }

  return MAGIC_LINK_NOTICE;
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

/** Sends the magic link through Supabase Auth, for an address already allowed. */
export function supabaseMagicLinkMailer(
  client: SupabaseClient,
  emailRedirectTo: string,
): MagicLinkMailer {
  return {
    async send(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
          // The allowlist already decided this address may sign in, and the
          // sender row is the only thing that authorizes anything. Creating the
          // `auth.users` row on first link is what binds `auth_user_id`.
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
