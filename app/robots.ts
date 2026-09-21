import type { MetadataRoute } from "next";

/**
 * The prefix every per-guest invitation lives under.
 *
 * An invitation URL is an unlisted capability: whoever holds the link may open
 * it, and the slug is the only thing standing between a stranger and a
 * household's page. Indexing that prefix would turn a private link into a
 * published one.
 */
export const INVITATION_PATH_PREFIX = "/i/";

/**
 * The Open Graph card path, which stays crawlable inside the disallowed prefix.
 *
 * The card is the one resource under `/i/` that exists to be fetched by a
 * machine, and it carries names only — no date, no venue, no phone. A blanket
 * disallow would tell conforming crawlers to skip it too.
 */
export const OG_IMAGE_ALLOW_PATTERN = "/i/*/opengraph-image";

/**
 * The operator console prefix.
 *
 * Authenticated, so indexing it exposes no guest data — but a login page in a
 * search index is an advertisement that this wedding has an operator panel,
 * and it attracts the automated traffic that follows one.
 */
export const CONSOLE_PATH_PREFIX = "/console";

/**
 * The public stream invitation.
 *
 * It has no gate, on purpose: it is the one invitation the couple can send to
 * everybody joining over Zoom, without a household record for each of them. But
 * it carries a live meeting id and its passcode, and PUBLIC and INDEXED are not
 * the same thing. In a search index those credentials are findable by anyone
 * searching for anything, which is how a ceremony gets crashed by strangers.
 *
 * THIS IS NOT SECURITY AND MUST NOT BE READ AS ANY. Any guest can forward the
 * link, and what actually protects the call is Zoom's waiting room. The rule
 * below only keeps the credentials out of search results.
 *
 * The landing at `/` stays crawlable, which is the whole reason the credentials
 * were given their own path: `/` is the link that gets shared, and the card
 * WhatsApp renders is built by fetching it and reading its `og:` tags. A
 * `Disallow: /` would stop that fetch, and by prefix it would disallow every
 * other path on the site as well.
 */
export const STREAM_PATH = "/transmision";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [OG_IMAGE_ALLOW_PATTERN],
      disallow: [INVITATION_PATH_PREFIX, CONSOLE_PATH_PREFIX, STREAM_PATH],
    },
  };
}
