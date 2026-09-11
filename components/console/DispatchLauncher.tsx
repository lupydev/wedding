"use client";

import { useCallback, useEffect, useState } from "react";

import { postEventBeacon } from "@/lib/browser/beacon";
import { browserNavigation } from "@/lib/browser/navigation";
import {
  DISPATCH_STATE_LABELS,
  type DispatchState,
} from "@/lib/domain/dispatch-state";

/**
 * The dispatch action: open WhatsApp, then say what actually happened.
 *
 * WHY THE ORDER OF TWO STATEMENTS IS THE MOST IMPORTANT THING HERE
 *
 * Navigating to `wa.me` LEAVES the page. An ordinary `fetch` is cancelled on
 * unload; an awaited one delays the navigation the operator just asked for. So
 * the `link_opened` event is written FIRST, through `postEventBeacon`, which
 * returns synchronously — and the navigation that follows is never conditional
 * on it and never waits for it. A guest who never receives their invitation
 * because a logging call hung is a far worse trade than a missing audit row,
 * and the missing row is reconciled on return anyway.
 *
 * WHY THERE ARE TWO STEPS AND NOT ONE
 *
 * The application cannot observe a send. Opening the link hands the draft to
 * WhatsApp and a human presses the button — or does not, or picks the wrong
 * chat, or runs out of battery. `link_opened` therefore claims exactly one
 * thing: WhatsApp was opened. The send itself is a separate, explicit
 * confirmation from the only sensor this design has, which is the operator. The
 * copy says so out loud rather than letting an opened link quietly read as a
 * delivery.
 *
 * WHY THE CLIENT EVENT ID IS STASHED
 *
 * The beacon write happens as the page unloads and can genuinely be lost. On
 * return, the same id is posted again; `dispatch_events_client_event_idx`
 * rejects the duplicate, so one click can never become two opened-link events.
 * A client-side "check whether the row exists first" would be that same
 * deduplication with a race added, so the retry is unconditional and the index
 * is what decides.
 */

/** Where one invitation's in-flight client event id lives, per tab. */
export function dispatchStashKey(invitationId: string): string {
  return `wedding.dispatch.${invitationId}`;
}

export interface DispatchLauncherProps {
  readonly invitationId: string;
  readonly greetingName: string;
  /** The household member the draft is addressed to. A name, never a number. */
  readonly recipientName: string;
  /** Built server-side by `buildInvitationDispatchLink`. */
  readonly waUrl: string;
  readonly beaconPath: string;
  readonly dispatchState: DispatchState;
  readonly markSentAction: (formData: FormData) => void | Promise<void>;
  readonly markFailedAction: (formData: FormData) => void | Promise<void>;
}

function readStash(invitationId: string): string | null {
  try {
    return window.sessionStorage.getItem(dispatchStashKey(invitationId));
  } catch {
    // Private modes and blocked storage. The dispatch itself still works; only
    // the reconciliation is lost, which is exactly the thing allowed to fail.
    return null;
  }
}

function writeStash(invitationId: string, clientEventId: string): void {
  try {
    window.sessionStorage.setItem(
      dispatchStashKey(invitationId),
      clientEventId,
    );
  } catch {
    // Same reasoning. Never let storage stop a dispatch.
  }
}

function clearStash(invitationId: string): void {
  try {
    window.sessionStorage.removeItem(dispatchStashKey(invitationId));
  } catch {
    // Same reasoning.
  }
}

export function DispatchLauncher({
  invitationId,
  greetingName,
  recipientName,
  waUrl,
  beaconPath,
  dispatchState,
  markSentAction,
  markFailedAction,
}: DispatchLauncherProps) {
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);

  /**
   * Re-posts the stashed event and asks what happened.
   *
   * Runs on mount as well as on `visibilitychange`, because returning from
   * WhatsApp is not always a visibility change: on a desktop the tab may have
   * been replaced outright and the console re-rendered from scratch. The stash
   * is what survives both.
   */
  const reconcile = useCallback(() => {
    const clientEventId = readStash(invitationId);

    if (clientEventId === null) {
      return;
    }

    postEventBeacon(beaconPath, { invitationId, clientEventId });
    setAwaitingAnswer(true);
  }, [beaconPath, invitationId]);

  useEffect(() => {
    // Deferred by a microtask rather than called inline: this is a post-commit
    // side effect (it posts to the network), and running it synchronously inside
    // the effect body would set state during the same commit that mounted the
    // component.
    queueMicrotask(reconcile);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconcile();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [reconcile]);

  /**
   * NOT async, and that is load-bearing.
   *
   * An `async` handler invites an `await` between the write and the navigation,
   * and one `await` is all it takes to turn "the event is queued, now go" into
   * "the operator waits for a logging endpoint before their guest gets a
   * message".
   */
  function openWhatsApp(): void {
    const clientEventId = crypto.randomUUID();

    writeStash(invitationId, clientEventId);
    postEventBeacon(beaconPath, { invitationId, clientEventId });
    browserNavigation.assign(waUrl);
  }

  function answered(
    action: (formData: FormData) => void | Promise<void>,
  ): (formData: FormData) => void | Promise<void> {
    return (formData) => {
      clearStash(invitationId);
      setAwaitingAnswer(false);

      return action(formData);
    };
  }

  return (
    <section className="dispatch-launcher">
      <h2>Preparar el envío para {greetingName}</h2>

      <p className="dispatch-launcher__recipient">
        El mensaje se dirige a {recipientName}.
      </p>

      <p className="dispatch-launcher__state">
        {DISPATCH_STATE_LABELS[dispatchState]}
      </p>

      <p className="dispatch-launcher__disclosure">
        Al abrir el enlace queda registrado únicamente que se abrió WhatsApp. La
        aplicación no puede saber si el mensaje llegó a enviarse: eso solo lo
        sabe quien lo envía, y por eso hace falta confirmarlo aquí después.
      </p>

      {/*
        A button, never an <a href="https://wa.me/...">. A link would be a second
        route to the same destination that writes no event at all, and it would
        be the one the operator reached for first.
      */}
      <button
        className="dispatch-launcher__open"
        type="button"
        onClick={openWhatsApp}
      >
        Abrir WhatsApp con el mensaje
      </button>

      {awaitingAnswer && (
        <div className="dispatch-launcher__confirm">
          <p>¿Se envió el mensaje a {recipientName}?</p>

          <form action={answered(markSentAction)}>
            <input type="hidden" name="invitationId" value={invitationId} />
            <button type="submit">Marcar como enviada</button>
          </form>

          <form action={answered(markFailedAction)}>
            <input type="hidden" name="invitationId" value={invitationId} />
            <button type="submit">No se pudo enviar</button>
          </form>
        </div>
      )}
    </section>
  );
}
