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
 * The two irreversible things an operator can do to one invitation, and the one
 * thing neither of them can undo.
 *
 * WHY NONE OF THIS IS REACHABLE FROM VITEST
 *
 * `components/console/InvitationLifecycle.spec.tsx` already holds every decision
 * the component makes, against spied actions: which confirmation opens, what the
 * refusal reads, that the rotation copy promises nothing about a cached preview
 * card. What it cannot hold is the chain. The deletion refusal is decided by a
 * `dispatch_events` read and an `rsvp_latest` read inside a Server Action; the
 * rotation's consequences are decided by a `slug` column, by cookie path
 * scoping, and by a route that answers an unknown slug with a page rather than a
 * status. Four of those five are outside a rendered component, and the fifth —
 * the path scope — only means anything to a real browser.
 *
 * THE GUEST IS A SECOND CONTEXT, HOLDING A REAL UNLOCK
 *
 * The rotation requirement is that a guest who had ALREADY passed the phone gate
 * has to pass it again. Minting that cookie by hand would assert against a value
 * the product never issued and would say nothing about its path, which is the
 * whole mechanism: there is no revocation list, and there is deliberately not
 * going to be one. So the guest unlocks the old address through the real form,
 * in their own browser context, and keeps whatever that leaves behind.
 *
 * Serial, with one operator context and one guest context: every test needs the
 * same signed-in session and the same unlocked guest.
 *
 * Every phone number here is fabricated. A real guest number must never enter a
 * fixture, a spec, or a log.
 */

test.describe.configure({ mode: "serial" });

const GREETING = "Familia Ciclo Vélez";
const GUEST = "Ramiro Ciclo";
/** Fabricated, in a block no other fixture in this suite uses. */
const GUEST_PHONE = "+573005556001";
/** What the guest types at the gate: the last eight digits are what is compared. */
const GUEST_PHONE_TYPED = "3005556001";
/** A sentence only the unlocked body says. */
const GATED_TEXT = "Nos alegra mucho invitarlos";

let ana: SeededOperator;
let invitation: ConsoleInvitationSeed;
/** The operator's browser. Signed in, with a declared device. */
let page: Page;
/** The guest's browser. Holds the unlock cookie for the ORIGINAL address. */
let guest: Page;
/** The address the invitation was dispatched at. */
let oldSlug: string;
/** The address it lives at after the rotation. Filled in by the test that rotates. */
let newSlug: string | null = null;

/** Where the invitation is administered. Rotation does not move this URL. */
function editUrl(): string {
  return `/console/invitations/${invitation.invitationId}/edit`;
}

const lifecycle = () => page.getByTestId("invitation-lifecycle");
const notice = () => page.getByTestId("invitation-lifecycle-notice");

test.beforeAll(async ({ browser }) => {
  // Unique per run: the device picker labels its radios with the display name,
  // and a leftover operator from an aborted run would make that label ambiguous
  // — which looks exactly like the picker rendering the wrong thing.
  const run = randomBytes(3).toString("hex");
  ana = await seedOperator({ displayName: `Ana Ciclo ${run}` });

  invitation = await seedConsoleInvitation({
    ownerSenderId: ana.senderId,
    greetingName: GREETING,
    guests: [{ fullName: GUEST, phoneE164: GUEST_PHONE, isPrimary: true }],
    recipient: GUEST,
  });
  oldSlug = invitation.slug;

  // THE STATE THE WHOLE FILE IS ABOUT: the operator has said this one went out.
  // That single row is what makes deletion refuse and rotation the only exit,
  // and it is also what must SURVIVE the rotation.
  await invitation.recordEvent("marked_sent", ana.senderId);

  // The guest gets their own context, so the unlock cookie the gate issues is
  // stored with the path the product chose for it and nothing else.
  guest = await (await browser.newContext()).newPage();
  await guest.goto(`/i/${oldSlug}`);
  await guest.getByLabel(/Número de celular/).fill(GUEST_PHONE_TYPED);
  await guest.getByRole("button", { name: "Ver la invitación" }).click();
  await expect(guest.getByText(GATED_TEXT)).toBeVisible();

  page = await browser.newPage();
  await signInAsOperator(page, ana);
  await declareDevice(page, ana.displayName);
});

