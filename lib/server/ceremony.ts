import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The ceremony and its stream, read from the one row that holds them.
 *
 * The couple is streaming the ceremony for people who cannot attend in person.
 * Rather than maintaining a second audience list, a household that declines a
 * personal invitation becomes a stream viewer automatically, and these are the
 * details they are shown — behind the phone gate, which is better protected
 * than the public ceremony page that will serve everyone else later.
 *
 * Both surfaces read THIS function. Neither restates a value: migration 0009
 * carries the reasoning, and it is the same reason a reference project's
 * WhatsApp template kept announcing a venue the wedding had already left.
 */

/** The ceremony row, in the shape a component renders. */
export interface CeremonyDetails {
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

interface CeremonyRow {
  ceremony_date: string;
  ceremony_time: string;
  stream_meeting_id: string;
  stream_passcode: string;
}

const CEREMONY_SELECT =
  "ceremony_date, ceremony_time, stream_meeting_id, stream_passcode";

/**
 * Reads the ceremony row.
 *
 * Throws rather than returning `null` when the row is missing. The table is a
 * singleton seeded by its own migration, so an absent row means the migration
 * did not run — and a page that quietly rendered blank stream details would
 * send a household to a call they cannot join, with nothing anywhere saying
 * why. The same reasoning as the gate's missing-owner check in `page.tsx`.
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
      "The ceremony row is missing, so no stream details can be shown. " +
        "Migration 0009_ceremony.sql seeds it.",
    );
  }

  return {
    ceremonyDate: data.ceremony_date,
    ceremonyTime: data.ceremony_time,
    streamMeetingId: data.stream_meeting_id,
    streamPasscode: data.stream_passcode,
  };
}
