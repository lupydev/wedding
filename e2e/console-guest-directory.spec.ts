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
