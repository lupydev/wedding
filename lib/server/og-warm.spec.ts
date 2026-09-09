import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { invitationPageUrl, ogCardUrl, warmOgCard } from "./og-warm";

/**
 * Warming exists because of one asymmetry: `next/og` answers with
 * `cache-control: immutable, max-age=31536000`, so only the FIRST fetch of a
 * card pays for generation — and the first fetch is exactly the one WhatsApp's
 * crawler makes while a human waits to press send.
 *
 * The URL matters as much as the fetch. Next.js appends a build-scoped hash to
 * the `og:image` it emits (`.../opengraph-image?88f8dd53...`), and a CDN keys
 * its cache on the full URL including that query. Fetching the bare route path
 * would therefore warm an entry the crawler never requests: a warm that reports
 * success and buys nothing. So warming reads the page and warms the exact URL
 * the page advertises.
 *
 * The rule that matters more than warming itself: a warm failure MUST NOT fail
 * invitation creation. An invitation that exists with a cold card is a slow
 * preview; an invitation that failed to be created because a CDN was briefly
 * unreachable is a guest who is never invited.
 */

const SLUG = "k7q2m9xr4tabcdef";
const ORIGIN = "https://boda.example.test";
const CARD_URL = `${ORIGIN}/i/${SLUG}/opengraph-image`;
const ADVERTISED_CARD_URL = `${CARD_URL}?88f8dd536f697fc4`;

interface FakeUpdate {
  readonly table: string;
  readonly values: Record<string, unknown>;
  readonly column: string;
  readonly value: unknown;
}

/** A Supabase client double that records the single update warming performs. */
function fakeClient(
  result: { error: { message: string } | null } = { error: null },
) {
  const updates: FakeUpdate[] = [];

  const client = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              updates.push({ table, values, column, value });
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, updates };
}

/** The minimum of an invitation page that warming actually reads. */
function pageAdvertising(ogImage: string): string {
  return `<!DOCTYPE html><html><head><meta property="og:image" content="${ogImage}"/></head><body></body></html>`;
}

/** A fetch double answering the page URL and the card URL separately. */
function fakeFetch(responses: {
  page?: Response | Error;
  card?: Response | Error;
}) {
  const requested: string[] = [];

  const impl = (async (input: unknown) => {
    const url = String(input);
    requested.push(url);

    const answer = url.includes("/opengraph-image")
      ? responses.card
      : responses.page;

    if (answer === undefined) {
      throw new Error(`Unexpected request to ${url}`);
    }

    if (answer instanceof Error) {
      throw answer;
    }

    return answer;
  }) as typeof fetch;

  return { impl: vi.fn(impl), requested };
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  });
}

describe("invitationPageUrl", () => {
  it("builds the page URL for a slug", () => {
    expect(invitationPageUrl(ORIGIN, SLUG)).toBe(`${ORIGIN}/i/${SLUG}`);
  });

  it("tolerates an origin with a trailing slash", () => {
    expect(invitationPageUrl(`${ORIGIN}/`, SLUG)).toBe(`${ORIGIN}/i/${SLUG}`);
  });
});

describe("ogCardUrl", () => {
  it("builds the canonical card route for a slug", () => {
    expect(ogCardUrl(ORIGIN, SLUG)).toBe(CARD_URL);
  });

  it("builds a different route for a different slug", () => {
    expect(ogCardUrl(ORIGIN, "zzzzzzzzzzzzzzzz")).toBe(
      `${ORIGIN}/i/zzzzzzzzzzzzzzzz/opengraph-image`,
    );
  });

  it("adds no cache-busting parameter of its own", () => {
    // A `?t=...` invented here would be a third cache key, warmed by nobody.
    expect(ogCardUrl(ORIGIN, SLUG)).not.toContain("?");
  });
});

