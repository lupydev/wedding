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

export interface SeededRsvpRow {
  readonly attending: boolean;
  readonly seatsConfirmed: number;
  readonly attendeeGuestIds: readonly string[];
  readonly dietaryNotes: string | null;
}

export interface SeededInvitation {
  readonly slug: string;
  /** The invitation's own id, for assertions that reach past the page. */
  readonly invitationId: string;
  readonly greetingName: string;
  readonly displayName: string;
  /** The OWNING sender's WhatsApp contact, which the gate's recovery link uses. */
  readonly ownerContactPhone: string;
  readonly guests: readonly SeededGuest[];
  /** Every stored response, oldest first. The append-only history itself. */
  readonly responseHistory: () => Promise<readonly SeededRsvpRow[]>;
  /**
   * The household's CURRENT answer, read through `rsvp_latest`.
   *
   * Through the view rather than by ordering the table here, because a test
   * that re-implements the reduction it is checking proves only that the test
   * agrees with itself.
   */
  readonly currentResponse: () => Promise<SeededRsvpRow | null>;
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
  /** ISO calendar day, or omitted for an invitation that never closes. */
  rsvpDeadline?: string | null;
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
      `insert into invitations (slug, owner_sender_id, display_name, greeting_name, seats_allowed, rsvp_deadline)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        slug,
        senderId,
        displayName,
        options.greetingName,
        options.seatsAllowed ?? options.guests.length,
        options.rsvpDeadline ?? null,
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
      invitationId,
      greetingName: options.greetingName,
      displayName,
      ownerContactPhone,
      guests: options.guests,
      responseHistory: async () =>
        readResponses(
          "select attending, seats_confirmed, attendee_guest_ids, dietary_notes " +
            "from rsvp_responses where invitation_id = $1 order by submitted_at, id",
          invitationId,
        ),

      currentResponse: async () => {
        const rows = await readResponses(
          "select attending, seats_confirmed, attendee_guest_ids, dietary_notes " +
            "from rsvp_latest where invitation_id = $1",
          invitationId,
        );

        return rows[0] ?? null;
      },

      cleanup: async () => {
        const cleaner = await connect();
        try {
          // User triggers are suspended for this session only: the child tables
          // are append-only by trigger and would refuse their own teardown.
          await cleaner.query("set session_replication_role = replica");
          await cleaner.query(
            "delete from rsvp_responses where invitation_id = $1",
            [invitationId],
          );
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

interface RsvpRow {
  attending: boolean;
  seats_confirmed: number;
  attendee_guest_ids: string[];
  dietary_notes: string | null;
}

/** Runs one RSVP read on its own connection and maps it to the test's shape. */
async function readResponses(
  sql: string,
  invitationId: string,
): Promise<readonly SeededRsvpRow[]> {
  const db = await connect();

  try {
    const result = await db.query<RsvpRow>(sql, [invitationId]);

    return result.rows.map((row) => ({
      attending: row.attending,
      seatsConfirmed: row.seats_confirmed,
      attendeeGuestIds: row.attendee_guest_ids,
      dietaryNotes: row.dietary_notes,
    }));
  } finally {
    await db.end();
  }
}

/**
 * The guest ids on one invitation, keyed by name.
 *
 * By NAME rather than by position: the page renders whatever order PostgREST
 * returns, and a test that assumed insertion order would be asserting against
 * an ordering nothing guarantees.
 */
export async function seededGuestIds(
  invitationId: string,
): Promise<ReadonlyMap<string, string>> {
  const db = await connect();

  try {
    const result = await db.query<{ id: string; full_name: string }>(
      "select id, full_name from invitation_guests where invitation_id = $1",
      [invitationId],
    );

    return new Map(result.rows.map((row) => [row.full_name, row.id]));
  } finally {
    await db.end();
  }
}

/** The ceremony and its stream details, exactly as the singleton row holds them. */
export interface SeededCeremony {
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

/**
 * Reads the `ceremony` row (migration 0009).
 *
 * Read rather than hard-coded, for the reason the row exists at all: an
 * expectation that restated the seeded placeholders would be a second copy of
 * the same four facts, and the assertion would keep passing after the couple
 * changed them.
 */
export async function readCeremony(): Promise<SeededCeremony> {
  const db = await connect();

  try {
    const result = await db.query<{
      ceremony_date: string;
      ceremony_time: string;
      stream_meeting_id: string;
      stream_passcode: string;
    }>(
      "select ceremony_date, ceremony_time, stream_meeting_id, stream_passcode from ceremony",
    );

    if (result.rows.length !== 1) {
      throw new Error(
        `Expected exactly one ceremony row, found ${result.rows.length}. ` +
          "Run `supabase db reset` so migration 0009 seeds it.",
      );
    }

    const row = result.rows[0];

    return {
      ceremonyDate: row.ceremony_date,
      ceremonyTime: row.ceremony_time,
      streamMeetingId: row.stream_meeting_id,
      streamPasscode: row.stream_passcode,
    };
  } finally {
    await db.end();
  }
}
