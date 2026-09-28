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
const BRIGHTEST_UNDER_A_VALUE = "#63674e";

/**
 * And under the counter, which is why this screen does not have one.
 *
 * #A6A57D on an iPhone 14 — 0.365, the brightest ground any block on any of
 * these five screens stands on. The couple asked for the countdown on the
 * accepted screen and it is there; this screen renders the same component
 * one note lower, which drops the counter into the gap between
 * `PhotoStage`'s two scrims. Its figures are FULL cream already, so there is
 * no opacity left to spend: 2.2:1, against a floor of 4.5.
 *
 * `RsvpConfirmed` takes `countdown={false}` here for that reason and the day
 * and the hour are stated immediately above it either way. The counter's
 * lack of a ground is a defect of its own, older and wider than this screen
 * — it is under the floor on the live accepted screen's labels too — and the
 * feature document carries it as an open decision rather than a fix
 * smuggled into a unit about one screen.
 */
const BRIGHTEST_UNDER_A_COUNTDOWN = "#a6a57d";

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
  /**
   * THE TWO LINES THAT REPLACED THE LABEL/VALUE PAIRS.
   *
   * The couple said the accepted screen read as a spec sheet beside the
   * other three, so `CUÁNDO` over the date and `CÓDIGO DE VESTIMENTA` over
   * its value became two lines of spaced caps in the announcement's own
   * setting. The closed screen renders the same component, so the same two
   * lines are what it has to be able to read.
   */
  it("reads the day, and the hour beside the dress code", () => {
    const { find } = renderClosed({ attending: true });

    for (const [selector, ground] of [
      [".rsvp__when p:first-of-type", BRIGHTEST_UNDER_A_LABEL],
      [".rsvp__when p:nth-of-type(2)", BRIGHTEST_UNDER_A_VALUE],
    ] as const) {
      expect(
        contrastRatio(declaredColor(find(selector), "text"), ground),
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    }
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

/**
 * THE COUNTER THIS SCREEN DELIBERATELY DOES NOT SHOW.
 *
 * Asserted rather than left to the component, because the obvious future
 * edit is to pass `countdown` through for consistency with the live accepted
 * screen — and consistency is the wrong reason to put an unreadable number
 * on a photograph. The measurement is the argument, so the measurement is
 * the test.
 */
describe("the counter after the deadline", () => {
  it("is not shown, because it could not be read here", () => {
    const { container } = renderClosed({ attending: true });

    expect(
      container.querySelector('[data-testid="countdown-figures"]'),
    ).toBeNull();
  });

  /**
   * AND THIS IS WHY — the number, kept where a reader will meet it.
   *
   * The figures are full cream and the ground is #A6A57D. When the counter
   * gains a ground of its own this goes red, which is the signal to delete
   * it and let the counter back onto this screen.
   */
  it("would be under the floor if it were", () => {
    expect(
      contrastRatio("rgba(246, 239, 226, 1)", BRIGHTEST_UNDER_A_COUNTDOWN),
    ).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });
});
