import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readJpegSize } from "./jpeg-size";

/**
 * The committed picture of where the wedding is, and the single point it agrees
 * with.
 *
 * "Salón para Eventos Villa Campestre" HAS NO STREET ADDRESS. Nothing in the
 * `ceremony` row can be typed into a maps application, so the way a guest gets
 * there is this image and the link under it — which makes both of them product,
 * not decoration, and worth a guard.
 *
 * WHAT THIS FILE MEASURES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It measures the SHAPE of the file, because the shape is the claim. The map is
 * rendered at 2x: z=13 OpenStreetMap tiles cropped to the extent of z=12, so
 * "Buga", "Zanjón Hondo" and the route numbers stay legible on a phone with a
 * 2x or 3x screen — which is nearly every phone this invitation reaches. Halve
 * those pixels and nothing fails: the page lays out identically, every check
 * stays green, and the labels a guest needs to recognise where they are going
 * turn to mush. That regression has no other detector in this repository.
 *
 * It does NOT measure the file's WEIGHT, and the omission is deliberate rather
 * than forgotten. `tools/og-card-asset-budget.spec.ts` weighs its asset because
 * the card route returns those exact bytes — the file IS the response body. This
 * one is rendered through `next/image`, which re-encodes and resizes it per
 * request, so a guest downloads a derivative a few tens of kilobytes wide and
 * never these 118 kB. A budget here would be a number measuring bytes nobody
 * downloads, which is the kind of assertion commit `3a7f89a` exists to remove.
 *
 * It also cannot check the two things that most matter and cannot be automated,
 * so they are written down instead: the imagery is OpenStreetMap rather than a
 * Google Maps screenshot (a Google screenshot cannot be redistributed without
 * licensing; OSM permits it and requires attribution, which is burned into the
 * bottom-right of the picture), and the pin is on the right field. No test can
 * read either off a JPEG.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The map the invitation renders, relative to the repository root. */
const VENUE_MAP_ASSET = "img/venue-map.jpg";

/** The component that imports it, read so this guard is bound to real use. */
const VENUE_MAP_COMPONENT = "components/invitation/VenueMap.tsx";

/**
 * The 2x source, in pixels. 1280x800 is the z=12 extent drawn with z=13 tiles.
 *
 * At the widths this is actually painted — the full width of a phone, about
 * 576px at most inside the invitation's column on a laptop — that leaves enough
 * detail for a 2x screen with nothing left over.
 */
const VENUE_MAP_PIXELS = { width: 1280, height: 800 };

/**
 * The full-resolution card, present only as a CONTROL.
 *
 * A dimension reader that returned a constant would satisfy the assertion above
 * forever, including for a file that had been replaced with something else.
 */
const DIFFERENT_SHAPED_ASSET = "img/og-card.jpg";
const DIFFERENT_SHAPE = { width: 1200, height: 1200 };

/**
 * The venue's latitude, which must appear in exactly one source file.
 *
 * THE COORDINATES AND THE PICTURE ARE ONE FACT. The image was rendered around
 * this point and committed; the link sends the guest to this point. Two copies
 * are two venues the day somebody edits one, and the failure is silent — a map
 * showing one place beside a route to another, with nothing to compare them.
 *
 * Searching for the LATITUDE alone rather than the whole pair: a second copy
 * written with the longitude first, or with the comma encoded, would slip past
 * a search for the formatted destination string and is exactly the kind of
 * second copy this exists to catch.
 */
const VENUE_LATITUDE = "3.853778";

/** Every source tree that ships application code, as the sibling guard scans. */
const SOURCE_GLOBS = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
  "scripts/**/*.ts",
  "tools/**/*.ts",
];

/**
 * Specs are exempt for the reason `no-source-placeholders.spec.ts` exempts
 * them: a test proving the rendered link carries this point has to name it, and
 * naming it is what makes that test able to fail.
 */
const SOURCES = SOURCE_GLOBS.flatMap((pattern) =>
  globSync(pattern, { cwd: REPO_ROOT }),
).filter((file) => !file.includes(".spec."));

function readAsset(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(`${REPO_ROOT}${relativePath}`));
}

describe("the committed map of the venue", () => {
  it("is the file the invitation actually renders", () => {
    // Without this the guard could measure a picture nothing imports while the
    // component quietly pointed at another — green, and proving nothing.
    const component = readFileSync(
      `${REPO_ROOT}${VENUE_MAP_COMPONENT}`,
      "utf8",
    );

    expect(component).toContain("@/img/venue-map.jpg");
  });

  it("is the 2x crop the labels on a phone depend on", () => {
    expect(readJpegSize(readAsset(VENUE_MAP_ASSET))).toEqual(VENUE_MAP_PIXELS);
  });

  it("reads a different shape from another asset, so the reader is reading", () => {
    expect(readJpegSize(readAsset(DIFFERENT_SHAPED_ASSET))).toEqual(
      DIFFERENT_SHAPE,
    );
  });
});

describe("the venue's coordinates", () => {
  it("has sources to check, so this file is not vacuously green", () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(50);
  });

  it("is written down in exactly one source file", () => {
    const naming = SOURCES.filter((file) =>
      readFileSync(`${REPO_ROOT}${file}`, "utf8").includes(VENUE_LATITUDE),
    );

    expect(naming).toEqual([VENUE_MAP_COMPONENT]);
  });

  it("is written down exactly once inside that file", () => {
    // The link is DERIVED from the constant rather than written beside it, so
    // there is one literal here and one place to correct. A second occurrence
    // is a second venue waiting to happen, even within one file.
    const component = readFileSync(
      `${REPO_ROOT}${VENUE_MAP_COMPONENT}`,
      "utf8",
    );
    const occurrences = component.split(VENUE_LATITUDE).length - 1;

    expect(occurrences).toBe(1);
  });
});
