import { describe, expect, it } from "vitest";

import {
  deriveGateKey,
  matchesInvitation,
  normalizeForStorage,
  normalizePhone,
  resolveDefaultCountry,
} from "./phone";

// Phone normalization is the highest-risk pure function in the product: a guest
// who cannot be matched cannot open their own invitation. The table below is
// deliberately written against real-world input shapes rather than a happy path.

describe("normalizePhone", () => {
  it.each([
    // [label, input, defaultCountry, expected e164, expected last8]
    // Every guest on this list is a Colombian mobile: 10 national digits behind
    // country code 57. These five shapes are what the address books actually
    // contain, so they are the rows that decide whether a guest gets in.
    [
      "Colombian mobile, bare national digits",
      "3001234567",
      "CO",
      "+573001234567",
      "01234567",
    ],
    [
      "Colombian mobile, national digits with spaces",
      "300 123 4567",
      "CO",
      "+573001234567",
      "01234567",
    ],
    [
      "Colombian mobile in E.164",
      "+573001234567",
      "CO",
      "+573001234567",
      "01234567",
    ],
    [
      "Colombian mobile with a spaced country code and no plus",
      "57 300 123 4567",
      "CO",
      "+573001234567",
      "01234567",
    ],
    [
      "Colombian mobile with a plus and irregular grouping",
      "+57 300 1234567",
      "CO",
      "+573001234567",
      "01234567",
    ],
    [
      "E.164 already, with spaces",
      "+52 55 1234 5678",
      "MX",
      "+525512345678",
      "12345678",
    ],
    [
      "national format, no country code",
      "55 1234 5678",
      "MX",
      "+525512345678",
      "12345678",
    ],
    [
      "parentheses and dashes",
      "(55) 1234-5678",
      "MX",
      "+525512345678",
      "12345678",
    ],
    [
      "Argentine 9 mobile prefix with country code",
      "+54 9 11 2345 6789",
      "AR",
      "+5491123456789",
      "23456789",
    ],
    [
      "Argentine 9 mobile prefix, national format",
      "9 11 2345-6789",
      "AR",
      "+5491123456789",
      "23456789",
    ],
    [
      "US number with country code",
      "+1 (415) 555-2671",
      "US",
      "+14155552671",
      "55552671",
    ],
    [
      "US number, national format",
      "415 555 2671",
      "US",
      "+14155552671",
      "55552671",
    ],
    [
      "explicit country code overrides the default country",
      "+1 415-555-2671",
      "MX",
      "+14155552671",
      "55552671",
    ],
    [
      "surrounding whitespace and a trailing dot",
      "  +52 55 1234 5678 ",
      "MX",
      "+525512345678",
      "12345678",
    ],
  ])("normalizes %s", (_label, input, country, expectedE164, expectedLast8) => {
    const result = normalizePhone(input, country);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.e164).toBe(expectedE164);
    expect(result.last8).toBe(expectedLast8);
  });

  it("derives last8 as exactly the final eight digits of the E.164 value", () => {
    const result = normalizePhone("+54 9 11 2345 6789", "AR");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.last8).toBe(result.e164.slice(-8));
    expect(result.last8).toHaveLength(8);
  });

  it.each([
    ["an empty string", "", "empty"],
    ["a whitespace-only string", "   ", "empty"],
    ["alphabetic garbage", "not a phone", "unparseable"],
    ["punctuation only", "+", "unparseable"],
    // "12" is parseable as a national MX number (+5212) but is not a valid
    // number, so the failure reason is "invalid", not "unparseable".
    ["too few digits to be a number", "12", "invalid"],
    [
      "a digit string that is not a valid number",
      "+52 00 0000 0000",
      "invalid",
    ],
    [
      "a non-Mexican international number of the wrong length",
      "+1 415 555 267",
      "invalid",
    ],
  ])("rejects %s without throwing", (_label, input, expectedReason) => {
    const result = normalizePhone(input, "MX");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(expectedReason);
  });

  it.each([
    ["a non-ISO token", "MEX"],
    ["an unsupported region code", "ZZ"],
    ["a phone calling code", "57"],
  ])(
    "throws a named configuration error for %s rather than producing garbage",
    (_label, country) => {
      // A misconfigured default country is a deployment fault, not guest data:
      // silently casting it would mis-normalize every nationally formatted
      // phone and those guests would never match at the gate.
      expect(() => normalizePhone("300 123 4567", country)).toThrow(
        /DEFAULT_PHONE_COUNTRY/,
      );
    },
  );

  it("throws when the default country is unset", () => {
    expect(() => normalizePhone("300 123 4567", "")).toThrow(
      /DEFAULT_PHONE_COUNTRY/,
    );
  });

  it("accepts a lowercase default country", () => {
    const result = normalizePhone("300 123 4567", "co");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.e164).toBe("+573001234567");
  });
});

