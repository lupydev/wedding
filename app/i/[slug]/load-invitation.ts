import "server-only";

import { cache } from "react";

import { isWellFormedSlug } from "@/lib/domain/slug";
import {
  findInvitationBySlug,
  toGuestFacingInvitation,
  type GuestFacingInvitation,
} from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * Reads one invitation for the guest-facing route.
 *
 * Wrapped in React's `cache` because the page renders it TWICE per request:
 * once in `generateMetadata`, to put the household's name in `og:title`, and
 * once in the page body. Without deduplication every crawler fetch would cost
 * two round trips to Postgres for the same row.
 *
 * The result is the guest-facing PROJECTION, never the record: `phone_e164`
 * and `phone_last8` are dropped before anything reaches a component, so no
 * rendering path has a phone number available to leak.
 */
export const loadGuestFacingInvitation = cache(
  async (slug: string): Promise<GuestFacingInvitation | null> => {
    // A malformed slug cannot exist, so it is answered without a database round
    // trip. That also means an enumeration attempt of nonsense strings costs
    // the database nothing.
    if (!isWellFormedSlug(slug)) {
      return null;
    }

    const record = await findInvitationBySlug(
      createServerSupabaseClient(),
      slug,
    );

    return record === null ? null : toGuestFacingInvitation(record);
  },
);
