import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RsvpFeedback } from "@/lib/domain/rsvp-copy";

import {
  RsvpForm,
  type RsvpFormAction,
  type RsvpFormCurrent,
  type RsvpFormGuest,
} from "./RsvpForm";

/**
 * The RSVP form — the only place a guest can answer, and the only interactive
 * element behind the gate.
 *
 * The action is a prop, exactly as `GateForm`'s is: in production the page
 * passes the bound Server Action, here it is a plain async function. That is
 * what makes the two assertions that matter testable without a server.
 *
 * The two assertions that matter:
 *
 *  1. There is NO way to select more people than the household has seats. The
 *     cap is hard by confirmed decision, so the form must not have an
 *     affordance for asking — not a number input, not a "request more" link,
 *     not a fourth checkbox that goes red after the fact.
 *  2. The submitted payload carries NAMES, never a seat count. The database
 *     requires `seats_confirmed` to equal the number of named attendees
 *     (migration 0007), so a form that can send the two independently is a form
 *     that will eventually send them disagreeing.
 */

const GUESTS: readonly RsvpFormGuest[] = [
  { id: "aaaaaaaa-1111-4111-8111-111111111111", fullName: "Camila Aguirre" },
  { id: "bbbbbbbb-2222-4222-8222-222222222222", fullName: "Rodrigo Aguirre" },
  { id: "cccccccc-3333-4333-8333-333333333333", fullName: "Sara Aguirre" },
];

function actionReturning(feedback: RsvpFeedback) {
  return vi.fn<RsvpFormAction>(async () => feedback);
}

function renderForm(
  options: {
    action?: ReturnType<typeof actionReturning>;
    guests?: readonly RsvpFormGuest[];
    seatsAllowed?: number;
    current?: RsvpFormCurrent | null;
  } = {},
) {
  const action = options.action ?? actionReturning({ status: "recorded" });

  render(
    <RsvpForm
      action={action}
      guests={options.guests ?? GUESTS}
      seatsAllowed={options.seatsAllowed ?? 3}
      current={options.current ?? null}
    />,
  );

  return action;
}

function attendeeBoxes() {
  return within(
    screen.getByRole("group", { name: /Quiénes asisten/ }),
  ).getAllByRole("checkbox");
}

function submitButton() {
  return screen.getByRole("button", { name: /Enviar respuesta/ });
}

describe("RsvpForm attendance choice", () => {
  it("asks the yes/no question before anything else", () => {
    renderForm();

    expect(
      screen.getByRole("radio", { name: /Sí, allá estaremos/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /No podremos acompañarlos/ }),
    ).toBeInTheDocument();
  });

  it("offers one checkbox per named guest, and nothing more", () => {
    renderForm();

    const boxes = attendeeBoxes();

    expect(boxes).toHaveLength(GUESTS.length);
    for (const guest of GUESTS) {
      expect(
        screen.getByRole("checkbox", { name: guest.fullName }),
      ).toBeInTheDocument();
    }
  });

  it("marks a child so the couple's own list reads the same as the form", () => {
    renderForm({
      guests: [{ id: GUESTS[0].id, fullName: "Sara Aguirre", isChild: true }],
    });

    expect(
      screen.getByRole("checkbox", { name: /Sara Aguirre \(niño o niña\)/ }),
    ).toBeInTheDocument();
  });

  it("disables the attendee list when the household declines", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(
      screen.getByRole("radio", { name: /No podremos acompañarlos/ }),
    );

    for (const box of attendeeBoxes()) {
      expect(box).toBeDisabled();
    }
  });
});

describe("RsvpForm seat cap", () => {
  it("never lets a guest select more people than the household has seats", async () => {
    // Five named people, three seats. The moment the third box is checked the
    // remaining two stop being selectable — there is no fourth choice to make
    // and no message inviting one.
    const user = userEvent.setup();
    const guests: RsvpFormGuest[] = [
      ...GUESTS,
      { id: "dddddddd-4444-4444-8444-444444444444", fullName: "Luis Aguirre" },
      { id: "eeeeeeee-5555-4555-8555-555555555555", fullName: "Ana Aguirre" },
    ];

    renderForm({ guests, seatsAllowed: 3 });
    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));

    for (const guest of guests.slice(0, 3)) {
      await user.click(screen.getByRole("checkbox", { name: guest.fullName }));
    }

    const checked = attendeeBoxes().filter(
      (box) => (box as HTMLInputElement).checked,
    );
    const selectable = attendeeBoxes().filter(
      (box) => !(box as HTMLInputElement).disabled,
    );

    expect(checked).toHaveLength(3);
    // Only the three already-checked boxes remain interactive, so the guest can
    // still change their mind — they simply cannot add a fourth person.
    expect(selectable).toHaveLength(3);
    expect(
      screen.getByRole("checkbox", { name: "Luis Aguirre" }),
    ).toBeDisabled();
  });

  it("says the allowance is spent instead of silently freezing the controls", async () => {
    const user = userEvent.setup();
    renderForm({ seatsAllowed: 1 });

    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));

    expect(
      screen.getByText("Ya seleccionaron el único lugar reservado."),
    ).toBeInTheDocument();
  });

  it("offers no way to type a seat count or ask for more seats", () => {
    // The hard cap has no "request more" flow, by confirmed decision. A number
    // input would be both an affordance for asking and a second, independent
    // source for a column the database requires to match the names.
    renderForm();

    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText(/más lugares|cupos adicionales/i)).toBeNull();
  });
});

