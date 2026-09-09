import { ImageResponse } from "next/og";

import { buildOgCardModel } from "@/lib/domain/og-card";

import { loadGuestFacingInvitation } from "./load-invitation";

/**
 * The per-guest Open Graph card.
 *
 * This is the "image" in the WhatsApp message. There is no attachment: the
 * preview card IS the picture the recipient sees, and it is fetched by an
 * unauthenticated crawler from a URL that travels with every forward of the
 * link. That is why the card is NAMES ONLY — no wedding date, no venue name,
 * no venue address, no phone number. What may appear here is decided by
 * `buildOgCardModel`, which projects rather than redacts, so a field added to
 * the read model later cannot leak onto a public card by being forgotten.
 *
 * No custom font is loaded. `next/og` bundles a Latin font that already covers
 * accented vowels and both cases of the enye, which `tools/og-font-coverage.spec.ts`
 * asserts against the exact file; a font missing those would render Spanish
 * names as tofu boxes with no error anywhere. Layout is flexbox only — Satori
 * does not implement CSS grid.
 */

/** Node runtime: the loader reaches Supabase through the server-only adapter. */
export const runtime = "nodejs";

/** The size WhatsApp renders as a large card. */
export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/**
 * How long a generated card may be served from cache.
 *
 * Measured, not assumed: a dynamic image route answers
 * `public, max-age=0, must-revalidate` by default, which caches nothing — and
 * the whole warming strategy (`lib/server/og-warm.ts`) is built on the opposite
 * premise, that only the FIRST fetch of a card pays for generation. Without
 * this header, warming would report success while the crawler still paid for a
 * cold Satori + Resvg render.
 *
 * `immutable` is safe because the URL changes whenever the content can: a
 * rotated slug is a new path, and a redeployment changes the build hash Next.js
 * appends to `og:image`. The residual case — renaming a household without
 * redeploying — leaves a stale card until the next deploy, which is the
 * tradeoff the design accepted when it chose an immutable card.
 */
const CARD_CACHE_CONTROL = "public, immutable, no-transform, max-age=31536000";

/** Names-only, like the card itself. Ends up in `og:image:alt`. */
export const alt = "Invitación de boda";

/**
 * What the card says when the slug names no invitation.
 *
 * A household name would be a fabrication and a blank card reads as broken, so
 * it says only that it is an invitation — which tells a stranger probing slugs
 * nothing about whether any particular one exists.
 */
const UNKNOWN_HOUSEHOLD_GREETING = "Invitación";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const invitation = await loadGuestFacingInvitation(slug);

  // An unknown or rotated slug still gets a card rather than a broken image:
  // the link may already be sitting in a chat. It carries no household name,
  // which is also what keeps it from confirming that any slug exists.
  const card = buildOgCardModel(
    invitation ?? { greetingName: UNKNOWN_HOUSEHOLD_GREETING },
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: 80,
        textAlign: "center",
        backgroundColor: "#f7f3ee",
        color: "#2b2118",
      }}
    >
      <div style={{ display: "flex", fontSize: 76, lineHeight: 1.15 }}>
        {card.greetingName}
      </div>
      <div style={{ display: "flex", fontSize: 40, opacity: 0.8 }}>
        {card.invitationLine}
      </div>
    </div>,
    {
      ...size,
      headers: { "cache-control": CARD_CACHE_CONTROL },
    },
  );
}
