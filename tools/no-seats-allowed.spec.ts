import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * `seats_allowed` IS GONE. THIS IS THE TEST THAT KEEPS IT GONE.
 *
 * The column used to hold a per-invitation seat allowance that a human set
 * independently of the names on that invitation, so the two could disagree and
 * regularly did. Migration 0012 makes the cap `count(*)` of the household's
 * members and 0013 drops the column. A surviving READ is what re-introduces the
 * concept: a `select` naming a dropped column is an error at runtime, and a
 * TypeScript field named `seatsAllowed` over a derived value is how the next
 * reader concludes an allowance still exists somewhere.
 *
 * Migrations and down-scripts are deliberately OUTSIDE the scanned globs and
 * must stay there. They are the record of what already ran; 0001 created the
 * column, 0012 relaxed it and 0013 drops it, and every one of those files has
 * to name it.
 *
 * WHY THE EXEMPTION IS AN ENUMERATED LIST AND NOT A WIDER GLOB
 *
 * Exactly one scanned file must name the column: the database spec that asserts
 * the column is GONE, and that rolling 0013 back brings it back. That assertion
 * cannot be written without the literal, and querying the column name
 * indirectly would make it both weaker and unreadable.
 *
 * Widening a glob — "all specs", "all of supabase/tests" — would silently
 * re-open the hole for every future file that happens to match. A literal array
 * cannot: adding a path to it is an edit a reviewer sees and has to agree with.
 * The list is also checked against the filesystem below, so an exemption left
 * behind after its file was renamed or deleted fails here instead of quietly
 * covering nothing while looking like it covers something.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Every tree that ships application code, tests and fixtures included. */
const SCANNED_GLOBS = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
  "scripts/**/*.ts",
  "e2e/**/*.ts",
  "supabase/tests/**/*.ts",
];

/**
 * The complete exemption list. Every path on it must carry an assertion a
 * reader can open and verify, and it is added in the same commit as that
 * assertion — an exemption whose justification points at a test that does not
 * exist yet is self-justifying, covers nothing, and still passes its own
 * existence check.
 *
 *  - `scripts/import-guests.spec.ts` asserts that a source file in the OLD
 *    format is REJECTED. `seatsAllowed` was the exact key the pre-change
 *    `ImportRow` required, so the test cannot name the format it rejects
 *    without naming that key. It is the same shape of exemption the migration
 *    `0013` spec will need in slice 1b: an assertion that the concept is gone,
 *    which has to say the word once in order to say it is gone.
 */
const EXEMPT_PATHS = [
  "scripts/import-guests.spec.ts",
  "supabase/tests/seats-allowed-dropped.spec.ts",
] as const;

const SCANNED = SCANNED_GLOBS.flatMap((pattern) =>
  globSync(pattern, { cwd: REPO_ROOT }),
).filter((file) => !(EXEMPT_PATHS as readonly string[]).includes(file));

/** Both spellings: the SQL column and its TypeScript field name. */
const SEATS_ALLOWED = /seats_allowed|seatsAllowed/g;

describe("no source file reads a seat allowance", () => {
  it("has files to check, so this file is not vacuously green", () => {
    expect(SCANNED.length).toBeGreaterThanOrEqual(100);
  });

  it("includes the files the concept used to live in", () => {
    // Named explicitly: a glob that stopped matching them would make every
    // assertion below pass while the reads came back.
    expect(SCANNED).toContain("lib/server/invitations.ts");
    expect(SCANNED).toContain("lib/domain/console-list.ts");
    expect(SCANNED).toContain("lib/domain/seats.ts");
    expect(SCANNED).toContain("components/invitation/InvitationBody.tsx");
    expect(SCANNED).toContain("e2e/helpers/seed.ts");
  });

  it.each(SCANNED)("%s names no seat allowance", (file) => {
    const source = readFileSync(`${REPO_ROOT}${file}`, "utf8");
    const found = [...source.matchAll(SEATS_ALLOWED)].map((match) => match[0]);

    // Comments count. A comment still calling the cap `seats_allowed` tells the
    // next reader the column is out there somewhere, which is the belief this
    // change exists to remove.
    expect(found).toEqual([]);
  });

  it("every exempt path still exists on disk", () => {
    // A stale exemption is worse than no exemption: it looks like a considered
    // decision while covering a file nobody can find, and the next person to
    // need one adds theirs beside it instead of arguing for it.
    for (const path of EXEMPT_PATHS) {
      expect({ path, exists: existsSync(`${REPO_ROOT}${path}`) }).toEqual({
        path,
        exists: true,
      });
    }
  });

  it("exempts exactly the two files that must name the column to assert it is gone", () => {
    // The exemption is a whitelist, not a pattern, and this assertion is the
    // one that has to be argued with before it grows. Both arguments, made in
    // full beside the list itself:
    //
    //  - the importer spec asserts that a source file in the PRE-CHANGE format
    //    is rejected, and `seatsAllowed` was the exact key that format
    //    required. A test that rejects a format cannot avoid naming it.
    //  - the database spec asserts the column is ABSENT from the live schema
    //    and that its down script brings it back. This scanner reads source
    //    text and cannot see a database, so it cannot tell a tree that merely
    //    stopped reading the column from one where 0013 actually dropped it —
    //    the state 0012 deliberately left standing for one migration.
    //
    // Both name the column in order to assert something about its absence,
    // which is the only justification this list accepts. What it does NOT
    // license is a wildcard, a directory, or an entry whose justification
    // points at a test that does not exist.
    expect(EXEMPT_PATHS).toEqual([
      "scripts/import-guests.spec.ts",
      "supabase/tests/seats-allowed-dropped.spec.ts",
    ]);

    // A path listed but absent would exempt nothing while reading as coverage.
    for (const exempt of EXEMPT_PATHS as readonly string[]) {
      expect(existsSync(join(REPO_ROOT, exempt))).toBe(true);
      expect(SCANNED).not.toContain(exempt);
    }
  });

  it("would catch a read if one were added back", () => {
    // The guard's own guard. Without this, a regex that silently stopped
    // matching would leave every assertion above green and the rule unenforced.
    const reintroduced =
      "const cap = invitation.seatsAllowed; -- seats_allowed";

    expect([...reintroduced.matchAll(SEATS_ALLOWED)].map((m) => m[0])).toEqual([
      "seatsAllowed",
      "seats_allowed",
    ]);
  });
});
