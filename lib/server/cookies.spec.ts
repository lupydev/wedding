import { afterEach, describe, expect, it } from "vitest";

import {
  UNLOCK_COOKIE_MAX_AGE_SECONDS,
  UNLOCK_COOKIE_NAME,
  signUnlockCookie,
  unlockCookieOptions,
  unlockCookieUnlocks,
  verifyUnlockCookie,
} from "./cookies";

/**
 * The unlock cookie is the ONLY thing standing between a second visit and the
 * gate, so its failure modes are the interesting part:
 *
 *  - a forged or edited value must not unlock anything, which is what the HMAC
 *    is for;
 *  - a cookie minted for household A must not unlock household B, because a
 *    person can legitimately hold two links and the browser will send both
 *    cookies whose path matches;
 *  - an expired cookie must be refused by the SERVER, not merely by the
 *    browser's own `maxAge`, since the browser is under the visitor's control.
 */

const ORIGINAL_ENV = { ...process.env };
const SECRET = "u".repeat(48);
const OTHER_SECRET = "z".repeat(48);
const INVITATION = "11111111-1111-4111-8111-111111111111";
const OTHER_INVITATION = "22222222-2222-4222-8222-222222222222";
const SLUG = "k7q2m9xr4tabcdef";
const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
const DAY = 86_400_000;

process.env.UNLOCK_COOKIE_SECRET = SECRET;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV, UNLOCK_COOKIE_SECRET: SECRET };
});

describe("signUnlockCookie / verifyUnlockCookie", () => {
  it("round-trips a cookie it just minted for the same invitation", () => {
    const value = signUnlockCookie(INVITATION, NOW);

    expect(verifyUnlockCookie(value, INVITATION, NOW)).toBe(true);
  });

  it("round-trips a different invitation's cookie for that invitation", () => {
    const value = signUnlockCookie(OTHER_INVITATION, NOW);

    expect(verifyUnlockCookie(value, OTHER_INVITATION, NOW)).toBe(true);
  });

  it("refuses a cookie minted for another invitation", () => {
    const value = signUnlockCookie(OTHER_INVITATION, NOW);

    expect(verifyUnlockCookie(value, INVITATION, NOW)).toBe(false);
  });

  it("refuses a value whose payload was edited but whose signature was kept", () => {
    const [payload, signature] = signUnlockCookie(INVITATION, NOW).split(".");
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const forged = Buffer.from(
      JSON.stringify({ ...decoded, invitationId: OTHER_INVITATION }),
      "utf8",
    ).toString("base64url");

    expect(
      verifyUnlockCookie(`${forged}.${signature}`, OTHER_INVITATION, NOW),
    ).toBe(false);
  });

  it("refuses a value whose signature was edited", () => {
    const [payload, signature] = signUnlockCookie(INVITATION, NOW).split(".");
    const flipped = signature.startsWith("a")
      ? `b${signature.slice(1)}`
      : `a${signature.slice(1)}`;

    expect(verifyUnlockCookie(`${payload}.${flipped}`, INVITATION, NOW)).toBe(
      false,
    );
  });

  it("refuses a value signed with a different secret", () => {
    const value = signUnlockCookie(INVITATION, NOW);
    process.env.UNLOCK_COOKIE_SECRET = OTHER_SECRET;

    expect(verifyUnlockCookie(value, INVITATION, NOW)).toBe(false);
  });

  it("refuses malformed values instead of throwing", () => {
    for (const malformed of [
      "",
      "not-a-cookie",
      "a.b.c",
      "!!!!.!!!!",
      `${Buffer.from("not json", "utf8").toString("base64url")}.deadbeef`,
    ]) {
      expect(verifyUnlockCookie(malformed, INVITATION, NOW)).toBe(false);
    }
  });

  it("still accepts the cookie one day before its own expiry", () => {
    const value = signUnlockCookie(INVITATION, NOW);
    const justBefore = NOW + UNLOCK_COOKIE_MAX_AGE_SECONDS * 1000 - DAY;

    expect(verifyUnlockCookie(value, INVITATION, justBefore)).toBe(true);
  });

  it("refuses the cookie one second after its own expiry", () => {
    const value = signUnlockCookie(INVITATION, NOW);
    const justAfter = NOW + UNLOCK_COOKIE_MAX_AGE_SECONDS * 1000 + 1_000;

    expect(verifyUnlockCookie(value, INVITATION, justAfter)).toBe(false);
  });

  it("outlives a month, because the wedding is further away than that", () => {
    // A 7-day or 30-day cookie re-gates a guest who confirmed early and comes
    // back to check the address the week of the wedding. The gate exists to
    // stop a forwarded link, not to expire a guest who already proved they own
    // the number.
    expect(UNLOCK_COOKIE_MAX_AGE_SECONDS).toBeGreaterThan(90 * 86_400);
  });
});

describe("unlockCookieOptions", () => {
  it("scopes the cookie to the slug it was unlocked from", () => {
    expect(unlockCookieOptions(SLUG).path).toBe(`/i/${SLUG}`);
  });

  it("scopes a different slug to its own path", () => {
    expect(unlockCookieOptions("abcdefghij234567").path).toBe(
      "/i/abcdefghij234567",
    );
  });

  it("is httpOnly, so no script on the page can read or copy it", () => {
    expect(unlockCookieOptions(SLUG).httpOnly).toBe(true);
  });

  it("uses SameSite=Lax, because the guest arrives from WhatsApp", () => {
    // Strict would drop the cookie on exactly the cross-site top-level
    // navigation the guest makes from the chat, re-gating them every time.
    expect(unlockCookieOptions(SLUG).sameSite).toBe("lax");
  });

  it("carries the same lifetime the signature is minted with", () => {
    expect(unlockCookieOptions(SLUG).maxAge).toBe(
      UNLOCK_COOKIE_MAX_AGE_SECONDS,
    );
  });

  it("is named inv_unlock", () => {
    expect(UNLOCK_COOKIE_NAME).toBe("inv_unlock");
  });
});

describe("unlockCookieUnlocks", () => {
  // The clock-supplying wrapper the page calls, so no Server Component reads
  // `Date.now()` during render. Extracted from `verifyUnlockCookie` in REFACTOR;
  // these pin that the extraction kept both halves of the decision.
  it("accepts a cookie just minted for this invitation", () => {
    expect(
      unlockCookieUnlocks(signUnlockCookie(INVITATION, Date.now()), INVITATION),
    ).toBe(true);
  });

  it("refuses a cookie minted for another household", () => {
    expect(
      unlockCookieUnlocks(
        signUnlockCookie(OTHER_INVITATION, Date.now()),
        INVITATION,
      ),
    ).toBe(false);
  });

  it("refuses a cookie whose lifetime already ran out", () => {
    const expired = signUnlockCookie(
      INVITATION,
      Date.now() - (UNLOCK_COOKIE_MAX_AGE_SECONDS + 60) * 1000,
    );

    expect(unlockCookieUnlocks(expired, INVITATION)).toBe(false);
  });

  it("refuses an absent cookie without throwing", () => {
    expect(unlockCookieUnlocks("", INVITATION)).toBe(false);
  });
});
