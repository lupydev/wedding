import { afterEach, describe, expect, it } from "vitest";

import { isRsvpOpen } from "@/lib/domain/rsvp-deadline";
import { RSVP_DEADLINE } from "@/lib/domain/wedding-day";

import { signUnlockCookie } from "./cookies";
import {
  DIETARY_NOTES_MAX_LENGTH,
  rsvpIsOpenNow,
  submitRsvp,
  type NewRsvpResponse,
  type RsvpStore,
  type RsvpTarget,
} from "./rsvp";

/**
 * The RSVP adapter: authorization, derivation, and the append-only write.
 *
 * Everything that DECIDES is already pure and tested elsewhere —
 * `validateRsvpSelection` in `lib/domain/seats.ts` and `isRsvpOpen` in
 * `lib/domain/rsvp-deadline.ts`. What is tested here is the wiring, and the
 * wiring is where every interesting failure lives:
 *
 *  1. The unlock cookie is checked BEFORE anything is written, and it is
 *     checked against THIS invitation — a guest holding household A's cookie
 *     must not be able to answer for household B.
 *  2. `seats_confirmed` is DERIVED from the checked boxes and can never be
 *     typed. The database enforces two rules that must agree with the form by
 *     construction — the cap (0003) and seat/attendee parity (0007) — and a
 *     form that can produce a mismatch is a form that will produce one.
 *  3. Every submission is an INSERT. The port has no update and no delete,
 *     which is the same shape the append-only trigger enforces in Postgres.
 *
 * The store is a port, deliberately, so these are real assertions rather than a
 * Supabase-shaped puppet show. The real store is exercised against the live
 * local stack in `supabase/tests/rsvp-store.spec.ts`.
 */

const ORIGINAL_ENV = { ...process.env };
const SECRET = "s".repeat(40);

process.env.UNLOCK_COOKIE_SECRET = SECRET;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV, UNLOCK_COOKIE_SECRET: SECRET };
});

const INVITATION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_INVITATION_ID = "22222222-2222-4222-8222-222222222222";
const GUEST_ONE = "aaaaaaaa-1111-4111-8111-111111111111";
const GUEST_TWO = "bbbbbbbb-2222-4222-8222-222222222222";
const GUEST_THREE = "cccccccc-3333-4333-8333-333333333333";
const STRANGER = "dddddddd-4444-4444-8444-444444444444";

/** Well inside every deadline used below. */
const NOW = new Date("2026-04-01T15:00:00Z");

function household(overrides: Partial<RsvpTarget> = {}): RsvpTarget {
  return {
    id: INVITATION_ID,
    guestIds: [GUEST_ONE, GUEST_TWO, GUEST_THREE],
    ...overrides,
  };
}

function validCookie(invitationId: string = INVITATION_ID): string {
  return signUnlockCookie(invitationId, NOW.getTime());
}

function fakeStore() {
  const inserted: NewRsvpResponse[] = [];

  const store: RsvpStore = {
    async insertResponse(row) {
      inserted.push(row);
    },
    async latestResponse() {
      // The newest row, which is exactly what `rsvp_latest` returns.
      return inserted.length === 0
        ? null
        : {
            ...inserted[inserted.length - 1],
            id: "00000000-0000-4000-8000-000000000000",
            submittedAt: NOW.toISOString(),
          };
    },
  };

  return { store, inserted };
}

/** The payload the form produces, as `FormData`. */
function form(fields: {
  attending?: string;
  attendees?: readonly string[];
  dietaryNotes?: string;
}): FormData {
  const data = new FormData();

  if (fields.attending !== undefined) {
    data.set("attending", fields.attending);
  }

  for (const attendee of fields.attendees ?? []) {
    data.append("attendee", attendee);
  }

  if (fields.dietaryNotes !== undefined) {
    data.set("dietaryNotes", fields.dietaryNotes);
  }

  return data;
}

function submit(options: {
  store: RsvpStore;
  invitation?: RsvpTarget;
  unlockCookie?: string;
  formData?: FormData;
  now?: Date;
}) {
  return submitRsvp(options.store, {
    invitation: options.invitation ?? household(),
    unlockCookie: options.unlockCookie ?? validCookie(),
    formData:
      options.formData ??
      form({ attending: "yes", attendees: [GUEST_ONE, GUEST_TWO] }),
    now: options.now ?? NOW,
  });
}

