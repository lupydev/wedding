import { expect, test, type Page } from "@playwright/test";

import {
  declareDevice,
  seedConsoleInvitation,
  signInAsOperator,
  type ConsoleInvitationSeed,
} from "./helpers/console";
import { seedOperator, type SeededOperator } from "./helpers/operator";

/**
 * The console guest list and the per-device WhatsApp declaration.
 *
 * Both live entirely inside async Server Components, which Vitest cannot render,
 * so this file is where the wiring is proved: that the partition is a `WHERE`
 * and not a render-time filter, that an undeclared device is asked rather than
 * defaulted, and that a mismatch blocks with an explanation instead of quietly
 * reshaping the list.
 *
 * Serial, with ONE browser context: every test needs a signed-in operator, and
 * signing in means a real magic link out of a real mailbox. Running that ten
 * times would make the suite slow enough that somebody would delete it.
 */

test.describe.configure({ mode: "serial" });

/**
 * The mismatch interstitial, located by its own class rather than by
 * `getByRole("alert")`.
 *
 * Next.js renders `<next-route-announcer role="alert">` on every page, so the
 * role alone matches an element this product did not write — and an assertion
 * that the alert is ABSENT would then never be able to pass. The component test
 * in `components/console/DeviceDeclaration.spec.tsx` is where the role itself is
 * asserted, in isolation, which is where that assertion means something.
 */
const MISMATCH_NOTICE = (page: Page) => page.locator("section.device-mismatch");

let ana: SeededOperator;
let beto: SeededOperator;
let anaHousehold: ConsoleInvitationSeed;
let changedMind: ConsoleInvitationSeed;
let opened: ConsoleInvitationSeed;
let betoHousehold: ConsoleInvitationSeed;
let page: Page;

test.beforeAll(async ({ browser }) => {
  ana = await seedOperator({ displayName: "Ana Lista" });
  beto = await seedOperator({ displayName: "Beto Lista" });

  anaHousehold = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Muñóz Aristizábal",
    seatsAllowed: 3,
    guests: [
      {
        fullName: "Ana Muñóz",
        phoneE164: "+573005551001",
        isPrimary: true,
      },
      // No phone at all: the inline editor is what fixes this, and the reason
      // it is inline is that a separate screen means it never gets fixed.
      { fullName: "Niña Muñóz", phoneE164: null },
    ],
  });

  changedMind = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Cambió de Idea",
    seatsAllowed: 2,
    guests: [{ fullName: "Clara Cambió", phoneE164: "+573005551002" }],
  });
  // Said yes, then said no. Two rows in an append-only table; ONE household.
  await changedMind.answer({
    attending: true,
    attendeeNames: ["Clara Cambió"],
    minutesAgo: 120,
  });
  await changedMind.answer({ attending: false, minutesAgo: 5 });

  opened = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Enlace Abierto",
    seatsAllowed: 1,
    guests: [{ fullName: "Omar Enlace", phoneE164: "+573005551003" }],
  });
  await opened.recordEvent("link_opened", ana.senderId);

  betoHousehold = await seedConsoleInvitation({
    ownerSenderId: beto.senderId,
    greetingName: "Familia Peña Betancur",
    seatsAllowed: 4,
    guests: [{ fullName: "Pedro Peña", phoneE164: "+573005551004" }],
  });

  page = await browser.newPage();
  await signInAsOperator(page, ana);
});

test.afterAll(async () => {
  await page.close();
  await anaHousehold.cleanup();
  await changedMind.cleanup();
  await opened.cleanup();
  await betoHousehold.cleanup();
  await ana.cleanup();
  await beto.cleanup();
});

