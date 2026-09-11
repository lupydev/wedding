/**
 * Dispatch state, reduced from the append-only event log — pure.
 *
 * WHY THIS IS A REDUCTION AND NOT A COLUMN
 *
 * `dispatch_events` is append-only by trigger, exactly like `rsvp_responses`.
 * There is no `invitations.dispatch_state` to read, and there must not be one:
 * a column would have to be kept in step with the log by a second write that
 * can fail on its own, and the first time those two disagree the console starts
 * reporting a state the audit trail contradicts.
 *
 * WHY `link_opened` IS NOT A SEND
 *
 * The application cannot observe a send. Navigating to `wa.me` hands the
 * message to WhatsApp and a human presses the button — or does not. What the
 * server can record is that the operator opened the link, and that is what
 * `link_opened` means: a claim about a click, never about a delivery.
 *
 * So `link_opened` must never satisfy a filter shaped like "has been invited".
 * `countsAsOperatorAssertedSend` below is the one predicate allowed to answer
 * that question, and it accepts only the kinds an operator personally asserted.
 * The labels are distinct for the same reason: an operator reading a row must
 * be able to tell "I opened WhatsApp" apart from "I watched it send".
 */

/** The kinds `dispatch_events.kind` accepts, per its CHECK constraint. */
export type DispatchEventKind =
  "link_opened" | "marked_sent" | "marked_failed" | "resent";

/** One recorded event, as the reduction cares about it. */
export interface DispatchEventRef {
  readonly kind: DispatchEventKind;
  /** ISO 8601, exactly as Postgres rendered `occurred_at`. */
  readonly occurredAt: string;
}

/**
 * The state of one invitation's dispatch.
 *
 * `not_dispatched` is a state of the reduction, not a stored kind: it is what an
 * empty event list reduces to.
 */
export type DispatchState = "not_dispatched" | DispatchEventKind;

/**
 * The kinds that are the operator's own testimony about a delivery attempt.
 *
 * `link_opened` is deliberately absent — see the module comment. It is the
 * app's only sensor, and a sensor that fires on a click is not a witness to a
 * send.
 */
const OPERATOR_ASSERTIONS: ReadonlySet<DispatchEventKind> =
  new Set<DispatchEventKind>(["marked_sent", "marked_failed", "resent"]);

/**
 * Did the operator personally assert that this invitation went out?
 *
 * The ONLY predicate a "has been invited" filter may use. `marked_failed` is an
 * assertion too, but it asserts the opposite, so it is false here.
 */
export function countsAsOperatorAssertedSend(state: DispatchState): boolean {
  return state === "marked_sent" || state === "resent";
}

/**
 * Reduces one invitation's events to a single state.
 *
 * Newest operator assertion wins, so "marked as sent on Monday, marked as
 * failed on Tuesday" reads as failed rather than as sent. Only when the
 * operator never asserted anything does the opened link surface, and it
 * surfaces as itself.
 *
 * Ordering is computed here rather than assumed from the query: a caller that
 * fetched the log in a different order, or merged two fetches, must get the
 * same answer.
 */
export function deriveDispatchState(
  events: readonly DispatchEventRef[],
): DispatchState {
  let newestAssertion: DispatchEventRef | null = null;
  let sawLinkOpened = false;

  for (const candidate of events) {
    if (candidate.kind === "link_opened") {
      sawLinkOpened = true;
      continue;
    }

    if (!OPERATOR_ASSERTIONS.has(candidate.kind)) {
      continue;
    }

    if (
      newestAssertion === null ||
      candidate.occurredAt > newestAssertion.occurredAt
    ) {
      newestAssertion = candidate;
    }
  }

  if (newestAssertion !== null) {
    return newestAssertion.kind;
  }

  return sawLinkOpened ? "link_opened" : "not_dispatched";
}

/**
 * Operator-facing wording, one distinct sentence per state.
 *
 * `link_opened` says "sin confirmar" out loud. The console is the only place
 * the couple learns what happened, and a label that read simply "Enviada" for
 * an opened link would make the product assert a delivery nobody observed.
 */
export const DISPATCH_STATE_LABELS: Readonly<Record<DispatchState, string>> = {
  not_dispatched: "Sin enviar",
  link_opened: "Enlace abierto, envío sin confirmar",
  marked_sent: "Marcada como enviada",
  marked_failed: "Marcada como fallida",
  resent: "Reenviada",
};
