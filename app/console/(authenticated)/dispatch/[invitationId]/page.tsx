import { notFound } from "next/navigation";

import { DispatchLauncher } from "@/components/console/DispatchLauncher";
import { dispatchIsBlockedBy } from "@/lib/domain/device-declaration";
import {
  DISPATCH_EVENT_BEACON_PATH,
  buildInvitationDispatchLink,
  selectDispatchRecipient,
} from "@/lib/domain/dispatch-message";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import {
  requireDeclaredDevice,
  requireOperator,
} from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry, siteOrigin } from "@/lib/server/env";
import { findConsoleInvitation } from "@/lib/server/invitations";
import { invitationPageUrl } from "@/lib/server/og-warm";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import {
  markDispatchFailedAction,
  markDispatchSentAction,
} from "../../actions";

/**
 * The compose view: build the link, open WhatsApp, then say what happened.
 *
 * A thin async container, like every async RSC in this codebase. Vitest cannot
 * render one, so nothing is DECIDED here: the recipient is chosen by
 * `selectDispatchRecipient`, the draft is rendered by `buildInvitationMessage`,
 * the link is built by `buildWaMeLink`, and the ordering of the beacon against
 * the navigation lives in `DispatchLauncher` — all four under unit test. What
 * this file does is fetch, assemble and hand over props.
 *
 * INSIDE THE `(authenticated)` GROUP ON PURPOSE. The group's layout is what
 * calls `requireOperator()` and renders the device-mismatch interstitial; a
 * dispatch route outside it would be a send affordance with no device gate above
 * it, which is the one place that gate has to hold.
 *
 * THE MESSAGE CARRIES NO EVENT DETAIL. No date, no time, no venue — only the
 * greeting and the invitation URL. That is enforced in `dispatch-message.ts` and
 * explained there; the consequence for this file is that it passes a URL and a
 * name and has nothing else to pass.
 */

export default async function DispatchPage({
  params,
}: {
  readonly params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const operator = await requireOperator();
  const declaration = await requireDeclaredDevice(operator.id);

  // The layout already renders the interstitial above this. The page still has
  // to withhold the action itself: the interstitial is an explanation, and an
  // explanation is not a boundary.
  if (dispatchIsBlockedBy(declaration.status)) {
    return (
      <main className="console__main">
        <p>
          Los envíos están bloqueados en este dispositivo hasta que la cuenta de
          WhatsApp declarada coincida con la sesión.
        </p>
        <a href={CONSOLE_ROOT_PATH}>Volver al panel</a>
      </main>
    );
  }

  const invitation = await findConsoleInvitation(createServerSupabaseClient(), {
    invitationId,
    viewerSenderId: operator.id,
    defaultCountry: requiredDefaultPhoneCountry(),
  });

  // One response for "does not exist" and for "belongs to the other operator".
  // Distinguishing them would confirm the existence of a household this operator
  // was not shown.
  if (invitation === null) {
    notFound();
  }

  const recipient = selectDispatchRecipient(invitation.guests);

  if (!recipient.ok) {
    return (
      <main className="console__main">
        <h2>No se puede preparar el envío para {invitation.greetingName}</h2>

        <p>
          {recipient.reason === "no_phone_on_file"
            ? "Todavía no hay ningún número guardado para esta invitación. Se puede agregar desde el panel, junto al nombre de cada persona."
            : "Los números guardados para esta invitación no parecen recibir WhatsApp: una línea fija lo es. Enviar de todas formas dejaría registrado un envío que nadie recibiría."}
        </p>

        <ul>
          {invitation.guests.map((guest) => (
            <li key={guest.id}>{guest.fullName}</li>
          ))}
        </ul>

        <a href={CONSOLE_ROOT_PATH}>Volver al panel</a>
      </main>
    );
  }

  return (
    <main className="console__main">
      <DispatchLauncher
        invitationId={invitation.invitationId}
        greetingName={invitation.greetingName}
        recipientName={recipient.guest.fullName}
        waUrl={buildInvitationDispatchLink({
          recipientE164: recipient.phoneE164,
          greetingName: invitation.greetingName,
          invitationUrl: invitationPageUrl(siteOrigin(), invitation.slug),
        })}
        beaconPath={DISPATCH_EVENT_BEACON_PATH}
        dispatchState={invitation.dispatchState}
        markSentAction={markDispatchSentAction}
        markFailedAction={markDispatchFailedAction}
      />

      <a href={CONSOLE_ROOT_PATH}>Volver al panel</a>
    </main>
  );
}
