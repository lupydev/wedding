import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PANEL_HINT_MAX_CH, Panel, panelHintStyle } from "./panel";

/**
 * The panel that cannot exist without a title.
 *
 * A reference console had boxes whose purpose was only discoverable by using
 * them. Two operators will use this console twice in their lives — once to dry
 * run, once for real — and they will not remember what any unlabelled box does.
 * So `title` is a REQUIRED prop, not an optional one with a sensible default:
 * a panel with nothing to say about itself should not compile.
 *
 * The hint is capped at roughly 48 characters per line because a hint that runs
 * the full width of a desktop panel is a paragraph, and nobody reads a paragraph
 * they did not ask for.
 */

describe("Panel", () => {
  it("renders its title as a heading, so the page has an outline", () => {
    render(<Panel title="Revisión previa al envío">contenido</Panel>);

    expect(
      screen.getByRole("heading", { name: "Revisión previa al envío" }),
    ).toBeInTheDocument();
  });

  it("renders the children it was given", () => {
    render(
      <Panel title="Tus invitaciones">
        <p>Tres invitaciones sin respuesta</p>
      </Panel>,
    );

    expect(
      screen.getByText("Tres invitaciones sin respuesta"),
    ).toBeInTheDocument();
  });

  it("renders the one-line hint when there is one", () => {
    render(
      <Panel
        title="Dispositivo"
        hint="Esta respuesta se guarda solo en este teléfono."
      >
        contenido
      </Panel>,
    );

    expect(
      screen.getByText("Esta respuesta se guarda solo en este teléfono."),
    ).toBeInTheDocument();
  });

  it("caps the hint's measure, so it stays a hint and not a paragraph", () => {
    render(
      <Panel title="Dispositivo" hint="Una explicación breve.">
        contenido
      </Panel>,
    );

    expect(screen.getByText("Una explicación breve.").style.maxWidth).toBe(
      `${PANEL_HINT_MAX_CH}ch`,
    );
  });

  it("renders no hint element at all when none was given", () => {
    const { container } = render(<Panel title="Sin pista">contenido</Panel>);

    expect(container.querySelector("[data-slot='panel-hint']")).toBeNull();
  });

  it("places the title at the requested heading level", () => {
    // The console's own page already owns `h1` and `h2`. A panel that always
    // rendered `h2` would produce an outline with two competing levels.
    render(
      <Panel title="Resumen" headingLevel={3}>
        contenido
      </Panel>,
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Resumen",
    );
  });

  it("defaults to h2 when no level is requested", () => {
    render(<Panel title="Resumen">contenido</Panel>);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Resumen",
    );
  });
});

describe("panelHintStyle", () => {
  it("expresses the cap in ch units, which track the font rather than the viewport", () => {
    // 48ch is "about 48 characters of THIS typeface at THIS size". A pixel cap
    // would be 48 characters at one size and 30 at another.
    expect(panelHintStyle()).toEqual({ maxWidth: "48ch" });
  });
});
