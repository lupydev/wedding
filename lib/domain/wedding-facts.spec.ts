import { describe, expect, it } from "vitest";

import {
  WEDDING_FACT_FIELDS,
  WEDDING_FACT_LABELS,
  WEDDING_FACT_MAX_LENGTHS,
  parseWeddingFacts,
  type WeddingFactField,
  type WeddingFacts,
  type WeddingFactsParse,
} from "./wedding-facts";

/**
 * The wedding's facts, validated as a pure function.
 *
 * WHY THIS IS A DOMAIN MODULE AND NOT A CHECK INSIDE THE SERVER ACTION
 *
 * These seven values reach a guest through four surfaces, one of which — the
 * Open Graph card — is cached immutably and cannot be corrected after dispatch.
 * What counts as an acceptable value is therefore a rule about the product, not
 * a detail of one form handler, and it is testable here without a database, a
 * browser or a session.
 *
 * The server action calls this. The browser does not: a form with `required`
 * attributes is a convenience, and every one of these rules is re-applied on the
 * server because a convenience is never a boundary. The table's own check
 * constraints are the line behind THIS one.
 */

/** A complete, already-valid submission. Every test varies one field of it. */
const COMPLETE: Readonly<Record<string, string>> = {
  coupleNames: "Ana y Bruno",
  ceremonyDate: "sábado 14 de noviembre de 2026",
  ceremonyTime: "4:00 p. m.",
  venueName: "Hacienda La Ñapa",
  venueAddress: "Calle 12 #34-56, Barrio Centro, Ciudad",
  streamMeetingId: "123 4567 8901",
  streamPasscode: "clave-de-prueba",
};

function parsed(overrides: Readonly<Record<string, unknown>> = {}) {
  return parseWeddingFacts({ ...COMPLETE, ...overrides });
}

/**
 * Asserts the submission was REFUSED, and returns the error recorded for `field`.
 *
 * This exists because the idiom it replaces could not fail for the outcome it
 * claimed to forbid. `expect(refusalFor(result, field)).toBeDefined()`
 * short-circuits to the boolean `false` whenever the submission was ACCEPTED —
 * and `false` is defined, so `toBeDefined()` passed. Deleting the blank check,
 * the length check or the control-character check from `parseWeddingFacts` left
 * every one of those assertions green.
 *
 * Pinning `result.ok` first is what makes the refusal assertable at all. Going
 * through this helper is what stops the idiom being retyped.
 */
function refusalFor(
  result: WeddingFactsParse,
  field: WeddingFactField,
): string | undefined {
  expect(result.ok).toBe(false);
  return result.ok ? undefined : result.errors[field];
}

describe("the wedding facts' field list", () => {
  it("names exactly the seven values the ceremony row holds", () => {
    // The same seven the migration declares and `updateCeremony` writes. A
    // field here with no column behind it would validate something nothing
    // stores; a column with no field here would be uneditable.
    expect([...WEDDING_FACT_FIELDS].sort()).toEqual([
      "ceremonyDate",
      "ceremonyTime",
      "coupleNames",
      "streamMeetingId",
      "streamPasscode",
      "venueAddress",
      "venueName",
    ]);
  });

  it("gives every field a maximum length and an operator-facing label", () => {
    for (const field of WEDDING_FACT_FIELDS) {
      expect(WEDDING_FACT_MAX_LENGTHS[field]).toBeGreaterThan(0);
      expect(WEDDING_FACT_LABELS[field]).not.toBe("");
    }
  });

  it("allows the address more room than the rest, because addresses are longer", () => {
    // A street plus a neighbourhood plus a landmark is the one value here that
    // plausibly runs past 200 characters, and a truncated address is the
    // half-correct one that sends a car to the wrong gate.
    expect(WEDDING_FACT_MAX_LENGTHS.venueAddress).toBeGreaterThan(
      WEDDING_FACT_MAX_LENGTHS.venueName,
    );
  });
});

describe("parseWeddingFacts on a complete submission", () => {
  it("accepts it and returns every value", () => {
    const result = parsed();

    expect(result.ok).toBe(true);
    expect(result.ok && result.facts).toEqual(COMPLETE);
  });

  it("accepts a different complete submission, values and all", () => {
    const other = {
      coupleNames: "Camila y Dario",
      ceremonyDate: "viernes 3 de abril de 2027",
      ceremonyTime: "11:30 a. m.",
      venueName: "Casa del Río",
      venueAddress: "Vereda El Alto, kilómetro 4",
      streamMeetingId: "998 8776 6554",
      streamPasscode: "otra-clave",
    };
    const result = parseWeddingFacts(other);

    expect(result.ok && result.facts).toEqual(other);
  });

  it("trims surrounding whitespace rather than storing it", () => {
    // A pasted value arrives with a trailing space more often than not, and a
    // trailing space in the couple's names is a trailing space on an immutable
    // Open Graph card.
    const result = parsed({
      coupleNames: "  Ana y Bruno  ",
      venueAddress: "\tCalle 12 #34-56\t",
    });

    expect(result.ok && result.facts.coupleNames).toBe("Ana y Bruno");
    expect(result.ok && result.facts.venueAddress).toBe("Calle 12 #34-56");
  });

  it("accepts a value exactly at its maximum length", () => {
    const exact = "á".repeat(WEDDING_FACT_MAX_LENGTHS.venueName);
    const result = parsed({ venueName: exact });

    expect(result.ok && result.facts.venueName).toBe(exact);
  });
});

