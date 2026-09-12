import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";

/**
 * Console-operator fixtures for the browser-level suite.
 *
 * `senders` IS the allowlist, so seeding an operator means inserting a row —
 * there is no environment variable to set and no redeploy to wait for, which is
 * the whole point of design decision D7.
 *
 * Sign-in is email and password, so the `auth.users` row DOES have to exist
 * before the browser can sign in, and it is created here the same way
 * `scripts/seed-operators.ts` creates it: through the admin API, with a
 * password, confirmed. What is deliberately NOT seeded is
 * `senders.auth_user_id`: it stays NULL, and watching it become the seeded
 * user's id on the first sign-in is how the binding is asserted rather than
 * assumed.
 */

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const LOCAL_API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

export interface SeededOperator {
  readonly senderId: string;
  readonly displayName: string;
  readonly allowlistedEmail: string;
  /** Random per fixture. Never a real operator password, never committed. */
  readonly password: string;
  /** Fabricated. Never used to build a dispatch link; `wa.me` has no sender. */
  readonly contactPhone: string;
  /** The bound auth user id, read straight from the row. NULL until first login. */
  readonly boundAuthUserId: () => Promise<string | null>;
  readonly cleanup: () => Promise<void>;
}

/** An `auth.users` row with NO `senders` row: someone who is not an operator. */
export interface SeededAccount {
  readonly email: string;
  readonly password: string;
  readonly authUserId: string;
  readonly cleanup: () => Promise<void>;
}

async function connect(): Promise<Client> {
  const db = new Client({ connectionString: LOCAL_DB_URL });

  try {
    await db.connect();
  } catch (cause) {
    throw new Error(
      `Cannot reach the local Supabase database at ${LOCAL_DB_URL}. ` +
        "Run `supabase start` before the E2E suite. " +
        `Underlying error: ${(cause as Error).message}`,
    );
  }

  return db;
}

function adminClient(): SupabaseClient {
  const { secretKey } = resolveLocalKeys();

  return createClient(LOCAL_API_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates one confirmed auth user with a password.
 *
 * `email_confirm: true` for the same reason the seeding script sets it: an
 * unconfirmed address is refused at the first sign-in, and the login form is
 * designed never to explain why.
 */
async function createAuthUser(
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      `Could not create the auth user for the fixture: ${error?.message ?? "no user was returned"}`,
    );
  }

  return data.user.id;
}

async function deleteAuthUser(authUserId: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(authUserId);
}

export async function seedOperator(
  options: { displayName?: string } = {},
): Promise<SeededOperator> {
  const suffix = randomBytes(4).toString("hex");
  const allowlistedEmail = `operator.${suffix}.${Date.now()}@example.test`;
  const displayName = options.displayName ?? `Operadora ${suffix}`;
  const password = `fixture-password-${randomBytes(8).toString("hex")}`;
  // A block no GUEST fixture uses. The previous value was
  // `+5730055{two digits}00`, which drew `+57300555100` about once every thirty
  // runs — and that string is a PREFIX of `+573005551001`, a guest number seeded
  // by `console-guest-list.spec.ts` and legitimately rendered in the shared
  // dashboard. The console-auth assertion that no operator contact appears in
  // console page source then failed on a substring of somebody else's number,
  // reporting a personal-data leak that had not happened. `+57301990####` shares
  // no prefix with any guest fixture, so that assertion now fails only when the
  // operator's own contact really is on the page. Fabricated, like every number
  // in this suite: a real guest number must never enter a fixture.
  const contactPhone = `+57301990${suffix.slice(0, 4).replace(/\D/g, "1")}`;

  // The auth user first: if the sender row existed and this failed, the fixture
  // would be an operator who cannot sign in, which reads as a product defect.
  const authUserId = await createAuthUser(allowlistedEmail, password);
  const db = await connect();

  let senderId: string;
  try {
    const inserted = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ($1, 'partner_a', $2, $3)
       returning id`,
      [displayName, allowlistedEmail, contactPhone],
    );
    senderId = inserted.rows[0].id;
  } finally {
    await db.end();
  }

  return {
    senderId,
    displayName,
    allowlistedEmail,
    password,
    contactPhone,

    boundAuthUserId: async () => {
      const reader = await connect();
      try {
        const result = await reader.query<{ auth_user_id: string | null }>(
          "select auth_user_id from senders where id = $1",
          [senderId],
        );

        return result.rows[0]?.auth_user_id ?? null;
      } finally {
        await reader.end();
      }
    },

    cleanup: async () => {
      const cleaner = await connect();
      try {
        await cleaner.query("delete from senders where id = $1", [senderId]);
      } finally {
        await cleaner.end();
      }

      await deleteAuthUser(authUserId);
    },
  };
}

/**
 * Creates an authenticatable identity that is NOT an operator.
 *
 * The fixture the indistinguishability assertion needs: someone whose password
 * is genuinely correct and who still must be refused, in exactly the same words
 * and with exactly as little session as a wrong password gets.
 */
export async function seedAuthOnlyAccount(): Promise<SeededAccount> {
  const email = `stranger.${randomBytes(4).toString("hex")}.${Date.now()}@example.test`;
  const password = `fixture-password-${randomBytes(8).toString("hex")}`;
  const authUserId = await createAuthUser(email, password);

  return {
    email,
    password,
    authUserId,
    cleanup: async () => {
      await deleteAuthUser(authUserId);
    },
  };
}
