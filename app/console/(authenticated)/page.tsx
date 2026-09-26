import { Suspense } from "react";

import { ConsoleDashboard } from "@/components/console/ConsoleDashboard";
import { ConsoleSkeleton } from "@/components/console/ConsoleSkeleton";
import { DispatchPreflight } from "@/components/console/DispatchPreflight";
import { GuestList } from "@/components/console/GuestList";
import {
  ownedPopulation,
  summarizeConsoleList,
} from "@/lib/domain/console-list";
import { dispatchIsBlockedBy } from "@/lib/domain/device-declaration";
import { buildDispatchPreflight } from "@/lib/domain/dispatch-preflight";
import {
  requireDeclaredDevice,
  requireOperator,
} from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import { listConsoleInvitations } from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import { updateGuestPhoneAction } from "./actions";

/**
 * The console guest list.
 *
 * A thin async container, as every async RSC in this codebase is: it fetches,
 * then hands props to `GuestList` and `ProgressSummary`. Vitest cannot render an
 * async Server Component, so anything decided HERE is only reachable by
 * Playwright — which is exactly why nothing is decided here. The reduction lives
 * in `lib/domain/console-list.ts` and the reads in `lib/server/invitations.ts`,
 * both under unit test.
 *
 * TWO SCOPES, TWO QUERIES, EACH LABELLED WITH ITS OWN POPULATION
 *
 * The default view is the operator's own partition, applied as a `WHERE` in the
 * query rather than as a filter in this render. The shared dashboard covers every
 * invitation, and its counts say so in words: a number whose population is not
 * on screen is a number nobody can check, which is how a reference project came
 * to report "42 confirmadas" out of every guest in its database.
 *
 * `requireOperator()` again, even though the layout already called it: it is one
 * cached identity header and one indexed row, and the alternative is a page whose
 * authorization depends on a layout continuing to exist above it.
 */
export default async function ConsolePage() {
  const operator = await requireOperator();
  const declaration = await requireDeclaredDevice(operator.id);
  // Blocks the send affordance and nothing else. Editing a phone number sends
  // no message, so the declaration gate has no business stopping it — and a
  // mismatched handset is exactly when the preflight is telling the operator to
  // go and fix numbers.
  const dispatchBlocked = dispatchIsBlockedBy(declaration.status);

  /*
    THE SUSPENSE BOUNDARY IS HERE AND NOWHERE HIGHER.

    Both gates above run OUTSIDE it, deliberately: each of them can redirect, and a
    redirect thrown after the shell has flushed is a 200 with a client-side bounce
    instead of the 307 this route answers. The same reasoning is why the skeleton is
    a component rather than a `loading.tsx` — a boundary at the route-group level
    would also wrap the compose and preview routes, whose `notFound()` must stay a
    real 404.

    What IS inside the boundary is the pair of list queries, which is the part worth
    a skeleton: two partitioned reads over every invitation in the event.
  */
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <ConsoleLists
        dispatchBlocked={dispatchBlocked}
        operatorDisplayName={operator.displayName}
        viewerSenderId={operator.id}
      />
    </Suspense>
  );
}

/**
 * The two partitioned lists, fetched behind the boundary above.
 *
 * It re-reads nothing about the session: the identity arrives as props, already
 * established by the page. A second `requireOperator()` inside a Suspense boundary
 * would be an authorization check whose redirect could no longer change the response
 * status, which is the one place that check must not live.
 */
async function ConsoleLists({
  dispatchBlocked,
  operatorDisplayName,
  viewerSenderId,
}: {
  readonly dispatchBlocked: boolean;
  readonly operatorDisplayName: string;
  readonly viewerSenderId: string;
}) {
  const client = createServerSupabaseClient();
  const defaultCountry = requiredDefaultPhoneCountry();

  /*
    ONE QUERY, WHERE THERE WERE TWO.

    The page used to read the operator's own partition and then every
    invitation, in parallel, and render a list for each. The second read is a
    superset of the first, so every owned household was fetched, reduced and
    rendered twice.
  */
  const rows = await listConsoleInvitations(client, {
    viewerSenderId,
    ownedOnly: false,
    defaultCountry,
  });
  const mine = rows.filter((row) => row.ownedByViewer);

  return (
    // A `div`, not a `main`: `ConsoleShell` above already renders the page's one
    // `main` landmark.
    <div className="console__main flex flex-col gap-8">
      {/*
        ONE DASHBOARD, OVER THE WHOLE EVENT, AND THERE WERE TWO SUMMARIES.

        The page rendered `ProgressSummary` twice — ten sentences for this
        operator's households, then ten more for every household in the event,
        which INCLUDES the first ten. So "Confirmadas" appeared twice on one
        screen with different denominators, and a reader had to work out which
        number answered their question.

        The couple ask two things: how many invitations went out, and how many
        people are coming. Both are about the wedding, not about a partition of
        it, so there is one set of figures and it covers everything.
      */}
      <ConsoleDashboard summary={summarizeConsoleList(rows)} />

      {/*
        ONE LIST, AND THERE WERE TWO.

        "Tus invitaciones" and then "Todas las invitaciones del evento", the
        second a superset of the first, separated by four lines of prose
        explaining the partition — on a console two people share. Every row
        already says who manages it ("Gestionas tú" / "Gestiona X"), which is
        the whole of what the split was communicating.

        Ownership still decides what it always decided, and nothing more: the
        send affordance, because a WhatsApp message leaves from one account and
        not the other. `GuestList` now derives that per ROW rather than per
        list, so a household the viewer does not own offers no send and no
        editing wherever it appears.
      */}
      <section className="console__section flex flex-col gap-4">
        <h2>Invitaciones</h2>

        {/*
          The readiness check stays scoped to what this operator can act on:
          it exists to say which of THEIR households cannot be sent yet, and
          the other account's blockers are not theirs to clear.
        */}
        <div className="scroll-mt-4" id="revision">
          <DispatchPreflight
            preflight={buildDispatchPreflight(
              mine,
              ownedPopulation(operatorDisplayName),
            )}
          />
        </div>

        <GuestList
          rows={rows}
          updatePhoneAction={updateGuestPhoneAction}
          dispatchBlocked={dispatchBlocked}
          emptyMessage="Todavía no hay invitaciones."
        />
      </section>
    </div>
  );
}
