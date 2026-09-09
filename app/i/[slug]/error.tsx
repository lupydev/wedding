"use client";

import { useEffect } from "react";

/**
 * Error boundary for the invitation route.
 *
 * The failure this exists for is not a bug in our code. Deploying while a guest
 * has the page open makes a lazily loaded chunk from the PREVIOUS build return
 * 404, React throws while hydrating, and without a boundary the guest reads the
 * framework's English "Application error: a client-side exception has occurred"
 * with no way out.
 *
 * The detail that decides the copy: by the time that happens the RSVP write has
 * usually already succeeded. Only the screen died. Telling the guest to answer
 * again would be worse than saying nothing.
 *
 * Guest-facing copy is Spanish. Identifiers, comments and tests stay English.
 */

/** sessionStorage key recording that this tab already retried a stale chunk. */
export const CHUNK_RELOAD_KEY = "invitation:chunk-reload";

/**
 * Was this a chunk that no longer exists, rather than a real application error?
 *
 * Matched by name AND by message because the wording is decided by the bundler
 * and the browser, not by us: webpack raises `ChunkLoadError`, the ESM loader
 * says it failed to fetch a dynamically imported module, and Safari says the
 * module script failed. All three mean the same thing — the build the tab was
 * running is gone.
 */
export function isChunkLoadError(error: Error): boolean {
  if (error.name === "ChunkLoadError") {
    return true;
  }

  const message = error.message;

  return (
    /loading chunk .* failed/i.test(message) ||
    /(failed to fetch|error loading) dynamically imported module/i.test(
      message,
    ) ||
    /importing a module script failed/i.test(message)
  );
}

export interface ChunkReloadPorts {
  readonly storage: Storage;
  readonly reload: () => void;
}

/**
 * Reloads the page ONCE for a stale chunk, and reports whether it did.
 *
 * The `sessionStorage` guard is the whole safety of this function. A reload
 * that runs unconditionally turns a genuinely broken deploy into an infinite
 * refresh loop the guest cannot escape — a worse failure than the wall it
 * replaces. Storage that throws (private browsing, locked-down WebViews) is
 * treated as "cannot record", so no reload happens at all: an unrecorded reload
 * is exactly the loop this guards against.
 *
 * The ports are injected so the decision is testable without a real navigation.
 */
export function attemptChunkReload(
  error: Error,
  { storage, reload }: ChunkReloadPorts,
): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }

  try {
    if (storage.getItem(CHUNK_RELOAD_KEY) !== null) {
      return false;
    }

    storage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }

  reload();
  return true;
}

export default function InvitationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    attemptChunkReload(error, {
      storage: window.sessionStorage,
      reload: () => window.location.reload(),
    });
  }, [error]);

  return (
    <main className="invitation-error">
      <h1>Algo falló en la pantalla</h1>
      <p>
        Si ya confirmaste tu asistencia, tu respuesta quedó guardada. Esto fue
        solo un problema al mostrar la página.
      </p>
      <p>
        Puedes intentar de nuevo. Si vuelve a fallar, escríbenos por WhatsApp y
        lo resolvemos contigo.
      </p>
      <button type="button" onClick={reset}>
        Intentar de nuevo
      </button>
    </main>
  );
}
