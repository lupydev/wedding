import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeAllowlistEmail } from "@/lib/domain/operator-session";

import type { OperatorRecord } from "./auth";

/**
 * Operator provisioning.
 *
 * The one place in the product that WRITES an operator into existence, and the
 * only place that ever holds a password. It is deliberately not reachable from
 * any route: `scripts/seed-operators.ts` is its single caller, run by hand by a
 * maintainer. There are two operators, they are created once, and a forgotten
 * password is that script run again.
 *
 * Why both halves in one function: an `auth.users` row without a `senders` row
 * is a person who can authenticate and is then bounced at the console door,
 * and a `senders` row without an auth user is an operator who cannot sign in at
 * all. Both failures look like "the login is broken" and neither is visible in
 * the place you would look. Seeding them together, and BINDING them, is what
 * makes the two halves impossible to get out of step by hand.
 *
 * `senders.auth_user_id` is bound here rather than left for the first sign-in
 * to discover. `resolveOperator` still performs that compare-and-set binding —
 * it must, because a sender row can also be inserted by hand — but a seeded
 * operator arrives already bound, which closes the window in which the wrong
 * auth user could claim the row.
 */

/** One operator to provision. The password is held only for this call. */
export interface OperatorSeedInput {
  readonly displayName: string;
  readonly role: OperatorRecord["role"];
  readonly allowlistedEmail: string;
  readonly contactPhone: string;
  readonly password: string;
}

/**
 * What one seeding pass actually did.
 *
 * It carries no address, no phone number and — obviously — no password, because
 * its only consumer prints it. It distinguishes "created" from "found" so a
 * second run is visibly a no-op rather than a silent claim of success.
 */
export interface OperatorSeedOutcome {
  readonly displayName: string;
  readonly authUserCreated: boolean;
  readonly senderCreated: boolean;
}

/** How many users one admin listing page asks for. */
const USER_PAGE_SIZE = 200;

/**
 * Finds an existing auth user by address.
 *
 * The admin API has no "get by email", so this pages through the listing. That
 * is acceptable precisely because of what this module is for: a project with a
 * handful of operators, run by hand. It would not be acceptable on a request
 * path, and this is not one.
 */
async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: USER_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Could not list the auth users: ${error.message}`);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (match) {
      return match;
    }

    if (data.users.length < USER_PAGE_SIZE) {
      return null;
    }
  }
}

/**
 * Creates or updates one operator's auth user, and returns its id.
 *
 * `email_confirm: true` because nobody is going to click a confirmation link:
 * the address was chosen by the maintainer running this, and an unconfirmed
 * address would refuse the very first sign-in with an error the login form is
 * designed never to explain.
 */
async function upsertAuthUser(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<{ authUserId: string; created: boolean }> {
  const existing = await findAuthUserByEmail(client, email);

  if (existing) {
    const { error } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });

    if (error) {
      // The address is named; the password never is, not even in a failure.
      throw new Error(
        `Could not update the auth user for ${email}: ${error.message}`,
      );
    }

    return { authUserId: existing.id, created: false };
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `Could not create the auth user for ${email}: ${error?.message ?? "no user was returned"}`,
    );
  }

  return { authUserId: data.user.id, created: true };
}

/**
 * Creates or updates one operator: the auth user, the `senders` row, and the
 * binding between them.
 *
 * Idempotent by address. Running it twice leaves exactly one auth user and
 * exactly one sender row, and says so.
 */
export async function seedOperator(
  client: SupabaseClient,
  seed: OperatorSeedInput,
): Promise<OperatorSeedOutcome> {
  const email = normalizeAllowlistEmail(seed.allowlistedEmail);

  if (email === null) {
    throw new Error(
      `${seed.displayName}: the operator address is not a well-formed email address.`,
    );
  }

  if (seed.password === "") {
    throw new Error(`${seed.displayName}: the operator password is empty.`);
  }

  const { authUserId, created: authUserCreated } = await upsertAuthUser(
    client,
    email,
    seed.password,
  );

  const { data: existing, error: readError } = await client
    .from("senders")
    .select("id")
    .eq("allowlisted_email", email)
    .maybeSingle<{ id: string }>();

  if (readError) {
    throw new Error(
      `Could not read the operator allowlist: ${readError.message}`,
    );
  }

  const columns = {
    display_name: seed.displayName,
    role: seed.role,
    allowlisted_email: email,
    contact_wa_phone_e164: seed.contactPhone,
    auth_user_id: authUserId,
  };

  if (existing) {
    const { error } = await client
      .from("senders")
      .update(columns)
      .eq("id", existing.id);

    if (error) {
      throw new Error(
        `Could not update the operator ${seed.displayName}: ${error.message}`,
      );
    }

    return {
      displayName: seed.displayName,
      authUserCreated,
      senderCreated: false,
    };
  }

  const { error } = await client.from("senders").insert(columns);

  if (error) {
    throw new Error(
      `Could not create the operator ${seed.displayName}: ${error.message}`,
    );
  }

  return {
    displayName: seed.displayName,
    authUserCreated,
    senderCreated: true,
  };
}
