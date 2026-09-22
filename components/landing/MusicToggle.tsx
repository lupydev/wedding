"use client";

/**
 * The song, served from `public/` — the only folder Next serves verbatim.
 *
 * Exported because TWO layouts mount this control now: the one over `/` and
 * `/transmision`, and the invitation's own. A second literal is a second song
 * the day somebody renames the file.
 */
export const SONG_SRC = "/audio/nuestra-cancion.mp3";

import { Pause, Music } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The couple's song: started on its own where the browser allows it, at the
 * visitor's first touch where it does not, and stoppable always.
 *
 * WHAT "AUTOPLAY" CAN AND CANNOT MEAN, BECAUSE IT IS NOT A SETTING.
 *
 * No browser plays audio with sound on a page nobody has interacted with.
 * Chrome, Safari and Firefox all reject `HTMLMediaElement.play()` with a
 * `NotAllowedError` until a gesture has landed on the page; Safari on iOS is
 * stricter still. There is no attribute, no flag and no configuration on our
 * side that changes this, and `<audio autoplay>` is silently ignored under the
 * same rule.
 *
 * What IS possible is two attempts instead of one:
 *
 *  1. Ask on load. A visitor who has played media on this origin before —
 *     Chrome scores that as a Media Engagement Index — or who arrived by a
 *     link from within the site, is allowed, and for them the song simply
 *     starts.
 *  2. If that is refused, wait for ANY gesture anywhere on the page. The
 *     browser's rule is satisfied by any interaction, not only by one aimed at
 *     a control, so a tap on the photograph or a scroll is enough. In practice
 *     this is the case that fires, and the visitor never has to find a button.
 *
 * AND IT MUST ALWAYS BE POSSIBLE TO STOP. Audio that starts by itself and runs
 * for more than three seconds has to come with a way to stop it — WCAG 2.2,
 * success criterion 1.4.2. That is what the button is now for. A page that
 * starts singing is a page somebody opens at work or beside a sleeping baby,
 * and the control is on screen from the first paint.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

const PLAY_LABEL = "Poner la música";
const PAUSE_LABEL = "Pausar la música";

/** Gestures that count as "the visitor has touched the page". */
const GESTURES = ["pointerdown", "keydown"] as const;

export function MusicToggle({ src }: { readonly src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio === null) {
      return;
    }

    let live = true;

    const stopWaiting = () => {
      for (const gesture of GESTURES) {
        document.removeEventListener(gesture, onGesture, true);
      }
    };

    /*
     * ONE call site for `play()` in this effect, and the rejection is swallowed
     * on purpose.
     *
     * What a rejection means is the browser declining to make noise, or
     * declining to decode the file. Neither is something a guest can act on and
     * neither makes the page less usable — it is exactly as readable in
     * silence. What matters is that the control keeps telling the truth about
     * whether there is sound in the room, which is why the answer is returned
     * rather than discarded.
     */
    const attempt = (): Promise<boolean> =>
      audio.play().then(
        () => {
          if (live) {
            setPlaying(true);
          }

          return true;
        },
        () => false,
      );

    function onGesture() {
      // Whichever gesture arrived first, neither is wanted again.
      stopWaiting();
      void attempt();
    }

    const askOnce = () => {
      void attempt().then((started) => {
        if (started || !live) {
          return;
        }

        // Refused, which is the ordinary answer on a page nobody has touched.
        // Wait for the visitor to touch anything at all.
        for (const gesture of GESTURES) {
          document.addEventListener(gesture, onGesture, {
            capture: true,
            once: true,
          });
        }
      });
    };

    /*
     * AFTER THE PAGE HAS LOADED, NOT DURING IT.
     *
     * The song is 4.7 MB and `preload="none"` keeps it off the wire until
     * something asks for it — asking during the first paint would spend that
     * bandwidth against the photograph, which is the thing the visitor is
     * actually waiting for. `load` fires once every image is in, so the
     * photograph always wins the race.
     */
    if (document.readyState === "complete") {
      askOnce();
    } else {
      window.addEventListener("load", askOnce, { once: true });
    }

    return () => {
      live = false;
      stopWaiting();
      window.removeEventListener("load", askOnce);
    };
  }, []);

  async function toggle() {
    const audio = audioRef.current;

    if (audio === null) {
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      /*
       * SWALLOWED, AND THAT IS THE CORRECT HANDLING HERE.
       *
       * The rejection this catches is the browser declining to make noise —
       * `NotAllowedError`, or a codec it will not decode. Neither is something
       * the visitor can act on and neither is a defect to report: the page is
       * exactly as usable silent. What matters is that the control goes back to
       * offering to play, so the state on screen matches the silence in the
       * room.
       */
      setPlaying(false);
    }
  }

  return (
    <>
      {/*
        `preload="none"`: the song is 4.7 MB and the photograph is the thing the
        visitor is waiting for. The default, `metadata`, opens a connection
        during the first paint and takes bandwidth from the hero on exactly the
        phone-on-mobile-data case this page is built for.

        `onPlay`/`onPause` keep the label honest when something other than this
        button changes the state — the lock-screen controls, a headset button,
        another tab claiming audio focus.
      */}
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? PAUSE_LABEL : PLAY_LABEL}
        className="
          flex size-11 items-center justify-center rounded-full
          border border-[#f6efe2]/25 bg-black/25 text-[#f6efe2]
          backdrop-blur-sm
          transition-colors duration-(--console-motion-fast)
          ease-(--ease-console-out)
          hover:bg-black/40
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[#f6efe2]
        "
      >
        {/*
          The icon is decorative: the button's accessible name is its
          `aria-label`, and a second reading of the same thing from the icon
          would be noise.

          Size 11 (44px) is the floor, not a preference. It is the smallest
          target iOS and Android both consider reliably tappable, and this
          control sits in the corner of a photograph where a near-miss means
          tapping the image instead.
        */}
        {playing ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Music className="size-4" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
