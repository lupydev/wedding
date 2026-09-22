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

/**
 * WHERE THE SONG'S PLACE IS KEPT, AND WHY IT HAS TO BE KEPT ANYWHERE AT ALL.
 *
 * Both layouts mount this control rather than each page, so the `<audio>`
 * element survives a `<Link>` and the song plays straight through. That
 * argument is about the ROUTER, and it cannot reach a typed URL: that tears
 * the document down and builds another, and every element dies with it. No
 * browser API keeps a sound playing across a document load.
 *
 * The couple found the gap by using the site the way they build it: "abro la
 * landing y pongo a sonar la canción, luego por url agrego /transmision y se
 * pausa la canción y arranca desde el inicio."
 *
 * So the position crosses instead of the element. The second document starts
 * where the first stopped.
 *
 * `sessionStorage` RATHER THAN `localStorage`, AND THE DIFFERENCE IS THE
 * PRODUCT. This is scoped to one tab and dies when it closes, which is what a
 * guest wants: coming back tomorrow, the song starts at the beginning. In
 * `localStorage` it would open four minutes in, forever, and nothing on the
 * page would explain why.
 */
const RESUME_KEY = "wedding:song";

interface Resume {
  /** Seconds into the song. Nothing else — see below. */
  readonly at: number;
}

/*
  IT USED TO CARRY WHETHER THE SONG WAS PLAYING, AND THAT WAS A DEFECT WITH A
  PLAUSIBLE STORY ATTACHED.

  The idea was that a guest who pressed pause should not be asked again on the
  next page. It cost the couple the thing the control is actually for: "al dar
  click o interactuar con la landing no inicia la música y lo mismo con
  /transmision."

  Two mistakes, and the second is the one that matters.

  The load-time attempt returned early when the flag said paused — and the
  gesture listeners are registered INSIDE that attempt's refusal path, so
  returning early never registered them. A click on the page then did nothing
  at all, for the life of the tab, with no way back but finding the button.

  And the flag was written from the `pause` EVENT, which a browser fires for
  its own reasons — tearing a document down among them. So a guest who never
  pressed anything could land in that state anyway.

  The feature was never asked for. The position was. Rather than make the flag
  correct, it is gone: every page behaves exactly as it did before any of this,
  only starting at the right second.
*/

/**
 * The remembered place, or nothing.
 *
 * Every access is guarded, and not out of caution: in a private window, or
 * with site data blocked, reading `window.sessionStorage` THROWS rather than
 * returning null. Unguarded that is an exception inside an effect on every
 * guest-facing page — and the song is the least important thing on any of
 * them. A browser that will not store this simply starts from the top.
 */
function readResume(): Resume | null {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);

    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const { at } = parsed as Partial<Resume>;

    // Anything malformed is treated as no record rather than trusted: this
    // value is fed to `currentTime`, where a NaN throws.
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0) {
      return null;
    }

    // A record written by an older tab carries an extra field. Ignored.
    return { at };
  } catch {
    return null;
  }
}

function writeResume(resume: Resume): void {
  try {
    window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(resume));
  } catch {
    // See `readResume`. Losing the place is not worth an error on a page whose
    // job is an invitation.
  }
}

export function MusicToggle({ src }: { readonly src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio === null) {
      return;
    }

    let live = true;

    /*
      THE PLACE THE PREVIOUS DOCUMENT LEFT OFF, READ ONCE.

      Read here rather than on each use so the whole effect reasons about one
      answer. A record written by THIS document after it starts playing must
      not change what this document decided to do on arrival.
    */
    const resume = readResume();

    /*
      PUT THE SONG BACK WHERE IT WAS, BEFORE THE FIRST SAMPLE IS HEARD.

      `loadedmetadata` is the right moment and the only one that works:
      `preload="none"` means the file is untouched until something asks for it,
      and `currentTime` cannot be set on an element that does not yet know its
      own duration. The event also fires BEFORE playback begins, so the seek
      lands without a bar of the opening leaking out first.

      Guarded on `duration` because the song can be replaced: a stale position
      past the end of a shorter file throws.
    */
    const restore = () => {
      if (resume === null || resume.at <= 0) {
        return;
      }

      if (Number.isFinite(audio.duration) && resume.at >= audio.duration) {
        return;
      }

      audio.currentTime = resume.at;
    };

    /*
      AND WRITE IT DOWN AS THE SONG RUNS.

      `pagehide` is the event that actually matters — it fires when a typed URL
      tears this document down, and it records the exact instant. But a note
      kept only there is lost to a crash, a killed tab, or a browser that
      backgrounds the page and never fires it, so playback keeps one as it
      goes.

      `timeupdate` fires about four times a second. Once a second is enough to
      be worth resuming from and cheap enough not to matter; the comparison
      also catches the song looping back to the beginning.
    */
    let noted = 0;

    const remember = () => {
      noted = audio.currentTime;
      writeResume({ at: audio.currentTime });
    };

    const rememberIfMoved = () => {
      if (Math.abs(audio.currentTime - noted) >= 1) {
        remember();
      }
    };

    audio.addEventListener("loadedmetadata", restore);
    audio.addEventListener("timeupdate", rememberIfMoved);
    window.addEventListener("pagehide", remember);

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

    const startWaiting = () => {
      for (const gesture of GESTURES) {
        document.addEventListener(gesture, onGesture, { capture: true });
      }
    };

    /*
      IT KEEPS LISTENING UNTIL A GESTURE ACTUALLY MAKES A SOUND.

      This used to register with `once: true` and remove both listeners at the
      TOP of the handler — before the attempt's answer was known. So a first
      gesture whose `play()` was refused took the fallback with it, and the
      visitor could tap all day for nothing. The couple reported exactly that:
      "al dar click o interactuar con la página no se activa el audio".

      And a refusal on that first gesture is not exotic. `preload="none"` means
      the file is not loaded when the tap arrives, and a stricter autoplay
      shield than Chrome's — Brave blocks by default — can decline a
      programmatic `play()` even inside a gesture handler.

      So the listeners come off only once the song is playing. Each attempt
      still costs nothing when refused: `play()` on a `preload="none"` element
      opens no connection it does not need.
    */
    function onGesture() {
      void attempt().then((started) => {
        if (started) {
          stopWaiting();
        }
      });
    }

    const askOnce = () => {
      /*
        UNCONDITIONAL, AND IT HAS TO STAY THAT WAY.

        This briefly returned early for a guest whose record said they had
        paused — and `startWaiting()` lives inside the refusal path below, so
        the early return took the whole gesture fallback with it and a click on
        the page stopped doing anything at all. See the note on `Resume`.
      */
      void attempt().then((started) => {
        if (started || !live) {
          return;
        }

        // Refused, which is the ordinary answer on a page nobody has touched.
        // Wait for the visitor to touch anything at all.
        startWaiting();
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
      window.removeEventListener("pagehide", remember);
      audio.removeEventListener("loadedmetadata", restore);
      audio.removeEventListener("timeupdate", rememberIfMoved);
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
