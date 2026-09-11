import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DispatchEventKind,
  DispatchEventRef,
} from "@/lib/domain/dispatch-state";

/**
 * Writes to the append-only dispatch log.
 *
 * WHAT THIS MODULE IS ALLOWED TO KNOW
 *
 * `actor_sender_id` always arrives from the caller, and every caller resolves it
 * from the verified SESSION. There is no code path where a browser-supplied
 * value becomes an actor: that column is the audit trail, and an audit trail the
 * audited party can write is not one.
 *
 * WHY A MISMATCH IS STORED RATHER THAN REFUSED
 *
 * `invitations.owner_sender_id` says who should have sent an invitation;
 * `actor_sender_id` says who did. Wrong-owner dispatch cannot be prevented at
 * the protocol level — `wa.me` has no sender parameter, so the message leaves
 * from whichever WhatsApp is installed on the handset — so the product layers
 * defences and then RECORDS what happened. A module that rejected the write
 * would delete the only evidence that a guest received an invitation from a
 * number they may not recognise.
 *
 * WHY IDEMPOTENCE LIVES IN THE INDEX
 *
 * `dispatch_events_client_event_idx` is unique over `client_event_id` where it
 * is not null. The beacon write happens as the page unloads and is re-posted
 * when the operator comes back, so the same id arrives twice by design. The
 * duplicate is rejected by Postgres, atomically, and reported here as
 * `recorded: false` — a successful retry, not an error. A read-then-write check
 * in the application would be the same logic with a race in it.
 */

/** Postgres' unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

export interface RecordDispatchEventInput {
  readonly invitationId: string;
  /** From the verified session. NEVER a value the browser supplied. */
  readonly actorSenderId: string;
  readonly kind: DispatchEventKind;
  /**
   * The client-minted id that makes a beacon write idempotent.
   *
   * Absent for a server-side confirmation: two confirmations are two facts, and
   * the partial index leaves them both.
   */
  readonly clientEventId?: string | null;
}

export interface DispatchEventOutcome {
  /** `false` when this exact `client_event_id` was already recorded. */
  readonly recorded: boolean;
}

/** Appends one event. Never updates, never deletes — the trigger forbids both. */
export async function recordDispatchEvent(
  client: SupabaseClient,
  input: RecordDispatchEventInput,
): Promise<DispatchEventOutcome> {
  const { error } = await client.from("dispatch_events").insert({
    invitation_id: input.invitationId,
    actor_sender_id: input.actorSenderId,
    kind: input.kind,
    client_event_id: input.clientEventId ?? null,
  });

  if (error === null) {
    return { recorded: true };
  }

  if (error.code === UNIQUE_VIOLATION) {
    return { recorded: false };
  }

  throw new Error(`Could not record the dispatch event: ${error.message}`);
}

export interface LinkOpenedInput {
  readonly invitationId: string;
  readonly actorSenderId: string;
  readonly clientEventId: string;
}

/**
 * Records that the operator opened WhatsApp. NOT that anything was sent.
 *
 * The application has no sensor for a delivery. What it can observe is that a
 * link was opened, and that is all this kind ever claims — which is why
 * `countsAsOperatorAssertedSend` refuses it and why the console labels it "envío
 * sin confirmar".
 */
export async function recordLinkOpened(
  client: SupabaseClient,
  input: LinkOpenedInput,
): Promise<DispatchEventOutcome> {
  return recordDispatchEvent(client, { ...input, kind: "link_opened" });
}

export interface OperatorAssertionInput {
  readonly invitationId: string;
  readonly actorSenderId: string;
}

/** The operator's own testimony that the message went out. */
export async function markSent(
  client: SupabaseClient,
  input: OperatorAssertionInput,
): Promise<DispatchEventOutcome> {
  return recordDispatchEvent(client, { ...input, kind: "marked_sent" });
}

/** The operator's own testimony that it did not. */
export async function markFailed(
  client: SupabaseClient,
  input: OperatorAssertionInput,
): Promise<DispatchEventOutcome> {
  return recordDispatchEvent(client, { ...input, kind: "marked_failed" });
}

/**
 * One invitation's whole log, oldest first.
 *
 * The whole log rather than the newest row: `deriveDispatchState` is the single
 * place that decides which kind wins, and it needs to see that a link was opened
 * even when a later confirmation overrides it.
 */
export async function listDispatchEvents(
  client: SupabaseClient,
  invitationId: string,
): Promise<readonly DispatchEventRef[]> {
  const { data, error } = await client
    .from("dispatch_events")
    .select("kind, occurred_at")
    .eq("invitation_id", invitationId)
    .order("occurred_at");

  if (error) {
    throw new Error(`Could not read the dispatch log: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    kind: row.kind as DispatchEventKind,
    occurredAt: row.occurred_at as string,
  }));
}
