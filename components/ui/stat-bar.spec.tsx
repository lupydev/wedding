import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stat } from "./stat";
import { STAT_BAR_MIN_TRACK_PX, StatBar, statBarTemplate } from "./stat-bar";

/**
 * The row of figures, laid out with `grid` and never with `flex-wrap`.
 *
 * `flex-wrap` strands the last item on its own line with a hole beside it — five
 * figures on a phone become three and then two, and the two sit left with half a
 * row of empty graphite to their right. `repeat(auto-fit, minmax(88px, 1fr))`
 * distributes the remainder across the tracks instead, so every row is full.
 */

describe("statBarTemplate", () => {
  it("uses auto-fit with a minimum track, not a fixed column count", () => {
    expect(statBarTemplate()).toBe(
      `repeat(auto-fit, minmax(${STAT_BAR_MIN_TRACK_PX}px, 1fr))`,
    );
  });

  it("keeps the minimum track wide enough for a four-digit figure and its label", () => {
    expect(STAT_BAR_MIN_TRACK_PX).toBeGreaterThanOrEqual(88);
  });
});

describe("StatBar", () => {
  it("lays its figures out on a grid that fills every row", () => {
    const { container } = render(
      <StatBar>
        <Stat label="Confirmadas" value="4" />
      </StatBar>,
    );
    const bar = container.querySelector("dl");

    expect(bar?.style.gridTemplateColumns).toBe(statBarTemplate());
  });

  it("renders every figure it was given", () => {
    render(
      <StatBar>
        <Stat label="Confirmadas" value="4" />
        <Stat label="No asisten" value="1" />
        <Stat label="Sin respuesta" value="7" />
      </StatBar>,
    );

    expect(screen.getByText("Confirmadas")).toBeInTheDocument();
    expect(screen.getByText("No asisten")).toBeInTheDocument();
    expect(screen.getByText("Sin respuesta")).toBeInTheDocument();
  });

  it("is a description list, so the label/figure pairing survives without ARIA", () => {
    const { container } = render(
      <StatBar>
        <Stat label="Confirmadas" value="4" />
        <Stat label="No asisten" value="1" />
      </StatBar>,
    );

    expect(container.querySelectorAll("dl")).toHaveLength(1);
    expect(container.querySelectorAll("dt")).toHaveLength(2);
  });
});
