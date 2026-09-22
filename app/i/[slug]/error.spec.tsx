import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/*
  THE PHOTOGRAPH IS MOCKED, AND `PhotoStage.spec.tsx` EXPLAINS WHY.

  Under Vitest a static image import resolves to a bare string — "/img/boda.jpg"
  — because the loader that turns one into `{ src, width, height, blurDataURL }`
  belongs to the Next build. `PhotoStage` asks for `placeholder="blur"`, and
  `next/image` throws when a blur placeholder arrives without its data URL.

  So this supplies the shape the build would have produced. That the real file
  reaches the component with real dimensions is the build's job and the browser
  suite's, exactly as that spec records.
*/
vi.mock("@/components/landing/photos", () => ({
  WEDDING_PHOTO: {
    src: {
      src: "/img/boda.jpg",
      width: 1800,
      height: 2400,
      blurDataURL: "data:image/jpeg;base64,/9j/",
      blurWidth: 6,
      blurHeight: 8,
    },
    alt: "Luis pidiéndole matrimonio a Michell frente a una cascada iluminada",
  },
}));

import { WEDDING_PHOTO } from "@/components/landing/photos";

import InvitationError, {
  attemptChunkReload,
  CHUNK_RELOAD_KEY,
  isChunkLoadError,
} from "./error";

/**
 * A deploy while a guest has the page open makes a lazily loaded chunk from the
 * previous build 404. Without an error boundary the guest gets the framework's
 * English "Application error: a client-side exception has occurred" wall, with
 * no way out — and the RSVP write may already have succeeded. Only the screen
 * died.
 */
describe("isChunkLoadError", () => {
  it.each([
    [
      "webpack's named error",
      Object.assign(new Error("boom"), { name: "ChunkLoadError" }),
    ],
    [
      "webpack's message",
      new Error(
        "Loading chunk 42 failed. (missing: /_next/static/chunks/42.js)",
      ),
    ],
    [
      "a Vite/ESM dynamic import failure",
      new Error(
        "Failed to fetch dynamically imported module: /_next/static/chunks/page.js",
      ),
    ],
    [
      "Safari's wording for the same thing",
      new Error("Importing a module script failed."),
    ],
  ])("recognizes %s", (_label, error) => {
    expect(isChunkLoadError(error as Error)).toBe(true);
  });

  it.each([
    [
      "an ordinary application error",
      new Error("Cannot read properties of undefined"),
    ],
    ["a network failure that is not a chunk", new Error("Failed to fetch")],
  ])("does not claim %s is a stale chunk", (_label, error) => {
    expect(isChunkLoadError(error as Error)).toBe(false);
  });
});

describe("attemptChunkReload", () => {
  const fakeStorage = (): Storage => {
    const values = new Map<string, string>();

    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
      clear: () => values.clear(),
      key: () => null,
      get length() {
        return values.size;
      },
    } as Storage;
  };

  it("reloads once for a stale chunk", () => {
    const reload = vi.fn();
    const storage = fakeStorage();

    expect(
      attemptChunkReload(
        Object.assign(new Error("boom"), { name: "ChunkLoadError" }),
        { storage, reload },
      ),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull();
  });

  it("refuses a second reload, so a broken deploy cannot loop", () => {
    const reload = vi.fn();
    const storage = fakeStorage();
    const error = Object.assign(new Error("boom"), { name: "ChunkLoadError" });

    attemptChunkReload(error, { storage, reload });
    expect(attemptChunkReload(error, { storage, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads for an error that is not a stale chunk", () => {
    const reload = vi.fn();

    expect(
      attemptChunkReload(new Error("Cannot read properties of undefined"), {
        storage: fakeStorage(),
        reload,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when storage is unavailable", () => {
    // Private browsing and locked-down WebViews throw on access. A reload we
    // cannot record is a reload that would repeat forever.
    const reload = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;

    expect(
      attemptChunkReload(
        Object.assign(new Error("boom"), { name: "ChunkLoadError" }),
        { storage, reload },
      ),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("InvitationError", () => {
  const error = new Error("Cannot read properties of undefined");

  it("reassures the guest in Spanish that their answer was kept", () => {
    render(<InvitationError error={error} reset={() => {}} />);

    expect(screen.getByRole("heading").textContent).toMatch(/pantalla/i);
    expect(document.body.textContent).toMatch(/respuesta.*guardad/i);
    // Never the framework's English wall.
    expect(document.body.textContent).not.toMatch(/Application error/i);
  });

  it("offers a way forward the guest can actually press", () => {
    const reset = vi.fn();
    render(<InvitationError error={error} reset={reset} />);

    const button = screen.getByRole("button");
    expect(button.textContent).toMatch(/intentar de nuevo/i);
    button.click();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

/**
 * THE SCREEN A GUEST ACTUALLY SEES WHEN THIS FIRES.
 *
 * The couple, with a screenshot of it: "cuando algo sale mal esta es la
 * pantalla que está retornando, está horrible; hay que mejorarla con el mismo
 * estilo que estamos llevando en la landing y la invitación: una fotografía y
 * un mensaje de error."
 *
 * It was black text on white, crammed into the top-left corner, with a bare
 * `<button>` — the framework's default box model and nothing else. The same
 * defect the gate had in U4, and for the same reason: a screen was written for
 * what it SAYS and never looked at.
 *
 * AND IT TAKES THE PHOTOGRAPH, WHICH `InvitationUnavailable` DELIBERATELY DOES
 * NOT. That page is reached by typing an address nobody holds, and framing the
 * couple above "no encontramos esta invitación" would put their wedding on a
 * screen a stranger reached by guessing. This one is different: whoever is
 * reading it holds a real invitation and was already past the gate. Their
 * invitation did not go missing — it failed to draw.
 */
describe("what the error screen looks like", () => {
  const error = new Error("boom");

  it("stands on the same stage as the invitation", () => {
    const { container } = render(
      <InvitationError error={error} reset={() => {}} />,
    );

    expect(container.querySelector("main.photo-stage")).not.toBeNull();
    expect(container.querySelector("figure.photo-stage__frame")).not.toBeNull();
  });

  it("shows the wedding photograph, described", () => {
    render(<InvitationError error={error} reset={() => {}} />);

    expect(screen.getByAltText(WEDDING_PHOTO.alt)).toBeInTheDocument();
  });

  /**
   * AND THE WAY OUT IS A CONTROL, NOT A WORD.
   *
   * "Intentar de nuevo" rendered as bare text on a bare button: nothing about
   * it said it could be pressed. On the one screen whose entire purpose is to
   * offer a second try, a control a guest cannot recognise is the same as no
   * control.
   */
  it("gives the retry a surface", () => {
    render(<InvitationError error={error} reset={() => {}} />);

    const retry = screen.getByRole("button", { name: "Intentar de nuevo" });

    expect(retry.className).toContain("rounded-full");
  });
});