test.describe("the per-device WhatsApp declaration", () => {
  test("a device that has never answered is asked, not defaulted", async () => {
    await page.goto("/console");

    await expect(page).toHaveURL(/\/console\/device$/);
    await expect(
      page.getByRole("heading", {
        name: /Qué cuenta de WhatsApp usa este dispositivo/i,
      }),
    ).toBeVisible();

    // Nobody preselected. A suggestion here would make clearing site data
    // silently nominate an operator.
    for (const option of await page.getByRole("radio").all()) {
      await expect(option).not.toBeChecked();
    }
  });

  test("declaring the signed-in operator's own account opens the console", async () => {
    await declareDevice(page, "Ana Lista");

    await expect(page).toHaveURL(/\/console$/);
    await expect(
      page.getByRole("heading", { name: "Tus invitaciones" }),
    ).toBeVisible();
    await expect(MISMATCH_NOTICE(page)).toHaveCount(0);
  });

  test("declaring the OTHER operator's account blocks dispatch with an explanation", async () => {
    await declareDevice(page, "Beto Lista");
    await page.goto("/console");

    const notice = MISMATCH_NOTICE(page);
    await expect(notice).toContainText(/no coincide/i);
    // Both assumptions named, so the operator can tell which one is wrong.
    await expect(notice).toContainText("Ana Lista");
    await expect(notice).toContainText("Beto Lista");
    // Not a silent filter: the list is still here, and it is still Ana's.
    await expect(
      page.getByRole("heading", { name: "Familia Muñóz Aristizábal" }),
    ).toBeVisible();
    // But nothing can be dispatched from this handset.
    await expect(
      page.getByRole("link", { name: /Preparar envío/i }),
    ).toHaveCount(0);
    // And the read-only progress view stays available, as the design requires.
    await expect(page.getByText(/^Confirmadas: /).first()).toBeVisible();
  });

  test("the block offers two exits and nothing that dismisses it", async () => {
    await page.goto("/console");
    const notice = MISMATCH_NOTICE(page);

    await expect(
      notice.getByRole("link", { name: /Cambiar la declaración/i }),
    ).toHaveAttribute("href", "/console/device");
    await expect(
      notice.getByRole("link", { name: /Iniciar sesión con la otra cuenta/i }),
    ).toHaveAttribute("href", "/console/auth/sign-out");
    await expect(notice.getByRole("button")).toHaveCount(0);
  });

  test("clearing the declaration re-asks instead of picking somebody", async () => {
    // What "clear site data" does to a signed-in browser: the session cookies
    // are rewritten from the Supabase pair we still hold, the declaration is not.
    const cookies = await page.context().cookies();
    await page.context().clearCookies();
    await page
      .context()
      .addCookies(cookies.filter((cookie) => cookie.name !== "device_sender"));

    await page.goto("/console");

    await expect(page).toHaveURL(/\/console\/device$/);
    for (const option of await page.getByRole("radio").all()) {
      await expect(option).not.toBeChecked();
    }

    // Back to a working console for the rest of the file.
    await declareDevice(page, "Ana Lista");
    await expect(page).toHaveURL(/\/console$/);
  });
});

test.describe("the partitioned guest list", () => {
  test("the default view lists the operator's own invitations", async () => {
    await page.goto("/console");
    const mine = page.locator("section.console__section").first();

    // By heading, not by text: the greeting name also appears inside the send
    // link, so a bare text query is ambiguous.
    await expect(
      mine.getByRole("heading", { name: "Familia Muñóz Aristizábal" }),
    ).toBeVisible();
    await expect(
      mine.getByRole("heading", { name: "Familia Cambió de Idea" }),
    ).toBeVisible();
    await expect(
      mine.getByRole("heading", { name: "Familia Peña Betancur" }),
    ).toHaveCount(0);
  });

  test("each owned row carries a send affordance and names its owner", async () => {
    await page.goto("/console");
    const row = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Muñóz Aristizábal" });

    await expect(row.getByText(/Gestionas tú \(Ana Lista\)/)).toBeVisible();
    await expect(
      row.getByRole("link", { name: /Preparar envío/i }),
    ).toBeVisible();
  });

  test("the shared dashboard covers both partitions and offers no send button on the other's rows", async () => {
    await page.goto("/console");
    const shared = page.locator("section.console__section").nth(1);
    const theirRow = shared
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Peña Betancur" });

    await expect(
      theirRow.getByRole("heading", { name: "Familia Peña Betancur" }),
    ).toBeVisible();
    await expect(theirRow.getByText("Gestiona Beto Lista")).toBeVisible();
    await expect(
      theirRow.getByRole("link", { name: /Preparar envío/i }),
    ).toHaveCount(0);

    /*
      The shared counts cover every invitation, and say so in words.

      The denominator is asserted as an INVARIANT rather than as a literal. The
      shared scope is genuinely every invitation in the database, and the E2E
      suite runs its spec files in parallel against one database — so the exact
      total depends on which other fixtures happen to be alive. What must hold is
      that the shared scope is strictly wider than the owned one and that its
      label names the population it counted.
    */
    const sharedLine = await shared
      .getByText(/^Confirmadas: /)
      .first()
      .innerText();
    const sharedTotal = Number(
      /^Confirmadas: \d+ de (\d+) todas las invitaciones del evento$/.exec(
        sharedLine,
      )?.[1],
    );

    expect(sharedTotal).toBeGreaterThanOrEqual(4);
    expect(sharedTotal).toBeGreaterThan(3);
  });

  test("the named guests, the seats and the phone numbers are all on the row", async () => {
    await page.goto("/console");
    const row = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Muñóz Aristizábal" });

    // Exact, because the edit button's accessible name also contains the guest's
    // name — the name being in both places is the point, not an ambiguity to
    // paper over.
    await expect(row.getByText("Ana Muñóz", { exact: true })).toBeVisible();
    await expect(row.getByText("Niña Muñóz", { exact: true })).toBeVisible();
    await expect(row.getByText("3 lugares")).toBeVisible();
    // The console IS the authorized reader of guest phone numbers: the two
    // operators are the couple, and they entered these numbers themselves.
    await expect(row.getByText("+573005551001")).toBeVisible();
    await expect(row.getByText("Sin número")).toBeVisible();
  });

  /**
   * The rule with the most history behind it.
   *
   * `rsvp_responses` is append-only, so "yes, then no" is TWO rows. A dashboard
   * that counts the raw table reports that household twice — a reference project
   * shipped exactly that and showed 47 confirmed from 17 answers. Everything
   * here reads `rsvp_latest`, which is one row per invitation by construction.
   */
  test("a household that changed its mind is counted once, as declined", async () => {
    await page.goto("/console");
    const mine = page.locator("section.console__section").first();
    const row = mine
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Cambió de Idea" });

    await expect(row.getByText("No asiste")).toBeVisible();
    await expect(row.getByText("Confirmada")).toHaveCount(0);

    // Three owned invitations, one declined, none confirmed — not two answers
    // from one household.
    await expect(
      mine.getByText("Confirmadas: 0 de 3 invitaciones de Ana Lista"),
    ).toBeVisible();
    await expect(
      mine.getByText("No asisten: 1 de 3 invitaciones de Ana Lista"),
    ).toBeVisible();
    await expect(
      mine.getByText("Sin respuesta: 2 de 3 invitaciones de Ana Lista"),
    ).toBeVisible();
  });

  /**
   * `link_opened` is a claim that a link was opened, never that a message was
   * sent. The application cannot observe a send; the operator is the only sensor
   * there is, and the labels have to say so.
   */
  test("an opened link is labelled as unconfirmed and never counted as a send", async () => {
    await page.goto("/console");
    const mine = page.locator("section.console__section").first();
    const row = mine
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Enlace Abierto" });

    await expect(
      row.getByText("Enlace abierto, envío sin confirmar"),
    ).toBeVisible();
    await expect(row.getByText("Marcada como enviada")).toHaveCount(0);

    await expect(
      mine.getByText(
        "Marcadas como enviadas: 0 de 3 invitaciones de Ana Lista",
      ),
    ).toBeVisible();
    await expect(
      mine.getByText(
        "Enlace abierto, envío sin confirmar: 1 de 3 invitaciones de Ana Lista",
      ),
    ).toBeVisible();
  });

  test("no count is rendered without the population it was taken over", async () => {
    await page.goto("/console");

    for (const item of await page
      .locator("section.progress-summary li")
      .allInnerTexts()) {
      expect(item).toMatch(/ de \d+ /);
      expect(item).toMatch(/invitaciones/);
    }
  });
});

