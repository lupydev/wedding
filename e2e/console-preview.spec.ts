import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  declareDevice,
  seedConsoleInvitation,
  signInAsOperator,
  type ConsoleInvitationSeed,
} from "./helpers/console";
import { seedOperator, type SeededOperator } from "./helpers/operator";
import { E2E_SITE_ORIGIN } from "./helpers/site-origin";

/**
 * The two console preview surfaces, end to end.
 *
 * Both live inside async Server Components, which Vitest cannot render, and both
 * make claims that only a real server and a real browser can settle:
 *
 *  - the BODY preview is the same component the public route renders after
 *    unlock, so the operator cannot approve copy no guest will ever see;
 *  - the MESSAGE preview's image is the exact URL WhatsApp's crawler will
 *    fetch, hash query and all, so looking at the preview genuinely warms the
 *    entry the crawler will hit rather than a second one beside it.
 *
 * And the property the whole preview design exists to protect: the public
 * `/i/[slug]` route still has exactly ONE unlock path. It is never told the
 * word "preview", and a signed-in operator gets the phone gate there like
 * anybody else. `e2e/phone-gate.spec.ts` asserts that from the guest's side;
 * this file asserts it from the side that now has a preview to be tempted by.
 *
 * Serial, with one browser context: every test needs a signed-in operator, and
 * signing in means a real round trip through the real form.
 */

test.describe.configure({ mode: "serial" });

let ana: SeededOperator;
let beto: SeededOperator;
let household: ConsoleInvitationSeed;
let betosHousehold: ConsoleInvitationSeed;
let page: Page;

/** The last 8 digits of a number, which is what the phone gate matches on. */
const ANA_GUEST_PHONE = "+573005557321";

/** The invitation body, wherever it is rendered. One component, one selector. */
function invitationBody(target: Page) {
  return target.locator("article.invitation");
}

/**
 * The body without its RSVP slot, and without React's text separators.
 *
 * TWO NORMALISATIONS, AND BOTH ARE DELIBERATELY NARROW.
 *
 * The RSVP is a SLOT: the public route fills it with the household's form, and
 * the operator preview passes nothing, because a preview must not offer a
 * control that would write a household's answer on their behalf. Everything
 * outside that slot is shared markup, and comparing it is what proves the two
 * routes cannot drift.
 *
 * The empty `<!-- -->` comments are React's separators between adjacent text
 * nodes. React emits them only where a tree needs to stay hydratable, so the
 * public route — which carries client components — gets them and the preview,
 * which carries none, does not. They render nothing, occupy no layout and are
 * invisible to a reader; treating them as a difference would fail this test on
 * a fact about React rather than about the invitation.
 *
 * AND THE COUNTDOWN'S FIGURES, WHICH ARE A CLOCK.
 *
 * The invitation now opens with the landing's announcement, counter included.
 * The two surfaces are loaded one after the other, so the seconds figure is
 * simply different by the time the second one renders — 53 against 54 — and a
 * byte comparison of a running clock can never pass. That says nothing about
 * whether the operator is previewing what the guest reads, which is the only
 * thing this test is for.
 *
 * The figures are emptied rather than the block removed, so the counter's
 * STRUCTURE is still compared: a preview that stopped rendering it, or rendered
 * a different number of units, still fails here.
 *
 * Nothing else is normalised. Element names, attributes, ordering, whitespace
 * and every character of copy are compared exactly, so a genuine divergence
 * between the two surfaces still fails here.
 */
async function bodyWithoutRsvp(target: Page): Promise<string> {
  const markup = await invitationBody(target).evaluate((article) => {
    const clone = article.cloneNode(true) as HTMLElement;
    clone.querySelector(".invitation__rsvp")?.remove();

    for (const figure of clone.querySelectorAll(
      '[data-testid="countdown-figure"]',
    )) {
      figure.textContent = "";
    }
    const summary = clone.querySelector('[data-testid="countdown-summary"]');
    if (summary !== null) {
      summary.textContent = "";
    }

    return clone.innerHTML;
  });

  return markup.replaceAll("<!-- -->", "");
}

