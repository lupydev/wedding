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

function renderGate(greetingName = "Ñoño Muñóz") {
  return render(
    <InvitationGate greetingName={greetingName}>
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

  /**
   * THE WAY OUT IS GONE, AND THIS IS WHERE THAT IS RECORDED.
   *
   * Three assertions stood here: that the gate offered a `wa.me` link to the
   * invitation's owning sender, that it addressed whichever owner it was
   * given, and that it opened without handing WhatsApp a window opener. The
   * couple deleted the link — "quitar la línea de ¿No puedes entrar?" — and
   * were told first what it costs: a household whose number is not the stored
   * one now has nothing on this page to press.
   *
   * So the positive assertions became one negative one. It is deliberately
   * about ANY link rather than about the old wording: a replacement escape
   * hatch under a different sentence is exactly the change that should have
   * to be made on purpose, and the gate is the one screen in the product where
   * a stray link is a way around the number check.
   */
  it("offers no way off the page at all, which the couple asked for", () => {
    renderGate();

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(document.body.textContent ?? "").not.toContain("No puedes entrar");
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

/**
 * THE MIDDLE OF THE SCREEN BELONGS TO THE PHOTOGRAPH.
 *
 * The couple looked at the live gate on a phone: everything it says ran down
 * the centre of the frame, which is where the two of them are standing. So
 * the announcement went to the top and the form to the foot, and the picture
 * got the space between them — the landing page's own composition.
 *
 * `e2e/invitation-one-screen.spec.ts` measures what this produces on the two
 * phones; what a unit test can hold is the structure that produces it, and
 * the structure has one trap in it. `justify-between` spreads whatever
 * children it is given, so three siblings would put the announcement in the
 * middle — back on top of the couple, with the gate looking spread out rather
 * than wrong.
 */
describe("how the gate is composed on a phone", () => {
  it("pushes its two groups to the two ends of the screen", () => {
    const { container } = renderGate();
    const section = container.querySelector("section.gate")!;

    expect(section.className).toContain("justify-between");
    expect(section.className).not.toContain("justify-center");
    // Two groups, so there is nothing to strand in the middle.
    expect(section.children).toHaveLength(2);
  });

  it("keeps the greeting and the wedding in the group at the top", () => {
    const { container } = renderGate();
    const top = container.querySelector(".gate__announcement")!;

    expect(top.querySelector(".gate__greeting")).not.toBeNull();
    expect(top.textContent ?? "").toContain("Nos casamos");
    expect(top.querySelector(".gate__panel")).toBeNull();
  });

  /**
   * AND IT IS STILL FREE TO SCROLL, WHICH IS THE KEYBOARD DECISION.
   *
   * U34 kept this screen `justify-center` so the field sat in the middle,
   * above where an iOS keyboard comes up. The couple have moved it to the
   * foot and that trade is theirs; what must not go with it is `min-h-dvh`.
   * A locked `h-dvh` gate clips instead of scrolling, and a clipped submit
   * button on the one screen every guest must pass is a dead end.
   */
  it("is never taller than the screen by decree", () => {
    const { container } = renderGate();
    const section = container.querySelector("section.gate")!;

    expect(section.className).toContain("min-h-dvh");
    // A bare `h-dvh`, not the `h-dvh` inside `min-h-dvh`.
    expect(section.className).not.toMatch(/(^|\s)h-dvh(\s|$)/);
  });
});
