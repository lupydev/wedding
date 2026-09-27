import type { NameableGuest } from "./guest-name";
import { listMemberName, soloAddressName } from "./guest-name";
import { joinSpanishList } from "./spanish-list";

/**
 * A household's greeting name: how the invitation opens.
 *
 * Identifiers and comments are English; the greeting itself is the couple's
 * Spanish.
 */

/**
 * Why the currently stored greeting name says what it says.
 *
 * - `derived` — recomputed from the members on every membership or nickname
 *   write. The stored copy is a cache and may be stale.
 * - `custom` — a human typed it. Never overwrite it.
 * - `imported` — a script wrote it and nobody has looked. Treated like
 *   `custom` until an operator acts on it: the DEFAULT is `imported` precisely
 *   so an import cannot mark a hand-meaningful name as safe to overwrite.
 */
export type GreetingNameSource = "derived" | "custom" | "imported";

/**
 * The greeting name a household's CURRENT members imply.
 *
 * One member is addressed solo, so it keeps their full name. Two or more are
 * addressed as a list, so each contributes their first name (or nickname) and
 * the Spanish conjunction rule joins them.
 *
 * THROWS on an empty list (design decision 11). An invitation with no members
 * is a state member management refuses to create, and a derivation that
 * tolerated it would hide a caller that reached an impossible state behind a
 * plausible-looking empty string.
 */
export function deriveGreetingName(members: readonly NameableGuest[]): string {
  const [only] = members;
  if (only === undefined) {
    throw new Error("cannot derive a greeting name from zero members");
  }

  if (members.length === 1) {
    return soloAddressName(only);
  }

  return joinSpanishList(members.map(listMemberName));
}

/**
 * The greeting name to DISPLAY, according to the stored source.
 *
 * At `derived` the stored string is ignored entirely and the name is recomputed
 * from the members handed in, because the stored copy predates whatever
 * membership change is being rendered. At `custom` and `imported` the stored
 * string is returned untouched — the members are not even consulted.
 */
export function resolveGreetingName(input: {
  readonly source: GreetingNameSource;
  readonly stored: string;
  readonly members: readonly NameableGuest[];
}): string {
  return input.source === "derived"
    ? deriveGreetingName(input.members)
    : input.stored;
}

/**
 * How a household is greeted, in words, on the screens that greet them.
 *
 * ONE COPY OF THE LINE, WHICH IT HAD NOT BEEN. The gate and the invitation
 * behind it are read a second apart and both open with this sentence, so it
 * was written out twice; the accepted screen needed a third caller and three
 * copies of one sentence is how a surface ends up greeting the same household
 * in two voices.
 *
 * The LAST screen deliberately does not use it — a household that has just
 * said they are coming is told they are expected, not hello again. That line
 * is `rsvpConfirmedHeading`, beside the other copy a member count decides.
 */
export function greetingLine(greetingName: string): string {
  return `¡Hola, ${greetingName}!`;
}
