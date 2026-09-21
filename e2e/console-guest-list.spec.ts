import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  declareDevice,
  deleteInvitationsOwnedBy,
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
 * signing in means a real round trip through the real form. Running that ten
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

/** Unique per run, so every fixture name this file invents is its own. */
let run: string;
let ana: SeededOperator;
let beto: SeededOperator;
let anaHousehold: ConsoleInvitationSeed;
let changedMind: ConsoleInvitationSeed;
let opened: ConsoleInvitationSeed;
let betoHousehold: ConsoleInvitationSeed;
let page: Page;

test.beforeAll(async ({ browser }) => {
  /*
    UNIQUE PER RUN, EXACTLY AS `console-dispatch.spec.ts` ALREADY IS.

    The device picker labels its radios with the sender's display name and
    `declareDevice` locates one by that label, so a leftover operator from an
    aborted run — the emails are timestamped, the display names were not — makes
    that label resolve to two elements. Playwright's strict mode refuses it, the
    sign-in test fails for a reason that is not about the product, and the rest
    of this serial file never runs. Costing sixteen tests is what a shared local
    database does with a name a fixture assumed was its own.
  */
  run = randomBytes(3).toString("hex");
  ana = await seedOperator({ displayName: `Ana Lista ${run}` });
  beto = await seedOperator({ displayName: `Beto Lista ${run}` });

  anaHousehold = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Muñóz Aristizábal",
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
    guests: [{ fullName: "Omar Enlace", phoneE164: "+573005551003" }],
  });
  await opened.recordEvent("link_opened", ana.senderId);

  betoHousehold = await seedConsoleInvitation({
    ownerSenderId: beto.senderId,
    greetingName: "Familia Peña Betancur",
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
  // The invitation the CONSOLE created has no fixture handle: its id was minted
  // on the server and the action answered with a redirect. Ownership is all this
  // file knows about it, and leaving it behind would make `ana.cleanup()` below
  // fail on the `owner_sender_id` foreign key — which leaves the sender alive
  // too, and a duplicate display name is what breaks the NEXT run's sign-in.
  await deleteInvitationsOwnedBy(ana.senderId);
  await deleteInvitationsOwnedBy(beto.senderId);
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
    await declareDevice(page, ana.displayName);

    await expect(page).toHaveURL(/\/console$/);
    await expect(
      page.getByRole("heading", { name: "Invitaciones" }),
    ).toBeVisible();
    await expect(MISMATCH_NOTICE(page)).toHaveCount(0);
  });

  test("declaring the OTHER operator's account blocks dispatch with an explanation", async () => {
    await declareDevice(page, beto.displayName);
    await page.goto("/console");

    const notice = MISMATCH_NOTICE(page);
    await expect(notice).toContainText(/no coincide/i);
    // Both assumptions named, so the operator can tell which one is wrong.
    await expect(notice).toContainText(ana.displayName);
    await expect(notice).toContainText(beto.displayName);
    // Not a silent filter: the list is still here, and it is still Ana's.
    await expect(
      page.getByRole("heading", { name: "Familia Muñóz Aristizábal" }),
    ).toBeVisible();
    // But nothing can be dispatched from this handset.
    await expect(
      page.getByRole("link", { name: /Preparar envío/i }),
    ).toHaveCount(0);
    // And the read-only progress view stays available, as the design requires.
    // It is the dashboard now rather than a `ProgressSummary` sentence, but the
    // invariant is the one that mattered: a blocked device withdraws the SEND
    // affordance and nothing else, so the operator can still read where the
    // event stands while they go and fix the handset.
    await expect(page.getByText("Invitaciones enviadas")).toBeVisible();
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
    await declareDevice(page, ana.displayName);
    await expect(page).toHaveURL(/\/console$/);
  });
});

