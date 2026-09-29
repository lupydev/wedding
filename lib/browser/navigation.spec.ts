// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { browserNavigation } from "./navigation";

/**
 * ONE OF THIS SEAM'S TWO METHODS IS TESTED HERE, AND THE OTHER DELIBERATELY IS
 * NOT.
 *
 * `assign` is one assignment with no branch and no arguments of its own —
 * there is nothing a unit test could establish about it that the type checker
 * does not, and `navigation.ts` says so. `openInNewTab` is different in one
 * specific way: it passes a STRING LITERAL that carries a security property
 * the type system cannot see.
 *
 * `noopener` is what stops the opened page from receiving a handle on the
 * console's own `window` through `window.opener`. On an anchor that guarantee
 * would be `rel="noopener"`, which a reviewer recognises on sight; the
 * fallback is a button, so it has nowhere to live except inside this feature
 * string. A refactor that dropped the third argument, or replaced it with
 * `"_blank"` for symmetry, would compile, would still open the tab, would pass
 * every test in `DispatchLauncher.spec.tsx` — and would hand `wa.me` a
 * reference to the console. That is the one thing worth pinning here.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe("browserNavigation.openInNewTab", () => {
  it("opens the url in a new tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    browserNavigation.openInNewTab("https://wa.me/573001234567?text=Hola");

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe("https://wa.me/573001234567?text=Hola");
    expect(open.mock.calls[0][1]).toBe("_blank");
  });

  it("severs the opened page's handle on this window", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    browserNavigation.openInNewTab("https://wa.me/1?text=Hola");

    expect(open.mock.calls[0][2]).toContain("noopener");
  });

  it("ignores the handle, because `noopener` means there is never one", () => {
    // `window.open` returns null whenever `noopener` is set. Code that read
    // the return value would be reading null forever and would eventually grow
    // a branch for a case that cannot happen.
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(() =>
      browserNavigation.openInNewTab("https://wa.me/1?text=Hola"),
    ).not.toThrow();
  });

  it("does not touch the current location", () => {
    // The whole point of the method. A `window.location.href` slipped in here
    // would take the console away and the dispatch confirmation with it.
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const before = window.location.href;

    browserNavigation.openInNewTab("https://wa.me/1?text=Hola");

    expect(open).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe(before);
  });
});
