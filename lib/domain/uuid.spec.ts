import { describe, expect, it } from "vitest";

import { isWellFormedUuid } from "./uuid";

/**
 * The shape check that keeps a malformed identifier out of Postgres.
 *
 * Every id this product accepts from a URL or a form field is a `uuid` column
 * in Postgres, and Postgres does not answer "no rows" for a value it cannot
 * parse — it raises `22P02 invalid input syntax for type uuid`. Left unguarded
 * that surfaces as a 500, so a typed-wrong URL reports a broken server rather
 * than a missing invitation, and every probe with a nonsense id costs a round
 * trip and an error log.
 *
 * Pure and shape-only on purpose. It says nothing about whether the row exists;
 * it says only that asking is worth a query.
 */
describe("isWellFormedUuid", () => {
  it("accepts a canonical version-4 uuid", () => {
    expect(isWellFormedUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("accepts a different canonical uuid", () => {
    expect(isWellFormedUuid("5c3a2b1d-9f8e-4d7c-8b6a-0e1f2a3b4c5d")).toBe(true);
  });

  it("accepts an upper-case uuid, because Postgres does", () => {
    // Refusing one would turn a value the database accepts into a not-found,
    // which is a different bug in the same place.
    expect(isWellFormedUuid("5C3A2B1D-9F8E-4D7C-8B6A-0E1F2A3B4C5D")).toBe(true);
  });

  it("refuses a value that is not a uuid at all", () => {
    expect(isWellFormedUuid("not-a-uuid")).toBe(false);
  });

  it("refuses an empty string", () => {
    expect(isWellFormedUuid("")).toBe(false);
  });

  it("refuses a uuid with a missing group", () => {
    expect(isWellFormedUuid("11111111-1111-4111-8111")).toBe(false);
  });

  it("refuses a uuid with a non-hexadecimal character", () => {
    expect(isWellFormedUuid("1111111g-1111-4111-8111-111111111111")).toBe(
      false,
    );
  });

  it("refuses surrounding whitespace rather than trimming it", () => {
    // Trimming here would hide that some call site forgot to, and the call
    // sites in this repository already trim before they ask.
    expect(isWellFormedUuid(" 11111111-1111-4111-8111-111111111111 ")).toBe(
      false,
    );
  });

  it("refuses a uuid with trailing text appended", () => {
    // Anchoring matters: an unanchored pattern would accept
    // `<uuid> or 1=1` and hand the whole string to the driver.
    expect(
      isWellFormedUuid("11111111-1111-4111-8111-111111111111 or 1=1"),
    ).toBe(false);
  });

  it("refuses the unhyphenated form", () => {
    // Postgres accepts it, but nothing in this product ever emits it, so a
    // value in that shape came from somewhere unexpected.
    expect(isWellFormedUuid("11111111111141118111111111111111")).toBe(false);
  });
});
