import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
