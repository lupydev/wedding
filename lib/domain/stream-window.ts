/**
 * When the stream invitation opens, and where it lives — pure.
 *
 * The page at `/transmision` is reachable from the moment it ships; what waits
 * is the DOOR to it on the landing. The couple's reason is about attention, not
 * secrecy: the landing circulates for months as a save-the-date, and a joining
 * link sitting on it all that time is a link nobody reads in October and
 * everybody has forgotten by November. Held back until the final week, it
 * appears when it is the next thing to act on.
 *
 * SO THIS IS NOT ACCESS CONTROL AND MUST NOT BE MISTAKEN FOR IT. The page has
 * no gate, by decision: whoever types the path reaches it on any day. This
 * module decides when the landing OFFERS it, nothing more.
 */

/** Milliseconds in a day. Named so the arithmetic below reads as prose. */
const DAY = 86_400_000;

/**
 * The path the stream invitation lives at.
 *
 * Declared here rather than in `app/robots.ts` so that both a component and the
 * robots rule can import it without a component reaching into `app/**`. Robots
 * re-exports it, and its own file explains why that path is disallowed.
 */
export const STREAM_PATH = "/transmision";

/**
 * What the door on the landing says, and the ONE place it is written.
 *
 * HERE RATHER THAN IN THE COMPONENT, for the same reason `STREAM_PATH` is: the
 * browser suite locates that link by its words, and a spec cannot import a
 * `"use client"` component without dragging React and `next/link` into a Node
 * runner. A plain string in the domain is reachable from both sides.
 *
 * It earned the move. The constant read "Acompáñanos por Google Meet" until the
 * couple reworded it, `e2e/guest-audio.spec.ts` held its own copy of the old
 * words, and a spec about whether the song survives a navigation was about to
 * go red over a noun it has no opinion on.
 *
 * Guest-facing copy is Spanish, neutral register.
 */
export const STREAM_LINK_LABEL = "Acompáñanos en la transmisión";

/** How long before the ceremony the landing starts offering the stream. */
export const STREAM_WINDOW_DAYS = 7;

/** The instant the landing starts offering the stream. */
export function streamLinkOpensAt(ceremony: Date): Date {
  return new Date(ceremony.getTime() - STREAM_WINDOW_DAYS * DAY);
}

/**
 * Is the landing offering the stream yet?
 *
 * INCLUSIVE at the boundary: "faltando una semana se habilita" reads as at one
 * week it is on, not one millisecond after. The difference is invisible in
 * production and entirely visible in the spec, which is the point of pinning
 * it — a comparison wrong in the other direction by a whole day would look
 * exactly the same here.
 *
 * It never closes again. The ceremony beginning is when the guests who could
 * not travel need these details most, and a window that shut at 17:00 would
 * hide them from everybody still trying to get in.
 *
 * An invalid instant throws rather than resolving either way: silently open
 * publishes the door early, silently closed hides it on the day of the wedding,
 * and both are worse than a loud failure.
 */
export function streamLinkIsOpen(ceremony: Date, now: Date): boolean {
  const opensAt = streamLinkOpensAt(ceremony).getTime();
  const nowMs = now.getTime();

  if (Number.isNaN(opensAt) || Number.isNaN(nowMs)) {
    throw new Error("The stream window received an invalid instant.");
  }

  return nowMs >= opensAt;
}
