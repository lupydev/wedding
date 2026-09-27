import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedInvitation, type SeededInvitation } from "./helpers/seed";

/**
 * ONE SCREEN PER STEP, ON A PHONE, MEASURED.
 *
 * This is the acceptance criterion of the whole redesign, written as a test
 * because it is the kind of promise that decays silently. Nothing about a page
 * that has grown to 1.3 viewports looks broken from a laptop: it renders, every
 * other assertion stays green, and the only person who finds out is a guest
 * holding a phone who does not realise there is more below.
 *
 * WHERE IT STARTED. Measured on an iPhone 14 before this unit: the gate was
 * 1.25 viewports, the question 1.25, a household that had accepted 2.50, and a
 * household that had declined 1.64. The landing page the couple asked this to
 * match was exactly 1.00. Close to every guest arrives here from a WhatsApp
 * link on a phone.
 *
 * WHY IT RUNS ON ITS OWN PROJECTS. `playwright.config.ts` grew an `iPhone 14`
 * and a `Pixel 7` project for this file alone. The rest of the suite is about
 * behaviour and runs once, on a desktop viewport; this file is about geometry,
 * so it has to run on the geometry it is making a claim about — and on two
 * shapes rather than one, because the two phones crop the photograph
 * differently and lay out the type differently.
 *
 * THREE ASSERTIONS PER STEP, AND THE THIRD IS THE ONE THAT CANNOT BE FAKED.
 *
 *  1. `scrollHeight <= innerHeight` — the document is not taller than the
 *     screen.
 *  2. `scrollWidth <= clientWidth` — and not wider, which was already true
 *     before this unit and must stay true.
 *  3. The step's primary control is INSIDE the viewport. A page can satisfy
 *     the first two and still have pushed its send button out of the bottom of
 *     an element that clips, which is a worse failure than scrolling because
 *     nothing can reach the button at all. `toBeVisible()` does not catch it
 *     either: an element below the fold is "visible" to Playwright.
 *
 * Every phone number below is fabricated. A real guest number must never enter
 * a fixture, a seed, or a log.
 */

const PHONE = "+573005551111";

/**
 * THE SIZES THIS GUARD MEASURES, AND WHY THEY ARE THESE FOUR.
 *
 * "El máximo de personas por invitación es de 4" — the couple. One person is
 * the flow with no attendee screen at all, two is the smallest household that
 * has one, and FOUR is the stated ceiling and therefore the tallest screen
 * this product is supposed to be able to draw.
 *
 * The screen that asks who is coming grows with the household — 54 pixels per
 * member, measured — so it is the only step whose height is not fixed, and a
 * guard that only ever measured the common size would pass for a year and
 * fail on the largest family on the list, in front of them.
 */
function householdOfOne() {
  return seedInvitation({
    greetingName: "Camila Aguirre",
    guests: [{ fullName: "Camila Aguirre Vélez", phoneE164: PHONE }],
  });
}

function householdOfTwo() {
  return seedInvitation({
    greetingName: "Familia Aguirre",
    guests: [
      { fullName: "Camila Aguirre Vélez", phoneE164: PHONE },
      { fullName: "Rodrigo Aguirre Peña" },
    ],
  });
}

function householdOfFour() {
  return seedInvitation({
    greetingName: "Familia Aguirre",
    guests: [
      { fullName: "Camila Aguirre Vélez", phoneE164: PHONE },
      { fullName: "Rodrigo Aguirre Peña" },
      { fullName: "Sara Aguirre", isChild: true },
      { fullName: "Tomás Aguirre Mesa", isChild: true },
    ],
  });
}

/**
 * AND A FIFTH PERSON, WHICH NOTHING IN THIS PRODUCT PREVENTS.
 *
 * The ceiling of four is the couple's own statement about their list, not a
 * rule the software holds them to. Checked rather than assumed, and nothing
 * enforces it anywhere:
 *
 *  - The schema has no bound. `invitation_guests` has no row-count
 *    constraint and no trigger that counts; migration 0012 made the seat cap
 *    `count(*)` of the members themselves, and 0013 dropped the column that
 *    had been the only one to carry an upper bound at all.
 *  - The console cannot refuse one. `DraftRefusal` in
 *    `lib/domain/invitation-draft.ts` has no code for "too many members", and
 *    a refusal without a code cannot reach an operator.
 *  - The importer does not count. `scripts/import-guests.ts` sums members for
 *    its report and bounds nothing.
 *
 * So a layout tuned to exactly four is a layout that breaks silently the
 * first time somebody adds a fifth, and this fixture is the canary that says
 * so before a guest does. It stays until something enforces the ceiling.
 */
