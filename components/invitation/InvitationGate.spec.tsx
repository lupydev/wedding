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

/**
 * THE GATE CARRIES THE WEDDING, NOT ONLY THE QUESTION.
 *
 * The couple asked for it after seeing the two pages side by side: "valdría la
 * pena seguir manteniendo como en la landing" — the announcement block, with
 * the script line, their names, the date and the counter — "y el copy con el
 * saludo + escribe tu número para abrir la invitación".
 *
 * It is the first screen a guest reaches from a WhatsApp message, and before
 * this it said only "we have your invitation, now prove who you are". The
 * wedding it is about was on the other side of the field.
 */
describe("what the gate says about the wedding", () => {
  it("carries the announcement the landing opens with", () => {
    renderGate();

    expect(screen.getByText("Nos casamos")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Luis & Michell/ }),
    ).toBeInTheDocument();
    // The counter comes with it, which is the part that makes the date feel
    // like something approaching rather than a line of small print.
    expect(screen.getByTestId("save-the-date-when")).toBeInTheDocument();
  });

  /**
   * ONE LINE ASKS FOR THE NUMBER, AND IT USED TO BE TWO.
   *
   * "Tenemos lista su invitación de matrimonio." followed by "Para abrirla,
   * escribe el número de celular que compartiste con nosotros." — two sentences
   * saying what one says, above a field that is the only thing to do on the
   * page.
   */
  it("asks for the number in a single sentence", () => {
    renderGate();

    expect(
      screen.getByText(/Escribe tu número para abrir la invitación/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tenemos lista su invitación/)).toBeNull();
    expect(screen.queryByText(/que compartiste con nosotros/)).toBeNull();
  });

  /**
   * AND THE GREETING STILL COMES FIRST.
   *
   * The ordering is a product promise and the announcement does not displace
   * it: the WhatsApp message said "your invitation", so the household is
   * greeted before anything is demanded of them. The test above this one
   * asserts the form follows the greeting; this asserts the announcement does
   * not slip above it.
   */
  it("greets before it says anything about the wedding", () => {
    renderGate();

    const heading = screen.getByRole("heading", { name: /Ñoño Muñóz/ });
    const announcement = screen.getByText("Nos casamos");

    expect(heading.compareDocumentPosition(announcement) & 4).toBe(4);
  });
});
