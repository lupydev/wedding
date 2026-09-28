import { describe, expect, it } from "vitest";

import { readEveryPage, ROWS_PER_PAGE } from "./paged-read";

/**
 * The loop, on its own.
 *
 * NO DATABASE HERE, AND THAT IS NOT THE USUAL EXEMPTION. `readEveryPage` takes
 * the page as a function precisely so the loop and the query are separable; the
 * callers are proved against the real Supabase in `guest-directory.spec.ts` and
 * `invitations.spec.ts`, where the assertion is that they page at all. What is
 * left for this file is the arithmetic — where the cursor lands, when the loop
 * agrees to stop — and the interesting cases there are servers this project
 * cannot make the real one be: one that caps a page below what was asked for,
 * one that answers null.
 */

/** A server holding `rows`, answering a range the way PostgREST does. */
function server(rows: readonly number[], cap = Number.POSITIVE_INFINITY) {
  const asked: { from: number; to: number }[] = [];

  return {
    asked,
    page(from: number, to: number) {
      asked.push({ from, to });

      return Promise.resolve({
        // `to` is inclusive, and the cap is the server's own ceiling on top of
        // whatever was requested — which is exactly `max_rows`.
        data: rows.slice(from, Math.min(to + 1, from + cap)),
        error: null,
      });
    },
  };
}

describe("readEveryPage", () => {
  it("reassembles a list that does not fit in one page", async () => {
    const source = server([1, 2, 3, 4, 5]);

    const rows = await readEveryPage("the rows", 2, source.page);

    expect(rows).toEqual([1, 2, 3, 4, 5]);
  });

  /**
   * THE LAST PAGE IS ONE NOBODY ASKED FOR ANYTHING BACK FROM.
   *
   * Five rows in pages of two is three pages of content and then an empty
   * fourth, not three. The fourth is the round trip that buys the guarantee.
   *
   * The cursor after the third page is 5 and not 6, which is the same rule
   * seen from the other side: it moves by the row that ARRIVED, not by the two
   * that were asked for.
   */
  it("keeps asking until a page comes back empty", async () => {
    const source = server([1, 2, 3, 4, 5]);

    await readEveryPage("the rows", 2, source.page);

    expect(source.asked).toEqual([
      { from: 0, to: 1 },
      { from: 2, to: 3 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
    ]);
  });

  /**
   * A FULL PAGE IS NOT A REASON TO STOP, AND NEITHER IS A SHORT ONE.
   *
   * "Fewer rows than I asked for means there are no more" holds only while the
   * server's ceiling is above the page size. Lower `max_rows` under it — one
   * line in `supabase/config.toml`, nowhere near this file — and every page
   * comes back short, a loop that stopped on a short page stops on the first,
   * and the silent truncation is back with a paging loop on top of it looking
   * like a fix.
   *
   * Here the caller asks for ten and the server will never send more than
   * three. The cursor advances by what ARRIVED, so all seven rows still come
   * back.
   */
  it("survives a server that caps a page below the size asked for", async () => {
    const source = server([1, 2, 3, 4, 5, 6, 7], 3);

    const rows = await readEveryPage("the rows", 10, source.page);

    expect(rows).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(source.asked).toEqual([
      { from: 0, to: 9 },
      { from: 3, to: 12 },
      { from: 6, to: 15 },
      { from: 7, to: 16 },
    ]);
  });

  it("asks once for a list that is already exhausted", async () => {
    const source = server([]);

    const rows = await readEveryPage("the rows", 1000, source.page);

    expect(rows).toEqual([]);
    expect(source.asked).toEqual([{ from: 0, to: 999 }]);
  });

  it("treats a null body as the end rather than as a crash", async () => {
    const rows = await readEveryPage<number>("the rows", 5, () =>
      Promise.resolve({ data: null, error: null }),
    );

    expect(rows).toEqual([]);
  });

  /**
   * The subject completes the caller's own sentence, so each read keeps the
   * message it had before it was paged.
   */
  it("reports a failed page in the caller's words", async () => {
    await expect(
      readEveryPage("the guest directory", 10, () =>
        Promise.resolve({ data: null, error: { message: "connection reset" } }),
      ),
    ).rejects.toThrow("Could not read the guest directory: connection reset");
  });

  /**
   * A page of zero would ask for `range(0, -1)` forever. Refusing it is
   * cheaper than debugging a read that never returns.
   */
  it.each([0, -1, 1.5, Number.NaN])(
    "refuses a page size of %s instead of looping",
    async (rowsPerPage) => {
      await expect(
        readEveryPage("the rows", rowsPerPage, () =>
          Promise.resolve({ data: [], error: null }),
        ),
      ).rejects.toThrow("is not a page");
    },
  );

  /**
   * The default sits exactly on `max_rows` in `supabase/config.toml`. Asking
   * for more would be asking for rows the server has already decided not to
   * send; asking for meaningfully fewer would buy round trips for nothing.
   */
  it("defaults to the server's own ceiling", () => {
    expect(ROWS_PER_PAGE).toBe(1000);
  });
});
