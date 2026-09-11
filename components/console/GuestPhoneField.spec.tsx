import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GuestPhoneField } from "./GuestPhoneField";

/**
 * The inline phone editor.
 *
 * It is inline because of a note a reference project left behind, and the note
 * is right: "sending three people to a full edit screen to type ten digits is
 * the kind of friction that means the data never gets entered". The console's
 * whole purpose fails if a household is missing a number nobody ever fills in.
 *
 * The action is a prop, as everywhere else in this codebase: in production the
 * page passes a bound Server Action, here it is a spy. That is what makes the
 * submitted payload assertable without a server.
 */

/** A typed no-op stand-in for the bound Server Action the page passes. */
function spyAction() {
  return vi.fn<(formData: FormData) => void>();
}

function fields(action: (formData: FormData) => void) {
  return {
    guestId: "cccccccc-3333-4333-8333-333333333333",
    guestName: "Ana Muñóz",
    action,
  };
}

describe("GuestPhoneField", () => {
  it("shows the stored number without making the operator open anything", () => {
    render(
      <GuestPhoneField
        {...fields(spyAction())}
        phoneE164="+573001234567"
        lineType="mobile"
        dispatchable={true}
      />,
    );

    expect(screen.getByText("+573001234567")).toBeInTheDocument();
  });

  it("says plainly when a guest has no number at all", () => {
    render(
      <GuestPhoneField
        {...fields(spyAction())}
        phoneE164={null}
        lineType="not_normalizable"
        dispatchable={false}
      />,
    );

    expect(screen.getByText("Sin número")).toBeInTheDocument();
  });

  it("flags a landline where the number is, not where the dispatch fails", () => {
    render(
      <GuestPhoneField
        {...fields(spyAction())}
        phoneE164="+576012345678"
        lineType="fixed_line"
        dispatchable={false}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /no parece recibir WhatsApp/i,
    );
  });

  it("does not flag a mobile number", () => {
    render(
      <GuestPhoneField
        {...fields(spyAction())}
        phoneE164="+573001234567"
        lineType="mobile"
        dispatchable={true}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("submits the edited number together with the guest it belongs to", async () => {
    const action = spyAction();
    const user = userEvent.setup();

    render(
      <GuestPhoneField
        {...fields(action)}
        phoneE164={null}
        lineType="not_normalizable"
        dispatchable={false}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Editar el número de Ana Muñóz/i }),
    );
    await user.type(
      screen.getByLabelText(/Número de Ana Muñóz/i),
      "3007654321",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const submitted = action.mock.calls[0][0] as FormData;
    expect(submitted.get("guestId")).toBe(
      "cccccccc-3333-4333-8333-333333333333",
    );
    expect(submitted.get("phone")).toBe("3007654321");
  });

  it("closes the editor without submitting when the operator cancels", async () => {
    const action = spyAction();
    const user = userEvent.setup();

    render(
      <GuestPhoneField
        {...fields(action)}
        phoneE164="+573001234567"
        lineType="mobile"
        dispatchable={true}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Editar el número de Ana Muñóz/i }),
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("+573001234567")).toBeInTheDocument();
  });

  it("offers no editor at all while the device declaration blocks the console", async () => {
    render(
      <GuestPhoneField
        {...fields(spyAction())}
        phoneE164="+573001234567"
        lineType="mobile"
        dispatchable={true}
        readOnly={true}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Editar el número/i }),
    ).not.toBeInTheDocument();
  });
});
