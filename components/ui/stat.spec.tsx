import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stat, statFigureFontSize } from "./stat";

/**
 * One figure, at one of two sizes.
 *
 * Five figures at the same size are a LIST, not a summary. The number that
 * represents today's work — how many invitations still have to go out — is large;
 * the four that provide context are not. A summary where everything is emphasised
 * has emphasised nothing.
 *
 * Figures are set in tabular numerals because a column of proportional digits
 * visibly jitters as counts change, and these counts change while an operator
 * watches them.
 */

describe("statFigureFontSize", () => {
  it("sets the emphasised figure substantially larger than the rest", () => {
    const emphasised = Number.parseFloat(statFigureFontSize("primary"));
    const ordinary = Number.parseFloat(statFigureFontSize("secondary"));

    expect(emphasised).toBeGreaterThan(ordinary * 1.5);
  });

  it("returns rem, so the figures scale with the reader's own text size", () => {
    expect(statFigureFontSize("primary")).toMatch(/rem$/);
    expect(statFigureFontSize("secondary")).toMatch(/rem$/);
  });
});

describe("Stat", () => {
  it("shows the label and the figure it belongs to", () => {
    render(<Stat label="Sin respuesta" value="12" />);

    expect(screen.getByText("Sin respuesta")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("sets figures in tabular numerals, so a changing count does not jitter", () => {
    render(<Stat label="Sin respuesta" value="12" />);

    expect(screen.getByText("12").style.fontVariantNumeric).toBe(
      "tabular-nums",
    );
  });

  it("renders an emphasised figure larger than an ordinary one", () => {
    const { unmount } = render(
      <Stat label="Pendientes" value="12" emphasis="primary" />,
    );
    const emphasised = screen.getByText("12").style.fontSize;

    unmount();
    render(<Stat label="Pendientes" value="12" />);

    expect(Number.parseFloat(emphasised)).toBeGreaterThan(
      Number.parseFloat(screen.getByText("12").style.fontSize),
    );
  });

  it("defaults to the ordinary size, so emphasis has to be asked for", () => {
    render(<Stat label="Confirmadas" value="4" />);

    expect(screen.getByText("4").style.fontSize).toBe(
      statFigureFontSize("secondary"),
    );
  });

  it("associates the figure with its label for a screen reader", () => {
    // A number read out with no label is noise. `<dt>`/`<dd>` is the pairing the
    // platform already has, so it needs no ARIA.
    const { container } = render(<Stat label="Confirmadas" value="4" />);

    expect(container.querySelector("dt")).toHaveTextContent("Confirmadas");
    expect(container.querySelector("dd")).toHaveTextContent("4");
  });

  it("shows the population a figure was taken over when one is given", () => {
    render(<Stat label="Confirmadas" value="4" hint="de 12 invitaciones" />);

    expect(screen.getByText("de 12 invitaciones")).toBeInTheDocument();
  });
});
