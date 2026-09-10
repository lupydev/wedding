import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RSVP_CLOSED_MESSAGE } from "@/lib/domain/rsvp-copy";

import { RsvpClosed } from "./RsvpClosed";

/**
 * What stands where the form used to be, once the deadline has passed.
 *
 * The requirement is that the page shows a CONTACT MESSAGE instead of the form,
 * and the part worth asserting is the "instead": a disabled form, or a form
 * whose submissions are quietly discarded, is the shape that lets a household
 * believe they answered.
 */

describe("RsvpClosed", () => {
  it("shows the closed message the domain owns", () => {
    render(<RsvpClosed />);

    expect(screen.getByText(RSVP_CLOSED_MESSAGE)).toBeInTheDocument();
  });

  it("offers nothing to fill in and nothing to submit", () => {
    const { container } = render(<RsvpClosed />);

    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});
