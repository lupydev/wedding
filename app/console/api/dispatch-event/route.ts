import { NextResponse } from "next/server";

import { currentOperator } from "@/lib/server/console-session";
import { recordLinkOpened } from "@/lib/server/dispatch";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * The `sendBeacon` target for `link_opened`.
 *
 * A PLAIN ROUTE HANDLER, NOT A SERVER ACTION (design decision D8)
 *
 * `navigator.sendBeacon` sends a Blob whose content type the user agent chooses,
 * and it is queued rather than awaited. A Server Action has an encoding contract
 * a beacon does not honour, so the request would be rejected before any of this
 * ran. A route handler is a stable, documented POST target that accepts whatever
 * the beacon actually sends.
 *
 * WHAT IT ACCEPTS, AND WHAT IT REFUSES
 *
 * `link_opened` only. The kind is not read from the body at all: the beacon
 * fires as the page unloads on the way to WhatsApp, and that is the one fact it
 * is in a position to report. `marked_sent` and `marked_failed` are the
 * operator's own testimony and arrive through Server Actions, where the
 * device-declaration gate and the ownership check live.
 *
 * `actor_sender_id` comes from the verified session and never from the body.
 * Ownership is deliberately NOT required here: a dispatch where the actor is not
 * the owner is exactly the pair the audit trail exists to preserve, and a route
 * that refused the write would destroy the only record that it happened.
 *
 * ALWAYS 204, INCLUDING FOR A DUPLICATE. The reconciliation on return re-posts
 * the stashed `client_event_id` by design; `dispatch_events_client_event_idx`
 * rejects the duplicate and that is the retry succeeding, not failing. Nothing
 * reads this response in any case — a beacon has no reader.
 */

/** A v4-shaped identifier. Both fields are ids, and neither may be free text. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BeaconPayload {
  readonly invitationId: string;
  readonly clientEventId: string;
}

/**
 * Parses the body as text, then as JSON.
 *
 * Not `request.json()`: that decides on the `Content-Type` the user agent chose
 * for the Blob, which for a beacon is `text/plain`. Reading the text and parsing
 * it ourselves means one parser serves both the beacon and the `keepalive`
 * fetch fallback.
 */
async function readPayload(request: Request): Promise<BeaconPayload | null> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await request.text());
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const { invitationId, clientEventId } = parsed as Record<string, unknown>;

  if (
    typeof invitationId !== "string" ||
    typeof clientEventId !== "string" ||
    !UUID_PATTERN.test(invitationId) ||
    !UUID_PATTERN.test(clientEventId)
  ) {
    return null;
  }

  return { invitationId, clientEventId };
}

export async function POST(request: Request): Promise<Response> {
  // Never `requireOperator()`: that redirects, and a redirect is meaningless to
  // a beacon. An unauthenticated post is refused with a status instead.
  const operator = await currentOperator();

  if (operator === null) {
    return new NextResponse(null, { status: 401 });
  }

  const payload = await readPayload(request);

  if (payload === null) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    await recordLinkOpened(createServerSupabaseClient(), {
      invitationId: payload.invitationId,
      actorSenderId: operator.id,
      clientEventId: payload.clientEventId,
    });
  } catch {
    // A foreign-key violation means the invitation is gone. There is nothing
    // for the operator to do about it and nobody is reading this response, so
    // it is absorbed rather than turned into a 500 in a log nobody watches.
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 204 });
}
