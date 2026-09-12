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

  /**
   * THE SIDEBAR STAYS PUT WHILE THE GUEST LIST SCROLLS UNDER IT.
   *
   * It shipped as a plain flex column with no positioning and no height, so it
   * was as tall as its four links and scrolled away with the page. Two hundred
   * households in, the operator's navigation was somewhere above the top of the
   * window and the only way back to it was scrolling up through the whole list.
   *
   * `dvh` AND NOT `vh`, AND THAT IS THE PART WORTH A TEST. `100vh` is the
   * viewport with the mobile browser's URL bar EXTENDED, permanently, even after
   * it retracts — so a `h-screen` sidebar is taller than the window it sits in
   * and its own last item is unreachable. This shell is phone-first and the
   * sidebar appears from 768px up, which includes every tablet in portrait.
   *
   * Asserted as classes because jsdom performs no layout: there is no computed
   * sticky offset to read here. `e2e/console-design.spec.ts` measures the real
   * thing in a real browser.
   */
  it("pins the sidebar so it does not scroll away with the page", () => {
    const { container } = render(<ConsoleNav pathname="/console" />);
    const sidebar = container.querySelector("[data-slot='console-sidebar']");

    expect(sidebar).not.toBeNull();

    const classes = (sidebar as HTMLElement).className;

    // Sticky rather than fixed: fixed would take the sidebar out of the flow and
    // the content beside it would slide underneath.
    expect(classes).toMatch(/(^|\s)md:sticky(\s|$)/);
    expect(classes).toMatch(/(^|\s)md:top-0(\s|$)/);
    expect(classes).toMatch(/(^|\s)md:h-dvh(\s|$)/);
  });

  it("gives the sidebar its own overflow, so a fifth destination is reachable", () => {
    const { container } = render(<ConsoleNav pathname="/console" />);
    const sidebar = container.querySelector("[data-slot='console-sidebar']");

    // A pinned element with a fixed height and no overflow rule CLIPS whatever
    // does not fit, silently. The bar below the breakpoint has the same number
    // of destinations and no such constraint, so the two would disagree about
    // which destinations exist.
    expect((sidebar as HTMLElement).className).toMatch(
      /(^|\s)md:overflow-y-auto(\s|$)/,
    );
  });

  it("spends no viewport-unit height class anywhere in the navigation", () => {
    const { container } = render(<ConsoleNav pathname="/console" />);
    const classes = [...container.querySelectorAll("*")]
      .map((element) => (element as HTMLElement).className)
      .join(" ");

    // `h-screen`, `min-h-screen` and `max-h-screen` are all `vh` in Tailwind,
    // and `vh` is the unit that ignores a retracting URL bar.
    expect(classes).not.toMatch(/(^|[\s:])(h|min-h|max-h)-screen(\s|$)/);
    expect(classes).not.toMatch(/\[\d+vh\]/);
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
