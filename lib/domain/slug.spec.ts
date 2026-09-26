import { describe, expect, it } from "vitest";

import { SLUG_BYTE_LENGTH, encodeSlug, isWellFormedSlug } from "./slug";

// Randomness is injected, never sourced here (design decision D2): the domain
// stays importable under `environment: 'node'` with zero mocking, and the ESLint
// zone that forbids `node:*` inside `lib/domain/**` stays intact. The adapter
// supplies `randomBytes(SLUG_BYTE_LENGTH)`.
//
// 10 bytes = 80 bits of entropy, well above the required 64, and encodes to
// exactly 16 base32 characters with no padding and no truncation bias.

// Expected values below are RFC 4648 base32 (lowercase, unpadded), taken from a
// reference implementation rather than from the code under test.
const VECTORS: ReadonlyArray<readonly [number[], string]> = [
  [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "aaaaaaaaaaaaaaaa"],
  [[255, 255, 255, 255, 255, 255, 255, 255, 255, 255], "7777777777777777"],
  [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "aaaqeayeaudaocaj"],
  [[24, 43, 60, 77, 94, 111, 112, 129, 146, 163], "davtytk6n5yidevd"],
];

describe("SLUG_BYTE_LENGTH", () => {
  it("is 10 bytes, which is 80 bits of entropy", () => {
    expect(SLUG_BYTE_LENGTH).toBe(10);
    expect(SLUG_BYTE_LENGTH * 8).toBeGreaterThanOrEqual(64);
  });
});

describe("encodeSlug", () => {
  it.each(VECTORS)("encodes %j as RFC 4648 base32", (bytes, expected) => {
    expect(encodeSlug(Uint8Array.from(bytes))).toBe(expected);
  });

  it("produces exactly 16 characters from the alphabet [a-z2-7]", () => {
    const slug = encodeSlug(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

    expect(slug).toHaveLength(16);
    expect(slug).toMatch(/^[a-z2-7]{16}$/);
  });

  it("changes the output when a single input bit changes", () => {
    const a = encodeSlug(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const b = encodeSlug(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]));

    expect(a).not.toBe(b);
  });

  it.each([
    ["9 bytes", 9],
    ["11 bytes", 11],
    ["0 bytes", 0],
  ])("rejects %s rather than emitting a shorter slug", (_label, length) => {
    expect(() => encodeSlug(new Uint8Array(length))).toThrow(
      /SLUG_BYTE_LENGTH|10 bytes/,
    );
  });

  it("produces 10000 unique, well-formed slugs from random bytes", () => {
    // Web Crypto on globalThis: available in Node and in browsers, and needs no
    // import, so the domain's no-`node:*` boundary is untouched.
    const samples = 10_000;
    const slugs = new Set<string>();

    for (let i = 0; i < samples; i += 1) {
      const bytes = globalThis.crypto.getRandomValues(
        new Uint8Array(SLUG_BYTE_LENGTH),
      );
      const slug = encodeSlug(bytes);

      expect(isWellFormedSlug(slug)).toBe(true);
      slugs.add(slug);
    }

    expect(slugs.size).toBe(samples);
  });

  it("omits the visually ambiguous characters 0, 1, 8 and 9", () => {
    // Base32's alphabet is what makes a slug safe to read aloud over the phone
    // when a guest cannot open the link: no 0/O and no 1/l confusion.
    const slug = encodeSlug(
      Uint8Array.from([255, 0, 170, 85, 15, 240, 51, 204, 129, 126]),
    );

    expect(slug).toMatch(/^[a-z2-7]{16}$/);
    for (const forbidden of ["0", "1", "8", "9"]) {
      expect(slug).not.toContain(forbidden);
    }
  });
});

/**
 * THE LENGTH AND ALPHABET CASES CHANGED, AND THEY CHANGED FOR A REASON.
 *
 * This table used to refuse 15 characters, 17 characters, the digit 0 and any
 * hyphen — the exact shape `encodeSlug` produces and nothing else. Migration
 * 0014 widened `invitations.slug` to readable addresses derived from the
 * household's name, so those are now legal stored values and a guard that
 * refused them would turn every readable link into a 404.
 *
 * What the table still protects is the part that was never about length:
 * uppercase, whitespace, and anything that could walk a path.
 */
describe("isWellFormedSlug", () => {
  it.each([
    ["a random slug", "aaaqeayeaudaocaj", true],
    ["all sevens", "7777777777777777", true],
    ["a readable address", "familia-guzman-pena", true],
    ["a readable address with a counter", "familia-ruiz-2", true],
    ["a short name", "ana", true],
    ["the digit 0, legal since the column accepts digits", "mesa-10", true],
    ["an empty string", "", false],
    ["uppercase characters", "AAAQEAYEAUDAOCAJ", false],
    ["a leading hyphen", "-familia-ruiz", false],
    ["a trailing hyphen", "familia-ruiz-", false],
    ["a doubled hyphen", "familia--ruiz", false],
    ["an underscore", "familia_ruiz", false],
    ["longer than the column allows", "a".repeat(49), false],
    ["surrounding whitespace", " aaaqeayeaudaocaj ", false],
    ["an inner space", "familia ruiz", false],
    ["a path traversal attempt", "../../etc/passwd", false],
  ])("classifies %s as %s", (_label, value, expected) => {
    expect(isWellFormedSlug(value)).toBe(expected);
  });

  it("accepts every slug encodeSlug produces", () => {
    for (const [bytes] of VECTORS) {
      expect(isWellFormedSlug(encodeSlug(Uint8Array.from(bytes)))).toBe(true);
    }
  });

  /**
   * READABLE ADDRESSES PASS THE GUARD TOO.
   *
   * Since migration 0014 an invitation's address is derived from the
   * household's name — `/i/familia-guzman-pena` — and the column's check
   * accepts lowercase letters, digits and single hyphens up to 48 characters.
   * This guard runs BEFORE any lookup, so a shape it refuses is a shape no real
   * invitation can be found at: left at sixteen base32 characters it would have
   * turned every readable link into a 404, and the failure would have looked
   * like a missing invitation rather than a rejected path.
   */
  describe("a readable address", () => {
    it("accepts the shape the column now stores", () => {
      expect(isWellFormedSlug("familia-guzman-pena")).toBe(true);
      expect(isWellFormedSlug("tia-marta")).toBe(true);
      expect(isWellFormedSlug("familia-ruiz-2")).toBe(true);
      expect(isWellFormedSlug("ana")).toBe(true);
    });

    it("still accepts the random addresses already stored", () => {
      expect(isWellFormedSlug("k22eth3lvkzptcco")).toBe(true);
    });

    /**
     * And refuses the shapes the column refuses, so the two cannot disagree.
     *
     * A guard looser than the constraint sends junk to the database; a guard
     * tighter than it turns stored rows into 404s. Both are the same bug seen
     * from opposite ends.
     */
    it("refuses what the column would refuse", () => {
      expect(isWellFormedSlug("Familia-Ruiz")).toBe(false);
      expect(isWellFormedSlug("familia_ruiz")).toBe(false);
      expect(isWellFormedSlug("-familia")).toBe(false);
      expect(isWellFormedSlug("familia-")).toBe(false);
      expect(isWellFormedSlug("familia--ruiz")).toBe(false);
      expect(isWellFormedSlug("")).toBe(false);
      expect(isWellFormedSlug("a".repeat(49))).toBe(false);
      expect(isWellFormedSlug("familia ruiz")).toBe(false);
      expect(isWellFormedSlug("../etc")).toBe(false);
    });
  });
});
