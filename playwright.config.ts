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
  /*
    MEASURED, NOT GUESSED.

    The default 5000ms is a web-expectation budget, and most assertions here are
    not web expectations: they are assertions about a server-rendered page that a
    PRODUCTION build produces on its first request, after a redirect chain, with
    a Postgres round trip in each hop. `signInAsOperator` is the clearest case —
    signing in lands on `/console`, whose Server Component then redirects to
    `/console/device`, so one `toHaveURL` waits on two cold renders and two
    queries.

    Under 5000ms that produced a rotating set of failures across the console
    specs: always at a navigation, never the same test twice, and the recorded
    call log always showed the URL arriving at the INTERMEDIATE hop before the
    clock ran out. Nothing was broken; the budget was measured against a warm
    route and spent on a cold one, and a serial `describe` then abandoned its
    remaining tests, which is where "N did not run" came from.

    Raised rather than papered over with per-call timeouts: the number is not an
    assertion about the product, and scattering overrides at the call sites that
    happened to lose the race would hide the shared cause. The cost is that a
    genuinely broken expectation is reported after 15s instead of 5s.
  */
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // Everything except the one spec that writes the shared singleton.
      testIgnore: /console-wedding\.spec\.ts/,
    },
    {
      /*
        THE ONE SPEC THAT EDITS THE `ceremony` ROW, SEQUENCED AFTER EVERYTHING
        ELSE.

        That row is a singleton every surface reads, so three assertions in the
        main project compare a value they read earlier against a later render:
        the stream card in `rsvp.spec.ts`, the preview-versus-guest body
        comparison in `console-preview.spec.ts`, and the Open Graph description.
        An edit landing between a read and a render fails them with a value
        nothing in those files ever wrote.

        A Postgres advisory lock was tried first and was the wrong tool:
        Playwright budgets a timeout per TEST and knows nothing about a hook
        waiting on another worker, so the readers failed on their own clock while
        the writer still held the row. `dependencies` is the mechanism the runner
        actually has for this — the project below starts only once `chromium` has
        finished, so nothing waits because nothing overlaps.

        The cost is honest and worth stating: if the main project fails, this
        project is skipped rather than run. One shared mutable row is the reason,
        and the alternative was a suite whose red runs get dismissed as flake.
      */
      name: "wedding-facts",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /console-wedding\.spec\.ts/,
      dependencies: ["chromium"],
    },
  ],
  // The highest-value E2E assertions inspect the raw HTML of the first
  // response, so the suite runs against a production build, not `next dev`.
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    // NEVER reuse. This was `!process.env.CI`, and twice a developer's own
    // `next dev` server was already listening on port 3000: Playwright attached
    // to it, skipped the build, and the attached server had never received the
    // `env` below — so `metadataBase` was unset, `og:image` came back relative,
    // and the raw-HTML Open Graph assertions were silently measuring the wrong
    // process. A suite that can quietly grade a different build than the one it
    // was asked to grade is worse than a slow one.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // `metadataBase` is read from this variable at build time, and the
      // Open Graph contract is that `og:image` is an ABSOLUTE HTTPS URL — a
      // relative one yields no preview card at all. The local server listens on
      // plain HTTP, so the public origin is injected separately from the
      // address Playwright connects to, exactly as in production.
      NEXT_PUBLIC_SITE_ORIGIN: E2E_SITE_ORIGIN,
      // The console origin is separate from the public invitation origin: the
      // server reads console-rendered pages over HTTP to resolve the advertised
      // preview card, so it has to be an address this run can actually reach.
      CONSOLE_ORIGIN: baseURL,
    },
  },
});
