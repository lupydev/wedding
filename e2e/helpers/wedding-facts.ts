import { Client } from "pg";

/**
 * The wedding's facts, for the one spec that EDITS them.
 *
 * WHY THIS HELPER IS SO CAREFUL ABOUT A SINGLE ROW
 *
 * `ceremony` is a singleton: one row, read by every surface and therefore by
 * every spec in this suite. Playwright runs the suite `fullyParallel`, so a spec
 * that edits that row makes three assertions elsewhere racy in a way no retry
 * would explain:
 *
 *  - `rsvp.spec.ts` reads the row once, then asserts the rendered stream card
 *    contains those exact values.
 *  - `console-preview.spec.ts` compares the operator preview's body text to the
 *    guest page's body text, fetched moments apart.
 *  - the editor's own round trip asserts that what it typed is what a guest sees.
 *
 * THE ANSWER IS SCHEDULING, NOT LOCKING. A Postgres advisory lock was tried
 * first and was wrong: Playwright budgets a test timeout per test and knows
 * nothing about a hook waiting on another worker, so the readers failed on their
 * own 30-second clock while the writer still held the row. `console-wedding.spec.ts`
 * therefore lives in its own Playwright project, sequenced after the main one by
 * `dependencies` in `playwright.config.ts`. Nothing waits, because nothing
 * overlaps.
 *
 * This helper is left with the two plain jobs that remain: read the row, and put
 * it back the way the migrations seeded it.
 */

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * The four values, named as the application names them.
 *
 * `ceremonyDate` and `ceremonyTime` were here until migration 0018 dropped
 * their columns. Nothing a guest could open rendered either, and the day every
 * screen shows comes from `WEDDING_INSTANT`.
 */
export interface WeddingFactValues {
  readonly coupleNames: string;
  readonly venueName: string;
  readonly venueAddress: string;
  readonly streamUrl: string;
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

const SELECT_FACTS = `select couple_names, venue_name, venue_address,
                             stream_url
                      from ceremony`;

interface FactsRow {
  couple_names: string;
  venue_name: string;
  venue_address: string;
  stream_url: string;
}

/** Reads the singleton. Throws loudly if the migrations have not run. */
export async function readWeddingFacts(): Promise<WeddingFactValues> {
  const db = await connect();

  try {
    const result = await db.query<FactsRow>(SELECT_FACTS);

    if (result.rows.length !== 1) {
      throw new Error(
        `Expected exactly one ceremony row, found ${result.rows.length}. ` +
          "Run `supabase db reset` so migrations 0009 and 0011 seed it.",
      );
    }

    const row = result.rows[0];

    return {
      coupleNames: row.couple_names,
      venueName: row.venue_name,
      venueAddress: row.venue_address,
      streamUrl: row.stream_url,
    };
  } finally {
    await db.end();
  }
}

/**
 * Writes the four values straight to the row.
 *
 * For TEARDOWN only. The spec under test edits these through the console form,
 * because going around the form would prove nothing about the product; this
 * exists so the row is left exactly as the migrations seeded it, which is what
 * every other spec and a following `supabase db reset`-free run expects to find.
 */
export async function restoreWeddingFacts(
  facts: WeddingFactValues,
): Promise<void> {
  const db = await connect();

  try {
    await db.query(
      `update ceremony
          set couple_names = $1, venue_name = $2, venue_address = $3,
              stream_url = $4
        where id`,
      [facts.coupleNames, facts.venueName, facts.venueAddress, facts.streamUrl],
    );
  } finally {
    await db.end();
  }
}
