import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { describeDeviceMismatch } from "@/lib/domain/device-declaration";

import { DeviceDeclarationForm } from "./DeviceDeclarationForm";
import { DeviceMismatchNotice } from "./DeviceMismatchNotice";

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BETO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const OPERATORS = [
  { id: ANA, displayName: "Ana Operadora" },
  { id: BETO, displayName: "Beto Operador" },
];

/**
 * The picker and the interstitial — the two surfaces of the device declaration.
 *
 * The picker asks an unverifiable question on purpose: `wa.me` addresses the
 * recipient only, so which account sends is a property of the handset, and the
 * only thing that knows it is the person holding it.
 */
describe("DeviceDeclarationForm", () => {
  it("offers every operator as a choice", () => {
    render(
      <DeviceDeclarationForm
        operators={OPERATORS}
        declaredSenderId={null}
        action={vi.fn<(formData: FormData) => void>()}
      />,
    );

    expect(screen.getByLabelText("Ana Operadora")).toBeInTheDocument();
    expect(screen.getByLabelText("Beto Operador")).toBeInTheDocument();
  });

  it("preselects nobody when this device has never answered", () => {
    // Fail to the picker, never to a default: a preselected option turns
    // "clear your site data" into "silently become whoever was suggested".
    render(
      <DeviceDeclarationForm
        operators={OPERATORS}
        declaredSenderId={null}
        action={vi.fn<(formData: FormData) => void>()}
      />,
    );

    for (const option of screen.getAllByRole("radio")) {
      expect(option).not.toBeChecked();
    }
  });

  it("preselects the account this device already declared", () => {
    render(
      <DeviceDeclarationForm
        operators={OPERATORS}
        declaredSenderId={BETO}
        action={vi.fn<(formData: FormData) => void>()}
      />,
    );

    expect(screen.getByLabelText("Beto Operador")).toBeChecked();
    expect(screen.getByLabelText("Ana Operadora")).not.toBeChecked();
  });

  it("submits the chosen account", async () => {
    const action = vi.fn<(formData: FormData) => void>();
    const user = userEvent.setup();

    render(
      <DeviceDeclarationForm
        operators={OPERATORS}
        declaredSenderId={null}
        action={action}
      />,
    );

    await user.click(screen.getByLabelText("Beto Operador"));
    await user.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect((action.mock.calls[0][0] as FormData).get("senderId")).toBe(BETO);
  });

  it("explains that the app cannot choose the sending account itself", () => {
    render(
      <DeviceDeclarationForm
        operators={OPERATORS}
        declaredSenderId={null}
        action={vi.fn<(formData: FormData) => void>()}
      />,
    );

    expect(screen.getByText(/wa\.me/)).toBeInTheDocument();
  });
});

describe("DeviceMismatchNotice", () => {
  const message = describeDeviceMismatch({
    sessionDisplayName: "Ana Operadora",
    declaredDisplayName: "Beto Operador",
  });

  it("announces the block as an alert rather than as decoration", () => {
    render(<DeviceMismatchNotice message={message} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/no coincide/i);
  });

  it("names both the session and the declared account", () => {
    render(<DeviceMismatchNotice message={message} />);
    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Ana Operadora");
    expect(alert).toHaveTextContent("Beto Operador");
  });

  it("offers exactly the two exits and nothing that dismisses it", () => {
    render(<DeviceMismatchNotice message={message} />);

    expect(
      screen.getByRole("link", { name: /Cambiar la declaración/i }),
    ).toHaveAttribute("href", "/console/device");
    expect(
      screen.getByRole("link", { name: /Iniciar sesión con la otra cuenta/i }),
    ).toHaveAttribute("href", "/console/auth/sign-out");
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
