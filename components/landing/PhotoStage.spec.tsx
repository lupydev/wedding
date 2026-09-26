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
   *
   * A SINGLE DECIMAL rather than `w / h`, because the same number caps the
   * frame's width inside a `calc()` — `min(100%, 86dvh × ratio)` — and a
   * fraction cannot be multiplied there.
   */
  it("takes its shape from the photograph's own dimensions", () => {
    render(
      <PhotoStage photo={WEDDING}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    expect(frame().style.getPropertyValue("--photo-stage-ratio")).toBe("0.75");
  });

  it("shapes itself differently for a differently shaped photograph", () => {
    render(
      <PhotoStage photo={ENGAGEMENT}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    expect(frame().style.getPropertyValue("--photo-stage-ratio")).toBe(
      String(737 / 1600),
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

/**
 * HOW A PHOTOGRAPH MEETS A PHONE VIEWPORT WHEN IT FILLS ONE.
 *
 * `overlay` used to mean one thing: `object-contain`. That was correct for the
 * only photograph it was ever given — the engagement picture is 0.46:1 and a
 * phone is 0.462:1, so containing it wastes a few pixels and crops nobody.
 *
 * The wedding photograph is 0.75:1. Contained on a phone it becomes a letterbox
 * with the blurred backdrop above and below it, which is the "band" layout
 * again with extra steps. Covered, it is cropped to the viewport's shape — and
 * the two people stand left and right of centre, so WHERE the crop falls is the
 * difference between a photograph of the couple and a photograph of a
 * waterfall with somebody's shoe leaving the frame.
 *
 * So the crop is a property of the PHOTOGRAPH rather than of the stage: only
 * whoever looked at the picture knows where its subject is. A photograph that
 * says nothing is contained, exactly as before.
 */
describe("how a photograph fills a phone viewport", () => {
  const FOCUSED = { ...WEDDING, overlayFocus: "68% center" };

  it("covers the viewport at the focus the photograph declares", () => {
    render(
      <PhotoStage mobilePhoto="overlay" photo={FOCUSED}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    const image = screen.getByAltText(WEDDING.alt);

    expect(image.className).toContain("object-cover");
    expect(image.className).not.toContain("object-contain");
    expect(image.style.objectPosition).toBe("68% center");
  });

  /**
   * AND CONTAINS ONE THAT DOES NOT, which is the landing page unchanged.
   *
   * The engagement photograph is the phone's own shape, so there is nothing to
   * decide and nothing to get wrong. Asserted rather than assumed because this
   * is the page the couple have already approved: a crop introduced here would
   * be a silent change to a screen nobody asked to change.
   */
  it("contains a photograph that declares no focus", () => {
    render(
      <PhotoStage mobilePhoto="overlay" photo={ENGAGEMENT}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    const image = screen.getByAltText(ENGAGEMENT.alt);

    expect(image.className).toContain("object-contain");
    expect(image.style.objectPosition).toBe("");
  });

  /**
   * THE FOCUS BELONGS TO THE FULL-VIEWPORT CROP AND NOWHERE ELSE.
   *
   * In `band` the photograph is a strip whose own crop was measured separately
   * (`object-[center_72%]`, which is about the vertical), and at `lg` it is a
   * framed print drawn at the file's own ratio, where there is no overflow for
   * an object-position to move. A focus leaking into either would be moving a
   * picture that is not being cropped.
   */
  it("leaves the band strip's own crop alone", () => {
    render(
      <PhotoStage mobilePhoto="band" photo={FOCUSED}>
        <p>Las palabras</p>
      </PhotoStage>,
    );

    const image = screen.getByAltText(WEDDING.alt);

    expect(image.className).toContain("object-[center_72%]");
    expect(image.style.objectPosition).toBe("");
  });
});

/**
 * THE SLOT THAT LAID A LINE OVER THE PHOTOGRAPH IS GONE, AND SO ARE ITS TESTS.
 *
 * `overPhoto` existed for one caller and one layout: the invitation's greeting,
 * in `band`, where the photograph is a strip at the top and a line rendered
 * beneath it sat under the picture with a stripe of empty ground above. It
 * rendered the line in the print's own cell with a scrim and a 64px gutter to
 * clear the music control.
 *
 * The invitation stands in `overlay` now. The photograph is behind everything,
 * so the greeting is already on it without a slot, and the second copy of that
 * element — hidden on the side it did not belong to — went with it. What
 * remains of the measurement is the gutter, which `InvitationBody.spec.tsx` and
 * `InvitationGate.spec.tsx` now assert where it is applied.
 *
 * Deleted rather than kept green against no caller: an unused capability with
 * four tests reads as something the stage offers, and the next reader would
 * reach for it.
 */
