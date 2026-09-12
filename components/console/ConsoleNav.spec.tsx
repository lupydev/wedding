import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CONSOLE_NAV_ITEMS } from "@/lib/design/console-nav";

import { ConsoleNav } from "./ConsoleNav";

/**
 * The console's navigation, rendered twice and active in exactly one place.
 *
 * TWICE, DELIBERATELY: a sidebar above the single breakpoint and a bottom tab bar
 * below it. One markup tree that reflows would put the tab bar's icons in the
 * sidebar or the sidebar's labels in the bar; two trees, one data source, is the
 * trade this component makes. The data source is `CONSOLE_NAV_ITEMS`, so the two
 * cannot list different destinations.
 *
 * Props only, no `usePathname()`. The hook lives in a four-line client wrapper so
 * this component — the one with all the rules in it — needs no router mock.
 */

describe("ConsoleNav", () => {
  it("renders every destination in both the sidebar and the tab bar", () => {
    render(<ConsoleNav pathname="/console" />);

    for (const item of CONSOLE_NAV_ITEMS) {
      expect(screen.getAllByRole("link", { name: item.label })).toHaveLength(2);
    }
  });

  it("points each destination at its own href", () => {
    render(<ConsoleNav pathname="/console" />);

    for (const item of CONSOLE_NAV_ITEMS) {
      for (const link of screen.getAllByRole("link", { name: item.label })) {
        expect(link).toHaveAttribute("href", item.href);
      }
    }
  });

  it("marks exactly one destination as the current page", () => {
    render(<ConsoleNav pathname="/console/device" />);

    // Two renderings of one item, not two different items.
    const current = screen.getAllByRole("link", { current: "page" });

    expect(current).toHaveLength(2);
    for (const link of current) {
      expect(link).toHaveAttribute("href", "/console/device");
    }
  });

  it("moves the current marker when the operator moves", () => {
    const { unmount } = render(<ConsoleNav pathname="/console/device" />);

    expect(screen.getAllByRole("link", { current: "page" })[0]).toHaveAttribute(
      "href",
      "/console/device",
    );

    unmount();
    render(<ConsoleNav pathname="/console" />);

    expect(screen.getAllByRole("link", { current: "page" })[0]).toHaveAttribute(
      "href",
      "/console",
    );
  });

  /**
   * THREE REDUNDANT SIGNALS. The geometric mark is the one a test can see, and it
   * is also the one that survives a phone screen in daylight.
   */
  it("draws a geometric mark on the active destination and on no other", () => {
    const { container } = render(<ConsoleNav pathname="/console/device" />);
    const marks = container.querySelectorAll("[data-slot='nav-mark']");

    // One per rendering of the single active item.
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark.closest("a")).toHaveAttribute("href", "/console/device");
    }
  });

  it("gives the bottom bar the height the content's padding was calculated from", () => {
    const { container } = render(<ConsoleNav pathname="/console" />);
    const bar = container.querySelector("[data-slot='console-tabbar']");

    // The same variable, not the same arithmetic written twice. A literal here
    // and a literal in the content padding drift, and the way they drift is the
    // last guest row living permanently under the bar.
    expect(bar).not.toBeNull();
    expect((bar as HTMLElement).style.height).toBe(
      "var(--console-tabbar-height)",
    );
  });

  it("labels each navigation landmark, so two navs are tellable apart", () => {
    render(<ConsoleNav pathname="/console" />);

    expect(
      screen.getByRole("navigation", { name: /lateral/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /inferior/i }),
    ).toBeInTheDocument();
  });

  /**
   * THE COLOUR RULE APPLIES TO THE NAVIGATION TOO.
   *
   * Gold means "this needs your attention", and "this is where you already are"
   * is not that. A reference console used its gold for the active nav item — with
   * white on top of it, at 2.36:1 — and that is precisely how a signal colour
   * acquires a second meaning and stops being a signal. The active tab's colour
   * signal is the step from `muted-foreground` to full `foreground`, which is a
   * 6.18:1-to-12.91:1 jump and needs no accent at all.
   */
  it("spends none of the three signal colours on the active tab", () => {
    const { container } = render(<ConsoleNav pathname="/console/device" />);
    const classes = [...container.querySelectorAll("a, span")]
      .map((element) => element.className)
      .join(" ");

    expect(classes).not.toMatch(/(^|[\s:])(text|bg|border|ring)-primary\b/);
    expect(classes).not.toMatch(/(^|[\s:])(text|bg|border|ring)-success\b/);
    expect(classes).not.toMatch(/(^|[\s:])(text|bg|border|ring)-destructive\b/);
    expect(classes).not.toMatch(/bg-primary\//);
  });

  it("keeps every tab's label visible in the bar, with no overflow menu", () => {
    // An overflow sheet is where a destination goes to be forgotten. Four tabs
    // fit, so all four are on the bar.
    render(<ConsoleNav pathname="/console" />);
    const bar = screen.getByRole("navigation", { name: /inferior/i });

    expect(within(bar).getAllByRole("link")).toHaveLength(
      CONSOLE_NAV_ITEMS.length,
    );
    expect(within(bar).queryByRole("button", { name: /más|Más/ })).toBeNull();
  });
});
