import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The weight guard for the photograph the Open Graph card IS.
 *
 * The card route does not rasterize anything any more. It reads
 * `img/og-card.jpg` and returns those bytes as the response body, so the file
 * on disk is not an INPUT to the card — it is the card. Whatever this file
 * weighs is exactly what every link-preview crawler downloads.
 *
 * WHAT THIS GUARD USED TO MEASURE, AND WHY IT NO LONGER DOES. It measured the
 * base64 length against `ImageResponse`'s hard 500 KB bundle ceiling, because
 * the only way to get a local file into Satori is a data URI and base64 costs
 * four bytes for every three. That ceiling is gone with `ImageResponse`: no
 * JSX, no Satori, no encode. Base64 size is now irrelevant to this product.
 *
 * WHAT REPLACED IT IS A SELF-IMPOSED BUDGET, AND THAT IS STATED PLAINLY RATHER
 * THAN DRESSED UP AS A PLATFORM LIMIT. I could not verify a documented maximum
 * image size for WhatsApp link previews from any source available when this was
 * written, so none is claimed and none is cited. 500,000 bytes is a
 * crawler-friendliness budget chosen here, with roughly 2x headroom over the
 * 243,748 bytes the card weighs today. (It weighed 265,052 when this budget was
 * set; re-cutting it with the couple's line painted on made it smaller, not
 * larger — the second pass through the encoder cost less than the words added.)
 *
 * THE REAL, MEASURED REASON THIS GUARD EXISTS IS NOT A LIMIT AT ALL. While the
 * route rendered this same photograph through `ImageResponse`, the PNG it
 * returned was **2,887,177 bytes** — eleven times the JPEG it was made from,
 * because `ImageResponse` always rasterizes to PNG and a photographic
 * 1200x1200 PNG is enormous. That shipped, every check was green, and nothing
 * in the repository measured the served payload. This does.
 *
 * It is failable, and that is proven two ways rather than asserted: the last
 * test below runs the same measurement against the full-resolution original as
 * a NEGATIVE CONTROL, and the dimension reader is checked against a file of a
 * different size so a parser that returned a constant would be caught.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The derivative the card route serves, relative to the repository root. */
const CARD_ASSET = "img/og-card.jpg";

/**
 * The full-resolution original the derivative was cut from.
 *
 * Present here as a CONTROL, never as a candidate: serving this file is the
 * exact mistake the guard exists to catch, so the suite measures it and asserts
 * it does NOT fit.
 */
const FULL_RESOLUTION_ORIGINAL = "img/boda.jpg";

/**
 * The route file, read so the guard is bound to the asset actually used.
 *
 * `.ts`, not `.tsx`: the route has no JSX left to compile. The convention
 * accepts `.js`, `.ts` and `.tsx` alike
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`,
 * "Generate images using code"), and the URL is unchanged by the extension.
 */
const CARD_ROUTE = "app/i/[slug]/opengraph-image.ts";

/**
 * The square the couple chose, in pixels.
 *
 * Square rather than the conventional 1200x630: at the size WhatsApp draws a
 * preview the emotion has to read, and a 1.9:1 band cannot hold her head and
 * her feet at once. The square keeps the waterfall and both people.
 */
const CARD_EDGE_PIXELS = 1200;

/**
 * The served-payload budget, in bytes. SELF-IMPOSED — see the file comment.
 *
 * This is not a documented WhatsApp, Open Graph or Next.js limit, and no such
 * limit is asserted here: nothing over this line is known to break a preview.
 * It is a line drawn so a heavier photograph is a decision somebody makes on
 * purpose rather than a 2.8 MB thumbnail nobody notices.
 *
 * There is deliberately no second "and with headroom" assertion, which the
 * base64 version of this guard carried. That margin existed because overrunning
 * `ImageResponse`'s ceiling meant the card did not render AT ALL — a cliff
 * worth standing well back from. A raw-bytes budget has no cliff: a file at
 * 499,900 bytes is heavy, not broken, and pretending otherwise would make the
 * real budget 400,000 while the constant said 500,000.
 */
const CARD_PAYLOAD_BUDGET_BYTES = 500_000;

function readAsset(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(`${REPO_ROOT}${relativePath}`));
}

