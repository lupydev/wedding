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

describe("isWellFormedSlug", () => {
  it.each([
    ["a valid slug", "aaaqeayeaudaocaj", true],
    ["all sevens", "7777777777777777", true],
    ["15 characters", "aaaqeayeaudaoca", false],
    ["17 characters", "aaaqeayeaudaocajx", false],
    ["an empty string", "", false],
    ["uppercase characters", "AAAQEAYEAUDAOCAJ", false],
    ["a digit outside the alphabet", "aaaqeayeaudaoca0", false],
    [
      "the digit 1, excluded to avoid confusion with l",
      "aaaqeayeaudaoca1",
      false,
    ],
    ["a hyphen", "aaaqeayeaudaoc-j", false],
    ["surrounding whitespace", " aaaqeayeaudaocaj ", false],
    ["a path traversal attempt", "../../etc/passwd", false],
  ])("classifies %s as %s", (_label, value, expected) => {
    expect(isWellFormedSlug(value)).toBe(expected);
  });

  it("accepts every slug encodeSlug produces", () => {
    for (const [bytes] of VECTORS) {
      expect(isWellFormedSlug(encodeSlug(Uint8Array.from(bytes)))).toBe(true);
    }
  });
});
