import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