describe("RsvpForm submission", () => {
  it("sends the checked names and no seat count at all", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));
    await user.click(screen.getByRole("checkbox", { name: "Rodrigo Aguirre" }));
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("attending")).toBe("yes");
    expect(formData.getAll("attendee")).toEqual([GUESTS[0].id, GUESTS[1].id]);
    // The derivation, asserted from the outside: there is no seat field.
    expect(formData.get("seatsConfirmed")).toBeNull();
    expect(formData.get("seats")).toBeNull();
  });

  it("sends the optional fields when the guest fills them in", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));
    await user.type(
      screen.getByLabelText(/Restricciones alimentarias/),
      "Sin mariscos",
    );
    await user.type(screen.getByLabelText(/Mensaje para/), "Gracias por todo");
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("dietaryNotes")).toBe("Sin mariscos");
    expect(formData.get("message")).toBe("Gracias por todo");
  });

  it("submits blank optional fields as empty, never as invented text", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(
      screen.getByRole("radio", { name: /No podremos acompañarlos/ }),
    );
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("attending")).toBe("no");
    expect(formData.getAll("attendee")).toEqual([]);
    expect(formData.get("dietaryNotes")).toBe("");
    expect(formData.get("message")).toBe("");
  });

  it("bounds the optional fields at the lengths the database accepts", () => {
    renderForm();

    expect(screen.getByLabelText(/Restricciones alimentarias/)).toHaveAttribute(
      "maxLength",
      "500",
    );
    expect(screen.getByLabelText(/Mensaje para/)).toHaveAttribute(
      "maxLength",
      "1000",
    );
  });

  it("shows what came back from the action", async () => {
    const user = userEvent.setup();
    renderForm({ action: actionReturning({ status: "recorded" }) });

    await user.click(
      screen.getByRole("radio", { name: /No podremos acompañarlos/ }),
    );
    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¡Listo! Guardamos su respuesta.",
      ),
    );
  });

  it("shows a rejection in words rather than failing silently", async () => {
    const user = userEvent.setup();
    renderForm({
      action: actionReturning({
        status: "rejected",
        reason: "attending_without_seats",
      }),
    });

    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));
    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Selecciona quiénes asisten, al menos una persona.",
      ),
    );
  });
});

describe("RsvpForm with an answer already on file", () => {
  const CURRENT: RsvpFormCurrent = {
    attending: true,
    seatsConfirmed: 2,
    attendeeGuestIds: [GUESTS[0].id, GUESTS[1].id],
    dietaryNotes: "Sin mariscos",
    message: "Gracias",
  };

  it("tells the household what they answered last time", () => {
    renderForm({ current: CURRENT });

    expect(
      screen.getByText("Tu respuesta actual: asisten 2 personas."),
    ).toBeInTheDocument();
  });

  it("shows nothing of the sort when they have never answered", () => {
    renderForm({ current: null });

    expect(screen.queryByText(/Tu respuesta actual/)).toBeNull();
  });

  it("pre-fills the form so changing one thing does not retype everything", () => {
    renderForm({ current: CURRENT });

    expect(
      screen.getByRole("radio", { name: /Sí, allá estaremos/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Camila Aguirre" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Rodrigo Aguirre" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Sara Aguirre" }),
    ).not.toBeChecked();
    expect(screen.getByLabelText(/Restricciones alimentarias/)).toHaveValue(
      "Sin mariscos",
    );
    expect(screen.getByLabelText(/Mensaje para/)).toHaveValue("Gracias");
  });

  it("lets the household change a yes into a no", async () => {
    // Append-only means this is a NEW row, not an edit — but from the guest's
    // side it has to feel like simply changing their answer.
    const user = userEvent.setup();
    const action = renderForm({ current: CURRENT });

    await user.click(
      screen.getByRole("radio", { name: /No podremos acompañarlos/ }),
    );
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    expect(action.mock.calls[0][1].get("attending")).toBe("no");
  });

  it("pre-fills a declined answer without pre-checking anybody", () => {
    renderForm({
      current: {
        attending: false,
        seatsConfirmed: 0,
        attendeeGuestIds: [],
        dietaryNotes: null,
        message: null,
      },
    });

    expect(
      screen.getByRole("radio", { name: /No podremos acompañarlos/ }),
    ).toBeChecked();
    for (const box of attendeeBoxes()) {
      expect(box).not.toBeChecked();
    }
  });
});
