import { expect, test, type Page } from "@playwright/test";

import {
  seedInvitation,
  seededGuestIds,
  type SeededInvitation,
} from "./helpers/seed";

/**
 * The RSVP, end to end.
 *
 * Vitest cannot render an async Server Component, and both halves of this
 * feature live inside one: whether the form appears at all (the deadline) and
 * whether a submission actually reaches Postgres. So the assertions that only a
 * real browser against a real database can make are here.
 *
 * The three that matter most:
 *
 *  1. A CHANGED ANSWER produces two rows and one current state. That is the
 *     shape the whole aggregate rule exists for: with append-only history, a
 *     naive count reports every household that changed its mind twice, which is
 *     how a reference project's dashboard reported 47 confirmed from 17
 *     answers. A test that answers once cannot detect it.
 *  2. A TAMPERED submission is refused by the server. The form's cap is a
 *     convenience; the guarantee is the re-validation behind it, and the only
 *     honest way to test that is to break the form and submit anyway.
 *  3. PAST THE DEADLINE there is no form at all — not a disabled one, not one
 *     whose submissions are dropped.
 *
 * Every phone number below is fabricated. A real guest number must never enter
 * a fixture, a seed, or a log.
 */

const GUEST_ONE = "Camila Aguirre Vélez";
const GUEST_TWO = "Rodrigo Aguirre Peña";
const GUEST_THREE = "Sara Aguirre";
const PHONE_ONE = "+573005551111";

/** A household of three named people holding three seats. */
function household(
  overrides: Partial<Parameters<typeof seedInvitation>[0]> = {},
) {
  return seedInvitation({
    greetingName: "Familia Aguirre",
    displayName: "Familia Aguirre",
    seatsAllowed: 3,
    guests: [
      { fullName: GUEST_ONE, phoneE164: PHONE_ONE },
      { fullName: GUEST_TWO, phoneE164: "+573005552222" },
      { fullName: GUEST_THREE, isChild: true },
    ],
    ...overrides,
  });
}

async function unlock(page: Page, invitation: SeededInvitation) {
  await page.goto(`/i/${invitation.slug}`);
  await page.getByLabel(/Número de celular/).fill(PHONE_ONE);
  await page.getByRole("button", { name: "Ver la invitación" }).click();
  await expect(page.getByText("Nos alegra mucho invitarlos")).toBeVisible();
}

function attendeeBox(page: Page, name: string) {
  return page.getByRole("checkbox", { name });
}

function submit(page: Page) {
  return page.getByRole("button", { name: "Enviar respuesta" }).click();
}

function rsvpAlert(page: Page) {
  return page.locator("form.rsvp__form").getByRole("alert");
}

test.describe("answering the invitation", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("records an answer and derives the seats from the names", async ({
    page,
  }) => {
    await unlock(page, invitation);

    await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
    await attendeeBox(page, GUEST_ONE).check();
    await attendeeBox(page, GUEST_TWO).check();
    await page
      .getByLabel(/Restricciones alimentarias/)
      .fill("Sara no come mariscos.");
    await submit(page);

    await expect(rsvpAlert(page)).toContainText(
      "¡Listo! Guardamos su respuesta.",
    );

    const history = await invitation.responseHistory();

    expect(history).toHaveLength(1);
    expect(history[0].attending).toBe(true);
    // Never typed, always counted: two names, two seats.
    expect(history[0].seatsConfirmed).toBe(2);
    expect(history[0].attendeeGuestIds).toHaveLength(2);
    expect(history[0].dietaryNotes).toBe("Sara no come mariscos.");
    expect(history[0].message).toBeNull();
  });

  test("shows the household what they already answered", async ({ page }) => {
    await unlock(page, invitation);

    await expect(
      page.getByText("Tu respuesta actual: asisten 2 personas."),
    ).toBeVisible();
    await expect(attendeeBox(page, GUEST_ONE)).toBeChecked();
    await expect(attendeeBox(page, GUEST_THREE)).not.toBeChecked();
  });

  test("keeps both answers when the household changes its mind", async ({
    page,
  }) => {
    // THE test. Two submissions, and the aggregate must report ONE response —
    // the second. A single-submission test cannot see this defect at all,
    // because the naive count and the correct one agree until someone changes
    // their mind.
    await unlock(page, invitation);

    await page.getByRole("radio", { name: /No podremos acompañarlos/ }).check();
    await submit(page);
    await expect(rsvpAlert(page)).toContainText(
      "¡Listo! Guardamos su respuesta.",
    );

    const history = await invitation.responseHistory();
    const current = await invitation.currentResponse();

    // The history keeps both: "she said yes, then cancelled" is information the
    // couple wants, and the append-only trigger refuses to lose it.
    expect(history).toHaveLength(2);
    expect(history[0].attending).toBe(true);
    expect(history[1].attending).toBe(false);

    // The aggregate reduces to exactly one row, and it says no.
    expect(current).not.toBeNull();
    expect(current?.attending).toBe(false);
    expect(current?.seatsConfirmed).toBe(0);
  });
});

