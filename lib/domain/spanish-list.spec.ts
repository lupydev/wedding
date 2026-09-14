import { describe, expect, it } from "vitest";

import { joinSpanishList, spanishConjunction } from "./spanish-list";

// An NFD-decomposed "Íñigo": a base letter followed by a COMBINING ACUTE and a
// base n followed by a COMBINING TILDE, which is what a mobile keyboard or a
// Contacts paste can produce. Written with escapes because the decomposed and
// precomposed forms are visually identical in an editor, and a reviewer must be
// able to see which one this is.
const NFD_INIGO = "I\u0301n\u0303igo";
// The same name precomposed. Both constants use escapes because the two forms
// are indistinguishable on screen.
const NFC_INIGO = "\u00cd\u00f1igo";

// The conjunction table below is the whole module. It is written as an
// exhaustive table rather than a handful of examples because the rule is
// routinely mis-stated as "hi- takes e", which is a SPELLING rule and is wrong:
// the discriminator is whether the /i/ sound is a hiatus (its own syllable
// nucleus) or a diphthong (glides into a following vowel). `Hilda` and `Hierro`
// have the same three opening letters and take different conjunctions.
//
// Every row states the phonological reason, so a future edit that "simplifies"
// the rule has to argue with the reason rather than with a bare expectation.
const CONJUNCTION_TABLE: ReadonlyArray<{
  readonly name: string;
  readonly conjunction: "y" | "e";
  readonly because: string;
}> = [
  { name: "Luzma", conjunction: "y", because: "starts with a consonant" },
  { name: "Ana", conjunction: "y", because: "starts with /a/, not /i/" },
  { name: "Elena", conjunction: "y", because: "starts with /e/, not /i/" },
  { name: "Inés", conjunction: "e", because: "i + consonant n: hiatus /i/" },
  { name: "Ignacio", conjunction: "e", because: "i + consonant g: hiatus /i/" },
  { name: "Isabel", conjunction: "e", because: "i + consonant s: hiatus /i/" },
  { name: "Hilda", conjunction: "e", because: "silent h, then i + l: hiatus" },
  { name: "Íñigo", conjunction: "e", because: "accented Í + ñ: hiatus" },
  { name: "Iván", conjunction: "e", because: "i + consonant v: hiatus" },
  { name: "Irene", conjunction: "e", because: "i + consonant r: hiatus" },
  { name: "Ian", conjunction: "y", because: "i + vowel a: diphthong /ja/" },
  { name: "Hierro", conjunction: "y", because: "hi + vowel e: diphthong /je/" },
  { name: "Yolanda", conjunction: "y", because: "y- is the consonant /ʝ/" },
  { name: "ÍÑIGO", conjunction: "e", because: "uppercase of the hiatus case" },
  { name: "íñigo", conjunction: "e", because: "lowercase of the hiatus case" },
  { name: NFD_INIGO, conjunction: "e", because: "NFD-decomposed Íñigo" },
  { name: "  Inés", conjunction: "e", because: "pasted leading whitespace" },
];

describe("spanishConjunction", () => {
  it.each(CONJUNCTION_TABLE)(
    "emits $conjunction before $name ($because)",
    ({ name, conjunction }) => {
      expect(spanishConjunction(name)).toBe(conjunction);
    },
  );

  it("treats hierro and hielo as the identical diphthong case", () => {
    // This is the row that catches the plausible wrong rule. A `hi-` spelling
    // check emits `e` for both; the correct hiatus/diphthong check emits `y`
    // for both, exactly as the textbook "frío y hielo" does.
    expect(spanishConjunction("Hierro")).toBe("y");
    expect(spanishConjunction("Hielo")).toBe("y");
    // And the genuine contrast pair, which differs only after the `hi`.
    expect(spanishConjunction("Hija")).toBe("e");
  });

  it("gives an NFD-decomposed name the same conjunction as its NFC form", () => {
    const nfc = NFC_INIGO;
    const nfd = NFD_INIGO;

    expect(nfd).not.toBe(nfc);
    expect(spanishConjunction(nfd)).toBe(spanishConjunction(nfc));
    expect(spanishConjunction(nfd)).toBe("e");
  });
});

describe("joinSpanishList", () => {
  it("throws on an empty list rather than returning a placeholder", () => {
    expect(() => joinSpanishList([])).toThrow(
      /cannot join an empty list of names/i,
    );
  });

  it("returns the bare name for a single item, with no conjunction", () => {
    expect(joinSpanishList(["Lucho"])).toBe("Lucho");
  });

  it("joins two items with the conjunction the second one selects", () => {
    expect(joinSpanishList(["Lucho", "Luzma"])).toBe("Lucho y Luzma");
    expect(joinSpanishList(["Lucho", "Inés"])).toBe("Lucho e Inés");
  });

  it("uses one comma and one conjunction for three items", () => {
    expect(joinSpanishList(["Lucho", "Luzma", "Fer"])).toBe(
      "Lucho, Luzma y Fer",
    );
  });

  it("writes no Oxford comma before the final conjunction of four items", () => {
    const joined = joinSpanishList(["Lucho", "Luzma", "Fer", "Ana"]);

    expect(joined).toBe("Lucho, Luzma, Fer y Ana");
    // Stated separately from the equality above so the failure message names
    // the actual rule when an English-speaking contributor adds the comma back.
    expect(joined).not.toContain(", y ");
  });

  it("selects the conjunction from the LAST item, not from an earlier one", () => {
    // `Inés` sits in the middle here; it must not pull the final conjunction to
    // `e`, and `Ana` must not be reported as taking `e`.
    expect(joinSpanishList(["Lucho", "Inés", "Ana"])).toBe("Lucho, Inés y Ana");
  });

  it("normalizes and trims the items it emits, not only the ones it tests", () => {
    expect(joinSpanishList(["  Lucho ", "  Inés"])).toBe("Lucho e Inés");
    expect(joinSpanishList(["Lucho", NFD_INIGO])).toBe(`Lucho e ${NFC_INIGO}`);
  });
});
