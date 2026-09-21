import { expect, test, type Page } from "@playwright/test";

import {
  readCeremony,
  seedInvitation,
  seededGuestIds,
  type SeededCeremony,
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

/**
 * Declining. ONE tap, and no submit button anywhere in it.
 *
 * A helper rather than a repeated line, so the auto-submit is stated once: if
 * this ever needs a second click again, exactly one place changes and every
 * test that relies on the behaviour fails together.
 */
function decline(page: Page) {
  return page.getByRole("radio", { name: /No podremos acompañarlos/ }).check();
}

function accept(page: Page) {
  return page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
}

function streamCard(page: Page) {
  return page.getByRole("group", { name: /transmisión/i });
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

    // One tap. No submit click follows, and the stream card appearing is the
    // proof the answer actually reached the server.
    await decline(page);
    await expect(streamCard(page)).toBeVisible();

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

  test("lets a declined household come back and accept after all", async ({
    page,
  }) => {
    // A decline auto-submits, so a mis-tap is recorded instantly. This is the
    // way back, end to end: the correction is a THIRD append-only row, and the
    // reduced view must report the acceptance rather than the decline that
    // preceded it. A view that ordered by anything less than total would be
    // free to return either.
    await unlock(page, invitation);

    // They land on the stream, because the answer on file is a decline.
    await expect(streamCard(page)).toBeVisible();
    await page.getByRole("button", { name: "Volver a responder" }).click();

    // Nothing preselected: a mis-tap must not be one tap from repeating itself.
    await expect(
      page.getByRole("radio", { name: /No podremos acompañarlos/ }),
    ).not.toBeChecked();

    await accept(page);
    await attendeeBox(page, GUEST_ONE).check();
    await submit(page);

    await expect(rsvpAlert(page)).toContainText(
      "¡Listo! Guardamos su respuesta.",
    );

    const history = await invitation.responseHistory();
    const current = await invitation.currentResponse();

    expect(history.map((row) => row.attending)).toEqual([true, false, true]);
    expect(current?.attending).toBe(true);
    expect(current?.seatsConfirmed).toBe(1);
  });
});

/**
 * A household that cannot come in person becomes a stream viewer.
 *
 * Rather than maintaining a second audience list — which goes out of date the
 * moment the first one changes — declining a personal invitation IS the
 * subscription. So the Zoom details replace the form, and for these guests they
 * sit behind the phone gate rather than on the public page that will serve
 * everyone else later.
 */
