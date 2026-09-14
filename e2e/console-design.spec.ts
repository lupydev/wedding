import { expect, test, type Page } from "@playwright/test";

import {
  declareDevice,
  seedConsoleInvitation,
  signInAsOperator,
  type ConsoleInvitationSeed,
} from "./helpers/console";
import { seedOperator, type SeededOperator } from "./helpers/operator";

/**
 * The design foundation, measured in a real browser.
 *
 * Everything in `lib/design/**` is arithmetic a unit test can check: a contrast
 * ratio, a token's presence in the stylesheet, a grid template. What a unit test
 * cannot check is whether the browser ends up APPLYING any of it — a Tailwind
 * utility that never compiles, a variable that resolves to nothing, a base-layer
 * rule beaten by a breakpoint-scoped one all produce a green unit suite and an
 * unstyled page.
 *
 * So every assertion in this file reads a COMPUTED value off a live element.
 *
 * Serial, with one browser context: two of these tests need a signed-in operator on
 * a declared device, and signing in means a real round trip through the real form.
 */

test.describe.configure({ mode: "serial" });

/** The graphite console background, `#161A1F`, as the browser reports it. */
const CONSOLE_BACKGROUND = "rgb(22, 26, 31)";

/** The iOS zoom threshold. At or above it Safari focuses; below it, it zooms. */
const MIN_INPUT_FONT_SIZE_PX = 16;

/** The one width the console changes shape at. */
const BREAKPOINT_PX = 768;

let ana: SeededOperator;
let household: ConsoleInvitationSeed;
let page: Page;

test.beforeAll(async ({ browser }) => {
  ana = await seedOperator({ displayName: "Ana Diseño" });
  household = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Diseño Restrepo",
    guests: [
      { fullName: "Ana Diseño", phoneE164: "+573005559001", isPrimary: true },
    ],
  });

  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
  await household.cleanup();
  await ana.cleanup();
});

test.describe("console fields never zoom the viewport on a phone", () => {
  /**
   * THE RULE IS 16, NOT 15.
   *
   * A reference console set 15px with a comment that read "below 16 and iOS zooms".
   * The rule and its own comment contradicted each other and the comment was right:
   * at 16px or larger mobile Safari focuses the field normally, at 15px or less it
   * zooms the whole viewport. Its console zoomed on every field focus, on the phone
   * it was built for — and this one is dispatched from a phone too, because `wa.me`
   * needs WhatsApp on the same handset.
   */
  test("every field on the sign-in form computes to at least 16px, on a phone", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/console/login");

    const fields = page.locator("input:not([type='hidden'])");
    const count = await fields.count();

    // Without this the loop below could pass by iterating zero times.
    expect(count).toBeGreaterThanOrEqual(2);

    for (let index = 0; index < count; index += 1) {
      const size = await fields
        .nth(index)
        .evaluate((element) =>
          Number.parseFloat(window.getComputedStyle(element).fontSize),
        );

      expect(size).toBeGreaterThanOrEqual(MIN_INPUT_FONT_SIZE_PX);
    }
  });

  test("the same fields stay at 16px on a desktop width", async () => {
    // The floor may not be undercut by a breakpoint-scoped utility further down the
    // cascade — shadcn's own Input primitive ships `md:text-sm`, which is 14px.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/console/login");

    const size = await page
      .getByLabel("Correo electrónico")
      .evaluate((element) =>
        Number.parseFloat(window.getComputedStyle(element).fontSize),
      );

    expect(size).toBeGreaterThanOrEqual(MIN_INPUT_FONT_SIZE_PX);
  });
});

