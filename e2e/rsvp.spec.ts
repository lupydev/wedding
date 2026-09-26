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
  return page.getByRole("radio", { name: /No podemos acompañarlos/ }).check();
}

function accept(page: Page) {
  return page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
}

function streamCard(page: Page) {
  /*
    BY TEST HOOK, NOT BY A NAMED GROUP.

    It WAS a `dl role="group"` called "Detalles de la transmisión", because it
    held a meeting id and a passcode with their labels. It holds one link now,
    which carries its own accessible name and needs no grouping.
  */
  return page.getByTestId("stream-details");
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
    // Everybody starts checked, so two seats means UNCHECKING the third. The
    // property under test is unchanged: the count is derived from the names,
    // never typed.
    await attendeeBox(page, GUEST_THREE).uncheck();
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
    /*
      NULL, BECAUSE THERE IS NOTHING LEFT TO TYPE.

      The dietary field was removed on the couple's instruction. The COLUMN
      stays: `formData.get` yields null for a field the form no longer has, the
      payload schema accepts that, and the row records it as null. Asserted
      rather than dropped, so a field quietly reappearing — or the column
      starting to store the empty string instead — is reported here.
    */
    expect(history[0].dietaryNotes).toBeNull();
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
      page.getByRole("radio", { name: /No podemos acompañarlos/ }),
    ).not.toBeChecked();

    await accept(page);
    /*
      ONE SEAT, SO THE OTHER TWO COME OFF.

      Reconsidering opens with the whole household coming. A recorded decline
      names NOBODY — it confirms zero seats by construction — so seeding the
      boxes from it used to leave them empty, which is the friction this default
      removes in exactly the case where somebody is changing their mind.
    */
    /*
      ASSERTED POSITIVELY, BEFORE ANYTHING IS TOUCHED.

      `uncheck()` is satisfied by the state it wants, so on a box that is
      already off it is a silent no-op. Left to the two calls below, a default
      that regressed to empty would pass both of them and fail only later and
      indirectly, through the seat count — which is the shape of a test that
      cannot say what broke.
    */
    for (const guest of [GUEST_ONE, GUEST_TWO, GUEST_THREE]) {
      await expect(attendeeBox(page, guest)).toBeChecked();
    }

    await attendeeBox(page, GUEST_TWO).uncheck();
    await attendeeBox(page, GUEST_THREE).uncheck();
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

    /*
      THE WAY IN, AND DELIBERATELY NOT THE DAY OR THE HOUR.

      The block sits inside the invitation, under an announcement that names
      the day and counts down to it and a details list that states it again: a
      third statement is noise, not reassurance.

      The address is not printed either, since the couple removed it once this
      control existed. Where the control POINTS is the assertion — and it is
      the stronger one, because a button labelled correctly and aimed at the
      wrong address would have passed a text check.
    */
    /*
      WHAT THE BLOCK SHOWS FOR THE ROW AS IT STANDS, WHICH IS THE SEEDED
      MARKER.

      This asserted the address as TEXT and passed for a reason that was not
      about the product: the seeded value is an unfinished marker, and the
      marker was printed. It never exercised a real address at all.

      Nothing here sets one, deliberately — the comment above this describe
      block explains that this file does not touch the singleton. The real
      address IS exercised, in the two places that can: `StreamDetails.spec.tsx`
      renders a joinable value directly, and `console-wedding.spec.ts` edits the
      row and then reads the control's `href` from a guest's page.
    */
    /*
      EITHER FORM, BECAUSE THIS FILE DOES NOT OWN THE ROW.

      The block shows the address as a CONTROL when the row holds a real one and
      as TEXT while it still holds the seeded marker. This test asserted the text
      form only, which made it pass or fail on whether somebody had filled the
      row in — and an aborted `wedding-facts` run, which edits that row, is
      enough to leave a real address behind.

      What is true either way: the way in is on the card, carrying the value the
      row holds.
    */
    const joinable = ceremony.streamUrl.startsWith("https://");

    if (joinable) {
      await expect(
        card.getByRole("link", { name: /Entrar a la transmisión/ }),
      ).toHaveAttribute("href", ceremony.streamUrl);
    } else {
      await expect(card).toContainText(ceremony.streamUrl);
    }
    /*
      AND NOTHING ON THE CARD IS A LABELLED DATE OR HOUR.

      This used to compare against `ceremony.ceremonyTime`, read from the row.
      Migration 0018 dropped that column: nothing rendered it, and the day a
      guest reads comes from `WEDDING_INSTANT` through the announcement above.
      `Fecha` and `Hora` were the only `<dt>`/`<dd>` pair this card ever had, so
      a `term` appearing inside it again is the repetition coming back.
    */
    await expect(card.getByRole("term")).toHaveCount(0);
    await expect(card.getByRole("definition")).toHaveCount(0);

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
    // they are already in — and loses.
    //
    // NOR ANY OTHER BOX TO TYPE IN. The dietary field was the last one, and the
    // couple removed it; asserting no textbox at all is stronger than naming
    // the two that used to be absent.
    await expect(page.getByLabel(/Mensaje/i)).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    /*
      AND NOT AS A HIDDEN FIELD EITHER.

      `getByRole("textbox")` covers what a guest can see and type into, and the
      named-field check was dropped when it replaced it — but a `message` field
      smuggled in as `type="hidden"` has no role and would have passed. It is
      the shape a free-text field would most plausibly come back in.
    */
    await expect(page.locator('[name="message"]')).toHaveCount(0);
    await expect(page.locator('[name="dietaryNotes"]')).toHaveCount(0);
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
      /*
        ROOM IS MADE FIRST, AND THAT IS WHAT KEEPS THIS TEST ABOUT OWNERSHIP.

        A fresh answer now opens with every member checked, so appending a
        stranger would put the payload OVER the household's allowance — and the
        seat cap would refuse it before ownership was ever considered, with a
        different message. Unchecking one member leaves a payload that is
        well-formed and within the cap, and still names somebody this
        invitation does not.
      */
      await attendeeBox(page, GUEST_THREE).uncheck();
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

  /*
    AND NOW THE OTHER TWO PREMISES ARE GONE TOO, FOR THE SAME REASON.

    This block held two more tests: one seeding a household whose deadline was
    TODAY, and one seeding a household with NO deadline. Migration 0016 dropped
    `invitations.rsvp_deadline`, so neither state can be constructed any more —
    an invitation cannot carry its own date, and it cannot lack one either. The
    wedding has exactly one deadline and every invitation reads it.

    The Bogota end-of-day rule those tests were really about is asserted over
    explicit instants either side of the boundary in
    `lib/domain/rsvp-deadline.spec.ts` and `lib/server/rsvp.spec.ts`, which is
    where a clock can actually be controlled.

    What is left here is the one thing only a browser proves: that
    `app/i/[slug]/page.tsx` reads that constant and takes the OPEN branch. The
    closed branch stays unreachable from this suite — the decision is made on
    the server, from the server's own clock, so `page.clock` reaches nothing.
  */
  test("accepts an answer while the wedding's deadline is still ahead", async ({
    page,
  }) => {
    const invitation = await household();

    try {
      await unlock(page, invitation);

      await expect(page.locator("form.rsvp__form")).toBeVisible();
      await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();
      // One seat, so the other two come off: a fresh answer opens with the whole
      // household coming.
      await attendeeBox(page, GUEST_TWO).uncheck();
      await attendeeBox(page, GUEST_THREE).uncheck();
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

/**
 * THE INVITATION STANDS ON THE SAME STAGE AS THE LANDING.
 *
 * The couple: "podemos seguir manejando el mismo estilo de la landing pero
 * utilicemos ahora la imagen de la boda dentro de img."
 *
 * `/` and `/transmision` already share `PhotoStage` — the dark ground, the
 * blurred backdrop, the framed print. This is the third page to stand on it,
 * and the first with a different photograph, which is what made the stage take
 * one as a parameter rather than contain it.
 */
test.describe("the invitation's own stage", () => {
  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation.cleanup();
  });

  test("shows the wedding photograph, framed", async ({ page }) => {
    await unlock(page, invitation);

    const print = page.locator("figure.photo-stage__frame img").first();

    await expect(print).toBeVisible();
    // Through the optimizer, so the query string is what carries the file.
    await expect(print).toHaveAttribute("src", /boda/);
  });

  /**
   * AND THE FRAME IS SHAPED BY THE FILE, NOT BY A LITERAL.
   *
   * 1800×2400. A frame drawn at the engagement photograph's 737×1600 would not
   * fail loudly — it would crop this picture to fit and look deliberate, with
   * the two people cut off at the sides.
   *
   * A SINGLE DECIMAL, NOT `1800 / 2400`, and the difference is load-bearing.
   * The same number caps the frame's width inside a `calc()` — `min(100%,
   * 86dvh × ratio)` — and a fraction cannot be multiplied there. It used to be
   * the fraction, back when the height was the given and the ratio only ever
   * reached `aspect-ratio`.
   */
  test("frames it at its own shape", async ({ page }) => {
    await unlock(page, invitation);

    await expect(page.locator("figure.photo-stage__frame")).toHaveCSS(
      "--photo-stage-ratio",
      "0.75",
    );
  });

  /**
   * THE WORDS ARE ON THE DARK GROUND, NOT ON A PAGE OF THEIR OWN.
   *
   * The stage paints `#0d1114` behind everything — its own comment calls a
   * white flash "the only visible failure" on a page this dark. If the
   * invitation rendered outside it, this would come back white.
   */
  test("stands on the dark ground the landing uses", async ({ page }) => {
    await unlock(page, invitation);

    await expect(page.locator("main.photo-stage")).toHaveCSS(
      "background-color",
      "rgb(13, 17, 20)",
    );
  });
});

/**
 * ON A LAPTOP THE PHOTOGRAPH STAYS WITH THE READER.
 *
 * The couple: "hay que organizar el ui para que no colapsen y se vea feo en
 * desktop en ambas pantallas de la invitación."
 *
 * What was ugly was measurable. On a 760px-tall window the invitation is about
 * 1190px long, and the grid centred a 86dvh print inside that taller row — so
 * the picture floated in the middle with roughly 270px of black above and
 * below it, and on arrival a guest saw the top of the words and only the top
 * third of the photograph. The two people in it were below the fold on the one
 * page that is about them.
 *
 * The print sticks now. It cannot simply be `position: sticky`: the stage's
 * `main` carried `overflow-hidden` to clip the scaled backdrop, and an
 * `overflow` ancestor makes a sticky element stick to a container that does not
 * scroll — which is to say, to nothing. The clip moved onto the backdrop, which
 * is the only thing that ever needed it.
 */
test.describe("the invitation on a laptop", () => {
  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation.cleanup();
  });

  test("keeps the photograph in view while the form is read", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 760 });
    await unlock(page, invitation);

    const print = page.locator("figure.photo-stage__frame");
    const viewport = page.viewportSize()!;

    /*
      ACCEPTED FIRST, WHICH IS ALSO THE FORM AT ITS LONGEST.

      The question opens the rest of the form now, so the submit button does
      not exist until somebody answers it — and this test wants the far end of
      the longest version, which is the one with the attendee list on screen.
    */
    await page.getByRole("radio", { name: /Sí, allá estaremos/ }).check();

    // Down to the submit button, which is the far end of the form.
    await page
      .getByRole("button", { name: "Enviar respuesta" })
      .scrollIntoViewIfNeeded();

    const box = await print.boundingBox();

    expect(box).not.toBeNull();
    // Still on screen: its top is above the fold and its bottom below the top.
    expect(box!.y).toBeLessThan(viewport.height);
    expect(box!.y + box!.height).toBeGreaterThan(0);
    // And most of it is visible, not a sliver.
    const visible =
      Math.min(box!.y + box!.height, viewport.height) - Math.max(box!.y, 0);
    expect(visible).toBeGreaterThan(viewport.height * 0.7);
  });
});

