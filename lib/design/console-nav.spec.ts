import { describe, expect, it } from "vitest";

import {
  CONSOLE_BREAKPOINT_PX,
  CONSOLE_BREAKPOINT_VARIANT,
  CONSOLE_NAV_ITEMS,
  CONSOLE_TABBAR_BASE_PX,
  consoleNavActiveSignals,
  isConsoleNavItemActive,
} from "./console-nav";

/**
 * The console shell's navigation, as data.
 *
 * ONE BREAKPOINT, AND THAT IS THE RULE THIS FILE EXISTS TO HOLD.
 *
 * A reference console flipped its table layout at 600px and its navigation at
 * 900px. Between those two widths — every tablet, every landscape phone, every
 * half-width desktop window — it showed a phone tab bar underneath a six-column
 * desktop table. Two breakpoints are not twice the work of one; they are a set of
 * layouts nobody designed.
 */

describe("the single breakpoint", () => {
  it("is one number, used for the navigation and the layout alike", () => {
    expect(CONSOLE_BREAKPOINT_PX).toBe(768);
  });

  it("names the Tailwind variant that matches it, so the two cannot drift", () => {
    // `md` is 48rem, which is 768px at the default root size. Naming both means a
    // reviewer can check the class against the number.
    expect(CONSOLE_BREAKPOINT_VARIANT).toBe("md");
  });
});

describe("the bottom tab bar", () => {
  it("is 56px before the home-indicator inset is added", () => {
    // 56 is the smallest bar that still gives every one of the tabs a 44px touch
    // target with its label underneath.
    expect(CONSOLE_TABBAR_BASE_PX).toBe(56);
  });
});

describe("CONSOLE_NAV_ITEMS", () => {
  it("fits on one bar, so there is no overflow sheet to hide a destination in", () => {
    expect(CONSOLE_NAV_ITEMS.length).toBeGreaterThanOrEqual(3);
    expect(CONSOLE_NAV_ITEMS.length).toBeLessThanOrEqual(5);
  });

  it("labels every destination in the operator's language", () => {
    for (const item of CONSOLE_NAV_ITEMS) {
      expect(item.label).not.toBe("");
      expect(item.label.length).toBeLessThanOrEqual(14);
    }
  });

  it("gives every destination a distinct key and a distinct href", () => {
    expect(new Set(CONSOLE_NAV_ITEMS.map((item) => item.key)).size).toBe(
      CONSOLE_NAV_ITEMS.length,
    );
    expect(new Set(CONSOLE_NAV_ITEMS.map((item) => item.href)).size).toBe(
      CONSOLE_NAV_ITEMS.length,
    );
  });

  it("points only inside the console", () => {
    for (const item of CONSOLE_NAV_ITEMS) {
      expect(item.href).toMatch(/^\/console/);
    }
  });

  it("offers no destination that takes an invitation id", () => {
    // The compose and preview routes are per-household. A tab pointing at one of
    // them would need an id the shell does not have, and a shell that guesses one
    // is a shell that sends somebody to the wrong invitation.
    for (const item of CONSOLE_NAV_ITEMS) {
      expect(item.href).not.toMatch(/\[|:/);
    }
  });
});

describe("isConsoleNavItemActive", () => {
  it("marks the root panel active on the console root", () => {
    expect(isConsoleNavItemActive({ href: "/console" }, "/console")).toBe(true);
  });

  it("does not mark the root panel active on another console page", () => {
    // Prefix matching would light up every tab at once on `/console/device`,
    // because every href starts with `/console`.
    expect(
      isConsoleNavItemActive({ href: "/console" }, "/console/device"),
    ).toBe(false);
  });

  it("marks a sub-page active on its own path", () => {
    expect(
      isConsoleNavItemActive({ href: "/console/device" }, "/console/device"),
    ).toBe(true);
  });

  it("marks a sub-page active on a deeper path beneath it", () => {
    // `/console/dispatch/{id}` belongs to the panel tab, not to no tab at all.
    expect(
      isConsoleNavItemActive({ href: "/console/device" }, "/console/device/x"),
    ).toBe(true);
  });

  /**
   * A JUMP LINK IS NEVER THE CURRENT PAGE.
   *
   * Two tabs point at fragments of the console root. Treating a fragment as a path —
   * which is what ignoring it amounts to — made all three of those tabs active at
   * once on `/console`, because `usePathname()` never carries a hash and all three
   * normalize to the same path. Three highlighted tabs is worse than none: it says
   * the bar does not know where the operator is.
   *
   * The root tab owns `/console`. The jump links are navigation within the page it
   * already renders, and they say so by never claiming to be it.
   */
  it("never marks a jump link as the current page", () => {
    expect(
      isConsoleNavItemActive({ href: "/console#evento" }, "/console"),
    ).toBe(false);
    expect(
      isConsoleNavItemActive({ href: "/console#revision" }, "/console"),
    ).toBe(false);
  });

  it("marks exactly one item active on every path a tab points at", () => {
    // The invariant an end-to-end run caught being violated three ways at once.
    const paths = [
      "/console",
      "/console/device",
      ...CONSOLE_NAV_ITEMS.map((item) => item.href.split("#")[0]),
    ];

    expect(paths.length).toBeGreaterThanOrEqual(4);
    for (const path of paths) {
      const active = CONSOLE_NAV_ITEMS.filter((item) =>
        isConsoleNavItemActive(item, path),
      );

      expect(active).toHaveLength(1);
    }
  });

  it("ignores a trailing slash", () => {
    expect(isConsoleNavItemActive({ href: "/console" }, "/console/")).toBe(
      true,
    );
  });
});

describe("consoleNavActiveSignals", () => {
  /**
   * THREE REDUNDANT SIGNALS, NOT ONE.
   *
   * The operator is holding a phone outdoors, in daylight, at whatever brightness
   * the battery has left. A colour-only active state is invisible there, and it is
   * invisible to a colour-blind reader indoors. Colour, weight and a geometric
   * mark each survive a different failure.
   */
  it("carries three independent signals when a tab is active", () => {
    const signals = consoleNavActiveSignals(true);

    expect(signals.color).toBe(true);
    expect(signals.weight).toBe(true);
    expect(signals.mark).toBe(true);
  });

  it("carries none of them when a tab is not active", () => {
    expect(consoleNavActiveSignals(false)).toEqual({
      color: false,
      weight: false,
      mark: false,
    });
  });
});
