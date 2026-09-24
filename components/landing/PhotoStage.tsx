import Image, { type StaticImageData } from "next/image";

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
 * The engagement photograph is 737×1600, or 0.46:1. A phone is 0.462:1 — the
 * same shape to three decimals — so below `lg` it fills the viewport and the
 * words can sit on top of it. A laptop is about 2:1, where that is impossible:
 * cropped to fill, three quarters of the photograph is discarded and the couple
 * are cut at the knees; contained to fit, it becomes a phone screenshot marooned
 * in a black page. So at `lg` the grid grows a second column, the photograph
 * takes its own aspect ratio and becomes a framed print, and the words move
 * beside it.
 *
 * Grid placement rather than two trees, so there is ONE copy of the photograph
 * and ONE copy of the words at every size.
 *
 * THE PHOTOGRAPH IS A PARAMETER NOW, AND ITS SHAPE COMES WITH IT.
 *
 * That ratio used to be a literal in a class name and the image a literal at
 * the top of this file, which was fine while there was one photograph. The
 * wedding photograph is 1800×2400 — 0.75:1, portrait but nothing like a phone —
 * and a frame drawn at the wrong shape does not fail loudly: it crops the
 * picture to fit and looks deliberate. So the ratio is read off the image, and
 * the caller that supplies the image supplies its description too, because an
 * `alt` describing the wrong photograph is worse than none.
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

/** A photograph and what it shows. Both, because neither is any use alone. */
export interface StagePhoto {
  readonly src: StaticImageData;
  /**
   * What is in it, for a reader who cannot see it.
   *
   * Travels with the image rather than living in this component: an `alt`
   * describing the engagement photograph on a page showing the wedding one is
   * a confident, wrong answer, which is worse than no answer.
   */
  readonly alt: string;
}

