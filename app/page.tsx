import type { Metadata } from "next";
import Image from "next/image";

import compromiso from "@/img/compromiso.jpg";

import { MusicToggle } from "@/components/landing/MusicToggle";
import { SaveTheDate } from "@/components/landing/SaveTheDate";
import { StreamLink } from "@/components/landing/StreamLink";
import { COUPLE_NAMES, formatWeddingDate } from "@/lib/domain/wedding-day";

/**
 * The public save-the-date.
 *
 * THIS IS NOT THE INVITATION AND IT MUST NEVER BECOME ONE.
 *
 * `/` is public and indexable. It carries the couple, the day and a countdown —
 * nothing else. No guest name, no address, no phone number, no RSVP: those live
 * at `/i/[slug]` behind the phone gate, and `app/robots.ts` keeps that prefix
 * out of every search index precisely because an invitation URL is an unlisted
 * capability. Adding a venue or a stream credential to this file would move a
 * private fact onto a page anyone can find.
 *
 * The route composes and does not decide. All copy lives in `SaveTheDate`; the
 * only thing this file owns is the photograph, the scrim over it, and where the
 * two blocks sit on top.
 */

/** Served from `public/`, which is the only folder Next serves verbatim. */
const SONG_SRC = "/audio/nuestra-cancion.mp3";

/**
 * What a crawler and a WhatsApp preview see.
 *
 * `metadataBase` is set once in `app/layout.tsx`, so the relative image path
 * below resolves to an absolute HTTPS URL. Without it the emitted `og:image`
 * stays relative and no external crawler can fetch it — the same trap the
 * per-guest card at `/i/[slug]/opengraph-image.tsx` already documents.
 *
 * `compromiso.src` rather than a written path: the static import is
 * content-hashed at build time, so a literal would break on the first change to
 * the photograph and would do it silently, in the preview card only.
 */
const TITLE = `${COUPLE_NAMES} — ${formatWeddingDate()}`;
const DESCRIPTION = "Nos casamos, y queremos celebrarlo con ustedes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "es_CO",
    images: [
      {
        url: compromiso.src,
        width: compromiso.width,
        height: compromiso.height,
        alt: `${COUPLE_NAMES}, tomados de la mano frente a una cascada`,
      },
    ],
  },
};

