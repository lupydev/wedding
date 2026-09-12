/**
 * The Open Graph card model, and the page metadata text that accompanies it.
 *
 * Pure on purpose. The card is the single piece of this product that an
 * unauthenticated crawler renders and that anyone holding a forwarded link can
 * see, so what it may contain is a business rule, not a rendering detail. It
 * lives here, next to the other domain rules, and is unit-testable without a
 * browser, a database or a running Next.js server.
 *
 * Confirmed product decision: the card is NAMES ONLY. No wedding date, no
 * venue name, no venue address, no phone number.
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

/** Exactly what the card renders. Two strings, and nothing else exists. */
export interface OgCardModel {
  readonly greetingName: string;
  readonly invitationLine: string;
}

/** The server-rendered `<title>` / `og:title` and `og:description` text. */
export interface InvitationMetadataText {
  readonly title: string;
  readonly description: string;
}

/**
 * Projects an invitation onto the card.
 *
 * A projection rather than a redaction, for the same reason
 * `toGuestFacingInvitation` is: a field added to the read model tomorrow cannot
 * leak onto a public card by being forgotten here, because nothing is copied
 * except the two values named below.
 */
export function buildOgCardModel(invitation: OgCardSource): OgCardModel {
  return {
    greetingName: invitation.greetingName,
    invitationLine: buildOgCardInvitationLine(invitation.coupleNames),
  };
}

/**
 * Builds the server-rendered metadata text for one invitation.
 *
 * Same names-only rule as the card: these strings end up in `og:title` and
 * `og:description`, which WhatsApp shows beside the image in the preview
 * bubble and which travel with every forward of the link.
 */
export function buildInvitationMetadataText(
  invitation: OgCardSource,
): InvitationMetadataText {
  return {
    title: invitation.greetingName,
    description: buildOgCardInvitationLine(invitation.coupleNames),
  };
}