function householdOfFive() {
  return seedInvitation({
    greetingName: "Familia Restrepo",
    guests: [
      { fullName: "Marta Restrepo Ossa", phoneE164: PHONE },
      { fullName: "Julián Restrepo Ossa" },
      { fullName: "Valentina Restrepo Mesa" },
      { fullName: "Tomás Restrepo Mesa", isChild: true },
      { fullName: "Emilia Restrepo Mesa", isChild: true },
    ],
  });
}

interface Frame {
  readonly scrollHeight: number;
  readonly innerHeight: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

function frameOf(page: Page): Promise<Frame> {
  return page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/**
 * The step fits on the screen, and its one control is on the screen with it.
 *
 * The control is passed in rather than guessed, because "the thing this screen
 * exists to have pressed" is different on every step and is exactly what a
 * layout regression puts out of reach first.
 */
async function expectOneScreen(
  page: Page,
  step: string,
  control: Locator,
): Promise<void> {
  const frame = await frameOf(page);

  expect(
    frame.scrollHeight,
    `${step}: the document is ${frame.scrollHeight}px tall on a ${frame.innerHeight}px screen`,
  ).toBeLessThanOrEqual(frame.innerHeight);

  expect(
    frame.scrollWidth,
    `${step}: the document is ${frame.scrollWidth}px wide in a ${frame.clientWidth}px window`,
  ).toBeLessThanOrEqual(frame.clientWidth);

  const box = await control.boundingBox();

  expect(box, `${step}: the primary control has no box at all`).not.toBeNull();
  expect(
    box!.y + box!.height,
    `${step}: the primary control ends at ${Math.round(box!.y + box!.height)}px, past the ${frame.innerHeight}px fold`,
  ).toBeLessThanOrEqual(frame.innerHeight);
  expect(
    box!.y,
    `${step}: the primary control starts at ${Math.round(box!.y)}px, above the top of the screen`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    box!.x + box!.width,
    `${step}: the primary control reaches ${Math.round(box!.x + box!.width)}px in a ${frame.clientWidth}px window`,
  ).toBeLessThanOrEqual(frame.clientWidth);
}

/** Gets past the phone gate, and waits for the screen behind it. */
async function unlock(page: Page, invitation: SeededInvitation) {
  await page.goto(`/i/${invitation.slug}`);
  await page.getByLabel(/Número de celular/).fill(PHONE);
  await page.getByRole("button", { name: "Ver la invitación" }).click();
  await expect(page.locator("article.invitation")).toBeVisible();
}

let fixture: SeededInvitation | undefined;

test.afterEach(async () => {
  await fixture?.cleanup();
  fixture = undefined;
});

test.describe("the invitation, one screen at a time", () => {
  test("the gate fits, with the way in on the screen", async ({ page }) => {
    fixture = await householdOfFour();

    await page.goto(`/i/${fixture.slug}`);
    await expect(page.locator("section.gate")).toBeVisible();

    await expectOneScreen(
      page,
      "gate",
      page.getByRole("button", { name: "Ver la invitación" }),
    );

    /*
      AND THE TWO GROUPS ARE AT THE TWO ENDS OF IT.

      The couple moved them there because the old arrangement ran down the
      middle of the photograph and covered the two of them. That is a claim
      about pixels, so it is asserted in pixels: the announcement finishes in
      the top half, the form starts in the bottom half, and the middle has
      neither.

      An escape hatch used to be asserted here — "¿No puedes entrar?
      Escríbenos por WhatsApp", the only other thing on the screen. The couple
      deleted it; `components/invitation/InvitationGate.spec.tsx` now asserts
      that the gate offers no link at all.
    */
    const fold = await page.evaluate(() => window.innerHeight);
    const top = (await page.locator(".gate__announcement").boundingBox())!;
    const form = (await page.locator(".gate__panel").boundingBox())!;

    expect(top.y + top.height).toBeLessThan(fold / 2);
    expect(form.y).toBeGreaterThan(fold / 2);
  });

  test("the question fits, with both answers and the deadline on it", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await unlock(page, fixture);

    await expectOneScreen(
      page,
      "question",
      page.getByRole("button", { name: /No podemos acompañarlos/ }),
    );

    /*
      THE DEADLINE IS THE REASON THIS STEP HAS A SEPARATE ASSERTION.

      It was the last line of a page two and a half screens tall, so the one
      fact with a date attached to it was the one most households never saw.
      The couple asked for it to be part of the question, which means being on
      the same screen as the question — not merely in the same document. They
      have since asked for it to leave the CARD as well, so it now stands on
      the bare photograph under it: still the same screen, still above the
      fold, and measured against the pixels down there in
      `app/i/[slug]/step-legibility.spec.tsx`.
    */
    const deadline = page.locator(".rsvp__deadline");
    await expect(deadline).toBeVisible();

    const box = (await deadline.boundingBox())!;
    const fold = await page.evaluate(() => window.innerHeight);

    expect(box.y + box.height).toBeLessThanOrEqual(fold);
  });

  /**
   * AND IT IS THE GATE'S CARD, AT THE FOOT, WITH NOTHING SPARE INSIDE IT.
   *
   * Three of the couple's instructions meet on this screen, and only a real
   * viewport can check any of them.
   *
   *  1. "Esto debería quedar como en la primera página en cuanto al ancho
   *     para que se mantenga la misma UI." The gate is one tap earlier and
   *     its card is 374 pixels wide on an iPhone 14 while its field and its
   *     button are 342 — two numbers, because the gate paints its ground at
   *     `-inset-x-4`. This card has to land on BOTH or it matches neither.
   *  2. "El componente debe quedar abajo pegado a la fecha de confirmación."
   *  3. The band of empty card under the second answer — 76 pixels, and the
   *     one thing here they did not have to name — is gone.
   *
   * MEASURED AGAINST THE GATE ITSELF rather than against 374, because a
   * hard-coded number goes stale the moment the gate's own padding changes,
   * and the two screens would then drift apart with every assertion still
   * green.
   *
   * THE FLOOR ON THE TWO TARGETS IS ASSERTED IN THE SAME BREATH, because the
   * claims pull against each other: everything here shrinks containers, and
   * the thing that must never shrink is the control a non-technical guest
   * has to hit.
   */
  test("the question wears the gate's card, pushed down to the deadline", async ({
    page,
  }) => {
    fixture = await householdOfFour();

    // The gate first, since it is the reference the couple named.
    await page.goto(`/i/${fixture.slug}`);
    await expect(page.locator("section.gate")).toBeVisible();

    const gateCard = (await page.locator(".gate__panel-ground").boundingBox())!;
    const gateControl = (await page
      .getByRole("button", { name: "Ver la invitación" })
      .boundingBox())!;

    await unlock(page, fixture);

    const card = (await page.locator(".rsvp__panel").boundingBox())!;
    const answers = await page.locator(".rsvp__answer").all();

    expect(answers).toHaveLength(2);

    const boxes = await Promise.all(
      answers.map(async (answer) => (await answer.boundingBox())!),
    );

    // 1. The same card, and the same measure inside it.
    expect(Math.round(card.x)).toBe(Math.round(gateCard.x));
    expect(Math.round(card.width)).toBe(Math.round(gateCard.width));
    expect(Math.round(boxes[0].x)).toBe(Math.round(gateControl.x));
    expect(Math.round(boxes[0].width)).toBe(Math.round(gateControl.width));

    // The two answers are one control repeated, not a primary and a
    // secondary: same width, same height, whichever way the couple later
    // decide that question.
    expect(boxes[0].width).toBe(boxes[1].width);
    expect(Math.round(boxes[0].height)).toBe(Math.round(boxes[1].height));

    // Each one is still a target a thumb can hit.
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // 2. Nothing between the card and the deadline but the group's own gap.
    const deadline = (await page.locator(".rsvp__deadline").boundingBox())!;
    const gap = deadline.y - (card.y + card.height);

    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(16);

    // 3. And no dead band inside it: the card ends one padding below the
    // last answer.
    const padding = boxes[0].x - card.x;
    const belowTheLast = card.y + card.height - (boxes[1].y + boxes[1].height);

    expect(belowTheLast).toBeGreaterThan(0);
    expect(belowTheLast).toBeLessThanOrEqual(padding + 12);

    // The refusal keeps its reserved space, above the card where it costs
    // neither the card nor the deadline a pixel.
    const slot = (await page.locator(".rsvp__feedback").boundingBox())!;

    expect(slot.y + slot.height).toBeLessThanOrEqual(card.y);
    expect(slot.height).toBeGreaterThanOrEqual(40);
  });

  test("who is coming fits, for a household of four — the stated ceiling", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await unlock(page, fixture);
    await page.getByRole("button", { name: /Sí, acepto/ }).click();

    await expect(
      page.getByRole("group", { name: /Quiénes asisten/ }),
    ).toBeVisible();
    await expectOneScreen(
      page,
      "attendees (3)",
      page.getByRole("button", { name: "Enviar respuesta" }),
    );

    /*
      THE CARD AT THE TOP AND THE WAY BACK AT THE FOOT, WHICH IS WHAT THE
      COUPLE ASKED FOR AND WHAT THE UNIT SPEC CANNOT SEE.

      `RsvpAnswer.spec.tsx` asserts the containment — the list is on the card
      and "Volver a la pregunta" is not. Only a real viewport can say that the
      one is at the top of the screen and the other at the bottom of it, which
      is the part about the photograph.
    */
    const fold = await page.evaluate(() => window.innerHeight);
    const card = (await page.locator(".rsvp__panel").boundingBox())!;
    const back = (await page.locator(".rsvp__back").boundingBox())!;

    expect(card.y).toBeLessThan(fold / 4);
    expect(back.y).toBeGreaterThan(fold * 0.75);
  });

  test("who is coming fits, for a household of two", async ({ page }) => {
    fixture = await householdOfTwo();
    await unlock(page, fixture);
    await page.getByRole("button", { name: /Sí, acepto/ }).click();

    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await expectOneScreen(
      page,
      "attendees (2)",
      page.getByRole("button", { name: "Enviar respuesta" }),
    );
  });

  test("who is coming fits, for a household of five — the canary", async ({
    page,
  }) => {
    fixture = await householdOfFive();
    await unlock(page, fixture);
    await page.getByRole("button", { name: /Sí, acepto/ }).click();

    await expect(page.getByRole("checkbox")).toHaveCount(5);
    await expectOneScreen(
      page,
      "attendees (5)",
      page.getByRole("button", { name: "Enviar respuesta" }),
    );
  });

  /**
   * AND THE FLOW THAT HAS NO SUCH SCREEN AT ALL.
   *
   * An invitation naming one person records its acceptance on the first tap
   * and lands on the directions — `RsvpAnswer` records why. Measured here
   * because "the screen it skips" is not a claim a unit test can make about
   * pixels, and because a solo invitation is the shape a guest most often
   * gets.
   */
  test("the question and the directions fit, for one person", async ({
    page,
  }) => {
    fixture = await householdOfOne();
    await unlock(page, fixture);

    await expectOneScreen(
      page,
      "question (1)",
      page.getByRole("button", { name: /Sí, acepto/ }),
    );

    await page.getByRole("button", { name: /Sí, acepto/ }).click();
    await expect(page.locator(".rsvp__confirmed")).toBeVisible();
    // Straight past the list of who is coming: there was nobody to choose.
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expectOneScreen(
      page,
      "confirmed (1)",
      page.getByRole("link", { name: /Cómo llegar/ }),
    );
  });

  test("where to go fits, with the hour, the dress code and the way there", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await unlock(page, fixture);
    await page.getByRole("button", { name: /Sí, acepto/ }).click();
    await page.getByRole("button", { name: "Enviar respuesta" }).click();

    await expect(page.locator(".rsvp__confirmed")).toBeVisible();
    await expectOneScreen(
      page,
      "confirmed",
      page.getByRole("link", { name: /Cómo llegar/ }),
    );

    /*
      THE FACTS THIS SCREEN EXISTS FOR, ALL ABOVE THE FOLD WITH IT — AND NOW
      THE LINE THAT NAMES THE HOUSEHOLD TOO.

      The couple moved that line: "en la parte de arriba en vez de decir hola…
      Te esperamos, nombre de la invitación." It is the top of the screen and
      the only place on it that says the answer was heard, so a layout that
      pushed it off the top would be the one failure a guest could not recover
      from by scrolling.
    */
    const fold = await page.evaluate(() => window.innerHeight);
    for (const locator of [
      page.locator(".invitation__greeting"),
      page.locator(".rsvp__when"),
      page.locator(".rsvp__venue"),
      page.locator(".rsvp__venue-map"),
    ]) {
      const box = (await locator.boundingBox())!;

      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(fold);
    }

    /*
      AND THE COUPLE'S ORDER SURVIVED THE TRIP THROUGH THE LAYOUT.

      The unit spec asserts the DOM order; this asserts what the two grouped
      blocks actually do on a phone — the day and the dress code at the top
      under the heading, the place and the one control at the foot of the
      screen, with the emptied middle between them.
    */
    const when = (await page.locator(".rsvp__when").boundingBox())!;
    const venue = (await page.locator(".rsvp__venue").boundingBox())!;

    expect(when.y + when.height).toBeLessThan(venue.y);
    expect(venue.y).toBeGreaterThan(fold / 2);
  });

