import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The per-guest Open Graph card: one photograph, and nothing else.
 *
 * This is the "image" in the WhatsApp message. There is no attachment: the
 * preview card IS the picture the recipient sees, and it is fetched by an
 * unauthenticated crawler from a URL that travels with every forward of the
 * link.
 *
 * IT USED TO RENDER THE HOUSEHOLD'S NAME AND THE COUPLE'S LINE INTO THE PIXELS.
 * It no longer renders any text at all, because that is not the bubble WhatsApp
 * draws. WhatsApp draws a THUMBNAIL with the title and description BESIDE it,
 * read from `og:title` and `og:description` — so a card that also rasterized
 * the household name said the same thing twice, in a typeface nobody chose, on
 * the one surface where the photograph had to do the work.
 *
 * The personalization did not go away; it moved to where the preview already
 * looks for it. `buildInvitationMetadataText` in `lib/domain/og-card.ts` builds
 * both strings, `app/i/[slug]/page.tsx` emits them, and the names-only product
 * rule now governs that text rather than this image.
 *
 * WHAT THAT BUYS, AND IT IS THE STRONGEST PROPERTY THIS ROUTE HAS EVER HAD:
 * this file reads no invitation, takes no `params` and touches no database, so
 * the card is BYTE-IDENTICAL for every household. A projection can be widened
 * by accident; an image with no input cannot leak anything, because there is
 * nothing to leak. `e2e/invitation-page-og.spec.ts` asserts exactly that — two
 * households, equal bytes — alongside their `og:title` values still differing,
 * so the guarantee cannot be satisfied by breaking personalization.
 *
 * THE ROUTE STAYS PER-SLUG even though its output no longer varies. Three
 * things depend on the path: `lib/server/og-warm.ts` warms the URL the page
 * advertises, the console's dispatch preview renders that same per-slug URL,
 * and `app/robots.ts` allows the per-slug card path back in under a blanket
 * `Disallow: /i/`. Collapsing it to one shared card would be a different URL
 * and would break all three for no gain — WhatsApp caches a preview per URL
 * anyway.
 *
 * Layout is flexbox only: Satori does not implement CSS grid.
 */

/** Node runtime: `fs` is not available on the edge, and the photograph is read from disk. */
export const runtime = "nodejs";

/**
 * A SQUARE CARD, AND THE SHAPE IS A DECISION RATHER THAN A DEFAULT.
 *
 * 1200×630 is the conventional Open Graph size and it was this card's size
 * while the card was words on a cream ground. It is the wrong frame for this
 * photograph: at 1.9:1 the band cannot hold her head and her feet at once, and
 * the crop that fits the band loses either the waterfall above them or the two
 * of them standing in it. At the size WhatsApp actually draws a preview, what
 * has to survive is the emotion, not the composition.
 *
 * So the couple chose the square. `img/og-card.jpg` is the `1800x1800+0+500`
 * window of the 1800×2400 original, resized to 1200×1200 — waterfall and both
 * people, and legible as a thumbnail.
 *
 * Next.js emits these two numbers as `og:image:width` and `og:image:height`, so
 * changing them here is what tells a crawler the card's shape.
 */
export const size = { width: 1200, height: 1200 };

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
 * appends to `og:image`. It is safer still now that the image carries no
 * household name: the stale-card case this header used to accept — renaming a
 * household without redeploying — no longer exists for the IMAGE, because the
 * image never held the name. The name is in `og:title`, which is rendered per
 * request and is never cached by this header.
 */
const CARD_CACHE_CONTROL = "public, immutable, no-transform, max-age=31536000";

/**
 * `og:image:alt`, for a preview read aloud rather than looked at.
 *
 * It describes the PHOTOGRAPH now, because the photograph is what the card is.
 * "Invitación de boda" was an honest label for a card that said those words;
 * for a picture of two people it tells a screen-reader user nothing about what
 * they are being shown. No name and no place appear in it: this string travels
 * with every forward of the link, exactly like the image it describes.
 *
 * Guest-facing copy is Spanish; identifiers and comments stay English.
 */
export const alt = "Los novios, de noche, frente a una cascada iluminada";

/**
 * The photograph, read once at module scope and embedded as a data URI.
 *
 * THIS IS THE ONLY FORM THAT WORKS, and it is the documented recipe rather than
 * a workaround: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`,
 * "Using Node.js runtime with local assets". Satori has no filesystem and no
 * relative-URL base, so `<img src="/img/og-card.jpg">` resolves to nothing;
 * there is no static-import form either, because the asset has to arrive as
 * bytes rather than as a URL the browser would fetch. Read at module scope
 * because the file does not depend on the request, so the encode is paid once
 * per process instead of once per card.
 *
 * WHY A DERIVATIVE AND NOT `img/boda.jpg`, WHICH EVERY OTHER SURFACE RENDERS:
 * `ImageResponse` has a hard 500 KB ceiling over the whole bundle — JSX, CSS,
 * fonts and images together — and base64 costs four bytes for every three. The
 * 518,242-byte original encodes to 690,992 bytes and cannot render at all; this
 * 265,052-byte square encodes to 353,404, leaving room to spare.
 * `tools/og-card-asset-budget.spec.ts` measures both numbers and fails on a
 * replacement that would overrun, because the failure mode otherwise is a card
 * that silently stops existing.
 *
 * `img/` sits outside `public/` on purpose — nothing here is meant to be
 * fetched directly — so this path relies on Next.js tracing the file into the
 * function bundle. That trace is verified per build; if it ever stops,
 * `outputFileTracingIncludes` in `next.config.ts` is the lever.
 */
const cardPhotograph = await readFile(
  join(process.cwd(), "img/og-card.jpg"),
  "base64",
);

const cardPhotographSrc = `data:image/jpeg;base64,${cardPhotograph}`;

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        // The photograph is already 1200×1200, the exact size of the card, so
        // this only guards the case where the two ever disagree: it fills the
        // frame and crops rather than letterboxing, which would show a band of
        // whatever is behind it.
        overflow: "hidden",
      }}
    >
      {/*
        A plain `<img>`, and `@next/next/no-img-element` does not fire on it:
        eslint-config-next exempts the metadata image conventions, because
        `next/image` is a React component for a BROWSER and Satori is neither.
        There is no optimizer here and no DOM — this element is rasterized.
      */}
      <img
        src={cardPhotographSrc}
        width={size.width}
        height={size.height}
        // The description lives in `alt` above, which Next emits as
        // `og:image:alt`. Repeating it here would put it nowhere a reader can
        // reach: this element is rasterized into pixels, not served as HTML.
        alt=""
        style={{ objectFit: "cover" }}
      />
    </div>,
    {
      ...size,
      headers: { "cache-control": CARD_CACHE_CONTROL },
    },
  );
}
