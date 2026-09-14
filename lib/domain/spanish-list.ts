/**
 * Joining PROPER NOUNS into one Spanish phrase: `A, B y C`, with the `y → e`
 * conjunction rule and no Oxford comma.
 *
 * Pure and here rather than inside a component for the same reason as
 * `rsvp-copy.ts`: the rule below is real logic with a real failure mode, and it
 * is worth testing without a DOM.
 *
 * DELIBERATELY NOT IMPLEMENTED, so nobody adds them "for completeness":
 *
 *   - The disjunctive `o → u` rule (`siete u ocho`). This function only ever
 *     produces a CONJUNCTION between names. It never emits `o`, so there is no
 *     `o` for the rule to act on.
 *   - The sentence-initial interrogative exception (`¿E Inés?` stays `¿Y
 *     Inés?`). The output of this function is always a noun phrase INSIDE a
 *     sentence — a greeting name, a list of attendees — never the opening of a
 *     question. The exception is unreachable here.
 *
 * Adding either one would mean adding an untestable branch to satisfy a rule
 * this function's inputs cannot express.
 *
 * Identifiers and comments are English; only the joined names are Spanish.
 */

/**
 * Vowel letters that form a DIPHTHONG with a preceding /i/.
 *
 * Accented forms are included because `Iván` and `Iván`-like names arrive from a
 * Contacts paste already accented, and an accented vowel is still a vowel. `y`
 * is deliberately absent: word-internally it is the consonant /ʝ/ or a final
 * /i/ glide, and neither case appears at position two of a Spanish given name
 * in a way this rule would need.
 */
const DIPHTHONG_FORMING_VOWELS = new Set([
  "a",
  "e",
  "i",
  "o",
  "u",
  "á",
  "é",
  "í",
  "ó",
  "ú",
  "ü",
]);

/** The /i/ vowel as it can be spelled at the start of a name. */
const I_VOWEL_LETTERS = new Set(["i", "í"]);

/**
 * NFC-normalize and trim.
 *
 * A mobile keyboard and a Contacts paste both produce NFD-decomposed accented
 * characters, where `Í` is a bare `I` followed by a combining acute. A plain
 * character comparison against `"í"` misses that form entirely and would emit
 * `y Íñigo`. Normalizing here — not at the call site — means every caller gets
 * the same answer for the same name regardless of how it was typed.
 */
function normalizeName(name: string): string {
  return name.normalize("NFC").trim();
}

/**
 * The conjunction that must precede `nextItem`: `e` when the item opens with a
 * HIATUS /i/, `y` otherwise.
 *
 * The discriminator is phonological, not orthographic. `y` becomes `e` only to
 * avoid two adjacent /i/ sounds, so it changes only when the following word
 * actually BEGINS with the vowel /i/ as its own syllable nucleus:
 *
 *   - `Inés`, `Hilda`, `Íñigo` — the `i` is followed by a consonant (or ends
 *     the word), so it is a hiatus and carries the /i/ sound: `e`.
 *   - `Ian`, `Hierro`, `Hielo` — the `i` is followed by a vowel, so the two
 *     form a diphthong whose opening sound is the glide /j/, not /i/: `y`.
 *     `Hierro` and `Hielo` are the SAME case; a rule keyed on the spelling
 *     `hi-` gets both of them wrong.
 *   - `Yolanda` — `y-` is the consonant /ʝ/, never the vowel /i/: `y`.
 *
 * A silent `h` is skipped before the test because it spells no sound at all.
 */
export function spanishConjunction(nextItem: string): "y" | "e" {
  const normalized = normalizeName(nextItem).toLowerCase();
  // The silent `h` spells nothing, so `hilda` is tested exactly as `ilda`.
  const sounded = normalized.startsWith("h") ? normalized.slice(1) : normalized;

  const first = sounded.charAt(0);
  if (!I_VOWEL_LETTERS.has(first)) {
    return "y";
  }

  const second = sounded.charAt(1);
  // No second letter means the /i/ is the whole syllable: still a hiatus.
  const isDiphthong = second !== "" && DIPHTHONG_FORMING_VOWELS.has(second);

  return isDiphthong ? "y" : "e";
}

/**
 * `["Lucho", "Luzma", "Fer", "Ana"]` → `"Lucho, Luzma, Fer y Ana"`.
 *
 * NO OXFORD COMMA. Spanish does not take a serial comma before the final
 * conjunction, and this is enforced rather than left to instinct because an
 * English-speaking contributor reflexively adds one.
 *
 * Throws on an empty list rather than returning `""`. Every caller joins a
 * household's members, and a household with no members is an invalid state that
 * member management refuses to create — returning a placeholder here would hide
 * that a caller reached an impossible state.
 */
export function joinSpanishList(items: readonly string[]): string {
  if (items.length === 0) {
    throw new Error("cannot join an empty list of names");
  }

  // Normalized on the way OUT as well as for the sound test, so an NFD paste
  // and its NFC twin produce byte-identical output.
  const names = items.map(normalizeName);
  const last = names[names.length - 1];

  if (names.length === 1) {
    return last;
  }

  const leading = names.slice(0, -1).join(", ");

  return `${leading} ${spanishConjunction(last)} ${last}`;
}
