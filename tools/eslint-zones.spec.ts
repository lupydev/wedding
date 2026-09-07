import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proof that the architectural import zones in `eslint.config.mjs` are actually
// wired into `npm run lint`. A zone that silently stops matching would let the
// storage vendor or React leak into the pure core without any signal, so the
// rule itself is placed under test rather than trusted.

const eslint = new ESLint({ cwd: process.cwd() });

async function messagesFor(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages;
}

function restrictedImportMessages(
  messages: Awaited<ReturnType<typeof messagesFor>>,
) {
  return messages.filter(
    (message) => message.ruleId === "no-restricted-imports",
  );
}

describe("lib/domain import zone", () => {
  it.each([
    [
      "react",
      `import { useState } from "react";\nexport const x = useState;\n`,
    ],
    [
      "next",
      `import { notFound } from "next/navigation";\nexport const x = notFound;\n`,
    ],
    [
      "@supabase",
      `import { createClient } from "@supabase/supabase-js";\nexport const x = createClient;\n`,
    ],
    [
      "node builtin",
      `import { randomBytes } from "node:crypto";\nexport const x = randomBytes;\n`,
    ],
    ["server-only", `import "server-only";\nexport const x = 1;\n`],
  ])("rejects an import of %s", async (_label, code) => {
    const messages = restrictedImportMessages(
      await messagesFor("lib/domain/zone-probe.ts", code),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
  });

  it("allows a pure computation dependency", async () => {
    const messages = restrictedImportMessages(
      await messagesFor(
        "lib/domain/zone-probe.ts",
        `import { parsePhoneNumberFromString } from "libphonenumber-js";\nexport const x = parsePhoneNumberFromString;\n`,
      ),
    );

    expect(messages).toHaveLength(0);
  });
});

describe("components import zone", () => {
  it("rejects an import of a server adapter", async () => {
    const messages = restrictedImportMessages(
      await messagesFor(
        "components/invitation/ZoneProbe.tsx",
        `import { supabase } from "@/lib/server/supabase";\nexport const x = supabase;\n`,
      ),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
  });

  it("allows React", async () => {
    const messages = restrictedImportMessages(
      await messagesFor(
        "components/invitation/ZoneProbe.tsx",
        `import { useState } from "react";\nexport const x = useState;\n`,
      ),
    );

    expect(messages).toHaveLength(0);
  });
});

// `import 'server-only'` must be the FIRST line of every file under
// `lib/server/**`. Transitive protection through a DB-touching module is not
// enough: a future server module that touches no database would otherwise be
// unguarded, and the failure mode is a silent data leak to the browser rather
// than an error. The rule is enforced by lint so a new file cannot forget it.

function serverOnlyMessages(messages: Awaited<ReturnType<typeof messagesFor>>) {
  return messages.filter(
    (message) => message.ruleId === "no-restricted-syntax",
  );
}

describe("lib/server server-only guard", () => {
  it("rejects a file with no server-only import at all", async () => {
    const messages = serverOnlyMessages(
      await messagesFor("lib/server/zone-probe.ts", `export const x = 1;\n`),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
    expect(messages[0].message).toMatch(/server-only/);
  });

  it("rejects a file where server-only is not the first statement", async () => {
    const messages = serverOnlyMessages(
      await messagesFor(
        "lib/server/zone-probe.ts",
        `import { createClient } from "@supabase/supabase-js";\nimport "server-only";\nexport const x = createClient;\n`,
      ),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
  });

  it("accepts a file that opens with server-only", async () => {
    const messages = serverOnlyMessages(
      await messagesFor(
        "lib/server/zone-probe.ts",
        `import "server-only";\n\nimport { createClient } from "@supabase/supabase-js";\nexport const x = createClient;\n`,
      ),
    );

    expect(messages).toHaveLength(0);
  });

  it("rejects an empty file, which has no first statement to check", async () => {
    const messages = serverOnlyMessages(
      await messagesFor("lib/server/zone-probe.ts", ``),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/server-only/);
  });

  it("does not impose the guard outside lib/server", async () => {
    const messages = serverOnlyMessages(
      await messagesFor("lib/domain/zone-probe.ts", `export const x = 1;\n`),
    );

    expect(messages).toHaveLength(0);
  });

  it("holds for every real file currently under lib/server", async () => {
    const results = await eslint.lintFiles(["lib/server/**/*.ts"]);
    const offenders = results
      .filter((result) =>
        result.messages.some(
          (message) =>
            message.ruleId === "no-restricted-syntax" &&
            /server-only/.test(message.message),
        ),
      )
      .map((result) => result.filePath);

    // Non-empty by construction: if the glob ever matches nothing this
    // assertion would pass while proving nothing.
    expect(results.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
