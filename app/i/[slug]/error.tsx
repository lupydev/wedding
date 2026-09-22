"use client";

import { useEffect } from "react";

import { PhotoStage } from "@/components/landing/PhotoStage";
import { WEDDING_PHOTO } from "@/components/landing/photos";

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
    /*
      THE SAME STAGE AS THE INVITATION THAT FAILED TO DRAW.

      The couple, with a screenshot: "está horrible; hay que mejorarla con el
      mismo estilo que estamos llevando en la landing y la invitación: una
      fotografía y un mensaje de error." It was black text on white, crammed
      into the top-left corner — the framework's default box model and nothing
      else. Exactly the defect the gate had, for exactly the same reason: a
      screen written for what it SAYS and never looked at.

      IT TAKES THE PHOTOGRAPH, AND `InvitationUnavailable` DELIBERATELY DOES
      NOT. That page is reached by typing an address nobody holds, and framing
      the couple above "no encontramos esta invitación" would put their wedding
      on a screen a stranger reached by guessing. Here the reader holds a real
      invitation and is already past the gate: theirs did not go missing, it
      failed to draw. Showing them the same picture the working page would have
      shown is the difference between "something broke" and "you are in the
      wrong place".

      `band`, as the gate and the invitation use, for the photograph's sake:
      at 0.75:1 a phone-filling crop discards about 38% of the width and clips
      both people.
    */
    <PhotoStage mobilePhoto="band" photo={WEDDING_PHOTO}>
      <section
        className="
          invitation-error mx-auto flex w-full max-w-md flex-col items-center
          gap-5 px-6 pt-8 pb-[max(1.75rem,env(safe-area-inset-bottom))]
          text-center text-[#f6efe2]
          sm:pt-12 sm:pb-10
          lg:h-full lg:justify-center lg:px-4 lg:py-0
        "
      >
        <h1
          className="
            font-display text-2xl leading-[1.1] text-balance
            [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
            sm:text-3xl
          "
        >
          Algo falló en la pantalla
        </h1>

        {/*
          THE REASSURANCE COMES FIRST, AND THAT ORDER IS THE WHOLE COPY.

          By the time this fires the RSVP write has usually already succeeded
          and only the screen died. A guest who has just confirmed and then
          sees a failure will assume their answer was lost, and answering
          twice is a worse outcome than the error itself.
        */}
        <p className="max-w-sm text-sm text-[#f6efe2]/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)] sm:text-base">
          Si ya confirmaste tu asistencia, tu respuesta quedó guardada. Esto fue
          solo un problema al mostrar la página.
        </p>

        {/*
          A CONTROL, NOT A WORD. "Intentar de nuevo" was a bare `<button>` with
          no surface at all — on the one screen whose entire purpose is to offer
          a second try, a control a guest cannot recognise is the same as no
          control. The pill is `StreamLink`'s, which is already the guest-facing
          one on every other page.
        */}
        <button
          type="button"
          onClick={reset}
          className="
            rounded-full border border-[#f6efe2]/30 bg-black/30 px-5 py-2.5
            text-sm text-[#f6efe2] backdrop-blur-sm transition-colors
            duration-(--console-motion-fast) ease-(--ease-console-out)
            hover:bg-black/50
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#f6efe2]
          "
        >
          Intentar de nuevo
        </button>

        <p className="text-xs text-[#f6efe2]/70 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          Si vuelve a fallar, escríbenos por WhatsApp y lo resolvemos contigo.
        </p>
      </section>
    </PhotoStage>
  );
}
