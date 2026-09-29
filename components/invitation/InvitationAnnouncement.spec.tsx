import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COUPLE_NAMES } from "@/lib/domain/wedding-day";

import {
  HOUSEHOLD_THAT_CROWDS_THE_LIST,
  InvitationAnnouncement,
  attendeesScreenFitsCountdown,
} from "./InvitationAnnouncement";

/**
 * The announcement, which two surfaces have to render identically.
 *
 * It was three lines inside `InvitationBody` until the invitation became a
 * sequence of screens. It belongs to exactly one of them — the question — and
 * which screen is showing is client state, owned by `RsvpAnswer`. So the public
 * route hands this block to the form as a slot, and `InvitationBody` renders it
 * for the operator preview, which never renders the form at all.
 *
 * Two places composing the same block out of `SaveTheDate` plus a paragraph is
 * how the landing and the gate started drifting before `SaveTheDate` absorbed
 * the script line. One component, imported twice, cannot.
 */
describe("InvitationAnnouncement", () => {
  it("makes the announcement the landing and the gate make", () => {
    render(<InvitationAnnouncement coupleNames="Ana y Bruno" />);

    expect(screen.getByText("Nos casamos")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ana y Bruno" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-the-date-when")).toBeInTheDocument();
    // The counter is the one part of the announcement that is not copy, and
    // therefore the part most easily left out of a second rendering of it.
    expect(screen.getByTestId("countdown-figures")).toBeInTheDocument();
  });

  /**
   * THE COUPLE'S NAMES COME FROM THE `ceremony` ROW, NOT FROM THE CONSTANT.
   *
   * `SaveTheDate` defaults to `COUPLE_NAMES`, which is right for the landing
   * and the gate: neither has anything else to read. The invitation does — a
   * value an operator can correct with an UPDATE — and rendering the constant
   * beside it would put two spellings of the same names on one page the first
   * time somebody fixed one of them.
   */
  it("prefers the row's spelling over the module's", () => {
    render(<InvitationAnnouncement coupleNames="Camila y Darío" />);

    expect(screen.getByText("Camila y Darío")).toBeInTheDocument();
    expect(screen.queryByText(COUPLE_NAMES)).not.toBeInTheDocument();
  });

  it("renders an unfinished value verbatim rather than hiding it", () => {
    // An unfinished value must stay visibly unfinished: prettifying or hiding
    // it turns an obviously incomplete invitation into a plausible wrong one.
    const { container } = render(
      <InvitationAnnouncement coupleNames="{{COUPLE_NAMES}}" />,
    );

    expect(container.textContent).toContain("{{COUPLE_NAMES}}");
  });

  /**
   * THE LOCATOR IS PART OF THE CONTRACT.
   *
   * `e2e/console-preview.spec.ts` uses it to compare what the operator
   * approves against what a guest reads. The two documents are no longer
   * identical end to end — the guest's is a stepped screen and the preview is
   * not — so this block is what the comparison is anchored to.
   */
  it("carries the class the drift guard compares", () => {
    const { container } = render(
      <InvitationAnnouncement coupleNames="Ana y Bruno" />,
    );

    expect(container.querySelector(".invitation__announcement")).not.toBeNull();
  });

  /**
   * AND IT CAN BE MADE SHORTER FOR THE ONE SCREEN THAT CANNOT AFFORD IT ALL.
   *
   * The couple opened the list of who is coming on a real iPhone with a
   * three-person invitation and `Enviar respuesta` was behind the browser
   * chrome. Measured on the shipped build: 735 pixels on a 664-pixel iPhone
   * 14, and the counter with its gap is 74 of them, the hairline with its gap
   * another 25.
   *
   * The shorter block keeps everything that STATES SOMETHING — "Nos casamos",
   * the couple's names, the day — and drops the two that decorate.
   */
  it("can be made shorter, keeping every fact and dropping the counter", () => {
    const { container } = render(
      <InvitationAnnouncement
        coupleNames="Ana y Bruno"
        showCountdown={false}
      />,
    );

    expect(screen.getByText("Nos casamos")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ana y Bruno" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-the-date-when")).toBeInTheDocument();

    expect(screen.queryByTestId("countdown-figures")).not.toBeInTheDocument();
    expect(container.querySelector("span[aria-hidden='true']")).toBeNull();
  });
});

/**
 * WHICH HOUSEHOLDS GET THE SHORTER BLOCK, IN ONE NAMED PLACE.
 *
 * "Sacalos solo cuando la invitación es de 3 personas, porque con dos
 * personas sí se ve bien." Two numbers decide it and both were measured on
 * the shipped build, iPhone 14, the screen that asks who is coming:
 *
 *  - a household of TWO is 681 pixels — 17 over, and all 17 are the form's
 *    own bottom padding below "Volver a la pregunta". Nothing a guest can
 *    read or press is off the screen, which is why the couple say it looks
 *    fine, and they chose to keep the counter there knowing the page can be
 *    nudged 17 pixels.
 *  - a household of THREE is 735 — 71 over, and the send button ends at 663
 *    of a 664-pixel viewport, which on a real phone is behind the browser
 *    chrome.
 *
 * WHY `>=` AND NOT `=== 3`, GIVEN THREE IS NOW THE CEILING. "Las invitaciones
 * a la final van a ser 3 personas como máximo" — but nothing in the schema,
 * the console or the importer enforces that (see the canary in
 * `e2e/invitation-one-screen.spec.ts`). An equality would hand the FULL
 * announcement back to a four-person household, which is the one size that
 * needs the space most: 789 pixels whole against 690 shortened. A threshold
 * costs nothing and fails in the safe direction.
 */
describe("who is offered the shorter announcement", () => {
  it("keeps the counter for the sizes that have room for it", () => {
    expect(attendeesScreenFitsCountdown(1)).toBe(true);
    expect(attendeesScreenFitsCountdown(2)).toBe(true);
  });

  it("takes it away from three, which is where it stopped fitting", () => {
    expect(attendeesScreenFitsCountdown(3)).toBe(false);
    expect(HOUSEHOLD_THAT_CROWDS_THE_LIST).toBe(3);
  });

  /**
   * AND FROM ANYTHING LARGER, WHICH IS THE CASE NOTHING PREVENTS.
   *
   * Three is the couple's statement about their own list, not a rule the
   * software holds them to.
   */
  it("takes it away from a household above the ceiling too", () => {
    expect(attendeesScreenFitsCountdown(4)).toBe(false);
    expect(attendeesScreenFitsCountdown(5)).toBe(false);
  });
});