test.describe("the seat cap", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    // Five named people, three seats: a large family the couple could only fit
    // three of. This is where a cap is a real constraint rather than a formality.
    invitation = await seedInvitation({
      greetingName: "Familia Restrepo",
      displayName: "Familia Restrepo",
      seatsAllowed: 3,
      guests: [
        { fullName: GUEST_ONE, phoneE164: PHONE_ONE },
        { fullName: GUEST_TWO },
        { fullName: GUEST_THREE },
        { fullName: "Luis Restrepo" },
        { fullName: "Ana Restrepo" },
      ],
    });
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("offers no way to select a fourth person", async ({ page }) => {
    await unlock(page, invitation);

    await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
    await attendeeBox(page, GUEST_ONE).check();
    await attendeeBox(page, GUEST_TWO).check();
    await attendeeBox(page, GUEST_THREE).check();

    await expect(
      page.getByText("Ya seleccionaron los 3 lugares reservados."),
    ).toBeVisible();
    await expect(attendeeBox(page, "Luis Restrepo")).toBeDisabled();
    await expect(attendeeBox(page, "Ana Restrepo")).toBeDisabled();
    // And no affordance anywhere for asking for more.
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
  });

  test("refuses a tampered over-cap submission server-side", async ({
    page,
  }) => {
    await unlock(page, invitation);
    await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();

    // Break the form the way an attacker would: strip the attribute that stops
    // the fourth and fifth boxes, then check everybody. The client cap is a
    // convenience; what is being tested is the guarantee behind it.
    await page.evaluate(() => {
      for (const box of document.querySelectorAll<HTMLInputElement>(
        'input[name="attendee"]',
      )) {
        box.disabled = false;
        box.checked = true;
        box.dispatchEvent(new Event("click", { bubbles: true }));
      }
    });

    await page.evaluate(() => {
      // React controls these inputs, so the DOM state above is re-applied here
      // immediately before submit — a plain form POST carries what the DOM says.
      for (const box of document.querySelectorAll<HTMLInputElement>(
        'input[name="attendee"]',
      )) {
        box.disabled = false;
        box.checked = true;
      }
    });

    await submit(page);

    await expect(rsvpAlert(page)).toContainText(
      "Seleccionaron más personas de las que tenemos reservadas para ustedes.",
    );
    await expect(invitation.responseHistory()).resolves.toHaveLength(0);
  });

  test("refuses a submission naming somebody from another household", async ({
    page,
  }) => {
    // Inside the cap, well-formed, and still not this household's to seat.
    // `attendee_guest_ids` is a uuid array, not a foreign key, so nothing in
    // the database would notice — the server must.
    const stranger = await household({ greetingName: "Familia Ajena" });

    try {
      const strangerGuests = await seededGuestIds(stranger.invitationId);
      const strangerId = strangerGuests.get(GUEST_ONE)!;

      await unlock(page, invitation);
      await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
      await page.evaluate((guestId) => {
        const injected = document.createElement("input");
        injected.type = "hidden";
        injected.name = "attendee";
        injected.value = guestId;
        document.querySelector("form.rsvp__form")!.append(injected);
      }, strangerId);
      await submit(page);

      await expect(rsvpAlert(page)).toContainText(
        "No pudimos guardar la respuesta.",
      );
      await expect(invitation.responseHistory()).resolves.toHaveLength(0);
      await expect(stranger.responseHistory()).resolves.toHaveLength(0);
    } finally {
      await stranger.cleanup();
    }
  });
});

test.describe("the RSVP deadline", () => {
  test("shows a contact message instead of the form once it has passed", async ({
    page,
  }) => {
    const invitation = await household({ rsvpDeadline: "2020-01-01" });

    try {
      await unlock(page, invitation);

      await expect(
        page.getByText(/Ya cerramos las confirmaciones/),
      ).toBeVisible();
      // Not a disabled form. No form.
      await expect(page.locator("form.rsvp__form")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Enviar respuesta" }),
      ).toHaveCount(0);
    } finally {
      await invitation.cleanup();
    }
  });

  test("accepts an answer on the deadline day itself", async ({ page }) => {
    // The Bogota day-end rule, end to end: the invitation stays open through
    // the whole of the chosen day where the wedding is.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const invitation = await household({ rsvpDeadline: today });

    try {
      await unlock(page, invitation);

      await page
        .getByRole("radio", { name: /No podremos acompañarlos/ })
        .check();
      await submit(page);

      await expect(rsvpAlert(page)).toContainText(
        "¡Listo! Guardamos su respuesta.",
      );
      await expect(invitation.responseHistory()).resolves.toHaveLength(1);
    } finally {
      await invitation.cleanup();
    }
  });

  test("accepts an answer when the invitation has no deadline at all", async ({
    page,
  }) => {
    const invitation = await household({ rsvpDeadline: null });

    try {
      await unlock(page, invitation);

      await expect(page.locator("form.rsvp__form")).toBeVisible();
      await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
      await attendeeBox(page, GUEST_ONE).check();
      await submit(page);

      await expect(rsvpAlert(page)).toContainText(
        "¡Listo! Guardamos su respuesta.",
      );
      const history = await invitation.responseHistory();
      expect(history).toHaveLength(1);
      expect(history[0].seatsConfirmed).toBe(1);
    } finally {
      await invitation.cleanup();
    }
  });
});

test.describe("answering without a session", () => {
  test("refuses a submission once the unlock cookie is gone", async ({
    page,
    context,
  }) => {
    // The authorization boundary, exercised the only way a browser can reach
    // it: unlock, keep the rendered form, then throw the session away and
    // submit. The action must refuse — the cookie IS the authorization, and it
    // is checked against this invitation on every write, not only at render.
    const invitation = await household();

    try {
      await unlock(page, invitation);
      await page
        .getByRole("radio", { name: /No podremos acompañarlos/ })
        .check();

      await context.clearCookies();
      await submit(page);

      await expect(rsvpAlert(page)).toContainText(
        "Tu sesión ya no está activa.",
      );
      await expect(invitation.responseHistory()).resolves.toHaveLength(0);
    } finally {
      await invitation.cleanup();
    }
  });
});
