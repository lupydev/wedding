/**
 * The readable half of an invitation's address — pure.
 *
 * An invitation used to live at `/i/k22eth3lvkzptcco`. It now lives at
 * `/i/familia-guzman-pena`, because that is a link somebody sends to a family
 * over WhatsApp and a wall of base32 looks like a mistake.
 *
 * THE ADDRESS IS DERIVED ONCE AND THEN FROZEN. It is computed when the
 * invitation is created and never recomputed from the name afterwards. If it
 * followed the name, correcting "Tía Marta" to "Marta Restrepo" would kill the
 * link already sitting in Marta's WhatsApp — and it would do it SILENTLY: the
 * console shows nothing wrong, and only the guest meets "no encontramos esta
 * invitación". `rotateSlug` remains the way to change an address on purpose.
 *
 * WHAT THIS COSTS, STATED PLAINLY. A random slug is unguessable; a name is not.
 * `/i/familia-guzman-pena` can be typed by anybody, and an unknown slug renders
 * "we could not find this invitation" while a real one renders the phone gate —
 * so the address now leaks WHO is invited to anyone who probes for a name.
 * Reading the invitation still needs a member's phone number, which is the part
 * that never depended on the slug. The couple weighed that against a link they
 * are not embarrassed to send, and chose the link.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */

/**
 * The longest address this produces, counter included.
 *
 * Long enough for a real household name — "familia-aristizabal-restrepo" is 28
 * — and short enough to survive being pasted into a chat without wrapping.
 */
export const SLUG_FROM_NAME_MAX_LENGTH = 48;

/** The counter on the second household of a name, and every one after it. */
const FIRST_SUFFIX = 2;

/**
 * Folds a name into the characters a URL can carry.
 *
 * NFD FIRST, AND THAT IS THE WHOLE TRICK. Normalising to decomposed form turns
 * "ñ" into `n` plus a combining tilde and "á" into `a` plus an acute, so
 * dropping the combining marks leaves the LETTER behind. Without it, a rule
 * that removes everything outside `a-z` deletes the whole character and renames
 * "Peña" to "pea" in a link about to be sent to the Peñas.
 *
 * Returns the empty string when nothing spellable survives — a name written
 * entirely in emoji, say. That is the caller's signal to fall back to a random
 * address, which is uglier and works.
 */
export function slugifyName(name: string): string {
  const folded = name
    .normalize("NFD")
    // Combining marks: the accents NFD just separated from their letters.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return capAtWord(folded, SLUG_FROM_NAME_MAX_LENGTH);
}

/**
 * Cuts a slug to `limit` characters at a separator, never mid-word.
 *
 * A slug truncated at the character reads as a typo — "familia-aristizabal-rest"
 * — in a link somebody is about to send to that family. If even the first word
 * is longer than the limit there is nothing to cut at, and the hard cut is the
 * only answer left.
 */
function capAtWord(slug: string, limit: number): string {
  if (slug.length <= limit) {
    return slug;
  }

  const cut = slug.slice(0, limit);
  const lastSeparator = cut.lastIndexOf("-");

  return lastSeparator > 0 ? cut.slice(0, lastSeparator) : cut;
}

/**
 * The first address in this family of names that nobody holds.
 *
 * The counter starts at 2: a suffix of 1 on the second household implies a
 * "-0" somewhere and reads as a machine numbering rather than as a way to tell
 * two families called Ruiz apart.
 *
 * Gaps are filled rather than skipped. The number is a disambiguator, not an
 * identifier, so nothing depends on it being monotonic and reusing a deleted
 * household's number keeps addresses short.
 *
 * `taken` is supplied by the caller, which is what keeps this pure: the server
 * reads the slugs already beginning with this base in one indexed query and
 * hands them over.
 */
export function nextFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }

  for (let suffix = FIRST_SUFFIX; ; suffix += 1) {
    const tail = `-${suffix}`;
    /*
     * The BASE is shortened to make room, never the counter.
     *
     * A base already at the cap plus "-12" is a slug the column refuses, and
     * that refusal arrives as a failed creation with nothing useful to say.
     * Trimming here means the address stays legal however many households
     * share a name.
     */
    const room = SLUG_FROM_NAME_MAX_LENGTH - tail.length;
    const candidate = `${capAtWord(base, room).replace(/-+$/, "")}${tail}`;

    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}
