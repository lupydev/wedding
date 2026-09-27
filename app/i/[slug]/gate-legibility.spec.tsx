import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvitationGate } from "@/components/invitation/InvitationGate";
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
  parseCssColor,
  relativeLuminance,
} from "@/lib/design/contrast";
import { declaredColor, over } from "@/lib/design/declared-color";

import { GateForm } from "./gate-form";

/**
 * WHETHER THE GATE CAN BE READ, MEASURED RATHER THAN LOOKED AT.
 *
 * The gate is the first screen every guest sees and the only one with a field,
 * and the couple's brief for the whole redesign was that it must work for
 * somebody who is not comfortable with a phone. It shipped with the label of
 * its only control rendered at 1.2:1 against the pixels behind it — cream type
 * on the lit cream of Michell's dress, with nothing in between. Nothing failed:
 * the page rendered, every other test stayed green, and the label was simply
 * not there.
 *
 * "Is this readable?" is a calculation, and `lib/design/contrast.ts` already
 * does it for both theme token tables. This file points the same arithmetic at
 * the one surface whose background is a photograph instead of a token.
 *
 * HOW THE BACKGROUND GETS INTO A UNIT TEST. It cannot be computed: it is a
 * JPEG. So it arrives the way the crop's fixture does in
 * `components/landing/photos.spec.ts` — measured once, off the real rendered
 * page, and written down here with how it was taken. The colours on the other
 * side are NOT written down: they are read back off the rendered class names,
 * so a change to the component is a change to what this file measures.
 *
 * WHAT THIS DELIBERATELY DOES NOT CREDIT. The panel blurs what is behind it,
 * and a blur pulls a bright highlight towards its dark surroundings. Measuring
 * the sharp pixel is therefore harsher than what a guest sees, which is the
 * right direction for a floor to err in.
 */

/**
 * The brightest pixel the gate's panel covers, in the crop an iPhone 14 shows.
 *
 * Taken from the rendered page rather than from `img/boda.jpg`: what sits
 * behind the words is the photograph AFTER `PhotoStage` has laid its two
 * gradients over it, and those gradients are most of the story.
 *
 * RE-SAMPLED WHEN THE PANEL MOVED, AND DELIBERATELY UNCHANGED. The couple
 * asked for the form to go to the foot of the screen so the middle of the
 * photograph is the couple again. Centred, the panel sat at 60%–72% — the gap
 * where the top scrim has faded out and the bottom one has not begun, over
 * the lit edge of Michell's dress, and the brightest pixel inside its box was
 * #FAF8EF. At the foot it covers 66%–96% on an iPhone 14 and 73%–97% on a
 * Pixel 7, and the brightest pixel inside its box AT REST is #DEC799.
 *
 * The value below stays at #FAF8EF anyway, and that is the interesting part.
 * This panel is bottom-anchored and grows UPWARDS: the reserved refusal line
 * is one line, a real refusal is two sentences, and on a narrow phone it
 * wraps to three or four. #FAF8EF sits at 62% of the screen — four percent
 * above the panel's resting top edge — so the state in which a guest most
 * needs to read this card is the state that puts it back over the brightest
 * pixel in the frame. A fixture measured only at rest would be a floor that
 * lifts exactly when the screen gets harder to read.
 *
 * Method, unchanged so the numbers stay comparable: render `/i/[slug]` at
 * 390×664 and 412×839, hide every glyph, every ground the form draws for
 * itself and every transition, screenshot, and take the maximum WCAG relative
 * luminance inside the panel's own box.
 */
const BRIGHTEST_UNDER_THE_PANEL = "#faf8ef";

/*
  THE CLASS-NAME READER MOVED OUT, TO `lib/design/declared-color.ts`.

  It lived here while the gate was the only surface whose words sat on a
  photograph. The accepted screen is a second one — see
  `confirm-legibility.spec.tsx` — and two copies of a parser are two parsers
  that agree until somebody fixes a bug in one of them.
*/

function renderGate() {
  const { container } = render(
    <InvitationGate greetingName="Familia Aguirre">
      <GateForm action={async () => ({ status: "idle" })} />
    </InvitationGate>,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the gate has no \`${selector}\``);
    }

    return element;
  };

  return { container, find };
}

