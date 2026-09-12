import { beforeEach, describe, expect, it } from "vitest";

import type { OperatorIdentity } from "@/lib/domain/operator-session";

import {
  SIGN_IN_NOTICE,
  resolveOperator,
  sessionIdentityOf,
  signInOperator,
  type OperatorDirectory,
  type OperatorPasswordAuthenticator,
  type OperatorRecord,
} from "./auth";

const ANA_AUTH_USER_ID = "11111111-1111-1111-1111-111111111111";
const BETO_AUTH_USER_ID = "22222222-2222-2222-2222-222222222222";
const ANA_SENDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function anaRecord(overrides: Partial<OperatorRecord> = {}): OperatorRecord {
  return {
    id: ANA_SENDER_ID,
    displayName: "Ana",
    role: "partner_a",
    allowlistedEmail: "ana@example.test",
    authUserId: null,
    ...overrides,
  };
}

/**
 * A recording directory.
 *
 * The assertions that matter here are about what was NOT done — no binding for
 * an unallowlisted address, no second binding for an already-bound one — so the
 * fake has to remember its calls, not just answer them.
 */
class FakeDirectory implements OperatorDirectory {
  readonly lookups: string[] = [];
  readonly bindings: Array<{ senderId: string; authUserId: string }> = [];

  constructor(private readonly records: OperatorRecord[] = []) {}

  async findByAllowlistedEmail(email: string): Promise<OperatorRecord | null> {
    this.lookups.push(email);

    return this.records.find((r) => r.allowlistedEmail === email) ?? null;
  }

  async bindAuthUserId(senderId: string, authUserId: string): Promise<void> {
    this.bindings.push({ senderId, authUserId });

    const record = this.records.find((r) => r.id === senderId);
    if (record) {
      this.records[this.records.indexOf(record)] = { ...record, authUserId };
    }
  }
}

interface FakeAccount {
  readonly email: string;
  readonly password: string;
  readonly authUserId: string;
}

/**
 * A recording password authenticator.
 *
 * It tracks whether a session is currently open, because that is the half of
 * "indistinguishable" a returned value cannot express: a stranger who supplies
 * the correct password for their own Supabase account DOES get authenticated,
 * and the only thing that stops that from being observable is the sign-out that
 * must follow. A fake that only answered `signIn` could not catch its absence.
 */
class FakePasswordAuthenticator implements OperatorPasswordAuthenticator {
  readonly attempts: Array<{ email: string; password: string }> = [];
  sessionOpen = false;
  signOutCount = 0;

  constructor(private readonly accounts: readonly FakeAccount[] = []) {}

  async signIn(
    email: string,
    password: string,
  ): Promise<OperatorIdentity | null> {
    this.attempts.push({ email, password });

    const account = this.accounts.find(
      (candidate) =>
        candidate.email === email && candidate.password === password,
    );

    if (!account) {
      return null;
    }

    this.sessionOpen = true;

    return { authUserId: account.authUserId, email: account.email };
  }

  async signOut(): Promise<void> {
    this.signOutCount += 1;
    this.sessionOpen = false;
  }
}

