import { describe, expect, it } from "vitest";

import {
  OPERATOR_SOURCE_PATH,
  formatSeedOutcomes,
  parseOperatorSource,
  resolveOperatorSeeds,
  type OperatorSourceRow,
} from "./seed-operators";

/**
 * The operator seeding tool, as pure decisions.
 *
 * Everything asserted here is about what must NOT happen: a real address, a
 * real phone number or a password entering the repository, a password reaching
 * the terminal, or a half-validated file reaching the database. The write
 * itself is `lib/server/operators.ts` and is tested against a real Supabase.
 */

function sourceRow(
  overrides: Partial<OperatorSourceRow> = {},
): OperatorSourceRow {
  return {
    displayName: "Ana",
    role: "partner_a",
    email: "ana@example.test",
    contactPhone: "+573019900001",
    passwordEnv: "OPERATOR_PASSWORD_ANA",
    ...overrides,
  } as OperatorSourceRow;
}

const ENV = { OPERATOR_PASSWORD_ANA: "una-contrasena-larga-y-unica" } as const;

describe("parseOperatorSource", () => {
  it("reads a well-formed source into rows", () => {
    const rows = parseOperatorSource(
      JSON.stringify({ operators: [sourceRow()] }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].displayName).toBe("Ana");
    expect(rows[0].passwordEnv).toBe("OPERATOR_PASSWORD_ANA");
  });

  it("rejects a source that is not valid JSON, naming the file", () => {
    expect(() => parseOperatorSource("{ not json")).toThrow(
      new RegExp(OPERATOR_SOURCE_PATH),
    );
  });

  it("rejects a source with no operators array", () => {
    expect(() => parseOperatorSource(JSON.stringify({ rows: [] }))).toThrow(
      /operators/,
    );
  });

  it("rejects an empty operators array rather than reporting success on nothing", () => {
    expect(() =>
      parseOperatorSource(JSON.stringify({ operators: [] })),
    ).toThrow(/no operators/i);
  });

  it("points at a source path that is git-ignored", () => {
    // The operators' real addresses and phone numbers must never enter the
    // repository. The path is asserted here so a rename cannot silently move it
    // back into tracking.
    expect(OPERATOR_SOURCE_PATH).toBe("data/operators.source.json");
  });
});

