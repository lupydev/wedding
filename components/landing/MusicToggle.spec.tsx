import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MusicToggle } from "./MusicToggle";

const SRC = "/audio/nuestra-cancion.mp3";

/** What the browser does when asked to make noise. */
type Policy = "allows" | "refuses" | "refuses-until-gesture" | "refuses-twice";

/**
 * jsdom ships no media stack at all.
 *
 * `HTMLMediaElement.prototype.play` exists but throws "Not implemented", and
 * `pause` does nothing observable. Both are replaced per test, which is also
 * the only way to drive the refusal that this component is built around.
 *
 * `refuses-until-gesture` is the one that matters most: it is what every real
 * browser does. The first call — the one made on page load, with no gesture
 * behind it — is rejected, and every call afterwards succeeds because by then
 * the visitor has touched something.
 */
function stubMedia(policy: Policy) {
  let calls = 0;

  const playSpy = vi.fn(() => {
    calls += 1;

    const blocked =
      policy === "refuses" ||
      (policy === "refuses-until-gesture" && calls === 1) ||
      /*
        A BROWSER THAT REFUSES THE FIRST GESTURE TOO.

        Not hypothetical: `preload="none"` means the file is not loaded when the
        first tap arrives, and a browser with a stricter autoplay shield than
        Chrome's — Brave blocks it by default — can decline that first
        programmatic `play()` even inside a gesture handler.
      */
      (policy === "refuses-twice" && calls <= 2);

    return blocked
      ? Promise.reject(new DOMException("blocked", "NotAllowedError"))
      : Promise.resolve();
  });
  const pauseSpy = vi.fn();

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(playSpy);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pauseSpy);

  return { playSpy, pauseSpy };
}

function toggle(): HTMLElement {
  return screen.getByRole("button", { name: /música/i });
}

/** Any gesture, anywhere on the page — a tap on the photograph will do. */
function touchSomething() {
  fireEvent.pointerDown(document.body);
}

