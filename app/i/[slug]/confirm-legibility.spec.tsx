import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InvitationGreeting } from "@/components/invitation/InvitationGreeting";
import { RsvpConfirmed } from "@/components/invitation/RsvpConfirmed";
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
} from "@/lib/design/contrast";
import { declaredColor, over } from "@/lib/design/declared-color";

/**
 * WHETHER THE ACCEPTED SCREEN CAN BE READ, MEASURED RATHER THAN LOOKED AT.
 *
 * The sibling of `gate-legibility.spec.tsx`, and it exists for the same reason
 * that one does: U35 fixed a gate whose only label measured 1.2:1 against the
 * photograph behind it, and the lesson recorded there was that a unit which
 * gets a HEIGHT right can still ship a screen nobody can read. This screen was
 * then rebuilt — the couple asked for the map picture to go and for the venue
 * to move to the foot of the screen — so every one of its words is standing
 * somewhere new on the same photograph.
 *
 * ONE OF THEM LANDED BADLY AND THIS IS HOW THAT WAS FOUND. Pushed to the foot
 * of an iPhone 14, `Lugar` sits over Luis's lit trouser leg, whose brightest
 * pixel is #838380. Cream on that measures 3.3:1 AT FULL STRENGTH — no opacity
 * reaches 4.5:1, so the foot of the screen needed a ground and the top of it
 * turned out not to.
 *
 * HOW THE BACKGROUND GETS INTO A UNIT TEST. It cannot be computed: it is a
 * JPEG. So it arrives the way the gate's fixtures do — measured once, off the
 * real rendered page, and written down here with how it was taken. The colours
 * on the other side are NOT written down: `declaredColor` reads them back off
 * the rendered class names, so a change to the component is a change to what
 * this file measures.
 *
 * METHOD, SO THE NUMBERS CAN BE RETAKEN. Reach the accepted screen at the
 * `iPhone 14` and `Pixel 7` presets and at 1280×720, hide every glyph and
 * every ground the screen draws for itself, screenshot, and take the maximum
 * WCAG relative luminance inside each element's own box. The worst of the
 * three is what is written down. `p95` was recorded beside each maximum and is
 * deliberately not what is asserted: the maximum is the harsher floor and the
 * gate's spec already chose it.
 *
 * WHAT THIS DELIBERATELY DOES NOT CREDIT. The text shadow every line here
 * carries, and the blur behind the foot's ground. WCAG has no term for either,
 * and a floor that credits an unmeasurable is not a floor. Both make the real
 * screen better than these numbers.
 */

/**
 * The brightest pixel under each line of the TOP group, which has no ground.
 *
 * The greeting, the receipt line and the two facts under them sit in the upper
 * third, where `PhotoStage`'s top scrim is doing most of its work. Per element
 * rather than one constant for the group, because they are spread down 200
 * pixels of a photograph and a single worst-case shared between them would be
 * a number that describes none of them — it would force full opacity onto a
 * label that measures 6:1 where it actually stands.
 */
const BRIGHTEST_UNDER_THE_TOP: readonly (readonly [string, string, string])[] =
  [
    [
      ".invitation__greeting",
      "#33350f",
      "the line that names the household — worst on a 1280×720 window",
    ],
    [".rsvp__saved", "#2d2e0d", "the receipt, said in words"],
    [".rsvp__when dt", "#3e4038", "`CUÁNDO`"],
    [
      ".rsvp__when dd",
      "#66684c",
      "the day and the hour — the thinnest on the screen at 5.0:1",
    ],
  ];

/**
 * And the brightest pixel under the FOOT, which is one constant because the
 * foot is one painted ground.
 *
 * #838380 on an iPhone 14, under `Lugar` at 78%–84% of the screen. The whole
 * group is measured against it rather than each line against its own: they
 * share a card, so the card has to be deep enough for the worst thing under
 * any part of it.
 */
