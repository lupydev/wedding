import { act, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Countdown } from "./Countdown";

const TARGET = new Date("2026-11-28T05:00:00.000Z");

/** An instant the given number of whole seconds before `TARGET`. */
function secondsBefore(seconds: number): number {
  return TARGET.getTime() - seconds * 1000;
}

/** The four figures in the order they are rendered. */
function figures(): string[] {
  return screen
    .getAllByTestId("countdown-unit")
    .map(
      (unit) => within(unit).getByTestId("countdown-figure").textContent ?? "",
    );
}

/** The four labels in the order they are rendered. */
function labels(): string[] {
  return screen
    .getAllByTestId("countdown-unit")
    .map(
      (unit) => within(unit).getByTestId("countdown-label").textContent ?? "",
    );
}

describe("Countdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * THE SERVER MUST NOT SEND A FIGURE, AND THIS IS THE TEST THAT SAYS SO.
   *
   * `/` is statically generated, so anything this component renders on the
   * server is computed ONCE, at build time, and then served from a CDN for
   * weeks. A server-rendered "faltan 434 días" is therefore not merely stale —
   * it is a number React would have to replace during hydration, which is a
   * text mismatch and a visible flicker on every single visit.
   *
   * `renderToStaticMarkup` runs no effects, which is exactly what a static
   * build does. The assertion is the absence of a digit in the TEXT, not the
   * presence of a particular placeholder, so the skeleton's styling can change
   * freely. Tags are stripped first: Tailwind class names are full of digits
   * (`gap-3`, `text-3xl`) and matching against raw markup would fail on styling
   * that no reader ever sees.
   */
  it("renders no figure at all before it has mounted", () => {
    const markup = renderToStaticMarkup(<Countdown target={TARGET} />);
    const text = markup.replace(/<[^>]*>/g, "");

    expect(text).not.toMatch(/\d/);
  });

  it("fills in the remaining time once mounted", () => {
    vi.useFakeTimers({
      now: secondsBefore(3 * 86_400 + 2 * 3_600 + 5 * 60 + 9),
    });

    render(<Countdown target={TARGET} />);

    expect(figures()).toEqual(["3", "2", "5", "9"]);
    expect(labels()).toEqual(["días", "horas", "minutos", "segundos"]);
  });

  it("counts down once per second", () => {
    vi.useFakeTimers({ now: secondsBefore(10) });

    render(<Countdown target={TARGET} />);
    expect(figures()).toEqual(["0", "0", "0", "10"]);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(figures()).toEqual(["0", "0", "0", "7"]);
  });

  /**
   * "1 días" is the tell of a countdown nobody proofread.
   *
   * Every unit is checked in the same case, because a table with one singular
   * form missing looks correct in review and wrong exactly once a year.
   */
  it("uses the singular label when a unit reads one", () => {
    vi.useFakeTimers({ now: secondsBefore(86_400 + 3_600 + 60 + 1) });

    render(<Countdown target={TARGET} />);

    expect(figures()).toEqual(["1", "1", "1", "1"]);
    expect(labels()).toEqual(["día", "hora", "minuto", "segundo"]);
  });

  /**
   * A screen reader must not be handed a per-second live region.
   *
   * The figures change every second; announced, they would talk over
   * everything else on the page continuously. So they are hidden, and the count
   * is carried instead by one quiet sentence that changes at most once a day.
   */
  it("hides the ticking figures from assistive technology", () => {
    vi.useFakeTimers({ now: secondsBefore(86_400) });

    render(<Countdown target={TARGET} />);

    expect(screen.getByTestId("countdown-figures")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("countdown-figures")).not.toHaveAttribute(
      "aria-live",
    );
  });

  it("states the count in days for a screen reader", () => {
    vi.useFakeTimers({ now: secondsBefore(3 * 86_400) });

    render(<Countdown target={TARGET} />);

    expect(screen.getByTestId("countdown-summary")).toHaveTextContent(
      "Faltan 3 días para la boda.",
    );
  });

  describe("on the day itself", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: TARGET.getTime() + 60_000 });
      render(<Countdown target={TARGET} />);
    });

    /**
     * The wedding day is a different sentence, not a row of zeroes.
     *
     * A guest who opens this page during the reception is at the wedding. Four
     * zeroes would read as a clock that has stopped.
     */
    it("says the day has come instead of showing zeroes", () => {
      expect(screen.queryAllByTestId("countdown-unit")).toHaveLength(0);
      expect(screen.getByTestId("countdown-arrived")).toHaveTextContent(
        "¡Hoy nos casamos!",
      );
    });

    it("says the same thing to a screen reader", () => {
      expect(screen.getByTestId("countdown-summary")).toHaveTextContent(
        "Hoy nos casamos.",
      );
    });
  });

  /**
   * The interval is released when the page is left.
   *
   * Without the cleanup the callback keeps firing against an unmounted tree —
   * a warning in development, a leak in a long-lived tab, and one more timer
   * per client-side navigation back to the landing page.
   */
  it("stops ticking after unmount", () => {
    vi.useFakeTimers({ now: secondsBefore(10) });
    const clearInterval = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = render(<Countdown target={TARGET} />);
    unmount();

    expect(clearInterval).toHaveBeenCalled();
    clearInterval.mockRestore();
  });
});
