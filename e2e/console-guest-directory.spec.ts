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
 * The directory of people, driven through a browser.
 *
 * The couple's words were "no veo la lista de invitados por ninguna parte", and
 * they were right twice over: nothing in the navigation pointed at such a list,
 * and nothing could have been behind it either — `invitation_guests.invitation_id`
 * was `not null` until migration 0015, so a guest could not exist before the
 * household holding them.
 *
 * The page is an async Server Component, which Vitest cannot render, so this
 * file is where the WIRING is proved: that the tab reaches it, that a guest
 * written here survives a reload, that correcting a name does not move anybody
 * out of their household, and that deleting somebody leaves their invitation
 * standing. Every decision under those is unit-tested in
 * `lib/domain/guest-directory.spec.ts`, `lib/server/guest-directory.spec.ts`
 * and `components/console/GuestDirectory.spec.tsx`.
 *
 * Serial, with ONE browser context, for the reason every console file here is:
 * signing in is a real round trip and doing it per test makes the suite slow
 * enough that somebody deletes it.
 */

test.describe.configure({ mode: "serial" });

/** Unique per run: this database is shared with every other spec file. */
let run: string;
let ana: SeededOperator;
let household: ConsoleInvitationSeed;
let page: Page;

/** Names invented by this file, suffixed so nothing else can hold them. */
let looseName: string;
let placedName: string;

test.beforeAll(async ({ browser }) => {
  run = randomBytes(3).toString("hex");
  ana = await seedOperator({ displayName: `Ana Directorio ${run}` });
  placedName = `Puesta Directorio ${run}`;
  looseName = `Suelta Directorio ${run}`;

  household = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: `Familia Directorio ${run}`,
    guests: [{ fullName: placedName, phoneE164: "+573005557001" }],
  });

  page = await browser.newPage();
  await signInAsOperator(page, ana);
  // Every route under `(authenticated)` is behind the declaration gate, which
  // the LAYOUT applies — an undeclared handset is sent to the picker before any
  // page renders. Declaring once is what a real operator does on their phone.
  await declareDevice(page, ana.displayName);
});

test.afterAll(async () => {
  await page.close();
  await household.cleanup();
});

/**
 * One person's row.
 *
 * BY ATTRIBUTE AND NOT BY TEXT. Opening the editor moves the name out of the
 * row's text content and into an input's value, so a `hasText` filter finds
 * nothing at precisely the moment a test is editing that row.
 */
const rowFor = (fullName: string) =>
  page.locator(`li.guest-directory__row[data-guest-name="${fullName}"]`);

