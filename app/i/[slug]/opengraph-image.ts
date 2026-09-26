import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The per-guest Open Graph card: one photograph, with the couple's line painted
 * into the top of it.
 *
 * This is the "image" in the WhatsApp message. There is no attachment: the
 * preview card IS the picture the recipient sees, and it is fetched by an
 * unauthenticated crawler from a URL that travels with every forward of the
 * link.
 *
 * THE HOUSEHOLD'S NAME USED TO BE RASTERIZED INTO THESE PIXELS, AND THAT PART
 * IS NOT COMING BACK. WhatsApp draws a THUMBNAIL with the title and description
 * BESIDE it, read from `og:title` and `og:description` — so a card that also
 * rasterized the household name said the same thing twice, in a typeface nobody
 * chose, on the one surface where the photograph had to do the work. That
 * personalization lives in the metadata text and nowhere else:
 * `buildInvitationMetadataText` in `lib/domain/og-card.ts` builds both strings,
 * `app/i/[slug]/page.tsx` emits them, and the names-only product rule governs
 * that text.
 *
 * THE COUPLE'S LINE IS BACK, AND IT IS IN THE JPEG RATHER THAN IN THIS ROUTE.
 * "Nos casamos" and "Luis & Michell" are painted into `img/og-card.jpg` itself,
 * across the waterfall above the couple, in the same two faces the site uses
 * (`--font-script` and `--font-display`, `app/globals.css:200-201`). The couple
 * asked for a preview that reads as a wedding at a glance, and a thumbnail of
 * two people in the dark reads as a photograph: the title beside it is the part
 * a forwarded chat scrolls past. Nothing here composes those words at request
 * time — the route still answers with bytes read off the disk.
 *
 * WHAT SURVIVES THAT IS STILL THE STRONGEST PROPERTY THIS ROUTE HAS: this file
 * reads no invitation, takes no `params` and touches no database, so the card
 * is BYTE-IDENTICAL for every household. The words burned into it name the
 * COUPLE, which is the same fact for every household that receives a link. The
 * HOUSEHOLD's name is the one thing that must never join them — the moment it
 * does, the card stops being one shared asset and becomes per-guest data on a
 * public, crawlable, forwardable URL. `e2e/invitation-page-og.spec.ts` asserts
 * exactly that — two households, equal bytes — alongside their `og:title`
 * values still differing, so the guarantee cannot be satisfied by breaking
 * personalization.
 *
 * THE ROUTE STAYS PER-SLUG even though its output no longer varies. Three
 * things depend on the path: `lib/server/og-warm.ts` warms the URL the page
 * advertises, the console's dispatch preview renders that same per-slug URL,
 * and `app/robots.ts` allows the per-slug card path back in under a blanket
 * `Disallow: /i/`. Collapsing it to one shared card would be a different URL
 * and would break all three for no gain — WhatsApp caches a preview per URL
 * anyway.
 *
 * AND IT IS A `.ts` FILE, NOT `.tsx`, BECAUSE THERE IS NO JSX LEFT TO COMPILE.
 * The convention accepts `.js`, `.ts` and `.tsx` alike — see "Generate images
 * using code" in
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`
 * — and the extension never reaches the URL, which is what `og-warm.ts`, the
 * console preview and `app/robots.ts` all depend on.
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
 * changing them here is what tells a crawler the card's shape. They are a
 * DECLARATION, not a resize: nothing in this route scales anything, so a
 * photograph whose real frame stops matching these numbers advertises a lie.
 * `tools/og-card-asset-budget.spec.ts` reads the real frame out of the file's
 * own header and fails on exactly that.
 */
export const size = { width: 1200, height: 1200 };

/**
 * `og:image:type`, and the line that stopped this route rasterizing.
 *
 * It said `image/png` while the card went through `ImageResponse`, and it had
 * to: `ImageResponse` always rasterizes to PNG. That was the right encoding for
 * the card this used to be — words on a flat cream ground, where PNG costs
 * almost nothing — and exactly the wrong one for a photograph. Measured, by
 * rendering this route's real output through the Satori + Resvg pipeline rather
 * than trusting that it returned a valid PNG: **2,887,177 bytes**, from the
 * 265,052-byte JPEG the card was then. Eleven times the weight, for a worse
 * encoding of a file the repository already had.
 *
 * WANTING TEXT ON THE CARD AGAIN IS NOT A REASON TO GO BACK, AND THAT IS WHY
 * THE NUMBER WAS RE-MEASURED RATHER THAN QUOTED. The same probe, against the
 * card as it stands today with the couple's line painted on: **2,646,572 bytes**
 * of PNG from 243,748 bytes of JPEG. Still eleven times, because the cost was
 * never the words — it is that `ImageResponse` re-encodes a PHOTOGRAPH to PNG.
 * Words baked into the JPEG cost nothing at request time; the same words
 * composed over it cost 2.4 MB on every cold fetch.
 */
export const contentType = "image/jpeg";

/**
 * How long a generated card may be served from cache.
 *
 * Measured, not assumed: a dynamic image route answers
 * `public, max-age=0, must-revalidate` by default, which caches nothing — and
 * the whole warming strategy (`lib/server/og-warm.ts`) is built on the opposite
 * premise, that only the FIRST fetch of a card pays for generation. Without
 * this header, warming would report success while the crawler still paid for a
 * cold render.
 *
 * `immutable` is safe because the URL changes whenever the content can: a
 * rotated slug is a new path, and a redeployment changes the build hash Next.js
 * appends to `og:image`. The HOUSEHOLD's name is not in the image and never
 * will be, so the stale-card case this header used to accept — renaming a
 * household without redeploying — does not exist for the IMAGE. That name is in
 * `og:title`, rendered per request and never cached by this header.
 *
 * WHAT THIS HEADER NOW COSTS, STATED RATHER THAN DISCOVERED LATER. While the
 * card was text-free, EVERY word a guest could read came from `og:title` and
 * `og:description` — rebuilt on every request, so a wrong name was correctable
 * after a dispatch, including for links already sitting in a chat. "Luis &
 * Michell" is painted into an asset served for a year, so for the IMAGE that
 * correction is gone: a card already delivered keeps whatever it was painted
 * with, and the only lever left is a new slug. It is theoretical — those are the
 * couple's own names, and they are right — but it is a property this project
 * had and chose to spend, not one it never noticed.
 */
const CARD_CACHE_CONTROL = "public, immutable, no-transform, max-age=31536000";

/**
 * `og:image:alt`, for a preview read aloud rather than looked at.
 *
 * It describes BOTH halves of the card: the two lines painted across the top,
 * and the photograph they sit on. "Invitación de boda" was an honest label for
 * a card that said those words and nothing else; for a picture of two people it
 * told a screen-reader user nothing about what they were being shown, and for
 * the card as it is now it would drop the only words on it.
 *
 * No HOUSEHOLD name and no place appear in it: this string travels with every
 * forward of the link, exactly like the image it describes. The couple's names
 * are in it because they are already in the pixels — an alt text that omitted
 * them would describe a different card.
 *
 * WRITTEN AS A LITERAL, NOT BUILT FROM `COUPLE_NAMES`. The names here must match
 * the PAINT, and the paint is a JPEG nothing in this repository can regenerate.
 * Interpolating the constant would let an edit to it silently move this string
 * off the image it claims to describe — an alt text that lies is worse than one
 * that is merely out of date, because nothing on screen contradicts it.
 *
 * Guest-facing copy is Spanish; identifiers and comments stay English.
 */
export const alt =
  "«Nos casamos, Luis & Michell» sobre una foto de los novios, de noche, frente a una cascada iluminada";

/**
 * The photograph, read once at module scope, as BYTES.
 *
 * IT USED TO BE BASE64, AND THAT WAS NEVER ABOUT THE FILE. Base64 was the only
 * way to get a local asset into Satori, which has no filesystem and no
 * relative-URL base, so the card embedded a data URI in an `<img>` and
 * `ImageResponse` rasterized the result. Nothing composes anything now, so
 * there is nothing to encode for: the bytes go out as the response body.
 *
 * Read at module scope because the file does not depend on the request, so the
 * disk read is paid once per process instead of once per card. Reusing one
 * buffer across responses is safe — nothing here writes to it.
 *
 * `img/` sits outside `public/` on purpose — nothing here is meant to be
 * fetched directly — so this path relies on Next.js tracing the file into the
 * function bundle. That trace is verified per build in
 * `.next/server/app/i/[slug]/opengraph-image/route.js.nft.json`; if it ever
 * stops, `outputFileTracingIncludes` in `next.config.ts` is the lever.
 */
const cardPhotograph = await readFile(join(process.cwd(), "img/og-card.jpg"));

/**
 * Returns the photograph itself.
 *
 * A PLAIN `Response`, WHICH IS THE CONVENTION'S ACTUAL CONTRACT rather than a
 * way around it: "The default export function should return a `Response`", and
 * "`ImageResponse` satisfies this return type" — lines 251 and 253 of
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`.
 * `ImageResponse` is one such `Response`, for the case where the card has to be
 * COMPOSED AT REQUEST TIME. This card carries words, and it is still not that
 * case: they were painted into the file once, so the card is a static image,
 * byte-identical for every household. There is nothing left to compose, and
 * every gram of Satori + Resvg on a cold generation buys a heavier file than
 * the input.
 *
 * `content-type` is set on the response as well as exported above: the export
 * is what Next.js emits as `og:image:type` in the page's HTML, and the header
 * is what the crawler fetching these bytes reads. They are two different
 * consumers, and only one of them can see the export.
 */
export default function OpenGraphImage(): Response {
  return new Response(cardPhotograph, {
    headers: {
      "content-type": contentType,
      "cache-control": CARD_CACHE_CONTROL,
    },
  });
}