const BRIGHTEST_UNDER_THE_FOOT = "#838380";

/**
 * The brightest pixel under ANY of it at `lg`, where the ground lets go.
 *
 * At the breakpoint the words move into their own column beside the framed
 * print and the foot's ground is `lg:hidden`, exactly as the gate's is. That
 * is only safe if the blurred backdrop over there is dark enough on its own,
 * which is a claim worth a number rather than a sentence: measured at
 * 1280×720, the brightest pixel under any line of this screen is #33350f.
 */
const BRIGHTEST_AT_LG = "#33350f";

function renderConfirmed() {
  const { container } = render(
    <>
      <InvitationGreeting>Los esperamos, Familia Aguirre</InvitationGreeting>
      <RsvpConfirmed
        onReconsider={vi.fn()}
        venueName="Salón para Eventos Villa Campestre"
      />
    </>,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the accepted screen has no \`${selector}\``);
    }

    return element;
  };

  return { container, find };
}

describe("the ground the foot of the accepted screen stands on", () => {
  it("covers the place and the one control there is", () => {
    const { find } = renderConfirmed();
    const foot = find(".rsvp__foot");

    for (const selector of [
      ".rsvp__foot-ground",
      ".rsvp__venue",
      ".rsvp__venue-map",
      ".rsvp__reconsider",
    ]) {
      expect(
        foot.querySelector(selector),
        `${selector} is outside the foot, so it is on the bare photograph`,
      ).not.toBeNull();
    }
  });

  /**
   * AND IT IS PAINTED, NOT LAID OUT.
   *
   * This screen's promise is that it is exactly one viewport tall on both
   * phones — `e2e/invitation-one-screen.spec.ts` measures it. A ground with
   * real padding would spend height the couple asked to get back by deleting
   * the map, so it is absolutely positioned behind the words with negative
   * insets and `isolate` on its parent.
   *
   * `isolate` IS LOAD-BEARING AND ITS ABSENCE IS SILENT. Without a stacking
   * context of its own a `-z-10` ground paints below every positioned element
   * in the page, including the photograph, and the screen renders exactly as
   * it did before with no error anywhere. `PhotoStage` documents the same trap
   * for its scrims.
   */
  it("costs the screen no height", () => {
    const { find } = renderConfirmed();

    expect(find(".rsvp__foot").className).toContain("isolate");
    expect(find(".rsvp__foot").className).toContain("relative");
    expect(find(".rsvp__foot-ground").className).toContain("absolute");
    expect(find(".rsvp__foot-ground").className).toContain("-z-10");
  });

  it("is hidden from a screen reader, because it says nothing", () => {
    const { find } = renderConfirmed();

    expect(find(".rsvp__foot-ground")).toHaveAttribute("aria-hidden", "true");
  });

  it("dissolves at `lg`, where the words are off the photograph", () => {
    const { find } = renderConfirmed();

    expect(find(".rsvp__foot-ground").className).toContain("lg:hidden");
  });

  /**
   * AND THE TOP OF THE SCREEN HAS NO GROUND, WHICH IS A MEASUREMENT RATHER
   * THAN AN OVERSIGHT.
   *
   * Everything up there clears 4.5:1 on the bare photograph — see the table
   * below — so a card would dim the couple on the one screen that is otherwise
   * just them and four short lines. U35 recorded what that costs on the gate:
   * "the gate is no longer a picture of the two of them." It is not a price
   * worth paying twice.
   */
  it("is the only one on the screen", () => {
    const { container } = renderConfirmed();

    // Any painted ground on this screen is named `…-ground`, as the gate's is.
    expect(container.querySelectorAll("[class*='-ground']")).toHaveLength(1);
  });
});

