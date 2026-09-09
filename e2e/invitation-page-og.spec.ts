import { expect, test } from "@playwright/test";

import { seedInvitation, type SeededInvitation } from "./helpers/seed";
import { E2E_SITE_ORIGIN } from "./helpers/site-origin";

/**
 * The regression guard for the single most fragile dependency in the product.
 *
 * WhatsApp's crawler does NOT execute JavaScript. It reads the first HTML
 * response and nothing else. Next.js streams `generateMetadata` output near
 * `</body>` by default and only blocks for user agents matching its built-in
 * bot list, so the per-guest Open Graph tags reaching `<head>` in time is a
 * configuration outcome (`htmlLimitedBots`), not a framework guarantee.
 *
 * Every assertion here is made against the RAW response body — never a
 * hydrated DOM. A hydrated DOM would show the tags in `<head>` whether or not
 * the crawler could ever have seen them there, which is precisely the failure
 * this file exists to catch. Failing that way is silent: the message sends, the
 * card is simply blank, and no error is raised anywhere.
 */

const WHATSAPP_USER_AGENT = "WhatsApp/2.23.20.0";
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** The fixture name is load-bearing: enye in both cases, plus an accented o. */
const GREETING_NAME = "Ñoño Muñóz";

let invitation: SeededInvitation;

test.beforeAll(async () => {
  invitation = await seedInvitation({
    greetingName: GREETING_NAME,
    displayName: "Familia Muñóz",
    seatsAllowed: 2,
    guests: [
      { fullName: GREETING_NAME, phoneE164: "+573005550001" },
      { fullName: "Aurelia Muñóz", phoneE164: "+573005550002" },
    ],
  });
});

test.afterAll(async () => {
  await invitation?.cleanup();
});

/** Everything between `<head>` and the first `</head>`. */
function headOf(html: string): string {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);

  if (head === null) {
    throw new Error("The response has no <head> element at all.");
  }

  return head[1];
}

/** Everything after `</head>` — where streamed metadata would land. */
function afterHeadOf(html: string): string {
  const index = html.toLowerCase().indexOf("</head>");

  return index === -1 ? html : html.slice(index);
}

/**
 * The document without its scripts.
 *
 * Every App Router response inlines the serialized React tree, which contains
 * the framework's default not-found subtree and a copy of the metadata as data.
 * Assertions about what the guest SEES must ignore it; assertions about data
 * leaks must not, and deliberately do not use this.
 */
function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function metaContent(html: string, property: string): string | null {
  const match = new RegExp(
    `<meta[^>]+property="${property}"[^>]*>|<meta[^>]*content="[^"]*"[^>]+property="${property}"[^>]*>`,
    "i",
  ).exec(html);

  if (match === null) {
    return null;
  }

  const content = /content="([^"]*)"/i.exec(match[0]);

  return content === null ? null : content[1];
}

