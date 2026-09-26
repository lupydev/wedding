import { describe, expect, it } from "vitest";

import {
  SLUG_FROM_NAME_MAX_LENGTH,
  nextFreeSlug,
  slugifyName,
} from "./slug-from-name";

describe("slugifyName", () => {
  it("turns a household name into a readable address", () => {
    expect(slugifyName("Familia Guzmán Peña")).toBe("familia-guzman-pena");
    expect(slugifyName("Tía Marta")).toBe("tia-marta");
  });

  /**
   * ACCENTS ARE FOLDED, NOT DROPPED.
   *
   * "Peña" has to become "pena" and not "pea": `ñ` decomposes into `n` plus a
   * combining tilde, so stripping the marks leaves the letter behind. A naive
   * "remove everything outside a-z" deletes the whole character and quietly
   * renames the family.
   */
  it("folds every accent this wedding will actually meet", () => {
    expect(slugifyName("Muñóz Aristizábal")).toBe("munoz-aristizabal");
    expect(slugifyName("José Ruiz")).toBe("jose-ruiz");
    expect(slugifyName("Güicán")).toBe("guican");
  });

  it("collapses whatever is not a letter or a digit into one separator", () => {
    expect(slugifyName("  Familia   Ruiz  ")).toBe("familia-ruiz");
    expect(slugifyName("José & María")).toBe("jose-maria");
    expect(slugifyName("Mesa 2 — principal")).toBe("mesa-2-principal");
  });

  it("never begins or ends with a separator", () => {
    expect(slugifyName("¡Familia Ruiz!")).toBe("familia-ruiz");
    expect(slugifyName("---Ruiz---")).toBe("ruiz");
  });

  /**
   * A NAME NOBODY CAN SPELL IN A URL YIELDS NOTHING, ON PURPOSE.
   *
   * Emoji, or a name written entirely in a script this does not transliterate,
   * would otherwise produce an empty or one-character address. Returning the
   * empty string is the signal for the caller to fall back to a random slug,
   * which is a worse address and a working one.
   */
  it("gives back nothing when there is nothing to spell", () => {
    expect(slugifyName("💍💍")).toBe("");
    expect(slugifyName("   ")).toBe("");
    expect(slugifyName("")).toBe("");
  });

  /**
   * Long names are cut at a separator, never mid-word.
   *
   * A slug truncated to the character limit ends in half a surname, which reads
   * as a typo in a link somebody is about to send to that very family.
   */
  it("caps a long name without cutting a word in half", () => {
    const slug = slugifyName(
      "Familia Aristizábal Restrepo Valencia Quintero Osorio Betancur",
    );

    expect(slug.length).toBeLessThanOrEqual(SLUG_FROM_NAME_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.split("-").every((part) => part.length > 0)).toBe(true);
    // Whole words only: no fragment of the word that was cut survives.
    expect(slug).not.toMatch(/beta$|betan$|betanc$/);
  });
});

describe("nextFreeSlug", () => {
  it("uses the name itself when nothing holds it", () => {
    expect(nextFreeSlug("familia-ruiz", new Set())).toBe("familia-ruiz");
  });

  /**
   * The counter starts at 2, because the first one is not "familia-ruiz-1".
   *
   * A suffix of 1 on the second family implies a first one called
   * "familia-ruiz-0" somewhere, and reads as a machine's numbering rather than
   * a way to tell two families apart.
   */
  it("numbers the second one, starting at two", () => {
    expect(nextFreeSlug("familia-ruiz", new Set(["familia-ruiz"]))).toBe(
      "familia-ruiz-2",
    );
  });

  it("keeps counting past the ones already taken", () => {
    const taken = new Set(["familia-ruiz", "familia-ruiz-2", "familia-ruiz-3"]);

    expect(nextFreeSlug("familia-ruiz", taken)).toBe("familia-ruiz-4");
  });

  /**
   * A gap is filled rather than skipped.
   *
   * If the second family was deleted, the next one is "-2" again. Nothing
   * depends on the number being monotonic — it is a disambiguator, not an id —
   * and reusing the gap keeps the addresses short.
   */
  it("fills a gap left by a deleted household", () => {
    const taken = new Set(["familia-ruiz", "familia-ruiz-3"]);

    expect(nextFreeSlug("familia-ruiz", taken)).toBe("familia-ruiz-2");
  });

  /**
   * The suffix never pushes the address past the limit.
   *
   * A base already at the cap plus "-12" would produce a slug the column
   * refuses, and the refusal would arrive as a failed creation with no useful
   * message. The base is shortened to make room instead.
   */
  it("shortens the base to make room for the counter", () => {
    const base = "a".repeat(SLUG_FROM_NAME_MAX_LENGTH);
    const result = nextFreeSlug(base, new Set([base]));

    expect(result.length).toBeLessThanOrEqual(SLUG_FROM_NAME_MAX_LENGTH);
    expect(result.endsWith("-2")).toBe(true);
  });
});