describe("the ground the gate's words are read on", () => {
  it("covers the field and everything that explains it", () => {
    const { find } = renderGate();
    const panel = find(".gate__panel");

    for (const selector of [
      ".gate__ask",
      ".gate__field-label",
      ".gate__field",
      ".gate__submit",
      ".gate__feedback",
    ]) {
      expect(
        panel.querySelector(selector),
        `${selector} is outside the panel, so it is on the photograph`,
      ).not.toBeNull();
    }
  });

  it("is hidden from a screen reader, because it says nothing", () => {
    const { find } = renderGate();

    expect(find(".gate__panel-ground")).toHaveAttribute("aria-hidden", "true");
  });

  /**
   * AND IT LETS GO ABOVE THE BREAKPOINT.
   *
   * At `lg` the words are in their own column beside a framed print, so the
   * ground would be a dark card floating on a dark page for no reader's
   * benefit — the same reason `PhotoStage` hides its two scrims there.
   */
  it("dissolves at `lg`, where the words are off the photograph", () => {
    const { find } = renderGate();

    expect(find(".gate__panel-ground").className).toContain("lg:hidden");
  });
});

describe("what the gate's words measure against the photograph", () => {
  function ground(): string {
    const { find } = renderGate();

    return over(
      declaredColor(find(".gate__panel-ground"), "bg"),
      BRIGHTEST_UNDER_THE_PANEL,
    );
  }

  it.each([
    [".gate__ask", "the sentence that asks for the number"],
    [".gate__field-label", "the label of the only control on the screen"],
    [".gate__field", "the number as the guest types it"],
    [".gate__submit", "the way in"],
    [".gate__feedback", "the reason a refused guest was refused"],
  ])("reads %s — %s", (selector) => {
    const { find } = renderGate();

    expect(
      contrastRatio(declaredColor(find(selector), "text"), ground()),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /*
    AN ASSERTION FOR THE ESCAPE HATCH STOOD HERE.

    "¿No puedes entrar? Escríbenos por WhatsApp" sat outside the panel, on the
    bare photograph, and U35 measured it there: at 60% cream it was 2.9:1
    against Luis's lit trouser leg on a Pixel 7, and went to full cream at
    5.1:1. The couple have deleted the link, so there is nothing left to
    measure and the fixture that described its ground went with it.

    Nothing on this screen is on bare photograph any more except the greeting
    and the announcement, which `PhotoStage`'s top scrim covers and which
    `confirm-legibility.spec.tsx` already measures in the same place.
  */
});

/**
 * WHETHER THE FIELD LOOKS LIKE A FIELD, WHICH IS A SEPARATE FAILURE.
 *
 * The gate shipped with a field a guest could read the label of and still not
 * find: a translucent bar with a 25%-opacity edge over a photograph, under a
 * button that did read as a button. WCAG measures the boundary of a control
 * against what is around it on its own threshold — 3:1 — because an invisible
 * control is not a contrast problem, it is a missing control.
 */
describe("whether the gate's field reads as a field", () => {
  it("draws an edge that can be seen against the panel", () => {
    const { find } = renderGate();
    const panel = over(
      declaredColor(find(".gate__panel-ground"), "bg"),
      BRIGHTEST_UNDER_THE_PANEL,
    );

    expect(
      contrastRatio(declaredColor(find(".gate__field"), "border"), panel),
    ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  /**
   * AND IT IS SUNK RATHER THAN RAISED, which is the console's own language for
   * the difference: `--muted` is "the SUNK surface: inputs, alternate rows,
   * wells", and it is darker than the card it sits on. The submit button below
   * is the raised one. Two controls that look the same is how a guest ends up
   * pressing the wrong one.
   */
  it("sits lower than the panel, and lower than the button on it", () => {
    const { find } = renderGate();
    const panel = over(
      declaredColor(find(".gate__panel-ground"), "bg"),
      BRIGHTEST_UNDER_THE_PANEL,
    );
    const luminanceOf = (color: string) =>
      relativeLuminance(parseCssColor(over(color, panel)));

    expect(luminanceOf(declaredColor(find(".gate__field"), "bg"))).toBeLessThan(
      relativeLuminance(parseCssColor(panel)),
    );
    expect(luminanceOf(declaredColor(find(".gate__field"), "bg"))).toBeLessThan(
      luminanceOf(declaredColor(find(".gate__submit"), "bg")),
    );
  });
});