describe("MusicToggle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * THE SONG IS 4.7 MB AND IT MAY NOT COMPETE WITH THE PHOTOGRAPH.
   *
   * `preload="none"` means the browser fetches nothing until somebody asks for
   * the song — and since the attempt to start it waits for the window's `load`
   * event, nothing asks until the photograph is already on screen.
   */
  it("downloads nothing until it is asked to play", () => {
    stubMedia("allows");

    const { container } = render(<MusicToggle src={SRC} />);
    const audio = container.querySelector("audio");

    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("src", SRC);
    expect(audio).toHaveProperty("loop", true);
  });

  describe("when the browser allows it", () => {
    it("starts on its own, without anybody pressing anything", async () => {
      const { playSpy } = stubMedia("allows");

      render(<MusicToggle src={SRC} />);

      await waitFor(() => expect(playSpy).toHaveBeenCalled());
      expect(toggle()).toHaveAccessibleName("Pausar la música");
    });

    /**
     * Nothing is left listening once the song is playing.
     *
     * The fallback below attaches document-wide listeners, and a listener that
     * outlives its purpose is how a visitor who pauses the song finds it
     * starting again the next time they tap the page.
     */
    it("leaves no listener behind waiting for a gesture", async () => {
      const { playSpy } = stubMedia("allows");

      render(<MusicToggle src={SRC} />);
      await waitFor(() => expect(playSpy).toHaveBeenCalledOnce());

      touchSomething();

      expect(playSpy).toHaveBeenCalledOnce();
    });
  });

  describe("when the browser refuses until the visitor touches something", () => {
    /**
     * THIS IS THE ORDINARY CASE, NOT THE EXCEPTION.
     *
     * Every browser rejects `play()` with `NotAllowedError` on a page nobody
     * has interacted with. So the attempt on load is expected to fail, and the
     * page must stay silent and honest about it rather than claiming to play.
     */
    it("stays silent and keeps offering to play", async () => {
      const { playSpy } = stubMedia("refuses-until-gesture");

      render(<MusicToggle src={SRC} />);

      await waitFor(() => expect(playSpy).toHaveBeenCalledOnce());
      expect(toggle()).toHaveAccessibleName("Poner la música");
    });

    /**
     * The first gesture anywhere starts it — a tap on the photograph, a scroll,
     * a key. The visitor never has to find the button, which is the whole point
     * of the fallback: the browser's rule is satisfied by ANY interaction with
     * the page, not only by one aimed at the control.
     */
    it("starts at the first touch anywhere on the page", async () => {
      const { playSpy } = stubMedia("refuses-until-gesture");

      render(<MusicToggle src={SRC} />);
      await waitFor(() => expect(playSpy).toHaveBeenCalledOnce());

      touchSomething();

      await waitFor(() =>
        expect(toggle()).toHaveAccessibleName("Pausar la música"),
      );
    });

    /**
     * IT KEEPS WAITING UNTIL A GESTURE ACTUALLY MAKES A SOUND.
     *
     * The listeners were registered with `once: true` AND removed by the
     * handler before the attempt's answer was known — so a first gesture whose
     * `play()` was refused took the fallback with it, and the visitor could
     * tap all day for nothing. That is exactly what the couple reported: "al
     * dar click o interactuar con la página no se activa el audio".
     *
     * A refusal is not rare on this page. `preload="none"` means the file is
     * not loaded when the first tap arrives, and a stricter autoplay shield
     * than Chrome's — Brave blocks by default — can decline a programmatic
     * `play()` even inside a gesture handler.
     */
    it("keeps listening when the first gesture is refused as well", async () => {
      const { playSpy } = stubMedia("refuses-twice");

      render(<MusicToggle src={SRC} />);
      await waitFor(() => expect(playSpy).toHaveBeenCalledOnce());

      // Refused: the autoplay attempt, then this gesture.
      touchSomething();
      await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
      expect(toggle()).toHaveAccessibleName("Poner la música");

      // The third attempt is allowed, and the fallback was still there to make
      // it.
      touchSomething();
      await waitFor(() =>
        expect(toggle()).toHaveAccessibleName("Pausar la música"),
      );
    });

    it("stops asking once a gesture has started the song", async () => {
      const { playSpy } = stubMedia("refuses-until-gesture");

      render(<MusicToggle src={SRC} />);
      await waitFor(() => expect(playSpy).toHaveBeenCalledOnce());

      touchSomething();
      await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));

      touchSomething();
      touchSomething();

      expect(playSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("the control itself", () => {
    /**
     * IT MUST ALWAYS BE POSSIBLE TO STOP IT, and that is not a nicety.
     *
     * Audio that starts by itself and plays for more than three seconds has to
     * come with a way to stop it — WCAG 2.2, success criterion 1.4.2. The
     * button is that way, and it is on screen from the first paint.
     */
    it("stops the song, and offers to start it again", async () => {
      const { pauseSpy, playSpy } = stubMedia("allows");
      const user = userEvent.setup();

      render(<MusicToggle src={SRC} />);
      await waitFor(() =>
        expect(toggle()).toHaveAccessibleName("Pausar la música"),
      );

      await user.click(toggle());

      expect(pauseSpy).toHaveBeenCalledOnce();
      expect(toggle()).toHaveAccessibleName("Poner la música");

      await user.click(toggle());

      expect(playSpy).toHaveBeenCalledTimes(2);
      expect(toggle()).toHaveAccessibleName("Pausar la música");
    });

    /**
     * A refused press leaves the control exactly where it started.
     *
     * Handled badly, a refusal leaves the button claiming the song is playing
     * while the room is silent, and the visitor presses it again to stop a
     * sound that was never there.
     */
    it("goes back to offering to play when a press is refused", async () => {
      stubMedia("refuses");
      const user = userEvent.setup();

      render(<MusicToggle src={SRC} />);

      await user.click(toggle());

      expect(toggle()).toHaveAccessibleName("Poner la música");
    });

    it("reports nothing to the console when the browser refuses", async () => {
      stubMedia("refuses");
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();

      render(<MusicToggle src={SRC} />);
      await user.click(toggle());
      touchSomething();

      expect(error).not.toHaveBeenCalled();
    });
  });
});

/**
 * WHAT THE SONG REMEMBERS BETWEEN ONE DOCUMENT AND THE NEXT.
 *
 * The couple: "abro la landing y pongo a sonar la canción, luego por url agrego
 * /transmision y se pausa la canción y arranca desde el inicio."
 *
 * Typing a URL tears the document down and builds another — the `<audio>`
 * element dies with it and no browser keeps a sound playing across that. The
 * layouts' "the element survives a navigation" argument is about `<Link>` and
 * cannot reach this case.
 *
 * What can cross is the position. These tests are about the two halves of that:
 * putting the song back where it was, and honouring a guest who had stopped it.
 */
describe("what it remembers between documents", () => {
  const KEY = "wedding:song";

  afterEach(() => {
    // Restored FIRST. One test below replaces the `sessionStorage` getter with
    // one that throws — the way a private window behaves — and reaching for it
    // here while that is still in place fails the test in its teardown, with
    // the product code innocent.
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  /** Drives the event a real browser fires once it knows the file's duration. */
  function metadataArrives(container: HTMLElement, duration: number): void {
    const audio = container.querySelector("audio")!;
    vi.spyOn(audio, "duration", "get").mockReturnValue(duration);
    fireEvent.loadedMetadata(audio);
  }

  it("starts where the previous page left off", async () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ at: 42, playing: true }),
    );
    const { playSpy } = stubMedia("allows");

    const { container } = render(<MusicToggle src={SRC} />);
    await waitFor(() => expect(playSpy).toHaveBeenCalled());

    metadataArrives(container, 180);

    expect(container.querySelector("audio")!.currentTime).toBe(42);
  });

  /**
   * AND A TOUCH STILL STARTS IT, WHATEVER HAPPENED ON THE PAGE BEFORE.
   *
   * This test replaces one that asserted the opposite, and the swap is the
   * whole lesson. The record briefly carried whether the song was playing, so
   * that a guest who pressed pause would not be asked again on the next page —
   * a considerate-sounding idea that cost the couple the control's actual job:
   * "al dar click o interactuar con la landing no inicia la música y lo mismo
   * con /transmision."
   *
   * The load-time attempt returned early in that case, and `startWaiting()` is
   * reached only inside that attempt's refusal path — so the early return
   * never registered the gesture listeners at all. A click did nothing, for
   * the life of the tab.
   *
   * The flag also came from the `pause` EVENT, which a browser fires for its
   * own reasons, so a guest who pressed nothing could land there too.
   */
  it("still starts on a touch when an older record mentions a pause", async () => {
    // Exactly what a tab from the previous version left behind.
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ at: 42, playing: false }),
    );
    const { playSpy } = stubMedia("refuses-until-gesture");

    render(<MusicToggle src={SRC} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalledOnce());
    touchSomething();

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
  });

  /**
   * IT WRITES THE PLACE DOWN AS THE SONG RUNS.
   *
   * `pagehide` is the event that matters — it is what fires when a URL-bar
   * navigation tears the document down — but a record only kept there is lost
   * to a crash or a killed tab, so playback keeps one as it goes.
   */
  it("keeps a note of where the song has reached", async () => {
    const { playSpy } = stubMedia("allows");

    const { container } = render(<MusicToggle src={SRC} />);
    await waitFor(() => expect(playSpy).toHaveBeenCalled());

    const audio = container.querySelector("audio")!;
    audio.currentTime = 12;
    fireEvent.timeUpdate(audio);

    expect(JSON.parse(window.sessionStorage.getItem(KEY)!)).toMatchObject({
      at: 12,
    });
  });

  /**
   * AND A BROWSER THAT REFUSES TO STORE ANYTHING IS NOT A BROKEN PAGE.
   *
   * Private windows and blocked site data make `sessionStorage` throw on
   * access, not return null. Unguarded, that is an exception inside an effect
   * on every guest-facing page, and the song is the least important thing on
   * any of them.
   */
  it("plays normally when storage is unavailable", async () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const { playSpy } = stubMedia("allows");

    render(<MusicToggle src={SRC} />);

    await waitFor(() => expect(playSpy).toHaveBeenCalled());
  });
});
