import { expect, test } from "@playwright/test";

import {
  messagesFor,
  seedOperator,
  waitForMagicLink,
  type SeededOperator,
} from "./helpers/operator";

/**
 * The session cookie, and only the session cookie.
 *
 * A substring match on "auth-token" would also catch the PKCE code-verifier
 * cookies (`sb-<ref>-auth-token-...-code-verifier`), which a pending sign-in
 * legitimately sets and which carry no session at all.
 */
const SESSION_COOKIE_PATTERN = /^sb-.*-auth-token(\.\d+)?$/;

/**
 * Console authentication, end to end.
 *
 * Everything asserted here lives inside an async Server Component, a Route
 * Handler or the proxy, which Vitest cannot reach. The cookie-rotation
 * half of this work unit is asserted separately and far more precisely in
 * `supabase/tests/operator-session-refresh.spec.ts`; what this file proves is
 * that the whole chain — form, allowlist, mail, exchange, binding, protected
 * render — actually connects.
 */

let operator: SeededOperator;

test.beforeAll(async () => {
  operator = await seedOperator({ displayName: "Ana Operadora" });
});

test.afterAll(async () => {
  await operator.cleanup();
});

test.describe("console access control", () => {
  test("an anonymous visitor cannot reach the console", async ({ page }) => {
    await page.goto("/console");

    await expect(page).toHaveURL(/\/console\/login$/);
    await expect(
      page.getByRole("heading", { name: "Panel de envíos" }),
    ).toBeVisible();
    await expect(page.getByText("Tus invitaciones")).toHaveCount(0);
  });

  test("an anonymous request for the console renders no console content", async ({
    request,
  }) => {
    // The raw response, before any client navigation: a redirect that only
    // happens in the browser would still have shipped the page.
    const response = await request.get("/console", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/console/login");
    expect(await response.text()).not.toContain("Tus invitaciones");
  });

  test("a nested console route is protected too", async ({ page }) => {
    await page.goto("/console/dispatch/whatever");

    await expect(page).toHaveURL(/\/console\/login$/);
  });
});

test.describe("magic-link sign-in", () => {
  test("an address that is not an operator is indistinguishable from one that is", async ({
    page,
  }) => {
    // Its own operator row, so this test never competes with the sign-in test
    // for one mailbox or one `auth_user_id`.
    const other = await seedOperator({ displayName: "Beto Operador" });
    const stranger = `stranger.${Date.now()}@example.test`;

    try {
      await page.goto("/console/login");
      await page.getByLabel("Correo electrónico").fill(stranger);
      await page
        .getByRole("button", { name: "Enviar enlace de acceso" })
        .click();

      const strangerNotice = await page
        .getByRole("status")
        .innerText({ timeout: 10_000 });
      expect(strangerNotice.length).toBeGreaterThan(0);

      // The same form, with a real operator address, says exactly the same
      // thing. A different sentence here would answer "who can see every
      // guest's phone number?" for anyone with a browser.
      await page.goto("/console/login");
      await page.getByLabel("Correo electrónico").fill(other.allowlistedEmail);
      await page
        .getByRole("button", { name: "Enviar enlace de acceso" })
        .click();

      const operatorNotice = await page
        .getByRole("status")
        .innerText({ timeout: 10_000 });
      expect(operatorNotice).toBe(strangerNotice);

      // Waiting for the operator's mail first is what makes the next assertion
      // mean something: it proves delivery is working and that enough time has
      // passed for a message to the stranger to have shown up too.
      await waitForMagicLink(other.allowlistedEmail);
      expect(await messagesFor(stranger)).toHaveLength(0);

      // Identical answer, and no session either way.
      const cookies = await page.context().cookies();
      expect(
        cookies.filter((c) => SESSION_COOKIE_PATTERN.test(c.name)),
      ).toHaveLength(0);
    } finally {
      await other.cleanup();
    }
  });

  test("an allowlisted operator signs in, binds their identity and reaches the console", async ({
    page,
  }) => {
    expect(await operator.boundAuthUserId()).toBeNull();

    await page.goto("/console/login");
    await page.getByLabel("Correo electrónico").fill(operator.allowlistedEmail);
    await page.getByRole("button", { name: "Enviar enlace de acceso" }).click();
    await expect(page.getByRole("status")).toBeVisible({ timeout: 10_000 });

    const magicLink = await waitForMagicLink(operator.allowlistedEmail);
    await page.goto(magicLink);

    // The session works, and the FIRST thing it meets is the per-device
    // question: which WhatsApp account is installed on this handset. Being
    // signed in does not answer it — `wa.me` has no sender parameter, so the
    // sending account is a property of the phone and not of the session.
    await expect(page).toHaveURL(/\/console\/device$/);
    await expect(
      page.getByText(`Sesión iniciada como ${operator.displayName}`),
    ).toBeVisible();

    await page.getByLabel(operator.displayName).check();
    await page
      .getByRole("button", {
        name: /Guardar la declaración de este dispositivo/i,
      })
      .click();

    await expect(page).toHaveURL(/\/console$/);
    await expect(
      page.getByRole("heading", { name: "Tus invitaciones" }),
    ).toBeVisible();

    // The binding the spec demands: exactly one `senders.auth_user_id`, written
    // on the first allowlisted sign-in and not before.
    const bound = await operator.boundAuthUserId();
    expect(bound).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // The operator's own WhatsApp contact is server-side data. It has no reason
    // to be in a console page and would be a phone number in page source.
    expect(await page.content()).not.toContain(
      operator.contactPhone.replace("+", ""),
    );

    // The session survives an ordinary reload rather than depending on the
    // redirect that created it. So does the device declaration.
    await page.reload();
    await expect(page).toHaveURL(/\/console$/);
    await expect(
      page.getByRole("heading", { name: "Tus invitaciones" }),
    ).toBeVisible();

    // And signing out actually revokes it.
    await page.getByRole("link", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/console\/login$/);

    await page.goto("/console");
    await expect(page).toHaveURL(/\/console\/login$/);
  });

  test("a tampered magic-link code creates no session", async ({ page }) => {
    await page.goto(
      "/console/auth/callback?code=not-a-real-authorization-code",
    );

    await expect(page).toHaveURL(/\/console\/login$/);
    const cookies = await page.context().cookies();
    expect(
      cookies.filter((c) => SESSION_COOKIE_PATTERN.test(c.name)),
    ).toHaveLength(0);
  });
});
