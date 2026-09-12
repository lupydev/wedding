import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorRegion } from "./error-region";

/**
 * Where errors are announced.
 *
 * THE REGION EXISTS BEFORE THE MESSAGE DOES, AND THAT IS THE ENTIRE POINT.
 *
 * A live region is announced when its CONTENTS change. A region that is mounted
 * at the same moment as its first message is a region the screen reader was not
 * watching, so the message is never read out — which is the single most common way
 * `aria-live` is used and does nothing. So this component renders the container
 * unconditionally and only the text conditionally.
 *
 * `polite` and not `assertive`: an operator mid-sentence in a phone field should
 * finish the word before being interrupted.
 */

describe("ErrorRegion", () => {
  it("is present and empty before there is anything to say", () => {
    const { container } = render(<ErrorRegion message={null} />);
    const region = container.querySelector("[data-slot='error-region']");

    expect(region).not.toBeNull();
    expect(region).toHaveTextContent("");
  });

  it("keeps the live region politely announced rather than assertive", () => {
    const { container } = render(<ErrorRegion message={null} />);

    expect(
      container.querySelector("[data-slot='error-region']"),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("renders the message when there is one", () => {
    render(<ErrorRegion message="No se pudo guardar el número." />);

    expect(
      screen.getByText("No se pudo guardar el número."),
    ).toBeInTheDocument();
  });

  it("keeps the same region element across a null-to-message change", () => {
    const { container, rerender } = render(<ErrorRegion message={null} />);
    const before = container.querySelector("[data-slot='error-region']");

    rerender(<ErrorRegion message="Falló." />);

    // Identity, not equality: a NEW node would not be announced.
    expect(container.querySelector("[data-slot='error-region']")).toBe(before);
    expect(before).toHaveTextContent("Falló.");
  });
});
