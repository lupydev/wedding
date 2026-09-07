import { afterEach, describe, expect, it } from "vitest";

import {
  gateIpPepper,
  requiredDefaultPhoneCountry,
  siteOrigin,
  unlockCookieSecret,
} from "./env";

const ORIGINAL_ENV = { ...process.env };
const STRONG_SECRET = "s".repeat(32);

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("requiredDefaultPhoneCountry", () => {
  it("returns the configured country as a validated country code", () => {
    process.env.DEFAULT_PHONE_COUNTRY = "CO";

    expect(requiredDefaultPhoneCountry()).toBe("CO");
  });

  it("accepts a lowercase value and upper-cases it", () => {
    process.env.DEFAULT_PHONE_COUNTRY = "co";

    expect(requiredDefaultPhoneCountry()).toBe("CO");
  });

  it("throws the named error when the value is unset", () => {
    delete process.env.DEFAULT_PHONE_COUNTRY;

    expect(() => requiredDefaultPhoneCountry()).toThrow(
      /DEFAULT_PHONE_COUNTRY is not set/,
    );
  });

  it("throws when the value is not a supported country code", () => {
    process.env.DEFAULT_PHONE_COUNTRY = "MEX";

    expect(() => requiredDefaultPhoneCountry()).toThrow(
      /not a supported ISO 3166-1 alpha-2 country code/,
    );
  });
});

describe("unlockCookieSecret", () => {
  it("returns the configured secret", () => {
    process.env.UNLOCK_COOKIE_SECRET = STRONG_SECRET;

    expect(unlockCookieSecret()).toBe(STRONG_SECRET);
  });

  it("throws when unset", () => {
    delete process.env.UNLOCK_COOKIE_SECRET;

    expect(() => unlockCookieSecret()).toThrow(/UNLOCK_COOKIE_SECRET/);
  });

  it("rejects a secret too short to be an HMAC key", () => {
    process.env.UNLOCK_COOKIE_SECRET = "short";

    expect(() => unlockCookieSecret()).toThrow(/at least 32 characters/);
  });
});

describe("gateIpPepper", () => {
  it("returns the configured pepper", () => {
    process.env.GATE_IP_PEPPER = STRONG_SECRET;

    expect(gateIpPepper()).toBe(STRONG_SECRET);
  });

  it("rejects a pepper too short to resist enumeration", () => {
    process.env.GATE_IP_PEPPER = "pepper";

    expect(() => gateIpPepper()).toThrow(/at least 32 characters/);
  });
});

describe("siteOrigin", () => {
  it("returns the configured origin", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://boda.example.com";

    expect(siteOrigin()).toBe("https://boda.example.com");
  });

  it("drops a trailing slash so callers can concatenate a path safely", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://boda.example.com/";

    expect(siteOrigin()).toBe("https://boda.example.com");
  });

  it("rejects a value that is not an absolute origin", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "boda.example.com";

    expect(() => siteOrigin()).toThrow(/absolute/);
  });

  it("throws when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;

    expect(() => siteOrigin()).toThrow(/NEXT_PUBLIC_SITE_ORIGIN/);
  });
});
