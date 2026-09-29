import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COUPLE_NAMES,
  WEDDING_ISO_DAY,
  formatWeddingDate,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";

import { SaveTheDate } from "./SaveTheDate";

/**
 * The text of the landing page.
 *
 * Asserted against the domain constants rather than against literals. The
 * couple's names and their date are going to be corrected at least once before
 * this ships, and a spec that repeated them would fail for the one reason a
 * spec must never fail: the truth changed and the test was still holding the
 * old copy.
 */
describe("SaveTheDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the couple as its heading", () => {
    render(<SaveTheDate />);

    expect(
      screen.getByRole("heading", { level: 1, name: COUPLE_NAMES }),
    ).toBeInTheDocument();
  });

  /**
   * The weekday and the date are one sentence, not two fragments.
   *
   * Rendered as separate elements they would be read by a screen reader as
   * "sábado" … "28 de noviembre de 2026", which is fine, and laid out by CSS as
   * two lines, which is also fine. What matters is that the `<time>` carries
   * them together so the whole line is one date rather than a decorative word
   * beside one.
   */
  it("gives the day in prose and in a machine-readable form", () => {
    render(<SaveTheDate />);

    const when = screen.getByTestId("save-the-date-when");

    expect(when.tagName).toBe("TIME");
    expect(when).toHaveAttribute("dateTime", WEDDING_ISO_DAY);
    expect(when).toHaveTextContent(formatWeddingWeekday());
    expect(when).toHaveTextContent(formatWeddingDate());
  });

  /**
   * `2026-11-28`, and nothing that merely looks like it.
   *
   * The machine date is what a calendar, a crawler and an "add to calendar"
   * feature all read. A `dateTime` that disagrees with the prose beside it is
   * the one error on this page nobody would ever see by looking at it.
   */
  it("agrees with itself about which day it is", () => {
    render(<SaveTheDate />);

    expect(screen.getByTestId("save-the-date-when")).toHaveAttribute(
      "dateTime",
      "2026-11-28",
    );
  });

  it("carries the countdown", () => {
    vi.useFakeTimers({ now: new Date("2026-11-25T05:00:00.000Z") });

    render(<SaveTheDate />);

    expect(screen.getByTestId("countdown-summary")).toHaveTextContent(
      "Faltan 3 días para la boda.",
    );
  });

  /**
   * AND IT CAN BE ASKED TO LEAVE, FOR ONE SCREEN THAT HAS NO ROOM FOR IT.
   *
   * The couple read the list of who is coming on a real iPhone with a
   * three-person invitation and found `Enviar respuesta` behind the browser
   * chrome. Measured: that screen is 735 pixels tall on a 664-pixel iPhone
   * 14, and the countdown with its gap is 74 of them. "Sacalos solo cuando la
   * invitación es de 3 personas, porque con dos personas sí se ve bien."
   *
   * THE HAIRLINE GOES WITH IT, AND THAT IS ONE DECISION RATHER THAN TWO. The
   * rule exists to close the date line and introduce the counter; with no
   * counter under it, it is a divider separating something from nothing. The
   * couple asked for both, and the block has no state in which one makes
   * sense without the other — so this is one prop, not a pair.
   */
  it("can be asked for the announcement without its counter", () => {
    vi.useFakeTimers({ now: new Date("2026-11-25T05:00:00.000Z") });

    const { container } = render(<SaveTheDate showCountdown={false} />);

    expect(screen.queryByTestId("countdown-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("countdown-figures")).not.toBeInTheDocument();
    expect(container.querySelector("span[aria-hidden='true']")).toBeNull();
  });

  /**
   * AND THE DEFAULT IS THE WHOLE BLOCK, WHICH IS THE CASE FOUR SURFACES USE.
   *
   * `StreamDetails` is the cautionary tale this assertion exists against: it
   * grew `showDate` and `showTime` props defaulting to TRUE and every caller
   * passed false, so the default branch was dead code nobody was rendering.
   * Here it is the other way round — the landing, the gate, the question and
   * the operator preview all take the default — and only one screen asks for
   * less.
   */
  it("keeps the counter and the rule when nobody asks otherwise", () => {
    vi.useFakeTimers({ now: new Date("2026-11-25T05:00:00.000Z") });

    const { container } = render(<SaveTheDate />);

    expect(screen.getByTestId("countdown-summary")).toBeInTheDocument();
    expect(container.querySelector("span[aria-hidden='true']")).not.toBeNull();
  });
});
