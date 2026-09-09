import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvitationGate } from "./InvitationGate";

/**
 * The gate screen a guest lands on straight from WhatsApp.
 *
 * The ordering assertion is the important one and it is a product promise, not
 * a layout preference: the message they received promised THEIR invitation, so
 * landing on a bare number prompt breaks that promise at the exact moment the
 * page demands something from them. The household is greeted first, then asked.
 *
 * Doing so discloses nothing new — the greeting name is already on the Open
 * Graph card WhatsApp rendered in the chat before the guest tapped the link.
 *
 * Like `InvitationBody`, this component is synchronous and props-only, so it
 * has no field a phone number could arrive in.
 */

const RECOVERY = "https://wa.me/573005550000?text=Hola";

function renderGate(greetingName = "Ñoño Muñóz") {
  return render(
    <InvitationGate greetingName={greetingName} recoveryHref={RECOVERY}>
      <form aria-label="phone form">
        <input aria-label="Número de celular" />
      </form>
    </InvitationGate>,
  );
}

describe("InvitationGate", () => {
  it("greets the household by name", () => {
    renderGate();

    expect(
      screen.getByRole("heading", { name: /Ñoño Muñóz/ }),
    ).toBeInTheDocument();
  });

  it("greets a different household by its own name", () => {
    renderGate("Familia Restrepo");

    expect(
      screen.getByRole("heading", { name: /Familia Restrepo/ }),
    ).toBeInTheDocument();
  });

  it("greets BEFORE it asks for the number", () => {
    renderGate();

    const heading = screen.getByRole("heading", { name: /Ñoño Muñóz/ });
    const form = screen.getByRole("form", { name: "phone form" });

    // Node.DOCUMENT_POSITION_FOLLOWING: the form comes after the greeting.
    expect(heading.compareDocumentPosition(form) & 4).toBe(4);
  });

  it("renders the submitted form it is given", () => {
    renderGate();

    expect(screen.getByLabelText("Número de celular")).toBeInTheDocument();
  });

  it("offers the recovery link to the owning sender", () => {
    renderGate();

    const link = screen.getByRole("link", { name: /No puedes entrar/ });

    expect(link).toHaveAttribute("href", RECOVERY);
  });

  it("points the recovery link at whichever owner it is given", () => {
    render(
      <InvitationGate
        greetingName="Familia Restrepo"
        recoveryHref="https://wa.me/573015551111?text=Hola"
      >
        <form />
      </InvitationGate>,
    );

    expect(
      screen.getByRole("link", { name: /No puedes entrar/ }),
    ).toHaveAttribute("href", "https://wa.me/573015551111?text=Hola");
  });

  it("opens the recovery link without handing WhatsApp a window opener", () => {
    renderGate();

    const link = screen.getByRole("link", { name: /No puedes entrar/ });

    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel") ?? "").toContain("noopener");
  });

  it("shows none of the invitation's contents before the guest is through", () => {
    renderGate();

    const text = document.body.textContent ?? "";

    for (const gated of ["lugares reservados", "Fecha", "Dirección"]) {
      expect(text).not.toContain(gated);
    }
  });
});
