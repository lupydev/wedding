import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  InvitationBody,
  type InvitationBodyInvitation,
} from "./InvitationBody";

/**
 * `InvitationBody` is the one component rendered by BOTH the public route
 * (`/i/[slug]`, after the phone gate) and the operator preview
 * (`/console/preview/[invitationId]`). Two implementations would drift, and the
 * operator would approve copy no guest ever sees.
 *
 * It is synchronous and props-only precisely so it can be tested here rather
 * than only through a browser, and so it cannot reach a database — which is
 * also what keeps a phone number structurally out of it.
 */
const household: InvitationBodyInvitation = {
  displayName: "Familia Muñóz",
  greetingName: "Ñoño Muñóz",
  seatsAllowed: 3,
  rsvpDeadline: "2027-05-01",
  guests: [
    { id: "g1", fullName: "Ñoño Muñóz", isChild: false },
    { id: "g2", fullName: "Aurelia Muñóz", isChild: false },
    { id: "g3", fullName: "Tomás Muñóz", isChild: true },
  ],
};

describe("InvitationBody", () => {
  it("greets the household by its greeting name", () => {
    render(<InvitationBody invitation={household} />);

    expect(
      screen.getByRole("heading", { name: /Ñoño Muñóz/ }),
    ).toBeInTheDocument();
  });

  it("greets a different household by its own greeting name", () => {
    render(
      <InvitationBody
        invitation={{ ...household, greetingName: "Familia Restrepo" }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Familia Restrepo/ }),
    ).toBeInTheDocument();
  });

  it("names every guest of the household", () => {
    render(<InvitationBody invitation={household} />);

    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);

    expect(names).toHaveLength(3);
    expect(names[0]).toContain("Ñoño Muñóz");
    expect(names[1]).toContain("Aurelia Muñóz");
    expect(names[2]).toContain("Tomás Muñóz");
  });

  it("states how many seats the household was given", () => {
    render(<InvitationBody invitation={household} />);

    expect(screen.getByText(/3 lugares/)).toBeInTheDocument();
  });

  it("states a single seat in the singular", () => {
    render(
      <InvitationBody
        invitation={{
          ...household,
          seatsAllowed: 1,
          guests: [household.guests[0]],
        }}
      />,
    );

    expect(screen.getByText(/1 lugar\b/)).toBeInTheDocument();
    expect(screen.queryByText(/1 lugares/)).not.toBeInTheDocument();
  });

  it("states the confirmation deadline the household was given", () => {
    render(<InvitationBody invitation={household} />);

    expect(screen.getByText(/2027-05-01/)).toBeInTheDocument();
  });

  it("says nothing about a deadline when the household has none", () => {
    render(
      <InvitationBody invitation={{ ...household, rsvpDeadline: null }} />,
    );

    expect(screen.queryByText(/Confirmen/)).not.toBeInTheDocument();
  });

  it("keeps the unresolved couple, date and venue values as visible placeholders", () => {
    const { container } = render(<InvitationBody invitation={household} />);

    // The couple has not supplied these yet. Inventing a date or a venue would
    // ship a wrong invitation that reads as a correct one.
    for (const placeholder of [
      "{{COUPLE_NAMES}}",
      "{{WEDDING_DATE}}",
      "{{VENUE_NAME}}",
      "{{VENUE_ADDRESS}}",
    ]) {
      expect(container.textContent).toContain(placeholder);
    }
  });

  it("renders no phone number anywhere in its markup", () => {
    const { container } = render(<InvitationBody invitation={household} />);

    // The prop type carries no phone field at all; this asserts the rendered
    // output too, including any attribute value.
    expect(container.innerHTML).not.toMatch(/\+?\d{7,}/);
  });

  it("matches its approved markup", () => {
    const { container } = render(<InvitationBody invitation={household} />);

    // Drift guard: the operator preview and the public page render this exact
    // component, so a change here is a change to what every guest sees.
    expect(container.innerHTML).toMatchSnapshot();
  });
});
