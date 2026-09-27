import { Navigation } from "lucide-react";

import { VENUE_COORDINATES } from "@/lib/domain/wedding-day";

/**
 * How a guest gets to a venue that has no street address.
 *
 * "Salón para Eventos Villa Campestre" HAS NO ADDRESS. There is no line
 * anybody can type into a maps application, which is why this is not a
 * convenience beside a `Dirección` above it: it is the only way the location
 * reaches a guest at all. Everything below follows from that one fact.
 *
 * WHAT THE COUPLE ASKED FOR, AND WHAT WAS REJECTED TO GET THERE
 *
 * "Todo lo del zoom etc debe realizarse desde la app, por lo tanto deberia
 * existir un boton de como llegar con las indicaciones ya listas." So the
 * pinching happens in the Maps application and the link opens a ROUTE rather
 * than a place page.
 *
 * AN INTERACTIVE EMBEDDED MAP WAS CONSIDERED AND DELIBERATELY REJECTED. Two
 * reasons, recorded so the next reader does not have to rediscover them:
 *
 *  1. An embed that can be pinched also swallows the page scroll. The usual
 *     fix is to make it inert until it is tapped — which is to say, a first
 *     tap that does nothing but arm a second one, in the middle of an
 *     invitation the guest is still reading.
 *  2. Pinching a 320x200 box is worse than the thing it substitutes for. The
 *     Maps application is the whole screen, knows where the guest is standing
 *     and gives turn-by-turn directions; the embed is a keyhole.
 *
 * AND THE STILL PICTURE OF THE MAP IS GONE TOO, ON THE COUPLE'S OWN
 * INSTRUCTION: "en la parte de abajo de la pantalla lugar y solamente el boton
 * de como llegar SIN UNA IMAGEN." It was `img/venue-map.jpg`, 118 kB of
 * committed OpenStreetMap tiles with the pin painted on, and it is deleted
 * rather than hidden — the file, its `tools/venue-map-asset.spec.ts` shape
 * guard, and the `next/image` frame that reserved its box. What the picture
 * was FOR survives in the link: it showed the guest where they were going, and
 * the Maps application shows them that at the whole size of their screen with
 * their own position on it. The third reason for a still — that it costs
 * nothing until it is scrolled to — argued for a picture over an embed, never
 * for a picture over nothing.
 *
 * MOBILE FIRST, AND MEASURED RATHER THAN ASSUMED. These invitations go out
 * over WhatsApp, so close to every guest opens this on a phone. A link in an
 * ordinary WhatsApp message — which is how these are sent — opens in the
 * phone's DEFAULT BROWSER, not in an in-app browser; the in-app browser
 * applies to CTA buttons in Business API templates, which this is not. So the
 * guest really is in Chrome or Safari with a Maps application installed behind
 * it, and `maps/dir/?api=1` really does hand off to it.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/*
  THE COORDINATE MOVED TO `lib/domain/wedding-day.ts`, AND THE REASON IS A
  SECOND READER.

  It lived here, module-private, with the argument that the coordinates
  "appear exactly once in this repository". That argument did not change —
  what changed is that the calendar entry an accepted household saves now
  carries the venue's location too, and `lib/domain/calendar-event.ts` cannot
  import a component. Leaving it here would have meant a second copy in the
  domain, which is the exact failure the original note describes: two venues
  the day somebody edits one, and a guest sent to the wrong side of Buga who
  finds out on the afternoon of the wedding.

  So it sits beside the wedding's other committed facts — the instant, the
  dress code, the deadline — and the whole of its reasoning went with it,
  including the trade it names: MOVING THE WEDDING MEANS A DEPLOY.
  `tools/venue-coordinates.spec.ts` follows it and still asserts exactly one
  source names the latitude.
*/

/**
 * The directions form, not a place page.
 *
 * `dir/?api=1` opens Google Maps with the route already laid in and the
 * guest's own location at the near end — which is what "las indicaciones ya
 * listas" asks for. A `?q=` place link would land them on a card they then
 * have to press "cómo llegar" on, which is the extra step this whole block
 * exists to remove. The URL opens the Google Maps application where one is
 * installed and the web map otherwise.
 *
 * DERIVED from the constant above rather than written beside it, so the
 * coordinates appear exactly once in this repository.
 */
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  VENUE_COORDINATES,
)}`;

/**
 * The link's name, which opens with the words that are actually on screen.
 *
 * "Cómo llegar" is enough to read and not enough to hear: out of context, in a
 * list of links, it says that it goes somewhere and not where. Leading with
 * the visible label is what WCAG 2.5.3 asks of a control whose name is longer
 * than its label.
 */
const DIRECTIONS_LABEL = "Cómo llegar al salón: abrir la ruta en Google Maps";

export function VenueMap() {
  return (
    /*
      THE CONTROL IS THE WHOLE WIDTH, BECAUSE IT IS THE ONLY ONE ON THE SCREEN.

      It was a bar under a picture, and the picture was the tap target; with
      the picture gone the bar is the control and has to look like one. The
      shape is the pill `StreamDetails` gives "Entrar a la transmisión" — the
      same decision on the other ending of the same question, so the two
      screens a household can reach offer their one way out in the same object
      rather than two that happen to match today.

      `min-h-11` is 44px, the smallest target a phone should offer — measured
      on the element rather than left to the padding, because padding is the
      first thing a later tidy-up rounds down.

      `border-[#f6efe2]/50` RATHER THAN THE `/40` THE SEND BUTTON USES, and
      the difference is measured rather than a slip. WCAG holds the boundary of
      a control to 3:1 against what is around it, because an invisible control
      is not a contrast problem — it is a missing control. At `/40` this edge
      reads 2.90:1 against the ground at the foot of the accepted screen; at
      `/50` it reads 3.65:1. The send button is not held to the same number
      because it is not in the same place: it sits inside the form's own panel,
      higher up the photograph, under a household's thumb on a screen that has
      a heading, a list and a deadline around it. This one is alone at the foot
      of the last screen with the picture that used to announce it deleted.
      `app/i/[slug]/confirm-legibility.spec.tsx` carries the arithmetic.

      `rsvp__venue-map` survives as the locator the browser suite already
      points at. It names the block rather than the picture that used to be in
      it, and renaming it would cost more than it is worth.
    */
    <a
      className="
        rsvp__venue-map flex min-h-11 w-full items-center justify-center gap-2
        rounded-full border border-[#f6efe2]/60 bg-[#f6efe2]/10 px-5 py-3
        text-sm text-[#f6efe2] backdrop-blur-sm transition-colors
        duration-(--console-motion-fast) ease-(--ease-console-out)
        hover:bg-[#f6efe2]/20
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
        The arrow is `lucide-react`, already the icon set behind the music
        control on these public pages. It is `aria-hidden` and carries no
        meaning the words do not: the link's name is written above.
      */}
      <Navigation aria-hidden="true" className="size-4 shrink-0" />
      Cómo llegar
    </a>
  );
}
