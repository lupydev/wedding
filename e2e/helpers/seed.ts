import { randomBytes } from "node:crypto";

import { Client } from "pg";

/**
 * Committed fixtures for the browser-level suite.
 *
 * The DB unit tests roll every fixture back, because they own the connection
 * that reads it. These do not: the Next.js server under test is a separate
 * process with its own connection pool, so a rolled-back invitation would be
 * invisible to it and every assertion would be measuring an unknown slug.
 *
 * Fixtures are therefore committed and removed explicitly in `afterAll`.
 */

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Base32 alphabet the `invitations.slug` CHECK constraint accepts. */
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function makeSlug(): string {
  let slug = "";

  for (const byte of randomBytes(16)) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }

  return slug;
}

export interface SeededGuest {
  readonly fullName: string;
  /** Fabricated. A real guest number must never enter a fixture. */
  readonly phoneE164?: string;
  readonly isChild?: boolean;
}

export interface SeededInvitation {
  readonly slug: string;
  readonly greetingName: string;
  readonly displayName: string;
  /** The OWNING sender's WhatsApp contact, which the gate's recovery link uses. */
  readonly ownerContactPhone: string;
  readonly guests: readonly SeededGuest[];
  /** Removes the fixture and its owner sender. */
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

/**
 * Creates one committed invitation with the given household and guests.
 *
 * Phone numbers are fabricated and belong to the reserved-looking local test
 * range. No real guest number may ever enter a fixture, a seed, or a log.
 */
export async function seedInvitation(options: {
  greetingName: string;
  displayName?: string;
  seatsAllowed?: number;
  /**
   * Fabricated owner contact. Varying it per fixture is what makes the gate's
   * recovery-link assertion meaningful: a single hard-coded value would pass
   * even if the link addressed the wrong sender entirely.
   */
  ownerContactPhone?: string;
  guests: readonly SeededGuest[];
}): Promise<SeededInvitation> {
  const db = await connect();
  const suffix = randomBytes(4).toString("hex");
  const slug = makeSlug();
  const displayName = options.displayName ?? options.greetingName;
  const ownerContactPhone = options.ownerContactPhone ?? "+573005550000";

  try {
    const sender = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ($1, 'partner_a', $2, $3)
       returning id`,
      [
        `E2E Sender ${suffix}`,
        `e2e.${suffix}.${Date.now()}@example.test`,
        ownerContactPhone,
      ],
    );
    const senderId = sender.rows[0].id;

    const invitation = await db.query<{ id: string }>(
      `insert into invitations (slug, owner_sender_id, display_name, greeting_name, seats_allowed)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        slug,
        senderId,
        displayName,
        options.greetingName,
        options.seatsAllowed ?? options.guests.length,
      ],
    );
    const invitationId = invitation.rows[0].id;

    for (const guest of options.guests) {
      await db.query(
        `insert into invitation_guests (invitation_id, full_name, phone_e164, is_child)
         values ($1, $2, $3, $4)`,
        [
          invitationId,
          guest.fullName,
          guest.phoneE164 ?? null,
          guest.isChild ?? false,
        ],
      );
    }

    return {
      slug,
      greetingName: options.greetingName,
      displayName,
      ownerContactPhone,
      guests: options.guests,
      cleanup: async () => {
        const cleaner = await connect();
        try {
          // User triggers are suspended for this session only: the child tables
          // are append-only by trigger and would refuse their own teardown.
          await cleaner.query("set session_replication_role = replica");
          await cleaner.query(
            "delete from invitation_guests where invitation_id = $1",
            [invitationId],
          );
          await cleaner.query("delete from invitations where id = $1", [
            invitationId,
          ]);
          await cleaner.query("delete from senders where id = $1", [senderId]);
          await cleaner.query("reset session_replication_role");
        } finally {
          await cleaner.end();
        }
      },
    };
  } finally {
    await db.end();
  }
}
