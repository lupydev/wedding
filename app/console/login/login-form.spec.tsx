import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm, type SignInFormAction } from "./login-form";
import type { SignInState } from "./sign-in-state";

/**
 * The console sign-in form.
 *
 * The action arrives as a prop, exactly as `GateForm` does on the guest
 * surface: in production the page passes the bound Server Action, here it is a
 * plain async function. Two collaborators instead of the whole Server Action
 * runtime.
 *
 * What matters and is asserted: both credentials reach the action unaltered,
 * the refusal that comes back is shown, the password is never echoed into the
 * page, and the form offers no second way in — no sign-up, no reset, no
 * "remember me". Two operators, created once, out of band.
 */

function actionReturning(state: SignInState) {
  return vi.fn<SignInFormAction>(async () => state);
}

const IDLE = { notice: null } as const;

describe("LoginForm", () => {
  it("asks for an address and a password, each with its own label", () => {
    render(<LoginForm action={actionReturning(IDLE)} />);

    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("masks the password field and asks the browser for a stored one", () => {
    render(<LoginForm action={actionReturning(IDLE)} />);

    const password = screen.getByLabelText("Contraseña");

    expect(password).toHaveAttribute("type", "password");
    // `current-password`, never `new-password`: this form signs an existing
    // operator in and cannot create anybody.
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });

  it("submits both credentials to the action it was given", async () => {
    const action = actionReturning(IDLE);
    const user = userEvent.setup();

    render(<LoginForm action={action} />);
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), "  spaced secret  ");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("email")).toBe("ana@example.test");
    // Byte for byte, surrounding spaces included. A field that trimmed would
    // lock out anyone whose password legitimately ends in one.
    expect(formData.get("password")).toBe("  spaced secret  ");
  });

  it("shows the refusal the action returned", async () => {
    const user = userEvent.setup();
    const notice = "No fue posible iniciar sesión con los datos indicados.";

    render(<LoginForm action={actionReturning({ notice })} />);
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), "wrong");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("status")).toHaveTextContent(notice);
  });

  it("never puts the submitted password back into the page", async () => {
    const user = userEvent.setup();
    const secret = "una-contrasena-muy-secreta";

    const { container } = render(
      <LoginForm action={actionReturning({ notice: "No fue posible." })} />,
    );
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), secret);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await screen.findByRole("status");

    // `innerHTML`, not the accessibility tree: a typed value lives in the DOM
    // property and not in the attribute, so what is asserted here is that
    // nothing re-rendered the secret back into the markup.
    expect(container.innerHTML).not.toContain(secret);
  });

  it("shows no notice at all before the form has been submitted", () => {
    render(<LoginForm action={actionReturning(IDLE)} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers no sign-up, no password reset and no remembered session", () => {
    // Two operators, created once by `scripts/seed-operators.ts`. A reset is a
    // maintainer running that tool again — deliberately not a self-service flow
    // that would mail a capability to whoever controls the address today.
    const { container } = render(<LoginForm action={actionReturning(IDLE)} />);

    expect(container.textContent).not.toMatch(
      /crear cuenta|registrarse|reg[íi]strese|olvid|restablec|recuperar la contrase|recordar/i,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