export default function Home() {
  return (
    /*
     * `min-h-dvh`, not `min-h-screen`. On a phone `100vh` is the viewport with
     * the browser chrome HIDDEN, so a full-height hero is taller than what is
     * actually on screen and the countdown sits under the address bar until the
     * visitor scrolls. `dvh` tracks the chrome as it collapses.
     *
     * The background colour is the photograph's own darkness. It is what fills
     * the frame for the instant before the image decodes, so the page never
     * flashes white — on a hero this dark, white is the only visible failure.
     */
    <main className="relative min-h-dvh overflow-hidden bg-[#0d1114]">
      {/*
        THE BACKDROP: THE SAME PHOTOGRAPH, TINY AND BLURRED.

        The portrait is 737×1600 and no landscape window shares that shape, so
        showing ALL of it always leaves bars at the sides. Painted flat they read
        as a layout that failed; filled with the photograph's own greens and that
        lantern gold, out of focus, they read as depth.

        `sizes="64px"` is the whole trick and it is not a typo. The browser
        fetches a 64px-wide copy — about two kilobytes — and a 64px image blurred
        by 64px is indistinguishable from a full-resolution one blurred by 64px.
        Asking for the real thing twice would double the weight of the page to
        render something nobody can focus on.

        `preload={false}`: the sharp photograph below is the LCP element and this
        must not compete with it for the connection.
      */}
      <Image
        src={compromiso}
        alt=""
        aria-hidden="true"
        fill
        preload={false}
        sizes="64px"
        className="scale-110 object-cover opacity-55 blur-3xl"
      />

      {/*
        ONE GRID, TWO LAYOUTS, AND THE BREAKPOINT IS WHERE THE SHAPES STOP
        MATCHING.

        Both children are placed in the SAME cell on a narrow screen — row 1,
        column 1 — so they overlap and the words sit on the photograph, which is
        the design that works when the viewport and the photograph are the same
        shape. At `lg` the grid grows a second column and the words move into
        it, because on a wide screen a 0.46:1 portrait cannot fill the frame and
        pretending otherwise produced the two failures this replaced: cropped to
        fill, three quarters of the photograph was thrown away and the couple
        were cut at the knees; contained to fit, it became a phone screenshot
        marooned in a black page with the heading still lying across them.

        Grid placement rather than two separate trees, so there is ONE copy of
        the photograph and ONE copy of the words at every size.
      */}
      <div
        className="
          relative grid min-h-dvh grid-cols-1
          lg:mx-auto lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:px-8
        "
      >
        <figure
          className="
            relative col-start-1 row-start-1 m-0 h-dvh w-full
            lg:mx-auto lg:aspect-[737/1600] lg:h-[86dvh] lg:w-auto
            lg:overflow-hidden lg:rounded-2xl
            lg:shadow-[0_24px_80px_rgba(0,0,0,0.6)] lg:ring-1 lg:ring-white/10
          "
        >
          <Image
            src={compromiso}
            alt="Luis y Michell abrazados en un sendero, con una cascada iluminada detrás"
            fill
            /*
             * `preload`, NOT `priority`. `priority` is deprecated as of Next 16
             * (see the `image` API reference, "Version History", v16.0.0); this
             * is the LCP element, so it is preloaded from the `<head>` rather
             * than discovered later in the body.
             */
            preload
            /*
             * Generated by the static import at build time. On a photograph
             * this dark the blur-up is not decoration — it is what makes the
             * frame look deliberate for the few hundred milliseconds before the
             * real pixels land.
             */
            placeholder="blur"
            /*
             * Framed, the photograph is about 400px across on a laptop, never
             * half the viewport. `100vw` there would fetch a 1920px-wide copy
             * to paint 400 of them.
             */
            sizes="(min-width: 1024px) 30vw, 100vw"
            /*
             * `object-fit` is not a prop — removed in Next 13 — so it is a
             * utility class.
             *
             * `contain` below `lg`, where the figure is the whole viewport and
             * its shape is the phone's, not the photograph's: at 390×844 that
             * is 0.462:1 against the photograph's 0.4606:1, so contain and
             * cover resolve to the same pixels and any other phone gets thin
             * bars instead of a crop.
             *
             * `cover` at `lg`, where the figure carries `aspect-[737/1600]` —
             * the photograph's own ratio. Cover and contain agree there too, by
             * construction, and cover is the one that cannot leave a hairline
             * of background inside the rounded frame from a rounding error.
             */
            className="object-contain lg:object-cover"
          />
        </figure>

        {/*
          THE SCRIMS ARE FOR THE OVERLAY LAYOUT ONLY.

          Below `lg` the words are on the photograph and need a ground under
          them: dark at the top for two words of script, darker and taller at
          the bottom for the heading, the date and four figures, and nearly
          clear through the middle where the couple are.

          At `lg` the words have moved off the photograph entirely, so the same
          gradients would be dimming a framed print for no reader's benefit.
          They are hidden rather than softened.
        */}
        <div
          aria-hidden="true"
          className="relative col-start-1 row-start-1 bg-gradient-to-b from-black/70 to-transparent self-start h-1/4 w-full lg:hidden"
        />
        <div
          aria-hidden="true"
          className="relative col-start-1 row-start-1 bg-gradient-to-t from-black/90 via-black/55 to-transparent self-end h-3/5 w-full lg:hidden"
        />

        <div
          /*
            `relative` IS LOad-BEARING AND ITS ABSENCE COST A WHOLE LAYOUT.

            This column shares one grid cell with the photograph, whose `<Image
            fill>` is `position: absolute`. Painting order is not DOM order:
            every positioned element paints above every non-positioned one, no
            matter which came first in the markup. Static, this column and both
            scrims rendered BEHIND the photograph — on a phone the page showed
            the picture and nothing else, no heading, no date, no countdown, and
            no error anywhere to say why.
          */
          className="
            relative col-start-1 row-start-1 flex min-h-dvh flex-col items-center
            justify-between gap-12 px-6 pt-10
            pb-[max(3rem,env(safe-area-inset-bottom))]
            sm:pt-14 sm:pb-14
            lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:justify-center
            lg:gap-9 lg:px-4 lg:py-0
          "
        >
          <p
            className="
            font-script text-3xl text-[#f6efe2]/90
            [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]
            sm:text-4xl
          "
          >
            Nos casamos
          </p>

          {/*
            WRAPPED WITH THE LINK, AND THE WRAPPER IS NOT DECORATION.

            Below `lg` this column is `justify-between` with exactly two
            children: the script line at the top and this block at the foot. A
            third child would have made it three evenly spread rows and pushed
            the heading into the middle of the photograph, across the couple.
            One wrapper keeps the count at two.
          */}
          <div className="flex flex-col items-center gap-7">
            <SaveTheDate />

            {/*
              The door to `/transmision`, which opens in the final week.

              A client component, and it has to be: `/` is static, so a decision
              made here on the server would be frozen at build time and would
              still say "not yet" on the morning of the wedding. `StreamLink`
              renders the closed state on both sides and corrects itself after
              mount, exactly as `Countdown` does with its figures.
            */}
            <StreamLink />
          </div>
        </div>
      </div>

      {/*
        TOP RIGHT, BECAUSE BOTTOM RIGHT COLLIDED.

        It sat in the bottom corner first and overlapped the word "segundos" on
        a 390px phone — the countdown is four columns wide and the last one ends
        exactly where a 44px control in that corner begins. The top band holds
        one centred line of script and has room to spare on both sides.

        `fixed` rather than `absolute` so it stays reachable if this page ever
        grows past one screen. The inset respects the notch.
      */}
      <div className="fixed top-[max(1.25rem,env(safe-area-inset-top))] right-5 z-10">
        <MusicToggle src={SONG_SRC} />
      </div>
    </main>
  );
}
