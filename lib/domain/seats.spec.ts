import { describe, expect, it } from "vitest";

import { validateRsvpSelection } from "./seats";

// The seat cap is a hard invariant, not a signal to surface: it is enforced in
// the DB trigger, here, and again in the server action, because the form is the
// only one of the three layers an attacker controls.

describe("validateRsvpSelection", () => {
  it("accepts a selection under the cap", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 2, attendeeGuestIds: ["a", "b"] },
        4,
      ),
    ).toEqual({ ok: true });
  });

  it("accepts a selection exactly at the cap", () => {
    expect(
      validateRsvpSelection(
        {
          attending: true,
          seatsConfirmed: 4,
          attendeeGuestIds: ["a", "b", "c", "d"],
        },
        4,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects seatsConfirmed above the cap", () => {
    expect(
      validateRsvpSelection(
        {
          attending: true,
          seatsConfirmed: 5,
          attendeeGuestIds: ["a", "b", "c", "d"],
        },
        4,
      ),
    ).toEqual({ ok: false, reason: "seats_exceed_allowed" });
  });

  it("rejects more attendees than the cap even when seatsConfirmed fits", () => {
    // A tampered submission could send a low seat count with a long attendee
    // list; both are capped.
    expect(
      validateRsvpSelection(
        {
          attending: true,
          seatsConfirmed: 1,
          attendeeGuestIds: ["a", "b", "c", "d", "e"],
        },
        4,
      ),
    ).toEqual({ ok: false, reason: "attendees_exceed_allowed" });
  });

  it("rejects a seat count that disagrees with the attendee list", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 3, attendeeGuestIds: ["a", "b"] },
        4,
      ),
    ).toEqual({ ok: false, reason: "seats_do_not_match_attendees" });
  });

  it("rejects a negative seat count", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: -1, attendeeGuestIds: [] },
        4,
      ),
    ).toEqual({ ok: false, reason: "seats_negative" });
  });

  it("rejects a non-integer seat count", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 1.5, attendeeGuestIds: ["a"] },
        4,
      ),
    ).toEqual({ ok: false, reason: "seats_not_an_integer" });
  });

  it("rejects an attending selection with zero seats", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 0, attendeeGuestIds: [] },
        4,
      ),
    ).toEqual({ ok: false, reason: "attending_without_seats" });
  });

  it("accepts a decline with zero seats and no attendees", () => {
    expect(
      validateRsvpSelection(
        { attending: false, seatsConfirmed: 0, attendeeGuestIds: [] },
        4,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects a decline that still claims seats", () => {
    // Mirrors the DB constraint `attending or seats_confirmed = 0`.
    expect(
      validateRsvpSelection(
        { attending: false, seatsConfirmed: 2, attendeeGuestIds: ["a", "b"] },
        4,
      ),
    ).toEqual({ ok: false, reason: "declined_with_seats" });
  });

  it("rejects a duplicated attendee used to inflate the count", () => {
    expect(
      validateRsvpSelection(
        { attending: true, seatsConfirmed: 2, attendeeGuestIds: ["a", "a"] },
        4,
      ),
    ).toEqual({ ok: false, reason: "duplicate_attendees" });
  });
});
