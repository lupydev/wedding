import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyDeviceDeclaration } from "@/lib/domain/device-declaration";

import {
  DEVICE_SENDER_COOKIE_MAX_AGE_SECONDS,
  UNLOCK_COOKIE_MAX_AGE_SECONDS,
  UNLOCK_COOKIE_NAME,
  deviceSenderCookieOptions,
  readDeviceSenderCookie,
  signDeviceSenderCookie,
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
process.env.OPERATOR_SESSION_SECRET = SECRET;

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = {
    ...ORIGINAL_ENV,
    UNLOCK_COOKIE_SECRET: SECRET,
    OPERATOR_SESSION_SECRET: SECRET,
  };
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

  // `secure` is the attribute that keeps the cookie off plain HTTP. It was
  // written correctly and then never asserted, which is the same as not having
  // it: a refactor could flip it to a constant in either direction and every
  // test would still pass. Both branches are pinned here.
  it("sets Secure in production, so the cookie never travels in the clear", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(unlockCookieOptions(SLUG).secure).toBe(true);
  });

  it("omits Secure outside production, so plain-HTTP local development works", () => {
    // A `Secure` cookie is discarded by the browser on `http://localhost`, so
    // hard-coding `true` would silently break every developer's unlock.
    vi.stubEnv("NODE_ENV", "development");

    expect(unlockCookieOptions(SLUG).secure).toBe(false);
  });

  it("omits Secure under the test runner too, for the same reason", () => {
    vi.stubEnv("NODE_ENV", "test");

    expect(unlockCookieOptions(SLUG).secure).toBe(false);
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

/**
 * The per-device WhatsApp declaration cookie.
 *
 * A different question from the unlock cookie above, on a different surface: it
 * records which WhatsApp account the operator says is installed on THIS handset.
 * It is signed for the same reason the unlock cookie is — the browser holds it,
 * so an unsigned value is a value the holder chooses — but it authorizes
 * nothing. A forged one buys an attacker the ability to be shown an
 * interstitial.
 *
 * The two failure modes that matter here are distinguishing "nothing was ever
 * declared on this device" from "something else was declared", because the first
 * must re-ask and the second must block and explain.
 */
describe("the device declaration cookie", () => {
  const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const BETO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("reads back exactly the sender that was declared", () => {
    expect(readDeviceSenderCookie(signDeviceSenderCookie(ANA))).toBe(ANA);
  });

  it("reads back the OTHER sender when that is what was declared", () => {
    expect(readDeviceSenderCookie(signDeviceSenderCookie(BETO))).toBe(BETO);
  });

  it("distinguishes an absent declaration from a mismatched one", () => {
    // Two different outcomes, deliberately: absent must send the operator back
    // to the picker, mismatched must block with an explanation. Collapsing them
    // would make clearing site data look like the bride using the groom's phone.
    expect(classifyDeviceDeclaration(readDeviceSenderCookie(null), ANA)).toBe(
      "undeclared",
    );
    expect(classifyDeviceDeclaration(readDeviceSenderCookie(""), ANA)).toBe(
      "undeclared",
    );
    expect(
      classifyDeviceDeclaration(
        readDeviceSenderCookie(signDeviceSenderCookie(BETO)),
        ANA,
      ),
    ).toBe("mismatch");
  });

  it("refuses a value whose payload was edited", () => {
    const signed = signDeviceSenderCookie(ANA);
    const [, signature] = signed.split(".");
    const forged = `${Buffer.from(JSON.stringify({ senderId: BETO }), "utf8").toString("base64url")}.${signature}`;

    expect(readDeviceSenderCookie(forged)).toBeNull();
  });

  it("refuses a value signed with a different secret", () => {
    const signed = signDeviceSenderCookie(ANA);
    vi.stubEnv("OPERATOR_SESSION_SECRET", OTHER_SECRET);

    expect(readDeviceSenderCookie(signed)).toBeNull();
  });

  it("refuses a malformed value without throwing", () => {
    expect(readDeviceSenderCookie("not-a-cookie")).toBeNull();
    expect(readDeviceSenderCookie(".")).toBeNull();
    expect(readDeviceSenderCookie("a.b.c")).toBeNull();
  });

  it("refuses a forwarded operator-identity header as a declaration", () => {
    // Both values are HMACed with OPERATOR_SESSION_SECRET, so without domain
    // separation in the signed payload one could be replayed as the other.
    const identity =
      "eyJhdXRoVXNlcklkIjoiYWFhIiwiZW1haWwiOiJhbmFAZXhhbXBsZS50ZXN0In0.c2lnbmF0dXJl";

    expect(readDeviceSenderCookie(identity)).toBeNull();
  });

  it("is scoped to the console, unreadable by scripts, and lasts a year", () => {
    const options = deviceSenderCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/console");
    expect(options.sameSite).toBe("lax");
    expect(options.maxAge).toBe(DEVICE_SENDER_COOKIE_MAX_AGE_SECONDS);
    expect(DEVICE_SENDER_COOKIE_MAX_AGE_SECONDS).toBe(365 * 24 * 60 * 60);
  });
});
