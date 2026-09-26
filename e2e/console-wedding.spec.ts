import { expect, test, type Page } from "@playwright/test";

import {
  declareDevice,
  seedConsoleInvitation,
  signInAsOperator,
  type ConsoleInvitationSeed,
} from "./helpers/console";
import { seedOperator, type SeededOperator } from "./helpers/operator";
import {
  readWeddingFacts,
  restoreWeddingFacts,
  type WeddingFactValues,
} from "./helpers/wedding-facts";

/**
 * Editing the wedding's own facts, end to end.
 *
 * WHAT ONLY A BROWSER AGAINST A REAL DATABASE CAN PROVE HERE
 *
 * The editor page, the invitation page and the Open Graph metadata are all async
 * Server Components, which Vitest cannot render. So the claim this whole work
 * unit rests on — that these four values live in ONE place and every surface
 * reads it — is only checkable here: type a new venue into the console, then look
 * at what a guest receives.
 *
 * Three assertions carry the unit:
 *
 *  1. A saved edit reaches the GUEST-facing invitation body. Without this, "the
 *     facts moved into the database" is a claim about a migration and not about
 *     the product.
 *  2. A saved edit reaches the `og:description` in the first HTML response. That
 *     is the text WhatsApp shows beside the preview image, and it used to come
 *     from a compiled-in constant.
 *  3. A refused edit changes NOTHING. The browser's `required` attribute is a
 *     convenience; the guarantee is the server re-validating, and the only honest
 *     way to test that is to defeat the form and submit anyway.
 *
 * WHY THIS FILE HAS A PLAYWRIGHT PROJECT TO ITSELF
 *
 * `ceremony` is a singleton shared by every spec in this suite, and this is the
 * only file that writes it. An edit here landing in the middle of `rsvp.spec.ts`
 * asserting the stream card against values it read a moment earlier, or of
 * `console-preview.spec.ts` comparing two renders of the same body, produces a
 * red run whose only symptom is a value nothing in those files ever wrote.
 *
 * A Postgres advisory lock was tried first and was the wrong tool: Playwright
 * budgets a timeout per TEST and knows nothing about a hook waiting on another
 * worker, so the readers failed on their own clock while this file still held the
 * row. Exclusion by SCHEDULING instead — the `wedding-facts` project in
 * `playwright.config.ts` declares `dependencies: ["chromium"]`, so this file runs
 * only after every other spec has finished. Nothing waits, because nothing
 * overlaps.
 *
 * The row is restored in `afterAll` regardless, so a following run finds exactly
 * what the migrations seeded.
 *
 * Every phone number below is fabricated.
 */

test.describe.configure({ mode: "serial" });

const GUEST_PHONE = "+573005557701";

/** Values nothing else in the suite uses, so a leak into another spec is legible. */
const EDITED = {
  coupleNames: "Prueba Novia y Prueba Novio",
  venueName: "Salón de Prueba Ñandú",
  venueAddress: "Carrera de Prueba 45 #67-89, Barrio Prueba",
  streamUrl: "https://meet.google.com/e2e-test-abc",
} as const;

let operator: SeededOperator;
let household: ConsoleInvitationSeed;
let seeded: WeddingFactValues;
let page: Page;

/** The editor form's field for one fact, located by its visible label. */
function field(target: Page, label: string) {
  return target.getByLabel(label);
}

function saveButton(target: Page) {
  return target.getByRole("button", { name: /Guardar los datos de la boda/i });
}

async function fillEveryFact(target: Page, values: typeof EDITED) {
  await field(target, "Nombres de la pareja").fill(values.coupleNames);
  await field(target, "Lugar").fill(values.venueName);
  await field(target, "Dirección").fill(values.venueAddress);
  await field(target, "Enlace de Google Meet").fill(values.streamUrl);
}

test.beforeAll(async ({ browser }) => {
  seeded = await readWeddingFacts();
  operator = await seedOperator({ displayName: "Ana Boda" });
  household = await seedConsoleInvitation({
    ownerSenderId: operator.senderId,
    greetingName: "Familia Boda Muñóz",
    guests: [
      { fullName: "Ana Boda Muñóz", phoneE164: GUEST_PHONE, isPrimary: true },
      { fullName: "Tomás Boda Muñóz", phoneE164: null },
    ],
  });

  page = await browser.newPage();
  await signInAsOperator(page, operator);
  await declareDevice(page, operator.displayName);
});

test.afterAll(async () => {
  await page?.close();
  await household?.cleanup();
  await operator?.cleanup();
  // Put the row back the way the migrations left it, so a rerun without
  // `supabase db reset` starts from the same place this one did.
  if (seeded !== undefined) {
    await restoreWeddingFacts(seeded);
  }
});