describe("resolveOperatorSeeds", () => {
  it("resolves a row into a seed, taking the password from the environment", () => {
    const seeds = resolveOperatorSeeds([sourceRow()], ENV);

    expect(seeds).toEqual([
      {
        displayName: "Ana",
        role: "partner_a",
        allowlistedEmail: "ana@example.test",
        contactPhone: "+573019900001",
        password: "una-contrasena-larga-y-unica",
      },
    ]);
  });

  it("lowercases the address, which the allowlist CHECK constraint requires", () => {
    const seeds = resolveOperatorSeeds(
      [sourceRow({ email: "  Ana@Example.Test " })],
      ENV,
    );

    expect(seeds[0].allowlistedEmail).toBe("ana@example.test");
  });

  it("refuses a row whose password variable is not set", () => {
    // Named, so the maintainer knows which variable to export. The VALUE is
    // never in an error message, here or anywhere else.
    expect(() => resolveOperatorSeeds([sourceRow()], {})).toThrow(
      /OPERATOR_PASSWORD_ANA/,
    );
  });

  it("refuses a password shorter than the minimum", () => {
    expect(() =>
      resolveOperatorSeeds([sourceRow()], { OPERATOR_PASSWORD_ANA: "corta" }),
    ).toThrow(/12/);
  });

  it("never puts the password itself into a rejection message", () => {
    const password = "corta";

    try {
      resolveOperatorSeeds([sourceRow()], { OPERATOR_PASSWORD_ANA: password });
      throw new Error("expected a rejection");
    } catch (error) {
      expect((error as Error).message).not.toContain(password);
    }
  });

  it("refuses a row that carries a literal password, naming where it belongs", () => {
    // The single most valuable refusal in this file. A `password` key in the
    // source is a password in a file on disk, one `git add -f` away from the
    // repository — and the source file is the one thing a maintainer is
    // encouraged to edit by hand.
    expect(() =>
      resolveOperatorSeeds(
        [{ ...sourceRow(), password: "in-the-file" } as OperatorSourceRow],
        ENV,
      ),
    ).toThrow(/passwordEnv/);
  });

  it("refuses two operators that share one password variable", () => {
    // Otherwise both operators silently get the same password, which is one
    // shared account wearing two names.
    expect(() =>
      resolveOperatorSeeds(
        [
          sourceRow(),
          sourceRow({ displayName: "Beto", email: "beto@example.test" }),
        ],
        ENV,
      ),
    ).toThrow(/OPERATOR_PASSWORD_ANA/);
  });

  it("refuses two operators that share one address", () => {
    expect(() =>
      resolveOperatorSeeds(
        [
          sourceRow(),
          sourceRow({
            displayName: "Beto",
            passwordEnv: "OPERATOR_PASSWORD_BETO",
          }),
        ],
        { ...ENV, OPERATOR_PASSWORD_BETO: "otra-contrasena-larga" },
      ),
    ).toThrow(/ana@example.test/);
  });

  it("refuses a malformed address", () => {
    expect(() =>
      resolveOperatorSeeds([sourceRow({ email: "not-an-address" })], ENV),
    ).toThrow(/Ana/);
  });

  it.each(["3019900001", "+57 301 990 0001", "+0019900001", "", "+57301"])(
    "refuses the contact phone %s, which the senders CHECK would reject",
    (contactPhone) => {
      // Refused here rather than by the database, because the failure a
      // maintainer sees should name the operator, not a constraint.
      expect(() =>
        resolveOperatorSeeds([sourceRow({ contactPhone })], ENV),
      ).toThrow(/Ana/);
    },
  );

  it.each(["partner_a", "partner_b", "helper"])(
    "accepts the role %s",
    (role) => {
      const seeds = resolveOperatorSeeds(
        [sourceRow({ role } as Partial<OperatorSourceRow>)],
        ENV,
      );

      expect(seeds[0].role).toBe(role);
    },
  );

  it("refuses a role the senders CHECK does not allow", () => {
    expect(() =>
      resolveOperatorSeeds(
        [sourceRow({ role: "admin" } as Partial<OperatorSourceRow>)],
        ENV,
      ),
    ).toThrow(/admin/);
  });

  it("refuses a row with no display name, since every message is keyed by it", () => {
    expect(() =>
      resolveOperatorSeeds([sourceRow({ displayName: "  " })], ENV),
    ).toThrow(/displayName/);
  });

  it("validates every row before returning any of them", () => {
    // The same rule the guest import follows: a file with one bad row writes
    // nothing at all, rather than half an operator list.
    expect(() =>
      resolveOperatorSeeds(
        [
          sourceRow(),
          sourceRow({
            displayName: "Beto",
            email: "beto@example.test",
            passwordEnv: "OPERATOR_PASSWORD_BETO",
          }),
        ],
        ENV,
      ),
    ).toThrow(/OPERATOR_PASSWORD_BETO/);
  });
});

describe("formatSeedOutcomes", () => {
  it("reports what was created and what was already present", () => {
    const lines = formatSeedOutcomes([
      { displayName: "Ana", authUserCreated: true, senderCreated: true },
      { displayName: "Beto", authUserCreated: false, senderCreated: false },
    ]);

    expect(lines.join("\n")).toContain("Ana");
    expect(lines.join("\n")).toContain("Beto");
    expect(lines.join("\n")).toMatch(/2 operators/);
  });

  it("distinguishes a created operator from one that was updated in place", () => {
    const created = formatSeedOutcomes([
      { displayName: "Ana", authUserCreated: true, senderCreated: true },
    ]).join("\n");
    const updated = formatSeedOutcomes([
      { displayName: "Ana", authUserCreated: false, senderCreated: false },
    ]).join("\n");

    expect(created).not.toBe(updated);
    expect(created).toMatch(/created/i);
    expect(updated).toMatch(/updated|already/i);
  });

  it("prints no address, no phone number and no password", () => {
    // The same standard the guest import holds: this output reaches a terminal
    // and very often a scrollback buffer. A display name is enough to identify
    // a row out of two.
    const text = formatSeedOutcomes([
      { displayName: "Ana", authUserCreated: true, senderCreated: true },
      { displayName: "Beto", authUserCreated: false, senderCreated: false },
    ]).join("\n");

    expect(text).not.toMatch(/\d{7,}/);
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/contrase|password/i);
  });
});
