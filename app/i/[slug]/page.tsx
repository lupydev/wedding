import type { Metadata } from "next";
import { cookies } from "next/headers";

import { InvitationBody } from "@/components/invitation/InvitationBody";
import { InvitationGate } from "@/components/invitation/InvitationGate";
import { InvitationUnavailable } from "@/components/invitation/InvitationUnavailable";
import { RsvpAnswer } from "@/components/invitation/RsvpAnswer";
import { RsvpClosed } from "@/components/invitation/RsvpClosed";
import { buildInvitationMetadataText } from "@/lib/domain/og-card";
import { buildGateRecoveryLink } from "@/lib/domain/recovery-message";
import { UNLOCK_COOKIE_NAME, unlockCookieUnlocks } from "@/lib/server/cookies";
import { rsvpIsOpenNow } from "@/lib/server/rsvp";

import { submitRsvpAction, unlockAction } from "./actions";
import { GateForm } from "./gate-form";
import {
  loadCeremony,
  loadCurrentRsvp,
  loadGuestFacingInvitation,
  loadInvitationRecord,
  loadOwnerContactPhone,
} from "./load-invitation";

/**
 * The per-guest invitation page.
 *
 * This route is the reason the whole stack is server-rendered. WhatsApp's
 * crawler does not execute JavaScript: it reads the first HTML response and
 * nothing else, so the per-guest Open Graph tags must already be inside
 * `<head>` when that response is written. The `htmlLimitedBots` setting in
 * `next.config.ts` matches every user agent, which disables streamed metadata
 * outright so this holds without depending on a User-Agent string, and
 * `metadataBase` in the root layout makes the file-convention `og:image`
 * absolute.
 *
 * Deliberately thin. The body is `InvitationBody`, the one component the
 * operator preview renders too, so the two surfaces cannot drift.
 *
 * The phone gate sits in front of that body and is composed SYNCHRONOUSLY: no
 * `loading.tsx`, no Suspense boundary, no client-side data fetch. That is not a
 * style preference. Anything that lets Next.js flush a shell early turns this
 * route's metadata into streamed metadata, which appends the Open Graph tags
 * near `</body>` where WhatsApp's crawler — which stops at the first response
 * and runs no JavaScript — would never see them. The failure is silent: the
 * message still sends, the card is simply blank. `e2e/invitation-page-og.spec.ts`
 * is the regression guard, and it asserts the tags are NOT after `</head>`.
 *
 * There is exactly ONE piece of unlock state read here: the signed `inv_unlock`
 * cookie. No query parameter, header, token or admin session participates.
 */

interface RouteParams {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const invitation = await loadGuestFacingInvitation(slug);

  // An invitation URL is an unlisted capability, so no variant of this page is
  // ever indexable. `robots.ts` says the same thing to conforming crawlers;
  // this says it again in the document itself.
  const robots = { index: false, follow: false } as const;

  if (invitation === null) {
    // The metadata of an unknown slug must not differ in a way that tells a
    // stranger probing slugs which ones exist.
    return { title: "Invitación", robots };
  }

  // The couple's names come from the `ceremony` row, like every other wedding
  // fact. Read AFTER the unknown-slug branch above on purpose: a probe for a
  // nonexistent slug must not cost a second query, and it must not be
  // distinguishable by timing either.
  const { coupleNames } = await loadCeremony();
  const { title, description } = buildInvitationMetadataText({
    ...invitation,
    coupleNames,
  });

  return {
    title,
    description,
    robots,
    // `openGraph.images` is deliberately NOT set here. The
    // `opengraph-image.tsx` file convention injects the absolute `og:image`
    // plus its width and height; hand-writing the URL would be a second source
    // of truth that silently drifts from the route that serves the bytes.
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

export default async function InvitationPage({ params }: RouteParams) {
  const { slug } = await params;
  const invitation = await loadGuestFacingInvitation(slug);

  if (invitation === null) {
    return <InvitationUnavailable />;
  }

  // Non-null whenever the projection above is: both read the same cached row.
  const record = (await loadInvitationRecord(slug))!;
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value ?? "";

  // The cookie's own payload names the invitation it unlocked, and it is
  // checked against THIS invitation. Path-scoping already keeps the browser
  // from sending household A's cookie to household B, but a person can hold
  // both links and the server must not depend on the browser for that.
  if (unlockCookieUnlocks(unlockCookie, record.id)) {
    // The deadline decides which surface the body gets, and it decides it on
    // the SERVER. A form rendered past the deadline and refused on submit is a
    // form a household fills in believing they answered.
    const open = rsvpIsOpenNow();
    const current = open ? await loadCurrentRsvp(record.id) : null;
    // Every wedding fact this page shows, from the one row that holds them.
    // Read unconditionally inside this branch rather than only when the RSVP is
    // open: the body itself now needs the couple, the date and the venue, so a
    // closed RSVP still needs the row. The gate branch below needs none of it
    // and pays for none of it. `generateMetadata` reads the same request-cached
    // function, so the two together cost one query.
    const ceremony = await loadCeremony();

    return (
      <main>
        <InvitationBody
          invitation={invitation}
          wedding={ceremony}
          rsvp={
            open ? (
              // The slug is bound on the SERVER here too: the form never
              // supplies it, so a client cannot aim an RSVP at another
              // household.
              <RsvpAnswer
                guests={invitation.guests}
                current={
                  current === null
                    ? null
                    : {
                        attending: current.attending,
                        seatsConfirmed: current.seatsConfirmed,
                        attendeeGuestIds: current.attendeeGuestIds,
                        dietaryNotes: current.dietaryNotes,
                      }
                }
                // The stream details, which a declining household sees in
                // place of the form: the answer is recorded and the only thing
                // left to say is how to join. Already in the tree, so declining
                // needs no second round trip. Behind the phone gate, which is
                // the better protected of the two places these values appear.
                ceremony={ceremony}
                action={submitRsvpAction.bind(null, slug)}
              />
            ) : (
              <RsvpClosed />
            )
          }
        />
      </main>
    );
  }

  const ownerContact = await loadOwnerContactPhone(record.ownerSenderId);

  if (ownerContact === null) {
    // `senders.contact_wa_phone_e164` is NOT NULL and `owner_sender_id` is a
    // required foreign key, so this means the owner row is gone. Failing loudly
    // beats rendering a gate whose only escape hatch is missing.
    throw new Error(
      `Invitation ${record.id} has no reachable owning sender, so its gate has no recovery path.`,
    );
  }

  return (
    <main>
      <InvitationGate
        greetingName={invitation.greetingName}
        recoveryHref={buildGateRecoveryLink(
          ownerContact,
          invitation.greetingName,
        )}
      >
        {/* The slug is bound on the SERVER: the form never supplies it, so a
            client cannot aim the unlock at a different household. */}
        <GateForm action={unlockAction.bind(null, slug)} />
      </InvitationGate>
    </main>
  );
}