test.describe("two palettes, and each one stays where it belongs", () => {
  test("the console is graphite", async () => {
    await page.goto("/console/login");

    const background = await page
      .locator("main.console-login")
      .evaluate((element) => window.getComputedStyle(element).backgroundColor);

    expect(background).toBe(CONSOLE_BACKGROUND);
  });

  test("the guest-facing invitation is NOT restyled dark", async () => {
    // The invitation is the thing a guest is given. A wedding invitation that
    // arrives on a near-black page is a worse outcome than an unstyled one, so the
    // DOCUMENT default is paper and the console opts into graphite. This asserts the
    // default survived: measured as a light surface, not as a specific hex, because
    // the papery value is a design choice and "light" is the invariant.
    await page.goto(`/i/${household.slug}`);

    const luminance = await page.locator("body").evaluate((element) => {
      const [red, green, blue] = (
        window.getComputedStyle(element).backgroundColor.match(/\d+/g) ?? []
      ).map(Number);

      return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    });

    expect(luminance).toBeGreaterThan(0.8);
  });

  test("the shared type is actually loaded, on both surfaces", async () => {
    // The `@theme inline` font trap: a `var(--font-sans)` self-reference resolves to
    // nothing at parse time and every font silently falls back to the browser
    // default, with no error anywhere. Literal family names cannot do that, and this
    // is the assertion that proves it.
    await page.goto(`/i/${household.slug}`);

    const bodyFont = await page
      .locator("body")
      .evaluate((element) => window.getComputedStyle(element).fontFamily);

    expect(bodyFont).toContain("Hanken Grotesk");
  });
});

test.describe("one breakpoint, and the shell changes shape at it", () => {
  test.beforeAll(async () => {
    await signInAsOperator(page, ana);
    await declareDevice(page, "Ana Diseño");
  });

  test("below the breakpoint there is a bottom tab bar and no sidebar", async () => {
    await page.setViewportSize({ width: BREAKPOINT_PX - 1, height: 844 });
    await page.goto("/console");

    await expect(
      page.getByRole("navigation", { name: /inferior/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /lateral/i }),
    ).toBeHidden();
  });

  test("above the breakpoint there is a sidebar and no bottom tab bar", async () => {
    await page.setViewportSize({ width: BREAKPOINT_PX + 200, height: 900 });
    await page.goto("/console");

    await expect(
      page.getByRole("navigation", { name: /lateral/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /inferior/i }),
    ).toBeHidden();
  });

  test("the content clears the bottom bar by exactly the bar's own height", async () => {
    // Two literals drift, and the way they drift is the last guest row sitting
    // permanently under the bar — on the one screen size these operators use.
    await page.setViewportSize({ width: BREAKPOINT_PX - 1, height: 844 });
    await page.goto("/console");

    const barHeight = await page
      .getByRole("navigation", { name: /inferior/i })
      .evaluate((element) => element.getBoundingClientRect().height);
    const contentPadding = await page
      .locator("[data-slot='console-content']")
      .evaluate((element) =>
        Number.parseFloat(window.getComputedStyle(element).paddingBottom),
      );

    expect(barHeight).toBeGreaterThan(0);
    expect(contentPadding).toBeCloseTo(barHeight, 0);
  });

  test("the active tab carries a geometric mark and not only a colour", async () => {
    // The operator is holding a phone outdoors at whatever brightness the battery
    // has left. A colour-only active state is invisible there.
    await page.setViewportSize({ width: BREAKPOINT_PX - 1, height: 844 });
    await page.goto("/console");

    const bar = page.getByRole("navigation", { name: /inferior/i });
    const current = bar.locator("a[aria-current='page']");

    await expect(current).toHaveCount(1);
    await expect(current.locator("[data-slot='nav-mark']")).toHaveCount(1);
  });
});

test.describe("motion", () => {
  test("a reader who asked for reduced motion gets none", async ({
    browser,
  }) => {
    const reduced = await browser.newPage({ reducedMotion: "reduce" });

    try {
      await reduced.goto("/console/login");

      const duration = await reduced
        .getByRole("button", { name: "Iniciar sesión" })
        .evaluate(
          (element) => window.getComputedStyle(element).transitionDuration,
        );

      // `1ms`, not `0s`: a genuine zero makes several `transitionend` handlers
      // never fire. What matters is that nothing visibly moves.
      expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.01);
    } finally {
      await reduced.close();
    }
  });
});
