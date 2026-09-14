import type { DispatchCandidateGuest } from "./dispatch-message";

/**
 * Who a dispatch is addressed to — resolved from an explicit choice, pure.
 *
 * WHY THIS REPLACED AN AUTO-PICK
 *
 * `selectDispatchRecipient` used to scan a household and return the first
 * member whose number could carry WhatsApp. Nobody chose that person; the
 * recipient was whichever guest the data happened to list first. That was not a
 * convenience, it was a message leaving for somebody no operator ever looked
 * at. The choice is now stored, made by a human, and this function only reports
 * whether the chosen person can still be reached.
 *
 * FOUR REASONS, NOT TWO, BECAUSE THE QUESTION CHANGED
 *
 * "Who can this go to" has two failure modes. "Can it go to the person who was
 * chosen" has four, because a choice can also be absent or stale. Each names a
 * different piece of work for a person, so they are never collapsed:
 *
 *  - `no_recipient_chosen`         → choose somebody. On day one, most of them.
 *  - `recipient_has_no_phone`      → type that person's number in.
 *  - `recipient_phone_unreachable` → find them a mobile, or choose somebody else.
 *  - `recipient_not_in_household`  → the choice is stale. Choose again.
 *
 * WHY IT TAKES PLAIN ARRAYS
 *
 * A composite foreign key makes `recipient_not_in_household` impossible to
 * PERSIST (design D23), so in practice that reason is expected to stay
 * permanently empty. It is resolved here anyway: this function receives a plain
 * array and a plain id, it cannot see that constraint, and a pure function that
 * trusts an invariant its caller promised is one refactor away from being wrong
 * the day that promise stops holding.
 */

/**
 * A dispatch candidate that can be NAMED by a stored choice.
 *
 * `DispatchCandidateGuest` already carries `id` since the choice exists; the
 * re-declaration keeps this interface readable on its own, which is how
 * `design.md` §4 states it.
 */
export interface IdentifiedDispatchGuest extends DispatchCandidateGuest {
  readonly id: string;
}

/** Why the chosen recipient cannot receive this dispatch. */
export type DispatchRecipientProblem =
  | "no_recipient_chosen"
  | "recipient_not_in_household"
  | "recipient_has_no_phone"
  | "recipient_phone_unreachable";

export type DispatchRecipientOutcome =
  | {
      readonly ok: true;
      readonly guest: IdentifiedDispatchGuest;
      readonly phoneE164: string;
    }
  | { readonly ok: false; readonly reason: DispatchRecipientProblem };

/**
 * Resolves one household's chosen recipient, or says exactly why it cannot.
 *
 * No fallback, at any step. A stale choice does not quietly become the next
 * reachable member, and an unreachable choice does not quietly become their
 * partner — both would re-introduce the auto-pick this capability removed,
 * under a name that hides it.
 */
export function resolveDispatchRecipient(
  guests: readonly IdentifiedDispatchGuest[],
  chosenGuestId: string | null,
): DispatchRecipientOutcome {
  if (chosenGuestId === null || chosenGuestId === "") {
    return { ok: false, reason: "no_recipient_chosen" };
  }

  const chosen = guests.find((guest) => guest.id === chosenGuestId);

  if (chosen === undefined) {
    return { ok: false, reason: "recipient_not_in_household" };
  }

  // A cleared form field submits `""`, which means the same as never having had
  // a number — not a number that happens to be empty.
  if (chosen.phoneE164 === null || chosen.phoneE164 === "") {
    return { ok: false, reason: "recipient_has_no_phone" };
  }

  if (!chosen.dispatchable) {
    return { ok: false, reason: "recipient_phone_unreachable" };
  }

  return { ok: true, guest: chosen, phoneE164: chosen.phoneE164 };
}
