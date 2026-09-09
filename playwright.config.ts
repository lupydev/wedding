import { defineConfig, devices } from "@playwright/test";

import { E2E_SITE_ORIGIN } from "./e2e/helpers/site-origin";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // The highest-value E2E assertions inspect the raw HTML of the first
  // response, so the suite runs against a production build, not `next dev`.
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // `metadataBase` is read from this variable at build time, and the
      // Open Graph contract is that `og:image` is an ABSOLUTE HTTPS URL — a
      // relative one yields no preview card at all. The local server listens on
      // plain HTTP, so the public origin is injected separately from the
      // address Playwright connects to, exactly as in production.
      NEXT_PUBLIC_SITE_ORIGIN: E2E_SITE_ORIGIN,
    },
  },
});