test.describe("the wedding-facts editor", () => {
  test("offers all four facts on one page with one save, and nothing else", async () => {
    await page.goto("/console/wedding");

    // FOUR. The two Zoom credentials became one Meet address when the ceremony
    // moved — an id and a passcode are what a guest transcribes into an app,
    // and a link is what they press — and migration 0018 dropped the day and
    // the hour, which no guest-facing surface rendered.
    for (const label of [
      "Nombres de la pareja",
      "Lugar",
      "Dirección",
      "Enlace de Google Meet",
    ]) {
      await expect(field(page, label)).toBeVisible();
    }

    // AND THE TWO THAT WENT ARE ASSERTED ABSENT, not merely left off the list
    // above. A list that stopped naming them would go green with both boxes
    // still on the page.
    for (const gone of ["Fecha", "Hora"]) {
      await expect(field(page, gone)).toHaveCount(0);
    }

    await expect(saveButton(page)).toHaveCount(1);
  });

  test("shows the values currently stored, not empty boxes", async () => {
    const stored = await readWeddingFacts();

    await page.goto("/console/wedding");

    // Read from the row rather than compared against a literal: an expectation
    // that restated the seeded text would be the second copy this whole change
    // exists to remove.
    await expect(field(page, "Lugar")).toHaveValue(stored.venueName);
    await expect(field(page, "Enlace de Google Meet")).toHaveValue(
      stored.streamUrl,
    );
  });

  /**
   * BOTH WARNINGS ARE ON THE PAGE, AS TEXT.
   *
   * They describe consequences the operator cannot see from here, and each one
   * has already happened by the time it is visible anywhere else: the delivered
   * Open Graph cards are cached immutably per URL, and every household that
   * declined has already read the old stream link. Neither is a tooltip.
   */
  test("warns that already-sent invitations keep the old names", async () => {
    await page.goto("/console/wedding");

    const warning = page.getByTestId("wedding-card-warning");

    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/ya enviadas/i);
    await expect(warning).toContainText(/enlace nuevo/i);
  });

  test("warns that the old stream link is already out", async () => {
    await page.goto("/console/wedding");

    const warning = page.getByTestId("wedding-stream-link-warning");

    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/invitación/i);
  });

  test("does not offer the stream link to the browser's password manager", async () => {
    await page.goto("/console/wedding");

    const streamLink = field(page, "Enlace de Google Meet");

    await expect(streamLink).toHaveAttribute("type", "text");
    await expect(streamLink).toHaveAttribute("autocomplete", "off");
    await expect(
      page.locator('form.wedding-facts input[type="password"]'),
    ).toHaveCount(0);
  });

  test("renders the editor under the console's own pinned navigation", async () => {
    await page.goto("/console/wedding");

    // The fifth destination, reachable from the bar rather than by typing a URL.
    await expect(
      page.locator("nav[data-slot='console-sidebar']").getByRole("link", {
        name: "Boda",
      }),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("saving an edit", () => {
  test("stores all four values and says so", async () => {
    await page.goto("/console/wedding");
    await fillEveryFact(page, EDITED);
    await saveButton(page).click();

    await expect(page.getByRole("status")).toContainText(/Se guardaron/i);

    // Read from the database, not from the form the browser is still holding.
    expect(await readWeddingFacts()).toEqual(EDITED);
  });

  test("shows the new values on the GUEST's invitation, not just in the console", async ({
    browser,
  }) => {
    // The assertion this whole work unit exists for. Before it, the venue and the
    // date were compiled into the component and no edit anywhere could change
    // what a guest read.
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();

    try {
      await guestPage.goto(`/i/${household.slug}`);
      await guestPage
        .getByLabel(/Número de celular/)
        .fill(GUEST_PHONE.slice(-8));
      await guestPage
        .getByRole("button", { name: "Ver la invitación" })
        .click();

      const body = guestPage.locator("article.invitation");

      await expect(body).toBeVisible();
      await expect(body).toContainText(EDITED.coupleNames);

      /*
        THE VENUE NEEDS A YES FIRST, AND THAT IS THE PRODUCT RULE.

        The couple asked for the place and its address to appear "solamente
        cuando al confirmar la asistencia es positiva": a household that cannot
        come does not need a street. So the assertion this test exists for —
        that an edit in the console reaches the guest — now has to answer the
        question the way a guest going to the wedding would.

        THE DAY IS NOT ASSERTED HERE BECAUSE THE ROW NO LONGER HOLDS ONE. The
        body states the day from `WEDDING_INSTANT` in its announcement, and
        migration 0018 dropped `ceremony_date` and `ceremony_time` outright —
        nothing rendered either, and the console form promised otherwise.
      */
      await guestPage.getByRole("radio", { name: /Sí, allá estar/ }).check();

      await expect(body).toContainText(EDITED.venueName);
      await expect(body).toContainText(EDITED.venueAddress);
    } finally {
      await guest.close();
    }
  });

  test("puts the new names into the og:description of the first HTML response", async ({
    request,
  }) => {
    // Not rendered by JavaScript and not fetched later: WhatsApp's crawler reads
    // the first response and runs nothing, so the names have to be in these bytes.
    const response = await request.get(`/i/${household.slug}`);
    const html = await response.text();
    const head = html.slice(0, html.indexOf("</head>"));

    expect(head).toContain(EDITED.coupleNames);
    expect(head).toMatch(/property="og:description"/);
  });

  test("shows the new stream details to a household that declines", async ({
    browser,
  }) => {
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();

    try {
      await guestPage.goto(`/i/${household.slug}`);
      await guestPage
        .getByLabel(/Número de celular/)
        .fill(GUEST_PHONE.slice(-8));
      await guestPage
        .getByRole("button", { name: "Ver la invitación" })
        .click();
      await guestPage
        .getByRole("radio", { name: /No podemos acompañarlos/ })
        .check();

      /*
        THE CONTROL'S DESTINATION, WHICH IS STRONGER THAN THE OLD ASSERTION.

        This read the address as TEXT on the card. The address is not printed
        any more — the couple removed it once the button existed — so the
        evidence that an edit made in the console reaches the guest is where
        that button actually points.
      */
      await expect(
        guestPage.getByRole("link", { name: /Entrar a la transmisión/ }),
      ).toHaveAttribute("href", EDITED.streamUrl);

      /*
        `ceremonyTime` IS NOT ASSERTED HERE, AND THE GAP THAT USED TO BE
        RECORDED IN THIS COMMENT IS CLOSED RATHER THAN STILL OPEN.

        This card stopped stating the day and the hour when it was rewritten in
        the invitation's own voice, which left an hour an operator could edit
        and no guest could ever see. Migration 0018 answered that by dropping
        both columns: the day comes from `WEDDING_INSTANT` and there is nothing
        left to type.

        The link still proves what this test is for — an edit made in the
        console reaches the guest.
      */
    } finally {
      await guest.close();
    }
  });

  test("keeps showing them after a reload of the editor", async () => {
    await page.goto("/console/wedding");

    await expect(field(page, "Lugar")).toHaveValue(EDITED.venueName);
  });
});

test.describe("a refused edit", () => {
  test("changes nothing when a required field is emptied", async () => {
    const before = await readWeddingFacts();

    await page.goto("/console/wedding");
    // `required` would stop the submission in the browser, which is the
    // convenience working. Removing it is how the SERVER's re-validation — the
    // actual guarantee — gets exercised.
    await page.evaluate(() => {
      document
        .querySelectorAll("form.wedding-facts input[required]")
        .forEach((input) => input.removeAttribute("required"));
    });
    await field(page, "Lugar").fill("");
    await saveButton(page).click();

    await expect(page.locator(".wedding-facts__error")).toContainText(/Lugar/);
    // Not one field of it. Six saved values and one refused is the partial state
    // one-form-one-save exists to make impossible.
    expect(await readWeddingFacts()).toEqual(before);
  });

  test("refuses whitespace, which looks identical to a filled field", async () => {
    const before = await readWeddingFacts();

    await page.goto("/console/wedding");
    await field(page, "Dirección").fill("   ");
    await saveButton(page).click();

    await expect(page.locator(".wedding-facts__error")).toContainText(
      /Dirección/,
    );
    expect(await readWeddingFacts()).toEqual(before);
  });

  test("leaves the guest's invitation untouched after a refusal", async ({
    request,
  }) => {
    const stored = await readWeddingFacts();
    const response = await request.get(`/i/${household.slug}`);

    expect(await response.text()).toContain(stored.coupleNames);
  });
});

test.describe("the editor's own access control", () => {
  test("sends an unauthenticated visitor to the login screen", async ({
    browser,
  }) => {
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();

    try {
      await strangerPage.goto("/console/wedding");

      await expect(strangerPage).toHaveURL(/\/console\/login/);
      // Nothing about the wedding may be readable from the redirect target.
      await expect(strangerPage.locator("body")).not.toContainText(
        EDITED.streamUrl,
      );
    } finally {
      await stranger.close();
    }
  });

  test("lets the OTHER operator edit too, because there are only two of them", async ({
    browser,
  }) => {
    const beto = await seedOperator({ displayName: "Beto Boda" });
    const context = await browser.newContext();
    const betoPage = await context.newPage();

    try {
      await signInAsOperator(betoPage, beto);
      await declareDevice(betoPage, beto.displayName);
      await betoPage.goto("/console/wedding");
      await field(betoPage, "Lugar").fill("Salón de Prueba de Beto");
      await saveButton(betoPage).click();

      await expect(betoPage.getByRole("status")).toContainText(/Se guardaron/i);
      expect((await readWeddingFacts()).venueName).toBe(
        "Salón de Prueba de Beto",
      );
    } finally {
      await context.close();
      await beto.cleanup();
    }
  });
});
