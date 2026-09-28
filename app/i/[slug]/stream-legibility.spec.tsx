import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CeremonyStream } from "@/components/invitation/CeremonyStream";
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
} from "@/lib/design/contrast";
import { declaredColor, over } from "@/lib/design/declared-color";

/**
 * WHETHER THE SCREEN A HOUSEHOLD REACHES BY SAYING NO CAN BE READ, MEASURED.
 *
 * The fourth of these files, after `gate-legibility.spec.tsx`,
 * `confirm-legibility.spec.tsx` and `step-legibility.spec.tsx` — and the last
 * screen of the invitation to get one. It had never been measured at all,
 * which mattered the moment the couple moved it: they asked for the stream
 * block to go to the TOP of the screen, and the top is where
 * `PhotoStage`'s two scrims leave their gap.
 *
 * WHAT THE MEASUREMENT FOUND, WHICH IS THE REASON THIS FILE EXISTS RATHER
 * THAN A NOTE SAYING THE SCREEN WAS CHECKED. Three values failed at the new
 * position and were lifted:
 *
 *   the welcome paragraph    `/85` → full cream     4.15:1 → 5.03:1
 *   the two stream controls  `/30` → `/60` edge     1.77:1 → 3.62:1
 *   the way back             `/30` → `/60` edge     2.52:1 → 6.00:1
 *
 * The paragraph is the sentence that tells a household the couple understand.
 * It was under the floor on bare photograph and nothing would have said so.
 *
 * HOW THE BACKGROUND GETS IN, and it is the method its three siblings use so
 * the four sets of numbers are comparable: the real page is rendered at the
 * `iPhone 14` and `Pixel 7` presets, every glyph is made transparent, every
 * ground the screen draws for ITSELF is removed — including transitions,
 * which otherwise catch the shot mid-fade — and the maximum WCAG relative
 * luminance inside each element's own box is taken off the screenshot. The
 * worst of the two phones is written down. The colours on the component's
 * side are NOT: `declaredColor` reads them back off the rendered class
 * names, so a change to the component is a change to what this file
 * measures.
 */

/**
 * The brightest pixel under the paragraph, which is the top of the screen.
 *
 * #66684C on an iPhone 14 at 17%–26%, for a household of four. This is the
 * band U37 identified as the gap between `PhotoStage`'s two scrims: the top
 * one has faded out and the bottom one has not started, so it is the only
 * place on the page where the photograph is carried by nothing at all. A
 * Pixel 7 is far kinder here (#292A22), and a household of one is too
 * (#3E4038) because its shorter paragraph sits higher, still inside the top
 * scrim. The worst of the four is what all of it is held to.
 */
const BRIGHTEST_UNDER_THE_PARAGRAPH = "#66684c";

/**
 * And under the two controls that carry the stream.
 *
 * #8B8C52 on an iPhone 14 at 29%–35% — the brightest ground any control on
 * this screen stands on, and brighter than the paragraph's because it is
 * further down the same gap. Sampled for the FOUR-person case for that
 * reason: a longer paragraph pushes the buttons further into the light.
 */
const BRIGHTEST_UNDER_THE_CONTROLS = "#8b8c52";

/**
 * And under the calendar control below them.
 *
 * #BFBCAA on an iPhone 14 for a four-person invitation — brighter than the
 * stream's own controls because it sits further down the same scrim gap,
 * and the brightest ground any control on this screen stands on. It is the
 * reason every control here is filled at `bg-black/55` rather than the `/40`
 * the first two shipped with: at `/40` the label here measured 4.30:1 and
 * the edge 2.61:1, both under.
 *
 * THERE WERE TWO CONTROLS HERE AND THERE IS ONE, AND THE NUMBER IS KEPT ON
 * PURPOSE. #BFBCAA was the ground under the LOWER of them, the `.ics` the
 * couple removed. Re-sampled with it gone, the remaining control stands on
 * **#ACAF86, 0.412** — darker, because it is the higher of the two and the
 * scrim gap only brightens downward. The harsher number stays: relaxing a
 * contrast fixture because a control was deleted buys nothing, and the
 * block's position on this screen moves with how many lines the paragraph
 * takes. Every assertion below therefore holds against a ground 1.2× brighter
 * than the one that is actually there.
 */
