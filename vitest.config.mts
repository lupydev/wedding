import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` throws on import outside a React Server Component. That
      // guard is the point in production — a stray Client Component import
      // becomes a BUILD ERROR instead of a runtime data leak — but it also
      // makes every `lib/server/**` module unimportable from a plain node test.
      // The alias is scoped to Vitest and never reaches the Next.js build.
      "server-only": fileURLToPath(
        new URL("./vitest/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    // The scaffold ships with no test files yet, and later work units run
    // focused subsets. An empty selection is not a failure.
    passWithNoTests: true,
    projects: [
      {
        // Pure domain logic and server adapters: plain node, no DOM.
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          // MEASURED, NOT GUESSED, AND NOT A BEHAVIOURAL ALLOWANCE.
          //
          // Most files in this project talk to the real local Supabase stack in
          // Docker, and a few spawn ESLint with the full typescript-eslint and
          // Next configs. Both costs are paid ONCE per worker, by whichever test
          // happens to run first in its file: a TCP connection to Postgres, or an
          // ESLint config graph. Vitest runs those files in parallel across every
          // core, so the cold start of one competes with the cold start of the
          // rest.
          //
          // Under the default 5000ms that produced a rotating set of failures —
          // always the FIRST test of a database-touching file, always
          // "Test timed out", never the same file twice, and every one of them
          // green when its file ran alone. Nothing was slow; the budget was
          // measured against a warm process and spent on a cold one.
          //
          // Raised rather than worked around with a shared warm-up hook: a hook
          // would hide the cost instead of affording it, and the timeout here is
          // not an assertion about the product. The cost of the larger number is
          // that a genuinely hung query is reported after 15s instead of 5s.
          testTimeout: 15_000,
          // `beforeAll` in these files opens the connection and seeds fixtures,
          // so it pays the same cold start with more work behind it.
          hookTimeout: 30_000,
          include: [
            "lib/**/*.spec.{ts,tsx}",
            "supabase/tests/**/*.spec.ts",
            "tools/**/*.spec.ts",
            "scripts/**/*.spec.ts",
          ],
        },
      },
      {
        // React components rendered with Testing Library.
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          // The same reasoning, smaller number. These files touch no database,
          // but `user-event` drives real timers through React transitions while
          // every core is busy, and a starved worker makes a click look like a
          // click that never landed.
          testTimeout: 10_000,
          setupFiles: ["./vitest.setup.ts"],
          include: ["components/**/*.spec.{ts,tsx}", "app/**/*.spec.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
    },
  },
});
