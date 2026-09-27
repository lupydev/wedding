import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { rsvpClosedNote } from "@/lib/domain/rsvp-copy";
import { WEDDING_DRESS_CODE } from "@/lib/domain/wedding-day";

import { RsvpClosed } from "./RsvpClosed";

/**
 * WHAT A GUEST HAS LEFT ONCE THE ANSWERS ARE CLOSED.
 *
 * This file used to assert two things: that the closed message was on screen,
 * and that there was nothing to fill in. Both were true and both were beside
 * the point — the screen they described showed a household NOTHING ELSE. From
 * the 21st of November an accepted household lost the venue, the map, the
 * hour and the dress code; a declined one lost the stream link and the
 * calendar. The deadline blanked the invitation.
 *
 * So the assertions here are now about what SURVIVES, one describe per
 * ending, and the "nothing to answer with" rule is kept as the thing that
 * must remain true underneath them. `RsvpClosed` records the couple's
 * decision and which part of it was mine.
 */

const CEREMONY = {
  streamUrl: "https://meet.google.com/abc-defg-hij",
  coupleNames: "Luis & Michell",
};
const VENUE = { name: "Hacienda La Ñapa" };

function renderClosed(
  answer: { attending: boolean } | null,
  memberCount = 3,
  greetingName = "Familia Aguirre",
) {
  return render(
    <RsvpClosed
      answer={answer}
      ceremony={CEREMONY}
      venue={VENUE}
      memberCount={memberCount}
      greetingName={greetingName}
    />,
  );
}

const joinLink = () =>
  screen.queryByRole("link", { name: /Entrar a la transmisión/ });
const calendarLink = () =>
  screen.queryByRole("link", { name: /Agregar a Google Calendar/ });
const mapLink = () => screen.queryByRole("link", { name: /Cómo llegar/ });

describe("a household that accepted before the deadline", () => {
  /**
   * EVERYTHING THEY NEED IN ORDER TO GET THERE, WHICH IS THE WHOLE FIX.
   *
   * These are the seven days when the venue and the hour matter most, and
   * they are exactly the days the old screen withheld them.
   */
  it("keeps the venue, the map, the hour and the dress code", () => {
    renderClosed({ attending: true });

    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
    expect(mapLink()).not.toBeNull();
    expect(screen.getByText(/5:00 p\. m\./)).toBeInTheDocument();
    expect(screen.getByText(WEDDING_DRESS_CODE)).toBeInTheDocument();
  });

  it("greets them the way the accepted screen does", () => {
    renderClosed({ attending: true });

    expect(
      screen.getByText("Los esperamos, Familia Aguirre"),
    ).toBeInTheDocument();
    expect(screen.getByText(rsvpClosedNote("accepted", 3))).toBeInTheDocument();
  });
});

describe("a household that declined before the deadline", () => {
  it("keeps the stream and the calendar", () => {
    renderClosed({ attending: false });

    expect(joinLink()).not.toBeNull();
    expect(calendarLink()).not.toBeNull();
  });

  /**
   * AND STILL NOT THE VENUE, WHICH IS THE RULE THE WHOLE FLOW IS BUILT ON.
   *
   * A household that said no is not told where the wedding is, before the
   * deadline or after it. The closed screen is the easiest place to get this
   * wrong, because it is composed from the same pieces as the accepted one.
   */
  it("is told nothing about the venue", () => {
    renderClosed({ attending: false });

    expect(screen.queryByText(VENUE.name)).toBeNull();
    expect(mapLink()).toBeNull();
  });

  it("is told they will be missed, not greeted", () => {
    renderClosed({ attending: false });

    expect(
      screen.getByText("Los vamos a extrañar, Familia Aguirre"),
    ).toBeInTheDocument();
    expect(screen.getByText(rsvpClosedNote("declined", 3))).toBeInTheDocument();
  });
});

/**
 * AND THE ENDING NOBODY ASKED FOR, WHICH IS FLAGGED RATHER THAN BURIED.
 *
 * The couple decided the first two endings. This one is a decision taken on
 * their behalf and written down for them to overrule: a household that never
 * answered can still watch, so they are offered the stream — but the venue is
 * gated behind saying you are coming, and a deadline passing is not a
 * confirmation.
 */
describe("a household that never answered", () => {
  it("is offered the stream and the calendar", () => {
    renderClosed(null);

    expect(joinLink()).not.toBeNull();
    expect(calendarLink()).not.toBeNull();
  });

  it("is NOT given the venue, because a closed deadline is not a yes", () => {
    renderClosed(null);

    expect(screen.queryByText(VENUE.name)).toBeNull();
    expect(mapLink()).toBeNull();
  });

  it("is still greeted, because nothing has been said to them yet", () => {
    renderClosed(null);

    expect(screen.getByText("¡Hola, Familia Aguirre!")).toBeInTheDocument();
    expect(
      screen.getByText(rsvpClosedNote("unanswered", 3)),
    ).toBeInTheDocument();
  });

  it("speaks to one person in the singular", () => {
    renderClosed(null, 1, "Camila");

    expect(
      screen.getByText(rsvpClosedNote("unanswered", 1)),
    ).toBeInTheDocument();
  });
});

/**
 * AND UNDERNEATH ALL THREE, THE RULE THIS SCREEN HAS ALWAYS HAD.
 *
 * A form rendered after the deadline is a form somebody fills in, and a
 * submission quietly discarded leaves a household believing they answered.
 * Adding real content to this screen is exactly the change that could bring
 * one back by accident, so the assertion outlives the rewrite.
 */
describe("what no ending offers", () => {
  it.each([
    ["accepted", { attending: true }],
    ["declined", { attending: false }],
    ["unanswered", null],
  ])("gives %s nothing to answer with", (_state, answer) => {
    const { container } = renderClosed(answer);

    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    // No way back either: the answer is frozen, so a control that offered to
    // change it would be a control that always fails.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /Volver a responder/ }),
    ).toBeNull();
  });
});