export function PhotoStage({
  children,
  overPhoto,
  photo,
  mobilePhoto = "band",
}: {
  /**
   * The words.
   *
   * IT NO LONGER OWNS ITS GRID PLACEMENT, AND THAT WAS A TRAP RATHER THAN A
   * CONVENIENCE. Every caller wrote `col-start-1 row-start-1` because both
   * used `overlay` — and in `band` the photograph is a strip at the top and the
   * words belong BENEATH it, so that same class lands them on top of the
   * picture. It did not fail loudly: it rendered, with a household's names laid
   * across a waterfall. The stage places them now, so a caller cannot get it
   * wrong because a caller no longer says anything about it.
   */
  readonly children: React.ReactNode;
  /**
   * A line to lay over the photograph, on a phone only.
   *
   * The invitation's greeting. In `band` the photograph is a strip and the
   * words start beneath it, so "¡Hola, Mimi!" sat under the picture with a band
   * of empty ground above it; over the strip it reads as a caption on their own
   * photograph, which is what the couple asked for.
   *
   * IT DISAPPEARS AT `lg`, and that is the whole constraint rather than a
   * nicety. Above the breakpoint the photograph is a framed PRINT in its own
   * column, and type laid over a framed print is a different design — the one
   * `overlay` exists for, on a photograph chosen for it. The caller renders its
   * own copy in the words column there.
   */
  readonly overPhoto?: React.ReactNode;
  /** The photograph this page stands on, and what it shows. */
  readonly photo: StagePhoto;
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
    /*
      NO `overflow-hidden` HERE ANY MORE, AND ITS REMOVAL IS LOAD-BEARING.

      It was on this element to clip the backdrop, which is scaled past the
      edges on purpose. But an `overflow` ancestor makes a descendant
      `position: sticky` stick to a container that does not scroll — which is
      to say, to nothing. The framed print sticks at `lg` so it stays with the
      reader down a long form, so the clip moved onto the backdrop: the only
      thing that ever needed it.
    */
    <main className="photo-stage relative min-h-dvh bg-[#0d1114]">
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image
          src={photo.src}
          alt=""
          aria-hidden="true"
          fill
          preload={false}
          sizes="64px"
          className="scale-110 object-cover opacity-60 blur-3xl brightness-125 saturate-150"
        />
      </div>

      <div
        className={`
          relative grid min-h-dvh grid-cols-1
          lg:mx-auto lg:max-w-6xl lg:grid-cols-2 lg:grid-rows-1 lg:px-8
          ${overlay ? "" : "grid-rows-[auto_1fr]"}
        `}
      >
        <figure
          className={`
            photo-stage__frame relative col-start-1 row-start-1 m-0 w-full
            lg:sticky lg:top-[7dvh] lg:row-start-1 lg:mx-auto lg:h-auto
            lg:aspect-[var(--photo-stage-ratio)]
            lg:w-[min(100%,calc(86dvh*var(--photo-stage-ratio)))]
            lg:overflow-hidden lg:rounded-2xl
            lg:shadow-[0_24px_80px_rgba(0,0,0,0.6)] lg:ring-1 lg:ring-white/10
            ${overlay ? "h-dvh" : "h-[38dvh]"}
          `}
          /*
            THE WIDTH IS CAPPED BY THE COLUMN, AND THE HEIGHT FOLLOWS.

            It used to be the other way round — `h-[86dvh]` with the ratio
            deriving the width — and that is a frame whose WIDTH grows with the
            window's HEIGHT. At 0.75:1 it is 654px wide on a 760px-tall window
            and 697px on a 1080px one, against a column that is half of
            `max-w-6xl`: 576px. So above roughly 900px of viewport the picture
            spilled into the second column and the words were drawn on top of
            it. Invisible at the size it was being checked at; plain on the
            couple's own monitor, which is where they saw it.

            `min(100%, 86dvh × ratio)` takes whichever limit binds: the column
            on a tall window, the viewport height on a short one. `aspect-ratio`
            then gives the height, so the photograph is never squashed either
            way.

            A CUSTOM PROPERTY, BECAUSE TAILWIND CANNOT COMPILE A RUNTIME VALUE —
            and a single decimal rather than `w / h`, because it has to work
            inside `calc()` as well as in `aspect-ratio`.
          */
          style={
            {
              "--photo-stage-ratio": `${photo.src.width / photo.src.height}`,
            } as React.CSSProperties
          }
        >
          <Image
            src={photo.src}
            alt={photo.alt}
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
          Both are tall, because both bands carry words now: the announcement
          above the couple and, on `/transmision`, the joining details below
          them. The top reaches 55% and the bottom 38%, and they fade out
          towards each other so the middle — where the couple are, from 52% to
          88% — keeps the least veil of anywhere on the frame.

          The bottom one is sized for the heavier of its two jobs. On the
          landing it carries one pill and a line; on the stream invitation it
          carries a meeting id, a passcode and a button, and cream type needs a
          ground under all of it.

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
              className="relative col-start-1 row-start-1 h-[38%] w-full self-end bg-gradient-to-t from-black/90 via-black/60 to-transparent lg:hidden"
            />
          </>
        ) : null}

        {/*
          AND WHATEVER THE CALLER WANTS ON THE PHOTOGRAPH ITSELF.

          The print's own cell — one row, one column, two layers — so it sits on
          the picture rather than under it. `self-start` keeps it at the top of
          the strip, which is where the photograph has sky and a waterfall
          rather than the couple: the same measurement the scrims above are
          built from.

          Its own scrim, because a caller cannot know how bright the picture is
          under one line of type, and `overlay`'s pair is not rendered in
          `band`.

          THE SIDE PADDING IS 64px AND IT IS MEASURED, not chosen. The music
          control sits at `right-5` and is 44px across, so it occupies the last
          64px of the row; text reaching further would run underneath it. The
          same gutter on both sides keeps the line centred.

          The top clears the notch the way that control does, from the same
          safe-area inset.
        */}
        {overPhoto === undefined ? null : (
          <div
            className="
              photo-stage__over-photo relative col-start-1 row-start-1
              w-full self-start
              bg-gradient-to-b from-black/70 via-black/40 to-transparent
              px-16 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10
              text-center
              lg:hidden
            "
          >
            {overPhoto}
          </div>
        )}

        {/*
          THE CELL THE WORDS LIVE IN, DECIDED HERE.

          `overlay` shares the print's cell — one row, one column, two layers.
          `band` takes the second row, under the strip. At `lg` neither applies:
          the print is in its own column and the words are in the next one, so
          the mobile choice stops mattering.

          AND AT `lg` IT CENTRES THEM, WHICH IS THE STAGE'S JOB AND NOT THE
          CALLER'S.

          The print sticks, so the row's cells STRETCH — that is what lets a
          long form scroll past a stationary picture, and `lg:items-center`
          had to come off the grid for it. On a page whose words are SHORTER
          than the print, though, a stretched cell holding a content-sized
          child leaves the words pinned to its top with several hundred pixels
          of empty ground beneath them, beside a picture running the full
          height. `justify-center` on the child cannot help: it centres content
          inside a box that is already exactly as tall as that content.

          Every caller would otherwise need `lg:h-full` and would fail
          silently for forgetting it — three pages, three chances, and one of
          them was already wrong in production. So the CELL centres its child,
          exactly as this stage already decides which cell the words go in.

          Harmless where the words are the taller of the two: the row is then
          sized by them, so the cell and its child are the same height and
          centring is a no-op.
        */}
        <div
          className={`
            photo-stage__column relative col-start-1 lg:col-start-2
            lg:row-start-1 lg:flex lg:flex-col lg:justify-center
            ${overlay ? "row-start-1" : "row-start-2"}
          `}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
