import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { RsvpFailureReason } from "@/lib/domain/rsvp-copy";
import { isRsvpOpen } from "@/lib/domain/rsvp-deadline";
import { validateRsvpSelection } from "@/lib/domain/seats";

import { verifyUnlockCookie } from "./cookies";

/**
 * The RSVP adapter: the only code allowed to write an answer.
 *
 * WHY IT IS A SERVER ACTION AND NOT A CLIENT INSERT
 *
 * A direct browser insert would need an `anon` INSERT policy on
 * `rsvp_responses` keyed on a slug the caller already holds — which is to say,
 * an unauthenticated write endpoint whose only credential is the value being
 * checked. That is a spam channel, not authorization. So the write happens
 * here, behind the signed unlock cookie, and the browser never holds a Supabase
 * client for guest data at all (migration 0002 keeps that true by default-deny).
 *
 * WHY SEATS ARE DERIVED AND NEVER TYPED
 *
 * The database enforces two rules that must agree with the form: the hard cap
 * (`seats_confirmed <= seats_allowed`, 0003) and parity (`seats_confirmed =
 * cardinality(attendee_guest_ids)`, 0007). Every seat on this guest list
 * corresponds to a named person — the couple has the names — so the honest
 * input is the set of checked boxes and nothing else. `seats_confirmed` is
 * computed from that set here. There is no field on the wire that reaches that
 * column, so a mismatch cannot be submitted, not merely cannot be submitted by
 * the form.
 *
 * WHY EVERY SUBMISSION IS AN INSERT
 *
 * `rsvp_responses` is append-only by trigger, including against `service_role`.
 * A guest who changes her mind writes a new row, and "she said yes, then
 * cancelled" stays visible. The consequence is that the CURRENT answer is a
 * reduction, never a scan: `latestResponse` reads the `rsvp_latest` view
 * (migration 0008), which is one row per invitation by construction. Counting
 * over `rsvp_responses` directly double-counts every household that changed its
 * mind — the defect that had a reference project reporting 47 confirmed from 17
 * answers. Nothing here, and nothing added later, may aggregate the raw table.
 */

/** `rsvp_responses.dietary_notes` CHECK limit, restated where input is parsed. */
export const DIETARY_NOTES_MAX_LENGTH = 500;

/** The form field carrying one checked attendee. Repeated, once per person. */
export const ATTENDEE_FIELD = "attendee";

/**
 * The submitted payload, and the ONLY fields that exist on the wire.
 *
 * `seats_confirmed` is deliberately absent: it is derived below. A tampered
 * payload that adds it is not rejected, it is simply not read, which is the
 * stronger outcome — there is nothing to validate because there is nothing to
 * validate against. A `message` field is absent for the same reason and gets
 * the same treatment, since migration 0010 removed both the form field and the
 * column: the free-text note to the couple competed with the WhatsApp thread
 * this whole flow already lives in, and lost.
 *
 * `dietary_notes` is the one optional field that remains, because it is not a
 * message — it is operational data the catering needs and a guest will not
 * think to send unprompted. It is trimmed and then emptied to `null`, so a
 * guest who types only spaces is stored the same way as one who typed nothing.
 * The length bound matches the `char_length` CHECK constraint in migration
 * 0001: Postgres would refuse an over-long value anyway, but as a 500 carrying
 * a database message instead of a sentence the guest can act on.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const rsvpPayloadSchema = z.object({
  attending: z.enum(["yes", "no"]),
  attendeeGuestIds: z.array(z.uuid()),
  dietaryNotes: optionalText(DIETARY_NOTES_MAX_LENGTH).nullable(),
});

/** A row on its way into `rsvp_responses`. There is no update counterpart. */
export interface NewRsvpResponse {
  readonly invitationId: string;
  readonly attending: boolean;
  readonly attendeeGuestIds: readonly string[];
  readonly seatsConfirmed: number;
  readonly dietaryNotes: string | null;
}

/** A stored response, as `rsvp_latest` returns it. */
export interface RsvpResponseRecord extends NewRsvpResponse {
  readonly id: string;
  /** ISO 8601, exactly as Postgres rendered `submitted_at`. */
  readonly submittedAt: string;
}