describe("resolveOperator", () => {
  let directory: FakeDirectory;

  beforeEach(() => {
    directory = new FakeDirectory([anaRecord()]);
  });

  it("denies an address that is not in senders, and binds nothing", async () => {
    const resolved = await resolveOperator(directory, {
      authUserId: BETO_AUTH_USER_ID,
      email: "stranger@example.test",
    });

    expect(resolved).toBeNull();
    expect(directory.bindings).toEqual([]);
  });

  it("binds auth_user_id on the first allowlisted sign-in", async () => {
    const resolved = await resolveOperator(directory, {
      authUserId: ANA_AUTH_USER_ID,
      email: "ana@example.test",
    });

    expect(resolved).toEqual({
      id: ANA_SENDER_ID,
      displayName: "Ana",
      role: "partner_a",
      allowlistedEmail: "ana@example.test",
      authUserId: ANA_AUTH_USER_ID,
    });
    expect(directory.bindings).toEqual([
      { senderId: ANA_SENDER_ID, authUserId: ANA_AUTH_USER_ID },
    ]);
  });

  it("does not re-bind on a later sign-in by the same identity", async () => {
    const bound = new FakeDirectory([
      anaRecord({ authUserId: ANA_AUTH_USER_ID }),
    ]);

    const resolved = await resolveOperator(bound, {
      authUserId: ANA_AUTH_USER_ID,
      email: "ana@example.test",
    });

    expect(resolved?.authUserId).toBe(ANA_AUTH_USER_ID);
    expect(bound.bindings).toEqual([]);
  });

  it("denies a second auth identity claiming an already-bound sender", async () => {
    // The spec is "exactly one senders.auth_user_id identity". Silently
    // re-binding would let whoever signs in last take over the operator row —
    // and take their guests' phone numbers with it.
    const bound = new FakeDirectory([
      anaRecord({ authUserId: ANA_AUTH_USER_ID }),
    ]);

    const resolved = await resolveOperator(bound, {
      authUserId: BETO_AUTH_USER_ID,
      email: "ana@example.test",
    });

    expect(resolved).toBeNull();
    expect(bound.bindings).toEqual([]);
  });

  it("looks the operator up by the canonical lowercase address", async () => {
    const resolved = await resolveOperator(directory, {
      authUserId: ANA_AUTH_USER_ID,
      email: "  Ana@Example.Test ",
    });

    expect(directory.lookups).toEqual(["ana@example.test"]);
    expect(resolved?.id).toBe(ANA_SENDER_ID);
  });

  it("denies a malformed session address without touching the directory", async () => {
    const resolved = await resolveOperator(directory, {
      authUserId: ANA_AUTH_USER_ID,
      email: "not-an-address",
    });

    expect(resolved).toBeNull();
    expect(directory.lookups).toEqual([]);
    expect(directory.bindings).toEqual([]);
  });
});

const ANA_PASSWORD = "correct-horse-battery-staple";
const STRANGER_PASSWORD = "a-perfectly-valid-password";

function anaAccount(): FakeAccount {
  return {
    email: "ana@example.test",
    password: ANA_PASSWORD,
    authUserId: ANA_AUTH_USER_ID,
  };
}

function strangerAccount(): FakeAccount {
  return {
    email: "stranger@example.test",
    password: STRANGER_PASSWORD,
    authUserId: BETO_AUTH_USER_ID,
  };
}

/**
 * Everything a caller of `signInOperator` can observe about one attempt.
 *
 * Deliberately not a message: the refusals are compared against EACH OTHER
 * rather than against a literal, because a literal would still pass if all
 * three sentences changed together and one of them started leaking. What must
 * be equal is the whole observable outcome — the answer, whether a session
 * survives, and whether the allowlist was touched.
 */
interface ObservedAttempt {
  readonly admitted: boolean;
  readonly sessionOpen: boolean;
  readonly bindings: number;
}

async function observeSignIn(
  email: string,
  password: string,
): Promise<ObservedAttempt> {
  const directory = new FakeDirectory([anaRecord()]);
  const authenticator = new FakePasswordAuthenticator([
    anaAccount(),
    strangerAccount(),
  ]);

  const operator = await signInOperator(
    directory,
    authenticator,
    email,
    password,
  );

  return {
    admitted: operator !== null,
    sessionOpen: authenticator.sessionOpen,
    bindings: directory.bindings.length,
  };
}

