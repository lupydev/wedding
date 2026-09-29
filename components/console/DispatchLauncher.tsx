"use client";

import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "@/components/console/StatusBadge";
import { Button } from "@/components/ui/button";
import { dispatchStateTone } from "@/lib/design/console-status";
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
 * An ordinary `fetch` is cancelled on unload; an awaited one delays the handoff
 * the operator just asked for. So the `link_opened` event is written FIRST,
 * through `postEventBeacon`, which returns synchronously — and the handoff that
 * follows is never conditional on it and never waits for it. A guest who never
 * receives their invitation because a logging call hung is a far worse trade
 * than a missing audit row, and the missing row is reconciled on return anyway.
 *
 * THE DESTINATION IS `whatsapp://`, AND IT MADE THAT ORDERING SAFER RATHER THAN
 * RISKIER
 *
 * `https://wa.me/…` is a redirect to a Meta web page with an "Abrir aplicación"
 * button on it: two presses per household, the second one on a page that exists
 * to ask for permission the operator gave with the first. The custom scheme is
 * handed to the operating system instead and reaches the installed application
 * directly.
 *
 * That was measured before it was relied on. Assigning `whatsapp://` does NOT
 * unload the document — in Chromium 1243 and WebKit 26.6 the page survives,
 * `pagehide` never fires, no request leaves, and a `sendBeacon` queued on the
 * line before is delivered. `wa.me` genuinely unloaded the page under the
 * write; this does not. The ordering above stays exactly as it is, because it
 * is the guarantee that does not depend on which destination is configured.
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
 *
 * WHY THE PRESS NOW ASKS THE QUESTION, AND THE RETURN NO LONGER HAS TO
 *
 * While the dispatch was a navigation, "¿se envió?" could wait for a route
 * back: the document was replaced and re-rendered, or the tab went hidden and
 * came back. Neither happens under a scheme handoff. The page stays, and on a
 * desktop another application taking focus does not make a tab hidden — so
 * waiting for either signal would mean the question is never asked and the
 * send can never be recorded. Pressing the button asks it. The stash and the
 * `visibilitychange` listener both stay, because a machine where WhatsApp
 * genuinely replaced the tab is still a machine this has to work on.
 *
 * WHY THERE IS A SECOND, QUIETER LINK AND WHY IT IS NOT THE ROUTE THE BUTTON
 * RULE FORBIDS
 *
 * `whatsapp://` fails SILENTLY. No handler, no error, no page: the operator
 * presses, nothing happens, and nothing on the screen distinguishes a missed
 * click from a machine without WhatsApp. On the night fifty invitations go out
 * that is the worst shape a failure can take. `https://wa.me/…` is the link
 * that degrades visibly — it answers with a page offering the download — so it
 * is kept and offered as the way out.
 *
 * It is revealed only by the press. The rule the single route protects is that
 * no open goes unrecorded and that the operator cannot reach for the
 * unrecorded one FIRST; by the time this control exists, `link_opened` has
 * been written and stashed for this invitation. It writes no event of its own:
 * a second write for one press would be the same event twice, which is what
 * the stash exists to prevent. And it is a button, like the primary, because
 * an anchor is reachable by a middle click and a context menu before anything
 * has been recorded at all.
 *
 * IT OPENS A NEW TAB, AND THAT IS THE SAME PROPERTY THE PRIMARY HAS
 *
 * This screen has to survive both presses. The handoff leaves the document
 * alive, which is what lets the question be asked at all; a fallback that
 * navigated this tab away would take the question with it and leave a send
 * the operator had already made with nowhere to record it. So it opens
 * beside the console rather than over it.
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
  /**
   * The `whatsapp://` URI this button opens. Built server-side by
   * `buildInvitationDispatchLink`.
   */
  readonly waUrl: string;
  /**
   * The same draft as a `wa.me` link, from `buildInvitationWebFallbackLink`.
   *
   * Shown only after `waUrl` has been opened, for the case where nothing on
   * the machine answered the custom scheme and the operator saw no sign of it.
   */
  readonly webFallbackUrl: string;
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
  webFallbackUrl,
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
    // AFTER the handoff, never before: nothing may sit between the write and
    // the statement that opens WhatsApp. React flushes this once the handler
    // returns either way, so the position costs nothing and keeps the two
    // load-bearing lines adjacent.
    setAwaitingAnswer(true);
  }

  /**
   * The way out of a handoff that reached nobody.
   *
   * A NEW TAB, NEVER THIS ONE, AND THE REASON IS THE AUDIT TRAIL.
   *
   * The couple asked for it — "ese abrirlo en el navegador debe abrirse en una
   * nueva pestaña no en la actual" — and it is not a preference. The
   * `whatsapp://` handoff leaves this document alive, which is the only reason
   * "¿Se envió el mensaje?" can be asked at the press at all. Navigating this
   * tab to `wa.me` would take that question away with it, and the operator
   * would have to find their way back to record a send they had already made:
   * the exact gap the two-step dispatch exists to close. So the fallback
   * preserves what the primary now preserves — the console survives the press.
   *
   * Called straight out of the click handler with nothing awaited before it,
   * because a tab opened outside the user's own gesture is a tab the browser
   * is entitled to block. `openInNewTab` carries the `noopener` that keeps the
   * opened page from getting a handle on this window.
   *
   * Deliberately writes NO event. The press that revealed this control already
   * wrote `link_opened` and stashed its id; a second write would be one press
   * recorded twice, and the reconciliation on return re-posts the stashed id
   * anyway.
   */
  function openInBrowser(): void {
    browserNavigation.openInNewTab(webFallbackUrl);
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
    <section className="dispatch-launcher rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-base leading-snug">
        Preparar el envío para {greetingName}
      </h2>

      <p className="dispatch-launcher__recipient mt-2 text-sm text-foreground">
        El mensaje se dirige a {recipientName}.
      </p>

      <p className="dispatch-launcher__state mt-2">
        <StatusBadge
          label={DISPATCH_STATE_LABELS[dispatchState]}
          tone={dispatchStateTone(dispatchState)}
        />
      </p>

      <p
        className="dispatch-launcher__disclosure mt-3 text-sm text-hint"
        style={{ maxWidth: "48ch" }}
      >
        Al abrir el enlace queda registrado únicamente que se abrió WhatsApp. La
        aplicación no puede saber si el mensaje llegó a enviarse: eso solo lo
        sabe quien lo envía, y por eso hace falta confirmarlo aquí después.
      </p>

      {/*
        A button, never an <a href="https://wa.me/...">. A link would be a second
        route to the same destination that writes no event at all, and it would
        be the one the operator reached for first.
      */}
      {/*
        THE ONLY GOLD BUTTON ON THIS SCREEN. Gold means "this needs your attention",
        and there is exactly one thing on this page that does. A reference console put
        four green buttons on every row of its send screen and none of them read as
        the important one — the two confirmations below are therefore quiet and
        destructive respectively, never a second primary.
      */}
      <Button
        className="dispatch-launcher__open mt-4 w-full md:w-auto"
        type="button"
        onClick={openWhatsApp}
        size="lg"
      >
        Abrir WhatsApp con el mensaje
      </Button>

      {/*
        THE SILENT-FAILURE NOTICE, AND IT IS QUIET ON PURPOSE.

        `whatsapp://` reaching nobody looks exactly like a press that did not
        register, so the operator is told what silence means rather than left
        to guess. It sits under the primary and above the question because it
        answers the earlier of the two — "did anything happen?" comes before
        "did it get sent?". Link-styled, never a second primary: gold is
        reserved for the one press that records an event, and this one records
        nothing.
      */}
      {awaitingAnswer && (
        <p
          className="dispatch-launcher__fallback mt-4 text-sm text-hint"
          style={{ maxWidth: "48ch" }}
        >
          Si WhatsApp no se abrió, este equipo no tiene la aplicación o no la
          dejó abrirse. El enlace ya quedó registrado y se puede abrir igual.{" "}
          <Button
            className="dispatch-launcher__fallback-open h-auto p-0 align-baseline text-sm"
            type="button"
            onClick={openInBrowser}
            variant="link"
          >
            Abrirlo en el navegador
          </Button>
        </p>
      )}

      {awaitingAnswer && (
        <div className="dispatch-launcher__confirm mt-4 rounded-md border border-border bg-muted px-3 py-3">
          <p className="text-sm text-foreground">
            ¿Se envió el mensaje a {recipientName}?
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={answered(markSentAction)}>
              <input type="hidden" name="invitationId" value={invitationId} />
              <Button size="lg" type="submit" variant="outline">
                Marcar como enviada
              </Button>
            </form>

            <form action={answered(markFailedAction)}>
              <input type="hidden" name="invitationId" value={invitationId} />
              <Button size="lg" type="submit" variant="destructive">
                No se pudo enviar
              </Button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