/**
 * The response log, as a port.
 *
 * Two methods, and there will never be a third: append-only is not a
 * convention here, it is a trigger that raises even for our own server
 * identity. A port with an `update` would be a port describing code the
 * database refuses to run.
 *
 * A port rather than direct Supabase calls in `submitRsvp` because the
 * authorization order and the seat derivation are the parts worth testing, and
 * testing them through a mocked query builder is testing the mock. The real
 * implementation is exercised against the live stack in
 * `supabase/tests/rsvp-store.spec.ts` and end to end in `e2e/rsvp.spec.ts`.
 */
export interface RsvpStore {
  insertResponse(row: NewRsvpResponse): Promise<void>;
  latestResponse(invitationId: string): Promise<RsvpResponseRecord | null>;
}

/** Exactly what deciding an RSVP needs to know about an invitation. */
export interface RsvpTarget {
  readonly id: string;
  readonly seatsAllowed: number;
  /** ISO calendar day, or `null` for an invitation that never closes. */
  readonly rsvpDeadline: string | null;
  /** Every guest named on this invitation. Nobody else may be seated. */
  readonly guestIds: readonly string[];
}

export interface SubmitRsvpRequest {
  readonly invitation: RsvpTarget;
  /** The raw `inv_unlock` cookie value, or `""` when the browser sent none. */
  readonly unlockCookie: string;
  readonly formData: FormData;
  /** Supplied by the caller (design decision D2), never read from the clock. */
  readonly now: Date;
}

export type RsvpOutcome =
  | { readonly status: "recorded" }
  | { readonly status: "not_authorized" }
  | { readonly status: "closed" }
  | { readonly status: "rejected"; readonly reason: RsvpFailureReason };

interface RsvpPayload {
  readonly attending: boolean;
  readonly attendeeGuestIds: readonly string[];
  readonly dietaryNotes: string | null;
}

/**
 * Reads the payload out of `FormData`, or reports that it is not the form's.
 *
 * `getAll` rather than `get` for the attendees, because that is what a repeated
 * checkbox name produces. Everything else is a single value, and a missing one
 * arrives as `null` — which the schema refuses for `attending` and accepts for
 * the two optional fields.
 */
function parsePayload(formData: FormData): RsvpPayload | null {
  const parsed = rsvpPayloadSchema.safeParse({
    attending: formData.get("attending"),
    attendeeGuestIds: formData.getAll(ATTENDEE_FIELD),
    dietaryNotes: formData.get("dietaryNotes"),
  });

  if (!parsed.success) {
    return null;
  }

  return {
    attending: parsed.data.attending === "yes",
    attendeeGuestIds: parsed.data.attendeeGuestIds,
    dietaryNotes: parsed.data.dietaryNotes,
  };
}

/**
 * Records one RSVP.
 *
 * The order of the checks IS the security property, in the same way the gate's
 * is: the cookie decides first, so an unauthorized caller learns nothing about
 * the invitation — not whether it is closed, not whether its guest ids are
 * real, not whether the payload was well-formed. Only then does the deadline
 * decide, and only then is anything parsed or written.
 */
