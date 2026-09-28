import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  STREAM_LINK_LABEL,
  STREAM_PATH,
  streamLinkOpensAt,
} from "@/lib/domain/stream-window";

import { StreamLink } from "./StreamLink";

const CEREMONY = new Date("2026-11-28T17:00:00-05:00");

/** An instant the given number of whole days before the ceremony. */
function daysBefore(days: number): number {
  return CEREMONY.getTime() - days * 86_400_000;
}

describe("StreamLink", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * THE SERVER MUST NOT DECIDE THIS, BECAUSE `/` IS STATIC.
   *
   * The landing is prerendered once and served from a CDN for weeks, so any
   * decision it makes about "is it within the final week" is frozen at build
   * time. Built in September it would say "not yet" forever, including on the
   * morning of the wedding.
   *
   * So the server renders the CLOSED state — the honest answer for almost the
   * whole life of this page — and the client corrects it after mount. Same
   * discipline as `Countdown`: identical first render on both sides by
   * construction, no hydration mismatch, and the cost is one frame.
   */
  it("sends no live link in the server render", () => {
    const markup = renderToStaticMarkup(<StreamLink ceremony={CEREMONY} />);

    expect(markup).not.toContain(`href="${STREAM_PATH}"`);
  });

  describe("while more than a week remains", () => {
    it("offers nothing to press, and says when it opens", () => {
      vi.useFakeTimers({ now: daysBefore(30) });

      render(<StreamLink ceremony={CEREMONY} />);

      const closed = screen.getByRole("button", { name: STREAM_LINK_LABEL });

      expect(closed).toBeDisabled();
      expect(
        screen.queryByRole("link", { name: STREAM_LINK_LABEL }),
      ).toBeNull();
      expect(
        screen.getByText(/se abre el 21 de noviembre de 2026/i),
      ).toBeInTheDocument();
    });

    /**
     * A disabled control that does not say why is a dead end.
     *
     * The project enforces that with `whyDisabled`, which puts the reason in a
     * `title`. The reason is ALSO on screen as text, because `title` never
     * appears on a touch device and this page is read on phones.
     */
    it("carries the reason on the control itself", () => {
      vi.useFakeTimers({ now: daysBefore(30) });

      render(<StreamLink ceremony={CEREMONY} />);

      expect(
        screen.getByRole("button", { name: STREAM_LINK_LABEL }),
      ).toHaveAttribute(
        "title",
        expect.stringMatching(/21 de noviembre de 2026/),
      );
    });
  });

  describe("in the final week", () => {
    it("becomes a link to the stream invitation", () => {
      vi.useFakeTimers({ now: daysBefore(6) });

      render(<StreamLink ceremony={CEREMONY} />);

      const link = screen.getByRole("link", { name: STREAM_LINK_LABEL });

      expect(link).toHaveAttribute("href", STREAM_PATH);
      expect(
        screen.queryByRole("button", { name: STREAM_LINK_LABEL }),
      ).toBeNull();
    });

    it("drops the line about when it opens", () => {
      vi.useFakeTimers({ now: daysBefore(6) });

      render(<StreamLink ceremony={CEREMONY} />);

      expect(screen.queryByText(/se abre el/i)).toBeNull();
    });

    it("is open at the boundary itself", () => {
      vi.useFakeTimers({ now: streamLinkOpensAt(CEREMONY).getTime() });

      render(<StreamLink ceremony={CEREMONY} />);

      expect(
        screen.getByRole("link", { name: STREAM_LINK_LABEL }),
      ).toBeInTheDocument();
    });
  });

  it("is still a link long after the ceremony", () => {
    vi.useFakeTimers({ now: new Date("2026-12-25T00:00:00Z").getTime() });

    render(<StreamLink ceremony={CEREMONY} />);

    expect(
      screen.getByRole("link", { name: STREAM_LINK_LABEL }),
    ).toBeInTheDocument();
  });

  it("reads the same words whether it is open or not", () => {
    vi.useFakeTimers({ now: daysBefore(30) });
    const { unmount } = render(<StreamLink ceremony={CEREMONY} />);
    const closedLabel = screen.getByRole("button", {
      name: STREAM_LINK_LABEL,
    }).textContent;
    unmount();

    vi.useFakeTimers({ now: daysBefore(2) });
    render(<StreamLink ceremony={CEREMONY} />);

    expect(
      screen.getByRole("link", { name: STREAM_LINK_LABEL }).textContent,
    ).toBe(closedLabel);
  });
});
