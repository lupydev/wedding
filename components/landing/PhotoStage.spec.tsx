import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhotoStage } from "./PhotoStage";

/**
 * The stage that `/`, `/transmision` and the invitation all stand on.
 *
 * IT USED TO CONTAIN ONE PHOTOGRAPH, AND THAT WAS FINE UNTIL THERE WERE TWO.
 *
 * Its whole layout argument was written about a single image: "The photograph
 * is 737×1600, or 0.46:1. A phone is 0.462:1 — the same shape to three
 * decimals." The ratio was a literal in a class name and the import was a
 * literal at the top of the file, so a second photograph could not be framed
 * without either lying about its shape or forking the stage.
 *
 * The wedding photograph is 1800×2400 — 0.75:1. Portrait, and nothing like a
 * phone: filling a phone viewport with it discards about 38% of the width, and
 * the two people stand left and right of centre, so a fill crop clips both.
 * That is the defect the couple reported on the very first day, in those words:
 * "la imagen se ve súper grande con zoom".
 */

/*
  THE IMAGES ARE WRITTEN OUT HERE RATHER THAN IMPORTED, AND THAT IS NOT A
  SHORTCUT.

  Under Vitest a static image import resolves to a bare string — "/img/boda.jpg"
  — because the loader that turns one into `{ src, width, height, blurDataURL }`
  belongs to the Next build. A spec reading `.width` off that would be reading
  `undefined` and asserting nothing.

  So the contract under test is the component's own: given an image that knows
  its dimensions, shape the frame from them. That the real files reach it with
  the right dimensions is the build's job and the browser suite's, which is
  where it is checked.
*/
const ENGAGEMENT = {
  src: {
    src: "/img/compromiso.jpg",
    width: 737,
    height: 1600,
    blurDataURL: "data:image/jpeg;base64,/9j/",
    blurWidth: 4,
    blurHeight: 8,
  },
  alt: "Luis y Michell abrazados en un sendero, con una cascada iluminada detrás",
};

const WEDDING = {
  src: {
    src: "/img/boda.jpg",
    width: 1800,
    height: 2400,
    blurDataURL: "data:image/jpeg;base64,/9j/",
    blurWidth: 6,
    blurHeight: 8,
  },
  alt: "Luis pidiéndole matrimonio a Michell frente a una cascada iluminada",
};

/** The framed print. Located by its class, because a `figure` has no role. */
function frame(): HTMLElement {
  return document.querySelector<HTMLElement>("figure.photo-stage__frame")!;
}

describe("PhotoStage", () => {
  it("frames the photograph it was given", () => {
    render(
      <PhotoStage photo={WEDDING}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    expect(screen.getByAltText(WEDDING.alt)).toBeInTheDocument();
    expect(screen.getByText("Las palabras")).toBeInTheDocument();
  });

  /**
   * THE RATIO COMES FROM THE FILE, NOT FROM A LITERAL.
   *
   * A hard-coded `aspect-[737/1600]` is a promise about one image. Given a
   * second one it becomes a lie that renders — the print is drawn at the wrong
   * shape and the photograph inside it is cropped to fit, silently.
   *
   * It travels as a custom property because Tailwind cannot compile a class
   * name out of a runtime value, and as a property rather than a plain inline
   * `aspect-ratio` because the frame is only shaped at `lg`: below that the
   * photograph is a band or a full screen, and an inline ratio would apply at
   * every width.
   */
  it("takes its shape from the photograph's own dimensions", () => {
    render(
      <PhotoStage photo={WEDDING}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    expect(frame().style.getPropertyValue("--photo-stage-aspect")).toBe(
      "1800 / 2400",
    );
  });

  it("shapes itself differently for a differently shaped photograph", () => {
    render(
      <PhotoStage photo={ENGAGEMENT}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    expect(frame().style.getPropertyValue("--photo-stage-aspect")).toBe(
      "737 / 1600",
    );
  });

  /**
   * THE BACKDROP IS THE SAME PHOTOGRAPH, ALWAYS.
   *
   * It exists to fill the bars a portrait leaves in a landscape window with
   * that image's own colours, out of focus. Given a different photograph than
   * the print, it would be filling those bars with the wrong wedding.
   */
  it("blurs the same photograph behind the print", () => {
    render(
      <PhotoStage photo={WEDDING}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    const sources = screen
      .getAllByRole("presentation", { hidden: true })
      .concat(screen.getAllByAltText(WEDDING.alt))
      .map((image) => image.getAttribute("src"));

    // Both point at the same underlying file, whatever the optimizer's query
    // string looks like.
    expect(new Set(sources.map((src) => src?.includes("boda")))).toEqual(
      new Set([true]),
    );
  });
});

/**
 * WHERE THE WORDS GO, AND WHY THE STAGE DECIDES IT.
 *
 * The children used to own their own grid placement, and the comment said so.
 * That was survivable while both callers used `overlay` — and it was a trap the
 * moment one did not: in `band` the photograph is a strip at the top and the
 * words belong BENEATH it, but a child still writing `row-start-1` lands on top
 * of the picture instead. Which is exactly what happened, and it did not fail
 * loudly: it rendered, with the names of a household laid across a waterfall.
 *
 * So the stage places them. A caller cannot get this wrong any more because a
 * caller no longer says anything about it.
 */
describe("where the stage puts the words", () => {
  function column(): HTMLElement {
    return document.querySelector<HTMLElement>("div.photo-stage__column")!;
  }

  it("lays them over the photograph in overlay", () => {
    render(
      <PhotoStage mobilePhoto="overlay" photo={ENGAGEMENT}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    // The same cell as the print: one row, one column, two layers.
    expect(column().className).toContain("row-start-1");
    expect(column().className).not.toContain("row-start-2");
  });

  it("puts them under the photograph in band", () => {
    render(
      <PhotoStage mobilePhoto="band" photo={WEDDING}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    expect(column().className).toContain("row-start-2");
  });

  /**
   * AND BESIDE IT AT `lg`, WHICHEVER MODE IT IS.
   *
   * Above the breakpoint the photograph is a framed print in its own column
   * and the words are in the second one, so the mobile choice stops applying
   * entirely.
   */
  it("puts them beside it above the breakpoint, either way", () => {
    for (const mode of ["overlay", "band"] as const) {
      const { unmount } = render(
        <PhotoStage mobilePhoto={mode} photo={WEDDING}>
          <p>Las palabras</p>
        </PhotoStage>,
      );

      expect(column().className).toContain("lg:col-start-2");
      expect(column().className).toContain("lg:row-start-1");
      unmount();
    }
  });
});