describe("submitRsvp authorization", () => {
  it("refuses a request with no unlock cookie and writes nothing", async () => {
    const { store, inserted } = fakeStore();

    const outcome = await submit({ store, unlockCookie: "" });

    expect(outcome).toEqual({ status: "not_authorized" });
    expect(inserted).toEqual([]);
  });

  it("refuses a forged cookie", async () => {
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      unlockCookie: `${validCookie()}tampered`,
    });

    expect(outcome).toEqual({ status: "not_authorized" });
    expect(inserted).toEqual([]);
  });

  it("refuses one household's cookie used against another", async () => {
    // The whole point of binding the invitation id INTO the cookie. A person
    // legitimately holding two links must not be able to answer for the second
    // household with the first one's session.
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      unlockCookie: validCookie(OTHER_INVITATION_ID),
    });

    expect(outcome).toEqual({ status: "not_authorized" });
    expect(inserted).toEqual([]);
  });

  it("refuses an expired cookie", async () => {
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      unlockCookie: signUnlockCookie(INVITATION_ID, NOW.getTime()),
      // 181 days later: past the 180-day cookie lifetime.
      now: new Date(NOW.getTime() + 181 * 24 * 60 * 60 * 1000),
      invitation: household(),
    });

    expect(outcome).toEqual({ status: "not_authorized" });
    expect(inserted).toEqual([]);
  });

  it("checks the cookie before the deadline and before the payload", async () => {
    // Order matters: an unauthorized caller must learn nothing about the state
    // of an invitation it has no session for, including whether it is closed.
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      unlockCookie: "",
      invitation: household(),
      formData: form({ attending: "maybe", attendees: ["not-a-uuid"] }),
    });

    expect(outcome).toEqual({ status: "not_authorized" });
    expect(inserted).toEqual([]);
  });
});

describe("submitRsvp seat derivation", () => {
  it("derives seats_confirmed from the checked boxes", async () => {
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({ attending: "yes", attendees: [GUEST_ONE, GUEST_TWO] }),
    });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted).toEqual([
      {
        invitationId: INVITATION_ID,
        attending: true,
        attendeeGuestIds: [GUEST_ONE, GUEST_TWO],
        seatsConfirmed: 2,
        dietaryNotes: null,
      },
    ]);
  });

  it("ignores a seats_confirmed field a tampered payload supplies", async () => {
    // There is no path from the wire to that column. A submission claiming ten
    // seats while naming one person stores one, so the parity constraint the
    // database enforces (0007) can never be violated by this code.
    const { store, inserted } = fakeStore();
    const formData = form({ attending: "yes", attendees: [GUEST_ONE] });
    formData.set("seatsConfirmed", "10");

    const outcome = await submit({ store, formData });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted[0].seatsConfirmed).toBe(1);
  });

  it("stores a decline with zero seats and nobody named", async () => {
    // Even when boxes were checked before the guest switched to "no": the
    // declined-with-seats CHECK constraint is satisfied by construction.
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({ attending: "no", attendees: [GUEST_ONE, GUEST_TWO] }),
    });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted[0]).toMatchObject({
      attending: false,
      seatsConfirmed: 0,
      attendeeGuestIds: [],
    });
  });

  it("rejects an attendee who belongs to another invitation", async () => {
    // Within the cap, well-formed, and still not this household's to seat.
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({ attending: "yes", attendees: [GUEST_ONE, STRANGER] }),
    });

    expect(outcome).toEqual({ status: "rejected", reason: "unknown_guest" });
    expect(inserted).toEqual([]);
  });

  it("rejects attending with nobody selected", async () => {
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({ attending: "yes", attendees: [] }),
    });

    expect(outcome).toEqual({
      status: "rejected",
      reason: "attending_without_seats",
    });
    expect(inserted).toEqual([]);
  });

  it("rejects the same guest named twice", async () => {
    // Duplicates would otherwise inflate the derived seat count past the number
    // of real people, which is the double-count defect wearing a different hat.
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({ attending: "yes", attendees: [GUEST_ONE, GUEST_ONE] }),
    });

    expect(outcome).toEqual({
      status: "rejected",
      reason: "duplicate_attendees",
    });
    expect(inserted).toEqual([]);
  });

  it("rejects a payload that is not the shape the form produces", async () => {
    const { store, inserted } = fakeStore();

    for (const formData of [
      form({ attending: "maybe", attendees: [GUEST_ONE] }),
      form({ attendees: [GUEST_ONE] }),
      form({ attending: "yes", attendees: ["not-a-uuid"] }),
    ]) {
      const outcome = await submit({ store, formData });

      expect(outcome).toEqual({ status: "rejected", reason: "invalid_input" });
    }

    expect(inserted).toEqual([]);
  });
});