const BRIGHTEST_UNDER_THE_CALENDAR = "#bfbcaa";

/**
 * And at the foot, where the way back is.
 *
 * #4F4F4E under the sentence and #322F25 under the button, both on an iPhone
 * 14, both inside the bottom scrim at full strength. The sentence's is the
 * worse of the two and is what both are held to.
 *
 * RE-SAMPLED AFTER THE TARGETS GREW, AND IT CAUGHT ONE MORE. Declaring
 * `min-h-11` on the three controls moved everything below them by a few
 * pixels, which took this band from #504A3D to #4F4F4E — and the sentence at
 * the `/70` it had carried from the day it was written went from 4.73:1 to
 * 4.48:1, under the floor by two hundredths. It is `/85` now, at 5.32:1. A
 * fixture sampled before the last change would have missed it.
 */
const BRIGHTEST_AT_THE_FOOT = "#4f4f4e";

function renderDeclined(memberCount = 4) {
  const { container } = render(
    <CeremonyStream
      ceremony={{
        streamUrl: "https://meet.google.com/abc-defg-hij",
        coupleNames: "Luis & Michell",
      }}
      memberCount={memberCount}
      onReconsider={() => {}}
    />,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the declined screen has no \`${selector}\``);
    }

    return element;
  };

  return { container, find };
}

