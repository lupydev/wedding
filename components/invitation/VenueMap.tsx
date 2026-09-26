import { Navigation } from "lucide-react";
import Image from "next/image";

import venueMap from "@/img/venue-map.jpg";

/**
 * How a guest gets to a venue that has no street address.
 *
 * "Salón para Eventos Villa Campestre" HAS NO ADDRESS. There is no line anybody
 * can type into a maps application, which is why this is not an illustration
 * beside the `Dirección` above it: it is the location. Everything below follows
 * from that one fact.
 *
 * WHAT THE COUPLE ASKED FOR, AND WHAT WAS REJECTED TO GET THERE
 *
 * "Todo lo del zoom etc debe realizarse desde la app, por lo tanto deberia
 * existir un boton de como llegar con las indicaciones ya listas." So the
 * picture is a still, the pinching happens in the Maps application, and the
 * link opens a ROUTE rather than a place page.
 *
 * AN INTERACTIVE EMBEDDED MAP WAS CONSIDERED AND DELIBERATELY REJECTED. Three
 * reasons, recorded so the next reader does not have to rediscover them:
 *
 *  1. An embed that can be pinched also swallows the page scroll. The usual fix
 *     is to make it inert until it is tapped — which is to say, a first tap
 *     that does nothing but arm a second one, in the middle of an invitation
 *     the guest is still reading.
 *  2. Pinching a 320x200 box is worse than the thing it substitutes for. The
 *     Maps application is the whole screen, knows where the guest is standing
 *     and gives turn-by-turn directions; the embed is a keyhole.
 *  3. It pulls map tiles over cellular before the guest has decided they care.
 *     A still image, lazily loaded, costs nothing until it is scrolled to.
 *
 * MOBILE FIRST, AND MEASURED RATHER THAN ASSUMED. These invitations go out over
 * WhatsApp, so close to every guest opens this on a phone. A link in an
 * ordinary WhatsApp message — which is how these are sent — opens in the
 * phone's DEFAULT BROWSER, not in an in-app browser; the in-app browser applies
 * to CTA buttons in Business API templates, which this is not. So the guest
 * really is in Chrome or Safari with a Maps application installed behind it,
 * and `maps/dir/?api=1` really does hand off to it.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/**
 * THE PICTURE AND THE POINT IT WAS DRAWN AROUND ARE ONE FACT, DECLARED ONCE.
 *
 * `img/venue-map.jpg` is a COMMITTED ARTEFACT: OpenStreetMap tiles rendered
 * around the coordinates below, with the pin already painted on. So the
 * coordinates are not a value that happens to sit near an image — they are what
 * the image IS, and the link has to send the guest to the same point the
 * picture shows. Two copies become two venues the day somebody edits one, and
 * that failure is silent: a map of one place beside a route to another, with
 * nothing on the page to compare them. `tools/venue-map-asset.spec.ts` asserts
 * this file is the only source that names the latitude, and that it names it
 * once.
 *
 * WHY THIS IS IN THE SOURCE AT ALL, WHEN `tools/no-source-placeholders.spec.ts`
 * ARGUES THE OPPOSITE. That rule exists because the venue's NAME and ADDRESS
 * live in the `ceremony` row, where an operator corrects them with an UPDATE
 * and no redeploy. This cannot: a coordinate in the database would move the
 * link while the committed picture went on showing the old place, which is a
 * worse version of the drift that rule prevents. Binding both to the same
 * commit is the trade, and the price is stated plainly — MOVING THE WEDDING
 * MEANS REGENERATING THE IMAGE AND DEPLOYING, not editing a row. Taken
 * knowingly, on a wedding whose venue is booked.
 *
 * THE IMAGERY IS OPENSTREETMAP, AND THAT IS A LICENSING DECISION RATHER THAN A
 * PREFERENCE. A Google Maps screenshot cannot be redistributed without
 * licensing; OSM permits it and requires attribution, which is burned into the
 * bottom-right of the file. Recut it from Google and the attribution goes with
 * the rest of the imagery, so the two must be replaced together or not at all.
 *
 * IT IS DRAWN AT 2x AND CROPPED WIDE, BOTH ON PURPOSE. z=13 tiles cropped to
 * the extent of z=12, so the labels stay sharp on a phone. And it reaches far
 * enough north to hold BUGA: an earlier, tighter crop was rejected by the owner
 * precisely because it showed nothing anybody could place. A map a guest cannot
 * locate themselves on is a picture of some roads.
 */
const VENUE_MAP = {
  image: venueMap,
  /** WGS84 decimal degrees, "lat,lon" — the form Google Maps expects. */
  destination: "3.853778,-76.2971633",
} as const;

