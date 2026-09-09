import { describe, expect, it } from "vitest";

import {
  buildInvitationMetadataText,
  buildOgCardModel,
  OG_CARD_INVITATION_LINE,
} from "./og-card";

/**
 * The Open Graph card is fetched by an UNAUTHENTICATED crawler and is visible
 * to anyone holding a forwarded link. The confirmed product decision is
 * names-only: no wedding date, no venue name, no venue address, no phone.
 *
 * These tests exist because the read model the page loads legitimately carries
 * an RSVP deadline (a date) and could later grow more fields. The card model is
 * a PROJECTION, not a redaction: a new field cannot leak by being forgotten,
 * because it is never copied in the first place.
 */

/** A read model deliberately carrying every value the card must NOT show. */
const invitationCarryingPrivateDetails = {
  slug: "abcdefghijklmnop",
  displayName: "Familia Muñóz",
  greetingName: "Ñoño Muñóz",
  seatsAllowed: 3,
  rsvpDeadline: "2027-05-01",
  guests: [{ id: "g1", fullName: "Ñoño Muñóz", isChild: false }],
  // Values that only ever exist elsewhere in the product, pinned here so the
  // assertions below fail loudly if the projection is ever widened.
  venueName: "Hacienda El Roble",
  venueAddress: "Calle 100 #15-20",
  phoneE164: "+573005550000",
};

describe("buildOgCardModel", () => {
  it("carries the greeting name and the invitation line", () => {
    const model = buildOgCardModel(invitationCarryingPrivateDetails);

    expect(model).toEqual({
      greetingName: "Ñoño Muñóz",
      invitationLine: OG_CARD_INVITATION_LINE,
    });
  });

  it("carries a different household's greeting name unchanged", () => {
    const model = buildOgCardModel({
      ...invitationCarryingPrivateDetails,
      greetingName: "Familia Restrepo",
    });

    expect(model.greetingName).toBe("Familia Restrepo");
    expect(model.invitationLine).toBe(OG_CARD_INVITATION_LINE);
  });

  it("exposes no field beyond the greeting name and the invitation line", () => {
    const model = buildOgCardModel(invitationCarryingPrivateDetails);

    expect(Object.keys(model).sort()).toEqual([
      "greetingName",
      "invitationLine",
    ]);
  });

  it("renders no wedding date, venue or phone into any card value", () => {
    const model = buildOgCardModel(invitationCarryingPrivateDetails);
    const rendered = Object.values(model).join(" ");

    expect(rendered).toContain("Ñoño Muñóz");
    for (const secret of [
      "2027-05-01",
      "2027",
      "Hacienda El Roble",
      "Calle 100 #15-20",
      "+573005550000",
      "3005550000",
    ]) {
      expect(rendered).not.toContain(secret);
    }
  });
});

describe("OG_CARD_INVITATION_LINE", () => {
  it("states the invitation without a date, a venue or a digit", () => {
    expect(OG_CARD_INVITATION_LINE).toContain("{{COUPLE_NAMES}}");
    // A digit in the shared line is the shape a leaked date or address takes.
    expect(OG_CARD_INVITATION_LINE).not.toMatch(/\d/);
  });
});

describe("buildInvitationMetadataText", () => {
  it("titles the page with the household and describes it with the invitation line", () => {
    const text = buildInvitationMetadataText(invitationCarryingPrivateDetails);

    expect(text).toEqual({
      title: "Ñoño Muñóz",
      description: OG_CARD_INVITATION_LINE,
    });
  });

  it("titles a different household with its own greeting name", () => {
    const text = buildInvitationMetadataText({
      ...invitationCarryingPrivateDetails,
      greetingName: "Familia Restrepo",
    });

    expect(text.title).toBe("Familia Restrepo");
  });

  it("leaks no wedding date, venue or phone into the metadata text", () => {
    const text = buildInvitationMetadataText(invitationCarryingPrivateDetails);
    const rendered = `${text.title} ${text.description}`;

    for (const secret of [
      "2027-05-01",
      "Hacienda El Roble",
      "Calle 100 #15-20",
      "+573005550000",
      "3005550000",
    ]) {
      expect(rendered).not.toContain(secret);
    }
  });
});
