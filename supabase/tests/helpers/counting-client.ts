import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The real Supabase client, with a tally of how many reads each table got.
 *
 * WHY A COUNT AND NOT A ROW ASSERTION
 *
 * The thing a paging loop has to be caught not doing is asking ONCE. But a
 * single unpaged `.select()` still answers with up to `max_rows` rows, so on a
 * small database it returns the same rows the loop would have and a test that
 * only inspects the result cannot tell the two apart. It would go green against
 * a read that is one row away from silently truncating — which is the exact
 * defect, wearing a passing test.
 *
 * Asserting a table-wide total would distinguish them, and cannot be done here:
 * this database is shared by every spec file and by whatever a crashed run left
 * behind, so a total is a race rather than a fact. What IS a fact, on any
 * database of any size, is the number of requests the read made. One means
 * unpaged.
 *
 * NOTHING IS SIMULATED. This is not a stub of PostgREST — there is no fake
 * result, no fake cap, no second opinion about what the server does. It is the
 * real client, reached through a real query, and the only added behaviour is
 * `+= 1`. `Object.create` puts the genuine client on the prototype chain, and
 * the one override delegates straight back to it, so every call still leaves
 * for Postgres and comes back with whatever Postgres said.
 */
export interface CountingClient {
  /** Pass this where a `SupabaseClient` is expected. */
  readonly client: SupabaseClient;
  /** How many reads this table has been asked for so far. */
  readonly reads: (table: string) => number;
}

export function countingClient(real: SupabaseClient): CountingClient {
  const counts = new Map<string, number>();
  const client = Object.create(real) as SupabaseClient;

  const from = (table: string) => {
    counts.set(table, (counts.get(table) ?? 0) + 1);

    return real.from(table);
  };

  // `from` is generic over every table name in the schema, and re-declaring
  // that signature here would be a copy of the generated types free to drift
  // from them. The override is a tally and a delegation, so the cast gives up
  // nothing a reader needs: whatever the real client returns is what a caller
  // gets.
  (client as unknown as { from: typeof from }).from = from;

  return {
    client,
    reads: (table) => counts.get(table) ?? 0,
  };
}
