import { expect, test, type Browser, type Page } from "@playwright/test";

import { seedInvitation, type SeededInvitation } from "./helpers/seed";

/**
 * The phone gate, end to end.
 *
 * Vitest cannot render an async Server Component, and the gate's whole reason
 * for existing lives inside one: whether the body is reachable at all. So the
 * assertions that matter — a wrong number reveals nothing, no query parameter
 * bypasses anything, the lockout survives separate requests — are here.
 *
 * Every phone number below is fabricated. A real guest number must never enter
 * a fixture, a seed, or a log.
 */

const GREETING = "Familia Aguirre";
const GUEST_ONE = "Camila Aguirre Vélez";
const GUEST_TWO = "Rodrigo Aguirre Peña";
const CHILD = "Sara Aguirre";

const PHONE_ONE = "+573005551111";
const PHONE_TWO = "+573005552222";

/** Everything a household is only allowed to read AFTER the gate lets them in. */
const GATED_TEXT = ["lugares reservados", "Nos alegra mucho invitarlos"];

/** The single failure sentence the gate is allowed to produce. */
const GENERIC_FAILURE = "No pudimos confirmar ese número";

function household(
  overrides: Partial<Parameters<typeof seedInvitation>[0]> = {},
) {
  return seedInvitation({
    greetingName: GREETING,
    displayName: "Familia Aguirre",
    seatsAllowed: 3,
    guests: [
      { fullName: GUEST_ONE, phoneE164: PHONE_ONE },
      { fullName: GUEST_TWO, phoneE164: PHONE_TWO },
      { fullName: CHILD, isChild: true },
    ],
    ...overrides,
  });
}

async function submitPhone(page: Page, value: string) {
  await page.getByLabel(/Número de celular/).fill(value);
  await page.getByRole("button", { name: "Ver la invitación" }).click();
}

/**
 * The household's own guest list, inside the invitation body.
 *
 * Scoped, because since the RSVP shipped a guest's name appears TWICE on an
 * unlocked page: once in the list of who the invitation is for, and once as the
 * label of their RSVP checkbox. An unscoped query matches both, and Playwright's
 * strict mode is right to refuse it — "the name is somewhere on the page" would
 * be satisfied by the form alone, even if the body had stopped naming the
 * household at all, which is exactly what these tests are checking.
 */
function householdList(page: Page) {
  return page.locator("section.invitation__household");
}

/**
 * The gate's own feedback region.
 *
 * Scoped to the form because Next.js renders its own empty `role="alert"` route
 * announcer in every document, and an unscoped query matches both.
 */
function gateAlert(page: Page) {
  return page.locator("form").getByRole("alert");
}

/** The document without its scripts — what the guest actually sees rendered. */
function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

test.describe("unlocking with a guest's number", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("greets the household before it asks for anything", async ({ page }) => {
    await page.goto(`/i/${invitation.slug}`);

    // The promise the WhatsApp message made was "your invitation". Landing on a
    // bare number prompt breaks it at the exact moment the page demands
    // something, so the greeting comes first.
    await expect(
      page.getByRole("heading", { name: new RegExp(GREETING) }),
    ).toBeVisible();
    await expect(page.getByLabel(/Número de celular/)).toBeVisible();
  });

  test("shows none of the invitation body before a successful match", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);

    const rendered = withoutScripts(await page.content());

    for (const gated of [...GATED_TEXT, GUEST_ONE, GUEST_TWO, CHILD]) {
      expect(rendered).not.toContain(gated);
    }
  });

  test("unlocks with the last 8 digits of the SECOND guest's number", async ({
    page,
  }) => {
    // Any guest on the invitation, not only a primary contact: the household
    // link is opened by whoever has it in hand.
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "5552222");
    await expect(gateAlert(page)).toBeVisible();

    // Seven digits is not enough to compare, so that attempt is a rejection.
    await submitPhone(page, "3005552222");

    await expect(page.getByText("Nos alegra mucho invitarlos")).toBeVisible();
    await expect(householdList(page).getByText(GUEST_TWO)).toBeVisible();
  });

  test("unlocks a second household with its own first guest's number", async ({
    browser,
  }) => {
    const other = await seedInvitation({
      greetingName: "Familia Restrepo",
      guests: [{ fullName: "Elena Restrepo", phoneE164: "+573015553333" }],
    });
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await page.goto(`/i/${other.slug}`);
      await submitPhone(page, "+57 301 555 3333");

      await expect(
        householdList(page).getByText("Elena Restrepo"),
      ).toBeVisible();
    } finally {
      await context.close();
      await other.cleanup();
    }
  });
});

