import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { GateFeedback } from "@/lib/domain/gate-copy";

import { GateForm, type GateFormAction } from "./gate-form";

/**
 * The one interactive element on the public route.
 *
 * The action is a prop so this renders without a server: in production the page
 * passes the bound Server Action, here it is a plain async function. That keeps
 * the test at two collaborators instead of mocking the whole Server Action
 * runtime to observe one string.
 *
 * What matters and is asserted: the number the guest typed reaches the action,
 * the feedback that comes back is shown to them, and the number they typed is
 * never echoed into the feedback — a rejected value rendered back onto the page
 * would put a phone number in the page source of a page anyone holding the link
 * can load.
 */

function actionReturning(feedback: GateFeedback) {
  return vi.fn<GateFormAction>(async () => feedback);
}

describe("GateForm", () => {
  it("asks for the number with a labelled field", () => {
    render(<GateForm action={actionReturning({ status: "idle" })} />);

    expect(screen.getByLabelText(/Número de celular/)).toBeInTheDocument();
  });

  it("submits the number the guest typed to the action it was given", async () => {
    const action = actionReturning({ status: "idle" });
    const user = userEvent.setup();

    render(<GateForm action={action} />);
    await user.type(screen.getByLabelText(/Número de celular/), "3005551234");
    await user.click(screen.getByRole("button", { name: /Ver la invitación/ }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("phone")).toBe("3005551234");
  });

  it("shows the generic failure and the remaining attempts after a rejection", async () => {
    const user = userEvent.setup();

    render(
      <GateForm
        action={actionReturning({ status: "rejected", attemptsRemaining: 3 })}
      />,
    );
    await user.type(screen.getByLabelText(/Número de celular/), "3009999999");
    await user.click(screen.getByRole("button", { name: /Ver la invitación/ }));

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("No pudimos confirmar ese número");
    expect(alert).toHaveTextContent("Te quedan 3 intentos.");
  });

  it("shows the concrete wait after a lockout, not a vague 'later'", async () => {
    const user = userEvent.setup();

    render(
      <GateForm
        action={actionReturning({ status: "locked", retryAfterMs: 720_000 })}
      />,
    );
    await user.type(screen.getByLabelText(/Número de celular/), "3009999999");
    await user.click(screen.getByRole("button", { name: /Ver la invitación/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "espera 12 minutos",
    );
  });

  it("never echoes the rejected number back into the page", async () => {
    const user = userEvent.setup();

    render(
      <GateForm
        action={actionReturning({ status: "rejected", attemptsRemaining: 7 })}
      />,
    );
    await user.type(screen.getByLabelText(/Número de celular/), "3005551234");
    await user.click(screen.getByRole("button", { name: /Ver la invitación/ }));

    const alert = await screen.findByRole("alert");

    expect(alert.textContent ?? "").not.toContain("3005551234");
  });

  /**
   * NOTHING IS SAID BEFORE THE FIRST SUBMISSION — AND THE ROOM TO SAY IT IS
   * ALREADY THERE.
   *
   * This used to assert the alert element was absent, which was the same
   * assertion in stronger clothes and cost the gate a jump: the region mounted
   * on the first refusal and the page grew by 106 pixels, measured on an
   * iPhone 14, pushing the recovery link — the only other thing a refused guest
   * can do — off the bottom of a screen that is meant to be exactly one
   * viewport tall.
   *
   * So the region is in the document from the first paint, holding nothing and
   * reserving one line. What matters to a guest is unchanged and is what is
   * asserted: before they have tried, the gate says nothing.
   */
  it("says nothing at all before the first submission", () => {
    render(<GateForm action={actionReturning({ status: "idle" })} />);

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toBe("");
    // The space it will need, held rather than taken later.
    expect(alert.className).toContain("min-h-6");
  });
});
