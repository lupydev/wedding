import { defineConfig, devices } from "@playwright/test";

import { E2E_SITE_ORIGIN } from "./e2e/helpers/site-origin";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/*
  A SECOND SERVER, ONE PORT UP, WITH THE RSVP DEADLINE ALREADY PAST.

  The deadline is derived from a constant in the future and decided on the
  SERVER during render, so `page.clock` reaches nothing and no fixture can be
  past it. That is why the closed branch shipped blanking the venue, the map,
  the stream link and the calendar for every household in the final week: the
  state was unreachable from this suite, and `e2e/rsvp.spec.ts` said so in a
  comment for months.

  `RSVP_CLOCK` is the seam — `lib/server/env.ts` records how strictly it is
  parsed and why it refuses to exist in production. It cannot be per-test,
  because one server process has one environment, so the closed state gets a
  server of its own and two projects pointed at it.
*/
const CLOSED_PORT = PORT + 1;
const closedBaseURL =
  process.env.E2E_CLOSED_BASE_URL ?? `http://localhost:${CLOSED_PORT}`;

/**
 * Four days after the deadline and four before the wedding.
 *
 * Inside the closed week rather than years past it, so the screens under test
 * are the ones a guest actually meets: the countdown still counts, the
 * wedding has not happened, and only the answer is frozen.
 */
const AFTER_THE_DEADLINE = "2026-11-25T17:00:00.000Z";

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
      // Everything except the one spec that writes the shared singleton, and
      // the one that is about phone geometry — see the two projects below.
      testIgnore: [
        /console-wedding\.spec\.ts/,
        /invitation-one-screen\.spec\.ts/,
        /invitation-closed\.spec\.ts/,
      ],
    },
    /*
      THE TWO PHONES THE INVITATION IS ACTUALLY READ ON.

      Close to every guest opens `/i/[slug]` from a WhatsApp link, on a phone,
      and the redesign's whole acceptance criterion is a measurement: each step
      is one screen and no step scrolls. A desktop project cannot make that
      claim — at 1280×720 every one of these screens fits with room to spare,
      which is exactly why the invitation was allowed to grow to two and a half
      viewports without a single test noticing.

      TWO SHAPES RATHER THAN ONE. An iPhone 14 is 390×664 and a Pixel 7 is
      412×839: the taller, narrower one crops the photograph more tightly and
      leaves more room for type, the shorter one the reverse. A layout tuned on
      either alone is a layout that has been checked once.

      They run ONE spec. Pointing them at the whole suite would re-run the
      console at phone width, which is a surface nobody administers from a
      phone and which would fail for reasons that say nothing about the
      invitation.

      The presets come from Playwright's own device registry rather than a pair
      of hand-written viewports, so the device scale factor, the user agent and
      `isMobile` come with them — `isMobile` is the one that matters, because
      it is what makes `dvh` and the visual viewport behave like a phone's.

      BOTH RUN ON CHROMIUM, INCLUDING THE IPHONE, AND THAT IS A LIMITATION
      RATHER THAN AN OVERSIGHT. The `iPhone 14` preset asks for WebKit, which
      this project does not install: the whole suite is Chromium, and adding a
      second engine to everybody's `playwright install` for one file is a bigger
      decision than this unit. What is being measured is geometry — a viewport,
      a device pixel ratio and how `dvh` resolves — and Chromium gives all
      three. What it does NOT give is Safari's own layout, and it gives no
      software keyboard at all; `e2e/invitation-one-screen.spec.ts` says so
      where it matters, in the one test that is about the keyboard.
    */
    {
      name: "iphone-14",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
      testMatch: /invitation-one-screen\.spec\.ts/,
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
      testMatch: /invitation-one-screen\.spec\.ts/,
    },
    /*
      THE TWO PHONES AGAIN, AGAINST THE SERVER WHOSE DEADLINE HAS PASSED.

      Same presets and the same geometry rules as the open pair above — these
      are real screens, so they are held to everything the others are — but
      pointed at `closedBaseURL`. The spec they run asserts the open origin
      still shows a form in the same breath as asserting this one does not,
      so a `RSVP_CLOCK` that silently failed to apply would fail the suite
      rather than grade the open branch green under a closed name.
    */
    {
      name: "iphone-14-closed",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        baseURL: closedBaseURL,
      },
      testMatch: /invitation-closed\.spec\.ts/,
    },
    {
      name: "pixel-7-closed",
      use: { ...devices["Pixel 7"], baseURL: closedBaseURL },
      testMatch: /invitation-closed\.spec\.ts/,
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
      /*
        EVERY PROJECT THAT READS THE ROW, NOT ONLY THE FIRST ONE.

        This was `["chromium"]` while chromium was the whole suite. The two
        phone projects read the same singleton — the screen a household reaches
        by accepting names the venue — so an edit landing between one of their
        renders and its assertion would fail them with a value nothing in that
        file ever wrote.
      */
      dependencies: [
        "chromium",
        "iphone-14",
        "pixel-7",
        "iphone-14-closed",
        "pixel-7-closed",
      ],
    },
  ],
  // The highest-value E2E assertions inspect the raw HTML of the first
  // response, so the suite runs against a production build, not `next dev`.
  webServer: [
    {
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
    /*
      AND THE SAME BUILD SERVED AGAIN WITH THE DEADLINE BEHIND IT.

      No second build: it waits for the first server to answer, which happens
      only after `npm run build` has finished, and then starts another
      `next start` on the same `.next`. Two concurrent builds would race on
      that directory.

      `RSVP_CLOCK` is the whole difference between the two processes. It is
      read through `lib/server/env.ts`, which throws on an unparseable value
      and refuses to be set on a production deployment at all.
    */
    {
      command:
        `until curl -sf ${baseURL} > /dev/null; do sleep 1; done; ` +
        `npx next start -p ${CLOSED_PORT}`,
      url: closedBaseURL,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_SITE_ORIGIN: E2E_SITE_ORIGIN,
        CONSOLE_ORIGIN: closedBaseURL,
        RSVP_CLOCK: AFTER_THE_DEADLINE,
      },
    },
  ],
});
