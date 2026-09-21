import { Suspense } from "react";

import { ConsoleSkeleton } from "@/components/console/ConsoleSkeleton";
import { GuestDirectory } from "@/components/console/GuestDirectory";
import { buildGuestDirectory } from "@/lib/domain/guest-directory";
import { requireOperator } from "@/lib/server/console-session";
import { listGuestDirectory } from "@/lib/server/guest-directory";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import {
  createDirectoryGuestAction,
  deleteDirectoryGuestAction,
  updateDirectoryGuestAction,
} from "../actions";

/**
 * The list of PEOPLE. `/console` lists households; this lists everybody.
 *
 * A thin async container, as every async RSC in this codebase is: it fetches,
 * then hands props down. Vitest cannot render an async Server Component, so
 * anything decided HERE would be reachable only by Playwright — which is
 * exactly why nothing is decided here. The order and the counts live in
 * `lib/domain/guest-directory.ts` and the read in `lib/server/guest-directory.ts`,
 * both under test.
 *
 * THE TWO GATES ARE THE LAYOUT'S, AND THIS PAGE ADDS NEITHER. Every route in
 * `(authenticated)` is behind `requireOperator` and `requireDeclaredDevice`
 * alike; declaring the handset is a one-time answer, not a per-screen toll.
 *
 * WHAT THIS SCREEN DOES NOT DO IS GO READ-ONLY ON A MISMATCH. That gate exists
 * to stop a dispatch being RECORDED from the wrong handset, and writing a name
 * down records none — the same reasoning that already keeps the inline phone
 * editor writable. Locking the guest list on a mismatch would mean the operator
 * on the other phone cannot fix the very data the readiness panel is sending
 * them to fix. `createDirectoryGuestAction` and its two siblings carry no
 * declaration check for exactly that reason, asserted in `actions.spec.ts`.
 */
export default async function ConsoleGuestsPage() {
  await requireOperator();

  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Directory />
    </Suspense>
  );
}

async function Directory() {
  const guests = await listGuestDirectory(createServerSupabaseClient());

  return (
    <GuestDirectory
      createAction={createDirectoryGuestAction}
      deleteAction={deleteDirectoryGuestAction}
      directory={buildGuestDirectory(guests)}
      updateAction={updateDirectoryGuestAction}
    />
  );
}
