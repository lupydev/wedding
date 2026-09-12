import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import { LOCAL_API_URL, withDb } from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";

import { seedOperator, type OperatorSeedInput } from "./operators";

/**
 * Operator seeding, against a REAL local Supabase.
 *
 * It has to be real. The two things this module exists to get right — the admin
 * Auth API creating or updating one user, and `senders` accepting the row that
 * binds to it — are both behaviours of a server the repository does not own. A
 * mocked query builder would assert that the mock was called, which is exactly
 * the assertion that keeps passing after the real call starts failing.
 *
 * Every fixture address is random and is torn down afterwards, so the suite is
 * order-independent and leaves no operator behind.
 */

const createdEmails: string[] = [];

function adminClient(): SupabaseClient {
  const { secretKey } = resolveLocalKeys();

  return createClient(LOCAL_API_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function seedInput(
  overrides: Partial<OperatorSeedInput> = {},
): OperatorSeedInput {
  const suffix = randomBytes(4).toString("hex");
  const allowlistedEmail = `seed.${suffix}@example.test`;
  createdEmails.push(allowlistedEmail);

  return {
    displayName: `Operadora ${suffix}`,
    role: "partner_a",
    allowlistedEmail,
    // Fabricated, like every number in this repository's fixtures.
    contactPhone: "+573019900001",
    password: `seed-password-${suffix}`,
    ...overrides,
  };
}

afterEach(async () => {
  const client = adminClient();

  while (createdEmails.length > 0) {
    const email = createdEmails.pop() as string;

    const authUserId = await withDb(async (db) => {
      const found = await db.query<{ auth_user_id: string | null }>(
        "select auth_user_id from senders where allowlisted_email = $1",
        [email],
      );
      await db.query("delete from senders where allowlisted_email = $1", [
        email,
      ]);

      return found.rows[0]?.auth_user_id ?? null;
    });

    if (authUserId) {
      await client.auth.admin.deleteUser(authUserId);
    }
  }
});

describe("seedOperator", () => {
  it("creates the auth user and the sender row, and binds them to each other", async () => {
    const client = adminClient();
    const input = seedInput();

    const outcome = await seedOperator(client, input);

    expect(outcome).toEqual({
      displayName: input.displayName,
      authUserCreated: true,
      senderCreated: true,
    });

    const row = await withDb(async (db) =>
      db.query<{
        display_name: string;
        role: string;
        allowlisted_email: string;
        contact_wa_phone_e164: string;
        auth_user_id: string | null;
      }>(
        `select display_name, role, allowlisted_email, contact_wa_phone_e164, auth_user_id
         from senders where allowlisted_email = $1`,
        [input.allowlistedEmail],
      ),
    );

    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].display_name).toBe(input.displayName);
    expect(row.rows[0].role).toBe("partner_a");
    expect(row.rows[0].contact_wa_phone_e164).toBe(input.contactPhone);
    // Bound, not left null: the whole point of seeding both halves in one pass
    // is that the console never has to guess which auth user is which operator.
    expect(row.rows[0].auth_user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("lowercases the stored address, which the CHECK constraint requires", async () => {
    const client = adminClient();
    const input = seedInput();

    await seedOperator(client, {
      ...input,
      allowlistedEmail: input.allowlistedEmail.toUpperCase(),
    });

    const row = await withDb(async (db) =>
      db.query<{ allowlisted_email: string }>(
        "select allowlisted_email from senders where allowlisted_email = $1",
        [input.allowlistedEmail],
      ),
    );

    expect(row.rows[0]?.allowlisted_email).toBe(input.allowlistedEmail);
  });

  it("is idempotent: running it twice leaves exactly one user and one row", async () => {
    const client = adminClient();
    const input = seedInput();

    const first = await seedOperator(client, input);
    const second = await seedOperator(client, input);

    expect(first).toEqual({
      displayName: input.displayName,
      authUserCreated: true,
      senderCreated: true,
    });
    // The second run REPORTS that it created nothing. A tool that claimed to
    // have created an operator it merely found would make a duplicate
    // impossible to notice.
    expect(second).toEqual({
      displayName: input.displayName,
      authUserCreated: false,
      senderCreated: false,
    });

    const counts = await withDb(async (db) => {
      const senders = await db.query<{ count: string }>(
        "select count(*)::text as count from senders where allowlisted_email = $1",
        [input.allowlistedEmail],
      );
      const users = await db.query<{ count: string }>(
        "select count(*)::text as count from auth.users where email = $1",
        [input.allowlistedEmail],
      );

      return { senders: senders.rows[0].count, users: users.rows[0].count };
    });

    expect(counts).toEqual({ senders: "1", users: "1" });
  });

  it("updates the existing row rather than inserting a second one", async () => {
    const client = adminClient();
    const input = seedInput();

    await seedOperator(client, input);
    await seedOperator(client, {
      ...input,
      displayName: "Nombre corregido",
      role: "partner_b",
      contactPhone: "+573019900002",
    });

    const row = await withDb(async (db) =>
      db.query<{
        display_name: string;
        role: string;
        contact_wa_phone_e164: string;
      }>(
        `select display_name, role, contact_wa_phone_e164
         from senders where allowlisted_email = $1`,
        [input.allowlistedEmail],
      ),
    );

    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].display_name).toBe("Nombre corregido");
    expect(row.rows[0].role).toBe("partner_b");
    expect(row.rows[0].contact_wa_phone_e164).toBe("+573019900002");
  });

  it("sets a password the operator can actually sign in with", async () => {
    // The assertion that matters most, and the one no amount of row inspection
    // can make: the seeded credentials authenticate against the real auth
    // server, with the PUBLISHABLE key, exactly as the login form does.
    const { anonKey } = resolveLocalKeys();
    const input = seedInput();

    await seedOperator(adminClient(), input);

    const asBrowser = createClient(LOCAL_API_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await asBrowser.auth.signInWithPassword({
      email: input.allowlistedEmail,
      password: input.password,
    });

    expect(error).toBeNull();
    expect(data.user?.email).toBe(input.allowlistedEmail);
  });

  it("re-running with a new password replaces the old one", async () => {
    // This is the reset path. There is deliberately no self-service reset in
    // the product, so a maintainer re-running the tool has to actually work.
    const { anonKey } = resolveLocalKeys();
    const input = seedInput();

    await seedOperator(adminClient(), input);
    await seedOperator(adminClient(), { ...input, password: "the-new-one-42" });

    const asBrowser = createClient(LOCAL_API_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const stale = await asBrowser.auth.signInWithPassword({
      email: input.allowlistedEmail,
      password: input.password,
    });
    const fresh = await asBrowser.auth.signInWithPassword({
      email: input.allowlistedEmail,
      password: "the-new-one-42",
    });

    expect(stale.error).not.toBeNull();
    expect(stale.data.session).toBeNull();
    expect(fresh.error).toBeNull();
    expect(fresh.data.user?.email).toBe(input.allowlistedEmail);
  });

  it("confirms the address, so the first sign-in is not blocked by a pending confirmation", async () => {
    const input = seedInput();

    await seedOperator(adminClient(), input);

    const confirmed = await withDb(async (db) =>
      db.query<{ email_confirmed_at: Date | null }>(
        "select email_confirmed_at from auth.users where email = $1",
        [input.allowlistedEmail],
      ),
    );

    expect(confirmed.rows[0]?.email_confirmed_at).not.toBeNull();
  });
});
