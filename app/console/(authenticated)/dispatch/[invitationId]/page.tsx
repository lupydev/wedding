import { notFound } from "next/navigation";

import { DispatchLauncher } from "@/components/console/DispatchLauncher";
import { WhatsAppBubble } from "@/components/console/WhatsAppBubble";
import { dispatchIsBlockedBy } from "@/lib/domain/device-declaration";
import {
  DISPATCH_EVENT_BEACON_PATH,
  buildInvitationDispatchLink,
  buildInvitationMessage,
  buildInvitationWebFallbackLink,
} from "@/lib/domain/dispatch-message";
import {
  resolveDispatchRecipient,
  type DispatchRecipientProblem,
} from "@/lib/domain/dispatch-recipient";
import { buildInvitationMetadataText } from "@/lib/domain/og-card";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { getCeremony } from "@/lib/server/ceremony";
import {
  requireDeclaredDevice,
  requireOperator,
} from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry, siteOrigin } from "@/lib/server/env";
import { findConsoleInvitation } from "@/lib/server/invitations";
import {
  invitationPageUrl,
  resolveAdvertisedCardPath,
} from "@/lib/server/og-warm";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import {
  markDispatchFailedAction,
  markDispatchSentAction,
} from "../../actions";

/**
 * The compose view: build the link, open WhatsApp, then say what happened.
 *
 * A thin async container, like every async RSC in this codebase. Vitest cannot
 * render one, so nothing is DECIDED here: the recipient was chosen by an
 * OPERATOR and is merely resolved by `resolveDispatchRecipient`, the draft is
 * rendered by `buildInvitationMessage`,
 * the link is built by `buildWaMeLink`, and the ordering of the beacon against
 * the navigation lives in `DispatchLauncher` — all four under unit test. What
 * this file does is fetch, assemble and hand over props.
 *
 * INSIDE THE `(authenticated)` GROUP ON PURPOSE. The group's layout is what
 * calls `requireOperator()` and renders the device-mismatch interstitial; a
 * dispatch route outside it would be a send affordance with no device gate above
 * it, which is the one place that gate has to hold.
 *
 * THE MESSAGE CARRIES NO EVENT DETAIL. No date, no time, no venue, no address —
 * the greeting, the couple's names and the invitation URL, and nothing else. That
 * is enforced in `dispatch-message.ts` and explained there; the consequence for
 * this file is that the only wedding fact it reads from the `ceremony` row is the
 * names, and the logistics stay on the surface that can still be corrected.
 *
 * THE PREVIEW PANE RESOLVES THE CARD URL HERE, AND ONLY HERE. The mock bubble's
 * one real claim is that its image is the bytes WhatsApp will fetch, and that
 * holds only while it requests the URL the invitation page ADVERTISES rather
 * than the bare route path — Next appends a build-scoped hash and a CDN keys on
 * the full URL. Resolving it needs a server-side read of the page, so it happens
 * in this async container and arrives at the props-only component as a string.
 * A failure yields `null`, and the pane says the card could not be loaded rather
 * than falling back to a URL nothing will ever request.
 */

/**
 * What to do about each unresolvable recipient, in the operator's words.
 *
 * A record keyed by the reason rather than a ternary: the resolver has four
 * reasons, and a ternary silently gives three of them the same sentence. Two of
 * them are about the CHOSEN person specifically, which is the distinction that
 * makes the sentence actionable at all.
 */
const RECIPIENT_PROBLEM_COPY: Readonly<
  Record<DispatchRecipientProblem, string>