describe("signInOperator", () => {
  it("admits an allowlisted operator and binds their identity on the first sign-in", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([anaAccount()]);

    const operator = await signInOperator(
      directory,
      authenticator,
      "ana@example.test",
      ANA_PASSWORD,
    );

    expect(operator).toEqual({
      id: ANA_SENDER_ID,
      displayName: "Ana",
      role: "partner_a",
      allowlistedEmail: "ana@example.test",
      authUserId: ANA_AUTH_USER_ID,
    });
    expect(authenticator.sessionOpen).toBe(true);
    expect(authenticator.signOutCount).toBe(0);
    expect(directory.bindings).toEqual([
      { senderId: ANA_SENDER_ID, authUserId: ANA_AUTH_USER_ID },
    ]);
  });

  it("refuses a wrong password for a real operator, and opens no session", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([anaAccount()]);

    const operator = await signInOperator(
      directory,
      authenticator,
      "ana@example.test",
      "not-the-password",
    );

    expect(operator).toBeNull();
    expect(authenticator.sessionOpen).toBe(false);
    expect(directory.bindings).toEqual([]);
  });

  it("refuses a correct password for an address that is not an operator, and destroys the session it just created", async () => {
    // This is the case a naive implementation gets wrong. The credentials are
    // genuinely valid, so Supabase issues a session; leaving it in place would
    // hand a stranger a signed-in browser and — far worse — make their outcome
    // observably different from a wrong password.
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([strangerAccount()]);

    const operator = await signInOperator(
      directory,
      authenticator,
      "stranger@example.test",
      STRANGER_PASSWORD,
    );

    expect(operator).toBeNull();
    expect(authenticator.signOutCount).toBe(1);
    expect(authenticator.sessionOpen).toBe(false);
  });

  it("refuses an address with no account at all", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([anaAccount()]);

    const operator = await signInOperator(
      directory,
      authenticator,
      "nobody@example.test",
      "whatever-they-typed",
    );

    expect(operator).toBeNull();
    expect(authenticator.sessionOpen).toBe(false);
  });

  it("answers the three refusals identically, compared against one another", async () => {
    // Whether an address is one of the two people who can see every guest's
    // phone number is not public information. These three attempts fail for
    // three completely different reasons and must be indistinguishable.
    const wrongPassword = await observeSignIn(
      "ana@example.test",
      "not-the-password",
    );
    const strangerWithAnAccount = await observeSignIn(
      "stranger@example.test",
      STRANGER_PASSWORD,
    );
    const noAccountAtAll = await observeSignIn(
      "nobody@example.test",
      "whatever-they-typed",
    );

    expect(wrongPassword).toEqual(strangerWithAnAccount);
    expect(strangerWithAnAccount).toEqual(noAccountAtAll);
    expect(wrongPassword).toEqual({
      admitted: false,
      sessionOpen: false,
      bindings: 0,
    });
  });

  it("does distinguish the one case that is allowed to differ: a real operator", async () => {
    // The companion to the assertion above. Without it, an implementation that
    // refused EVERYONE would satisfy "the refusals are identical" perfectly.
    const refused = await observeSignIn("ana@example.test", "not-the-password");
    const admitted = await observeSignIn("ana@example.test", ANA_PASSWORD);

    expect(admitted).not.toEqual(refused);
    expect(admitted).toEqual({
      admitted: true,
      sessionOpen: true,
      bindings: 1,
    });
  });

  it("never consults the allowlist before the password has been verified", async () => {
    // Checking `senders` first would make a non-operator address answer without
    // a password verification at all — a measurably faster refusal, which is an
    // enumeration oracle that no identical sentence can hide.
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([anaAccount()]);

    await signInOperator(
      directory,
      authenticator,
      "stranger@example.test",
      "not-the-password",
    );

    expect(authenticator.attempts).toEqual([
      { email: "stranger@example.test", password: "not-the-password" },
    ]);
    expect(directory.lookups).toEqual([]);
  });

  it("normalizes the address before it reaches the authenticator", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([anaAccount()]);

    const operator = await signInOperator(
      directory,
      authenticator,
      "  Ana@Example.Test ",
      ANA_PASSWORD,
    );

    expect(authenticator.attempts).toEqual([
      { email: "ana@example.test", password: ANA_PASSWORD },
    ]);
    expect(operator?.id).toBe(ANA_SENDER_ID);
  });

  it("does not trim or otherwise rewrite the password", async () => {
    // A password is an opaque byte string. Trimming it would silently make two
    // different passwords the same one, and would lock out anyone whose
    // password legitimately ends in a space.
    const directory = new FakeDirectory([anaRecord()]);
    const authenticator = new FakePasswordAuthenticator([anaAccount()]);

    await signInOperator(
      directory,
      authenticator,
      "ana@example.test",
      `  ${ANA_PASSWORD}  `,
    );

    expect(authenticator.attempts).toEqual([
      { email: "ana@example.test", password: `  ${ANA_PASSWORD}  ` },
    ]);
  });

  it.each([
    {
      email: "not-an-address",
      password: ANA_PASSWORD,
      why: "a malformed address",
    },
    { email: "ana@example.test", password: "", why: "an empty password" },
    { email: null, password: ANA_PASSWORD, why: "a missing address" },
    { email: "ana@example.test", password: null, why: "a missing password" },
  ])(
    "refuses $why without attempting a sign-in",
    async ({ email, password }) => {
      const directory = new FakeDirectory([anaRecord()]);
      const authenticator = new FakePasswordAuthenticator([anaAccount()]);

      const operator = await signInOperator(
        directory,
        authenticator,
        email,
        password,
      );

      expect(operator).toBeNull();
      expect(authenticator.attempts).toEqual([]);
      expect(directory.lookups).toEqual([]);
    },
  );

  it("denies a second auth identity claiming an already-bound sender, and signs it out", async () => {
    // The same rule `resolveOperator` enforces, reached through the real
    // sign-in path: valid credentials for an auth user that is not the one
    // bound to the sender row must not inherit that operator's guests.
    const directory = new FakeDirectory([
      anaRecord({ authUserId: ANA_AUTH_USER_ID }),
    ]);
    const authenticator = new FakePasswordAuthenticator([
      { ...anaAccount(), authUserId: BETO_AUTH_USER_ID },
    ]);

    const operator = await signInOperator(
      directory,
      authenticator,
      "ana@example.test",
      ANA_PASSWORD,
    );

    expect(operator).toBeNull();
    expect(authenticator.sessionOpen).toBe(false);
    expect(directory.bindings).toEqual([]);
  });
});

