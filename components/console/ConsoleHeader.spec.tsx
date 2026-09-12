import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConsoleHeader } from "./ConsoleHeader";

/**
 * The console's header: who is signed in, and the two links that change a fact.
 *
 * BOTH EXITS ARE PLAIN LINKS, and that is not laziness. Signing out and changing
 * this device's declaration must both work with JavaScript disabled, because the
 * state they repair — a session on the wrong handset — is exactly the state where
 * an operator starts disabling things to make the console behave.
 */

describe("ConsoleHeader", () => {
  it("names the signed-in operator", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Ana Operadora"
        devicePath="/console/device"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(screen.getByText(/Sesión iniciada como/).textContent).toContain(
      "Ana Operadora",
    );
  });

  it("keeps the product title as the page's first-level heading", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Ana Operadora"
        devicePath="/console/device"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Panel de envíos" }),
    ).toBeInTheDocument();
  });

  it("offers the device declaration as a link, so it survives without JavaScript", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Ana Operadora"
        devicePath="/console/device"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "Cambiar la cuenta de WhatsApp de este dispositivo",
      }),
    ).toHaveAttribute("href", "/console/device");
  });

  it("offers sign-out as a link with the name the rest of the suite depends on", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Ana Operadora"
        devicePath="/console/device"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(screen.getByRole("link", { name: "Cerrar sesión" })).toHaveAttribute(
      "href",
      "/console/auth/sign-out",
    );
  });

  it("puts sign-out in the header and never in a thumb-reach tab bar", () => {
    // A bottom bar sits under the operator's thumb. An accidental sign-out in the
    // middle of a dispatch run costs a re-authentication on a phone, in a venue,
    // with a queue of invitations waiting.
    const { container } = render(
      <ConsoleHeader
        operatorDisplayName="Ana Operadora"
        devicePath="/console/device"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(container.querySelector("[data-slot='console-tabbar']")).toBeNull();
    expect(container.querySelector("header")).not.toBeNull();
  });
});
