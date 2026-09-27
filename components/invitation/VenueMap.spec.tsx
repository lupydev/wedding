import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VenueMap } from "./VenueMap";

/**
 * The way to the venue, which is the only directions a guest gets.
 *
 * "Salón para Eventos Villa Campestre" HAS NO STREET ADDRESS. There is no line
 * a guest can type into anything, so this control is not decoration beside the
 * venue's name — it is the only way the location reaches a guest at all.
 *
 * THE PICTURE IT USED TO CARRY IS GONE, on the couple's own instruction:
 * "solamente el botón de cómo llegar sin una imagen." Three assertions went
 * with it — that the image was the tap target, that its description named Buga
 * without inventing a street, and that it loaded lazily — because each of them
 * described something that is no longer on the screen. Two replace them: that
 * no picture came back, and that the link itself is a 44px target, which the
 * browser suite used to measure on the bar UNDER the picture and now measures
 * on the control that IS the bar.
 *
 * WHAT THESE TESTS ARE ACTUALLY PROTECTING
 *
 * The destination is declared in one place, and the assertions below are
 * written as LITERALS rather than read back off that declaration. A test that
 * imported the constant and compared it to the rendered href would assert a
 * constant against itself: it would still pass after somebody moved the pin to
 * the wrong field, which is the single edit most likely to send a hundred
 * guests to the wrong side of Buga — and, with the picture gone, there is no
 * longer anything on the screen for a guest to notice the mistake against.
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
   * NOTHING TO PINCH, AND NOTHING TO LOOK AT EITHER.
   *
   * An embedded, pinchable map was considered and rejected — it needs a tap to
   * activate before it can be pinched, or it swallows the page scroll of an
   * invitation the guest is still reading. A still picture replaced it, and
   * the couple then asked for the picture to go too. What is left has to be
   * the whole of this block: an `<img>` reappearing here means somebody has
   * put 118 kB of committed tiles back on the screen the couple emptied.
   */
  it("shows the guest no picture of the map", () => {
    render(<VenueMap />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  /**
   * AND IT IS A TARGET A THUMB CAN FIND.
   *
   * 44px is the smallest a phone should offer. It used to be measured on the
   * "Cómo llegar" bar under the picture, because the picture was the link and
   * its height was never in doubt. The bar is the link now, so the floor moved
   * onto it — and it is declared rather than left to the padding, which is the
   * first thing a later tidy-up rounds down.
   */
  it("is big enough to press on a phone", () => {
    render(<VenueMap />);

    expect(mapLink().className).toContain("min-h-11");
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
});
