import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VenueMap } from "./VenueMap";

/**
 * The map, which is the only directions a guest gets.
 *
 * "Salón para Eventos Villa Campestre" HAS NO STREET ADDRESS. There is no line
 * a guest can type into anything, so this block is not decoration beside the
 * venue's name — it is the venue's location, and the link is the only way to
 * turn it into a route.
 *
 * WHAT THESE TESTS ARE ACTUALLY PROTECTING
 *
 * The destination and the picture are one fact declared in one place, and the
 * assertions below are written as LITERALS rather than read back off that
 * declaration. A test that imported the constant and compared it to the
 * rendered href would assert a constant against itself: it would still pass
 * after somebody moved the pin to the wrong field, which is the single edit
 * most likely to send a hundred guests to the wrong side of Buga.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/**
 * The exact address bar Google Maps must be handed, written out by hand.
 *
 * `dir/?api=1` is the DIRECTIONS form, not a place page: the couple asked for
 * "un boton de como llegar con las indicaciones ya listas", so the guest must
 * land on a route with their own location already at one end, not on a card
 * they then have to press "directions" on. `%2C` is the comma between the two
 * decimal degrees, percent-encoded because it is a value inside a query
 * parameter.
 */
const DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=3.853778%2C-76.2971633";

function mapLink(): HTMLElement {
  return screen.getByRole("link", { name: /Cómo llegar/ });
}

describe("VenueMap", () => {
  it("hands Google Maps a route rather than a place to look at", () => {
    render(<VenueMap />);

    expect(mapLink()).toHaveAttribute("href", DIRECTIONS_URL);
  });

  /**
   * THE WHOLE PICTURE IS THE CONTROL.
   *
   * An embedded, pinchable map was considered and rejected: it needs a tap to
   * activate before it can be pinched, or it swallows the page scroll of an
   * invitation the guest is still reading. What replaced it only works if the
   * image itself is the tap target — a small link underneath a picture is the
   * same two-step problem wearing different clothes.
   */
  it("makes the picture itself the tap target, not a link beside it", () => {
    render(<VenueMap />);

    expect(mapLink()).toContainElement(screen.getByRole("img"));
  });

  /**
   * `noopener` FIRST, AND NOT DECORATION — the same reasoning `StreamDetails`
   * gives for the stream link. Without it the opened tab can reach back into
   * this one through `window.opener`, and this page sits behind a phone gate.
   */
  it("opens away from the invitation without handing the new tab this page", () => {
    render(<VenueMap />);

    const link = mapLink();

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  /**
   * THE NAME SAYS WHERE IT GOES, NOT JUST THAT IT GOES SOMEWHERE.
   *
   * "Cómo llegar" alone is the visible label and it is enough to read; it is
   * not enough to HEAR out of context, where a list of links reads as a list of
   * names with nothing to tell them apart. The accessible name opens with the
   * visible text, which is what WCAG 2.5.3 asks of a control whose name is
   * longer than its label.
   */
  it("says out loud where it is about to send the guest", () => {
    render(<VenueMap />);

    expect(
      screen.getByRole("link", {
        name: "Cómo llegar al salón: abrir la ruta en Google Maps",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cómo llegar")).toBeVisible();
  });

  /**
   * THE DESCRIPTION IS OF THE MAP, AND IT IS NOT AN ADDRESS.
   *
   * Two separate failures are guarded here. A reader who cannot see the picture
   * gets nothing at all from "mapa", so the description names the venue and
   * anchors it to the town — Buga is in the frame precisely because the owner
   * rejected a tighter crop that showed nothing anybody could place, and a
   * description that dropped it would throw that away for the one reader who
   * cannot recover it from the pixels.
   *
   * And it must not read as a POSTAL ADDRESS. There is none; writing one here
   * would invent a street for a venue that has no street, and it would be
   * believed.
   */
  it("describes the map without inventing a street for a venue that has none", () => {
    render(<VenueMap />);

    const description = screen.getByRole("img").getAttribute("alt") ?? "";

    expect(description).toMatch(/Villa Campestre/);
    expect(description).toMatch(/Buga/);
    expect(description).not.toMatch(
      /\b(calle|carrera|cra\.?|cll\.?|avenida|av\.)\b|#\s*\d/i,
    );
  });

  /**
   * IT MUST NOT COMPETE WITH THE PHOTOGRAPH ABOVE IT.
   *
   * This sits below the fold, behind an accepted RSVP, on a page whose LCP
   * element is a preloaded wedding photograph — and roughly 99% of guests open
   * it from WhatsApp on a phone, over cellular. Written out rather than left to
   * the default for the same reason `PhotoStage` writes `preload={false}` on
   * its backdrop: the value is a decision about this page's loading order, and
   * a default that changes underneath is a decision nobody re-made.
   */
  it("waits its turn behind the photograph the page opens with", () => {
    render(<VenueMap />);

    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });
});
