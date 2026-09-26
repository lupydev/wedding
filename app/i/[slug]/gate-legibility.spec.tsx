import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvitationGate } from "@/components/invitation/InvitationGate";
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
  flatten,
  parseCssColor,
  relativeLuminance,
  type Rgba,
} from "@/lib/design/contrast";

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
 * gradients over it, and those gradients are most of the story everywhere
 * except here. The panel lands in the gap between them — the top scrim ends at
 * 55% of the screen and the bottom one is still transparent at 62% — which is
 * exactly where the lit edge of Michell's dress falls.
 *
 * Method: render `/i/[slug]` at 390×664, hide every glyph and every ground the
 * form draws for itself, screenshot, and take the maximum WCAG relative
 * luminance inside the label's own box. It came back #FAF8EF, which is all but
 * white: 0.937 against the 0.861 of the cream the page writes in.
 */
const BRIGHTEST_UNDER_THE_PANEL = "#faf8ef";

/**
 * And the brightest pixel under the recovery link, which sits outside it.
 *
 * Measured the same way on a Pixel 7, which is where it is worst: the taller
 * screen puts the link at 79% rather than 89%, over Luis's lit trouser leg
 * instead of the dark ground below it.
 */
const BRIGHTEST_UNDER_THE_RECOVERY_LINK = "#646564";

/** The named colours the gate's class names are allowed to use. */
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
};

function rgbaString(color: Rgba): string {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
}

/** `a` painted on top of `b`, as one opaque colour the arithmetic can take. */
function over(color: string, backdrop: string): string {
  return rgbaString(flatten(parseCssColor(color), parseCssColor(backdrop)));
}

/**
 * Reads a colour back off a rendered class name.
 *
 * `bg-[#0d1114]/60`, `border-[#f6efe2]/55`, `bg-black/25`. Conditional
 * variants — `focus-visible:`, `hover:`, `lg:` — are skipped: this measures the
 * RESTING state, which is the one a guest who has not touched anything is
 * looking at.
 *
 * It throws rather than guessing, for the reason the whole file exists: a
 * silent zero here would be a confident pass for an unreadable pairing.
 */
function declaredColor(
  element: Element,
  utility: "bg" | "text" | "border" | "ring",
): string {
  const pattern = new RegExp(
    `^${utility}-(?:\\[(#[0-9a-f]{3,8})\\]|(black|white))(?:/(\\d{1,3}))?$`,
    "i",
  );
  const found = Array.from(element.classList)
    .filter((token) => !token.includes(":"))
    .map((token) => pattern.exec(token))
    .filter((match): match is RegExpExecArray => match !== null);

  if (found.length !== 1) {
    throw new Error(
      `expected exactly one unconditional \`${utility}-\` colour on ` +
        `<${element.tagName.toLowerCase()} class="${element.className}">, ` +
        `found ${found.length}. This spec measures the colour the component ` +
        "declares, so it cannot fall back to a default.",
    );
  }

  const [, hex, name, opacity] = found[0];
  const base = hex ?? NAMED_COLORS[name.toLowerCase()];
  const { red, green, blue } = parseCssColor(base);
  const alpha = opacity === undefined ? 1 : Number(opacity) / 100;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function renderGate() {
  const { container } = render(
    <InvitationGate
      greetingName="Familia Aguirre"
      recoveryHref="https://wa.me/573005550000?text=Hola"
    >
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

  /**
   * THE ESCAPE HATCH IS OUTSIDE THE PANEL AND STILL HAS TO BE LEGIBLE.
   *
   * A household whose number is not the stored one has nothing else on this
   * page. It is deliberately quiet — it must not compete with the field — but
   * quiet is a matter of size and weight, not of being unreadable.
   */
  it("reads the way out, which sits on the bare photograph", () => {
    const { find } = renderGate();

    expect(
      contrastRatio(
        declaredColor(find(".gate__recovery"), "text"),
        BRIGHTEST_UNDER_THE_RECOVERY_LINK,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
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
