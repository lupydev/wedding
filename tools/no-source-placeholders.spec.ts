import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * NO WEDDING FACT IS WRITTEN INTO THIS CODEBASE. THIS IS THE TEST THAT KEEPS IT
 * THAT WAY.
 *
 * Four module constants in `components/invitation/InvitationBody.tsx` and one
 * exported string in `lib/domain/og-card.ts` used to hold `{{COUPLE_NAMES}}`,
 * `{{WEDDING_DATE}}`, `{{VENUE_NAME}}` and `{{VENUE_ADDRESS}}`. Every one of
 * them was written in good faith and for a good reason: never invent a date,
 * because an invented date ships a wrong invitation that reads as a correct one.
 *
 * The reason was right and the location was wrong. The `ceremony` row already
 * held this wedding's date and its stream credentials, so the same event was
 * described in two places — one an operator corrects with an UPDATE, one only a
 * redeploy can touch. That is exactly how a reference project's WhatsApp
 * template went on announcing a venue the event had already left: the page was
 * fixed in minutes and nobody thought of the template as somewhere the venue was
 * written down.
 *
 * A comment saying "read this from the row" survives until the first value
 * somebody needs in a hurry. Reading the sources does not.
 *
 * WHAT IS EXEMPT, AND WHY EACH EXEMPTION IS NOT A HOLE
 *
 *  - `supabase/migrations/**` and `supabase/down/**`: the seeded placeholders
 *    live there, as DATA in one editable row. That is the whole point of this
 *    change, not a violation of it.
 *  - `*.spec.*` and `__snapshots__/**`: a test proving a placeholder passes
 *    through verbatim has to name one. `InvitationBody.spec.tsx` does exactly
 *    that, deliberately.
 *  - `openspec/**` and `node_modules/**`: planning documents and vendored code.
 *
 * The pattern is UPPER_SNAKE inside double braces, which is the form every one of
 * those constants used. Lowercase `{{greeting_name}}` and `{{invitation_url}}` are
 * message-template VARIABLES resolved at render time from real data — a different
 * thing entirely, and `renderMessageTemplate` already throws on an unresolved one.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Every source tree that ships application code. */
const SOURCE_GLOBS = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
  "scripts/**/*.ts",
  "tools/**/*.ts",
];

const SOURCES = SOURCE_GLOBS.flatMap((pattern) =>
  globSync(pattern, { cwd: REPO_ROOT }),
).filter(
  (file) =>
    !file.includes(".spec.") &&
    !file.includes("__snapshots__") &&
    // This file names the pattern in its own prose and in its own regex.
    !file.endsWith("no-source-placeholders.spec.ts"),
);

/** `{{COUPLE_NAMES}}`, `{{VENUE_ADDRESS}}` and every sibling of theirs. */
const UNRESOLVED_PLACEHOLDER = /\{\{[A-Z][A-Z0-9_]*\}\}/g;

describe("no unresolved wedding fact survives in any source file", () => {
  it("has sources to check, so this file is not vacuously green", () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(50);
  });

  it("includes the two files the constants used to live in", () => {
    // Named explicitly: a glob that stopped matching them would make every
    // assertion below pass while the constants came back.
    expect(SOURCES).toContain("components/invitation/InvitationBody.tsx");
    expect(SOURCES).toContain("lib/domain/og-card.ts");
  });

  it.each(SOURCES)("%s names no unresolved placeholder", (file) => {
    const source = readFileSync(`${REPO_ROOT}${file}`, "utf8");
    const found = [...source.matchAll(UNRESOLVED_PLACEHOLDER)].map(
      (match) => match[0],
    );

    // Comments are checked too, and that is on purpose rather than an oversight:
    // a comment that still calls a value `{{VENUE_NAME}}` tells the next reader
    // the venue is a compile-time constant, which is the belief this change
    // exists to remove.
    expect(found).toEqual([]);
  });

  it("would catch a placeholder if one were added back", () => {
    // The guard's own guard. Without this, a regex that silently stopped
    // matching — an escaping mistake, a flag change — would leave every
    // assertion above green and the rule unenforced.
    const reintroduced = 'const COUPLE_NAMES = "{{COUPLE_NAMES}}";';

    expect([...reintroduced.matchAll(UNRESOLVED_PLACEHOLDER)]).toHaveLength(1);
  });

  it("does not mistake a lowercase template variable for a wedding fact", () => {
    // `{{greeting_name}}` is resolved from a real household at render time and
    // must keep working.
    const template = "Hola, {{greeting_name}}: {{invitation_url}}";

    expect([...template.matchAll(UNRESOLVED_PLACEHOLDER)]).toEqual([]);
  });
});
