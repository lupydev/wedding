import { afterEach, describe, expect, it } from "vitest";

import { withSeededData } from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";
import { createServerSupabaseClient } from "./supabase";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("createServerSupabaseClient", () => {
  it("fails loudly when SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = "sb_secret_placeholder";

    expect(() => createServerSupabaseClient()).toThrow(/SUPABASE_URL/);
  });

  it("fails loudly when SUPABASE_SECRET_KEY is missing", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    delete process.env.SUPABASE_SECRET_KEY;

    expect(() => createServerSupabaseClient()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("refuses a publishable key handed to it by mistake", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = "sb_publishable_something";

    // A publishable key in the secret slot would silently downgrade every
    // server read to the default-deny anon role, and the symptom would be
    // "the guest list is empty" rather than an error.
    expect(() => createServerSupabaseClient()).toThrow(/publishable/i);
  });

  it("reads rows the publishable key is denied", async () => {
    const { anonKey, secretKey } = resolveLocalKeys();
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SECRET_KEY = secretKey;

    const { viaSecretKey, viaAnonKey } = await withSeededData(
      async ({ invitationId }) => {
        const server = createServerSupabaseClient();
        const privileged = await server
          .from("invitations")
          .select("id, greeting_name")
          .eq("id", invitationId);

        const { createClient } = await import("@supabase/supabase-js");
        const anon = createClient("http://127.0.0.1:54321", anonKey);
        const denied = await anon
          .from("invitations")
          .select("id")
          .eq("id", invitationId);

        return {
          viaSecretKey: privileged.data ?? [],
          viaAnonKey: denied.data ?? [],
        };
      },
    );

    expect(viaSecretKey).toEqual([
      { id: expect.any(String), greeting_name: "Familia Prueba" },
    ]);
    expect(viaAnonKey).toEqual([]);
  });
});
