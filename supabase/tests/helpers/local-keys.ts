import { execFileSync } from "node:child_process";

/**
 * Resolves the local Supabase API keys.
 *
 * The keys are generated per project, so they are never hard-coded here. They
 * are read from the environment when provided (CI), otherwise from
 * `supabase status -o env`, which is the CLI's own machine-readable output.
 */
export interface LocalKeys {
  readonly anonKey: string;
  readonly secretKey: string;
}

let cached: LocalKeys | null = null;

function parseEnvOutput(output: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const line of output.split("\n")) {
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    values.set(key, raw.replace(/^"(.*)"$/, "$1"));
  }

  return values;
}

export function resolveLocalKeys(): LocalKeys {
  if (cached) {
    return cached;
  }

  const fromEnv = {
    anonKey: process.env.SUPABASE_ANON_KEY ?? "",
    secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  };

  if (fromEnv.anonKey && fromEnv.secretKey) {
    cached = fromEnv;
    return cached;
  }

  let output: string;
  try {
    output = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (cause) {
    throw new Error(
      "Cannot resolve local Supabase keys. Run `supabase start`, or set " +
        "SUPABASE_ANON_KEY and SUPABASE_SECRET_KEY. " +
        `Underlying error: ${(cause as Error).message}`,
    );
  }

  const values = parseEnvOutput(output);
  const anonKey = values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY") ?? "";
  const secretKey =
    values.get("SECRET_KEY") ?? values.get("SERVICE_ROLE_KEY") ?? "";

  if (!anonKey || !secretKey) {
    throw new Error(
      `supabase status did not report the expected keys. Saw: ${[...values.keys()].join(", ")}`,
    );
  }

  cached = { anonKey, secretKey };
  return cached;
}
