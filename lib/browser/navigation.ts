/**
 * The two statements in this codebase that send a browser somewhere.
 *
 * A module rather than an inline `window.location.href = url`, and `assign`
 * has no unit test of its own on purpose: this is the SEAM that makes
 * everything around it testable. jsdom implements no navigation, so a
 * component that assigned `window.location.href` directly could only be tested
 * by asserting against a jsdom "Not implemented" warning. Replacing these
 * methods in a test lets the dispatch launcher's real ordering — write the
 * event, then hand off, never await — be asserted directly.
 *
 * `assign`'s body is one assignment with no branch, so there is nothing a unit
 * test could establish that the type checker does not. What it does in a real
 * browser is covered by `e2e/console-dispatch.spec.ts`, which follows the
 * handoff for real.
 *
 * `openInNewTab` DOES have a spec, and the reason is the one string in it that
 * types cannot check. See `navigation.spec.ts`.
 */
export const browserNavigation = {
  /**
   * Leaves the current page for `url`.
   *
   * Never returns in a real browser when `url` is an ordinary page. A custom
   * scheme is the exception: the browser hands it to the operating system and
   * this document stays exactly where it was, which is what the dispatch
   * launcher's `whatsapp://` handoff relies on.
   */
  assign(url: string): void {
    window.location.href = url;
  },

  /**
   * Opens `url` in a new tab and KEEPS the current page where it is.
   *
   * WHY THE CALLER NEEDS THE CURRENT PAGE TO SURVIVE
   *
   * The console's dispatch offers a `wa.me` fallback for the case where the
   * `whatsapp://` handoff reached nobody. Navigating there would take the
   * operator off the screen carrying "¿Se envió el mensaje?", so they would
   * have to find their way back to record a send they had already made. The
   * couple asked for a new tab — "debe abrirse en una nueva pestaña no en la
   * actual" — and the audit trail is the reason it is not a preference.
   *
   * WHY `noopener` IS IN THE FEATURE STRING
   *
   * Without it the opened page gets a live handle on this one through
   * `window.opener` and can navigate it. On an anchor that guarantee is spelled
   * `rel="noopener"`, which a reviewer recognises on sight; the fallback is a
   * button — deliberately, so no unrecorded route to WhatsApp exists — and a
   * button has no `rel`. This string is the only place the guarantee can live,
   * which is exactly why it has a test rather than a comment.
   *
   * Nothing reads the return value, and nothing can: `window.open` answers with
   * `null` whenever `noopener` is set. The caller must be inside the user's own
   * click for the tab to be allowed at all, so this stays a plain synchronous
   * call with nothing awaited before it.
   */
  openInNewTab(url: string): void {
    window.open(url, "_blank", "noopener");
  },
};
