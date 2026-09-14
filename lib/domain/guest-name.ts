/**
 * How one guest is NAMED: the two distinct fallbacks over the same two stored
 * fields, `nickname` and `full_name`.
 *
 * They are two exported functions rather than one function taking a mode flag,
 * deliberately. A flag makes the two fallbacks share a body, and a later edit
 * to the solo rule then changes how every list reads, with nothing failing to
 * say so. Separate functions make that impossible: each one can only be changed
 * on purpose.
 *
 * Identifiers and comments are English; the names themselves are the couple's.
 */

/** The two stored fields any naming decision is made from. */
export interface NameableGuest {
  readonly fullName: string;
  /** Absent for most guests. An empty string means the same as `null`. */
  readonly nickname: string | null;
}

/**
 * A nickname that is actually usable — not `null`, and not the empty string a
 * cleared form field submits.
 */
function usableNickname(guest: NameableGuest): string | null {
  const trimmed = guest.nickname?.trim() ?? "";

  return trimmed === "" ? null : trimmed;
}

/**
 * The first whitespace-separated token of a full name.
 *
 * The first TOKEN, not the first half: `"Luis Alberto Guzmán Restrepo"` reads
 * as `"Luis"` inside a list, because a list of four households reads as names,
 * not as a registry.
 */
export function firstName(fullName: string): string {
  const [first = ""] = fullName.trim().split(/\s+/);

  return first;
}

/**
 * The name for a guest addressed ALONE — a solo invitation, or a direct
 * salutation. Their nickname if they have one, otherwise their FULL name:
 * addressing one person by first name only reads as clipped rather than warm.
 */
export function soloAddressName(guest: NameableGuest): string {
  return usableNickname(guest) ?? guest.fullName.trim();
}

/**
 * The name for a guest listed as ONE MEMBER of a household. Their nickname if
 * they have one, otherwise their FIRST name only — never the full name, which
 * would turn `"Lucho, Luzma y Fer"` into a guest register.
 */
export function listMemberName(guest: NameableGuest): string {
  return usableNickname(guest) ?? firstName(guest.fullName);
}
