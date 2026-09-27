import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedInvitation, type SeededInvitation } from "./helpers/seed";

/**
 * THE WEEK AFTER THE DEADLINE, WHICH NOTHING HAD EVER RENDERED.
 *
 * The RSVP closes seven days before the wedding. That date is derived from a
 * constant in the future and the decision is made on the SERVER during
 * render, so no fixture could be past it and `page.clock` reached nothing —
 * `e2e/rsvp.spec.ts` recorded the gap honestly and left it open.
 *
 * What was behind the gap: `<RsvpClosed />` took no props and replaced the
 * whole stepper with two sentences, so from the 21st of November a household
 * that had accepted lost the venue, the map, `Cómo llegar`, the hour and the
 * dress code, and one that had declined lost `Entrar a la transmisión` and
 * the calendar. Everybody got a greeting and the words "confirmaciones
 * cerradas" — in the seven days when a guest most needs the page.
 *
 * WHAT THE COUPLE DECIDED, and what this file asserts: the deadline closes
 * the ability to CHANGE an answer, not the invitation.
 *
 * HOW THE CLOCK IS CONTROLLED. `playwright.config.ts` runs a second server on
 * the next port with `RSVP_CLOCK` set to four days after the deadline, and
 * the two `*-closed` projects point at it. `lib/server/env.ts` records how
 * strictly that value is parsed and why it refuses to exist in production.
 *
 * AND THE FIRST TEST BELOW IS THE ONE THAT MAKES THE REST MEAN ANYTHING. A
 * frozen clock that silently failed to apply would leave every assertion here
 * running against the OPEN branch, where a household that accepted also sees
 * the venue — and the file would be green while testing nothing. So the suite
 * proves the two origins differ before it believes either of them.
 *
 * Every phone number below is fabricated.
 */

const PHONE = "+573005551111";
/**
 * The origin whose deadline has NOT passed, derived the way the config
 * derives it.
 *
 * Written as a literal `localhost:3000` once, which passed only because
 * something else happened to be listening there — the stale-server trap this
 * project has been caught by before. `PORT` is what `playwright.config.ts`
 * reads, so this reads it too.
 */
const OPEN_ORIGIN =
  process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

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

function householdOfOne() {
  return seedInvitation({
    greetingName: "Camila Aguirre",
    guests: [{ fullName: "Camila Aguirre Vélez", phoneE164: PHONE }],
  });
}

/**
 * Gets past the phone gate on whichever origin this project is pointed at.
 *
 * THE GATE MAY ALREADY BE OPEN, and that is worth stating rather than
 * discovering. The unlock cookie is scoped to the host and the invitation's
 * own path — not to the port — so a household that answered on the open
 * server arrives at the closed one already through. Filling a field that is
 * not there would hang for thirty seconds and report nothing useful.
 */
async function unlock(page: Page, invitation: SeededInvitation) {
  await page.goto(`/i/${invitation.slug}`);

  const field = page.getByLabel(/Número de celular/);

  if (await field.count()) {
    await field.fill(PHONE);
    await page.getByRole("button", { name: "Ver la invitación" }).click();
  }

  await expect(page.locator("article.invitation")).toBeVisible();
}

/** Answers on the OPEN origin, so the closed origin has an answer to read. */
async function answerBeforeTheDeadline(
  page: Page,
  invitation: SeededInvitation,
  answer: "yes" | "no",
) {
  await page.goto(`${OPEN_ORIGIN}/i/${invitation.slug}`);
  await page.getByLabel(/Número de celular/).fill(PHONE);
  await page.getByRole("button", { name: "Ver la invitación" }).click();
  await page.getByRole("button", { name: "Ver la invitación" }).waitFor({
    state: "detached",
  });

  if (answer === "no") {
    await page
      .getByRole("button", { name: /No pod(emos|ré)? acompañarlos|No puedo/ })
      .click();
    await expect(page.getByTestId("stream-details")).toBeVisible();

    return;
  }

  await page.getByRole("button", { name: /Sí, acepto/ }).click();

  const send = page.getByRole("button", { name: "Enviar respuesta" });

  if (await send.count()) {
    await send.click();
  }

  await expect(page.locator(".rsvp__confirmed")).toBeVisible();
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
 * These are real screens, so they are held to the guard the others are.
 *
 * The same three assertions `e2e/invitation-one-screen.spec.ts` makes: not
 * taller than the screen, not wider than the window, and the thing this step
 * exists to have pressed is inside the viewport.
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
  expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);

  const box = (await control.boundingBox())!;

  expect(box, `${step}: the primary control has no box`).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(frame.innerHeight);
  expect(
    box.height,
    `${step}: the control is under 44px`,
  ).toBeGreaterThanOrEqual(44);
}

