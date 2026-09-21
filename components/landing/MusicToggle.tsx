"use client";

import { Pause, Music } from "lucide-react";
import { useRef, useState } from "react";

/**
 * The couple's song, behind a button.
 *
 * WHY THERE IS A BUTTON AT ALL, AND NOT AN AUTOPLAY.
 *
 * No browser plays audio with sound on a page the visitor has not interacted
 * with. Chrome, Safari and Firefox all reject `HTMLMediaElement.play()` with a
 * `NotAllowedError` until a gesture has landed, and Safari on iOS is stricter
 * still. An "autoplay" therefore is not a choice between playing and not
 * playing — it is a choice between a button and a silent page with a rejected
 * promise in its console.
 *
 * Given that, the button is also simply the kinder design. A page that starts
 * singing is a page somebody opens at work, or beside a sleeping baby, and
 * closes immediately.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

const PLAY_LABEL = "Poner la música";
const PAUSE_LABEL = "Pausar la música";

export function MusicToggle({ src }: { readonly src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

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