test.describe("the guest directory", () => {
  test("is one tab away from the invitations screen", async () => {
    await page.goto("/console");

    // `.first()`, because the bar renders twice — once as a sidebar and once as
    // the bottom tabs — with CSS deciding which is on screen.
    await page.getByRole("link", { name: "Invitados" }).first().click();

    await expect(page).toHaveURL(/\/console\/guests$/);
    await expect(
      page.getByRole("heading", { name: "Invitados" }),
    ).toBeVisible();
  });

  /**
   * THE HOUSEHOLD IS NAMED ON THE PERSON'S OWN ROW.
   *
   * This is the couple's rule made legible: "cuando un invitado pertenece a una
   * invitación no debe poder pertenecer a otra". The database makes it
   * unrepresentable, and a reader cannot see a constraint — they can see that
   * this person is already in that family.
   */
  test("says which invitation already holds somebody", async () => {
    await expect(rowFor(placedName)).toContainText(`Familia Directorio ${run}`);
  });

  test("writes down a person who belongs to nobody yet", async () => {
    await page.getByLabel("Nombre completo").fill(looseName);
    await page.getByLabel("Teléfono").fill("300 555 7002");
    await page.getByRole("button", { name: "Agregar invitado" }).click();

    await expect(rowFor(looseName)).toBeVisible();
    await expect(rowFor(looseName)).toContainText(/Sin invitación/i);
    // Typed with spaces, stored in E.164 — the same strict normalisation the
    // importer uses, so this screen cannot become a second way in for a
    // badly-shaped number.
    await expect(rowFor(looseName)).toContainText("+573005557002");
  });

  test("keeps them after a reload, which is what proves it was written", async () => {
    await page.reload();

    await expect(rowFor(looseName)).toBeVisible();
  });

  /**
   * CORRECTING A NAME IS NOT A MOVE.
   *
   * The update deliberately does not carry `invitation_id`. If it did, fixing a
   * typo from this screen would empty a household as a side effect — and it
   * would do it silently, because nothing on this page mentions the invitation
   * being changed.
   */
  test("corrects a placed guest without taking them out of their household", async () => {
    const corrected = `Corregida Directorio ${run}`;

    await rowFor(placedName).getByRole("button", { name: "Editar" }).click();
    await rowFor(placedName).getByLabel("Nombre completo").fill(corrected);
    await rowFor(placedName).getByRole("button", { name: "Guardar" }).click();

    await expect(rowFor(corrected)).toBeVisible();
    await expect(rowFor(corrected)).toContainText(`Familia Directorio ${run}`);

    placedName = corrected;
  });

  test("asks before deleting, and names the person while asking", async () => {
    // Through the editor: deleting left the resting row, where it was one
    // mis-tap away on every one of forty people.
    await rowFor(looseName).getByRole("button", { name: "Editar" }).click();
    await rowFor(looseName).getByRole("button", { name: "Eliminar" }).click();

    await expect(rowFor(looseName)).toContainText(looseName);
    await expect(rowFor(looseName)).toContainText(/No se puede deshacer/i);
    // Still there: proposing is not doing.
    await expect(rowFor(looseName)).toBeVisible();
  });

  test("removes them once it is confirmed", async () => {
    await rowFor(looseName)
      .getByRole("button", { name: `Sí, eliminar a ${looseName}` })
      .click();

    await expect(rowFor(looseName)).toHaveCount(0);
  });

  /**
   * AND DELETING A PLACED GUEST LEAVES THEIR INVITATION STANDING.
   *
   * Refusing until they were removed from the household first would sound
   * safer and be worse — the operator would have to go to another screen to do
   * the thing they just asked for. What must not happen is the household
   * disappearing along with them.
   */
  test("deletes a placed guest and the invitation survives it", async () => {
    await rowFor(placedName).getByRole("button", { name: "Editar" }).click();
    await rowFor(placedName).getByRole("button", { name: "Eliminar" }).click();
    await rowFor(placedName)
      .getByRole("button", { name: `Sí, eliminar a ${placedName}` })
      .click();

    await expect(rowFor(placedName)).toHaveCount(0);

    await page.goto("/console");
    await expect(
      page.getByRole("heading", { name: `Familia Directorio ${run}` }),
    ).toBeVisible();
  });
});

/**
 * ASSEMBLING AN INVITATION OUT OF THE DIRECTORY.
 *
 * "La creación de invitaciones donde se pueda agregar un invitado" — and the
 * rule under it, "cuando un invitado pertenece a una invitación no debe poder
 * pertenecer a otra, no se debería poder escoger en una próxima invitación".
 *
 * This runs as its own serial block with its own fixtures, because it CHANGES
 * the state the block above reads: a guest picked here stops being free.
 */