> = {
  no_recipient_chosen:
    "Todavía nadie eligió a qué integrante de esta invitación va dirigido el mensaje. Se elige en el formulario de la invitación, marcando a una de las personas de la lista.",
  recipient_has_no_phone:
    "La persona elegida para esta invitación no tiene un número guardado, aunque alguien más de la invitación sí pueda tenerlo. Se puede agregar su número desde el panel, o elegir a otro integrante.",
  recipient_phone_unreachable:
    "El número de la persona elegida es válido, pero por su tipo de línea no parece recibir WhatsApp: una línea fija lo es. Enviar de todas formas dejaría registrado un envío que nadie recibiría.",
  recipient_not_in_household:
    "La persona elegida ya no figura entre los integrantes de esta invitación. Hay que elegir de nuevo a quién va dirigido el mensaje.",
};

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
      // A `div`, not a `main`: `ConsoleShell` already renders this page's one `main`.
      <div className="console__main flex flex-col gap-4">
        <p className="max-w-[68ch] rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm text-foreground">
          Los envíos están bloqueados en este dispositivo hasta que la cuenta de
          WhatsApp declarada coincida con la sesión.
        </p>
        <a
          className="self-start text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href={CONSOLE_ROOT_PATH}
        >
          Volver al panel
        </a>
      </div>
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

  const recipient = resolveDispatchRecipient(
    invitation.guests,
    invitation.dispatchRecipientGuestId,
  );

  if (!recipient.ok) {
    return (
      <div className="console__main flex flex-col gap-4">
        <h2 className="text-balance">
          No se puede preparar el envío para {invitation.greetingName}
        </h2>

        <p className="max-w-[68ch] text-sm text-muted-foreground">
          {RECIPIENT_PROBLEM_COPY[recipient.reason]}
        </p>

        <ul className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          {invitation.guests.map((guest) => (
            <li key={guest.id}>{guest.fullName}</li>
          ))}
        </ul>

        <a
          className="self-start text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href={CONSOLE_ROOT_PATH}
        >
          Volver al panel
        </a>
      </div>
    );
  }

  const invitationUrl = invitationPageUrl(siteOrigin(), invitation.slug);
  // The couple's names, from the one row every surface reads. The draft signs
  // off with them and the preview card's description is built from them, so the
  // text the operator approves and the text the guest receives come from the
  // same place — which is the whole reason a reference project's template could
  // announce a venue its invitation page had already corrected.
  const { coupleNames } = await getCeremony(createServerSupabaseClient());
  const cardText = buildInvitationMetadataText({ ...invitation, coupleNames });
  // Resolved from the page itself rather than assembled here: the advertised
  // query is a property of the build, not something this route can derive.
  const cardImagePath = await resolveAdvertisedCardPath(invitation.slug);

  return (
    <div className="console__main flex flex-col gap-4">
      <DispatchLauncher
        invitationId={invitation.invitationId}
        greetingName={invitation.greetingName}
        recipientName={recipient.guest.fullName}
        waUrl={buildInvitationDispatchLink({
          recipientE164: recipient.phoneE164,
          greetingName: invitation.greetingName,
          invitationUrl,
          coupleNames,
          memberCount: invitation.guests.length,
        })}
        webFallbackUrl={buildInvitationWebFallbackLink({
          recipientE164: recipient.phoneE164,
          greetingName: invitation.greetingName,
          invitationUrl,
          coupleNames,
          memberCount: invitation.guests.length,
        })}
        beaconPath={DISPATCH_EVENT_BEACON_PATH}
        dispatchState={invitation.dispatchState}
        markSentAction={markDispatchSentAction}
        markFailedAction={markDispatchFailedAction}
      />

      {/* The same two pure builders the launcher's link came from, so the text
          the operator reads and the text that gets sent cannot disagree. */}
      <WhatsAppBubble
        messageText={buildInvitationMessage({
          greetingName: invitation.greetingName,
          invitationUrl,
          coupleNames,
          memberCount: invitation.guests.length,
        })}
        waUrl={buildInvitationDispatchLink({
          recipientE164: recipient.phoneE164,
          greetingName: invitation.greetingName,
          invitationUrl,
          coupleNames,
          memberCount: invitation.guests.length,
        })}
        cardImagePath={cardImagePath}
        cardTitle={cardText.title}
        cardDescription={cardText.description}
        cardLinkLabel={new URL(siteOrigin()).host}
      />

      <a
        className="self-start text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        href={CONSOLE_ROOT_PATH}
      >
        Volver al panel
      </a>
    </div>
  );
}