test.describe("a wrong number", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("is rejected on a one-digit near miss", async ({ page }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005551112");

    await expect(gateAlert(page)).toContainText(GENERIC_FAILURE);
    await expect(page.getByText("Nos alegra mucho invitarlos")).toHaveCount(0);
  });

  test("tells the guest how many attempts are left, not just 'try later'", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005559999");

    await expect(gateAlert(page)).toContainText(/Te quedan? \d+ intentos?\./);
  });

  test("leaks no guest name, no RSVP field and no stored digit into the response", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005558888");
    await expect(gateAlert(page)).toBeVisible();

    // The FULL document this time, scripts included: an inline RSC payload is
    // exactly where a stored digit would be smuggled by accident.
    const html = await page.content();

    for (const forbidden of [
      GUEST_ONE,
      GUEST_TWO,
      CHILD,
      // The E.164, the national number and the last 8 — the form the gate
      // actually stores and compares.
      PHONE_ONE,
      "573005551111",
      "3005551111",
      "05551111",
      PHONE_TWO,
      "05552222",
      // RSVP is work unit 5, but the gate must never render it early either.
      "dietary",
      "Confirmen su asistencia",
      "restricciones",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("never names a reason, so the link cannot be used as a number checker", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005557777");

    const alert = await gateAlert(page).textContent();

    // A prior project shipped "this number is not on the guest list" on its
    // guest surface, which turns a forwarded link into a phone-number checker
    // for that household.
    for (const leak of [
      "lista de invitados",
      "no está registrado",
      "no existe",
      "sin teléfono",
    ]) {
      expect((alert ?? "").toLowerCase()).not.toContain(leak);
    }
  });
});

test.describe("exactly one unlock path", () => {
  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  for (const query of [
    "?preview=1",
    "?admin=1",
    "?token=anything",
    "?unlocked=true",
    "?preview=1&admin=1",
  ]) {
    test(`does not bypass the gate for ${query}`, async ({ page }) => {
      await page.goto(`/i/${invitation.slug}${query}`);

      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
      expect(withoutScripts(await page.content())).not.toContain(GUEST_ONE);
    });
  }

  test("does not bypass the gate for a session-shaped cookie", async ({
    browser,
  }) => {
    // The console's own auth arrives in work unit 6a. What is testable today is
    // the invariant that matters: the page reads ONE piece of unlock state, the
    // signed `inv_unlock` cookie, so no other cookie can stand in for it.
    const context = await browser.newContext();
    await context.addCookies(
      ["admin_session", "device_sender", "sb-access-token", "unlocked"].map(
        (name) => ({
          name,
          value: "1",
          domain: "localhost",
          path: "/",
        }),
      ),
    );

    try {
      const page = await context.newPage();
      await page.goto(`/i/${invitation.slug}`);

      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("does not accept a forged unlock cookie", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "inv_unlock",
        value: `${Buffer.from(
          JSON.stringify({ invitationId: "whatever", exp: 9_999_999_999_999 }),
          "utf8",
        ).toString("base64url")}.deadbeef`,
        domain: "localhost",
        path: `/i/${invitation.slug}`,
      },
    ]);

    try {
      const page = await context.newPage();
      await page.goto(`/i/${invitation.slug}`);

      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("the unlock cookie", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("is set httpOnly, SameSite=Lax and scoped to the slug", async ({
    page,
    context,
  }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005551111");
    await expect(page.getByText("Nos alegra mucho invitarlos")).toBeVisible();

    const cookie = (await context.cookies()).find(
      (candidate) => candidate.name === "inv_unlock",
    );

    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    // Lax, NOT Strict: the guest arrives by a cross-site top-level navigation
    // from WhatsApp, and Strict withholds the cookie on exactly that
    // navigation, re-gating them every time they reopen the link from the chat.
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.path).toBe(`/i/${invitation.slug}`);
  });

  test("expires 180 days out, the lifetime the phone-gate spec states", async ({
    page,
    context,
  }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005551111");
    await expect(page.getByText("Nos alegra mucho invitarlos")).toBeVisible();

    const cookie = (await context.cookies()).find(
      (candidate) => candidate.name === "inv_unlock",
    );
    const daysLeft = ((cookie?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;

    // A BAND, not `> 90`. The old bound was written to the implementation and
    // was satisfied by anything past three months, so a cookie that quietly
    // became a year would have passed just as happily as one that shrank to the
    // 30 days the spec used to state. The slack below is only what the wire
    // costs: the browser reports `expires` in whole seconds, and the render plus
    // the round trip happen between the server minting it and this line reading
    // the clock. Neither can add time, so 180 is a hard ceiling.
    expect(daysLeft).toBeGreaterThan(179.99);
    expect(daysLeft).toBeLessThanOrEqual(180);
  });

  test("lets a return visit skip the gate entirely", async ({ page }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005551111");
    await expect(page.getByText("Nos alegra mucho invitarlos")).toBeVisible();

    await page.goto(`/i/${invitation.slug}`);

    await expect(householdList(page).getByText(GUEST_ONE)).toBeVisible();
    await expect(page.getByLabel(/Número de celular/)).toHaveCount(0);
  });

  test("does not unlock a SECOND household held by the same person", async ({
    page,
  }) => {
    // A guest can legitimately hold two links — their own and a relative's.
    // Unlocking one must not unlock the other.
    const other = await household({ greetingName: "Familia Zapata" });

    try {
      await page.goto(`/i/${invitation.slug}`);
      await submitPhone(page, "3005551111");
      await expect(page.getByText("Nos alegra mucho invitarlos")).toBeVisible();

      await page.goto(`/i/${other.slug}`);

      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
    } finally {
      await other.cleanup();
    }
  });
});

test.describe("the lockout", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("refuses the 9th attempt after 8 failures inside 15 minutes", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      // Asserting the exact countdown rather than the generic sentence: the
      // generic sentence is already on screen from the previous attempt, so it
      // would pass against a stale render and let the loop outrun the server.
      const left = 7 - attempt;
      const countdown =
        left === 0
          ? "Ese fue el último intento disponible por ahora."
          : left === 1
            ? "Te queda 1 intento."
            : `Te quedan ${left} intentos.`;

      await submitPhone(page, `30055540${String(attempt).padStart(2, "0")}`);
      await expect(gateAlert(page)).toContainText(GENERIC_FAILURE);
      await expect(gateAlert(page)).toContainText(countdown);
    }

    await submitPhone(page, "3005554099");

    await expect(gateAlert(page)).toContainText(
      /Por seguridad, espera \d+ minutos? antes de intentarlo de nuevo\./,
    );
  });

  test("refuses even the CORRECT number while locked out", async ({ page }) => {
    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005551111");

    await expect(gateAlert(page)).toContainText("Por seguridad");
    await expect(page.getByText("Nos alegra mucho invitarlos")).toHaveCount(0);
  });

  test("persists across a separate browser context and request", async ({
    browser,
  }) => {
    // The lockout lives in `gate_attempts`, not in process memory: serverless
    // instances share none, so an in-memory counter would reset on a cold start
    // and the limit would be defeated by waiting a moment.
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await page.goto(`/i/${invitation.slug}`);
      await submitPhone(page, "3005551111");

      await expect(gateAlert(page)).toContainText("Por seguridad");
    } finally {
      await context.close();
    }
  });
});

