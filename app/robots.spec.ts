import { describe, expect, it } from "vitest";

import robots, {
  CONSOLE_PATH_PREFIX,
  INVITATION_PATH_PREFIX,
  OG_IMAGE_ALLOW_PATTERN,
} from "./robots";

/**
 * Invitation URLs are unlisted capabilities: holding the link IS the claim to
 * open it. Letting a search engine index `/i/<slug>` would publish the whole
 * guest list of links, so the prefix is disallowed.
 *
 * The Open Graph image sub-path must stay crawlable anyway. Robots rules are
 * what a well-behaved indexer obeys, and WhatsApp's preview fetcher is not an
 * indexer — but a blanket `Disallow: /i/` would also tell every conforming
 * crawler not to fetch the card, which is the one thing under `/i/` that is
 * meant to be fetched by a machine.
 */
describe("robots.txt", () => {
  it("disallows the invitation prefix for every crawler", () => {
    const rules = robots().rules;

    expect(Array.isArray(rules)).toBe(false);
    const single = rules as Exclude<typeof rules, unknown[]>;

    expect(single.userAgent).toBe("*");
    expect(single.disallow).toContain(INVITATION_PATH_PREFIX);
  });

  it("keeps the Open Graph image sub-path crawlable", () => {
    const single = robots().rules as Exclude<
      ReturnType<typeof robots>["rules"],
      unknown[]
    >;

    expect(single.allow).toContain(OG_IMAGE_ALLOW_PATTERN);
  });

  it("does not allow the invitation prefix back in", () => {
    const single = robots().rules as Exclude<
      ReturnType<typeof robots>["rules"],
      unknown[]
    >;

    // An `Allow: /i/` would re-open exactly what the disallow above closes.
    expect(single.allow).not.toContain(INVITATION_PATH_PREFIX);
    expect(single.allow).not.toContain("/i/*");
  });

  it("disallows the operator console too", () => {
    // The console is an authenticated surface, so indexing it leaks nothing
    // directly — but an indexed login page advertises to anyone searching that
    // this wedding has an operator panel, and invites the credential-stuffing
    // traffic that follows.
    const single = robots().rules as Exclude<
      ReturnType<typeof robots>["rules"],
      unknown[]
    >;

    expect(single.disallow).toContain(CONSOLE_PATH_PREFIX);
    expect(single.allow).not.toContain(CONSOLE_PATH_PREFIX);
  });

  it("targets the card path under the invitation prefix, not a sibling", () => {
    expect(OG_IMAGE_ALLOW_PATTERN.startsWith(INVITATION_PATH_PREFIX)).toBe(
      true,
    );
    expect(OG_IMAGE_ALLOW_PATTERN.endsWith("/opengraph-image")).toBe(true);
  });
});
