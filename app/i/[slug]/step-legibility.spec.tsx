import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RsvpAnswer } from "@/components/invitation/RsvpAnswer";
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
} from "@/lib/design/contrast";
import { declaredColor, over } from "@/lib/design/declared-color";

/**
 * WHETHER THE TWO SCREENS THAT ASK ANYTHING CAN BE READ, MEASURED.
 *
 * The third of these files, after `gate-legibility.spec.tsx` and
 * `confirm-legibility.spec.tsx`, and the couple's own words are why it exists:
 * they read the live flow on a phone and said the blocks sat over the middle
 * of the photograph and covered the two of them. Moving a block changes what
 * is behind it, so every screen that moved had to be re-measured rather than
 * assumed — and this is the one pair that had never been measured at all.
 *
 * WHAT THE MEASUREMENT FOUND, WHICH IS NOT WHAT THE MOVE WAS EXPECTED TO
 * CAUSE. U35 recorded in prose that the stepper's card "has been fine at
 * `bg-black/25` since U34: it sits at 70%–95%, where the bottom scrim is
 * already carrying 60% to 90% of the load." Measured against a build of
 * `19d67f2`, the question's card actually sat at 57%–96% on an iPhone 14 —
 * across the gap between `PhotoStage`'s two scrims, over the #FAF8EF edge of
 * Michell's dress that U35 gave the GATE a card for. Cream on `bg-black/25`
 * over that pixel is 2.5:1. The screens then moved, which took it to 1.7:1.
 *
 * So the defect is older than the move and the move made it worse, and the
 * fix is the same ground the gate already uses. This file is what stops the
 * claim being prose again.
 *
 * HOW THE BACKGROUND GETS INTO A UNIT TEST, and it is the method the two
 * sibling files use so the three sets of numbers are comparable: the real
 * page is rendered at the `iPhone 14` and `Pixel 7` presets, every glyph is
 * made transparent, every ground the screen draws for ITSELF is removed —
 * including transitions, which otherwise catch the shot mid-fade — and the
 * maximum WCAG relative luminance inside each element's own box is taken off
 * the screenshot. The worst of the two phones is what is written down. The
 * colours on the component's side are NOT written down: `declaredColor` reads
 * them back off the rendered class names, so a change to the component is a
 * change to what this file measures.
 *
 * WHAT IT DELIBERATELY DOES NOT CREDIT: the card's blur, and the text shadow
 * the two lines outside it carry. WCAG has no term for either and a floor
 * that credits an unmeasurable is not a floor.
 */

/**
 * The brightest pixel either card covers, on the phone where it is worst and
 * in the state where that card is worst.
 *
 * #FFFDF4 on an iPhone 14 — 0.980 luminance, all but pure white. It is the
 * lit edge of Michell's dress again, but higher up it than any card had
 * reached before: both cards are anchored to the FOOT of their screen now,
 * with the announcement above them, so both run down from the middle of the
 * frame rather than sitting under it.
 *
 * RE-SAMPLED THREE TIMES IN ONE PASS, BECAUSE THE CARDS MOVED THREE TIMES.
 * It was #FAF8EF while the question's card ran 57%–96%; #FBF9F0 when that
 * card took the gate's width and fell to 66%–91%; and #FFFDF4 once the list
 * of who is coming came down off the top of its screen to join it. Each
 * number was measured on the shipped build at both phone presets, and each
 * one was harsher than the last — which is the argument for re-sampling
 * rather than reasoning about which way a move "should" go.
 *
 * WHERE THIS ONE COMES FROM, EXACTLY: the list of who is coming, a household
 * of TWO, an iPhone 14, card at 60%–95%. Two rather than four because a
 * four-person card starts at the same 60% and runs past the fold, so the
 * extra rows only cover darker ground further down. A Pixel 7 is kinder to
 * every case (#D9C396 under the same card), and the question's card in its
 * own worst state — a household that declined and pressed "Volver a
 * responder", 36 pixels taller, top at 61% — measures 0.9369. One constant
 * for both cards is the honest one, and it is the worst of all of them.
 */
const BRIGHTEST_UNDER_THE_CARD = "#fffdf4";