  test("the stream fits, for a household that cannot come", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await unlock(page, fixture);
    await page.getByRole("button", { name: /No podemos acompañarlos/ }).click();

    await expect(page.getByTestId("stream-details")).toBeVisible();
    await expectOneScreen(
      page,
      "stream",
      page.getByRole("link", { name: /Entrar a la transmisión/ }),
    );
  });

  /**
   * THE SCREEN AN UNKNOWN SLUG GETS, WHICH WAS ALREADY ONE VIEWPORT.
   *
   * Asserted anyway: it is the one screen here that nobody is going to look at
   * again, and it shares the stage every other screen stands on.
   */
  test("the not-found screen fits", async ({ page }) => {
    await page.goto("/i/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    const frame = await frameOf(page);

    expect(frame.scrollHeight).toBeLessThanOrEqual(frame.innerHeight);
    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
  });
});

/**
 * THE GATE, WITH A KEYBOARD IN THE WAY — AND WHAT THIS TEST DOES NOT CLAIM.
 *
 * On real iOS Safari the software keyboard changes neither
 * `window.innerHeight` nor the `dvh` unit; only `visualViewport.height` moves.
 * Chromium under emulation has no software keyboard at all, so NOTHING here
 * reproduces the real thing and pretending otherwise would be worse than not
 * testing it.
 *
 * What can be measured is the shape of the degradation the gate was designed
 * for. Shrink the window to roughly what an iPhone leaves above its keyboard
 * and the gate must do two things: allow the page to scroll rather than clip
 * it — `InvitationGate` is deliberately `min-h-dvh` and not `h-dvh` for exactly
 * this — and keep the field and the button reachable once it has.
 *
 * If this ever goes red because the gate was locked to a fixed height, the real
 * failure it is standing in for is a guest on an iPhone who cannot reach the
 * only button on the page.
 */
test.describe("the gate when something is covering half the screen", () => {
  test("lets the page scroll and keeps the way in reachable", async ({
    page,
  }) => {
    fixture = await householdOfFour();

    // Roughly an iPhone 14 with its keyboard raised. Not a keyboard: a window.
    await page.setViewportSize({ width: 390, height: 360 });
    await page.goto(`/i/${fixture.slug}`);

    const field = page.getByLabel(/Número de celular/);
    const button = page.getByRole("button", { name: "Ver la invitación" });

    await expect(field).toBeVisible();

    // Nothing clips: whatever does not fit can be reached by scrolling to it.
    await button.scrollIntoViewIfNeeded();

    const box = (await button.boundingBox())!;
    const fold = await page.evaluate(() => window.innerHeight);

    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(fold);

    // And the field is still usable once it has been scrolled to.
    await field.fill(PHONE);
    await button.click();
    await expect(page.locator("article.invitation")).toBeVisible();
  });
});