test.afterAll(async () => {
  await page?.close();
  await guest?.close();
  await invitation?.cleanup();
  await ana?.cleanup();
});

test.describe("deleting a dispatched invitation", () => {
  test("is refused, naming what it found and where the exit is", async () => {
    await page.goto(editUrl());

    // NOTHING IS PRE-DISABLED. The rule lives in `canDeleteInvitation`, which
    // refuses on the EXISTENCE of a dispatch row rather than on a list of known
    // kinds, and a greyed-out button here would be a second copy of it — free to
    // disagree, and the copy that is forgotten during a change is the one that
    // decides. So the attempt is made and the server's answer is shown.
    await lifecycle()
      .getByRole("button", { name: "Eliminar invitación" })
      .click();

    const confirmation = page.getByTestId("invitation-deletion-confirm");
    await expect(confirmation).toContainText(GREETING);
    await expect(confirmation).toContainText(/No se puede deshacer/i);

    await confirmation
      .getByRole("button", { name: `Sí, eliminar «${GREETING}»` })
      .click();

    await expect(notice()).toContainText(`No se puede eliminar «${GREETING}»`);
    // The kind it found, in the words the console already uses for it — not a
    // raw `marked_sent`, and not a refusal that names nothing.
    await expect(notice()).toContainText("Marcada como enviada");
    // And the exit, which is the reason this refusal is worth reading.
    await expect(notice()).toContainText("Rotar el enlace");
  });

  test("leaves the invitation and its household exactly where they were", async () => {
    // The refusal HELD. Without this, a notice rendered over a household that
    // had been deleted anyway would read identically.
    expect(await invitation.currentSlug()).toBe(oldSlug);
    expect(await invitation.dispatchEvents()).toHaveLength(1);

    await page.goto(editUrl());
    await expect(page.getByRole("heading", { name: GREETING })).toBeVisible();
    await expect(page.getByTestId("invitation-deleted")).toHaveCount(0);
  });
});

test.describe("rotating the slug instead", () => {
  /**
   * THE ASSERTION TASK 4b.18 EXISTS FOR.
   *
   * Meta caches one preview card per URL, on its own infrastructure, and nothing
   * in this product can reach into a chat history. So rotation must not be
   * described as removing or updating the card a guest already received — and it
   * must not go quiet about it either, because silence lets an operator assume
   * rotation un-sends the message. The copy names the limitation, and these
   * assertions hold it to that in both directions.
   */
  test("says what rotation does, and promises nothing about the delivered card", async () => {
    await page.goto(editUrl());
    await lifecycle().getByRole("button", { name: "Rotar el enlace" }).click();

    const confirmation = page.getByTestId("invitation-rotation-confirm");
    const copy = (await confirmation.innerText()).replace(/\s+/g, " ");

    // The three consequences, all of them real.
    expect(copy).toMatch(/dirección nueva/i);
    expect(copy).toMatch(/deja de llevar/i);
    expect(copy).toMatch(/volver a pasar el filtro/i);

    // The limitation, stated rather than skipped.
    expect(copy).toMatch(/vista previa/i);
    expect(copy).toMatch(/sigue ahí|tal cual/i);

    // And the promises it must never make about that card.
    expect(copy).not.toMatch(
      /se actualiza|se borra|se elimina|se reemplaza|desaparece/i,
    );
  });

  test("hands back the new address, because nothing else knows it", async () => {
    await page
      .getByTestId("invitation-rotation-confirm")
      .getByRole("button", { name: /Sí, rotar el enlace/i })
      .click();

    const announced = await page
      .getByTestId("invitation-rotated-link")
      .innerText();

    // The PUBLIC origin, resolved on the server: a browser cannot be trusted to
    // know the deployment's own public address, and this is the one string an
    // operator is about to paste into WhatsApp.
    expect(announced).toContain(`${E2E_SITE_ORIGIN}/i/`);
    // And it says the address has to be sent again, which is the work the
    // rotation just created.
    expect(announced).toMatch(/volver a enviarla/i);

    newSlug = /\/i\/([a-z2-7]+)/.exec(announced)?.[1] ?? null;
    expect(newSlug).not.toBeNull();
    expect(newSlug).not.toBe(oldSlug);

    // Announced AND stored. A page that reported a slug the server never wrote
    // would leave the operator sending a link to nothing.
    expect(await invitation.currentSlug()).toBe(newSlug);
  });
});