let fixture: SeededInvitation | undefined;

test.afterEach(async () => {
  await fixture?.cleanup();
  fixture = undefined;
});

test.describe("the invitation after the deadline", () => {
  /**
   * THE PROOF THAT THIS FILE IS TESTING WHAT IT SAYS IT IS.
   *
   * One household, two origins, in one test. The open one offers a form; the
   * closed one does not and says so. If `RSVP_CLOCK` failed to reach the
   * second server, both halves would show a form and this fails on the line
   * that matters — before any other assertion in the file gets to be
   * misleading.
   */
  test("is a different page from the same invitation before it", async ({
    page,
  }) => {
    fixture = await householdOfFour();

    await page.goto(`${OPEN_ORIGIN}/i/${fixture.slug}`);
    await page.getByLabel(/Número de celular/).fill(PHONE);
    await page.getByRole("button", { name: "Ver la invitación" }).click();
    await expect(page.locator("form.rsvp__form")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sí, acepto/ }),
    ).toBeVisible();

    await unlock(page, fixture);

    await expect(page.locator("form.rsvp__form")).toHaveCount(0);
    await expect(page.locator(".rsvp__closed")).toBeVisible();
    await expect(page.locator(".rsvp__closed-note")).toContainText(
      "Ya cerramos las confirmaciones",
    );
  });

  /**
   * A HOUSEHOLD THAT ACCEPTED KEEPS EVERYTHING IT NEEDS TO GET THERE.
   *
   * This is the case the old screen hurt most: the venue, the map, the hour
   * and the dress code all disappeared in the week the guest was travelling
   * to the wedding.
   */
  test("keeps the venue and the way there for a household that accepted", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await answerBeforeTheDeadline(page, fixture, "yes");
    await unlock(page, fixture);

    await expect(page.locator(".rsvp__venue")).toBeVisible();
    await expect(page.locator(".rsvp__when")).toBeVisible();
    await expect(page.getByRole("link", { name: /Cómo llegar/ })).toBeVisible();
    // And no way to change the answer, which is what the deadline closes.
    await expect(
      page.getByRole("button", { name: /Volver a responder/ }),
    ).toHaveCount(0);
    await expect(page.locator("form.rsvp__form")).toHaveCount(0);

    await expectOneScreen(
      page,
      "closed / accepted",
      page.getByRole("link", { name: /Cómo llegar/ }),
    );
  });

  test("keeps the stream and the calendar for a household that declined", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await answerBeforeTheDeadline(page, fixture, "no");
    await unlock(page, fixture);

    await expect(
      page.getByRole("link", { name: /Entrar a la transmisión/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Agregar a Google Calendar/ }),
    ).toBeVisible();
    // Still not the venue: a household that said no is never told where.
    await expect(page.locator(".rsvp__venue")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Volver a responder/ }),
    ).toHaveCount(0);

    await expectOneScreen(
      page,
      "closed / declined",
      page.getByRole("link", { name: /Entrar a la transmisión/ }),
    );
  });

  /**
   * AND THE ENDING NOBODY ASKED FOR, ASSERTED SO IT CAN BE ARGUED WITH.
   *
   * A household that never answered is offered the stream and NOT the venue.
   * That is a decision taken on the couple's behalf and written into the
   * feature document for them to overrule; asserting it here is what makes
   * overruling it a visible change rather than a silent one.
   */
  test("offers the stream, but not the venue, to a household that never answered", async ({
    page,
  }) => {
    fixture = await householdOfFour();
    await unlock(page, fixture);

    await expect(
      page.getByRole("link", { name: /Entrar a la transmisión/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Agregar a Google Calendar/ }),
    ).toBeVisible();
    await expect(page.locator(".rsvp__venue")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Cómo llegar/ })).toHaveCount(
      0,
    );

    await expectOneScreen(
      page,
      "closed / unanswered",
      page.getByRole("link", { name: /Entrar a la transmisión/ }),
    );
  });

  test("says it in the singular to an invitation that names one person", async ({
    page,
  }) => {
    fixture = await householdOfOne();
    await unlock(page, fixture);

    await expect(page.locator(".rsvp__closed-note")).toContainText(
      "Si quieres, puedes acompañarnos",
    );
    await expectOneScreen(
      page,
      "closed / one person",
      page.getByRole("link", { name: /Entrar a la transmisión/ }),
    );
  });
});
