import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, NoMatchesState } from "./empty-state";

/**
 * TWO empty states, because "there is nothing" and "nothing matches" are
 * different problems with different exits.
 *
 * An operator who sees "no hay invitaciones" on a filtered list reasonably
 * concludes the data is gone. The fix is not better copy on one shared component:
 * it is a second component that keeps the filter in view and offers to clear it,
 * because the filter is the cause and clearing it is the whole remedy.
 */

describe("EmptyState — nothing here yet", () => {
  it("says what is missing and why that is a normal state", () => {
    render(
      <EmptyState
        title="Todavía no hay invitaciones a tu nombre"
        body="Las invitaciones se cargan con el importador."
      />,
    );

    expect(
      screen.getByText("Todavía no hay invitaciones a tu nombre"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Las invitaciones se cargan con el importador."),
    ).toBeInTheDocument();
  });

  it("offers no clear-filter control, because there is no filter to blame", () => {
    render(<EmptyState title="Nada todavía" body="Aún no hay datos." />);

    expect(
      screen.queryByRole("button", { name: /Quitar|Limpiar/i }),
    ).toBeNull();
  });

  it("announces itself politely rather than as an alert", () => {
    // An empty list is information, not a failure. `role="alert"` would interrupt
    // a screen-reader user for a state that is frequently correct.
    const { container } = render(
      <EmptyState title="Nada todavía" body="Aún no hay datos." />,
    );

    expect(container.querySelector("[role='alert']")).toBeNull();
  });
});

describe("NoMatchesState — nothing matches the filter", () => {
  it("keeps the filter that caused the emptiness visible", () => {
    render(
      <NoMatchesState
        filterSummary="Solo sin respuesta"
        clearLabel="Quitar el filtro"
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText(/Solo sin respuesta/)).toBeInTheDocument();
  });

  it("distinguishes itself from an empty list in words", () => {
    render(
      <NoMatchesState
        filterSummary="Solo sin respuesta"
        clearLabel="Quitar el filtro"
        onClear={vi.fn()}
      />,
    );

    // Not "no hay invitaciones". The data exists; this view is hiding it, and
    // the copy has to say the second thing rather than the first.
    expect(screen.getByText(/coincide/i)).toBeInTheDocument();
    expect(screen.getByText(/siguen ahí/i)).toBeInTheDocument();
    expect(screen.queryByText(/todavía no hay/i)).toBeNull();
  });

  it("clears the filter when the offered control is used", async () => {
    const onClear = vi.fn();
    render(
      <NoMatchesState
        filterSummary="Solo sin respuesta"
        clearLabel="Quitar el filtro"
        onClear={onClear}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar el filtro" }),
    );

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