test.beforeAll(async ({ browser }) => {
  const run = randomBytes(3).toString("hex");
  ana = await seedOperator({ displayName: `Ana Previa ${run}` });
  beto = await seedOperator({ displayName: `Beto Previo ${run}` });

  // The recipient is CHOSEN here, because the message-preview tests below read
  // the pane the dispatch route only renders once one is. Nothing picks a
  // recipient on an invitation's behalf — not `is_primary`, not the fact that
  // exactly one member has a usable number — so an invitation seeded without
  // this line is blocked on `no_recipient_chosen` and never renders a bubble.
  household = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: "Familia Previa Muñóz",
    guests: [
      {
        fullName: "Ana Previa Muñóz",
        phoneE164: ANA_GUEST_PHONE,
        isPrimary: true,
      },
      { fullName: "Tomás Previo Muñóz", phoneE164: null },
    ],
    recipient: "Ana Previa Muñóz",
  });

  betosHousehold = await seedConsoleInvitation({
    ownerSenderId: beto.senderId,
    greetingName: "Familia Ajena Restrepo",
    guests: [
      {
        fullName: "Beto Ajeno Restrepo",
        phoneE164: "+573005557322",
        isPrimary: true,
      },
    ],
  });

  page = await browser.newPage();
  await signInAsOperator(page, ana);
  await declareDevice(page, ana.displayName);
});

test.afterAll(async () => {
  await page?.close();
  await household?.cleanup();
  await betosHousehold?.cleanup();
  await ana?.cleanup();
  await beto?.cleanup();
});

test.describe("the admin-only body preview", () => {
  test("renders the invitation body for an owned household", async () => {
    await page.goto(`/console/preview/${household.invitationId}`);

    await expect(invitationBody(page)).toBeVisible();
    await expect(invitationBody(page)).toContainText("Familia Previa Muñóz");
    await expect(invitationBody(page)).toContainText("Tomás Previo Muñóz");
  });

  test("renders exactly what a guest sees after unlocking", async ({
    browser,
  }) => {
    // The drift guard, and the reason the body is one shared component rather
    // than two. A second implementation would let the operator approve copy no
    // guest ever reads — and nothing would ever report the difference.
    //
    // BOTH RENDERS READ THE SINGLETON `ceremony` ROW, so this comparison is only
    // meaningful while nothing edits it between the two fetches below. The one
    // spec that does — `console-wedding.spec.ts` — runs in its own Playwright
    // project, sequenced after this one by `dependencies` in
    // `playwright.config.ts`. Exclusion by scheduling, not by locking.
    await page.goto(`/console/preview/${household.invitationId}`);
    const previewBody = await bodyWithoutRsvp(page);

    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    try {
      await guestPage.goto(`/i/${household.slug}`);
      await guestPage
        .getByLabel(/Número de celular/)
        .fill(ANA_GUEST_PHONE.slice(-8));
      await guestPage
        .getByRole("button", { name: "Ver la invitación" })
        .click();
      await expect(invitationBody(guestPage)).toBeVisible();

      expect(previewBody).toBe(await bodyWithoutRsvp(guestPage));
    } finally {
      await guest.close();
    }
  });

  test("shows no RSVP form, because answering here would answer for them", async () => {
    await page.goto(`/console/preview/${household.invitationId}`);

    await expect(page.locator(".invitation__rsvp")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Confirmar|Enviar respuesta/i }),
    ).toHaveCount(0);
  });

  test("renders no phone number anywhere in its source", async () => {
    await page.goto(`/console/preview/${household.invitationId}`);
    const html = await page.content();

    expect(html).not.toContain(ANA_GUEST_PHONE);
    expect(html).not.toContain(ANA_GUEST_PHONE.slice(-8));
  });

  test("answers 404 for a household the signed-in operator does not own", async () => {
    const response = await page.goto(
      `/console/preview/${betosHousehold.invitationId}`,
    );

    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(
      "Familia Ajena Restrepo",
    );
  });

  test("answers a malformed invitation id as not-found, not as a server error", async () => {
    // `invitations.id` is a uuid column and Postgres raises `22P02` on a value
    // it cannot parse. Unguarded, a mistyped URL reported a broken server.
    const response = await page.goto("/console/preview/not-a-uuid");

    expect(response?.status()).toBe(404);
  });

  test("answers a missing invitation exactly as it answers a foreign one", async () => {
    const missing = await page.goto(
      "/console/preview/99999999-9999-4999-8999-999999999999",
    );
    const foreign = await page.goto(
      `/console/preview/${betosHousehold.invitationId}`,
    );

    expect(missing?.status()).toBe(foreign?.status());
  });

  test("denies an unauthenticated visitor and renders no invitation content", async ({
    browser,
  }) => {
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    try {
      await strangerPage.goto(`/console/preview/${household.invitationId}`);

      await expect(strangerPage).toHaveURL(/\/console\/login/);
      expect(await strangerPage.content()).not.toContain(
        "Familia Previa Muñóz",
      );
    } finally {
      await stranger.close();
    }
  });
});