/**
 * And the brightest pixel under the two lines that are NOT on the card.
 *
 * The couple moved both of them onto the bare photograph this pass: the
 * deadline out from under the question's card, and "Volver a la pregunta"
 * down to the foot of the screen that asks who is coming. Both land in the
 * last 10% of the viewport, where `PhotoStage`'s bottom scrim is at full
 * strength: #161614 on an iPhone 14 under the deadline, #030305 under the way
 * back. The worse of the two is what both are held to.
 *
 * It is the one number here that makes a moved block SAFER than it was. The
 * card is bright ground; the foot of the screen is the darkest ground on the
 * page.
 */
const BRIGHTEST_AT_THE_FOOT = "#161614";

const GUESTS = [
  { id: "aaaaaaaa-1111-4111-8111-111111111111", fullName: "Camila Aguirre" },
  { id: "bbbbbbbb-2222-4222-8222-222222222222", fullName: "Rodrigo Aguirre" },
  {
    id: "cccccccc-3333-4333-8333-333333333333",
    fullName: "Sara Aguirre",
    // A child, so the quietest text on the screen is in the fixture rather
    // than only in production.
    isChild: true,
  },
];

/**
 * The question screen, reached the way a household reaches it.
 *
 * `current` is a recorded DECLINE and the first thing this does is press the
 * stream screen's own way back, which is the one path in the product that
 * arrives at the question with a previous answer to report — `.rsvp__current`
 * is a line this file has to be able to measure. Going through the product
 * rather than rendering a branch directly, because what is measured here is
 * what a guest is actually looking at.
 *
 * Container-scoped rather than `screen`: several of the tests below render
 * more than once, and a document-wide query would then find two of
 * everything.
 */
function renderQuestion() {
  const { container } = render(
    <RsvpAnswer
      action={async () => ({ status: "idle" as const })}
      announcement={<p>Nos casamos</p>}
      ceremony={{
        streamUrl: "https://meet.google.com/abc-defg-hij",
        coupleNames: "Luis & Michell",
      }}
      current={{
        attending: false,
        seatsConfirmed: 0,
        attendeeGuestIds: [],
        dietaryNotes: null,
      }}
      greetingName="Familia Aguirre"
      guests={GUESTS}
      venue={{ name: "Salón para Eventos Villa Campestre" }}
    />,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the step has no \`${selector}\``);
    }

    return element;
  };

  fireEvent.click(find("[data-rsvp-step='stream'] button[type='button']"));

  return { container, find };
}

/**
 * The question screen with a refusal standing on it.
 *
 * The slot above the card paints its ground only when it has something to
 * say, so this is the only state in which it can be measured at all. Reached
 * the way a household reaches it: press the refusal, have the server turn it
 * down, and stay exactly where they were.
 */
async function renderRefused() {
  const { container } = render(
    <RsvpAnswer
      action={async () => ({ status: "not_authorized" as const })}
      announcement={<p>Nos casamos</p>}
      ceremony={{
        streamUrl: "https://meet.google.com/abc-defg-hij",
        coupleNames: "Luis & Michell",
      }}
      current={null}
      greetingName="Familia Aguirre"
      guests={GUESTS}
      venue={{ name: "Salón para Eventos Villa Campestre" }}
    />,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the step has no \`${selector}\``);
    }

    return element;
  };

  const answers = container.querySelectorAll(".rsvp__answer");

  fireEvent.click(answers[answers.length - 1]);
  await waitFor(() => expect(find(".rsvp__feedback").textContent).not.toBe(""));

  return { container, find };
}

/** And the list of who is coming, with a refusal standing under its card. */
async function renderAttendeesRefused() {
  const { container } = render(
    <RsvpAnswer
      action={async () => ({ status: "not_authorized" as const })}
      announcement={<p>Nos casamos</p>}
      ceremony={{
        streamUrl: "https://meet.google.com/abc-defg-hij",
        coupleNames: "Luis & Michell",
      }}
      current={null}
      greetingName="Familia Aguirre"
      guests={GUESTS}
      venue={{ name: "Salón para Eventos Villa Campestre" }}
    />,
  );

  const find = (selector: string): Element => {
    const element = container.querySelector(selector);

    if (element === null) {
      throw new Error(`the step has no \`${selector}\``);
    }

    return element;
  };

  fireEvent.click(find(".rsvp__answer"));
  fireEvent.click(find("button[type='submit']"));
  await waitFor(() => expect(find(".rsvp__feedback").textContent).not.toBe(""));

  return { container, find };
}

/** And the screen after it: the list of who is coming. */
function renderAttendees() {
  const rendered = renderQuestion();

  fireEvent.click(rendered.find(".rsvp__attending .rsvp__answer"));

  return rendered;
}