export async function submitRsvp(
  store: RsvpStore,
  request: SubmitRsvpRequest,
): Promise<RsvpOutcome> {
  const { invitation, unlockCookie, formData, now } = request;

  // The cookie's own payload names the invitation it unlocked, and it is
  // checked against THIS one. A guest unlocked for household A cannot answer
  // for household B, whatever the browser decided to send.
  if (!verifyUnlockCookie(unlockCookie, invitation.id, now.getTime())) {
    return { status: "not_authorized" };
  }

  if (!isRsvpOpen(invitation.rsvpDeadline, now)) {
    return { status: "closed" };
  }

  const payload = parsePayload(formData);

  if (payload === null) {
    return { status: "rejected", reason: "invalid_input" };
  }

  // A decline names nobody and holds no seats. Doing this by construction —
  // rather than refusing a decline that arrived with boxes checked — is what
  // lets the form leave the checkboxes as the guest left them while they change
  // their mind, and still satisfy `rsvp_declined_has_zero_seats`.
  const attendeeGuestIds = payload.attending ? payload.attendeeGuestIds : [];

  // Shape before identity, matching the order `validateRsvpSelection` itself
  // uses: five names against three seats is over the cap whoever those five
  // people are, and answering "we do not recognize one of them" would report a
  // downstream symptom instead of the thing that is actually wrong.
  const validation = validateRsvpSelection(
    {
      attending: payload.attending,
      // DERIVED. The wire has no say in this number.
      seatsConfirmed: attendeeGuestIds.length,
      attendeeGuestIds,
    },
    invitation.seatsAllowed,
  );

  if (!validation.ok) {
    return { status: "rejected", reason: validation.reason };
  }

  const named = new Set(invitation.guestIds);

  if (attendeeGuestIds.some((guestId) => !named.has(guestId))) {
    // Well-formed, inside the cap, and still not this household's to seat.
    // The database cannot catch this one: `attendee_guest_ids` is a uuid array,
    // not a foreign key, so nothing below this line would notice.
    return { status: "rejected", reason: "unknown_guest" };
  }

  await store.insertResponse({
    invitationId: invitation.id,
    attending: payload.attending,
    attendeeGuestIds,
    seatsConfirmed: attendeeGuestIds.length,
    dietaryNotes: payload.dietaryNotes,
  });

  return { status: "recorded" };
}

interface RsvpLatestRow {
  id: string;
  invitation_id: string;
  attending: boolean;
  attendee_guest_ids: string[];
  seats_confirmed: number;
  dietary_notes: string | null;
  submitted_at: string;
}

const RSVP_LATEST_SELECT =
  "id, invitation_id, attending, attendee_guest_ids, seats_confirmed, " +
  "dietary_notes, submitted_at";

/** The Supabase-backed response log. */
export function createRsvpStore(client: SupabaseClient): RsvpStore {
  return {
    async insertResponse(row) {
      const { error } = await client.from("rsvp_responses").insert({
        invitation_id: row.invitationId,
        attending: row.attending,
        attendee_guest_ids: row.attendeeGuestIds,
        seats_confirmed: row.seatsConfirmed,
        dietary_notes: row.dietaryNotes,
      });

      if (error) {
        throw new Error(`Could not record the RSVP: ${error.message}`);
      }
    },

    async latestResponse(invitationId) {
      // `rsvp_latest`, NEVER `rsvp_responses`. The view is one row per
      // invitation by construction (migration 0008); ordering the raw table and
      // taking the first row would be a second, drifting copy of that rule, and
      // filtering it without ordering would return an arbitrary answer from the
      // household's history.
      const { data, error } = await client
        .from("rsvp_latest")
        .select(RSVP_LATEST_SELECT)
        .eq("invitation_id", invitationId)
        .maybeSingle<RsvpLatestRow>();

      if (error) {
        throw new Error(`Could not read the current RSVP: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        invitationId: data.invitation_id,
        attending: data.attending,
        attendeeGuestIds: data.attendee_guest_ids,
        seatsConfirmed: data.seats_confirmed,
        dietaryNotes: data.dietary_notes,
        submittedAt: data.submitted_at,
      };
    },
  };
}

/**
 * The household's answer as it stands, or `null` if they have not answered.
 *
 * The read side of the append-only history, and the only one the guest-facing
 * page needs: a guest changing their mind must see what they said last time.
 */
export async function getCurrentRsvp(
  client: SupabaseClient,
  invitationId: string,
): Promise<RsvpResponseRecord | null> {
  return createRsvpStore(client).latestResponse(invitationId);
}

/**
 * Is this invitation still accepting answers, as of now?
 *
 * The clock lives HERE, in the adapter, for the same reason it does in
 * `unlockCookieUnlocks`: `isRsvpOpen` takes `now` as an argument so the
 * Bogota day-end rule stays deterministically testable (design decision D2),
 * and a Server Component must not read the clock during render. This is the
 * one place that supplies it for a render.
 *
 * A malformed deadline throws rather than defaulting either way — see
 * `lib/domain/rsvp-deadline.ts` for why a loud failure beats silently opening
 * or closing a household nobody is watching.
 */
export function rsvpIsOpenNow(deadline: string | null): boolean {
  return isRsvpOpen(deadline, new Date());
}
