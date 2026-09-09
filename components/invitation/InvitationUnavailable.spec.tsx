import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvitationUnavailable } from "./InvitationUnavailable";

/**
 * An unknown or rotated slug reaches a guest, not an engineer. The framework's
 * default 404 is a dead end that reads as "you did something wrong"; the guest
 * did nothing wrong, and their link may simply have been rotated after being
 * forwarded to the wrong person.
 *
 * The page must also not confirm or deny that a given slug exists, so its copy
 * is written without reference to the slug at all.
 */
describe("InvitationUnavailable", () => {
  it("explains the situation instead of showing an error code", () => {
    render(<InvitationUnavailable />);

    expect(
      screen.getByRole("heading", { name: /No encontramos esta invitación/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/404/)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("tells the guest exactly what to do next", () => {
    const { container } = render(<InvitationUnavailable />);

    expect(container.textContent).toMatch(/enlace/i);
    expect(container.textContent).toMatch(/nuevo enlace/i);
  });

  it("neither confirms nor denies that any particular invitation exists", () => {
    const { container } = render(<InvitationUnavailable />);
    const copy = container.textContent ?? "";

    // Wording such as "this invitation was deleted" or "expired" would tell a
    // stranger probing slugs which ones once existed.
    for (const revealing of ["eliminad", "vencid", "expirad", "existe"]) {
      expect(copy.toLowerCase()).not.toContain(revealing);
    }
  });

  it("invents no contact detail the couple has not supplied", () => {
    const { container } = render(<InvitationUnavailable />);

    expect(container.innerHTML).not.toMatch(/\+?\d{7,}/);
    expect(container.innerHTML).not.toMatch(/@/);
  });
});