describe("the ground the two asking screens are read on", () => {
  it("covers the question and both answers", () => {
    const { find } = renderQuestion();
    const panel = find(".rsvp__panel");

    for (const selector of [
      ".rsvp__current",
      ".rsvp__attending",
      ".rsvp__answer",
    ]) {
      expect(
        panel.querySelector(selector),
        `${selector} is outside the card, so it is on the photograph`,
      ).not.toBeNull();
    }
  });

  /**
   * AND IT IS DEEP ENOUGH, WHICH IS A SUM RATHER THAN A CHOSEN NUMBER.
   *
   * The card's colour is read back off the component and composited over the
   * measured pixel, so nothing here holds its own copy of `/70`: lightening
   * the card is what turns this red. It is the gate's own value, for the
   * gate's own reason — the two surfaces stand on the same bright band of the
   * same photograph.
   */
  it("is deep enough to read cream on the brightest pixel it covers", () => {
    const { find } = renderQuestion();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__attending legend"), "text"),
        over(
          declaredColor(find(".rsvp__panel"), "bg"),
          BRIGHTEST_UNDER_THE_CARD,
        ),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND THE GROUND IT REPLACED WOULD NOT HAVE BEEN, WHICH IS THE PERMANENT
   * NEGATIVE CONTROL.
   *
   * `bg-black/25` is what this card carried from U34 until this pass. Against
   * the same pixel it measures 2.5:1 — under the threshold at FULL cream, so
   * no opacity on the words could have rescued it. An assertion that only
   * ever ran with the deeper ground in place would pass just as happily if
   * somebody put the old one back.
   */
  it("would not have been, at the value it carried until now", () => {
    const { find } = renderQuestion();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__attending legend"), "text"),
        over("rgba(0, 0, 0, 0.25)", BRIGHTEST_UNDER_THE_CARD),
      ),
    ).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });
});