describe("what the declined screen's words measure", () => {
  /**
   * THE SENTENCE THAT SAYS THE COUPLE UNDERSTAND, ON BARE PHOTOGRAPH.
   *
   * "Comprendemos que no puedan acompañarnos ese día." It is the reason this
   * screen reads as an answer rather than a redirection, and it stands on the
   * photograph with no ground of its own — so it is the one line here that
   * has to be full cream.
   */
  it("reads the welcome on the bare photograph at the top", () => {
    const { find } = renderDeclined();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__stream-welcome"), "text"),
        BRIGHTEST_UNDER_THE_PARAGRAPH,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND IT WOULD NOT HAVE, AT THE OPACITY IT CARRIED UNTIL NOW — the
   * permanent negative control for this screen.
   *
   * `/85` is what this paragraph was set at from the day it was written, and
   * against the pixel it actually covers it measures 4.15:1. Under the floor,
   * at the only place on the page where neither scrim is working, in the
   * sentence this screen exists to say. An assertion that only ever ran at
   * full cream would pass just as happily if somebody quietened it again.
   */
  it("would not have, at the opacity it carried until now", () => {
    expect(
      contrastRatio(
        over("rgba(246, 239, 226, 0.85)", BRIGHTEST_UNDER_THE_PARAGRAPH),
        BRIGHTEST_UNDER_THE_PARAGRAPH,
      ),
    ).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  it("reads the sentence about changing your mind, at the foot", () => {
    const { find } = renderDeclined();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__reconsider"), "text"),
        BRIGHTEST_AT_THE_FOOT,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});

/**
 * WHETHER THE THREE CONTROLS READ AS CONTROLS, WHICH IS THE OTHER THRESHOLD.
 *
 * WCAG holds the boundary of a control to 3:1 rather than 4.5:1, because an
 * invisible control is not a contrast problem — it is a missing control. All
 * three here are their own affordance: there is no native input inside any of
 * them and no card behind them, so the edge is the whole of the claim that
 * something can be pressed.
 *
 * `border-current/30` was 1.77:1 on the brightest ground it covers. That is
 * the value `/transmision` shipped too — this block is shared — so the fix
 * lands on both surfaces, which is the point of sharing it.
 */
describe("whether the declined screen's controls read as controls", () => {
  it.each([
    [
      '[data-testid="stream-details"] a:first-of-type',
      "entrar a la transmisión",
    ],
    [
      '[data-testid="stream-details"] a:last-of-type',
      "agregar a Google Calendar",
    ],
  ])("draws an edge on %s — %s", (selector) => {
    const { find } = renderDeclined();
    const control = find(selector);
    const ground = over(
      declaredColor(control, "bg"),
      BRIGHTEST_UNDER_THE_CONTROLS,
    );

    /*
      THE EDGE IS `currentColor`, WHICH IS THE ONE COLOUR ON THIS SCREEN
      `declaredColor` CANNOT READ FOR ITSELF.

      `StreamDetails` deliberately has no palette — it is rendered on the
      invitation's dark stage and on `/transmision`, and its own file records
      what went wrong the last time it held colours of its own. So the
      opacity is read off the component and composited over the cream the
      surface around it declares, which is the way back's own token in the
      same block rather than a literal written down here.
    */
    const cream = declaredColor(find(".rsvp__reconsider-button"), "text");
    const edge = over(cream.replace(/, 1\)$/, ", 0.6)"), ground);

    expect(control.className).toContain("border-current/60");
    expect(contrastRatio(edge, ground)).toBeGreaterThanOrEqual(
      WCAG_AA_NON_TEXT,
    );
    // And the label inside it, which is the same inherited cream.
    expect(contrastRatio(cream, ground)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it("draws an edge on the way back", () => {
    const { find } = renderDeclined();
    const control = find(".rsvp__reconsider-button");
    const ground = over(declaredColor(control, "bg"), BRIGHTEST_AT_THE_FOOT);

    expect(
      contrastRatio(over(declaredColor(control, "border"), ground), ground),
    ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    expect(
      contrastRatio(declaredColor(control, "text"), ground),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND THE EDGE THEY ALL CARRIED UNTIL NOW WOULD NOT HAVE — the second
   * permanent negative control.
   */
  it("would not have, at the edge they carried until now", () => {
    const ground = over("rgba(0, 0, 0, 0.25)", BRIGHTEST_UNDER_THE_CONTROLS);

    expect(
      contrastRatio(over("rgba(246, 239, 226, 0.3)", ground), ground),
    ).toBeLessThan(WCAG_AA_NON_TEXT);
  });
});

/**
 * THE TWO CALENDAR CONTROLS, WHICH THE COUPLE ADDED TO THIS SCREEN TOO.
 *
 * They asked for both on the accepted screen and said nothing about this
 * one; the fourth control was measured before it was added — it fits at both
 * phone sizes for one and four people — and the module's own argument is
 * that the alarms matter MOST to a guest with no journey to plan.
 *
 * They stand lower than the stream's own pair, on brighter photograph, which
 * is what moved every control on this screen from `bg-black/40` to `/55`.
 */
describe("the two ways a stream guest keeps the date", () => {
  it("reads both labels, and draws both edges", () => {
    const { container, find } = renderDeclined();
    const actions = container.querySelectorAll(
      '[data-testid="calendar-actions"] a',
    );

    /*
      ONE CONTROL, WHERE THERE WERE TWO. The `.ics` beside it was removed
      after the couple tested the download on a real phone — "el .ics
      realmente intenta descargar un archivo" — so what is measured here is
      the one that remains, and the count is asserted so a silent return
      would have to be looked at.
    */
    expect(actions).toHaveLength(1);

    for (const action of actions) {
      const ground = over(
        declaredColor(action, "bg"),
        BRIGHTEST_UNDER_THE_CALENDAR,
      );
      const cream = declaredColor(find(".rsvp__reconsider-button"), "text");

      expect(action.className).toContain("border-current/60");
      expect(contrastRatio(cream, ground)).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT,
      );
      expect(
        contrastRatio(over(cream.replace(/, 1\)$/, ", 0.6)"), ground), ground),
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    }
  });

  /**
   * AND THE FILL THEY ARRIVED WITH WOULD NOT HAVE — the negative control for
   * the value this unit changed.
   */
  it("would not have, at the fill these controls shipped with", () => {
    const shallow = over("rgba(0, 0, 0, 0.4)", BRIGHTEST_UNDER_THE_CALENDAR);

    expect(contrastRatio("#f6efe2", shallow)).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });
});