describe("what the accepted screen's words measure against the photograph", () => {
  it.each(BRIGHTEST_UNDER_THE_TOP)(
    "reads %s on the bare photograph — %s",
    (selector, brightest) => {
      const { find } = renderConfirmed();

      expect(
        contrastRatio(declaredColor(find(selector), "text"), brightest),
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    },
  );

  function foot(): string {
    const { find } = renderConfirmed();

    return over(
      declaredColor(find(".rsvp__foot-ground"), "bg"),
      BRIGHTEST_UNDER_THE_FOOT,
    );
  }

  it.each([
    [".rsvp__venue dt", "`LUGAR`, which is why this ground exists"],
    [".rsvp__venue dd", "the venue's own name"],
    [".rsvp__venue-map", "the only control on the screen"],
    [".rsvp__reconsider", "the way back to the question"],
  ])("reads %s on that ground — %s", (selector) => {
    const { find } = renderConfirmed();

    expect(
      contrastRatio(declaredColor(find(selector), "text"), foot()),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * THE GROUND IS WHAT MAKES `LUGAR` READABLE, AND THIS IS THE PROOF.
   *
   * Without it the same label measures 3.3:1 against the same pixel — under
   * the threshold at FULL cream, let alone at the 75% it is set in. An
   * assertion that only ever ran with the card in place would pass just as
   * happily if the card stopped being needed, and would say nothing about why
   * it is there.
   */
  it("would fail without that ground, which is why it is there", () => {
    const { find } = renderConfirmed();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__venue dt"), "text"),
        BRIGHTEST_UNDER_THE_FOOT,
      ),
    ).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND EVERY LINE STILL READS AT `lg`, WHERE THE GROUND IS GONE.
   *
   * One constant for the whole screen there, because at the breakpoint the
   * words are in a single column over one blurred backdrop rather than spread
   * down a photograph.
   */
  it.each([
    ".invitation__greeting",
    ".rsvp__saved",
    ".rsvp__when dt",
    ".rsvp__when dd",
    ".rsvp__venue dt",
    ".rsvp__venue dd",
    ".rsvp__venue-map",
    ".rsvp__reconsider",
  ])("reads %s beside the framed print", (selector) => {
    const { find } = renderConfirmed();

    expect(
      contrastRatio(declaredColor(find(selector), "text"), BRIGHTEST_AT_LG),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});

/**
 * WHETHER THE ONE CONTROL READS AS A CONTROL, WHICH IS A SEPARATE FAILURE.
 *
 * The couple asked for "solamente el botón de cómo llegar", so this is the
 * only thing on the screen a guest can press, and it lost the picture that
 * used to make it obvious — the whole map was the tap target, and a 320×200
 * photograph of Buga is hard to miss. WCAG measures the boundary of a control
 * against what is around it on its own threshold, 3:1, because an invisible
 * control is not a contrast problem: it is a missing control.
 */
describe("whether the way to the venue reads as a control", () => {
  it("draws an edge that can be seen against the ground it sits on", () => {
    const { find } = renderConfirmed();
    const ground = over(
      declaredColor(find(".rsvp__foot-ground"), "bg"),
      BRIGHTEST_UNDER_THE_FOOT,
    );

    expect(
      contrastRatio(declaredColor(find(".rsvp__venue-map"), "border"), ground),
    ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  /**
   * AND IT IS RAISED RATHER THAN SUNK, which is the opposite of what the
   * gate's field had to be and for the same reason: the console's own language
   * calls `--muted` "the SUNK surface: inputs, alternate rows, wells". This is
   * not a well to type into, it is a button to press, so it is lighter than
   * the card under it rather than darker.
   */
  it("sits above the card rather than in it", () => {
    const { find } = renderConfirmed();

    expect(declaredColor(find(".rsvp__venue-map"), "bg")).toBe(
      "rgba(246, 239, 226, 0.1)",
    );
  });

  it("is a target a thumb can find, which the picture used to guarantee", () => {
    const { find } = renderConfirmed();

    expect(find(".rsvp__venue-map").className).toContain("min-h-11");
  });
});