describe("normalizeForStorage", () => {
  it.each([
    ["300 123 4567", "CO", "+573001234567"],
    ["+57 300 1234567", "CO", "+573001234567"],
    ["+52 55 1234 5678", "MX", "+525512345678"],
    ["9 11 2345-6789", "AR", "+5491123456789"],
    ["(415) 555-2671", "US", "+14155552671"],
  ])("stores %s as E.164", (input, country, expected) => {
    expect(normalizeForStorage(input, country)).toBe(expected);
  });

  it.each([
    ["an empty string", ""],
    ["garbage", "not a phone"],
    ["an invalid number", "+52 00 0000 0000"],
  ])("throws on %s rather than storing an unusable value", (_label, input) => {
    expect(() => normalizeForStorage(input, "MX")).toThrow(
      /cannot be normalized/i,
    );
  });

  it("names the failure reason in the thrown error", () => {
    expect(() => normalizeForStorage("", "MX")).toThrow(/empty/);
  });

  it("never includes the raw input in the error message", () => {
    // Guest phone numbers are personal data and must not leak into logs.
    try {
      normalizeForStorage("+52 00 0000 0000", "MX");
      throw new Error("expected normalizeForStorage to throw");
    } catch (error) {
      expect((error as Error).message).not.toContain("0000");
    }
  });
});

describe("deriveGateKey", () => {
  it.each([
    ["digits with punctuation", "(55) 1234-5678", "12345678"],
    ["an E.164 value", "+525512345678", "12345678"],
    ["a longer international number", "+5491123456789", "23456789"],
    ["exactly eight digits", "12345678", "12345678"],
    ["digits mixed with letters", "call 55 1234 5678 now", "12345678"],
    ["leading and trailing whitespace", "  5512345678  ", "12345678"],
  ])("derives the last eight digits from %s", (_label, input, expected) => {
    expect(deriveGateKey(input)).toBe(expected);
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["seven digits", "1234567"],
    ["no digits at all", "no digits here"],
  ])("returns null for %s", (_label, input) => {
    expect(deriveGateKey(input)).toBeNull();
  });
});

describe("matchesInvitation", () => {
  const guests = [
    { phone_last8: "11112222" },
    { phone_last8: "12345678" },
    { phone_last8: null },
  ];

  it("matches the second guest, not only the first", () => {
    expect(matchesInvitation("+52 55 1234 5678", guests)).toBe(true);
  });

  it("matches the first guest", () => {
    expect(matchesInvitation("55 1111 2222", guests)).toBe(true);
  });

  it("rejects a one-digit near-miss against every guest", () => {
    expect(matchesInvitation("+52 55 1234 5679", guests)).toBe(false);
  });

  it("rejects an empty submission even though a guest has a null phone", () => {
    // The DB stores NULL rather than '' precisely so this can never match.
    expect(matchesInvitation("", guests)).toBe(false);
    expect(matchesInvitation("   ", guests)).toBe(false);
  });

  it("rejects a submission with fewer than eight digits", () => {
    expect(matchesInvitation("1234567", guests)).toBe(false);
  });

  it("returns false when the invitation has no guests", () => {
    expect(matchesInvitation("+52 55 1234 5678", [])).toBe(false);
  });

  it("ignores guests whose stored last8 is null", () => {
    expect(matchesInvitation("+52 55 1234 5678", [{ phone_last8: null }])).toBe(
      false,
    );
  });
});

describe("resolveDefaultCountry", () => {
  // DEFAULT_PHONE_COUNTRY is an environment variable and its production value is
  // still undecided. The domain never reads the environment (it stays pure), so
  // this is the guard that turns a missing or bogus value into a loud failure
  // instead of a country silently defaulting to something wrong.
  it.each([
    ["MX", "MX"],
    ["AR", "AR"],
    ["US", "US"],
    ["mx", "MX"],
    [" ar ", "AR"],
  ])("accepts %s and normalizes it to %s", (raw, expected) => {
    expect(resolveDefaultCountry(raw)).toBe(expected);
  });

  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("throws a named error when the value is %s", (_label, raw) => {
    expect(() => resolveDefaultCountry(raw)).toThrow(/DEFAULT_PHONE_COUNTRY/);
    expect(() => resolveDefaultCountry(raw)).toThrow(/not set/i);
  });

  it.each([
    ["a non-ISO token", "MEX"],
    ["an unsupported region code", "ZZ"],
    ["a phone calling code", "52"],
  ])("throws a named error for %s", (_label, raw) => {
    expect(() => resolveDefaultCountry(raw)).toThrow(/DEFAULT_PHONE_COUNTRY/);
    expect(() => resolveDefaultCountry(raw)).toThrow(/not a supported/i);
  });

  it("feeds normalizePhone so a resolved country actually parses", () => {
    const country = resolveDefaultCountry("mx");
    const result = normalizePhone("55 1234 5678", country);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.e164).toBe("+525512345678");
  });
});
