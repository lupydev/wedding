import "server-only";

import { cache } from "react";

import { isWellFormedSlug } from "@/lib/domain/slug";
import {
  findInvitationBySlug,
  findSenderContactPhone,
  toGuestFacingInvitation,
  type GuestFacingInvitation,
  type InvitationRecord,
} from "@/lib/server/invitations";
import { getCeremony, type CeremonyDetails } from "@/lib/server/ceremony";
import { getCurrentRsvp, type RsvpResponseRecord } from "@/lib/server/rsvp";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * Reads one invitation for the guest-facing route.
 *
 * Wrapped in React's `cache` because the request touches it more than once:
 * `generateMetadata` needs the household's name for `og:title`, the page needs
 * the invitation id to check the unlock cookie, and the gate needs the greeting
 * name. Without deduplication every crawler fetch would cost several round
 * trips to Postgres for the same row.
 *
 * The RECORD stays here, inside `lib/server`-facing code. Nothing rendered ever
 * receives it: components are handed `toGuestFacingInvitation`'s projection,
 * which has no phone field to leak, and the gate is handed the last-8
 * references only.
 */
export const loadInvitationRecord = cache(
  async (slug: string): Promise<InvitationRecord | null> => {
    // A malformed slug cannot exist, so it is answered without a database round
    // trip. That also means an enumeration attempt of nonsense strings costs
    // the database nothing.
    if (!isWellFormedSlug(slug)) {
      return null;
    }

    return findInvitationBySlug(createServerSupabaseClient(), slug);
  },
);

/**
 * The guest-facing PROJECTION of the same invitation.
 *
 * `phone_e164` and `phone_last8` are dropped before anything reaches a
 * component, so no rendering path has a phone number available to leak.
 */
export const loadGuestFacingInvitation = cache(
  async (slug: string): Promise<GuestFacingInvitation | null> => {
    const record = await loadInvitationRecord(slug);

    return record === null ? null : toGuestFacingInvitation(record);
  },
);

/**
 * The owning sender's contact number, for the gate's recovery link.
 *
 * Cached per request like the invitation itself: the gate renders once, but a
 * cached read costs nothing and keeps a future second call from doubling the
 * query.
 */
export const loadOwnerContactPhone = cache(
  async (senderId: string): Promise<string | null> =>
    findSenderContactPhone(createServerSupabaseClient(), senderId),
);

/**
 * The household's CURRENT RSVP, or `null` if they have not answered.
 *
 * Cached per request like everything else here. It reads `rsvp_latest`
 * (migration 0008), never `rsvp_responses`: the table is append-only history,
 * so "the answer" is a reduction to one row per invitation, and doing that
 * reduction at the call site is how the same product gets two screens that
 * disagree about how many people are coming.
 */
export const loadCurrentRsvp = cache(
  async (invitationId: string): Promise<RsvpResponseRecord | null> =>
    getCurrentRsvp(createServerSupabaseClient(), invitationId),
);

/**
 * The ceremony and its stream details.
 *
 * Cached per request like everything else here. It reads the singleton
 * `ceremony` row (migration 0009) rather than an environment variable, because
 * the public ceremony page — a later work unit — needs exactly the same four
 * values and a fact stored in two places is a fact that will drift.
 */
export const loadCeremony = cache(async (): Promise<CeremonyDetails> =>
  getCeremony(createServerSupabaseClient()),
);
