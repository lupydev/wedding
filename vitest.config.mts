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
