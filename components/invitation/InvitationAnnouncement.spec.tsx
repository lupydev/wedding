import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COUPLE_NAMES } from "@/lib/domain/wedding-day";

import { InvitationAnnouncement } from "./InvitationAnnouncement";

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
});
