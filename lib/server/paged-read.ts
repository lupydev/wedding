import "server-only";

/**
 * Reading a whole table through PostgREST, which will not hand you one.
 *
 * WHY THIS EXISTS AT ALL
 *
 * PostgREST answers an unbounded `.select()` with at most `max_rows` rows —
 * `supabase/config.toml` sets it to 1000, and the hosted default is the same —
 * and it does it SILENTLY. No error, no truncation flag, no `Content-Range`
 * anybody was reading: just a short answer that is shaped exactly like a
 * complete one. A console that stopped listing guests past the thousandth
 * would be indistinguishable, from the page, from a wedding with a thousand
 * guests. That is the worst kind of defect this project has, and the only one
 * it has shipped twice.
 *
 * THE SHAPE IS `readDispatchStates`', DELIBERATELY
 *
 * `guest-directory.ts` and `invitations.ts` already walk a long list in
 * fixed-size chunks against a module-level constant that names the size and
 * says why. This is that same loop pointed at the RESULT instead of at the
 * filter, rather than a second way of doing the same thing. What is shared is
 * the loop, not the number: `IDS_PER_READ` stays where it is, because a
 * request-line limit and a row ceiling are two different facts that happen to
 * both be solved by chunking.
 *
 * WHY IT STOPS ON AN EMPTY PAGE AND NOT ON A SHORT ONE
 *
 * "Fewer rows than I asked for means there are no more" is true only while the
 * server's own ceiling is above the page size. Lower `max_rows` below it — a
 * one-line change in a config file nobody would connect to this — and every
 * page comes back short, the loop stops on the first one, and the silent wrong
 * answer is back with a paging loop sitting on top of it looking like a fix.
 * So the cursor advances by the rows actually RECEIVED and the loop ends only
 * on a page with nothing in it. The cost is one extra round trip per read; the
 * alternative is a correctness guarantee that depends on a setting this file
 * cannot see.
 */

/**
 * Rows per request, when a caller does not say.
 *
 * 1000 exactly, because that is `max_rows`: asking for more would be asking
 * for rows the server has already decided not to send, and asking for
 * meaningfully fewer would buy round trips for nothing. Sitting exactly on the
 * ceiling is safe here only because the loop above does not treat a short page
 * as the end.
 *
 * Callers take it as a parameter rather than reading it here, so a test can
 * prove the loop with a page size of two instead of seeding a thousand rows to
 * watch one boundary — a suite that seeds a thousand rows to test paging is
 * the same disease this fixes, one level up.
 */
export const ROWS_PER_PAGE = 1000;

/** What a PostgREST read answers, narrowed to the parts a page needs. */
interface PageResult<Row> {
  readonly data: Row[] | null;
  readonly error: { readonly message: string } | null;
}

/**
 * Every row a query matches, however many pages that takes.
 *
 * `subject` completes the sentence "Could not read …", so each caller keeps
 * the message it already had.
 *
 * ORDER IS THE CALLER'S RESPONSIBILITY AND IS NOT OPTIONAL. `.range()` over a
 * query with no `ORDER BY` is two separate unordered reads with an offset
 * between them: Postgres does not promise the same row order twice, an UPDATE
 * relocates a row in the heap, and the two pages can therefore overlap or skip.
 * Every caller here orders on a total, stable key.
 */
export async function readEveryPage<Row>(
  subject: string,
  rowsPerPage: number,
  page: (from: number, to: number) => PromiseLike<PageResult<Row>>,
): Promise<Row[]> {
  if (!Number.isInteger(rowsPerPage) || rowsPerPage < 1) {
    throw new Error(
      `Could not read ${subject}: a page of ${rowsPerPage} rows is not a page.`,
    );
  }

  const rows: Row[] = [];

  for (let from = 0; ;) {
    const { data, error } = await page(from, from + rowsPerPage - 1);

    if (error) {
      throw new Error(`Could not read ${subject}: ${error.message}`);
    }

    const batch = data ?? [];

    if (batch.length === 0) {
      return rows;
    }

    rows.push(...batch);
    from += batch.length;
  }
}
