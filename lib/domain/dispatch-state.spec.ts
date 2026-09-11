import { describe, expect, it } from "vitest";

import {
  DISPATCH_STATE_LABELS,
  countsAsOperatorAssertedSend,
  deriveDispatchState,
  type DispatchEventRef,
} from "./dispatch-state";

function event(
  kind: DispatchEventRef["kind"],
  occurredAt: string,
): DispatchEventRef {
  return { kind, occurredAt };
}

describe("deriveDispatchState", () => {
  it("reports nothing dispatched when no event was ever recorded", () => {
    expect(deriveDispatchState([])).toBe("not_dispatched");
  });

  it("reports an opened link as its own state, not as a send", () => {
    expect(
      deriveDispatchState([event("link_opened", "2026-01-01T10:00:00Z")]),
    ).toBe("link_opened");
  });

  it("prefers the operator's own confirmation over the link opening", () => {
    // The app cannot observe a send. `link_opened` is the app's only sensor and
    // `marked_sent` is the operator's testimony; testimony wins.
    expect(
      deriveDispatchState([
        event("link_opened", "2026-01-01T10:00:00Z"),
        event("marked_sent", "2026-01-01T10:00:30Z"),
      ]),
    ).toBe("marked_sent");
  });

  it("takes the NEWEST operator confirmation, so a later failure overrides an earlier send", () => {
    expect(
      deriveDispatchState([
        event("marked_sent", "2026-01-01T10:00:00Z"),
        event("marked_failed", "2026-01-02T09:00:00Z"),
      ]),
    ).toBe("marked_failed");
  });

  it("does not depend on the order the events arrive in", () => {
    expect(
      deriveDispatchState([
        event("marked_failed", "2026-01-02T09:00:00Z"),
        event("marked_sent", "2026-01-01T10:00:00Z"),
      ]),
    ).toBe("marked_failed");
  });

  it("reports a resend as a resend rather than collapsing it into a first send", () => {
    expect(
      deriveDispatchState([
        event("marked_sent", "2026-01-01T10:00:00Z"),
        event("resent", "2026-01-05T18:00:00Z"),
      ]),
    ).toBe("resent");
  });

  it("keeps an opened link visible when the operator never confirmed anything", () => {
    expect(
      deriveDispatchState([
        event("link_opened", "2026-01-01T10:00:00Z"),
        event("link_opened", "2026-01-03T11:00:00Z"),
      ]),
    ).toBe("link_opened");
  });
});

describe("countsAsOperatorAssertedSend", () => {
  /**
   * The rule this test exists for.
   *
   * `dispatch_events.kind` separates `link_opened` from `marked_sent` because
   * the application cannot observe a send: it only knows the operator opened a
   * `wa.me` link. Any filter shaped like "has been invited" that accepts
   * `link_opened` reports invitations that may never have been sent at all.
   */
  it("never accepts an opened link as evidence that a guest was invited", () => {
    expect(countsAsOperatorAssertedSend("link_opened")).toBe(false);
  });

  it("accepts only the two states the operator personally asserted", () => {
    expect(countsAsOperatorAssertedSend("marked_sent")).toBe(true);
    expect(countsAsOperatorAssertedSend("resent")).toBe(true);
  });

  it("rejects the states that assert no delivery", () => {
    expect(countsAsOperatorAssertedSend("not_dispatched")).toBe(false);
    expect(countsAsOperatorAssertedSend("marked_failed")).toBe(false);
  });
});

describe("DISPATCH_STATE_LABELS", () => {
  it("labels an opened link differently from a confirmed send", () => {
    expect(DISPATCH_STATE_LABELS.link_opened).not.toBe(
      DISPATCH_STATE_LABELS.marked_sent,
    );
  });

  it("gives every state a distinct operator-facing label", () => {
    const labels = Object.values(DISPATCH_STATE_LABELS);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("says out loud that an opened link is not a confirmed send", () => {
    expect(DISPATCH_STATE_LABELS.link_opened).toContain("sin confirmar");
  });
});
