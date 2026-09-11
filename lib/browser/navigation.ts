/**
 * The one statement in this codebase that leaves the page.
 *
 * A module rather than an inline `window.location.href = url`, and it has no
 * unit test of its own on purpose: this is the SEAM that makes everything
 * around it testable. jsdom implements no navigation, so a component that
 * assigned `window.location.href` directly could only be tested by asserting
 * against a jsdom "Not implemented" warning. Replacing this object's method in
 * a test lets the dispatch launcher's real ordering — write the event, then
 * navigate, never await — be asserted directly.
 *
 * Its own body is one assignment with no branch, so there is nothing a unit
 * test could establish that the type checker does not. What it does in a real
 * browser is covered by `e2e/console-dispatch.spec.ts`, which follows the
 * navigation for real.
 */
export const browserNavigation = {
  /** Leaves the current page for `url`. Never returns in a real browser. */
  assign(url: string): void {
    window.location.href = url;
  },
};