test.describe("a client-supplied forwarding header", () => {
  test.describe.configure({ mode: "serial" });

  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  /**
   * `count` failed attempts from a browser claiming to be `forgedIp`.
   *
   * `startIndex` continues the countdown across contexts: the exact remaining
   * count is the assertion that matters, because a fresh bucket would restart
   * it at seven and a shared bucket keeps walking it down.
   */
  async function failFrom(
    browser: Browser,
    forgedIp: string,
    startIndex: number,
    count: number,
  ) {
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": forgedIp },
    });

    try {
      const page = await context.newPage();
      await page.goto(`/i/${invitation.slug}`);

      for (let offset = 0; offset < count; offset += 1) {
        const attempt = startIndex + offset;
        const left = 7 - attempt;
        const countdown =
          left === 0
            ? "Ese fue el último intento disponible por ahora."
            : left === 1
              ? "Te queda 1 intento."
              : `Te quedan ${left} intentos.`;

        await submitPhone(page, `30055570${String(attempt).padStart(2, "0")}`);
        await expect(gateAlert(page)).toContainText(countdown);
      }
    } finally {
      await context.close();
    }
  }

  test("does not buy a fresh rate-limit bucket for each request", async ({
    browser,
  }) => {
    // Vercel overwrites `x-forwarded-for` with the real client address to
    // prevent spoofing, and the app now reads only headers the platform
    // computed — so a visitor announcing a new address per request keeps
    // spending the SAME allowance. Under the previous left-most-entry read,
    // the second context would have restarted the countdown at seven.
    await failFrom(browser, "203.0.113.1", 0, 4);
    await failFrom(browser, "198.51.100.2", 4, 4);
  });

  test("cannot escape the resulting lockout by claiming a third address", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": "192.0.2.3, 203.0.113.9" },
    });

    try {
      const page = await context.newPage();
      await page.goto(`/i/${invitation.slug}`);
      await submitPhone(page, "3005557099");

      await expect(gateAlert(page)).toContainText(
        /Por seguridad, espera \d+ minutos? antes de intentarlo de nuevo\./,
      );
    } finally {
      await context.close();
    }
  });

  test("does not open for a CORRECT number while the lockout holds", async ({
    browser,
  }) => {
    // The number submitted here is Camila's real one, and the lockout still
    // wins — which is the property worth having: the gate consults the lockout
    // BEFORE it compares anything, so a locked-out attacker learns nothing even
    // from a correct guess, and cannot get in with one either. A forged
    // forwarding header does not buy a way around that.
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": "192.0.2.4" },
    });

    try {
      const page = await context.newPage();
      await page.goto(`/i/${invitation.slug}`);
      await submitPhone(page, PHONE_ONE.replace("+57", ""));

      await expect(gateAlert(page)).toContainText(
        /Por seguridad, espera \d+ minutos? antes de intentarlo de nuevo\./,
      );
      for (const gated of GATED_TEXT) {
        await expect(page.getByText(gated)).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("the recovery path", () => {
  let invitation: SeededInvitation;
  let other: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household({ ownerContactPhone: "+573001110001" });
    other = await seedInvitation({
      greetingName: "Familia Ochoa",
      ownerContactPhone: "+573002220002",
      guests: [{ fullName: "Julián Ochoa", phoneE164: "+573015554444" }],
    });
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
    await other?.cleanup();
  });

  test("offers a wa.me link addressed to the OWNING sender", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);

    const href = await page
      .getByRole("link", { name: /No puedes entrar/ })
      .getAttribute("href");

    expect(href).toContain("https://wa.me/573001110001?text=");
  });

  test("addresses a different invitation's own owner", async ({ page }) => {
    await page.goto(`/i/${other.slug}`);

    const href = await page
      .getByRole("link", { name: /No puedes entrar/ })
      .getAttribute("href");

    expect(href).toContain("https://wa.me/573002220002?text=");
    expect(href).not.toContain("573001110001");
  });

  test("prepares a Spanish draft naming the household", async ({ page }) => {
    await page.goto(`/i/${invitation.slug}`);

    const href =
      (await page
        .getByRole("link", { name: /No puedes entrar/ })
        .getAttribute("href")) ?? "";
    const text = new URL(href).searchParams.get("text") ?? "";

    expect(text).toContain(GREETING);
    expect(text).toContain("no puedo abrir mi invitación");
    // It PREPARES a draft; a human presses send inside WhatsApp.
    expect(href.startsWith("https://wa.me/")).toBe(true);
  });

  test("never offers a second unlock mechanism next to it", async ({
    page,
  }) => {
    await page.goto(`/i/${invitation.slug}`);

    const rendered = withoutScripts(await page.content());

    // No one-time password, no email fallback, no "enter a code": every one of
    // those is a second unlock path on a route that must have exactly one.
    for (const alternative of ["código", "OTP", "correo", "contraseña"]) {
      expect(rendered.toLowerCase()).not.toContain(alternative.toLowerCase());
    }
  });
});

