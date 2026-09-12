import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDestructive } from "./confirm-destructive";

/**
 * How this product asks "are you sure?".
 *
 * FOUR DEFECTS FROM A REFERENCE CONSOLE, FIXED BY CONSTRUCTION RATHER THAN BY
 * DISCIPLINE:
 *
 *  1. `window.confirm` for destructive actions. It is unstyleable, it blocks the
 *     main thread, it is suppressible by the browser after a few uses, and on iOS
 *     it names the origin rather than the consequence.
 *  2. `Dialog` where `AlertDialog` belongs. A plain dialog does not carry the
 *     `alertdialog` role, so an assistive technology announces it as a panel
 *     rather than as a decision.
 *  3. No focus trap: Tab walked out of the open dialog and into the page behind
 *     it, where a keyboard operator could activate the very row being discussed.
 *  4. Nothing focus-visible anywhere, so the keyboard path was invisible.
 *
 * Radix answers all four, which is the reason this wraps a primitive instead of
 * hand-rolling one. What the tests below prove is that this call site actually
 * uses it that way.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function renderConfirm(onConfirm: () => void) {
  return render(
    <ConfirmDestructive
      trigger="Eliminar la invitación"
      title="¿Eliminar la invitación de Familia Muñóz?"
      body="Se perderán los datos cargados para esta invitación."
      confirmLabel="Eliminar"
      cancelLabel="Conservar"
      onConfirm={onConfirm}
    />,
  );
}

describe("ConfirmDestructive", () => {
  it("shows only the trigger until it is asked", async () => {
    renderConfirm(vi.fn());

    expect(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("opens as an alertdialog, not as a plain dialog", async () => {
    renderConfirm(vi.fn());

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    );

    // `alertdialog` is the role that tells assistive technology this is a
    // decision with a consequence rather than a panel of content.
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("states the consequence, not just the question", async () => {
    renderConfirm(vi.fn());
    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    );

    const dialog = await screen.findByRole("alertdialog");

    expect(dialog).toHaveTextContent(
      "¿Eliminar la invitación de Familia Muñóz?",
    );
    expect(dialog).toHaveTextContent(
      "Se perderán los datos cargados para esta invitación.",
    );
  });

  it("never reaches for window.confirm", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    const onConfirm = vi.fn();
    renderConfirm(onConfirm);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    );
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all when the operator keeps the data", async () => {
    const onConfirm = vi.fn();
    renderConfirm(onConfirm);

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    );
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Conservar" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog, so the keyboard path starts inside it", async () => {
    renderConfirm(vi.fn());

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    );
    const dialog = await screen.findByRole("alertdialog");

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps the keyboard inside the dialog, so Tab cannot reach the page behind", async () => {
    renderConfirm(vi.fn());

    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar la invitación" }),
    );
    const dialog = await screen.findByRole("alertdialog");

    // Past the last control and round again. Without a trap this walks out into
    // the page, where a keyboard operator could activate the row under discussion.
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
