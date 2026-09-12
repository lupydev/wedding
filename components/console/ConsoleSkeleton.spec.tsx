import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConsoleSkeleton } from "./ConsoleSkeleton";

/**
 * The loading state, shaped like the page it replaces.
 *
 * A centred spinner tells the operator that something is happening and nothing
 * about what. A skeleton in the shape of the summary, the readiness panel and the
 * first few guest rows tells them what is arriving, and it stops the layout jumping
 * when it does — which on a phone means the tap they were about to make lands on
 * what they aimed at.
 *
 * IT IS A COMPONENT, NOT A `loading.tsx`: a Suspense boundary at the route-group
 * level also wraps the compose and preview routes, and those answer `notFound()`
 * for a household the operator does not own. A boundary above that throw turns a
 * 404 into a streamed 200, which is the distinction those routes exist to refuse.
 *
 * IT CARRIES NO PAGE COPY. Not an aesthetic choice: an unauthenticated request to
 * `/console` must answer a redirect and nothing else, and the standing end-to-end
 * suite asserts that response contains none of the console's headings. A skeleton
 * made of shapes cannot leak one.
 */

describe("the console's loading skeleton", () => {
  it("announces that the panel is loading, once, for a screen reader", () => {
    render(<ConsoleSkeleton />);

    // Text content, not accessible NAME: `status` is not a name-from-content role,
    // and what a live region announces is its contents.
    expect(screen.getByRole("status")).toHaveTextContent(/cargando el panel/i);
  });

  it("hides the decorative shapes from assistive technology", () => {
    // A screen reader reading out eleven empty boxes is worse than silence.
    const { container } = render(<ConsoleSkeleton />);
    const shapes = container.querySelectorAll("[data-slot='skeleton']");

    expect(shapes.length).toBeGreaterThanOrEqual(6);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("leaks none of the page's own copy", () => {
    render(<ConsoleSkeleton />);

    expect(screen.queryByText(/Tus invitaciones/)).toBeNull();
    expect(screen.queryByText(/Todas las invitaciones/)).toBeNull();
  });

  it("is shaped like the page: a summary, a readiness panel and several rows", () => {
    const { container } = render(<ConsoleSkeleton />);

    expect(
      container.querySelectorAll("[data-slot='skeleton-guest-row']"),
    ).toHaveLength(4);
    expect(
      container.querySelector("[data-slot='skeleton-summary']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-slot='skeleton-preflight']"),
    ).not.toBeNull();
  });
});