/**
 * Reads a JPEG's declared dimensions out of its own frame header.
 *
 * Hand-rolled because this repository has no image library: `sharp` is not a
 * dependency, and adding one to measure two numbers would be a build cost paid
 * on every install for a test. The parse is the marker walk every JPEG decoder
 * starts with — segments are `FF <marker> <2-byte length>`, and the frame
 * header (SOF) carries height then width as big-endian 16-bit values at a
 * fixed offset inside it.
 *
 * Reading the HEADER rather than trusting a filename is the point: a file
 * named `og-card.jpg` that is secretly 3000px wide would pass any assertion
 * about its name, and would be served to every crawler at that size.
 *
 * IT SPENT ONE COMMIT AS `tools/jpeg-size.ts` AND HAS COME BACK.
 *
 * It was extracted in `97a146e` for a stated reason — `img/venue-map.jpg` had
 * become a second committed binary somebody measured, and a copied marker walk
 * is two decoders that agree until a bug is fixed in one of them. The couple
 * then asked for the map picture to go, `tools/venue-map-asset.spec.ts` went
 * with it, and this file is the only caller again. A shared module with one
 * caller is a promise of reuse that nothing keeps: the next reader has to open
 * two files to follow one assertion, and the extraction's own doc comment goes
 * on naming an asset that no longer exists. If a third binary ever wants it,
 * moving it out again is the same commit it was the first time.
 *
 * The triangulation below is what keeps it honest wherever it lives: a reader
 * that returned a constant cannot sit green behind a file that has been
 * replaced with something else entirely.
 */
function readJpegSize(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Not a JPEG: the file does not open with SOI (FF D8).");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 3 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      throw new Error(`Lost the marker stream at byte ${offset}.`);
    }

    const marker = bytes[offset + 1];

    // A run of fill bytes before a marker is legal padding, not a segment.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    const segmentLength = view.getUint16(offset + 2);

    // SOF0 through SOF15 all carry the frame header. Three markers share that
    // numeric range and carry something else entirely: DHT (C4), JPG (C8) and
    // DAC (CC). Reading dimensions out of a Huffman table would produce two
    // confident wrong numbers.
    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isFrameHeader) {
      // Inside the segment: length (2), sample precision (1), height (2),
      // width (2). So height sits at +5 from the marker and width at +7.
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error("No frame header: this JPEG declares no dimensions.");
}

describe("the photograph the Open Graph card serves", () => {
  const card = readAsset(CARD_ASSET);
  const route = readFileSync(`${REPO_ROOT}${CARD_ROUTE}`, "utf8");

  it("is the file the card route actually serves", () => {
    // Without this the guard could measure a file nothing reads while the route
    // quietly pointed somewhere else — green, and proving nothing.
    expect(route).toContain("og-card.jpg");
  });

  it("is served as bytes rather than rasterized, so what is measured is what ships", () => {
    /*
      THE ASSERTION THAT BINDS THIS FILE'S PREMISE TO THE ROUTE'S BEHAVIOUR.

      Every number below is about a JPEG on disk. That is only the served
      payload while the route RETURNS those bytes. The moment somebody reaches
      for `ImageResponse` again the route re-encodes to PNG — the measured
      2,887,177-byte regression — and this whole file would go on passing while
      measuring something nobody downloads.

      THE IMPORT AND THE CONSTRUCTION, NOT THE WORDS. A bare `toContain` check
      was written first and it failed against the correct implementation: the
      route's comments name `ImageResponse` several times, to explain why it is
      gone and what it cost. A guard that forbids the explanation of a defect
      alongside the defect is a guard that gets loosened by whoever hits it
      next. Both halves are still checked, because removing one and keeping the
      other is not a state worth letting through quietly.
    */
    expect(route).not.toMatch(/from\s+["']next\/og["']/);
    expect(route).not.toMatch(/new\s+ImageResponse\s*\(/);
  });

  it("is the square crop the couple chose, read from the file's own header", () => {
    expect(readJpegSize(card)).toEqual({
      width: CARD_EDGE_PIXELS,
      height: CARD_EDGE_PIXELS,
    });
  });

  it("reads a different shape from the original, so the reader is reading", () => {
    // Triangulation. A parser that returned 1200x1200 unconditionally would
    // satisfy the test above forever, including for a file that had been
    // replaced with something else entirely.
    expect(readJpegSize(readAsset(FULL_RESOLUTION_ORIGINAL))).toEqual({
      width: 1800,
      height: 2400,
    });
  });

  it("fits inside the self-imposed served-payload budget", () => {
    // The raw file, because the raw file is the response body. No base64, no
    // re-encode, no bundle.
    expect(card.byteLength).toBeLessThan(CARD_PAYLOAD_BUDGET_BYTES);
  });

  it("would reject the full-resolution original, which is why this exists", () => {
    // THE NEGATIVE CONTROL. `img/boda.jpg` is the file a future contributor is
    // most likely to reach for — every other surface in the product renders it
    // — and at 518,242 bytes it is over the budget on its own, before anything
    // is done to it. If this ever passes, the measurement above has stopped
    // measuring anything.
    expect(readAsset(FULL_RESOLUTION_ORIGINAL).byteLength).toBeGreaterThan(
      CARD_PAYLOAD_BUDGET_BYTES,
    );
  });
});
