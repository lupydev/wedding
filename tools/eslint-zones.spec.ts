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
