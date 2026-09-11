import { randomBytes } from "node:crypto";

import { Client } from "pg";

/**
 * Console-operator fixtures for the browser-level suite.
 *
 * `senders` IS the allowlist, so seeding an operator means inserting a row —
 * there is no environment variable to set and no redeploy to wait for, which is
 * the whole point of design decision D7.
 *
 * The `auth.users` row is NOT seeded. It is created by Supabase Auth when the
 * magic link is first followed, and watching `senders.auth_user_id` go from
 * NULL to that user's id is how the binding is asserted rather than assumed.
 */

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export interface SeededOperator {
  readonly senderId: string;
  readonly displayName: string;
  readonly allowlistedEmail: string;
  /** Fabricated. Never used to build a dispatch link; `wa.me` has no sender. */
  readonly contactPhone: string;
  /** The bound auth user id, read straight from the row. NULL until first login. */
  readonly boundAuthUserId: () => Promise<string | null>;
  readonly cleanup: () => Promise<void>;
}

async function connect(): Promise<Client> {
  const db = new Client({ connectionString: LOCAL_DB_URL });

  try {
    await db.connect();
  } catch (cause) {
    throw new Error(
      `Cannot reach the local Supabase database at ${LOCAL_DB_URL}. ` +
        "Run `supabase start` before the E2E suite. " +
        `Underlying error: ${(cause as Error).message}`,
    );
  }

  return db;
}

export async function seedOperator(
  options: { displayName?: string } = {},
): Promise<SeededOperator> {
  const suffix = randomBytes(4).toString("hex");
  const allowlistedEmail = `operator.${suffix}.${Date.now()}@example.test`;
  const displayName = options.displayName ?? `Operadora ${suffix}`;
  const contactPhone = `+5730055${suffix.slice(0, 2).replace(/\D/g, "1")}00`;
  const db = await connect();

  let senderId: string;
  try {
    const inserted = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ($1, 'partner_a', $2, $3)
       returning id`,
      [displayName, allowlistedEmail, contactPhone],
    );
    senderId = inserted.rows[0].id;
  } finally {
    await db.end();
  }

  return {
    senderId,
    displayName,
    allowlistedEmail,
    contactPhone,

    boundAuthUserId: async () => {
      const reader = await connect();
      try {
        const result = await reader.query<{ auth_user_id: string | null }>(
          "select auth_user_id from senders where id = $1",
          [senderId],
        );

        return result.rows[0]?.auth_user_id ?? null;
      } finally {
        await reader.end();
      }
    },

    cleanup: async () => {
      const cleaner = await connect();
      try {
        const bound = await cleaner.query<{ auth_user_id: string | null }>(
          "select auth_user_id from senders where id = $1",
          [senderId],
        );

        await cleaner.query("delete from senders where id = $1", [senderId]);

        const authUserId = bound.rows[0]?.auth_user_id ?? null;
        if (authUserId) {
          await cleaner.query("delete from auth.users where id = $1", [
            authUserId,
          ]);
        }
      } finally {
        await cleaner.end();
      }
    },
  };
}

interface MailpitSummary {
  readonly ID: string;
  readonly To: ReadonlyArray<{ readonly Address: string }>;
}

/** Every message currently held for one address, newest first. */
export async function messagesFor(address: string): Promise<MailpitSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=200`);

  if (!response.ok) {
    throw new Error(
      `Mailpit is not reachable at ${MAILPIT_URL} (HTTP ${response.status}). ` +
        "Run `supabase start` before the E2E suite.",
    );
  }

  const body = (await response.json()) as { messages?: MailpitSummary[] };

  return (body.messages ?? []).filter((message) =>
    message.To.some(
      (recipient) => recipient.Address.toLowerCase() === address.toLowerCase(),
    ),
  );
}

/**
 * The magic link Supabase mailed to one address.
 *
 * Polls, because delivery is asynchronous and a bare read races the send. Fails
 * with the address in the message so a flake is diagnosable.
 */
export async function waitForMagicLink(
  address: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [newest] = await messagesFor(address);

    if (newest) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`);
      const body = (await detail.json()) as {
        Text?: string;
        HTML?: string;
      };
      const source = `${body.HTML ?? ""}\n${body.Text ?? ""}`;
      const match = source.match(
        /https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/,
      );

      if (match) {
        return match[0].replace(/&amp;/g, "&");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `No magic link arrived for ${address} within ${timeoutMs}ms.`,
  );
}
