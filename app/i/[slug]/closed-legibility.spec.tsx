import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RsvpClosed } from "@/components/invitation/RsvpClosed";
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
} from "@/lib/design/contrast";
import { declaredColor, over } from "@/lib/design/declared-color";

/**
 * WHETHER THE WEEK AFTER THE DEADLINE CAN BE READ, MEASURED.
 *
 * The fifth of these files, and the screen it covers did not exist in any
 * meaningful form until this unit: the closed state was two sentences over an
 * empty page, so there was nothing to measure and no way to reach it. It
 * carries the venue, the map, the hour, the dress code or the stream now —
 * see `RsvpClosed` — which makes it a real screen and subject to the same
 * floors as the other four.
 *
 * HOW THE BACKGROUND GETS IN, and it is the method its four siblings use so
 * the five sets of numbers are comparable: the real page is rendered at the
 * `iPhone 14` and `Pixel 7` presets with the RSVP deadline already past, every
 * glyph is made transparent, every ground the screen draws for itself is
 * removed, and the maximum WCAG relative luminance inside each element's own
 * box is taken off the screenshot. The worst of the two phones, across all
 * three endings and both household sizes, is what is written down.
 *
 * WHAT THE MEASUREMENT FOUND. One value, and it was in a component that had
 * already been measured elsewhere: `RsvpConfirmed`'s labels are `/75` on the
 * screen a household reaches by accepting, where they are comfortable. After
 * the deadline the same component sits one line lower — the closed note is
 * above it — and the day's label landed on #5C5E47 at **4.10:1**. It is
 * `/85` now, 4.75:1 here and better than it was on the open screen. Lifting
 * the shared value rather than copying the component is the whole reason this
 * file could find it at all.
 */

/**
 * The brightest pixel under the line that says the answers are closed.
 *
 * #525043 on an iPhone 14, from the declined ending of a four-person
 * invitation — the tallest of the three, so its note sits highest and catches
 * the most light. A Pixel 7 is kinder everywhere (#272821 at worst).
 */
const BRIGHTEST_UNDER_THE_NOTE = "#525043";

/**
 * And under the accepted ending's own lines, which is where the defect was.
 *
 * #687041 under the day and the dress code, #5C5E47 under their labels,
 * #535453 under `Lugar`, #4A4736 under the venue's name — all on an iPhone 14
 * for an invitation naming one person, whose shorter note pushes the block
 * lowest into the light. The labels' is the one that matters: it is the
 * harshest ground any `/85` word on this screen stands on.
 */
const BRIGHTEST_UNDER_A_LABEL = "#5c5e47";
const BRIGHTEST_UNDER_A_VALUE = "#687041";

/**
 * And under the two stream controls, for the other two endings.
 *
 * #535453 on an iPhone 14. They are the same controls `/transmision` and the
 * declining screen render, so they carry the ground and the `/60` edge those
 * surfaces measured; this checks them where THIS screen puts them.
 */
const BRIGHTEST_UNDER_THE_CONTROLS = "#535453";

const CEREMONY = {
  streamUrl: "https://meet.google.com/abc-defg-hij",
  coupleNames: "Luis & Michell",
};

function renderClosed(answer: { attending: boolean } | null) {
  const { container } = render(
    <RsvpClosed
      answer={answer}
      ceremony={CEREMONY}
      venue={{ name: "Salón para Eventos Villa Campestre" }}
      memberCount={4}
      greetingName="Familia Aguirre"
    />,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the closed screen has no \`${selector}\``);
    }

    return element;
  };

  return { container, find };
}

describe("what the closed screen's words measure", () => {
  it("reads the line that says the answers are closed", () => {
    const { find } = renderClosed(null);

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__closed-note"), "text"),
        BRIGHTEST_UNDER_THE_NOTE,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * THE ACCEPTED ENDING'S OWN LINES, WHICH ARE THE ONES A GUEST TRAVELS ON.
   *
   * The day, the hour, the dress code, the venue: everything the old closed
   * screen threw away. They are `RsvpConfirmed`'s, measured here against the
   * pixels THIS screen puts them over rather than the ones the accepted
   * screen did.
   */
  it("reads the labels of the day and the place", () => {
    const { find } = renderClosed({ attending: true });

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__when dt"), "text"),
        BRIGHTEST_UNDER_A_LABEL,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("reads the day and the hour themselves", () => {
    const { find } = renderClosed({ attending: true });

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__when dd"), "text"),
        BRIGHTEST_UNDER_A_VALUE,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND THE LABELS WOULD NOT HAVE, AT THE OPACITY THEY CARRIED — the
   * permanent negative control, and the one this file exists to have caught.
   *
   * `/75` is what `RsvpConfirmed` shipped with and what the accepted screen
   * still measures comfortably. One line lower, on this screen's ground, it
   * is 4.10:1. An assertion that only ever ran at `/85` would pass just as
   * happily if somebody quietened it back.
   */
  it("would not have, at the opacity the accepted screen shipped with", () => {
    expect(
      contrastRatio(
        over("rgba(246, 239, 226, 0.75)", BRIGHTEST_UNDER_A_LABEL),
        BRIGHTEST_UNDER_A_LABEL,
      ),
    ).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });
});

describe("whether the closed screen's controls read as controls", () => {
  it.each([
    ["a household that declined", { attending: false }],
    ["a household that never answered", null],
  ])("draws an edge on the stream controls for %s", (_who, answer) => {
    const { container } = renderClosed(answer);
    const controls = container.querySelectorAll(
      '[data-testid="stream-details"] a',
    );

    expect(controls).toHaveLength(2);

    for (const control of controls) {
      const ground = over(
        declaredColor(control, "bg"),
        BRIGHTEST_UNDER_THE_CONTROLS,
      );

      /*
        The edge is `currentColor` — `StreamDetails` deliberately has no
        palette of its own — so the opacity is read off the component and
        composited over the cream this surface declares, which is the closed
        note's own token rather than a literal written down here.
      */
      const cream = declaredColor(
        container.querySelector(".rsvp__closed-note")!,
        "text",
      );

      expect(control.className).toContain("border-current/60");
      expect(
        contrastRatio(over(cream.replace(/, 1\)$/, ", 0.6)"), ground), ground),
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
      expect(contrastRatio(cream, ground)).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT,
      );
    }
  });

  /** And the edge they carried before this pass would not have. */
  it("would not have, at the edge they carried until now", () => {
    const ground = over("rgba(0, 0, 0, 0.25)", BRIGHTEST_UNDER_THE_CONTROLS);

    expect(
      contrastRatio(over("rgba(246, 239, 226, 0.3)", ground), ground),
    ).toBeLessThan(WCAG_AA_NON_TEXT);
  });
});
