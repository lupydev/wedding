import { describe, expect, it } from "vitest";

import {
  buildInvitationMetadataText,
  buildOgCardInvitationLine,
} from "./og-card";

/**
 * The Open Graph preview is read by an UNAUTHENTICATED crawler and is visible
 * to anyone holding a forwarded link. The confirmed product decision is
 * names-only: no wedding date, no venue name, no venue address, no phone.
 *
 * These tests exist because the read model the page loads legitimately carries
 * an RSVP deadline (a date) and could later grow more fields. The metadata text
 * is a PROJECTION, not a redaction: a new field cannot leak by being forgotten,
 * because it is never copied in the first place.
 *
 * The `buildOgCardModel` block that used to open this file went with its only
 * caller. The card IMAGE is a static photograph now — it reads no invitation and
 * takes no parameter — so the projection it was the model for no longer exists,
 * and the names-only rule is enforced entirely on the strings below. The card
 * does carry the couple's line, painted into the asset, but nothing here builds
 * it: identical bytes for every household is what governs the image, and
 * `e2e/invitation-page-og.spec.ts` is where that is asserted.
 */

/** A read model deliberately carrying every value the preview must NOT show. */
const invitationCarryingPrivateDetails = {
  slug: "abcdefghijklmnop",
  // The couple's names come from the `ceremony` row, which is why they are an
  // INPUT here rather than a constant in the module: an immutable card that says
  // the wrong names cannot be corrected, so the names must at least be editable
  // in one place before the invitations go out.
  coupleNames: "Ana y Bruno",
  displayName: "Familia Muñóz",
  greetingName: "Ñoño Muñóz",
  guests: [{ id: "g1", fullName: "Ñoño Muñóz", isChild: false }],
  // Values that only ever exist elsewhere in the product, pinned here so the
  // assertions below fail loudly if the projection is ever widened.
  venueName: "Hacienda El Roble",
  venueAddress: "Calle 100 #15-20",
  phoneE164: "+573005550000",
};

describe("buildOgCardInvitationLine", () => {
  it("states the invitation and names the couple it was given", () => {
    expect(buildOgCardInvitationLine("Ana y Bruno")).toContain("Ana y Bruno");
  });

  it("names a different couple, because the names are not written into it", () => {
    expect(buildOgCardInvitationLine("Camila y Dario")).toContain(
      "Camila y Dario",
    );
  });

  it("adds no date, no venue and no digit of its own", () => {
    // A digit in the shared copy is the shape a leaked date or address takes.
    // Only what the names themselves carry may appear, so the assertion is made
    // with digit-free names and the line must stay digit-free too.
    expect(buildOgCardInvitationLine("Ana y Bruno")).not.toMatch(/\d/);
  });

  it("passes an unfinished value through verbatim rather than hiding it", () => {
    // The row may still hold its seeded placeholder. A card that silently
    // omitted it would read as finished and name nobody.
    expect(buildOgCardInvitationLine("{{COUPLE_NAMES}}")).toContain(
      "{{COUPLE_NAMES}}",
    );
  });
});

describe("buildInvitationMetadataText", () => {
  it("titles the page with the household and describes it with the invitation line", () => {
    const text = buildInvitationMetadataText(invitationCarryingPrivateDetails);

    expect(text).toEqual({
      title: "Ñoño Muñóz",
      description: buildOgCardInvitationLine("Ana y Bruno"),
    });
  });

  it("titles a different household with its own greeting name", () => {
    const text = buildInvitationMetadataText({
      ...invitationCarryingPrivateDetails,
      greetingName: "Familia Restrepo",
    });

    expect(text.title).toBe("Familia Restrepo");
  });

  it("describes the page with the couple it was given, not a compiled-in name", () => {
    const text = buildInvitationMetadataText({
      ...invitationCarryingPrivateDetails,
      coupleNames: "Camila y Dario",
    });

    expect(text.description).toContain("Camila y Dario");
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