test.describe("the public route still has exactly one unlock path", () => {
  test("gives a signed-in operator the phone gate on the public route", async () => {
    // The console session is not an unlock. The preview is a DIFFERENT route
    // precisely so this route's authorization depends on one identity only.
    await page.goto(`/i/${household.slug}`);

    await expect(page.getByLabel(/Número de celular/)).toBeVisible();
    expect(await page.content()).not.toContain("Tomás Previo Muñóz");
  });

  for (const query of ["?preview=1", "?admin=1", "?console=1"]) {
    test(`does not bypass the gate for ${query} even with an operator session`, async () => {
      await page.goto(`/i/${household.slug}${query}`);

      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
      expect(await page.content()).not.toContain("Tomás Previo Muñóz");
    });
  }
});

test.describe("the message preview's card image", () => {
  /** What the invitation page ADVERTISES as its `og:image`, read from the HTML. */
  async function advertisedOgImage(slug: string): Promise<string> {
    const response = await page.request.get(`/i/${slug}`);
    const html = await response.text();
    const tag = /<meta[^>]+property="og:image"[^>]*>/i.exec(html);

    expect(
      tag,
      "the invitation page must advertise an og:image",
    ).not.toBeNull();

    const content = /content="([^"]*)"/i.exec(tag![0]);
    expect(content).not.toBeNull();

    return content![1];
  }

  test("points the preview image at the URL the crawler will fetch", async () => {
    // THE assertion of this work unit. Next appends a build-scoped hash to the
    // emitted `og:image` and a CDN keys on the full URL, so an `<img>` aimed at
    // the bare route path would be a DIFFERENT cache entry from the crawler's:
    // a preview that looks right and warms nothing.
    const advertised = await advertisedOgImage(household.slug);
    expect(advertised.startsWith(E2E_SITE_ORIGIN)).toBe(true);

    await page.goto(`/console/dispatch/${household.invitationId}`);
    const src = await page
      .locator("img.wa-preview__card-image")
      .getAttribute("src");

    expect(src).toBe(advertised.slice(E2E_SITE_ORIGIN.length));
  });

  test("adds no cache-busting parameter, which would be a third cache entry", async () => {
    await page.goto(`/console/dispatch/${household.invitationId}`);
    const src = await page
      .locator("img.wa-preview__card-image")
      .getAttribute("src");

    expect(src).not.toMatch(/[?&](t|v|cb|_|ts|rand)=/);
    expect(src).toContain(`/i/${household.slug}/opengraph-image`);
  });

  test("serves bytes identical to a direct fetch of the card route", async () => {
    await page.goto(`/console/dispatch/${household.invitationId}`);
    const src = (await page
      .locator("img.wa-preview__card-image")
      .getAttribute("src"))!;

    const [fromPreview, direct] = await Promise.all([
      page.request.get(src),
      page.request.get(`/i/${household.slug}/opengraph-image`),
    ]);

    expect(fromPreview.status()).toBe(200);
    expect(direct.status()).toBe(200);
    expect((await fromPreview.body()).equals(await direct.body())).toBe(true);
  });

  test("shows a different household its own card", async () => {
    // The card is per-guest. One shared image would be the single most visible
    // way for this product to send the wrong household's name to somebody.
    await page.goto(`/console/dispatch/${household.invitationId}`);
    const mine = await page
      .locator("img.wa-preview__card-image")
      .getAttribute("src");

    expect(mine).toContain(household.slug);
    expect(mine).not.toContain(betosHousehold.slug);
  });

  test("labels the pane as approximate and states every known divergence", async () => {
    await page.goto(`/console/dispatch/${household.invitationId}`);
    const pane = page.locator("section.wa-preview");

    await expect(pane).toContainText(
      "Aproximado — el resultado real varía según el dispositivo",
    );
    await expect(pane).toContainText("primer enlace");
    await expect(pane).toContainText("iOS");
    await expect(pane).toContainText("Twemoji");
    await expect(pane.locator("li")).toHaveCount(6);
  });

  test("shows the exact draft and the raw wa.me URL", async () => {
    await page.goto(`/console/dispatch/${household.invitationId}`);
    const pane = page.locator("section.wa-preview");

    await expect(pane).toContainText("Familia Previa Muñóz");
    await expect(pane).toContainText(`${E2E_SITE_ORIGIN}/i/${household.slug}`);
    await expect(pane.locator(".wa-preview__url")).toContainText(
      "https://wa.me/573005557321",
    );
  });

  test("offers no clickable wa.me link that would skip the recording", async () => {
    await page.goto(`/console/dispatch/${household.invitationId}`);

    await expect(
      page.locator('section.wa-preview a[href^="https://wa.me/"]'),
    ).toHaveCount(0);
  });
});