test.describe("the partitioned guest list", () => {
  /**
   * THE LIST IS NO LONGER PARTITIONED, AND THAT IS THE POINT.
   *
   * There used to be two: the operator's own households, then a second list of
   * the other account's, separated by four lines of prose explaining the split.
   * On a console two people share, the split was communicating one thing — who
   * manages each household — that every row already says on its own face.
   *
   * So this test asserts the opposite of what it used to: both partitions are
   * here, in one list. What ownership still decides is asserted by the tests
   * below it, and it is only what it ever decided — the send affordance, and
   * the editing that would be refused by the server anyway.
   */
  test("one list holds every household in the event", async () => {
    await page.goto("/console");
    const list = page.locator("section.console__section").first();

    // By heading, not by text: the greeting name also appears inside the send
    // link, so a bare text query is ambiguous.
    await expect(
      list.getByRole("heading", { name: "Familia Muñóz Aristizábal" }),
    ).toBeVisible();
    await expect(
      list.getByRole("heading", { name: "Familia Cambió de Idea" }),
    ).toBeVisible();
    await expect(
      list.getByRole("heading", { name: "Familia Peña Betancur" }),
    ).toBeVisible();

    // And there is exactly one list, not two.
    await expect(page.locator("section.console__section")).toHaveCount(1);
  });

  test("each owned row carries a send affordance and names its owner", async () => {
    await page.goto("/console");
    const row = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Muñóz Aristizábal" });

    await expect(
      row.getByText(`Gestionas tú (${ana.displayName})`),
    ).toBeVisible();
    await expect(
      row.getByRole("link", { name: /Preparar envío/i }),
    ).toBeVisible();
  });

  test("the shared dashboard covers both partitions and offers no send button on the other's rows", async () => {
    await page.goto("/console");
    const theirRow = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Peña Betancur" });

    await expect(
      theirRow.getByRole("heading", { name: "Familia Peña Betancur" }),
    ).toBeVisible();
    await expect(
      theirRow.getByText(`Gestiona ${beto.displayName}`),
    ).toBeVisible();
    await expect(
      theirRow.getByRole("link", { name: /Preparar envío/i }),
    ).toHaveCount(0);

    /*
      The dashboard's figures cover every invitation, both partitions included.

      There is ONE set of figures now, over the whole event, where there used to
      be two `ProgressSummary` blocks — the operator's own and the event's —
      whose denominators a reader had to compare to know which answered their
      question.

      The denominator is asserted as an INVARIANT rather than as a literal, for
      the reason the previous version already gave: the scope is genuinely every
      invitation in the database, and the suite runs its spec files in parallel
      against one database, so the exact total depends on which other fixtures
      happen to be alive. What must hold is that it counts at least this file's
      four households — three of Ana's and one of Beto's — which is what proves
      it reaches across the partition at all.
    */
    const figure = await page
      .locator("dl[data-slot='stat-bar'] dd")
      .first()
      .innerText();
    const total = Number(/^\d+ de (\d+)$/.exec(figure)?.[1]);

    expect(total).toBeGreaterThanOrEqual(4);
  });

  test("the named guests, the member count and the phone numbers are all on the row", async () => {
    await page.goto("/console");
    const row = page
      .locator("li.guest-list__row")
      .filter({ hasText: "Familia Muñóz Aristizábal" });

    // Exact, because the edit button's accessible name also contains the guest's
    // name — the name being in both places is the point, not an ambiguity to
    // paper over.
    await expect(row.getByText("Ana Muñóz", { exact: true })).toBeVisible();
    await expect(row.getByText("Niña Muñóz", { exact: true })).toBeVisible();
    // Two names, so two people: the count is the household itself since
    // migration 0012, never a separately-typed allowance that could differ from
    // the two names asserted directly above.
    await expect(row.getByText("2 personas")).toBeVisible();
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

    /*
      THE COUNT IS NO LONGER ASSERTED HERE, AND THAT IS NOT A LOSS OF COVERAGE.

      It used to read the per-operator `ProgressSummary` sentences. The console
      now shows ONE set of figures over the whole event, and an event-wide total
      cannot be asserted from here: this database is shared with every other
      spec in the suite, so a fixture seeded elsewhere moves the number. That is
      precisely why these assertions were scoped to Ana's partition originally.

      The invariant itself — one household that answered twice counts ONCE —
      lives in `summarizeConsoleList` and is asserted directly in
      `lib/domain/console-list.spec.ts`, over rows, with no database in the way.
      What this test still proves, and only this test can, is that the chain
      from `rsvp_latest` to the badge on the row reaches a real page.
    */
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

    /*
      The count moved to the event-wide dashboard, which cannot carry an exact
      assertion from a shared database — see the note in the test above. That an
      opened link is never counted as a send is asserted over rows in
      `lib/domain/console-list.spec.ts` and over the tiles themselves in
      `components/console/ConsoleDashboard.spec.tsx`.
    */
  });

  test("no count is rendered without the population it was taken over", async () => {
    await page.goto("/console");

    // The rule outlived the component that used to carry it. `ProgressSummary`
    // enforced it by rendering whole sentences; the dashboard is four tiles, so
    // the population rides inside each figure — "17 de 30", never "17".
    const figures = await page
      .locator("dl[data-slot='stat-bar'] dd")
      .allInnerTexts();

    expect(figures.length).toBeGreaterThan(0);

    for (const figure of figures) {
      expect(figure).toMatch(/^\d+ de \d+$/);
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

/**
 * Creating a group THROUGH THE CONSOLE, which nothing else in this suite does.
 *
 * Every other fixture in this file is inserted straight into Postgres, because
 * what those tests are about is what the console DISPLAYS. This block is about
 * the write: before this capability the only way to add a household was to edit
 * a JSON file and run `scripts/import-guests.ts`, so the form is the answer to
 * "somebody called yesterday and they are coming".
 *
 * WHY THE DERIVED NAME IS WATCHED WHILE IT IS TYPED
 *
 * `deriveGreetingName` is imported by the form from the same specifier the
 * Server Action imports (design D14), so the live preview and the stored value
 * cannot drift. That claim is only worth anything if the preview is really the
 * function: these tests type a nickname and watch the greeting follow it, then
 * override it and watch the derivation stop being used without being forgotten.
 *
 * WHY THE OVERRIDE IS CHECKED AFTER A MEMBER IS ADDED
 *
 * Touching the field IS the decision to go custom — there is no separate toggle
 * — and adding a member re-derives. A form that re-derived over a name a person
 * had written would silently replace the couple's own wording, which is the
 * failure the `greetingNameSource` column exists to prevent.
 *
 * It runs LAST in this serial file on purpose: it adds a fourth invitation to
 * Ana's partition, and the count assertions above are written against three.
 */
test.describe("creating a group through the console", () => {
  /** The household name shown in the panel. Never the greeting. */
  let householdName: string;
  /** The greeting an operator writes over the derived one. */
  let customGreeting: string;

  const LUCIA = "Lucía Restrepo Vélez";
  const MATEO = "Mateo Restrepo Díaz";
  const SARA = "Sara Restrepo";
  /** Fabricated, like every number here. A real guest's must never appear. */
  const LUCIA_PHONE_TYPED = "300 555 4001";
  const LUCIA_PHONE_STORED = "+573005554001";

  test.beforeAll(() => {
    // Suffixed per run for the same reason the operators are: this file shares
    // one database with every other spec and with whatever an aborted run left.
    householdName = `Restrepo Vélez ${run}`;
    customGreeting = `Los Restrepo de siempre ${run}`;
  });

  /** One member's own fieldset. Scoped, because every row repeats the labels. */
  const member = (index: number) =>
    page.locator("fieldset.invitation-form__member").nth(index);

  /** What the form says the members currently derive to. */
  const derivedLine = () => page.getByTestId("invitation-derived-name");

  /** Ana's own partition, where the new household has to appear. */
  const mine = () => page.locator("section.console__section").first();

  const createdRow = () =>
    mine().locator("li.guest-list__row").filter({ hasText: customGreeting });

  test("creating an invitation is one click from the navigation", async () => {
    await page.goto("/console");

    // From the navigation, which is where creation lives now. It started at
    // the foot of the guest list — offered in BOTH lists, so this query had to
    // be scoped to the owned partition to be unambiguous at all — then spent
    // one commit in the header. The sidebar is where a destination belongs, and
    // on a phone that bar is at the bottom of the screen under the thumb.
    //
    // `.first()` because the bar renders twice, once as a sidebar and once as
    // the bottom tabs, with CSS deciding which is on screen.
    await page.getByRole("link", { name: "Agregar" }).first().click();

    await expect(page).toHaveURL(/\/console\/invitations\/new$/);
    await expect(
      page.getByRole("heading", { name: "Nueva invitación" }),
    ).toBeVisible();
  });

  test("the group name follows the nicknames as they are typed", async () => {
    // Nothing named yet: the preview says so instead of rendering an empty name.
    await expect(derivedLine()).toContainText("todavía sin integrantes");

    await member(0).getByLabel("Nombre completo").fill(LUCIA);
    // One member alone keeps their FULL name: addressing one person by their
    // first name reads as clipped rather than warm.
    await expect(derivedLine()).toContainText(`Nombre automático: ${LUCIA}`);

    await member(0).getByLabel("Apodo").fill("Lucha");
    // The nickname wins the moment it exists. This is the assertion that the
    // preview is the domain function and not a string this component builds.
    await expect(derivedLine()).toContainText("Nombre automático: Lucha");

    await member(0).getByLabel("Teléfono").fill(LUCIA_PHONE_TYPED);

    await page.getByRole("button", { name: "Agregar otra persona" }).click();
    await member(1).getByLabel("Nombre completo").fill(MATEO);
    await member(1).getByLabel("Apodo").fill("Teo");

    // Two members are addressed as a list, joined by the Spanish conjunction
    // rule and with no Oxford comma.
    await expect(derivedLine()).toContainText("Nombre automático: Lucha y Teo");
    await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
      "Lucha y Teo",
    );
  });

  test("an override survives a member added after it", async () => {
    await page.getByLabel("Nombre del hogar").fill(householdName);
    await page.getByLabel("Nombre del grupo").fill(customGreeting);

    // Touching the field IS the decision, so the hidden source flips with it —
    // there is no toggle to disagree with the text beside it.
    await expect(page.getByTestId("invitation-greeting-source")).toHaveValue(
      "custom",
    );
    // The derived name is still computed and still on screen. It is shown
    // BESIDE the custom one rather than instead of it, because deciding whether
    // a hand-written greeting "still mentions" a member is unreliable in both
    // directions and the operator is the one who can tell.
    await expect(derivedLine()).toContainText("Lucha y Teo");
    await expect(derivedLine()).toContainText("escrito a mano");

    await page.getByRole("button", { name: "Agregar otra persona" }).click();
    await member(2).getByLabel("Nombre completo").fill(SARA);
    await member(2).getByLabel("Apodo").fill("Sarita");

    // The derivation followed the new member; the operator's own wording did not
    // move. Both halves matter: a form that stopped deriving would hide a stale
    // greeting, and one that re-derived would overwrite a person's sentence.
    await expect(derivedLine()).toContainText("Lucha, Teo y Sarita");
    await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
      customGreeting,
    );
  });

  test("the saved group is on the operator's own list, under the name they wrote", async () => {
    await page.getByRole("button", { name: "Guardar invitación" }).click();

    // The form does not stay on a screen that has apparently done nothing: the
    // new invitation is on the list, which is where it now lives.
    await expect(page).toHaveURL(/\/console$/);
    await expect(
      mine().getByRole("heading", { name: customGreeting }),
    ).toBeVisible();

    const row = createdRow();
    await expect(row.getByText(LUCIA, { exact: true })).toBeVisible();
    await expect(row.getByText(MATEO, { exact: true })).toBeVisible();
    await expect(row.getByText(SARA, { exact: true })).toBeVisible();
    await expect(row.getByText("3 personas")).toBeVisible();
    // Typed with spaces and stored in E.164: the creation path normalizes through
    // the same strict function the importer uses, rather than keeping whatever
    // shape a phone keyboard produced.
    await expect(row.getByText(LUCIA_PHONE_STORED)).toBeVisible();
  });

  test("a group nobody has been chosen for says so on its row", async () => {
    // WRITTEN OUT, not left blank. Nothing infers a recipient — not the first
    // member, not the only one with a number — so a row that rendered no
    // indicator would look exactly like a row whose choice is further down, and
    // the operator would learn the difference when the send refused.
    await expect(
      createdRow().getByText("Nadie elegido para recibir el mensaje."),
    ).toBeVisible();
    await expect(createdRow().getByText("Recibe el mensaje")).toHaveCount(0);
  });

  test("the row's edit affordance reaches the form with the stored override intact", async () => {
    await createdRow()
      .getByRole("link", { name: `Editar invitación de ${customGreeting}` })
      .click();

    await expect(page).toHaveURL(
      /\/console\/invitations\/[0-9a-f-]{36}\/edit$/,
    );
    // Read back from the database, not from the client that typed it: this is
    // the assertion that `greetingNameSource` was stored as `custom`. Were it
    // stored as derived, this field would now read "Lucha, Teo y Sarita".
    await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
      customGreeting,
    );
    await expect(page.getByLabel("Nombre del hogar")).toHaveValue(
      householdName,
    );
    await expect(page.getByTestId("invitation-greeting-source")).toHaveValue(
      "custom",
    );
  });

  test("choosing a member on the edit screen moves the indicator onto their row", async () => {
    const recipients = page.locator("fieldset.invitation-form__recipient");

    // Nobody is preselected here either, on a household whose only stored number
    // belongs to one member — the one an auto-pick would have taken.
    for (const option of await recipients.getByRole("radio").all()) {
      await expect(option).not.toBeChecked();
    }

    // WAITED FOR, NOT MERELY CLICKED. The radio is checked optimistically and
    // the Server Action is a POST to this route; navigating away before it
    // answers aborts the in-flight request, which looks exactly like the console
    // ignoring the choice. Same reasoning as `declareDevice`.
    const write = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/console/invitations/"),
    );
    await recipients.getByLabel(LUCIA).check();
    await write;

    // Asserted on the LIST, which is server-rendered: the radio going checked is
    // optimistic local state, and the console re-reading the choice from the row
    // is what proves the write landed.
    await page.goto("/console");

    const row = createdRow();
    await expect(row.getByText("Recibe el mensaje")).toBeVisible();
    await expect(
      row.getByText("Nadie elegido para recibir el mensaje."),
    ).toHaveCount(0);
  });
});
