import { afterEach, describe, expect, it } from "vitest";

import {
  consoleOrigin,
  gateIpPepper,
  operatorSessionSecret,
  requiredDefaultPhoneCountry,
  siteOrigin,
  supabasePublishableKey,
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

describe("supabasePublishableKey", () => {
  it("returns the configured publishable key", () => {
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AbCdEf";

    expect(supabasePublishableKey()).toBe("sb_publishable_AbCdEf");
  });

  it("refuses the secret key, which must never reach an auth client", () => {
    // The auth client this key feeds runs as the signed-in operator. Handing it
    // the service_role key would make every console request bypass RLS with a
    // credential that also travels to the middleware.
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_NotThisOne";

    expect(() => supabasePublishableKey()).toThrow(/publishable key/);
  });

  it("throws when unset", () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;

    expect(() => supabasePublishableKey()).toThrow(
      /SUPABASE_PUBLISHABLE_KEY is not set/,
    );
  });
});

describe("operatorSessionSecret", () => {
  it("returns the configured secret", () => {
    process.env.OPERATOR_SESSION_SECRET = STRONG_SECRET;

    expect(operatorSessionSecret()).toBe(STRONG_SECRET);
  });

  it("rejects a secret too short to sign a forwarded identity", () => {
    process.env.OPERATOR_SESSION_SECRET = "short";

    expect(() => operatorSessionSecret()).toThrow(/at least 32 characters/);
  });

  it("throws when unset", () => {
    delete process.env.OPERATOR_SESSION_SECRET;

    expect(() => operatorSessionSecret()).toThrow(/OPERATOR_SESSION_SECRET/);
  });
});

describe("consoleOrigin", () => {
  it("falls back to the public site origin", () => {
    delete process.env.CONSOLE_ORIGIN;
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://boda.example.com";

    expect(consoleOrigin()).toBe("https://boda.example.com");
  });

  it("uses the explicit console origin when one is configured", () => {
    // The magic link is emailed, so the origin in it must be an address the
    // operator's browser can actually reach. That is not always the public
    // invitation origin: a preview deployment, a tunnel, or the E2E server on
    // a free port all serve the console somewhere else.
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://boda.example.com";
    process.env.CONSOLE_ORIGIN = "http://localhost:3100";

    expect(consoleOrigin()).toBe("http://localhost:3100");
  });

  it("drops a trailing slash so a path can be appended safely", () => {
    process.env.CONSOLE_ORIGIN = "http://localhost:3100/";

    expect(consoleOrigin()).toBe("http://localhost:3100");
  });

  it("rejects a console origin that is not absolute", () => {
    // A relative value would produce a magic link pointing nowhere, and the
    // operator would be locked out with no error to read.
    process.env.CONSOLE_ORIGIN = "localhost:3100";

    expect(() => consoleOrigin()).toThrow(/absolute/);
  });
});
