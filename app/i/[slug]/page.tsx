import type { Metadata } from "next";

import { InvitationBody } from "@/components/invitation/InvitationBody";
import { InvitationUnavailable } from "@/components/invitation/InvitationUnavailable";
import { buildInvitationMetadataText } from "@/lib/domain/og-card";

import { loadGuestFacingInvitation } from "./load-invitation";

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
 * The phone gate is NOT here yet; work unit 4b inserts it in front of the body
 * without restructuring this container.
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

  const { title, description } = buildInvitationMetadataText(invitation);

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

  return (
    <main>
      <InvitationBody invitation={invitation} />
    </main>
  );
}