test.describe("an unknown slug compared with a wrong phone", () => {
  let invitation: SeededInvitation;

  test.beforeAll(async () => {
    invitation = await household();
  });

  test.afterAll(async () => {
    await invitation?.cleanup();
  });

  test("neither response discloses a guest name or a stored digit", async ({
    page,
  }) => {
    await page.goto("/i/zzzzzzzzzzzzzzzz");
    const unknown = await page.content();

    await page.goto(`/i/${invitation.slug}`);
    await submitPhone(page, "3005556666");
    await expect(gateAlert(page)).toBeVisible();
    const wrongPhone = await page.content();

    for (const forbidden of [GUEST_ONE, GUEST_TWO, "3005551111", "05552222"]) {
      expect(unknown).not.toContain(forbidden);
      expect(wrongPhone).not.toContain(forbidden);
    }
  });

  test("distinguishes them only by the intentional friendly page", async ({
    page,
  }) => {
    // Design decision D10: at 80 bits of slug an existence oracle is worthless,
    // and shape-identical responses would cost real UX for no security. What
    // must NOT differ is anything about the household behind a real slug.
    await page.goto("/i/zzzzzzzzzzzzzzzz");
    await expect(
      page.getByText("No encontramos esta invitación"),
    ).toBeVisible();
    await expect(page.getByLabel(/Número de celular/)).toHaveCount(0);

    await page.goto(`/i/${invitation.slug}`);
    await expect(page.getByText("No encontramos esta invitación")).toHaveCount(
      0,
    );
  });
});
