import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The single point the whole invitation sends a hundred guests to.
 *
 * "Salón para Eventos Villa Campestre" HAS NO STREET ADDRESS. Nothing in the
 * `ceremony` row can be typed into a maps application, so the way a guest gets
 * there is one link built from one pair of coordinates — which makes that pair
 * product, not configuration, and worth a guard.
 *
 * THIS FILE WAS `venue-map-asset.spec.ts` AND HAS LOST HALF OF ITSELF.
 *
 * It also measured `img/venue-map.jpg`: a committed 1280x800 render of
 * OpenStreetMap tiles with the pin painted on, checked for shape because the
 * labels a guest reads off it ("Buga", "Zanjón Hondo", the route numbers) turn
 * to mush at 1x and nothing else in this repository would have noticed. The
 * couple asked for the picture to go — "solamente el botón de cómo llegar sin
 * una imagen" — so the file is deleted, and the assertions that measured it
 * are deleted with it rather than left pointing at a path.
 *
 * WHAT SURVIVES IS NOT THE SAME GUARD WEARING A NEW NAME. The shape check
 * protected a picture; these two protect the DESTINATION, and the destination
 * still ships. Two copies of a coordinate are two venues the day somebody
 * edits one, and that failure is silent — there is no second value on the page
 * to compare it against, and the guest finds out on the afternoon of the
 * wedding.
 *
 * It also cannot check the thing that most matters and cannot be automated, so
 * it is written down instead: whether the pin is on the right field. No test
 * can read that off a pair of decimals.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * The one module that names the point, read so this guard is bound to real use.
 *
 * IT WAS `components/invitation/VenueMap.tsx` AND THE MOVE IS THE REASON THIS
 * GUARD EARNED ITS KEEP. The coordinate was module-private inside the
 * component that builds the directions link, with a note saying it appears
 * exactly once in this repository. Then the calendar entry an accepted
 * household saves grew a location — and `lib/domain/calendar-event.ts` cannot
 * import a component, so the honest choices were to move the constant or to
 * write it down a second time. A second copy is two venues the day somebody
 * edits one, which is precisely what this file exists to prevent, so it moved
 * to the domain beside the wedding's other committed facts.
 *
 * Changing this path is therefore a real decision and not a rename: it is the
 * line that says where the single source is.
 */
const VENUE_MODULE = "lib/domain/wedding-day.ts";

/**
 * The venue's latitude, which must appear in exactly one source file.
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

describe("the venue's coordinates", () => {
  it("has sources to check, so this file is not vacuously green", () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(50);
  });

  it("is written down in exactly one source file", () => {
    const naming = SOURCES.filter((file) =>
      readFileSync(`${REPO_ROOT}${file}`, "utf8").includes(VENUE_LATITUDE),
    );

    expect(naming).toEqual([VENUE_MODULE]);
  });

  it("is written down exactly once inside that file", () => {
    // The link is DERIVED from the constant rather than written beside it, so
    // there is one literal here and one place to correct. A second occurrence
    // is a second venue waiting to happen, even within one file.
    const source = readFileSync(`${REPO_ROOT}${VENUE_MODULE}`, "utf8");
    const occurrences = source.split(VENUE_LATITUDE).length - 1;

    expect(occurrences).toBe(1);
  });
});