describe("what the question screen's words measure", () => {
  function card(): string {
    const { find } = renderQuestion();

    return over(
      declaredColor(find(".rsvp__panel"), "bg"),
      BRIGHTEST_UNDER_THE_CARD,
    );
  }

  it.each([
    [".rsvp__current", "the answer already on file"],
    [".rsvp__attending legend", "the question itself"],
  ])("reads %s on the card — %s", (selector) => {
    const { find } = renderQuestion();

    expect(
      contrastRatio(declaredColor(find(selector), "text"), card()),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * THE TWO ANSWERS SIT ON A FILL OF THEIR OWN, NOT ON THE CARD.
   *
   * Each answer is a pill with its own `bg-[#f6efe2]/10` — the same control
   * the send button is — so the words in it are two layers off the
   * photograph. Measured through both rather than against the card alone,
   * which would be the flattering reading.
   */
  it("reads the two answers on the pill they are drawn as", () => {
    const { container, find } = renderQuestion();
    const answers = Array.from(container.querySelectorAll(".rsvp__answer"));

    expect(answers).toHaveLength(2);

    for (const answer of answers) {
      expect(
        contrastRatio(
          declaredColor(answer, "text"),
          over(declaredColor(answer, "bg"), card()),
        ),
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
      // And the card really is what the pill is painted over.
      expect(find(".rsvp__panel").contains(answer)).toBe(true);
    }
  });

  /**
   * AND EACH ONE DRAWS AN EDGE, WHICH IS A THRESHOLD THEY DID NOT USED TO
   * HAVE TO CLEAR.
   *
   * While the answers were a radio group this file said, in as many words,
   * that their border was deliberately not measured as a control edge: "the
   * control is the native radio or checkbox, drawn by the browser at full
   * `accent-[#f6efe2]`, and the row is the tap target around it. The edge is
   * a hint about where the row ends, not the thing that says a control is
   * there."
   *
   * The couple asked for two buttons, so the row IS the control now and its
   * edge is the only thing that says so. WCAG 1.4.11 holds that to 3:1, the
   * same floor the send button is held to, and for the same reason: an
   * invisible control is not a contrast problem, it is a missing control.
   */
  it("draws an edge on each answer that can be seen against the card", () => {
    const { container } = renderQuestion();

    for (const answer of container.querySelectorAll(".rsvp__answer")) {
      expect(
        contrastRatio(declaredColor(answer, "border"), card()),
      ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    }
  });

  /**
   * AND THE EDGE THEY CARRIED AS ROWS WOULD NOT HAVE BEEN — the second
   * permanent negative control on this screen.
   *
   * `border-[#f6efe2]/20` is what a choice row was drawn with for as long as
   * a browser-painted radio sat inside it saying "control". Against the same
   * card it measures 1.6:1, barely half the floor, so an assertion that only
   * ever ran against the pill's `/60` would pass just as happily if somebody
   * put the row's border back on a button.
   */
  it("would not have been, at the edge the rows carried until now", () => {
    expect(
      contrastRatio(over("rgba(246, 239, 226, 0.2)", card()), card()),
    ).toBeLessThan(WCAG_AA_NON_TEXT);
  });

  /**
   * AND THE DEADLINE IS OFF THE CARD NOW, WHICH IS A DIFFERENT SUM.
   *
   * "La línea de confirmen antes del… va por fuera de la tarjeta." It stands
   * on the bare photograph at the foot of the screen — the darkest ground on
   * the page, which is why it can be full cream with no card under it.
   */
  it("reads the deadline on the bare photograph below the card", () => {
    const { find } = renderQuestion();

    expect(find(".rsvp__panel").querySelector(".rsvp__deadline")).toBeNull();
    expect(
      contrastRatio(
        declaredColor(find(".rsvp__deadline"), "text"),
        BRIGHTEST_AT_THE_FOOT,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND THE REFUSAL CAME OFF THE CARD, ONTO A GROUND OF ITS OWN.
   *
   * The couple asked for two things that together moved it: the card matches
   * the gate's width, and it sits against the deadline with nothing between
   * them. So the 40 pixels this slot reserves are held above the card, in
   * the empty middle of the photograph — which is the brightest place on the
   * screen, not the darkest.
   *
   * It is therefore the one line on this screen that is painted onto a
   * ground only when it speaks. Measured in the state that has one, because
   * a slot holding nothing has no legibility to measure: the fixture renders
   * a refused answer and reads the sentence a household is actually looking
   * at.
   */
  it("reads a refusal on the ground it paints for itself", async () => {
    const { find } = await renderRefused();
    const feedback = find(".rsvp__feedback");

    expect(find(".rsvp__panel").contains(feedback)).toBe(false);
    expect(feedback.textContent).not.toBe("");
    expect(
      contrastRatio(
        declaredColor(feedback, "text"),
        over(declaredColor(feedback, "bg"), BRIGHTEST_UNDER_THE_CARD),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND UNBACKED IT WOULD NOT HAVE BEEN — the third permanent negative
   * control, and the reason the ground is conditional rather than absent.
   *
   * The deadline and the way back are full cream on bare photograph, both
   * measured and both comfortable, because they stand in the last tenth of
   * the screen where the bottom scrim is at full strength. Copying that
   * treatment up here, where the slot actually is, would put the most
   * important sentence on the screen on the brightest pixel in the frame at
   * 1.1:1.
   */
  it("would not read at all on the bare photograph up there", async () => {
    const { find } = await renderRefused();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__feedback"), "text"),
        BRIGHTEST_UNDER_THE_CARD,
      ),
    ).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });
});

describe("what the screen that asks who is coming measures", () => {
  function card(): string {
    const { find } = renderAttendees();

    return over(
      declaredColor(find(".rsvp__panel"), "bg"),
      BRIGHTEST_UNDER_THE_CARD,
    );
  }

  /*
    `.rsvp__seats` WAS MEASURED HERE AND IS NOT ANY MORE.

    "Ya seleccionaron las 3." — the couple deleted the line, so the `/80` U37
    lifted it to has nothing to read. `lib/domain/rsvp-copy.ts` records why
    the sentence went.
  */
  it("reads the heading — `¿Quiénes asisten?` — on the card", () => {
    const { find } = renderAttendees();

    expect(
      contrastRatio(
        declaredColor(find(".rsvp__attendees legend"), "text"),
        card(),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND A REFUSAL HERE CAME OFF THE CARD TOO, ONTO THE SAME GROUND.
   *
   * The band of empty card under the send button was the same 56 pixels the
   * question's card carried, and the couple named it on both screens. The
   * slot reserves its space below this card rather than above it — this card
   * is anchored to the top, so a refusal grows down into the photograph
   * rather than up — and it paints the card's ground when it speaks.
   *
   * HELD TO THE BRIGHTEST PIXEL EITHER CARD COVERS, which is harsher than
   * the band it actually sits in: where that band falls depends on how many
   * people the invitation names, so a fixture sampled from a household of
   * three would be a promise about one household size.
   */
  it("reads a refusal on the ground it paints for itself", async () => {
    const { find } = await renderAttendeesRefused();
    const feedback = find(".rsvp__feedback");

    expect(find(".rsvp__panel").contains(feedback)).toBe(false);
    expect(feedback.textContent).not.toBe("");
    expect(
      contrastRatio(
        declaredColor(feedback, "text"),
        over(declaredColor(feedback, "bg"), BRIGHTEST_UNDER_THE_CARD),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * INCLUDING THE QUIETEST THING ON THE SCREEN.
   *
   * "(niño o niña)" is set smaller and quieter than the name beside it,
   * because it is a note about a guest rather than the guest. It is still a
   * word a household reads to check the couple have their family right, so
   * it is held to the same floor as the name.
   */
  it("reads the note that marks a child", () => {
    const { container } = renderAttendees();
    const row = Array.from(
      container.querySelectorAll(".rsvp__attendees label"),
    ).find((label) => label.querySelector("span") !== null);

    expect(row, "no child is marked in this fixture").toBeDefined();

    const marker = row!.querySelector("span");

    expect(
      contrastRatio(
        declaredColor(marker!, "text"),
        over(declaredColor(row!, "bg"), card()),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /**
   * AND THE WAY BACK IS OFF THE CARD NOW, AT THE FOOT OF THE SCREEN.
   *
   * "Volver a la pregunta abajo." It was 70% cream while it sat inside the
   * card; on the bare photograph it is full cream, which is the same move
   * U35 made for the gate's own way out when that one turned out to be
   * standing on Luis's lit trouser leg. Here the ground is the darkest on the
   * page rather than the brightest, so full cream is generous rather than
   * necessary — and it is the floor either way.
   */
  it("reads the way back on the bare photograph", () => {
    const { find } = renderAttendees();

    expect(find(".rsvp__panel").querySelector(".rsvp__back")).toBeNull();
    expect(
      contrastRatio(
        declaredColor(find(".rsvp__back"), "text"),
        BRIGHTEST_AT_THE_FOOT,
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});

/**
 * WHETHER THE SEND BUTTON READS AS A BUTTON, WHICH IS A DIFFERENT THRESHOLD.
 *
 * WCAG holds the boundary of a control to 3:1 rather than 4.5:1, because an
 * invisible control is not a contrast problem — it is a missing control. This
 * is the one thing the screen exists to have pressed, and deepening the card
 * under it moved the sum: against the old `bg-black/25` the `/40` edge it
 * shipped with was comfortable, and against a `/70` card over the brightest
 * pixel it measured 2.4:1.
 *
 * `/60` rather than the accepted screen's `/50`, and the difference is the
 * ground rather than a preference: that control sits low on the photograph
 * where the bottom scrim is already working, and this one sits on a card
 * laid over the brightest thing in the frame.
 */
describe("whether the send button reads as a control", () => {
  function card(): string {
    const { find } = renderAttendees();

    return over(
      declaredColor(find(".rsvp__panel"), "bg"),
      BRIGHTEST_UNDER_THE_CARD,
    );
  }

  it("draws an edge that can be seen against the card it sits on", () => {
    const { find } = renderAttendees();

    expect(
      contrastRatio(
        declaredColor(find("button[type='submit']"), "border"),
        card(),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });

  it("reads its own label", () => {
    const { find } = renderAttendees();
    const button = find("button[type='submit']");

    expect(
      contrastRatio(
        declaredColor(button, "text"),
        over(declaredColor(button, "bg"), card()),
      ),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  /*
    THE MEMBER ROWS ARE DELIBERATELY NOT MEASURED AS CONTROL EDGES, AND THE
    TWO ANSWERS NO LONGER GET THAT EXEMPTION.

    A member row's border is `border-[#f6efe2]/20` and it does not clear 3:1
    against the row's own ground. That is not the same failure the gate's
    field was: there the input WAS the translucent bar, so an invisible edge
    left nothing to aim at. Here the control is the native checkbox, drawn by
    the browser at full `accent-[#f6efe2]`, and the row is the tap target
    around it. The edge is a hint about where the row ends, not the thing
    that says a control is there.

    The two ANSWERS used to be covered by that same paragraph and are not
    any more: the couple asked for buttons, so there is no native control
    inside them and the edge is the whole of the affordance. They are
    measured at 3:1 above, beside the question they belong to.

    Written down rather than left out, because "this file measures every edge
    except one" is exactly the kind of gap that reads as an oversight.
  */
});