describe("submitRsvp optional fields", () => {
  it("stores null for dietary notes when they are left blank", async () => {
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({
        attending: "yes",
        attendees: [GUEST_ONE],
        dietaryNotes: "   ",
      }),
    });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted[0].dietaryNotes).toBeNull();
  });

  it("trims and stores what the guest actually wrote", async () => {
    const { store, inserted } = fakeStore();

    await submit({
      store,
      formData: form({
        attending: "yes",
        attendees: [GUEST_ONE],
        dietaryNotes: "  Sara es alérgica a los mariscos.  ",
      }),
    });

    expect(inserted[0].dietaryNotes).toBe("Sara es alérgica a los mariscos.");
  });

  it("accepts exactly the length the database column accepts", async () => {
    const { store, inserted } = fakeStore();

    await submit({
      store,
      formData: form({
        attending: "yes",
        attendees: [GUEST_ONE],
        dietaryNotes: "a".repeat(DIETARY_NOTES_MAX_LENGTH),
      }),
    });

    expect(inserted[0].dietaryNotes).toHaveLength(DIETARY_NOTES_MAX_LENGTH);
  });

  it("refuses one character more, rather than letting Postgres do it", async () => {
    // The `char_length` CHECK constraint would catch this anyway, but as a 500
    // with a Postgres message. Matching the limit here turns it into feedback.
    const { store, inserted } = fakeStore();

    const outcome = await submit({
      store,
      formData: form({
        attending: "yes",
        attendees: [GUEST_ONE],
        dietaryNotes: "a".repeat(DIETARY_NOTES_MAX_LENGTH + 1),
      }),
    });

    expect(outcome).toEqual({ status: "rejected", reason: "invalid_input" });
    expect(inserted).toEqual([]);
  });

  it("has no message field at all, and ignores one a payload invents", async () => {
    // The free-text message to the couple is GONE, form and column both. The
    // whole flow begins in the guest's own WhatsApp thread with the couple, so
    // a box in this form competes with the chat they are already in — and
    // loses, because a WhatsApp reply reaches the couple where they actually
    // are while a form field waits for somebody to remember to check it.
    //
    // Ignored rather than rejected, exactly like `seatsConfirmed`: nothing
    // reads the field, so there is no value to validate and nowhere for it to
    // land. `dietary_notes` stays, because that is not a message — it is
    // operational data the caterer needs and a guest would not send unprompted.
    const { store, inserted } = fakeStore();
    const formData = form({ attending: "yes", attendees: [GUEST_ONE] });
    formData.set("message", "¡Gracias por invitarnos!");

    const outcome = await submit({ store, formData });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted).toHaveLength(1);
    expect(Object.keys(inserted[0]).sort()).toEqual([
      "attendeeGuestIds",
      "attending",
      "dietaryNotes",
      "invitationId",
      "seatsConfirmed",
    ]);
  });

  it("matches the char_length limit the schema declares", () => {
    expect(DIETARY_NOTES_MAX_LENGTH).toBe(500);
  });
});