test.describe("per-guest Open Graph tags in the first HTML response", () => {
  test("serves og:title and og:image inside <head> under a WhatsApp User-Agent", async ({
    request,
  }) => {
    const response = await request.get(`/i/${invitation.slug}`, {
      headers: { "user-agent": WHATSAPP_USER_AGENT },
    });

    expect(response.status()).toBe(200);

    const head = headOf(await response.text());

    expect(metaContent(head, "og:title")).toBe(GREETING_NAME);
    expect(metaContent(head, "og:image")).not.toBeNull();
  });

  test("serves the same tags inside <head> under an ordinary browser User-Agent", async ({
    request,
  }) => {
    const response = await request.get(`/i/${invitation.slug}`, {
      headers: { "user-agent": DESKTOP_USER_AGENT },
    });

    const html = await response.text();

    expect(metaContent(headOf(html), "og:title")).toBe(GREETING_NAME);
    expect(metaContent(headOf(html), "og:image")).not.toBeNull();
  });

  /**
   * Measured, not assumed: this suite was re-run with `htmlLimitedBots` removed
   * from `next.config.ts` and every test below still passed. Next.js 16.3.4
   * does not stream this route's metadata by default, because nothing above it
   * flushes a shell early — there is no `loading.tsx` and no Suspense boundary
   * on the way to `generateMetadata`.
   *
   * So this test asserts the PRODUCT requirement (tags in `<head>` of the first
   * response) rather than proving which mechanism delivers it. The config line
   * stays because the moment a later work unit puts a Suspense boundary in
   * front of this page — the phone gate is a candidate — streaming becomes
   * possible and the tags would move to the end of the body. This test is what
   * would catch that.
   */
  test("does not stream the tags after </head>", async ({ request }) => {
    const response = await request.get(`/i/${invitation.slug}`, {
      headers: { "user-agent": DESKTOP_USER_AGENT },
    });

    // Streamed metadata is appended near `</body>` as real `<meta>` elements.
    // A crawler that stops reading at `</head>` would never see them. The
    // serialized React tree after `</head>` legitimately mentions "og:title"
    // as hydration DATA, which is why this asserts on tags, not on the string.
    const afterHead = afterHeadOf(await response.text());

    expect(metaContent(afterHead, "og:title")).toBeNull();
    expect(metaContent(afterHead, "og:image")).toBeNull();
  });

  test("emits an absolute https og:image on the deployed origin", async ({
    request,
  }) => {
    const response = await request.get(`/i/${invitation.slug}`, {
      headers: { "user-agent": WHATSAPP_USER_AGENT },
    });

    const ogImage =
      metaContent(headOf(await response.text()), "og:image") ?? "";

    // A relative og:image yields no preview card at all.
    expect(ogImage.startsWith("https://")).toBe(true);
    expect(
      ogImage.startsWith(
        `${E2E_SITE_ORIGIN}/i/${invitation.slug}/opengraph-image`,
      ),
    ).toBe(true);
  });

  test("never puts a guest phone number in the invitation page source", async ({
    request,
  }) => {
    const response = await request.get(`/i/${invitation.slug}`, {
      headers: { "user-agent": DESKTOP_USER_AGENT },
    });

    const html = await response.text();

    // The full E.164, the national number, and the last 8 digits — the last
    // being the form the phone gate stores and the one most likely to be
    // smuggled into an inline JSON payload by accident.
    for (const forbidden of [
      "+573005550001",
      "573005550001",
      "3005550001",
      "05550001",
      "+573005550002",
      "05550002",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});

test.describe("the Open Graph card image", () => {
  test("renders a PNG for a household name with an enye and an accent", async ({
    request,
  }) => {
    const response = await request.get(
      `/i/${invitation.slug}/opengraph-image`,
      { headers: { "user-agent": WHATSAPP_USER_AGENT } },
    );

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");

    const body = await response.body();

    expect(body.byteLength).toBeGreaterThan(1_000);
    // PNG magic number: proves a real raster, not an error page with the
    // wrong content type.
    expect([...body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("is cacheable forever, which is what makes warming worth doing", async ({
    request,
  }) => {
    const response = await request.get(`/i/${invitation.slug}/opengraph-image`);
    const cacheControl = response.headers()["cache-control"] ?? "";

    // Warming pays for the first generation so the crawler does not. That only
    // helps if the CDN keeps the result: measured on `next start`, a dynamic
    // image route answers `max-age=0, must-revalidate` by default, which caches
    // nothing and makes every crawler fetch a cold generation again.
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("immutable");
    expect(cacheControl).toContain("max-age=31536000");
  });

  test("renders visibly different pixels for the accented and unaccented name", async ({
    request,
  }) => {
    // Two households whose names differ ONLY by their accents. Identical bytes
    // would mean the accents were dropped; both rendering as boxes would still
    // differ from the plain name, so this is compared against a plain-ASCII
    // control rather than assumed.
    const plain = await seedInvitation({
      greetingName: "Nono Munoz",
      guests: [{ fullName: "Nono Munoz" }],
    });

    try {
      const accented = await (
        await request.get(`/i/${invitation.slug}/opengraph-image`)
      ).body();
      const unaccented = await (
        await request.get(`/i/${plain.slug}/opengraph-image`)
      ).body();

      expect(accented.byteLength).toBeGreaterThan(1_000);
      expect(unaccented.byteLength).toBeGreaterThan(1_000);
      expect(accented.equals(unaccented)).toBe(false);
    } finally {
      await plain.cleanup();
    }
  });
});

test.describe("an unknown slug", () => {
  test("shows a friendly contact page instead of a raw 404", async ({
    request,
  }) => {
    const response = await request.get("/i/zzzzzzzzzzzzzzzz");
    const document = withoutScripts(await response.text());

    expect(response.status()).toBe(200);
    expect(document).toContain("No encontramos esta invitación");
    // Next.js's own not-found page. Rendering it would mean the guest hit the
    // framework's dead end rather than the product's.
    expect(document).not.toContain("This page could not be found");
    expect(document).not.toContain("next-error-h1");
  });

  test("shows the same friendly page for a malformed slug", async ({
    request,
  }) => {
    const response = await request.get("/i/not-a-valid-slug");

    expect(withoutScripts(await response.text())).toContain(
      "No encontramos esta invitación",
    );
  });

  test("tells a crawler not to index the friendly page", async ({
    request,
  }) => {
    const response = await request.get("/i/zzzzzzzzzzzzzzzz");

    expect(headOf(await response.text())).toContain("noindex");
  });
});

test.describe("robots.txt", () => {
  test("disallows the invitation prefix and allows the card path", async ({
    request,
  }) => {
    const body = await (await request.get("/robots.txt")).text();

    expect(body).toContain("Disallow: /i/");
    expect(body).toContain("Allow: /i/*/opengraph-image");
  });
});
