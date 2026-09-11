import { beforeEach, describe, expect, it } from "vitest";

import type { OperatorIdentity } from "@/lib/domain/operator-session";

import {
  MAGIC_LINK_NOTICE,
  requestOperatorMagicLink,
  resolveOperator,
  sessionIdentityOf,
  type OperatorDirectory,
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

class RecordingMailer {
  readonly sent: string[] = [];
  shouldFail = false;

  async send(email: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error("smtp exploded");
    }

    this.sent.push(email);
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

describe("requestOperatorMagicLink", () => {
  it("sends a link to an allowlisted address", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const mailer = new RecordingMailer();

    const notice = await requestOperatorMagicLink(
      directory,
      mailer,
      "ana@example.test",
    );

    expect(mailer.sent).toEqual(["ana@example.test"]);
    expect(notice).toBe(MAGIC_LINK_NOTICE);
  });

  it("gives an unknown address the byte-identical answer, and sends nothing", async () => {
    // Whether an address is an operator is not public information. A different
    // message, a different field, or a different error is an enumeration oracle.
    const directory = new FakeDirectory([anaRecord()]);
    const mailer = new RecordingMailer();

    const notice = await requestOperatorMagicLink(
      directory,
      mailer,
      "stranger@example.test",
    );

    expect(mailer.sent).toEqual([]);
    expect(notice).toBe(MAGIC_LINK_NOTICE);
  });

  it("gives a malformed address the same answer too", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const mailer = new RecordingMailer();

    const notice = await requestOperatorMagicLink(directory, mailer, "@@@");

    expect(mailer.sent).toEqual([]);
    expect(directory.lookups).toEqual([]);
    expect(notice).toBe(MAGIC_LINK_NOTICE);
  });

  it("gives the same answer when delivery itself fails", async () => {
    // A rate-limited or broken mailer must not become a way to tell an operator
    // address apart from a stranger's.
    const directory = new FakeDirectory([anaRecord()]);
    const mailer = new RecordingMailer();
    mailer.shouldFail = true;

    const notice = await requestOperatorMagicLink(
      directory,
      mailer,
      "ana@example.test",
    );

    expect(notice).toBe(MAGIC_LINK_NOTICE);
  });

  it("normalizes the address before it reaches the mailer", async () => {
    const directory = new FakeDirectory([anaRecord()]);
    const mailer = new RecordingMailer();

    await requestOperatorMagicLink(directory, mailer, " ANA@Example.Test ");

    expect(mailer.sent).toEqual(["ana@example.test"]);
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