test.describe("declining and the ceremony stream", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;
  let ceremony: SeededCeremony;

  test.beforeAll(async () => {
    invitation = await household({ greetingName: "Familia Lejana" });
    /*
      Read from the row, never restated here: an expectation holding its own copy
      of these four facts would keep passing after the couple changed them.

      Nothing in this file locks the row, and nothing needs to. `ceremony` is a
      singleton and `e2e/console-wedding.spec.ts` edits it through the console —
      which would race with the assertion below — so that spec runs in its own
      Playwright project, sequenced AFTER this one by `dependencies` in
      `playwright.config.ts`. Exclusion by scheduling rather than by locking: a
      lock would make these two files wait on each other inside Playwright's own
      test timeout, which is exactly what it does not budget for.
    */
    ceremony = await readCeremony();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("records the decline on the first tap, with no second click", async ({
    page,
  }) => {
    await unlock(page, invitation);
    await decline(page);

    await expect(streamCard(page)).toBeVisible();

    const history = await invitation.responseHistory();

    expect(history).toHaveLength(1);
    expect(history[0].attending).toBe(false);
    // A decline holds no seats and names nobody, by construction.
    expect(history[0].seatsConfirmed).toBe(0);
    expect(history[0].attendeeGuestIds).toEqual([]);
  });

  test("shows the stream details instead of the form", async ({ page }) => {
    await unlock(page, invitation);

    const card = streamCard(page);

    await expect(card).toContainText(ceremony.ceremonyDate);
    await expect(card).toContainText(ceremony.ceremonyTime);
    await expect(card).toContainText(ceremony.streamMeetingId);
    await expect(card).toContainText(ceremony.streamPasscode);

    // Not a form beside the card, and not a disabled copy of it. No form.
    await expect(page.locator("form.rsvp__form")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Enviar respuesta" }),
    ).toHaveCount(0);
    // And the answer is explicitly not final.
    await expect(
      page.getByText(/Si cambian de opinión, pueden volver a responder/),
    ).toBeVisible();
  });
});

test.describe("the seat cap", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    // Five named people, and therefore five seats: since migration 0012 the cap
    // IS the household's membership, so an over-cap selection is not refused —
    // it is unrepresentable, because the form offers exactly one box per member
    // and nothing else.
    invitation = await seedInvitation({
      greetingName: "Familia Restrepo",
      displayName: "Familia Restrepo",
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

  test("offers no way to select anybody this invitation does not name", async ({
    page,
  }) => {
    await unlock(page, invitation);

    await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
    await attendeeBox(page, GUEST_ONE).check();
    await attendeeBox(page, GUEST_TWO).check();
    await attendeeBox(page, GUEST_THREE).check();
    await attendeeBox(page, "Luis Restrepo").check();
    await attendeeBox(page, "Ana Restrepo").check();

    await expect(page.getByText("Ya seleccionaron las 5.")).toBeVisible();
    // Exactly one box per member and no more, so there is no sixth choice to
    // refuse in the first place.
    await expect(page.locator('input[name="attendee"]')).toHaveCount(5);
    // And no affordance anywhere for asking for more.
    await expect(page.getByRole("spinbutton")).toHaveCount(0);

    // Nor a message box. The guest reached this page from their own WhatsApp
    // thread with the couple, so a free-text field here competes with the chat
    // they are already in — and loses. `dietary_notes` stays, because that is
    // operational data the catering needs rather than a message.
    await expect(page.getByLabel(/Mensaje/i)).toHaveCount(0);
    await expect(page.locator('[name="message"]')).toHaveCount(0);
    await expect(page.getByLabel(/Restricciones alimentarias/)).toBeVisible();
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
  /*
    THE CLOSED SURFACE CANNOT BE REACHED FROM A BROWSER TEST ANY MORE, AND THAT
    IS A REAL LOSS, RECORDED RATHER THAN HIDDEN.

    This test seeded a household with `rsvpDeadline: "2020-01-01"` and asserted
    the page showed "Ya cerramos las confirmaciones" and no form. There is one
    deadline for the whole wedding now — the couple asked for exactly that, so
    they would stop typing the same date into every invitation — and it is one
    week before a date in the future. No fixture can be past it, and the browser
    cannot help: the decision is made on the SERVER, from the server's own
    clock, so `page.clock` reaches nothing.

    What survives, and where: the closed surface itself is asserted in
    `components/invitation/RsvpClosed.spec.tsx` — the message, and that there is
    nothing to fill in and nothing to submit. The decision is asserted in
    `lib/domain/rsvp-deadline.spec.ts` and `lib/server/rsvp.spec.ts`, over
    explicit instants either side of the deadline, including the Bogota
    end-of-day boundary this project exists to get right.

    What is NOT covered any more is the wiring between them: that
    `app/i/[slug]/page.tsx` picks the closed branch. One `if`, reachable again
    the week of the wedding, and the honest thing is to say so here rather than
    leave a reader to notice the gap.
  */

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

      await decline(page);

      await expect(streamCard(page)).toBeVisible();
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
      await context.clearCookies();

      // The decline submits itself, so the throw-away happens FIRST. The action
      // must refuse — the cookie IS the authorization, and it is checked
      // against this invitation on every write, not only at render.
      await decline(page);

      await expect(rsvpAlert(page)).toContainText(
        "Tu sesión ya no está activa.",
      );
      // A refusal keeps the form. Swapping in the stream card would tell a
      // household they are expected on a call while the couple's list still has
      // them as unanswered.
      await expect(streamCard(page)).toHaveCount(0);
      await expect(invitation.responseHistory()).resolves.toHaveLength(0);
    } finally {
      await invitation.cleanup();
    }
  });
});
