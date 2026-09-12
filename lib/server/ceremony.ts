import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every fact about the wedding that more than one surface shows, read from and
 * written to the one row that holds them.
 *
 * FOUR SURFACES, ONE ROW, NO CONSTANTS
 *
 * The invitation body, the Open Graph card, the WhatsApp draft and the ceremony
 * stream card all render some part of this. Until migration 0011 four of these
 * values lived in a row an operator could correct and four lived as module
 * constants in `components/invitation/InvitationBody.tsx` and
 * `lib/domain/og-card.ts` — which meant half of the wedding could only be
 * corrected by a redeploy, and the two halves could disagree.
 *
 * It is the same reason a reference project's WhatsApp template kept announcing
 * a venue the wedding had already left: the page was fixed in minutes, and
 * nobody thought of the template as a place where the venue was written down.
 *
 * The couple is also streaming the ceremony for people who cannot attend in
 * person. Rather than maintaining a second audience list, a household that
 * declines a personal invitation becomes a stream viewer automatically, and the
 * stream details they are shown are these same values — behind the phone gate,
 * which is better protected than the public ceremony page that will serve
 * everyone else later.
 *
 * NOTHING HERE IS LOGGED. Not on success, not on failure, not the passcode and
 * not the names. An error message names the operation and the database's own
 * complaint, never a submitted value.
 */

/** The ceremony row, in the shape a component renders. */
export interface CeremonyDetails {
  /** The wedding date AND the stream date. One day, one column. */
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamMeetingId: string;
  /** Visible behind the phone gate to every household that declined. */
  readonly streamPasscode: string;
  /** Reaches guests through the immutable, WhatsApp-cached card. */
  readonly coupleNames: string;
  readonly venueName: string;
  readonly venueAddress: string;
}

interface CeremonyRow {
  ceremony_date: string;
  ceremony_time: string;
  stream_meeting_id: string;
  stream_passcode: string;
  couple_names: string;
  venue_name: string;
  venue_address: string;
}

const CEREMONY_SELECT =
  "ceremony_date, ceremony_time, stream_meeting_id, stream_passcode, " +
  "couple_names, venue_name, venue_address";

/**
 * Reads the ceremony row.
 *
 * Throws rather than returning `null` when the row is missing. The table is a
 * singleton seeded by its own migration, so an absent row means the migration
 * did not run — and a page that quietly rendered blank details would send a
 * household to a call they cannot join, or to a wedding with no venue on the
 * invitation, with nothing anywhere saying why. The same reasoning as the
 * gate's missing-owner check in `page.tsx`.
 */
export async function getCeremony(
  client: SupabaseClient,
): Promise<CeremonyDetails> {
  const { data, error } = await client
    .from("ceremony")
    .select(CEREMONY_SELECT)
    .maybeSingle<CeremonyRow>();

  if (error) {
    throw new Error(`Could not read the ceremony details: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      "The ceremony row is missing, so no wedding details can be shown. " +
        "Migration 0009_ceremony.sql seeds it and 0011_wedding_facts.sql " +
        "extends it.",
    );
  }

  return {
    ceremonyDate: data.ceremony_date,
    ceremonyTime: data.ceremony_time,
    streamMeetingId: data.stream_meeting_id,
    streamPasscode: data.stream_passcode,
    coupleNames: data.couple_names,
    venueName: data.venue_name,
    venueAddress: data.venue_address,
  };
}

/**
 * Writes all seven facts back to the singleton.
 *
 * AN UPDATE, NEVER AN UPSERT. The row exists from migration 0009 onward, and an
 * upsert against a table whose primary key is a constant `true` would either
 * succeed as an update anyway or, if the key were ever relaxed, create the
 * second row the singleton constraint exists to prevent. `.eq("id", true)`
 * names the one row explicitly rather than relying on a bare `update` matching
 * whatever is there.
 *
 * ALL SEVEN AT ONCE, NOT A PATCH. The console edits them in one form and saves
 * them in one submission, so a partial write has no caller — and a partial write
 * is how the date ends up belonging to one correction and the venue to another.
 *
 * Validation happens before this: `parseWeddingFacts` in `lib/domain` trims and
 * refuses blanks, over-long values and line breaks. This function is not a
 * second validator, and the table's own non-blank checks are the last line
 * rather than the only one. A refusal from Postgres surfaces as a thrown error
 * carrying the database's message, which names the violated constraint and
 * therefore the field.
 */
export async function updateCeremony(
  client: SupabaseClient,
  details: CeremonyDetails,
): Promise<void> {
  const { error } = await client
    .from("ceremony")
    .update({
      ceremony_date: details.ceremonyDate,
      ceremony_time: details.ceremonyTime,
      stream_meeting_id: details.streamMeetingId,
      stream_passcode: details.streamPasscode,
      couple_names: details.coupleNames,
      venue_name: details.venueName,
      venue_address: details.venueAddress,
    })
    .eq("id", true);

  if (error) {
    // The message is the database's own and carries the constraint name. No
    // submitted value is interpolated: the passcode in particular must not end
    // up in a stack trace, a log line or an error page.
    throw new Error(`Could not save the wedding details: ${error.message}`);
  }
}
