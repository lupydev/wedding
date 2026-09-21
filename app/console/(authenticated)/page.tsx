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
  const [mine, everything] = await Promise.all([
    listConsoleInvitations(client, {
      viewerSenderId,
      ownedOnly: true,
      defaultCountry,
    }),
    listConsoleInvitations(client, {
      viewerSenderId,
      ownedOnly: false,
      defaultCountry,
    }),
  ]);
  const theirs = everything.filter((row) => !row.ownedByViewer);

  return (
    // A `div`, not a `main`: `ConsoleShell` above already renders the page's one
    // `main` landmark. Two of them is invalid markup and makes "skip to content"
    // ambiguous for a screen reader.
    //
    // The two sections keep their original order and their `console__section`
    // hook. The tab bar's two in-page destinations are fragments of THIS page, so
    // they are ids on what is already here rather than routes that did not exist.
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
      <ConsoleDashboard summary={summarizeConsoleList(everything)} />

      <section className="console__section flex flex-col gap-4">
        <h2>Tus invitaciones</h2>

        {/* `scroll-mt` so the fragment target is not hidden under the header. */}
        <div className="scroll-mt-4" id="revision">
          <DispatchPreflight
            preflight={buildDispatchPreflight(
              mine,
              ownedPopulation(operatorDisplayName),
            )}
          />
        </div>

        <GuestList
          rows={mine}
          updatePhoneAction={updateGuestPhoneAction}
          dispatchBlocked={dispatchBlocked}
          emptyMessage="Todavía no hay invitaciones a tu nombre."
        />
      </section>

      <section
        className="console__section flex scroll-mt-4 flex-col gap-4"
        id="evento"
      >
        <h2>Todas las invitaciones del evento</h2>

        <p className="max-w-[68ch] text-sm text-muted-foreground">
          Este resumen abarca las invitaciones de ambas cuentas. Las filas de
          abajo son las que gestiona la otra cuenta: se muestran para consulta y
          no ofrecen acción de envío, porque el mensaje saldría de otra cuenta
          de WhatsApp.
        </p>

        <GuestList
          rows={theirs}
          updatePhoneAction={updateGuestPhoneAction}
          // Read-only regardless of the declaration: these households are in the
          // other operator's partition, and `updateGuestPhoneAction` refuses
          // them on the server anyway.
          readOnly={true}
          dispatchBlocked={true}
          emptyMessage="La otra cuenta todavía no tiene invitaciones a su nombre."
        />
      </section>
    </div>
  );
}
