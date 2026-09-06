/**
 * RSVP seat validation — pure.
 *
 * The seat allowance is a HARD CAP (design decision D6), not a suggestion, so it
 * is enforced at three layers: the `enforce_seat_cap` database trigger, this
 * function, and the server action that calls it. The form is the only one of the
 * three an attacker controls, which is why the other two exist.
 */

export interface RsvpSelection {
  readonly attending: boolean;
  readonly seatsConfirmed: number;
  readonly attendeeGuestIds: readonly string[];
}

export type RsvpRejectionReason =
  | "seats_not_an_integer"
  | "seats_negative"
  | "seats_exceed_allowed"
  | "attendees_exceed_allowed"
  | "duplicate_attendees"
  | "declined_with_seats"
  | "attending_without_seats"
  | "seats_do_not_match_attendees";

export type RsvpValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RsvpRejectionReason };

const REJECTED = (reason: RsvpRejectionReason): RsvpValidationResult => ({
  ok: false,
  reason,
});

/**
 * Validates an RSVP selection against the invitation's seat allowance.
 *
 * Checks run from the most structural failure to the most semantic one so the
 * reported reason always describes the first thing actually wrong, rather than a
 * downstream symptom of it.
 */
export function validateRsvpSelection(
  selection: RsvpSelection,
  seatsAllowed: number,
): RsvpValidationResult {
  const { attending, seatsConfirmed, attendeeGuestIds } = selection;

  if (!Number.isInteger(seatsConfirmed)) {
    return REJECTED("seats_not_an_integer");
  }

  if (seatsConfirmed < 0) {
    return REJECTED("seats_negative");
  }

  if (seatsConfirmed > seatsAllowed) {
    return REJECTED("seats_exceed_allowed");
  }

  if (attendeeGuestIds.length > seatsAllowed) {
    return REJECTED("attendees_exceed_allowed");
  }

  if (new Set(attendeeGuestIds).size !== attendeeGuestIds.length) {
    return REJECTED("duplicate_attendees");
  }

  if (!attending && seatsConfirmed > 0) {
    return REJECTED("declined_with_seats");
  }

  if (attending && seatsConfirmed === 0) {
    return REJECTED("attending_without_seats");
  }

  if (seatsConfirmed !== attendeeGuestIds.length) {
    return REJECTED("seats_do_not_match_attendees");
  }

  return { ok: true };
}