test.describe("the inline phone editor", () => {
  test("a missing number is typed in the row and stored in E.164", async () => {
    await page.goto("/console");
    const row = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Muñóz Aristizábal" });

    await row
      .getByRole("button", { name: /Editar el número de Niña Muñóz/i })
      .click();
    await row.getByLabel(/Número de Niña Muñóz/i).fill("300 555 2002");
    await row.getByRole("button", { name: "Guardar" }).click();

    await expect(row.getByText("+573005552002")).toBeVisible();
    expect(await anaHousehold.storedPhone("Niña Muñóz")).toBe("+573005552002");
  });

  test("a landline is flagged where it is fixed, not where the dispatch fails", async () => {
    await page.goto("/console");
    const row = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Muñóz Aristizábal" });

    await row
      .getByRole("button", { name: /Editar el número de Niña Muñóz/i })
      .click();
    await row.getByLabel(/Número de Niña Muñóz/i).fill("+576012345678");
    await row.getByRole("button", { name: "Guardar" }).click();

    await expect(
      row.getByText(/no parece recibir WhatsApp/i).first(),
    ).toBeVisible();
  });
});

test.describe("the console never becomes a way past the guest gate", () => {
  /**
   * The half of task 4b.12 that could not be written before this work unit: an
   * authenticated console operator is still an ordinary visitor on the public
   * invitation route, which has exactly ONE unlock path and does not read an
   * operator session at all.
   */
  test("an authenticated operator visiting a public invitation still sees the gate", async () => {
    await page.goto(`/i/${anaHousehold.slug}`);

    await expect(page.getByLabel(/Número de celular/)).toBeVisible();
    const source = await page.content();
    expect(source).not.toContain("5551001");
    expect(source).not.toContain("5552002");
  });

  test("no query parameter turns the console session into an unlock", async () => {
    for (const query of [
      "?preview=1",
      "?admin=1",
      "?console=1",
      "?unlocked=1",
    ]) {
      await page.goto(`/i/${anaHousehold.slug}${query}`);

      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
    }
  });
});
