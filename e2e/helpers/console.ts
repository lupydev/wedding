import { randomBytes } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

import type { SeededOperator } from "./operator";

/**
 * Console fixtures for the browser-level suite.
 *
 * Everything the console shows lives inside an async Server Component, which
 * Vitest cannot render — so the partitioned list, the device gate and the
 * interstitial are only observable here. The reductions behind them
 * (`assembleConsoleRows`, `summarizeConsoleList`, `deriveDispatchState`,
 * `classifyDeviceDeclaration`) are unit-tested; what this file exists to prove
 * is that the chain connects to a real database and a real session.
 *
 * Fixtures are COMMITTED, like every other E2E fixture in this repository: the
 * Next.js server under test is a separate process with its own pool, so a
 * rolled-back invitation would be invisible to it.
 */

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function makeSlug(): string {
  let slug = "";

  for (const byte of randomBytes(16)) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }

  return slug;
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

export interface ConsoleGuestSeed {
  readonly fullName: string;
  /** Fabricated. A real guest number must never enter a fixture. */
  readonly phoneE164?: string | null;
  readonly isPrimary?: boolean;
}

export interface ConsoleInvitationSeed {
  readonly invitationId: string;
  readonly slug: string;
  readonly greetingName: string;
  /** Guest ids keyed by full name, for RSVP fixtures that must name attendees. */
  readonly guestIds: ReadonlyMap<string, string>;
  /** Appends one RSVP row. Append-only: call it twice for a change of mind. */
  readonly answer: (input: {
    attending: boolean;
    attendeeNames?: readonly string[];
    minutesAgo?: number;
  }) => Promise<void>;
  /** Appends one dispatch event, attributed to the acting sender. */
  readonly recordEvent: (
    kind: "link_opened" | "marked_sent" | "marked_failed" | "resent",
    actorSenderId: string,
  ) => Promise<void>;
  /** The stored E.164 number of one guest, read straight from the row. */
  readonly storedPhone: (fullName: string) => Promise<string | null>;
  /** The whole dispatch log for this invitation, oldest first. */
  readonly dispatchEvents: () => Promise<
    readonly {
      kind: string;
      actorSenderId: string;
      clientEventId: string | null;
    }[]
  >;
  readonly cleanup: () => Promise<void>;
}

/**
 * Creates one committed invitation owned by an EXISTING sender.
 *
 * `e2e/helpers/seed.ts`'s `seedInvitation` mints its own owner, which is right
 * for the guest-facing suite and wrong here: the console's whole subject is the
 * partition between two named operators, so ownership has to be chosen.
 */
export async function seedConsoleInvitation(options: {
  ownerSenderId: string;
  greetingName: string;
  seatsAllowed?: number;
  guests: readonly ConsoleGuestSeed[];
}): Promise<ConsoleInvitationSeed> {
  const db = await connect();
  const slug = makeSlug();

  try {
    const invitation = await db.query<{ id: string }>(
      `insert into invitations (slug, owner_sender_id, display_name, greeting_name, seats_allowed)
       values ($1, $2, $3, $3, $4)
       returning id`,
      [
        slug,
        options.ownerSenderId,
        options.greetingName,
        options.seatsAllowed ?? options.guests.length,
      ],
    );
    const invitationId = invitation.rows[0].id;
    const guestIds = new Map<string, string>();

    for (const guest of options.guests) {
      const inserted = await db.query<{ id: string }>(
        `insert into invitation_guests (invitation_id, full_name, phone_e164, is_primary)
         values ($1, $2, $3, $4)
         returning id`,
        [
          invitationId,
          guest.fullName,
          guest.phoneE164 ?? null,
          guest.isPrimary ?? false,
        ],
      );
      guestIds.set(guest.fullName, inserted.rows[0].id);
    }

    return {
      invitationId,
      slug,
      greetingName: options.greetingName,
      guestIds,

      answer: async ({ attending, attendeeNames = [], minutesAgo = 0 }) => {
        const writer = await connect();
        try {
          await writer.query(
            `insert into rsvp_responses (invitation_id, attending, seats_confirmed, attendee_guest_ids, submitted_at)
             values ($1, $2, $3, $4, now() - ($5 || ' minutes')::interval)`,
            [
              invitationId,
              attending,
              attendeeNames.length,
              attendeeNames.map((name) => guestIds.get(name)),
              String(minutesAgo),
            ],
          );
        } finally {
          await writer.end();
        }
      },

      recordEvent: async (kind, actorSenderId) => {
        const writer = await connect();
        try {
          await writer.query(
            `insert into dispatch_events (invitation_id, actor_sender_id, kind)
             values ($1, $2, $3)`,
            [invitationId, actorSenderId, kind],
          );
        } finally {
          await writer.end();
        }
      },

      storedPhone: async (fullName) => {
        const reader = await connect();
        try {
          const result = await reader.query<{ phone_e164: string | null }>(
            "select phone_e164 from invitation_guests where id = $1",
            [guestIds.get(fullName)],
          );

          return result.rows[0]?.phone_e164 ?? null;
        } finally {
          await reader.end();
        }
      },

      dispatchEvents: async () => {
        const reader = await connect();
        try {
          const result = await reader.query<{
            kind: string;
            actor_sender_id: string;
            client_event_id: string | null;
          }>(
            `select kind, actor_sender_id, client_event_id
             from dispatch_events where invitation_id = $1 order by occurred_at`,
            [invitationId],
          );

          return result.rows.map((row) => ({
            kind: row.kind,
            actorSenderId: row.actor_sender_id,
            clientEventId: row.client_event_id,
          }));
        } finally {
          await reader.end();
        }
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
            "delete from dispatch_events where invitation_id = $1",
            [invitationId],
          );
          await cleaner.query(
            "delete from invitation_guests where invitation_id = $1",
            [invitationId],
          );
          await cleaner.query("delete from invitations where id = $1", [
            invitationId,
          ]);
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

/**
 * Signs one allowlisted operator in through the real form.
 *
 * The real form with real credentials, rather than a forged cookie: the binding
 * of `senders.auth_user_id` happens during that sign-in, and a fixture that
 * skipped it would be asserting against a session the product never issues.
 */
export async function signInAsOperator(
  page: Page,
  operator: SeededOperator,
): Promise<void> {
  await page.goto("/console/login");
  await page.getByLabel("Correo electrónico").fill(operator.allowlistedEmail);
  await page.getByLabel("Contraseña").fill(operator.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // Signing in lands on the device picker, which is the first thing a new
  // session meets. Waiting for it is what makes this helper's callers safe to
  // navigate immediately afterwards.
  await expect(page).toHaveURL(/\/console\/device$/);
}

/**
 * Answers the device picker with one operator's account.
 *
 * Through the form, never by writing the cookie: the value is signed, and a test
 * that minted it itself would keep passing if the signing changed.
 */
export async function declareDevice(
  page: Page,
  displayName: string,
): Promise<void> {
  await page.goto("/console/device");
  await page.getByLabel(displayName).check();
  await page
    .getByRole("button", {
      name: /Guardar la declaración de este dispositivo/i,
    })
    .click();

  // Waits for the action to land, not merely for the click. Without this the
  // next `goto` aborts the in-flight POST and the declaration never changes —
  // which looks exactly like the console ignoring a mismatch.
  await expect(page).toHaveURL(/\/console$/);
}