test.describe("the dispatch log keeps the actor and the owner apart", () => {
  test("records a link_opened attributed to the session, not to the owner", async () => {
    // Ownership is deliberately NOT checked by the beacon route: an event where
    // the actor is not the owner is exactly the pair the audit trail exists to
    // preserve, and a route that refused the write would destroy the only
    // record that it happened. The console hides the affordance; the log keeps
    // the truth.
    const clientEventId = crypto.randomUUID();

    const posted = await page.request.post("/console/api/dispatch-event", {
      headers: { "content-type": "text/plain;charset=UTF-8" },
      data: JSON.stringify({
        invitationId: betosHousehold.invitationId,
        clientEventId,
      }),
    });

    expect(posted.status()).toBe(204);

    await expect
      .poll(async () => (await betosHousehold.dispatchEvents()).length)
      .toBeGreaterThan(0);

    const [event] = await betosHousehold.dispatchEvents();
    expect(event.kind).toBe("link_opened");
    expect(event.actorSenderId).toBe(ana.senderId);
    expect(event.actorSenderId).not.toBe(beto.senderId);
    expect(event.clientEventId).toBe(clientEventId);
  });

  test("counts a re-posted client event id once and not twice", async () => {
    const before = (await household.dispatchEvents()).length;
    const clientEventId = crypto.randomUUID();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await page.request.post("/console/api/dispatch-event", {
        headers: { "content-type": "text/plain;charset=UTF-8" },
        data: JSON.stringify({
          invitationId: household.invitationId,
          clientEventId,
        }),
      });

      expect(response.status()).toBe(204);
    }

    await expect
      .poll(async () => (await household.dispatchEvents()).length)
      .toBe(before + 1);
  });

  test("refuses an unauthenticated beacon with a status, never a redirect", async ({
    browser,
  }) => {
    const stranger = await browser.newContext();
    try {
      const response = await stranger.request.post(
        "/console/api/dispatch-event",
        {
          headers: { "content-type": "text/plain;charset=UTF-8" },
          data: JSON.stringify({
            invitationId: household.invitationId,
            clientEventId: crypto.randomUUID(),
          }),
          maxRedirects: 0,
        },
      );

      expect(response.status()).toBe(401);
    } finally {
      await stranger.close();
    }
  });
});