test.describe("building an invitation from the directory", () => {
  let picked: string;

  test.beforeAll(async () => {
    picked = `Elegible Directorio ${run}`;
  });

  test.afterAll(async () => {
    // The invitation this block creates was made by the CONSOLE, so there is no
    // fixture handle for it: its id was minted on the server and the action
    // answered with a redirect. Deleting it releases the picked guest back into
    // the directory — and then the guest themselves, who was created here too.
    await page.goto("/console");
  });

  test("a person written in the directory is offered when creating an invitation", async () => {
    await page.goto("/console/guests");
    await page.getByLabel("Nombre completo").fill(picked);
    await page.getByRole("button", { name: "Agregar invitado" }).click();
    await expect(rowFor(picked)).toBeVisible();

    await page.goto("/console/invitations/new");

    await expect(
      page.getByRole("button", { name: `Agregar de la lista: ${picked}` }),
    ).toBeVisible();
  });

  test("picking them builds the household around them, without a second record", async () => {
    const household = `Familia Armada ${run}`;

    // NAMED BY HAND, because the console lists a household by its GREETING and
    // the greeting derives from its members — which here is the picked
    // person's own name. Writing it makes the row findable by the name this
    // test invented rather than by one the form computed.
    await page.getByLabel("Nombre del grupo").fill(household);
    await page
      .getByRole("button", { name: `Agregar de la lista: ${picked}` })
      .click();

    // She took the blank card rather than landing under it: picking her was
    // the first thing done on this form.
    await expect(page.locator("fieldset.invitation-form__member")).toHaveCount(
      1,
    );

    await page.getByRole("button", { name: "Guardar invitación" }).click();
    await expect(page).toHaveURL(/\/console$/);

    // ONE row for her on the invitation, not two: she was moved, not copied.
    const created = page
      .locator("li.guest-list__row")
      .filter({ hasText: household });

    await expect(created.getByText(picked, { exact: true })).toHaveCount(1);
    await expect(created.getByText("1 persona")).toBeVisible();
  });

  /**
   * AND THE DIRECTORY AGREES WITH THE INVITATION.
   *
   * One row, now naming a household — which is the couple's rule seen from the
   * other side, and the thing a second record with the same name would break
   * silently.
   */
  test("the directory now shows them inside that household, once", async () => {
    await page.goto("/console/guests");

    await expect(rowFor(picked)).toHaveCount(1);
    await expect(rowFor(picked)).toContainText(`Familia Armada ${run}`);
  });

  test("and stops offering them to the next invitation", async () => {
    await page.goto("/console/invitations/new");

    await expect(
      page.getByRole("button", { name: `Agregar de la lista: ${picked}` }),
    ).toHaveCount(0);
  });
});

/**
 * ADDING SOMEBODY TO AN INVITATION THAT ALREADY EXISTS.
 *
 * The other half of "la creación de invitaciones donde se pueda agregar un
 * invitado": a household saved last week taking one more person who is already
 * in the directory. A different write from creating — there is no submit
 * button for membership on the edit screen, every member change is its own
 * action — so the placement lands on the press.
 */
test.describe("adding a directory guest to a saved invitation", () => {
  let latecomer: string;
  let host: ConsoleInvitationSeed;

  test.beforeAll(async () => {
    latecomer = `Rezagada Directorio ${run}`;
    host = await seedConsoleInvitation({
      ownerSenderId: ana.senderId,
      greetingName: `Familia Anfitriona ${run}`,
      guests: [{ fullName: `Anfitriona ${run}`, phoneE164: "+573005557003" }],
    });
  });

  test.afterAll(async () => {
    await host.cleanup();
  });

  test("offers the free people on the edit screen", async () => {
    await page.goto("/console/guests");
    await page.getByLabel("Nombre completo").fill(latecomer);
    await page.getByRole("button", { name: "Agregar invitado" }).click();
    await expect(rowFor(latecomer)).toBeVisible();

    await page.goto(`/console/invitations/${host.invitationId}/edit`);

    await expect(
      page.getByRole("button", { name: `Agregar de la lista: ${latecomer}` }),
    ).toBeVisible();
  });

  test("takes them on the press, with nothing left to submit", async () => {
    await page
      .getByRole("button", { name: `Agregar de la lista: ${latecomer}` })
      .click();

    // The member card appears because the SERVER re-rendered this page, which
    // is what proves the write landed rather than a row having been drawn
    // optimistically.
    await expect(
      page
        .locator("fieldset.invitation-form__member")
        .filter({ has: page.locator(`input[value="${latecomer}"]`) }),
    ).toBeVisible();

    // And they are gone from the picker, because they are no longer free.
    await expect(
      page.getByRole("button", { name: `Agregar de la lista: ${latecomer}` }),
    ).toHaveCount(0);
  });

  test("the directory agrees, naming the household that took them", async () => {
    await page.goto("/console/guests");

    await expect(rowFor(latecomer)).toContainText(`Familia Anfitriona ${run}`);
  });
});