describe("submitRsvp append-only history", () => {
  it("inserts a new row for a changed answer instead of replacing one", async () => {
    const { store, inserted } = fakeStore();

    await submit({
      store,
      formData: form({ attending: "yes", attendees: [GUEST_ONE, GUEST_TWO] }),
    });
    await submit({ store, formData: form({ attending: "no" }) });

    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({ attending: true, seatsConfirmed: 2 });
    expect(inserted[1]).toMatchObject({ attending: false, seatsConfirmed: 0 });

    // And the current state is the LAST one, not a sum of the two.
    await expect(store.latestResponse(INVITATION_ID)).resolves.toMatchObject({
      attending: false,
      seatsConfirmed: 0,
    });
  });

  it("offers no way to update or delete a response", async () => {
    // Structural, and deliberately asserted: the port has exactly two methods,
    // which is the same shape `rsvp_responses_append_only` enforces in Postgres
    // even against `service_role`. A third method here would be the first step
    // toward code the database will reject at runtime.
    const { store } = fakeStore();

    expect(Object.keys(store).sort()).toEqual([
      "insertResponse",
      "latestResponse",
    ]);
  });
});

/**
 * THE DEADLINE IS THE WEDDING'S, NOT THE HOUSEHOLD'S.
 *
 * These instants used to be relative to a date passed in per invitation. There
 * is one deadline now — one week before the wedding, derived in
 * `lib/domain/wedding-day.ts` — so they are relative to that.
 */
describe("submitRsvp deadline", () => {
  it("refuses a submission after the deadline day has ended in Bogota", async () => {
    const { store, inserted } = fakeStore();
    // 2026-11-22T04:00Z is 23:00 on the 21st in Bogota — still open — so this
    // is the first instant of the 22nd there.
    const now = new Date("2026-11-22T05:00:00Z");

    const outcome = await submit({
      store,
      invitation: household(),
      now,
      unlockCookie: signUnlockCookie(INVITATION_ID, now.getTime()),
    });

    expect(outcome).toEqual({ status: "closed" });
    expect(inserted).toEqual([]);
  });

  it("accepts a submission on the evening of the deadline day", async () => {
    // The defect `rsvp-deadline.ts` exists to prevent: compared as a bare
    // timestamp this instant is already "past" the 21st, and a guest answering
    // at 23:00 on the day they were given would be told they are late.
    const { store, inserted } = fakeStore();
    const now = new Date("2026-11-22T04:00:00Z");

    const outcome = await submit({
      store,
      invitation: household(),
      now,
      unlockCookie: signUnlockCookie(INVITATION_ID, now.getTime()),
    });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted).toHaveLength(1);
  });

  /**
   * AND NO ROW CAN CARRY A DATE THAT REACHES THIS AT ALL.
   *
   * The guarantee used to be that `RsvpTarget` had no field for one, so a
   * stored date had no path into the gate. Migration 0016 finished the job by
   * dropping `invitations.rsvp_deadline` outright, so the date no longer
   * exists to be passed. Structural rather than behavioural, twice over:
   * there is nothing to pass, and nowhere for it to have come from.
   */
  it("answers on the wedding's deadline regardless of what a row holds", async () => {
    const { store, inserted } = fakeStore();
    const now = new Date("2026-11-01T12:00:00Z");

    const outcome = await submit({
      store,
      invitation: household(),
      now,
      unlockCookie: signUnlockCookie(INVITATION_ID, now.getTime()),
    });

    expect(outcome).toEqual({ status: "recorded" });
    expect(inserted).toHaveLength(1);
  });
});

describe("rsvpIsOpenNow", () => {
  it("answers for the wedding's own deadline", () => {
    expect(rsvpIsOpenNow()).toBe(isRsvpOpen(RSVP_DEADLINE, new Date()));
  });

  it("reads the clock here so the Server Component never does", () => {
    /*
      The mirror of `unlockCookieUnlocks`: `isRsvpOpen` takes `now` as an
      argument so it stays deterministic (design D2), and this adapter is the
      one place that supplies it for a render. A page that called `Date.now()`
      itself would be a page whose deadline behaviour no unit test can pin.

      The arity flipped from one to ZERO with this change, and that is the
      assertion now. It used to be handed a per-invitation deadline; there is
      one wedding and one deadline, so there is nothing left for a caller to
      pass — and nothing left for a caller to pass WRONG.
    */
    expect(rsvpIsOpenNow.length).toBe(0);
    expect(isRsvpOpen.length).toBeGreaterThanOrEqual(2);
  });
});