/**
 * THE WAY TO A VENUE THAT HAS NO STREET ADDRESS, ON THE DEVICE IT IS READ ON.
 *
 * "Salón para Eventos Villa Campestre" has no address to print. `Dirección`
 * carries whatever the couple put in the row; the MAP is the only thing on this
 * page a guest can actually navigate by, and the link under it is the only way
 * to turn it into a route.
 *
 * ON A PHONE, BECAUSE THAT IS WHERE IT ARRIVES. Invitations go out over
 * WhatsApp, so close to every guest opens this on a phone — and a link inside
 * an ordinary WhatsApp message opens in the phone's DEFAULT BROWSER rather than
 * an in-app one, so this really is the mobile browser and really does have a
 * Google Maps application behind it.
 *
 * 360px RATHER THAN THE 390 `console-design.spec.ts` USES. That file measures
 * the console on the couple's own phone; this measures the narrowest screen an
 * invitation still has to survive, which is where a full-width committed image
 * overflows first. The assertion is on the DOCUMENT, not on the block: an image
 * that pushes the page wider is felt as the whole invitation sliding sideways
 * under the thumb, not as one element sticking out.
 */
test.describe("the way to the venue, on a phone", () => {
  /** Rendered by `next/image`, so the file is carried in the query string. */
  const MAP_SOURCE = /venue-map/;

  /**
   * Written out by hand, not read back off the page.
   *
   * `dir/?api=1` is the directions form — the couple asked for a button "con
   * las indicaciones ya listas", so the guest lands on a route rather than on a
   * card they have to press again. A test that read the href and then asserted
   * it looked like a URL would pass with the pin anywhere on earth.
   */
  const DIRECTIONS_URL =
    "https://www.google.com/maps/dir/?api=1&destination=3.853778%2C-76.2971633";

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation.cleanup();
  });

  test("appears only after the household accepts, and fits the screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await unlock(page, invitation);

    const directions = page.getByRole("link", { name: /Cómo llegar/ });

    // The venue is behind the answer, and the map is the venue. A household
    // that has not said yes must not be shown where to go.
    await expect(directions).toHaveCount(0);

    await accept(page);

    await expect(directions).toBeVisible();
    await expect(directions).toHaveAttribute("href", DIRECTIONS_URL);
    await expect(directions).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.locator("a.rsvp__venue-map img")).toHaveAttribute(
      "src",
      MAP_SOURCE,
    );

    /*
      THE TAP TARGET, MEASURED RATHER THAN ASSUMED.

      The whole picture is the link, so its height is never in doubt; what can
      quietly fall under the thumb is the "Cómo llegar" bar that makes the
      picture read as a control at all. 44px is the smallest target a phone
      should offer.
    */
    const affordance = await page
      .locator(".rsvp__venue-map__affordance")
      .boundingBox();

    expect(affordance).not.toBeNull();
    expect(affordance!.height).toBeGreaterThanOrEqual(44);

    // Scrolled to, because an element below the fold can overflow a page that
    // measures clean while it is still off screen.
    await directions.scrollIntoViewIfNeeded();

    const measured = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth);
  });
});
