import { DispatchPreflight } from "@/components/console/DispatchPreflight";
import { GuestList } from "@/components/console/GuestList";
import { ProgressSummary } from "@/components/console/ProgressSummary";
import {
  ALL_INVITATIONS_POPULATION,
  ownedPopulation,
  scopedMetrics,
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

  const client = createServerSupabaseClient();
  const defaultCountry = requiredDefaultPhoneCountry();
  const [mine, everything] = await Promise.all([
    listConsoleInvitations(client, {
      viewerSenderId: operator.id,
      ownedOnly: true,
      defaultCountry,
    }),
    listConsoleInvitations(client, {
      viewerSenderId: operator.id,
      ownedOnly: false,
      defaultCountry,
    }),
  ]);
  const theirs = everything.filter((row) => !row.ownedByViewer);

  return (
    <main className="console__main">
      <section className="console__section">
        <h2>Tus invitaciones</h2>

        <ProgressSummary
          heading={`Resumen de las invitaciones de ${operator.displayName}`}
          metrics={scopedMetrics(
            summarizeConsoleList(mine),
            ownedPopulation(operator.displayName),
          )}
        />

        <DispatchPreflight
          preflight={buildDispatchPreflight(
            mine,
            ownedPopulation(operator.displayName),
          )}
        />

        <GuestList
          rows={mine}
          updatePhoneAction={updateGuestPhoneAction}
          dispatchBlocked={dispatchBlocked}
          emptyMessage="Todavía no hay invitaciones a tu nombre."
        />
      </section>

      <section className="console__section">
        <h2>Todas las invitaciones del evento</h2>

        <p>
          Este resumen abarca las invitaciones de ambas cuentas. Las filas de
          abajo son las que gestiona la otra cuenta: se muestran para consulta y
          no ofrecen acción de envío, porque el mensaje saldría de otra cuenta
          de WhatsApp.
        </p>

        <ProgressSummary
          heading="Resumen del evento completo"
          metrics={scopedMetrics(
            summarizeConsoleList(everything),
            ALL_INVITATIONS_POPULATION,
          )}
        />

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
    </main>
  );
}
