import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  declareDevice,
  seedConsoleInvitation,
  signInAsOperator,
  type ConsoleInvitationSeed,
} from "./helpers/console";
import { seedOperator, type SeededOperator } from "./helpers/operator";

/**
 * Dispatch, end to end, against a real database and a real operator session.
 *
 * Everything decided here lives inside async Server Components, a route handler
 * and a `sendBeacon` — none of which Vitest can render or deliver. The pure
 * parts are unit-tested (`selectDispatchRecipient`, `buildInvitationMessage`,
 * `buildDispatchPreflight`, the launcher's beacon-before-navigation ordering);
 * what this file proves is that the chain connects.
 *
 * `wa.me` IS INTERCEPTED, NOT VISITED. The navigation is the behaviour under
 * test, so it has to actually happen — but letting it reach Meta would make the
 * suite depend on the public internet and would open a real chat window. The
 * route is fulfilled locally and the URL that was requested is asserted, which
 * is the part the product is responsible for.
 *
 * Serial, with ONE browser context: every test needs a signed-in operator, and
 * signing in means a real round trip through the real form.
 */

test.describe.configure({ mode: "serial" });

const MISMATCH_NOTICE = (page: Page) => page.locator("section.device-mismatch");

let ana: SeededOperator;
let beto: SeededOperator;
let ready: ConsoleInvitationSeed;
let noPhone: ConsoleInvitationSeed;
let landline: ConsoleInvitationSeed;
let alreadySent: ConsoleInvitationSeed;
let betosHousehold: ConsoleInvitationSeed;
let page: Page;

/** The last `wa.me` URL the browser was sent to, captured by the interceptor. */
let lastWaUrl: string | null = null;

test.beforeAll(async ({ browser }) => {
  // Unique per run. The device picker labels its radios with the display name,
  // and a leftover operator from an aborted run would make that label ambiguous
  // — which looks exactly like the picker rendering the wrong thing.
  const run = randomBytes(3).toString("hex");
  ana = await seedOperator({ displayName: `Ana Envíos ${run}` });
  beto = await seedOperator({ displayName: `Beto Envíos ${run}` });

  ready = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Lista Muñóz",
    guests: [
      { fullName: "Ana Lista", phoneE164: "+573005552001", isPrimary: true },
      { fullName: "Niña Lista", phoneE164: null },
    ],
  });

  noPhone = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Sin Número Aristizábal",
    guests: [
      { fullName: "Carlos Sin Número", phoneE164: null, isPrimary: true },
      { fullName: "Rosa Sin Número", phoneE164: null },
    ],
  });

  // A Colombian landline: perfectly valid E.164, and no WhatsApp will ever
  // answer it. This is the fixture the preflight exists for.
  landline = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Fija Restrepo",
    guests: [
      { fullName: "Casa Fija", phoneE164: "+576012345678", isPrimary: true },
    ],
  });

  alreadySent = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Ya Enviada Osorio",
    guests: [
      { fullName: "Jorge Osorio", phoneE164: "+573005552002", isPrimary: true },
    ],
  });
  await alreadySent.recordEvent("marked_sent", ana.senderId);

  betosHousehold = await seedConsoleInvitation({
    ownerSenderId: beto.senderId,
    greetingName: "Familia De Beto",
    guests: [
      { fullName: "Luz De Beto", phoneE164: "+573005552003", isPrimary: true },
    ],
  });

  page = await browser.newPage();

  await page.route("https://wa.me/**", async (route) => {
    lastWaUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><p>WhatsApp (interceptado)</p></body></html>",
    });
  });

  await signInAsOperator(page, ana);
  await declareDevice(page, ana.displayName);
});

test.afterAll(async () => {
  await page?.close();
  await ready?.cleanup();
  await noPhone?.cleanup();
  await landline?.cleanup();
  await alreadySent?.cleanup();
  await betosHousehold?.cleanup();
  await ana?.cleanup();
  await beto?.cleanup();
});

function dispatchUrl(invitation: ConsoleInvitationSeed): string {
  return `/console/dispatch/${invitation.invitationId}`;
}

test.describe("the send preflight", () => {
  test("names the households that cannot be sent yet, and says why for each", async () => {
    await page.goto("/console");

    const preflight = page.locator("section.dispatch-preflight");
    await expect(preflight).toBeVisible();

    const missing = preflight.locator("section", {
      has: page.getByRole("heading", { name: "Sin número en la agenda" }),
    });
    await expect(missing).toContainText("Familia Sin Número Aristizábal");
    await expect(missing).toContainText("Carlos Sin Número");

    const unreachable = preflight.locator("section", {
      has: page.getByRole("heading", {
        name: "Con número que no recibe WhatsApp",
      }),
    });
    await expect(unreachable).toContainText("Familia Fija Restrepo");
    await expect(unreachable).toContainText("Casa Fija");

    const sent = preflight.locator("section", {
      has: page.getByRole("heading", { name: "Ya enviadas" }),
    });
    await expect(sent).toContainText("Familia Ya Enviada Osorio");
  });

  test("counts the ready households against a named population", async () => {
    await page.goto("/console");

    await expect(page.locator("p.dispatch-preflight__ready")).toContainText(
      `Listas para enviar: 1 de 4 invitaciones de ${ana.displayName}`,
    );
  });

  /**
   * The same line `scripts/import-guests.spec.ts` holds over the importer's
   * output. A readiness summary is a thing an operator screenshots and forwards.
   */
  test("prints no guest phone number anywhere in the readiness check", async () => {
    await page.goto("/console");

    const rendered = await page
      .locator("section.dispatch-preflight")
      .innerHTML();

    expect(rendered).toContain("Casa Fija");
    expect(rendered).not.toMatch(/\+?\d{7,}/);
  });
});