/**
 * The directions form, not a place page.
 *
 * `dir/?api=1` opens Google Maps with the route already laid in and the guest's
 * own location at the near end — which is what "las indicaciones ya listas"
 * asks for. A `?q=` place link would land them on a card they then have to
 * press "cómo llegar" on, which is the extra step this whole block exists to
 * remove. The URL opens the Google Maps application where one is installed and
 * the web map otherwise.
 *
 * DERIVED from the constant above rather than written beside it, so the
 * coordinates appear exactly once in this repository.
 */
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  VENUE_MAP.destination,
)}`;

/**
 * What the map says to somebody who cannot see it.
 *
 * It describes the PICTURE — the town, the road, the side of Buga the pin is on
 * — because that is what is there. It deliberately does not read as a postal
 * address: there is none, and inventing a street for a venue that has no street
 * would be believed by exactly the reader with no way to check it.
 */
const MAP_DESCRIPTION =
  "Mapa de la zona: el salón Villa Campestre está señalado al sur de Buga, junto a la Troncal de Occidente, cerca de Zanjón Hondo.";

/**
 * The link's name, which opens with the words that are actually on screen.
 *
 * "Cómo llegar" is enough to read and not enough to hear: out of context, in a
 * list of links, it says that it goes somewhere and not where. Leading with the
 * visible label is what WCAG 2.5.3 asks of a control whose name is longer than
 * its label.
 */
const DIRECTIONS_LABEL = "Cómo llegar al salón: abrir la ruta en Google Maps";

export function VenueMap() {
  return (
    /*
      THE WHOLE PICTURE IS THE CONTROL.

      A small link underneath a picture is the two-step problem the rejected
      embed had, wearing different clothes: the thing the thumb goes to is the
      map, so the map is what must be pressable. The visible bar below it is
      what makes that legible — without it the image reads as decoration and
      nobody presses it at all.

      `rsvp__venue-map` is a locator for the browser suite as well as a hook for
      this block's own spacing, in the same family as `rsvp__venue` above it.
    */
    <a
      className="
        rsvp__venue-map block w-full overflow-hidden rounded-2xl
        border border-[#f6efe2]/25 bg-black/25
        transition-colors duration-(--console-motion-fast)
        ease-(--ease-console-out)
        hover:border-[#f6efe2]/50
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-[#f6efe2]
      "
      href={DIRECTIONS_URL}
      target="_blank"
      /*
       * `noopener` first, and not decoration: without it the opened tab can
       * reach back into this one through `window.opener`, and this page sits
       * behind a phone gate. The same reasoning `StreamDetails` gives for the
       * stream link.
       */
      rel="noopener noreferrer"
      aria-label={DIRECTIONS_LABEL}
    >
      {/*
        THE BOX IS RESERVED BEFORE THE PIXELS ARRIVE, AND ITS SHAPE COMES FROM
        THE FILE.

        `fill` inside a box whose `aspect-ratio` is read off the static import,
        exactly as `PhotoStage` frames the wedding photograph. Two things fall
        out of that: the space is held from the first paint, so a lazily-loaded
        image below the fold cannot shove the submit button down under somebody
        reaching for it; and the ratio is the file's own, so recutting the map
        at another shape cannot leave the frame lying about it.

        A CUSTOM PROPERTY, BECAUSE TAILWIND CANNOT COMPILE A RUNTIME VALUE — and
        a single decimal rather than `w / h` for the same reason the print's is:
        it has to survive arithmetic, not only `aspect-ratio`.

        Under Vitest this resolves to `NaN` and nothing turns on it. A static
        image import is a bare string there — the loader that turns one into
        `{ src, width, height }` belongs to the Next build — which is why the
        shape is asserted against the file's own header in
        `tools/venue-map-asset.spec.ts` and against the rendered page in the
        browser suite, rather than here.
      */}
      <span
        className="relative block w-full aspect-[var(--venue-map-ratio)]"
        style={
          {
            "--venue-map-ratio": `${
              VENUE_MAP.image.width / VENUE_MAP.image.height
            }`,
          } as React.CSSProperties
        }
      >
        <Image
          src={VENUE_MAP.image}
          alt={MAP_DESCRIPTION}
          fill
          /*
           * `lazy`, WRITTEN OUT RATHER THAN LEFT TO THE DEFAULT.
           *
           * This sits below the fold, behind an accepted RSVP, on a page whose
           * LCP element is a preloaded wedding photograph — and it is reached
           * over cellular by a guest who opened a WhatsApp message. It must not
           * compete with the picture the page opens with. The value being the
           * default today is not the reason it is safe; the reason is written
           * here, the same way `PhotoStage` writes `preload={false}` on its
           * backdrop.
           */
          loading="lazy"
          /*
           * Full width of the form on a phone; on a laptop the invitation's
           * words sit in one column of `lg:max-w-6xl`, so 576px is the widest
           * this is ever painted. Without a hint the browser assumes `100vw`
           * and fetches a 1920px-wide copy to paint 500 of them.
           */
          sizes="(min-width: 1024px) 576px, 100vw"
          className="object-cover"
        />
      </span>

      {/*
        THE BAR THAT SAYS THE PICTURE IS A BUTTON.

        `min-h-11` is 44px, the smallest target a phone should offer — measured
        on the bar rather than left to the padding, because padding is the first
        thing a later tidy-up rounds down.

        The arrow is `lucide-react`, already the icon set behind the music
        control on these public pages. It is `aria-hidden` and carries no
        meaning the words do not: the link's name is written above.
      */}
      <span
        className="
          rsvp__venue-map__affordance flex min-h-11 w-full items-center
          justify-center gap-2 px-4 py-3 text-sm text-[#f6efe2]
        "
      >
        <Navigation aria-hidden="true" className="size-4 shrink-0" />
        Cómo llegar
      </span>
    </a>
  );
}
