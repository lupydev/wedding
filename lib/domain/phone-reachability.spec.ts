import { describe, expect, it } from "vitest";

import {
  classifyPhoneDispatchability,
  isDispatchablePhone,
} from "./phone-reachability";

/**
 * Reachability is NOT validity.
 *
 * `normalizePhone` answers "can this be turned into E.164?", and a Colombian
 * landline answers yes. Nobody has WhatsApp on a landline, so a dispatch built
 * from one is delivered to nothing while the console reports it as sent. These
 * cases are the difference between the two questions.
 */
describe("classifyPhoneDispatchability", () => {
  it.each([
    // [label, input, defaultCountry, expected dispatchable, expected lineType]
    [
      "Colombian landline in E.164",
      "+57 601 234 5678",
      "CO",
      false,
      "fixed_line",
    ],
    [
      "Colombian landline, bare national digits",
      "6012345678",
      "CO",
      false,
      "fixed_line",
    ],
    [
      "Colombian landline in another area code",
      "+57 604 444 5555",
      "CO",
      false,
      "fixed_line",
    ],
    ["Colombian mobile in E.164", "+573001234567", "CO", true, "mobile"],
    [
      "Colombian mobile, bare national digits",
      "3001234567",
      "CO",
      true,
      "mobile",
    ],
    ["Colombian mobile with spaces", "300 123 4567", "CO", true, "mobile"],
    [
      "Mexican number whose range serves both lines",
      "+52 55 1234 5678",
      "MX",
      true,
      "fixed_line_or_mobile",
    ],
    [
      "Argentine mobile with the 9 prefix",
      "+54 9 11 2345 6789",
      "AR",
      true,
      "mobile",
    ],
    ["empty input", "", "CO", false, "not_normalizable"],
    ["garbage input", "not a phone", "CO", false, "not_normalizable"],
    [
      "structurally invalid Colombian number",
      "+57 1 234 5678",
      "CO",
      false,
      "not_normalizable",
    ],
  ])(
    "classifies %s as dispatchable=%j",
    (_label, input, country, dispatchable, lineType) => {
      expect(
        classifyPhoneDispatchability(input as string, country as string),
      ).toEqual({ dispatchable, lineType });
    },
  );

  it("does not treat an unusable default country as guest data", () => {
    // A misconfigured DEFAULT_PHONE_COUNTRY is a deployment fault, not a bad
    // guest row, and it must fail loudly exactly as `normalizePhone` does.
    expect(() => classifyPhoneDispatchability("3001234567", "ZZ")).toThrow(
      /not a supported ISO 3166-1 alpha-2 country code/,
    );
  });
});

describe("isDispatchablePhone", () => {
  it("answers true for a mobile", () => {
    expect(isDispatchablePhone("+573001234567", "CO")).toBe(true);
  });

  it("answers false for a landline that normalizePhone accepts", () => {
    expect(isDispatchablePhone("+576012345678", "CO")).toBe(false);
  });
});
