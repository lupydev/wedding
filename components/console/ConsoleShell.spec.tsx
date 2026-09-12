import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConsoleShell } from "./ConsoleShell";

/**
 * The console's frame: a header, a navigation slot, and the page.
 *
 * Props only and layout only. It fetches nothing and decides nothing about the
 * session — the `(authenticated)` layout above it already does both, and a shell
 * that re-asked would be a second authorization surface.
 */

describe("ConsoleShell", () => {
  it("renders the page it wraps", () => {
    render(
      <ConsoleShell nav={<nav aria-label="nav" />} header={<p>cabecera</p>}>
        <p>contenido de la página</p>
      </ConsoleShell>,
    );

    expect(screen.getByText("contenido de la página")).toBeInTheDocument();
  });

  it("renders the header and the navigation it was handed", () => {
    render(
      <ConsoleShell
        nav={<nav aria-label="navegación" />}
        header={<p>cabecera</p>}
      >
        contenido
      </ConsoleShell>,
    );

    expect(screen.getByText("cabecera")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "navegación" }),
    ).toBeInTheDocument();
  });

  it("keeps the content clear of the bottom bar by exactly the bar's height", () => {
    const { container } = render(
      <ConsoleShell nav={<nav aria-label="nav" />} header={null}>
        contenido
      </ConsoleShell>,
    );
    const content = container.querySelector("[data-slot='console-content']");

    expect(content).not.toBeNull();
    // The same variable the bar sets its height from. Not 56px, not 72px, not a
    // guess with the inset added by hand.
    expect((content as HTMLElement).style.paddingBottom).toBe(
      "var(--console-tabbar-height)",
    );
  });

  it("declares itself the graphite surface", () => {
    // The document default is paper, so the console has to opt IN. A shell that
    // forgot would render the operator panel on a cream wedding page.
    const { container } = render(
      <ConsoleShell nav={<nav aria-label="nav" />} header={null}>
        contenido
      </ConsoleShell>,
    );

    expect(container.querySelector("[data-slot='console-shell']")).toHaveClass(
      "console-surface",
    );
  });

  it("keeps any class hook the layout hands it, alongside the surface class", () => {
    // `console` is the hook the pre-styling layout carried. Dropping a hook the
    // rest of the suite might select on is a behaviour change dressed as styling.
    const { container } = render(
      <ConsoleShell
        className="console"
        nav={<nav aria-label="nav" />}
        header={null}
      >
        contenido
      </ConsoleShell>,
    );
    const shell = container.querySelector("[data-slot='console-shell']");

    expect(shell).toHaveClass("console");
    expect(shell).toHaveClass("console-surface");
  });

  it("offers a skip link before anything else, for a keyboard operator", () => {
    render(
      <ConsoleShell nav={<nav aria-label="nav" />} header={null}>
        contenido
      </ConsoleShell>,
    );
    const skip = screen.getByRole("link", { name: /Saltar al contenido/i });

    expect(skip).toHaveAttribute("href", "#console-content");
  });
});
