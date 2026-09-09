import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { siteOrigin } from "@/lib/server/env";

/**
 * Open Graph card warming.
 *
 * `next/og` answers with `cache-control: public, immutable, max-age=31536000`,
 * so only the FIRST fetch of a card pays for a cold Satori + Resvg generation.
 * That first fetch is exactly the one WhatsApp's crawler makes, while a human
 * waits with the message composed and their thumb on send. Requesting the card
 * once, right after the invitation row lands, moves that cost off the critical
 * path for a fraction of a second of import time.
 *
 * WHICH url is warmed is as load-bearing as warming at all. Next.js appends a
 * build-scoped hash to the `og:image` it emits — `.../opengraph-image?88f8dd53`
 * — and a CDN keys its cache on the full URL including that query. Fetching the
 * bare route path would warm an entry nobody ever requests: a warm that reports
 * success and buys nothing. So this reads the invitation page and warms the
 * exact URL the page advertises, which is by construction the URL the crawler
 * will follow.
 *
 * The load-bearing rule is the failure behavior: warming NEVER fails invitation
 * creation. An invitation with a cold card is a slow preview; an invitation that
 * was not created because a CDN blinked is a guest who is never invited. Every
 * failure here is absorbed, logged, and reported as `false`.
 */

/** How long the whole warm may take before it is abandoned. */
export const OG_WARM_TIMEOUT_MS = 5_000;

export interface WarmOgCardOptions {
  /** Overrides the deployed origin. Defaults to `NEXT_PUBLIC_SITE_ORIGIN`. */
  readonly origin?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  /** Receives one structured warning line per failure. */
  readonly log?: (line: string) => void;
}

function withoutTrailingSlash(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** The guest-facing invitation page for a slug. */
export function invitationPageUrl(origin: string, slug: string): string {
  return `${withoutTrailingSlash(origin)}/i/${slug}`;
}

/**
 * The card route for a slug, without any query.
 *
 * This is the PREFIX the advertised `og:image` must start with, not necessarily
 * the URL that gets fetched. No cache-busting parameter is ever invented here:
 * one would be a third cache key, warmed by nobody.
 */
export function ogCardUrl(origin: string, slug: string): string {
  return `${withoutTrailingSlash(origin)}/i/${slug}/opengraph-image`;
}

/**
 * Removes anything shaped like a phone number from text bound for a log.
 *
 * Warm failures carry an underlying error message, which is text this module
 * did not author. Guest phone numbers are personal data and must never reach
 * log storage, so the scrub happens at the boundary rather than by trusting
 * every possible producer of that string.
 */
function withoutDigitRuns(text: string): string {
  return text.replace(/\d{4,}/g, "[redacted]");
}

function warnOnce(
  log: ((line: string) => void) | undefined,
  slug: string,
  reason: string,
): void {
  const line = JSON.stringify({
    event: "og_warm_failed",
    slug,
    reason: withoutDigitRuns(reason),
  });

  (log ?? console.warn)(line);
}

/** Reads the `og:image` URL out of an invitation page's HTML. */
function advertisedCardUrl(pageHtml: string): string | null {
  const tag = /<meta[^>]+property="og:image"[^>]*>/i.exec(pageHtml);

  if (tag === null) {
    return null;
  }

  const content = /content="([^"]*)"/i.exec(tag[0]);

  return content === null ? null : content[1];
}

/**
 * Warms the Open Graph card for `slug` and records the result.
 *
 * Returns `true` only when the card was fetched successfully AND the warm was
 * recorded. Every other outcome returns `false` after logging the slug and a
 * scrubbed reason. It never throws.
 */
export async function warmOgCard(
  client: SupabaseClient,
  slug: string,
  options: WarmOgCardOptions = {},
): Promise<boolean> {
  const doFetch = options.fetchImpl ?? fetch;

  let origin: string;
  try {
    origin = options.origin ?? siteOrigin();
  } catch (cause) {
    warnOnce(options.log, slug, (cause as Error).message);
    return false;
  }

  // One budget for the whole operation, not one per request: the caller is an
  // import loop, and two independent five-second waits per household is a very
  // different promise from one.
  const signal = AbortSignal.timeout(options.timeoutMs ?? OG_WARM_TIMEOUT_MS);

  let cardUrl: string;
  try {
    const page = await doFetch(invitationPageUrl(origin, slug), {
      cache: "no-store",
      signal,
    });

    if (!page.ok) {
      warnOnce(options.log, slug, `invitation page responded ${page.status}`);
      return false;
    }

    const advertised = advertisedCardUrl(await page.text());

    if (advertised === null) {
      warnOnce(
        options.log,
        slug,
        "the invitation page advertises no og:image, so there is no card to warm",
      );
      return false;
    }

    // Warming runs with server credentials and follows a URL read out of an
    // HTTP response body. It follows it only when it is this invitation's own
    // card on our own origin.
    if (!advertised.startsWith(ogCardUrl(origin, slug))) {
      warnOnce(
        options.log,
        slug,
        "the advertised og:image does not belong to this invitation",
      );
      return false;
    }

    cardUrl = advertised;
  } catch (cause) {
    warnOnce(options.log, slug, (cause as Error).message);
    return false;
  }

  try {
    const card = await doFetch(cardUrl, { cache: "no-store", signal });

    if (!card.ok) {
      warnOnce(options.log, slug, `card responded ${card.status}`);
      return false;
    }
  } catch (cause) {
    warnOnce(options.log, slug, (cause as Error).message);
    return false;
  }

  const { error } = await client
    .from("invitations")
    .update({ og_warmed_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    // The card IS warm; only the bookkeeping failed. Reporting `false` keeps
    // the console's "not warmed" badge honest about what was recorded.
    warnOnce(options.log, slug, error.message);
    return false;
  }

  return true;
}
