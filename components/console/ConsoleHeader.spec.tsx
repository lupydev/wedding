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
        newInvitationPath="/console/invitations/new"
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
        newInvitationPath="/console/invitations/new"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Panel de envíos" }),
    ).toBeInTheDocument();
  });

  /**
   * CREATION IS A DESTINATION, NOT A BUTTON AT THE FOOT OF A LIST.
   *
   * It used to exist only inside `GuestList`, below every household already on
   * screen, and nothing in the navigation pointed at it — so the more
   * invitations an operator had, the further the way to make another one
   * scrolled off. Here it is above the fold on every console page.
   *
   * A link rather than a button, so it works with no JavaScript, like every
   * other destination in this header.
   */
  it("offers creating an invitation as a link, above the fold", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Michell"
        newInvitationPath="/console/invitations/new"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Nueva invitación" }),
    ).toHaveAttribute("href", "/console/invitations/new");
  });

  /**
   * AND THE DEVICE LINK IS GONE, WHICH WAS THE FOURTH DOOR TO ONE SCREEN.
   *
   * `/console/device` still has a nav tab, a forced redirect when no
   * declaration exists, and a red interstitial above every page when the
   * declaration does not match. A permanent header link asking the operator to
   * change their WhatsApp account, on every page, was one door too many for a
   * question answered once per handset.
   */
  it("no longer asks about the WhatsApp account on every page", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Michell"
        newInvitationPath="/console/invitations/new"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(screen.queryByRole("link", { name: /dispositivo/i })).toBeNull();
  });

  it("offers sign-out as a link with the name the rest of the suite depends on", () => {
    render(
      <ConsoleHeader
        operatorDisplayName="Ana Operadora"
        newInvitationPath="/console/invitations/new"
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
        newInvitationPath="/console/invitations/new"
        signOutPath="/console/auth/sign-out"
      />,
    );

    expect(container.querySelector("[data-slot='console-tabbar']")).toBeNull();
    expect(container.querySelector("header")).not.toBeNull();
  });
});
