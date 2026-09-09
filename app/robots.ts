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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [OG_IMAGE_ALLOW_PATTERN],
      disallow: [INVITATION_PATH_PREFIX],
    },
  };
}
