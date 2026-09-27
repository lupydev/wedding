import type { Metadata } from "next";
import { cookies } from "next/headers";

import { InvitationAnnouncement } from "@/components/invitation/InvitationAnnouncement";
import { InvitationBody } from "@/components/invitation/InvitationBody";
import { PhotoStage } from "@/components/landing/PhotoStage";
import { WEDDING_PHOTO } from "@/components/landing/photos";
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
    // `opengraph-image.ts` file convention injects the absolute `og:image`
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
      /*
        THE SAME STAGE AS `/` AND `/transmision`, WITH THE OTHER PHOTOGRAPH.

        The couple asked for the invitation in the landing's language, and the
        three pages are read one after another — a guest lands here from a
        message, and may walk to the stream page from inside it — so the dark
        ground, the blurred backdrop and the framed print have to be the same
        object rather than three that happen to match today.

        `overlay`, WHERE THIS SAID `band` AND GAVE TWO REASONS FOR IT.

        The first was the photograph: 0.75:1, and "filling a phone viewport with
        it discards about 38% of the width and clips both people, who stand left
        and right of centre". True of a CENTRED crop and of no other. The
        photograph now says where its crop should fall — see `photos.ts`, where
        the 68% is measured — and both of them are held with room to spare on
        every phone the invitation is checked on.

        The second was the form: "a radio group, a checkbox per member and a
        free-text field", too much to lay over a picture. Two of those three are
        gone. What is left is one question at a time, on one screen at a time,
        on the panel `RsvpAnswer` already gives its controls.

        And the band is what the single screen cost. A `h-[38dvh]` strip with
        every block stacked beneath it is 2.5 viewports on an iPhone once a
        household accepts; behind the words it is nothing at all.
      */
      <PhotoStage mobilePhoto="overlay" photo={WEDDING_PHOTO}>
        <InvitationBody
          invitation={invitation}
          wedding={ceremony}
          /*
            THE STEPPER OWNS THE TOP LINE WHILE THERE IS A STEPPER.

            Every screen of the invitation opens with the household's own name,
            and the LAST one opens with "Te esperamos, <name>" instead —
            the couple's own instruction. Which screen is showing is client
            state inside `RsvpAnswer`, so the body cannot choose between the
            two lines and hands the placement over instead.

            A CLOSED RSVP KEEPS IT IN THE FRAME, and that is not an oversight:
            `RsvpClosed` is one screen with no steps, so there is nothing for
            it to decide and nothing for it to hand back.
          */
          greetingOwner={open ? "step" : "frame"}
          rsvp={
            open ? (
              // The slug is bound on the SERVER here too: the form never
              // supplies it, so a client cannot aim an RSVP at another
              // household.
              <RsvpAnswer
                /*
                  THE ANNOUNCEMENT IS HANDED TO THE FORM, WHICH SHOWS IT ON THE
                  FIRST SCREEN AND ON NO OTHER.

                  It is 250 pixels, and the couple asked for it on the question
                  screen — "debería ser igual a la primera pantalla" — where it
                  is the reason a household is being asked anything. On the two
                  screens after that it is 250 pixels of something they have
                  already read twice.

                  Which screen is showing is client state, so only `RsvpAnswer`
                  can make that call; composed HERE so the block stays a Server
                  Component and does not cross the client boundary to do it.
                */
                announcement={
                  <InvitationAnnouncement coupleNames={ceremony.coupleNames} />
                }
                /*
                  The place reaches the FORM rather than the body, because only
                  a household that says it is coming is told where to go.
                  `InvitationBody` is a Server Component and cannot see that
                  answer.
                */
                venue={{ name: ceremony.venueName }}
                guests={invitation.guests}
                /*
                  The same name the gate greeted them with a tap ago, from the
                  same projection. The form does not greet with it on every
                  screen — see `greetingOwner` above.
                */
                greetingName={invitation.greetingName}
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
      </PhotoStage>
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
    /*
      THE GATE STANDS ON THE SAME STAGE, AND IT HAS TO.

      It is the FIRST thing every guest sees and the invitation is one tap
      behind it — read a second apart. Undesigned it was black text on white
      while the page behind it stood on a photograph, which reads as two
      different weddings.

      `overlay` here too, and here it was always the right answer: the gate's
      few lines would have fitted over the picture from the start. What stopped
      them was the crop — at 0.75:1 a centred phone-filling crop clips both
      people — and the photograph says where to crop now.
    */
    <PhotoStage mobilePhoto="overlay" photo={WEDDING_PHOTO}>
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
    </PhotoStage>
  );
}