describe("warmOgCard", () => {
  it("warms the exact card URL the invitation page advertises", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({
      page: html(pageAdvertising(ADVERTISED_CARD_URL)),
      card: new Response("png", { status: 200 }),
    });

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
    });

    expect(warmed).toBe(true);
    expect(fetches.requested).toEqual([
      `${ORIGIN}/i/${SLUG}`,
      ADVERTISED_CARD_URL,
    ]);
    expect(updates).toEqual([
      {
        table: "invitations",
        values: { og_warmed_at: expect.any(String) },
        column: "slug",
        value: SLUG,
      },
    ]);
  });

  it("warms the bare route when the page advertises it without a query", async () => {
    const { client } = fakeClient();
    const fetches = fakeFetch({
      page: html(pageAdvertising(CARD_URL)),
      card: new Response("png", { status: 200 }),
    });

    await warmOgCard(client, SLUG, { origin: ORIGIN, fetchImpl: fetches.impl });

    expect(fetches.requested[1]).toBe(CARD_URL);
  });

  it("requests the card without a cached copy", async () => {
    const { client } = fakeClient();
    const fetches = fakeFetch({
      page: html(pageAdvertising(ADVERTISED_CARD_URL)),
      card: new Response("png", { status: 200 }),
    });

    await warmOgCard(client, SLUG, { origin: ORIGIN, fetchImpl: fetches.impl });

    expect(fetches.impl.mock.calls[1][1]).toMatchObject({ cache: "no-store" });
  });

  it("records the warm timestamp as a valid instant", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({
      page: html(pageAdvertising(ADVERTISED_CARD_URL)),
      card: new Response("png", { status: 200 }),
    });

    await warmOgCard(client, SLUG, { origin: ORIGIN, fetchImpl: fetches.impl });

    expect(
      Number.isNaN(Date.parse(updates[0].values.og_warmed_at as string)),
    ).toBe(false);
  });

  it("refuses a card URL that does not belong to this invitation", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({
      page: html(pageAdvertising("https://attacker.example/opengraph-image")),
    });
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    // Warming runs with server credentials and follows a URL read out of an
    // HTTP response. It follows it only when it is this invitation's own card.
    expect(warmed).toBe(false);
    expect(fetches.requested).toEqual([`${ORIGIN}/i/${SLUG}`]);
    expect(updates).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("does not warm when the page advertises no card at all", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({ page: html("<html><head></head></html>") });
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    expect(warmed).toBe(false);
    expect(fetches.requested).toHaveLength(1);
    expect(updates).toEqual([]);
    expect(log.mock.calls[0][0]).toContain(SLUG);
  });

  it("does not warm when the invitation page responds with an error status", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({ page: html("boom", 503) });
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    expect(warmed).toBe(false);
    expect(updates).toEqual([]);
    expect(log.mock.calls[0][0]).toContain("503");
  });

  it("does not record a warm when the card responds with an error status", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({
      page: html(pageAdvertising(ADVERTISED_CARD_URL)),
      card: new Response("boom", { status: 500 }),
    });
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    expect(warmed).toBe(false);
    expect(updates).toEqual([]);
    expect(log.mock.calls[0][0]).toContain("500");
  });

  it("survives a network failure without throwing", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({ page: new Error("ECONNREFUSED") });
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    expect(warmed).toBe(false);
    expect(updates).toEqual([]);
    expect(log.mock.calls[0][0]).toContain("ECONNREFUSED");
  });

  it("gives up after the timeout instead of hanging the caller", async () => {
    const { client } = fakeClient();
    // Never settles on its own: only the abort ends it, which is exactly what
    // the timeout must produce.
    const fetchImpl = vi.fn(
      ((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted.")),
          );
        })) as typeof fetch,
    );
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl,
      timeoutMs: 5,
      log,
    });

    expect(warmed).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("survives a failed database update without throwing", async () => {
    const { client, updates } = fakeClient({
      error: { message: "connection lost" },
    });
    const fetches = fakeFetch({
      page: html(pageAdvertising(ADVERTISED_CARD_URL)),
      card: new Response("png", { status: 200 }),
    });
    const log = vi.fn();

    const warmed = await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    expect(warmed).toBe(false);
    expect(updates).toHaveLength(1);
    expect(log.mock.calls[0][0]).toContain("connection lost");
  });

  it("survives a missing site origin without throwing", async () => {
    const { client, updates } = fakeClient();
    const fetches = fakeFetch({});
    const log = vi.fn();

    // No `origin` option and no NEXT_PUBLIC_SITE_ORIGIN in this process: the
    // environment accessor throws, and warming must absorb it.
    const previous = process.env.NEXT_PUBLIC_SITE_ORIGIN;
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;

    let warmed: boolean;
    try {
      warmed = await warmOgCard(client, SLUG, {
        fetchImpl: fetches.impl,
        log,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
      } else {
        process.env.NEXT_PUBLIC_SITE_ORIGIN = previous;
      }
    }

    expect(warmed).toBe(false);
    expect(fetches.requested).toEqual([]);
    expect(updates).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("logs the slug and never anything shaped like a phone number", async () => {
    const { client } = fakeClient();
    const fetches = fakeFetch({
      page: new Error("connect failed for +573005550000"),
    });
    const log = vi.fn();

    await warmOgCard(client, SLUG, {
      origin: ORIGIN,
      fetchImpl: fetches.impl,
      log,
    });

    const line = log.mock.calls[0][0] as string;

    expect(line).toContain(SLUG);
    // Warm logs reach ordinary log storage. A guest phone must never be in one,
    // including one an underlying library happened to put in an error message.
    expect(line).not.toMatch(/\d{7,}/);
  });
});
