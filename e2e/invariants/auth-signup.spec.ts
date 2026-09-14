import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";
import { seedOperator } from "../helpers/operator";

/**
 * The Auth posture, proved from OUTSIDE.
 *
 * `e2e/invariants/rls.spec.ts` proves what the publishable key cannot do to the
 * DATA. This file proves what it cannot do to the IDENTITY store, which is the
 * other half of the same claim: this product's entire authorization model is
 * "no untrusted identity exists". Every table is default-deny to
 * `authenticated` precisely because nobody who is not an operator is ever
 * supposed to hold that role — and `senders` is the allowlist that decides who
 * is an operator.
 *
 * `SUPABASE_PUBLISHABLE_KEY` is in the browser by design; it is printed in the
 * page source of every invitation. So `POST /auth/v1/signup` is reachable by
 * anyone who opens the link, and if the project accepts it, a stranger mints
 * themselves a real `authenticated` JWT and a real `auth.users` row for an
 * address nobody vetted. No product flow needs that endpoint: `lib/server/auth.ts`
 * uses only `signInWithPassword`, and operator accounts are created out of band
 * by `scripts/seed-operators.ts` through the admin API.
 *
 * Both probe shapes are here on purpose. The supabase-js call is the one a
 * browser makes; the raw POST is the one `curl` makes, and it is the one that
 * stays true if the client library ever starts refusing locally.
 *
 * The last test is the control: disabling signup must not disable SIGN-IN.
 * Without it, "signup was refused" is equally satisfied by an auth server that
 * refuses everything, and the invariant would pass for the wrong reason.
 *
 * WHAT THIS FILE CAN REACH, WHICH IS LESS THAN IT SOUNDS. It proves the posture
 * of whatever instance `SUPABASE_URL` and `SUPABASE_DB_URL` name, and both
 * default to the local stack. `supabase/config.toml` sets the flag for that
 * stack only — a HOSTED project carries its own auth settings, which no file in
 * this repository writes. So a deployed project can leave signup open and this
 * suite still passes: absence of a red test here is not evidence about
 * production. The file is written to be re-aimable for exactly that reason —
 * point both variables at a deployed project and run it, which is the deploy-time
 * check tracked as task 7.4.
 */

const LOCAL_API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** A fresh address per run, so the suite is re-runnable with no manual cleanup. */
function probeEmail(shape: string): string {
  return `signup.probe.${shape}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
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

/** Reads the `auth.users` id for `email`, or null when no such row exists. */
async function findAuthUserId(email: string): Promise<string | null> {
  const db = await connect();
  try {
    const result = await db.query<{ id: string }>(
      "select id from auth.users where email = $1",
      [email],
    );

    return result.rows[0]?.id ?? null;
  } finally {
    await db.end();
  }
}

/**
 * Removes an account the probe managed to create.
 *
 * A probe that leaves its own user behind makes the next run assert against a
 * database the previous run polluted, and this file is meant to be run on
 * demand, repeatedly, exactly like the RLS invariants beside it.
 */
async function deleteAuthUser(email: string): Promise<void> {
  const id = await findAuthUserId(email);
  if (id === null) {
    return;
  }

  const { secretKey } = resolveLocalKeys();
  const admin = createClient(LOCAL_API_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.auth.admin.deleteUser(id);
}

test.describe("self-service signup held shut against the publishable key", () => {
  const { anonKey } = resolveLocalKeys();
  const anon: SupabaseClient = createClient(LOCAL_API_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  test("refuses the browser signup call and issues no session", async () => {
    const email = probeEmail("browser");

    try {
      const { data, error } = await anon.auth.signUp({
        email,
        password: `probe-${Math.random().toString(36).slice(2)}`,
      });

      // The refusal must be the auth server's, not a network accident, so the
      // error is named rather than merely present.
      expect(error?.code ?? "NO_ERROR").toBe("signup_disabled");
      // The consequence that actually matters: no `authenticated` JWT exists.
      expect(data.session).toBeNull();
      expect(data.user).toBeNull();
    } finally {
      await deleteAuthUser(email);
    }
  });

  test("refuses a raw POST to /auth/v1/signup and creates no auth.users row", async () => {
    const email = probeEmail("raw");

    try {
      const response = await fetch(`${LOCAL_API_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: `probe-${Math.random().toString(36).slice(2)}`,
        }),
      });
      const body = (await response.json()) as {
        error_code?: string;
        access_token?: string;
      };

      expect(response.ok).toBe(false);
      expect(body.error_code ?? "NO_ERROR").toBe("signup_disabled");
      expect(body.access_token).toBeUndefined();

      // Read the identity store itself. A refusal returned after a partial
      // write would look identical from the response alone.
      expect(await findAuthUserId(email)).toBeNull();
    } finally {
      await deleteAuthUser(email);
    }
  });

  test("still signs in an out-of-band operator, so the refusal is surgical", async () => {
    // Without this, "signup is refused" is equally satisfied by an auth server
    // that refuses everything, and the two tests above would pass for the wrong
    // reason. The operator is created the way production creates one: through
    // the admin API, never through the endpoint under test.
    const operator = await seedOperator();

    try {
      const { data, error } = await anon.auth.signInWithPassword({
        email: operator.allowlistedEmail,
        password: operator.password,
      });

      expect(error).toBeNull();
      expect(data.session?.access_token).toBeTruthy();
      expect(data.user?.email).toBe(operator.allowlistedEmail);

      await anon.auth.signOut();
    } finally {
      await operator.cleanup();
    }
  });
});
