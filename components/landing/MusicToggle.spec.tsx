import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MusicToggle } from "./MusicToggle";

const SRC = "/audio/nuestra-cancion.mp3";

/**
 * jsdom ships no media stack at all.
 *
 * `HTMLMediaElement.prototype.play` exists but throws "Not implemented", and
 * `pause` does nothing observable. Both are replaced per test, which is also
 * the only way to drive the rejected-`play()` case that the whole design of
 * this component exists to handle.
 */
function stubMedia({ play }: { play: () => Promise<void> }) {
  const playSpy = vi.fn(play);
  const pauseSpy = vi.fn();

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(playSpy);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pauseSpy);

  return { playSpy, pauseSpy };
}

function toggle(): HTMLElement {
  return screen.getByRole("button", { name: /música/i });
}

describe("MusicToggle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * THE SONG IS 4.7 MB AND IT MAY NOT COMPETE WITH THE PHOTOGRAPH.
   *
   * `preload="none"` means the browser fetches nothing until somebody asks for
   * the song. The default, `metadata`, opens a connection during the first
   * paint — on a phone on mobile data that connection is taken from the hero
   * image, which is the one thing the visitor is actually waiting for.
   */
  it("downloads nothing until the visitor asks for it", () => {
    const { container } = render(<MusicToggle src={SRC} />);
    const audio = container.querySelector("audio");

    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("src", SRC);
    expect(audio).toHaveProperty("loop", true);
  });

  it("starts silent, and says what pressing it will do", () => {
    stubMedia({ play: () => Promise.resolve() });

    render(<MusicToggle src={SRC} />);

    expect(toggle()).toHaveAccessibleName("Poner la música");
  });

  it("plays on the first press and offers to pause on the second", async () => {
    const { playSpy, pauseSpy } = stubMedia({ play: () => Promise.resolve() });
    const user = userEvent.setup();

    render(<MusicToggle src={SRC} />);

    await user.click(toggle());
    expect(playSpy).toHaveBeenCalledOnce();
    expect(toggle()).toHaveAccessibleName("Pausar la música");

    await user.click(toggle());
    expect(pauseSpy).toHaveBeenCalledOnce();
    expect(toggle()).toHaveAccessibleName("Poner la música");
  });

  /**
   * A REJECTED `play()` IS THE ORDINARY CASE, NOT THE EXCEPTION.
   *
   * Every browser refuses to start audio without a user gesture, and refuses
   * again on a page the visitor has never interacted with — the promise rejects
   * with `NotAllowedError`. Unhandled it becomes an unhandled promise rejection
   * in the console; handled badly it leaves the control claiming the song is
   * playing while the page is silent, and the visitor presses it again to stop
   * a sound that was never there.
   *
   * The control must end this exactly where it started: silent, and offering to
   * play.
   */
  it("stays silent and offers to play again when the browser refuses", async () => {
    stubMedia({
      play: () =>
        Promise.reject(new DOMException("blocked", "NotAllowedError")),
    });
    const user = userEvent.setup();

    render(<MusicToggle src={SRC} />);

    await user.click(toggle());

    expect(toggle()).toHaveAccessibleName("Poner la música");
  });

  it("reports nothing to the console when the browser refuses", async () => {
    stubMedia({
      play: () =>
        Promise.reject(new DOMException("blocked", "NotAllowedError")),
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<MusicToggle src={SRC} />);
    await user.click(toggle());

    expect(error).not.toHaveBeenCalled();
  });
});
