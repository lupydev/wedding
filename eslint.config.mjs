import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architectural import zones.
//
// `lib/domain/**` is the pure core: no React, no Next.js, no storage vendor, no
// Node built-ins, no server adapters. Keeping it free of those makes it
// unit-testable in a plain node environment and prevents the storage vendor
// from leaking into business rules.
//
// `components/**` is presentational: props only. It must never reach into
// `lib/server/**` or talk to Supabase directly, which is what allows the same
// component to be shared by the public and admin routes.
const domainImportZone = {
  files: ["lib/domain/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "react",
              "react-dom",
              "react/*",
              "react-dom/*",
              "next",
              "next/*",
              "@supabase/*",
              "server-only",
              "node:*",
              "../server/*",
              "@/lib/server/*",
            ],
            message:
              "lib/domain must stay pure: no React, Next.js, storage vendor, Node built-ins, or server adapters.",
          },
        ],
      },
    ],
  },
};

const componentImportZone = {
  files: ["components/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/lib/server/*", "**/lib/server/*", "@supabase/*"],
            message:
              "components must stay presentational: no server adapters and no storage vendor.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  domainImportZone,
  componentImportZone,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project additions:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
