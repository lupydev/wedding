import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConsoleSummary } from "@/lib/domain/console-list";

import { ConsoleDashboard } from "./ConsoleDashboard";

const SUMMARY: ConsoleSummary = {
  total: 30,
  attending: 11,
  declined: 3,
  pending: 16,
  seats: 84,
  seatsConfirmed: 37,
  byDispatchState: {
    not_dispatched: 8,
    link_opened: 4,
    marked_sent: 15,
    marked_failed: 1,
    resent: 2,
  },
  operatorAssertedSends: 17,
  contradictedAnswers: 0,
};

/** The figure rendered under a given label. */
function figureFor(label: string): string {
  const term = screen.getByText(label);

  return term.nextElementSibling?.textContent ?? "";
}

/**
 * The four numbers the couple actually run the wedding on.
 *
 * This replaced two `ProgressSummary` blocks that rendered ten sentences each —
 * twenty in total, over two overlapping populations, so "Confirmadas" appeared
 * twice on one screen with different denominators. Everything here comes from
 * `summarizeConsoleList`, which already computed all of it.
 */
describe("ConsoleDashboard", () => {
  /**
   * TWO FIGURES, AND THERE WERE FOUR.
   *
   * The couple asked for "invitaciones enviadas y asistentes". The two extra
   * tiles were never requested and are what made the row unreadable: beside
   * "Invitaciones enviadas: 0 de 3" sat "Sin enviar: 2 de 3", and the missing
   * third had merely had its link opened. True, and no business being a puzzle
   * on the first screen a non-technical operator meets.
   */
  it("shows the two figures that were asked for, and nothing else", () => {
    render(<ConsoleDashboard summary={SUMMARY} />);

    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Invitaciones enviadas",
      "Personas confirmadas",
    ]);
  });

  /**
   * SENT MEANS THE OPERATOR SAID SO, AND AN OPENED LINK IS NOT A SEND.
   *
   * `operatorAssertedSends` counts `marked_sent` and `resent` only;
   * `dispatch-state.ts` calls it "the ONLY predicate a 'has been invited'
   * filter may use". This fixture has four households whose link was merely
   * opened, so a tile that added `link_opened` would read 21 instead of 17 —
   * and would tell the couple four families were invited who never were.
   */
  it("counts a send only where the operator asserted one", () => {
    render(<ConsoleDashboard summary={SUMMARY} />);

    expect(figureFor("Invitaciones enviadas")).toBe("17 de 30");
  });

  /**
   * People, not households.
   *
   * `seatsConfirmed` is a true headcount: migration 0007 enforces
   * `seats_confirmed = cardinality(attendee_guest_ids)` in the database, so it
   * cannot drift into an allowance. `seats` is every member of every
   * invitation — the people invited.
   */
  it("counts attendees as people out of people", () => {
    render(<ConsoleDashboard summary={SUMMARY} />);

    expect(figureFor("Personas confirmadas")).toBe("37 de 84");
  });

  /**
   * NO FIGURE WITHOUT ITS POPULATION, WHICH IS THIS CONSOLE'S OLDEST RULE.
   *
   * `ProgressSummary` enforced it by rendering whole sentences and refusing to
   * render a bare count — its own comment names the defect it was guarding
   * against, a headline reading "42 confirmadas" out of a population nobody
   * could see. A tile is a smaller shape, so the rule is asserted directly
   * instead: every figure says what it is out of.
   */
  it("never shows a figure without saying what it is out of", () => {
    render(<ConsoleDashboard summary={SUMMARY} />);

    for (const value of screen.getAllByRole("definition")) {
      expect(value.textContent).toMatch(/ de \d+$/);
    }
  });

  it("survives an event with nothing in it yet", () => {
    render(
      <ConsoleDashboard
        summary={{
          ...SUMMARY,
          total: 0,
          seats: 0,
          seatsConfirmed: 0,
          pending: 0,
          operatorAssertedSends: 0,
          byDispatchState: { ...SUMMARY.byDispatchState, not_dispatched: 0 },
        }}
      />,
    );

    expect(figureFor("Invitaciones enviadas")).toBe("0 de 0");
  });
});
