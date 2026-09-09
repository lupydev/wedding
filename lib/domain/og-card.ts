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
 * The one line of copy shared by every card.
 *
 * `{{COUPLE_NAMES}}` is an explicit, unresolved placeholder: the couple has not
 * supplied their names yet, and inventing them would ship a wrong invitation
 * that reads as a correct one. It is intentionally free of digits — a date or a
 * street address is exactly what a digit in this line would be.
 *
 * Guest-facing copy is Spanish; identifiers and comments stay English.
 */
export const OG_CARD_INVITATION_LINE = "Nos casamos — {{COUPLE_NAMES}}";

/** The household identity the card and the metadata are built from. */
export interface OgCardSource {
  readonly greetingName: string;
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
    invitationLine: OG_CARD_INVITATION_LINE,
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
    description: OG_CARD_INVITATION_LINE,
  };
}
