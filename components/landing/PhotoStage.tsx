import Image from "next/image";

import compromiso from "@/img/compromiso.jpg";

/**
 * The stage both public pages stand on: the photograph, and room beside it.
 *
 * ONE DEFINITION, BECAUSE TWO WOULD DRIFT INTO TWO DIFFERENT WEDDINGS.
 *
 * `/` and `/transmision` are read one after the other — a guest taps a link on
 * the first and lands on the second — so the frame, the crop, the blur and the
 * dark ground have to be the same object, not two that happen to match today.
 * Copied, the pair would have diverged on the first tweak to either.
 *
 * ONE GRID, TWO LAYOUTS, AND THE BREAKPOINT IS WHERE THE SHAPES STOP MATCHING.
 *
 * The photograph is 737×1600, or 0.46:1. A phone is 0.462:1 — the same shape to
 * three decimals — so below `lg` it fills the viewport and the words can sit on
 * top of it. A laptop is about 2:1, where that is impossible: cropped to fill,
 * three quarters of the photograph is discarded and the couple are cut at the
 * knees; contained to fit, it becomes a phone screenshot marooned in a black
 * page. So at `lg` the grid grows a second column, the photograph takes its own
 * aspect ratio and becomes a framed print, and the words move beside it.
 *
 * Grid placement rather than two trees, so there is ONE copy of the photograph
 * and ONE copy of the words at every size.
 */
/**
 * How the photograph shares a narrow screen with the words.
 *
 * `overlay` — the photograph fills the viewport and the words sit on it. Right
 * when the words are a heading, a date and four figures.
 *
 * `band` — the photograph is a band across the top and the words flow beneath.
 * Right when there are too many words to lay over anything. Tried as an overlay
 * first and measured: the stream invitation's content is about 700px on an
 * 844px screen, so its card landed squarely on the couple and left their feet
 * showing, while a paragraph fell across the lit lantern. The photograph was
 * present and the two people in it were gone.
 */
export type MobilePhoto = "overlay" | "band";

export function PhotoStage({
  children,
  mobilePhoto = "band",
}: {
  /**
   * The words. It owns its own grid placement: `col-start-1 row-start-1` to
   * share the cell with the photograph, `lg:col-start-2` to sit beside it.
   */
  readonly children: React.ReactNode;
  /** How the photograph and the words share a narrow screen. */
  readonly mobilePhoto?: MobilePhoto;
}) {
  const overlay = mobilePhoto === "overlay";
  return (
    /*
     * `min-h-dvh`, not `min-h-screen`. On a phone `100vh` is the viewport with
     * the browser chrome HIDDEN, so a full-height hero is taller than what is
     * actually on screen and the last line sits under the address bar until the
     * visitor scrolls. `dvh` tracks the chrome as it collapses.
     *
     * The background colour is the photograph's own darkness, so the frame is
     * already filled for the instant before the image decodes. On a page this
     * dark, a white flash is the only visible failure.
     */
    <main className="relative min-h-dvh overflow-hidden bg-[#0d1114]">
      {/*
        THE BACKDROP: THE SAME PHOTOGRAPH, TINY AND BLURRED.

        A 0.46:1 portrait leaves bars at the sides of any landscape window.
        Painted flat they read as a layout that failed; filled with the
        photograph's own greens and that lantern gold, out of focus, they read
        as depth.

        `sizes="64px"` is the whole trick and it is not a typo. The browser
        fetches a 64px-wide copy — about two kilobytes — and a 64px image
        blurred by 64px is indistinguishable from a full-resolution one blurred
        by 64px. Asking for the real thing twice would double the weight of the
        page to render something nobody can focus on.

        Brightened and saturated because the photograph is a dusk shot, already
        close to black: dimmed and blurred without lifting the exposure it
        rendered as flat black, and the continuity it exists for was not there.

        `preload={false}`: the sharp photograph is the LCP element and this must
        not compete with it for the connection.
      */}
      <Image
        src={compromiso}
        alt=""
        aria-hidden="true"
        fill
        preload={false}
        sizes="64px"
        className="scale-110 object-cover opacity-60 blur-3xl brightness-125 saturate-150"
      />

      <div
        className="
          relative grid min-h-dvh grid-cols-1
          lg:mx-auto lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:px-8
        "
      >
        <figure
          className={`
            relative col-start-1 row-start-1 m-0 w-full
            lg:row-start-1 lg:mx-auto lg:aspect-[737/1600] lg:h-[86dvh]
            lg:w-auto lg:overflow-hidden lg:rounded-2xl
            lg:shadow-[0_24px_80px_rgba(0,0,0,0.6)] lg:ring-1 lg:ring-white/10
            ${overlay ? "h-dvh" : "h-[38dvh]"}
          `}
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
             * its shape is the phone's rather than the photograph's; `cover` at
             * `lg`, where the figure carries the photograph's own ratio so the
             * two agree by construction, and cover is the one that cannot leave
             * a hairline of background inside the rounded frame.
             */
            className={`lg:object-center lg:object-cover ${
              overlay ? "object-contain" : "object-[center_72%] object-cover"
            }`}
          />
        </figure>

        {/*
          THE SCRIMS BELONG TO THE OVERLAY LAYOUT ONLY.

          Where the words are on the photograph they need a ground under them.
          The top one is the tall one now: the whole block sits up there, so it
          reaches to 55% and fades out just above the couple, who begin at 52%
          of the photograph and are the one thing that must not be veiled. The
          bottom one is a short anchor for the foot of the screen.

          It has to survive the lantern, which is the brightest thing in the
          frame at around a third of the way down. 80% at the top falling to
          nothing is enough for the text and still lets the glow read through.

          At `lg` the words have moved off the photograph entirely, so the same
          gradients would be dimming a framed print for no reader's benefit.

          `relative` on each, and it is load-bearing. They share a grid cell
          with an absolutely-positioned image, and painting order is NOT DOM
          order: every positioned element paints above every non-positioned one
          whatever the markup says. Static, these rendered behind the
          photograph and the page showed the picture and nothing else, with no
          error anywhere.
        */}
        {overlay ? (
          <>
            <div
              aria-hidden="true"
              className="relative col-start-1 row-start-1 h-[55%] w-full self-start bg-gradient-to-b from-black/80 via-black/55 to-transparent lg:hidden"
            />
            <div
              aria-hidden="true"
              className="relative col-start-1 row-start-1 h-1/5 w-full self-end bg-gradient-to-t from-black/75 to-transparent lg:hidden"
            />
          </>
        ) : null}

        {children}
      </div>
    </main>
  );
}