describe("SIGN_IN_NOTICE", () => {
  it("names neither the address nor whether an account exists", () => {
    // The one sentence every refusal gets. Words like "contraseña incorrecta"
    // or "no existe" would answer the enumeration question in plain Spanish.
    expect(SIGN_IN_NOTICE).not.toMatch(/incorrect|no existe|no encontr/i);
    expect(SIGN_IN_NOTICE).not.toMatch(/@/);
    expect(SIGN_IN_NOTICE.length).toBeGreaterThan(0);
  });
});

describe("sessionIdentityOf", () => {
  it("takes the identity from the authenticated user, not from any form field", () => {
    const identity: OperatorIdentity | null = sessionIdentityOf({
      id: ANA_AUTH_USER_ID,
      email: "ana@example.test",
    });

    expect(identity).toEqual({
      authUserId: ANA_AUTH_USER_ID,
      email: "ana@example.test",
    });
  });

  it("returns null when there is no user at all", () => {
    expect(sessionIdentityOf(null)).toBeNull();
  });

  it.each([
    { user: { id: ANA_AUTH_USER_ID, email: null }, reason: "a null address" },
    {
      user: { id: ANA_AUTH_USER_ID, email: undefined },
      reason: "a missing address",
    },
    { user: { id: ANA_AUTH_USER_ID, email: "" }, reason: "an empty address" },
    {
      user: { id: "", email: "ana@example.test" },
      reason: "an empty user id",
    },
  ])("returns null for a user with $reason", ({ user }) => {
    expect(sessionIdentityOf(user)).toBeNull();
  });
});
