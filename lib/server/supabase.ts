import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The privileged Supabase client. Server-only, by construction.
 *
 * `import 'server-only'` is the first line on purpose: it is the single
 * highest-value mechanical guard in the product. A stray Client Component
 * import of this module becomes a BUILD ERROR rather than a runtime data leak
 * that ships guest phone numbers to a browser.
 *
 * The key used here is the `sb_secret_` key, which maps to `service_role` and
 * therefore has BYPASSRLS. That is deliberate — the browser holds no Supabase
 * client for guest data at all, so RLS default-deny (migration 0002) is the
 * guard against the publishable key, and `server-only` plus the append-only
 * triggers (migration 0003) are the guards against this one.
 */

/** Reads a required environment variable or fails with an actionable message. */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not set. The server Supabase client cannot be created without it.`,
    );
  }

  return value;
}

export function createServerSupabaseClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");

  if (secretKey.startsWith("sb_publishable_")) {
    // Without this check the mistake is silent: every server read would run as
    // the default-deny anon role and the symptom would be "the guest list is
    // empty" rather than a configuration error anyone can act on.
    throw new Error(
      "SUPABASE_SECRET_KEY holds a publishable key. The server client requires the secret key.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      // No browser is involved: nothing to persist, nothing to refresh, and no
      // session should ever be written to storage by this client.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