test.describe("preparing and opening one dispatch", () => {
  test("opens WhatsApp with the household's own draft, addressed to the reachable member", async () => {
    lastWaUrl = null;
    await page.goto(dispatchUrl(ready));

    await expect(
      page.getByRole("heading", {
        name: /Preparar el envío para Familia Lista/,
      }),
    ).toBeVisible();
    await expect(page.locator("p.dispatch-launcher__recipient")).toContainText(
      "Ana Lista",
    );

    await page.getByRole("button", { name: /Abrir WhatsApp/ }).click();
    await page.waitForURL(/wa\.me/);

    expect(lastWaUrl).not.toBeNull();
    const opened = new URL(lastWaUrl!);
    expect(opened.host).toBe("wa.me");
    expect(opened.pathname).toBe("/573005552001");

    const text = opened.searchParams.get("text") ?? "";
    expect(text).toContain("Familia Lista Muñóz");

    // Exactly one URL: only the first link in a WhatsApp message gets a preview
    // card, so a second one costs the card rather than adding another.
    const urls = text.match(/https?:\/\/\S+/g) ?? [];
    expect(urls).toHaveLength(1);
    const invitationUrl = urls[0] ?? "";
    expect(invitationUrl).toContain(`/i/${ready.slug}`);

    // No event detail in the draft: the date and the venue live on the page the
    // link resolves to, which can still be corrected after the message is sent.
    expect(text.replace(invitationUrl, "")).not.toMatch(/\d/);
  });

  test("records the opened link before leaving, as link_opened and nothing stronger", async () => {
    // Polled, not read once: `sendBeacon` is queued by the user agent and
    // delivered on its own schedule. That asynchrony is the whole point of the
    // transport — the navigation never waits for it — so the assertion must not
    // pretend the write is synchronous either.
    await expect
      .poll(async () => (await ready.dispatchEvents()).length)
      .toBe(1);

    const events = await ready.dispatchEvents();
    expect(events[0].kind).toBe("link_opened");
    expect(events[0].actorSenderId).toBe(ana.senderId);
    expect(events[0].clientEventId).not.toBeNull();
  });

  test("re-posting the stashed event on return does not double-count it", async () => {
    // Returning to the compose view re-posts the id stashed in sessionStorage.
    // `dispatch_events_client_event_idx` is what makes that safe, and this is
    // the assertion that the index is really doing it.
    await page.goto(dispatchUrl(ready));
    await expect(
      page.getByRole("button", { name: /Marcar como enviada/ }),
    ).toBeVisible();

    const events = await ready.dispatchEvents();
    expect(events.filter((event) => event.kind === "link_opened")).toHaveLength(
      1,
    );
  });

  test("an opened link is still not a send, in the console's own words", async () => {
    await page.goto("/console");

    await expect(
      page.getByText("Enlace abierto, envío sin confirmar").first(),
    ).toBeVisible();
  });

  test("the operator's confirmation is what records the send", async () => {
    await page.goto(dispatchUrl(ready));
    await page.getByRole("button", { name: /Marcar como enviada/ }).click();

    await expect
      .poll(async () =>
        (await ready.dispatchEvents()).map((event) => event.kind),
      )
      .toEqual(["link_opened", "marked_sent"]);

    const events = await ready.dispatchEvents();
    expect(events[1].actorSenderId).toBe(ana.senderId);
  });
});

test.describe("households the console refuses to dispatch", () => {
  test("explains a household with no number instead of offering a broken link", async () => {
    await page.goto(dispatchUrl(noPhone));

    await expect(
      page.getByRole("heading", { name: /No se puede preparar el envío/ }),
    ).toBeVisible();
    await expect(page.getByText("Carlos Sin Número")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toHaveCount(0);
  });

  test("refuses a household whose only number is a landline, naming the reason", async () => {
    await page.goto(dispatchUrl(landline));

    await expect(page.getByText(/línea fija/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toHaveCount(0);
    expect(await landline.dispatchEvents()).toHaveLength(0);
  });

  test("answers a not-owned invitation the same way as one that does not exist", async () => {
    // One response for both, so the console never confirms the existence of a
    // household in the other operator's partition.
    const notOwned = await page.goto(dispatchUrl(betosHousehold));
    expect(notOwned?.status()).toBe(404);

    const missing = await page.goto(
      "/console/dispatch/99999999-9999-4999-8999-999999999999",
    );
    expect(missing?.status()).toBe(404);
  });
});

test.describe("the device declaration gate", () => {
  test("blocks the dispatch while the declared WhatsApp account is not the session's", async () => {
    await declareDevice(page, beto.displayName);
    await page.goto(dispatchUrl(ready));

    await expect(MISMATCH_NOTICE(page)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toHaveCount(0);
  });

  test("withdraws the send affordance from the list, but not the phone editor", async () => {
    // The fix from the Work Unit 6a-ii review. Editing a number sends nothing,
    // so the gate that exists to stop a message leaving the wrong account has no
    // business blocking data entry — least of all on the handset where the
    // preflight is telling the operator which numbers to go and fix.
    await page.goto("/console");

    await expect(MISMATCH_NOTICE(page)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Preparar envío/ }),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: `Editar el número de Rosa Sin Número` })
      .click();
    await page.getByLabel(/Número de Rosa Sin Número/).fill("3005559111");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect
      .poll(async () => noPhone.storedPhone("Rosa Sin Número"))
      .toBe("+573005559111");
  });

  test("restores the dispatch once the declaration agrees again", async () => {
    await declareDevice(page, ana.displayName);
    await page.goto(dispatchUrl(ready));

    await expect(MISMATCH_NOTICE(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toBeVisible();
  });
});
