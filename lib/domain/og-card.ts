/**
 * The text of the Open Graph preview, and the page metadata that carries it.
 *
 * Pure on purpose. This is the single piece of this product that an
 * unauthenticated crawler reads and that anyone holding a forwarded link can
 * see, so what it may contain is a business rule, not a rendering detail. It
 * lives here, next to the other domain rules, and is unit-testable without a
 * browser, a database or a running Next.js server.
 *
 * Confirmed product decision: the preview is NAMES ONLY. No wedding date, no
 * venue name, no venue address, no phone number.
 *
 * WHERE THAT RULE NOW APPLIES. It used to govern two things: these strings, and
 * a model projected onto the card IMAGE. The image is a static photograph now —
 * `buildOgCardModel` and `OgCardModel` were deleted with their last caller — so
 * nothing here is projected onto it. The words it does carry, the couple's line,
 * are painted into `img/og-card.jpg` itself and are the same for every
 * household; `openspec/specs/invitation-page/spec.md` is where that narrower
 * rule lives. What WhatsApp shows BESIDE the thumbnail is built here and emitted
 * by `app/i/[slug]/page.tsx`, which makes this file the only place a HOUSEHOLD's
 * name reaches a preview.
 */

/**
 * The one line of copy every card shares, with the couple's names in it.
 *
 * A FUNCTION AND NOT A CONSTANT, AND THE REASON IS THE CACHE
 *
 * It used to be a module constant whose only variable part was a brace-wrapped
 * placeholder, because the couple had not supplied their names yet. The
 * instinct was right — inventing names ships a wrong invitation that reads as a
 * correct one — and the location was wrong. This card is served
 * `immutable, max-age=31536000` and WhatsApp caches a preview per URL, so the
 * names on it are the single fact in this product that reaches a guest through a
 * channel nothing can correct afterwards. Keeping them in the `ceremony` row does
 * not make an already-delivered card editable, but it does mean they can be
 * fixed BEFORE the first dispatch without a deploy, and the console can warn
 * about the cache at the moment somebody edits them.
 *
 * The line adds no digits of its own. A digit here is exactly the shape a leaked
 * date or street address would take, and the card is names-only by confirmed
 * product decision. Whatever the names themselves carry is passed through
 * verbatim, placeholders included: a card that quietly omitted an unfinished
 * value would read as finished and name nobody.
 *
 * Guest-facing copy is Spanish; identifiers and comments stay English.
 */
export function buildOgCardInvitationLine(coupleNames: string): string {
  return `Nos casamos — ${coupleNames}`;
}

/**
 * Everything the card and the metadata are built from.
 *
 * The household's own name, and the couple's names from the `ceremony` row. Two
 * inputs, and deliberately no third: the read model this is projected from also
 * carries an RSVP deadline, and the row it is projected from also carries the
 * venue, the address and a Zoom passcode. None of them are named here, so none
 * of them can reach a public card by being forgotten.
 */
export interface OgCardSource {
  readonly greetingName: string;
  readonly coupleNames: string;
}

/** The server-rendered `<title>` / `og:title` and `og:description` text. */
export interface InvitationMetadataText {
  readonly title: string;
  readonly description: string;
}

/**
 * Builds the server-rendered metadata text for one invitation.
 *
 * A PROJECTION rather than a redaction, for the same reason
 * `toGuestFacingInvitation` is: a field added to the read model tomorrow cannot
 * leak into a public preview by being forgotten here, because nothing is copied
 * except the two values `OgCardSource` names.
 *
 * These strings end up in `og:title` and `og:description`, which WhatsApp shows
 * beside the thumbnail in the preview bubble and which travel with every
 * forward of the link. Since the card image became a photograph carrying no
 * text, they are the WHOLE of what a forwarded link says about a household.
 */
export function buildInvitationMetadataText(
  invitation: OgCardSource,
): InvitationMetadataText {
  return {
    title: invitation.greetingName,
    description: buildOgCardInvitationLine(invitation.coupleNames),
  };
}
