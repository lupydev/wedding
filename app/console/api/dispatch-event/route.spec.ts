import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The beacon route's REFUSALS.
 *
 * `lib/server/dispatch.spec.ts` proves what `recordLinkOpened` writes, and
 * `e2e/console-dispatch.spec.ts` proves the happy path end to end. Neither says
 * anything about what this route turns AWAY, and the refusals are where the
 * route's security properties actually live:
 *
 *  - an unauthenticated post is answered with a STATUS and never a redirect,
 *    because a redirect is meaningless to `navigator.sendBeacon`;
 *  - `actor_sender_id` comes from the verified session and NEVER from the body,
 *    so a body that names a different actor cannot forge attribution;
 *  - the kind is not read from the body at all — this route can only ever write
 *    `link_opened`, so a body asking for `marked_sent` cannot bypass the
 *    device-declaration gate that guards the operator's own testimony;
 *  - both ids must be uuid-shaped, so free text never reaches the driver;
 *  - a write that fails because the invitation is gone is still a 204, because
 *    a beacon has no reader and there is nothing for anyone to do about it.
 *
 * Left untested, every one of these is a line of code with no evidence behind
 * it. They are asserted here rather than through a browser because a beacon
 * fires during unload and its response is unobservable to Playwright.
 */

const currentOperator = vi.fn();
vi.mock("@/lib/server/console-session", () => ({
  currentOperator: () => currentOperator(),
}));

const recordLinkOpened = vi.fn();
vi.mock("@/lib/server/dispatch", () => ({
  recordLinkOpened: (...args: unknown[]) => recordLinkOpened(...args),
}));

vi.mock("@/lib/server/supabase", () => ({
  createServerSupabaseClient: () => ({ marker: "supabase-client" }),
}));

const { POST } = await import("./route");

const OPERATOR = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  displayName: "Ana Operadora",
};
const INVITATION_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const CLIENT_EVENT_ID = "cccccccc-3333-4333-8333-333333333333";

/** A beacon-shaped request: a text body, exactly as `sendBeacon` sends one. */
function beacon(body: string): Request {
  return new Request("https://example.test/console/api/dispatch-event", {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body,
  });
}

beforeEach(() => {
  currentOperator.mockReset();
  recordLinkOpened.mockReset();
  currentOperator.mockResolvedValue(OPERATOR);
  recordLinkOpened.mockResolvedValue({ recorded: true });
});

describe("the dispatch-event beacon route — who may write", () => {
  it("refuses an unauthenticated post with 401 and writes nothing", async () => {
    currentOperator.mockResolvedValue(null);

    const response = await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: CLIENT_EVENT_ID,
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("answers an unauthenticated post with a status, never a redirect", async () => {
    currentOperator.mockResolvedValue(null);

    const response = await POST(beacon("{}"));

    // `requireOperator()` redirects. A redirect is invisible to a beacon, which
    // would follow it, receive the login page and report success while nothing
    // was recorded at all.
    expect(response.status).toBe(401);
    expect(response.status >= 300 && response.status < 400).toBe(false);
    expect(response.headers.get("location")).toBeNull();
  });

  it("attributes the event to the SESSION, ignoring an actor named in the body", async () => {
    await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: CLIENT_EVENT_ID,
          actorSenderId: "dddddddd-4444-4444-8444-444444444444",
        }),
      ),
    );

    expect(recordLinkOpened).toHaveBeenCalledTimes(1);
    expect(recordLinkOpened.mock.calls[0][1]).toEqual({
      invitationId: INVITATION_ID,
      actorSenderId: OPERATOR.id,
      clientEventId: CLIENT_EVENT_ID,
    });
  });

  it("writes link_opened only, whatever kind the body asks for", async () => {
    // `marked_sent` is the operator's own testimony and arrives through a
    // Server Action, where the device-declaration gate lives. If this route
    // read the kind from the body, a beacon would be a way around that gate.
    await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: CLIENT_EVENT_ID,
          kind: "marked_sent",
        }),
      ),
    );

    expect(recordLinkOpened).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(recordLinkOpened.mock.calls[0])).not.toContain(
      "marked_sent",
    );
  });
});

describe("the dispatch-event beacon route — what it accepts as a body", () => {
  it("accepts a well-formed beacon with 204", async () => {
    const response = await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: CLIENT_EVENT_ID,
        }),
      ),
    );

    expect(response.status).toBe(204);
    expect(recordLinkOpened).toHaveBeenCalledTimes(1);
  });

  it("refuses a body that is not JSON with 400 and writes nothing", async () => {
    const response = await POST(beacon("not json at all"));

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses an empty body with 400", async () => {
    const response = await POST(beacon(""));

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses a JSON body that is not an object with 400", async () => {
    const response = await POST(beacon("null"));

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses a JSON array with 400", async () => {
    const response = await POST(beacon("[]"));

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses a missing invitation id with 400", async () => {
    const response = await POST(
      beacon(JSON.stringify({ clientEventId: CLIENT_EVENT_ID })),
    );

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses a missing client event id with 400", async () => {
    const response = await POST(
      beacon(JSON.stringify({ invitationId: INVITATION_ID })),
    );

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses an invitation id that is not uuid-shaped with 400", async () => {
    // Free text here would reach the driver and come back as `22P02`, which is
    // a 500 for something that is simply not a valid identifier.
    const response = await POST(
      beacon(
        JSON.stringify({
          invitationId: "not-a-uuid",
          clientEventId: CLIENT_EVENT_ID,
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses a client event id that is not uuid-shaped with 400", async () => {
    const response = await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: "'; delete from dispatch_events; --",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });

  it("refuses a numeric invitation id with 400", async () => {
    const response = await POST(
      beacon(
        JSON.stringify({ invitationId: 7, clientEventId: CLIENT_EVENT_ID }),
      ),
    );

    expect(response.status).toBe(400);
    expect(recordLinkOpened).not.toHaveBeenCalled();
  });
});

describe("the dispatch-event beacon route — what it absorbs", () => {
  it("answers 204 when the write throws, because a beacon has no reader", async () => {
    // A foreign-key violation means the invitation is gone. There is nothing
    // the operator could do about it and nobody is reading this response.
    recordLinkOpened.mockRejectedValue(new Error("23503 foreign key"));

    const response = await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: CLIENT_EVENT_ID,
        }),
      ),
    );

    expect(response.status).toBe(204);
  });

  it("answers 204 for a duplicate, because the retry is by design", async () => {
    // The reconciliation on return re-posts the stashed id deliberately;
    // `dispatch_events_client_event_idx` rejects the duplicate, and that is the
    // retry succeeding rather than failing.
    recordLinkOpened.mockResolvedValue({ recorded: false });

    const response = await POST(
      beacon(
        JSON.stringify({
          invitationId: INVITATION_ID,
          clientEventId: CLIENT_EVENT_ID,
        }),
      ),
    );

    expect(response.status).toBe(204);
  });

  it("returns an empty body on every path", async () => {
    currentOperator.mockResolvedValue(null);
    expect(await (await POST(beacon("{}"))).text()).toBe("");

    currentOperator.mockResolvedValue(OPERATOR);
    expect(await (await POST(beacon("nope"))).text()).toBe("");

    expect(
      await (
        await POST(
          beacon(
            JSON.stringify({
              invitationId: INVITATION_ID,
              clientEventId: CLIENT_EVENT_ID,
            }),
          ),
        )
      ).text(),
    ).toBe("");
  });
});
