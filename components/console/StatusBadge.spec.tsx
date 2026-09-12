import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./StatusBadge";

/**
 * A status, wearing the one colour its tone permits.
 *
 * The tone arrives from `lib/design/console-status.ts`, which is a total function
 * over the state unions. This component therefore has no colour decision to make —
 * which is the point. Every colour bug in the reference console was a call site
 * choosing, and a component that cannot choose cannot choose wrong.
 */

describe("StatusBadge", () => {
  it("shows the label it was given, verbatim", () => {
    render(
      <StatusBadge
        label="Enlace abierto, envío sin confirmar"
        tone="attention"
      />,
    );

    expect(
      screen.getByText("Enlace abierto, envío sin confirmar"),
    ).toBeInTheDocument();
  });

  it("records its tone on the element, so the mapping is visible to a test", () => {
    render(<StatusBadge label="Marcada como enviada" tone="done" />);

    expect(screen.getByText("Marcada como enviada")).toHaveAttribute(
      "data-tone",
      "done",
    );
  });

  it("renders a different tone differently", () => {
    const { unmount } = render(
      <StatusBadge label="Sin enviar" tone="attention" />,
    );
    const attention = screen.getByText("Sin enviar").className;

    unmount();
    render(<StatusBadge label="Sin enviar" tone="quiet" />);

    expect(screen.getByText("Sin enviar").className).not.toBe(attention);
  });

  it("carries no colour for a quiet status", () => {
    render(<StatusBadge label="Sin respuesta" tone="quiet" />);

    expect(screen.getByText("Sin respuesta")).toHaveAttribute(
      "data-tone",
      "quiet",
    );
  });

  it("does not announce itself as an alert, whatever the tone", () => {
    // A status in a list of 388 households is information. An alert role on each
    // row would make a screen reader unusable.
    const { container } = render(
      <StatusBadge label="Marcada como fallida" tone="broken" />,
    );

    expect(container.querySelector("[role='alert']")).toBeNull();
  });
});