test.describe("what the rotation did to the two addresses", () => {
  test("the old address falls through to the friendly page, not a raw 404", async () => {
    // Requested by the GUEST, who still holds the unlock cookie for this exact
    // path — so this is the strongest form of the assertion: the cookie is sent
    // and there is no longer an invitation for it to unlock.
    const response = await guest.goto(`/i/${oldSlug}`);

    // A 404 reads as an accusation to somebody who only clicked a link they were
    // sent, and rotation is a routine operation in this product, not a failure.
    expect(response?.status()).toBe(200);
    await expect(
      guest.getByRole("heading", { name: "No encontramos esta invitación" }),
    ).toBeVisible();
    await expect(guest.getByText(/pídanle un nuevo enlace/i)).toBeVisible();

    // None of the invitation, and no hint that one ever lived here: a stranger
    // probing slugs must learn nothing from the difference.
    const rendered = await guest.content();
    expect(rendered).not.toContain(GATED_TEXT);
    expect(rendered).not.toContain(GUEST);
    expect(rendered).not.toContain("5556001");
  });

  test("the unlock cookie is stranded on a path that leads nowhere", async () => {
    const context = guest.context();
    const held = await context.cookies();

    // The browser still HOLDS it — nothing was revoked, because there is nothing
    // to revoke — and it is still scoped to the address it was unlocked from.
    const unlock = held.find((cookie) => cookie.name === "inv_unlock");
    expect(unlock?.path).toBe(`/i/${oldSlug}`);

    // Which is why it will never reach the new address: the path scope alone
    // accomplishes the invalidation, as a structural consequence rather than a
    // rule somebody has to remember to enforce.
    const sentToNew = await context.cookies(
      new URL(`/i/${newSlug}`, guest.url()).toString(),
    );
    expect(sentToNew.map((cookie) => cookie.name)).not.toContain("inv_unlock");
  });

  test("the new address asks the guest for their number again", async () => {
    const response = await guest.goto(`/i/${newSlug}`);

    expect(response?.status()).toBe(200);
    await expect(guest.getByLabel(/Número de celular/)).toBeVisible();

    const rendered = await guest.content();
    expect(rendered).not.toContain(GATED_TEXT);
    expect(rendered).not.toContain(GUEST);

    // And the gate still opens for the household it always belonged to: this is
    // the same invitation at a new address, not a new invitation.
    await guest.getByLabel(/Número de celular/).fill(GUEST_PHONE_TYPED);
    await guest.getByRole("button", { name: "Ver la invitación" }).click();
    await expect(guest.getByText(GATED_TEXT)).toBeVisible();
  });
});

test.describe("what the rotation did NOT do", () => {
  test("kept the dispatch history, so the deletion is still refused", async () => {
    // Rotation is a new address for the same invitation, not a new invitation.
    // Its history remains true regardless of which slug currently serves it —
    // and that is precisely why a rotated invitation is still undeletable.
    const events = await invitation.dispatchEvents();
    expect(events.map((event) => event.kind)).toEqual(["marked_sent"]);

    await page.goto(editUrl());
    await lifecycle()
      .getByRole("button", { name: "Eliminar invitación" })
      .click();
    await page
      .getByTestId("invitation-deletion-confirm")
      .getByRole("button", { name: `Sí, eliminar «${GREETING}»` })
      .click();

    await expect(notice()).toContainText(`No se puede eliminar «${GREETING}»`);
    await expect(notice()).toContainText("Marcada como enviada");
    expect(await invitation.currentSlug()).toBe(newSlug);
  });
});