describe("parseWeddingFacts on a field that is missing", () => {
  it.each([...WEDDING_FACT_FIELDS])("refuses an empty %s", (field) => {
    const result = parsed({ [field]: "" });

    expect(result.ok).toBe(false);
    expect(refusalFor(result, field)).toBeDefined();
  });

  it.each([...WEDDING_FACT_FIELDS])(
    "refuses a whitespace-only %s, which looks filled in a text input",
    (field) => {
      const result = parsed({ [field]: "   " });

      expect(refusalFor(result, field)).toBeDefined();
    },
  );

  it.each([...WEDDING_FACT_FIELDS])("refuses an absent %s", (field) => {
    const submission = { ...COMPLETE } as Record<string, unknown>;
    delete submission[field];

    const result = parseWeddingFacts(submission);

    expect(refusalFor(result, field)).toBeDefined();
  });

  it("refuses a value that is not a string at all", () => {
    // `FormData.get` returns a `File` for a file input. A browser that submits
    // one — or a hand-rolled POST — must not have it coerced to "[object File]"
    // and stored as the venue.
    const result = parsed({ venueName: 42 });

    expect(refusalFor(result, "venueName")).toBeDefined();
  });

  it("names the field in its own words, so the operator knows which box", () => {
    const result = parsed({ streamPasscode: "" });

    expect(refusalFor(result, "streamPasscode")).toContain(
      WEDDING_FACT_LABELS.streamPasscode,
    );
  });

  it("reports every broken field at once and not just the first", () => {
    // One round trip per mistake, on venue Wi-Fi, with seven fields, is how a
    // form stops getting filled in.
    const result = parsed({ coupleNames: "", venueName: "", ceremonyTime: "" });

    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "ceremonyTime",
      "coupleNames",
      "venueName",
    ]);
  });

  it("leaves the untouched fields out of the error map entirely", () => {
    const result = parsed({ coupleNames: "" });

    expect(refusalFor(result, "venueName")).toBeUndefined();
    expect(refusalFor(result, "streamPasscode")).toBeUndefined();
  });
});

describe("parseWeddingFacts on a field that is too long", () => {
  it.each([...WEDDING_FACT_FIELDS])(
    "refuses a %s one character past its maximum",
    (field) => {
      const tooLong = "a".repeat(WEDDING_FACT_MAX_LENGTHS[field] + 1);
      const result = parsed({ [field]: tooLong });

      expect(refusalFor(result, field)).toBeDefined();
    },
  );

  it("says what the limit is, rather than only that it was exceeded", () => {
    const result = parsed({
      venueName: "a".repeat(WEDDING_FACT_MAX_LENGTHS.venueName + 1),
    });

    expect(refusalFor(result, "venueName")).toContain(
      String(WEDDING_FACT_MAX_LENGTHS.venueName),
    );
  });

  it("counts characters the way the database does, not UTF-16 units", () => {
    // A limit measured in `.length` lets an emoji-bearing value pass here and be
    // refused by Postgres, which is a database error on an operator's screen
    // instead of a message beside the field. Every astral character costs two
    // UTF-16 units and one `char_length`.
    const limit = WEDDING_FACT_MAX_LENGTHS.venueName;
    const atLimit = "🌿".repeat(limit);

    expect(atLimit.length).toBe(limit * 2);
    expect(parsed({ venueName: atLimit }).ok).toBe(true);
    expect(parsed({ venueName: "🌿".repeat(limit + 1) }).ok).toBe(false);
  });
});

describe("parseWeddingFacts on a field carrying a line break", () => {
  it.each([...WEDDING_FACT_FIELDS])("refuses a newline in %s", (field) => {
    const result = parsed({ [field]: "primera\nsegunda" });

    expect(refusalFor(result, field)).toBeDefined();
  });

  it("refuses a carriage return too, which is what a pasted Windows value carries", () => {
    const result = parsed({ venueAddress: "Calle 12\r\nBarrio Centro" });

    expect(refusalFor(result, "venueAddress")).toBeDefined();
  });

  it("refuses any other control character", () => {
    const result = parsed({ coupleNames: "Ana y Bruno" });

    expect(refusalFor(result, "coupleNames")).toBeDefined();
  });

  /**
   * WHY A LINE BREAK IS A REFUSAL AND NOT A SILENT COLLAPSE TO A SPACE.
   *
   * Each of these values is rendered as one line: a `dd` in the invitation, one
   * line of Open Graph card copy, and — for the couple's names — a segment of a
   * `wa.me` query string where a newline is percent-encoded and reaches the
   * recipient's draft as a literal break. Collapsing it quietly would store
   * something the operator did not type; refusing it says which field to fix.
   */
  it("keeps an ordinary interior space, which is not a control character", () => {
    expect(parsed({ coupleNames: "Ana y Bruno" }).ok).toBe(true);
  });
});

describe("the parsed facts as the write's input", () => {
  it("produces exactly the shape the ceremony row is updated from", () => {
    const result = parsed();

    // Structurally `CeremonyDetails`. Asserted here rather than trusted, because
    // `updateCeremony` accepts it by shape and an added field with no column
    // would be dropped without a word from the type system.
    expect(result.ok && Object.keys(result.facts).sort()).toEqual(
      [...WEDDING_FACT_FIELDS].sort(),
    );
  });

  it("is assignable to the facts type it declares", () => {
    const result = parsed();
    const facts: WeddingFacts | null = result.ok ? result.facts : null;

    expect(facts).not.toBeNull();
  });
});