/**
 * SENDING FROM A PERSON'S ROW.
 *
 * "En los invitados debe existir un botón de envío de la invitación en caso tal
 * de que se quiera hacer de manera individual." It is a LINK to the dispatch
 * screen that already exists, not a second way to send: that screen composes
 * the message, applies the device gate and writes the audit event, and a
 * second path would carry its own copy of those guards to keep in step.
 */
test.describe("the send affordance on a guest's row", () => {
  let sendable: ConsoleInvitationSeed;
  let recipient: string;
  let other: string;

  test.beforeAll(async () => {
    recipient = `Destinataria Directorio ${run}`;
    other = `Acompañante Directorio ${run}`;
    sendable = await seedConsoleInvitation({
      ownerSenderId: ana.senderId,
      greetingName: `Familia Enviable ${run}`,
      guests: [
        { fullName: recipient, phoneE164: "+573005557004" },
        { fullName: other, phoneE164: "+573005557005" },
      ],
      recipient,
    });
  });

  test.afterAll(async () => {
    await sendable.cleanup();
  });

  test("points the chosen member's row at the dispatch screen", async () => {
    await page.goto("/console/guests");

    await expect(rowFor(recipient)).toContainText(/Recibe el mensaje/i);
    await expect(
      rowFor(recipient).getByRole("link", { name: /Enviar/ }),
    ).toHaveAttribute("href", `/console/dispatch/${sendable.invitationId}`);
  });

  /**
   * AND THE OTHER MEMBER'S ROW SAYS WHOSE MESSAGE IT IS.
   *
   * The button is there — the couple asked for it on the person's row — but
   * this list is alphabetical, so the member who actually receives the message
   * is nowhere nearby. Naming them is what stops the button doing something
   * other than what its row suggests.
   */
  test("names the real recipient on a row that is not theirs", async () => {
    await expect(rowFor(other)).toContainText(`le llega a ${recipient}`);
    await expect(
      rowFor(other).getByRole("link", { name: /Enviar/ }),
    ).toBeVisible();
  });

  test("the link actually opens that invitation's dispatch screen", async () => {
    await rowFor(recipient)
      .getByRole("link", { name: /Enviar/ })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/console/dispatch/${sendable.invitationId}$`),
    );
  });

  /**
   * NOTHING TO SEND FOR SOMEBODY IN NO INVITATION — there is no invitation, no
   * link and no message. The row already says "Sin invitación todavía", which
   * is the reason and does not need repeating beside a missing button.
   */
  test("offers nothing for a guest who is in no invitation", async () => {
    const loose = `Sin Envío Directorio ${run}`;

    await page.goto("/console/guests");
    await page.getByLabel("Nombre completo").fill(loose);
    await page.getByRole("button", { name: "Agregar invitado" }).click();

    await expect(rowFor(loose)).toContainText(/Sin invitación/i);
    await expect(
      rowFor(loose).getByRole("link", { name: /Enviar/ }),
    ).toHaveCount(0);
  });
});

/**
 * THE TWO THINGS THE COUPLE REPORTED, END TO END.
 *
 * "La lista de invitados está súper desorganizada, debe estar organizada por
 * fecha de creación DESC" and "le puse apodo, sin embargo en la creación de la
 * invitación no registró el apodo".
 *
 * The second was a reading failure, not a writing one — the nickname was
 * stored and the greeting derived from it all along — which is exactly why it
 * needs a browser test. Every layer below was already green while the one
 * screen they use showed nothing.
 */
test.describe("what the couple reported", () => {
  /*
    SCOPED TO THE ADD FORM, and it has to be: every row can open an editor
    carrying the same labels, so a bare `getByLabel("Apodo")` on a list of
    forty people is ambiguous by construction.
  */
  const addForm = () => page.locator("form.guest-directory__new");

  let first: string;
  let second: string;
  let household: string;

  test.beforeAll(() => {
    first = `Primera Reportada ${run}`;
    second = `Segunda Reportada ${run}`;
    household = `Familia Reportada ${run}`;
  });

  test("puts the person just added at the top of the list", async () => {
    await page.goto("/console/guests");

    await addForm().getByLabel("Nombre completo").fill(first);
    await page.getByRole("button", { name: "Agregar invitado" }).click();
    await expect(rowFor(first)).toBeVisible();

    await addForm().getByLabel("Nombre completo").fill(second);
    await addForm().getByLabel("Apodo").fill("Segui");
    await page.getByRole("button", { name: "Agregar invitado" }).click();

    // The NEWEST is row one. This is the whole point of the ordering: the
    // couple are typing forty people in a sitting, and the only question
    // between one entry and the next is "did that one land?".
    await expect(
      page.locator("li.guest-directory__row").first(),
    ).toHaveAttribute("data-guest-name", second);
  });

  test("shows the nickname on the directory row", async () => {
    await expect(rowFor(second)).toContainText("Segui");
  });

  /**
   * AND ON THE INVITATIONS SCREEN, WHICH IS WHERE IT WAS INVISIBLE.
   *
   * `CONSOLE_GUEST_COLUMNS` never selected the column, so no amount of typing
   * a nickname could make it appear here. That is the defect, and this is the
   * assertion that keeps it fixed.
   */
  test("shows it again on the invitation built from that person", async () => {
    await page.goto("/console/invitations/new");

    await page.getByLabel("Nombre del grupo").fill(household);
    await page
      .getByRole("button", { name: `Agregar de la lista: ${second}` })
      .click();
    await page.getByRole("button", { name: "Guardar invitación" }).click();
    await expect(page).toHaveURL(/\/console$/);

    const created = page
      .locator("li.guest-list__row")
      .filter({ hasText: household });

    await expect(created.getByText(second, { exact: true })).toBeVisible();
    await expect(created.getByText("(Segui)")).toBeVisible();
  });
});

/**
 * ONE PRESS, ONE PERSON, NO HOUSEHOLD TO BUILD FIRST.
 *
 * "Se le debe de poder mediante un botón o algo enviar la invitación individual
 * si se quiere al invitado sin necesidad de pertenecer a una invitación, estas
 * son para grupos familiares de 2 o más personas."
 */
test.describe("inviting a guest on their own", () => {
  let alone: string;

  test.beforeAll(() => {
    alone = `Prima Sola ${run}`;
  });

  test("mints their invitation and lands on the dispatch screen", async () => {
    await page.goto("/console/guests");
    await page
      .locator("form.guest-directory__new")
      .getByLabel("Nombre completo")
      .fill(alone);
    await page
      .locator("form.guest-directory__new")
      .getByLabel("Teléfono")
      .fill("300 555 7006");
    await page.getByRole("button", { name: "Agregar invitado" }).click();
    await expect(rowFor(alone)).toBeVisible();

    await rowFor(alone)
      .getByRole("button", { name: `Invitar por separado a ${alone}` })
      .click();

    // Straight to the send screen: there is nothing left to decide, because
    // the only member is necessarily the recipient.
    await expect(page).toHaveURL(/\/console\/dispatch\/[0-9a-f-]{36}$/);
  });

  /**
   * AND THE DIRECTORY AGREES: she is now in her own invitation, which is a
   * household like any other — the couple asked for two CRUDs, not three.
   */
  test("shows her inside the invitation that was just made for her", async () => {
    await page.goto("/console/guests");

    await expect(rowFor(alone)).toContainText(alone);
    await expect(rowFor(alone)).not.toContainText(/Sin invitación/i);
    // The offer is gone, because she is no longer in nobody's household.
    await expect(
      rowFor(alone).getByRole("button", {
        name: `Invitar por separado a ${alone}`,
      }),
    ).toHaveCount(0);
    // What she has instead is the ordinary send, because she IS the recipient.
    await expect(rowFor(alone)).toContainText(/Recibe el mensaje/i);
    await expect(
      rowFor(alone).getByRole("link", { name: /Enviar/ }),
    ).toBeVisible();
  });
});
