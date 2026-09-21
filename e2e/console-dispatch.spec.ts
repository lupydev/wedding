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
 * parts are unit-tested (`resolveDispatchRecipient`, `buildInvitationMessage`,
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

/**
 * HOW MANY INVITATIONS ANA OWNS IN THIS FILE, AND WHAT EACH ONE IS.
 *
 * Every readiness number below is derived from this table and from the
 * classification rules, not from a run of the panel. The order of the fixtures
 * is the order they are seeded in `beforeAll`:
 *
 *   | fixture           | recipient      | their number         | log         | group                        |
 *   | ready             | Ana Lista      | mobile               | —           | READY                        |
 *   | nobodyChosen      | nobody         | —                    | —           | no_recipient_chosen          |
 *   | alsoUnchosen      | nobody         | —                    | —           | no_recipient_chosen          |
 *   | chosenHasNoPhone  | Carlos         | none on file         | —           | recipient_has_no_phone       |
 *   | landline          | Casa Fija      | Colombian landline   | —           | recipient_phone_unreachable  |
 *   | alreadySent       | Jorge Osorio   | mobile               | marked_sent | already_dispatched           |
 *
 * `recipient_not_in_household` is 0 and stays 0: the composite foreign key on
 * `(invitation_id, dispatch_recipient_guest_id)` refuses a choice naming a
 * non-member (design D23), so the only way to reach that group is a defect. It
 * is rendered anyway, because a group that appeared only when it was non-empty
 * could not be told apart from one that had stopped being computed.
 *
 * `alreadySent` holds a usable recipient and is still reported once, as already
 * sent: "do not send this again" answers the operator's question, and the state
 * of a number they are not going to use does not.
 *
 * These are the numbers that had to be RE-DERIVED when the classification became
 * five recipient-shaped kinds (task 4b.15). The two phone groups used to be about
 * the HOUSEHOLD — "nobody here has a number", "none of these numbers works" — so
 * `chosenHasNoPhone`, whose Rosa holds a perfectly good mobile, used to count as
 * ready. It is blocked now, and the count says so.
 */
const ANA_OWNED = 6;

/** One household — `ready` — can go out. Everything else is blocked above. */
const READY_COUNT = 1;

/**
 * The five groups in DISPLAY order, with the count each one must show.
 *
 * Display order is not classification order: the most actionable group is first
 * and the one needing no action is last.
 */
const EXPECTED_GROUPS: readonly (readonly [string, number])[] = [
  ["Sin destinatario elegido", 2],
  ["Con destinatario sin número", 1],
  ["Con destinatario que no recibe WhatsApp", 1],
  ["Con destinatario que ya no pertenece", 0],
  ["Ya enviadas", 1],
];

/**
 * The `count` and the `total` inside one `X: 2 de 6 población` line.
 *
 * Every number on the panel is written with its population, so a count can only
 * be read together with what it was taken over — which is the point of the
 * sentence shape and the reason parsing it here is not a shortcut.
 */
function countedIn(line: string): readonly [number, number] {
  const parsed = /:\s*(\d+)\s+de\s+(\d+)\s/.exec(line.trim());

  if (parsed === null) {
    throw new Error(`No "N de M" count in the rendered line: "${line}"`);
  }

  return [Number(parsed[1]), Number(parsed[2])];
}

let ana: SeededOperator;
let beto: SeededOperator;
let ready: ConsoleInvitationSeed;
let nobodyChosen: ConsoleInvitationSeed;
let alsoUnchosen: ConsoleInvitationSeed;
let chosenHasNoPhone: ConsoleInvitationSeed;
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

  /*
    ONE FIXTURE PER READINESS GROUP, AND EVERY ONE OF THEM NAMES ITS RECIPIENT
    OR DELIBERATELY DOES NOT.

    Nothing chooses a recipient on an invitation's behalf — not `is_primary`,
    not the member order, not the fact that exactly one number is usable
    (migration `0012`). So a fixture that omits `recipient` is blocked on
    `no_recipient_chosen`, and the four blocked groups below differ by WHO was
    chosen rather than by what the household happens to hold.
  */
  ready = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Lista Muñóz",
    guests: [
      { fullName: "Ana Lista", phoneE164: "+573005552001", isPrimary: true },
      { fullName: "Niña Lista", phoneE164: null },
    ],
    recipient: "Ana Lista",
  });

  // Nobody chosen — the state every imported household starts in, and the one
  // the first day of sending is mostly made of. Its primary member holds a
  // perfectly good mobile and it is blocked anyway, which is the assertion:
  // the column is never backfilled from `is_primary`.
  nobodyChosen = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Sin Elegir Valencia",
    guests: [
      {
        fullName: "Mario Valencia",
        phoneE164: "+573005552004",
        isPrimary: true,
      },
      { fullName: "Sara Valencia", phoneE164: "+573005552005" },
    ],
  });

  /*
    A SECOND HOUSEHOLD IN THE SAME GROUP, AND THAT IS ITS WHOLE JOB.

    With one fixture per group every readiness count is `1`, and a panel that
    printed the literal 1 five times would pass every one of those assertions.
    Two here means `no_recipient_chosen` has to count rather than report a
    constant — and it is the group worth doubling, because on the first day of
    sending it is most of the list.

    Its recipient is chosen later, through the console, by
    "the recipient a household is waiting for" below.
  */
  alsoUnchosen = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Sin Elegir Quintero",
    guests: [
      {
        fullName: "Nora Quintero",
        phoneE164: "+573005552007",
        isPrimary: true,
      },
      { fullName: "Iván Quintero", phoneE164: "+573005552008" },
    ],
  });

  // THE CHOSEN person has no number, while their partner holds a usable mobile.
  // Under the old household-wide reading this invitation was ready; under the
  // current one it is blocked, and that difference is what the `recipient_`
  // prefix exists to make visible.
  chosenHasNoPhone = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Sin Número Aristizábal",
    guests: [
      { fullName: "Carlos Sin Número", phoneE164: null, isPrimary: true },
      { fullName: "Rosa Con Celular", phoneE164: "+573005552006" },
    ],
    recipient: "Carlos Sin Número",
  });

  // A Colombian landline: perfectly valid E.164, and no WhatsApp will ever
  // answer it. This is the fixture the preflight exists for.
  landline = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Fija Restrepo",
    guests: [
      { fullName: "Casa Fija", phoneE164: "+576012345678", isPrimary: true },
    ],
    recipient: "Casa Fija",
  });

  alreadySent = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Ya Enviada Osorio",
    guests: [
      { fullName: "Jorge Osorio", phoneE164: "+573005552002", isPrimary: true },
    ],
    recipient: "Jorge Osorio",
  });
  await alreadySent.recordEvent("marked_sent", ana.senderId);

  betosHousehold = await seedConsoleInvitation({
    ownerSenderId: beto.senderId,
    greetingName: "Familia De Beto",
    guests: [
      { fullName: "Luz De Beto", phoneE164: "+573005552003", isPrimary: true },
    ],
    recipient: "Luz De Beto",
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
  await nobodyChosen?.cleanup();
  await alsoUnchosen?.cleanup();
  await chosenHasNoPhone?.cleanup();
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

    const group = (heading: string) =>
      preflight.locator("section", {
        has: page.getByRole("heading", { name: heading }),
      });

    const unchosen = group("Sin destinatario elegido");
    await expect(unchosen).toContainText("Familia Sin Elegir Valencia");
    // EVERY member, because they are the people there are to choose between.
    await expect(unchosen).toContainText("Mario Valencia");
    await expect(unchosen).toContainText("Sara Valencia");

    const missing = group("Con destinatario sin número");
    await expect(missing).toContainText("Familia Sin Número Aristizábal");
    await expect(missing).toContainText("Carlos Sin Número");
    // ONLY the chosen person, and the household is blocked even though Rosa's
    // mobile is right there. Naming her would send the operator to look at a
    // number that is already fine.
    await expect(missing).not.toContainText("Rosa Con Celular");

    const unreachable = group("Con destinatario que no recibe WhatsApp");
    await expect(unreachable).toContainText("Familia Fija Restrepo");
    await expect(unreachable).toContainText("Casa Fija");

    /*
      Permanently empty by construction — the composite foreign key refuses to
      store a choice that names a non-member (design D23) — and NOT rendered.

      It used to render anyway, with the word "Ninguna" under it, on the
      reasoning that a group appearing only when non-empty is indistinguishable
      from a group that stopped being computed. That reasoning is kept and is
      now carried by the one clear line this panel shows when nothing is
      blocked. What it cost was five always-expanded panels, each with a badge
      and a paragraph, above the list an operator came to read — and this group
      in particular is a panel explaining, in four lines, why it can never have
      contents.
    */
    await expect(
      preflight.getByRole("heading", {
        name: "Con destinatario que ya no pertenece",
      }),
    ).toHaveCount(0);

    const sent = group("Ya enviadas");
    await expect(sent).toContainText("Familia Ya Enviada Osorio");
  });

  test("counts the ready households against a named population", async () => {
    await page.goto("/console");

    await expect(page.locator("p.dispatch-preflight__ready")).toContainText(
      `Listas para enviar: ${READY_COUNT} de ${ANA_OWNED} invitaciones de ${ana.displayName}`,
    );
  });

  /**
   * EVERY count on the panel, re-derived from the fixtures above rather than read
   * off the panel.
   *
   * `EXPECTED_GROUPS` is the classification table of this file's own fixtures,
   * worked out from the rules and written down BEFORE the panel was consulted.
   * A number copied back from a failing run proves only that the panel agrees
   * with itself, which is how a reference project came to report forty-seven
   * confirmations from seventeen answers.
   *
   * The ORDER is asserted too, and it is display order, not classification
   * order: `no_recipient_chosen` first because on the first day of sending it is
   * most of the list and choosing is the cheapest fix, `already_dispatched` last
   * because "do not send this again" is the one finding that needs no work.
   */
  test("re-derives every readiness count, in the order the groups are shown", async () => {
    await page.goto("/console");

    /*
      ONLY THE GROUPS WITH SOMETHING TO REPORT ARE ON SCREEN, IN CANONICAL
      ORDER.

      All five are still COMPUTED — `buildDispatchPreflight` is unit-tested over
      rows and `EXPECTED_GROUPS` below still carries the count for every one of
      them — and the panel renders the ones that have households. The order they
      appear in is the invariant this asserts, because a reader learns where to
      look and a shuffled panel costs them that.
    */
    const shown = EXPECTED_GROUPS.filter(([, count]) => count > 0);

    const headings = await page
      .locator("section.dispatch-preflight__group h3")
      .allInnerTexts();

    expect(headings.map((heading) => heading.trim())).toEqual(
      shown.map(([heading]) => heading),
    );

    const counts = await page
      .locator("p.dispatch-preflight__count")
      .allInnerTexts();

    // Each count carries its own population, as every count in this console
    // does: a number whose denominator is not on screen is a number nobody can
    // check.
    expect(counts.map((count) => count.trim())).toEqual(
      shown.map(
        ([heading, count]) =>
          `${heading}: ${count} de ${ANA_OWNED} invitaciones de ${ana.displayName}`,
      ),
    );
  });

  /**
   * The five groups and the ready list PARTITION the operator's invitations.
   *
   * Derived from the rendered numbers rather than from the table, so it catches
   * the failure the table cannot: a household counted in two groups, or dropped
   * from all of them. Classification is precedence-based — `alreadySent` holds a
   * perfectly usable recipient and is still reported once, as already sent — and
   * precedence is exactly where a household goes missing or gets counted twice.
   */
  test("every invitation lands in exactly one group, or in the ready list", async () => {
    await page.goto("/console");

    const counted = (
      await page.locator("p.dispatch-preflight__count").allInnerTexts()
    ).map(countedIn);
    const [readyShown, total] = countedIn(
      await page.locator("p.dispatch-preflight__ready").innerText(),
    );

    /*
      One entry per group ON SCREEN, which is the groups that have households.
      A group of zero contributes nothing to the sum below, so the partition it
      proves is unaffected — and the sum IS the invariant here: a household
      counted twice, or dropped from every group, shows up there and nowhere
      else.
    */
    expect(counted).toHaveLength(
      EXPECTED_GROUPS.filter(([, count]) => count > 0).length,
    );
    expect(counted.reduce((sum, [count]) => sum + count, 0) + readyShown).toBe(
      total,
    );
    expect(total).toBe(ANA_OWNED);
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
  test("opens WhatsApp with the household's own draft, addressed to the chosen member", async () => {
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
  test("refuses a household nobody has been chosen for, and prepares it once somebody is", async () => {
    await page.goto(dispatchUrl(nobodyChosen));

    await expect(
      page.getByRole("heading", { name: /No se puede preparar el envío/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toHaveCount(0);

    // Sara, NOT the primary member whose number the old auto-pick would have
    // taken. The stored choice is the only thing that decides this.
    await nobodyChosen.chooseRecipient("Sara Valencia");
    await page.goto(dispatchUrl(nobodyChosen));

    await expect(page.locator("p.dispatch-launcher__recipient")).toContainText(
      "Sara Valencia",
    );
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toBeVisible();
    // Choosing is not sending. The log is still empty.
    expect(await nobodyChosen.dispatchEvents()).toHaveLength(0);
  });

  test("explains a chosen member with no number instead of offering their partner's", async () => {
    await page.goto(dispatchUrl(chosenHasNoPhone));

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

/**
 * The recipient choice, made the way an operator makes it.
 *
 * The refusal above is already asserted with the fixture's own
 * `chooseRecipient`, which writes the column directly. That proves the READ: the
 * compose view is deciding from the stored choice. It cannot prove the WRITE —
 * that the console offers a way to make that choice at all, and that making it
 * there is what unblocks the send. Between them sit two Server Actions, a
 * revalidation and the composite foreign key, none of which a direct `update`
 * touches.
 *
 * Placed after the readiness counts on purpose: this moves a household out of
 * `no_recipient_chosen`, and the counts above are derived from the fixtures as
 * seeded.
 */
test.describe("the recipient a household is waiting for", () => {
  test("is refused until somebody is chosen, and sendable the moment they are", async () => {
    await page.goto(dispatchUrl(alsoUnchosen));

    await expect(
      page.getByRole("heading", { name: /No se puede preparar el envío/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toHaveCount(0);

    await page.goto(`/console/invitations/${alsoUnchosen.invitationId}/edit`);

    const recipients = page.locator("fieldset.invitation-form__recipient");

    // Nobody is preselected, on a household where BOTH members hold a usable
    // mobile: there is no "obvious" choice for the form to make, and it does not
    // make one.
    for (const option of await recipients.getByRole("radio").all()) {
      await expect(option).not.toBeChecked();
    }

    // The SECOND member, not the primary one. The primary is what the removed
    // auto-pick would have taken, so choosing anybody else is what makes the
    // assertion below about the stored choice rather than about `is_primary`.
    const write = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/console/invitations/"),
    );
    await recipients.getByLabel("Iván Quintero").check();
    await write;

    await page.goto(dispatchUrl(alsoUnchosen));

    await expect(page.locator("p.dispatch-launcher__recipient")).toContainText(
      "Iván Quintero",
    );
    await expect(
      page.getByRole("button", { name: /Abrir WhatsApp/ }),
    ).toBeVisible();

    // Choosing is not sending. Nothing has been dispatched by any of this.
    expect(await alsoUnchosen.dispatchEvents()).toHaveLength(0);
  });

  /**
   * THE WHOLE PANEL AGAIN, RE-DERIVED FROM WHAT THIS RUN HAS DONE TO ITS OWN
   * FIXTURES.
   *
   * Not "one fewer than before". Three earlier tests in this serial file moved
   * households between groups, and a count adjusted by hand until it passed
   * would hide any of those moves going wrong:
   *
   *   | fixture          | what happened to it here                | group now                   |
   *   | ready            | opened, then marked as sent by the      | already_dispatched          |
   *   |                  | operator                                |                             |
   *   | nobodyChosen     | Sara chosen through the FIXTURE         | READY                       |
   *   | alsoUnchosen     | Iván chosen through the CONSOLE, above  | READY                       |
   *   | chosenHasNoPhone | untouched so far — Carlos still has no  | recipient_has_no_phone      |
   *   |                  | number until the declaration-gate block |                             |
   *   | landline         | untouched                               | recipient_phone_unreachable |
   *   | alreadySent      | seeded with `marked_sent`               | already_dispatched          |
   *
   * Two ready, two already dispatched, one of each phone problem, nobody
   * unchosen, and six in total — the same six, because nothing here creates or
   * deletes an invitation.
   */
  test("leaves the readiness check re-derived, with the same total", async () => {
    await page.goto("/console");

    await expect(page.locator("p.dispatch-preflight__ready")).toContainText(
      `Listas para enviar: 2 de ${ANA_OWNED} invitaciones de ${ana.displayName}`,
    );

    const counts = await page
      .locator("p.dispatch-preflight__count")
      .allInnerTexts();

    /*
      The two groups that fell to zero are not listed, because they are no
      longer on screen. "Sin destinatario elegido" emptying is exactly what
      choosing a recipient was supposed to do, and a group vanishing is a
      sharper proof of it than a group that says "Ninguna".
    */
    expect(counts.map((count) => count.trim())).toEqual(
      (
        [
          ["Con destinatario sin número", 1],
          ["Con destinatario que no recibe WhatsApp", 1],
          ["Ya enviadas", 2],
        ] as const
      ).map(
        ([heading, count]) =>
          `${heading}: ${count} de ${ANA_OWNED} invitaciones de ${ana.displayName}`,
      ),
    );

    // And the household that was just chosen for is named nowhere at all in the
    // blocked groups, because the group that held it is gone.
    await expect(
      page
        .locator("section.dispatch-preflight__group")
        .filter({ hasText: "Sin destinatario elegido" }),
    ).toHaveCount(0);
    await expect(page.locator("section.dispatch-preflight")).not.toContainText(
      "Familia Sin Elegir Quintero",
    );
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

    // Carlos is the member the readiness check is naming right now: he is the
    // chosen recipient and he has no number. Typing his in is precisely the
    // work a mismatched declaration must not stand in the way of.
    await page
      .getByRole("button", { name: `Editar el número de Carlos Sin Número` })
      .click();
    await page.getByLabel(/Número de Carlos Sin Número/).fill("3005559111");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect
      .poll(async () => chosenHasNoPhone.storedPhone("Carlos Sin Número"))
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
