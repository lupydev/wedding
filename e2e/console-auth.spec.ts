import { expect, test, type Page } from "@playwright/test";

import {
  seedAuthOnlyAccount,
  seedOperator,
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
 * Everything asserted here lives inside an async Server Component, a Server
 * Action or the proxy, which Vitest cannot reach. The cookie-rotation half of
 * this work unit is asserted separately and far more precisely in
 * `supabase/tests/operator-session-refresh.spec.ts`; what this file proves is
 * that the whole chain — form, credentials, allowlist, binding, protected
 * render — actually connects, and that every way of failing it looks the same
 * from a browser.
 */

let operator: SeededOperator;

test.beforeAll(async () => {
  operator = await seedOperator({ displayName: "Ana Operadora" });
});

test.afterAll(async () => {
  await operator.cleanup();
});

/** Submits the sign-in form once and reports everything a visitor can observe. */
async function attemptSignIn(
  page: Page,
  email: string,
  password: string,
): Promise<{ notice: string; url: string; sessionCookies: number }> {
  await page.context().clearCookies();
  await page.goto("/console/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  const notice = await page.getByRole("status").innerText({ timeout: 10_000 });
  const cookies = await page.context().cookies();

  return {
    notice,
    url: new URL(page.url()).pathname,
    sessionCookies: cookies.filter((cookie) =>
      SESSION_COOKIE_PATTERN.test(cookie.name),
    ).length,
  };
}

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

  test("the magic-link callback route is gone, not merely unused", async ({
    request,
  }) => {
    // Deleted with the flow it served. An unreachable auth route left behind in
    // a codebase is a route nobody maintains and everybody assumes is safe.
    const response = await request.get("/console/auth/callback?code=anything", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(404);
  });
});

test.describe("password sign-in", () => {
  test("the three ways of failing are indistinguishable from one another", async ({
    page,
  }) => {
    // Its own operator row, so this test never competes with the sign-in test
    // for one `auth_user_id`.
    const other = await seedOperator({ displayName: "Beto Operador" });
    // Somebody with a perfectly valid Supabase account who is not an operator.
    // Their credentials really do authenticate; the product must still refuse
    // them, in the same words and with as little session as anyone else.
    const stranger = await seedAuthOnlyAccount();

    try {
      const wrongPassword = await attemptSignIn(
        page,
        other.allowlistedEmail,
        "not-the-password",
      );
      const validCredentialsNotAnOperator = await attemptSignIn(
        page,
        stranger.email,
        stranger.password,
      );
      const noAccountAtAll = await attemptSignIn(
        page,
        `nobody.${Date.now()}@example.test`,
        "whatever-they-typed",
      );

      // Compared against one another, not against a literal: a literal would
      // still pass if all three sentences changed together and one of them
      // started leaking.
      expect(validCredentialsNotAnOperator).toEqual(wrongPassword);
      expect(noAccountAtAll).toEqual(wrongPassword);

      // And what they are equal TO matters: still on the login page, no
      // session, and a notice that says something.
      expect(wrongPassword.url).toBe("/console/login");
      expect(wrongPassword.sessionCookies).toBe(0);
      expect(wrongPassword.notice.length).toBeGreaterThan(0);

      // The stranger's valid credentials created a session on the auth server
      // for a moment. It must not have survived the refusal.
      await page.goto("/console");
      await expect(page).toHaveURL(/\/console\/login$/);
    } finally {
      await stranger.cleanup();
      await other.cleanup();
    }
  });

  test("an allowlisted operator signs in, binds their identity and reaches the console", async ({
    page,
  }) => {
    expect(await operator.boundAuthUserId()).toBeNull();

    await page.goto("/console/login");
    await page.getByLabel("Correo electrónico").fill(operator.allowlistedEmail);
    await page.getByLabel("Contraseña").fill(operator.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

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

    // Nor does the password they just typed survive anywhere in the page.
    expect(await page.content()).not.toContain(operator.password);

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

  test("a refused sign-in leaves no session cookie behind", async ({
    page,
  }) => {
    const attempt = await attemptSignIn(
      page,
      operator.allowlistedEmail,
      "definitely-not-the-password",
    );

    expect(attempt.sessionCookies).toBe(0);

    await page.goto("/console");
    await expect(page).toHaveURL(/\/console\/login$/);
  });

  test("the login page offers no sign-up and no password reset", async ({
    page,
  }) => {
    // Two operators, created once by `scripts/seed-operators.ts`. A reset flow
    // would mail a capability over every guest's phone number to whoever
    // controls that mailbox today.
    await page.goto("/console/login");

    const text = (await page.textContent("main")) ?? "";

    // The stems are deliberately narrow. A looser `registr` would also match
    // "registrados" in the instruction above the form, which describes the
    // credentials rather than offering a way to create any.
    expect(text).not.toMatch(
      /crear cuenta|registrarse|reg[íi]strese|olvid|restablec|recuperar la contrase/i,
    );
    expect(await page.getByRole("button").count()).toBe(1);
    // One way in, and no link out of it. The only exit is signing in.
    expect(await page.getByRole("link").count()).toBe(0);
  });
});
