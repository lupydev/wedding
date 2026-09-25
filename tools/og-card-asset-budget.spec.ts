import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The budget guard for the photograph the Open Graph card is made of.
 *
 * `ImageResponse` has a HARD 500 KB ceiling on the whole bundle it rasterizes —
 * "The bundle size includes your JSX, CSS, fonts, images, and any other assets"
 * (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md`).
 * The card embeds its photograph as a base64 data URI, which is the only form
 * the Node.js runtime recipe offers, and base64 costs four bytes for every
 * three. So the ceiling is spent by the FILE ON DISK times 4/3, before a single
 * character of JSX.
 *
 * That is why `img/og-card.jpg` exists at all rather than the card reusing
 * `img/boda.jpg`, which every other surface in the product renders. The
 * original is 1800×2400 and 518,242 bytes — 690,992 bytes once encoded, which
 * overruns the ceiling by more than a third. The card would not render, and
 * the failure is the worst shape available: the route throws at request time,
 * the crawler gets nothing, and the message goes out with a blank preview that
 * nobody sees until a guest reports it.
 *
 * SO THIS IS THE GUARD AGAINST THE OBVIOUS FUTURE MISTAKE: somebody swaps in a
 * nicer, bigger photograph, every check stays green, and the card silently
 * stops existing. Nothing else in the repository measures this. `npm run build`
 * does not render the card, and the browser suite only proves the card that is
 * shipped today works.
 *
 * It is failable, and that is proven two ways rather than asserted: the last
 * test below runs the same measurement against the full-resolution original as
 * a NEGATIVE CONTROL, and the dimension reader is checked against a file of a
 * different size so a parser that returned a constant would be caught.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The derivative the card route embeds, relative to the repository root. */
const CARD_ASSET = "img/og-card.jpg";

/**
 * The full-resolution original the derivative was cut from.
 *
 * Present here as a CONTROL, never as a candidate: embedding this file is the
 * exact mistake the guard exists to catch, so the suite measures it and asserts
 * it does NOT fit.
 */
const FULL_RESOLUTION_ORIGINAL = "img/boda.jpg";

/** The route file, read so the guard is bound to the asset actually used. */
const CARD_ROUTE = "app/i/[slug]/opengraph-image.tsx";

/**
 * The square the couple chose, in pixels.
 *
 * Square rather than the conventional 1200×630: at the size WhatsApp draws a
 * preview the emotion has to read, and a 1.9:1 band cannot hold her head and
 * her feet at once. The square keeps the waterfall and both people.
 */
const CARD_EDGE_PIXELS = 1200;

/**
 * The ceiling, read the conservative way.
 *
 * The documentation says "500KB" without saying which kilobyte. 500,000 is the
 * stricter of the two readings, so it is the one used: being wrong here costs a
 * card that does not render, and being wrong in the safe direction costs 12,000
 * bytes of headroom nobody needs.
 */
const IMAGE_RESPONSE_BUNDLE_CEILING_BYTES = 500_000;

function readAsset(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(`${REPO_ROOT}${relativePath}`));
}

/** The length of the base64 payload the card route hands to `<img src>`. */
function base64LengthOf(bytes: Uint8Array): number {
  return Buffer.from(bytes).toString("base64").length;
}

/**
 * Reads a JPEG's declared dimensions out of its frame header.
 *
 * Hand-rolled because this repository has no image library: `sharp` is not a
 * dependency, and adding one to measure two numbers would be a build cost paid
 * on every install for a test. The parse is the marker walk every JPEG decoder
 * starts with — segments are `FF <marker> <2-byte length>`, and the frame
 * header (SOF) carries height then width as big-endian 16-bit values at a fixed
 * offset inside it.
 *
 * Reading the HEADER rather than trusting a filename is the point: a file named
 * `og-card.jpg` that is secretly 3000px wide would pass any assertion about its
 * name and fail the ceiling above for a reason nobody could see from here.
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

describe("the Open Graph card's photograph stays inside the ImageResponse budget", () => {
  const card = readAsset(CARD_ASSET);

  it("is the file the card route actually embeds", () => {
    // Without this the guard could measure a file nothing reads while the route
    // quietly pointed somewhere else — green, and proving nothing.
    const route = readFileSync(`${REPO_ROOT}${CARD_ROUTE}`, "utf8");

    expect(route).toContain("og-card.jpg");
  });

  it("is the square crop the couple chose, read from the file's own header", () => {
    expect(readJpegSize(card)).toEqual({
      width: CARD_EDGE_PIXELS,
      height: CARD_EDGE_PIXELS,
    });
  });

  it("reads a different shape from the original, so the reader is reading", () => {
    // Triangulation. A parser that returned 1200×1200 unconditionally would
    // satisfy the test above forever, including for a file that had been
    // replaced with something else entirely.
    expect(readJpegSize(readAsset(FULL_RESOLUTION_ORIGINAL))).toEqual({
      width: 1800,
      height: 2400,
    });
  });

  it("fits under the 500 KB ceiling once base64-encoded, with headroom", () => {
    const encoded = base64LengthOf(card);

    expect(encoded).toBeLessThan(IMAGE_RESPONSE_BUNDLE_CEILING_BYTES);
    // The JSX, the inline styles and the data-URI prefix are under a kilobyte
    // between them, so the encoded photograph is very nearly the whole bundle.
    // Asserting a real margin rather than a bare "less than" keeps a file that
    // squeaked in at 499,900 bytes from passing as safe.
    expect(IMAGE_RESPONSE_BUNDLE_CEILING_BYTES - encoded).toBeGreaterThan(
      50_000,
    );
  });

  it("would reject the full-resolution original, which is why this exists", () => {
    // THE NEGATIVE CONTROL. `img/boda.jpg` is the file a future contributor is
    // most likely to reach for — every other surface in the product renders it
    // — and it overruns the ceiling by more than a third once encoded. If this
    // ever passes, the measurement above has stopped measuring anything.
    const encoded = base64LengthOf(readAsset(FULL_RESOLUTION_ORIGINAL));

    expect(encoded).toBeGreaterThan(IMAGE_RESPONSE_BUNDLE_CEILING_BYTES);
  });
});
