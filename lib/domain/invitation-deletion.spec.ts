import { describe, expect, it } from "vitest";

import { canDeleteInvitation } from "./invitation-deletion";

/**
 * Whether an invitation may be permanently deleted.
 *
 * ANY dispatch event refuses, and that is broader than "was it sent".
 *
 * `link_opened` means a device fetched that URL, so the link has demonstrably
 * left this system's control regardless of who clicked it. `marked_failed`
 * records only that the OPERATOR BELIEVES it did not arrive — not that it never
 * left. Both carry the same risk a confirmed send does: a real guest may be
 * holding that URL, and deleting the invitation turns their link into a
 * mystery. Slug rotation is the answer to "sent by mistake"; deletion is not.
 *
 * The permitting case is asserted beside the refusals, in the same describe: a
 * function that refused everything would satisfy every refusal test here and
 * make deletion impossible, which is a different bug with no failing test.
 */

describe("canDeleteInvitation", () => {
  it("permits an invitation with no dispatch history and refuses one with a send", () => {
    expect(canDeleteInvitation([], { hasStoredAnswer: false })).toEqual({
      ok: true,
    });
    expect(
      canDeleteInvitation([{ kind: "marked_sent" }], {
        hasStoredAnswer: false,
      }),
    ).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["marked_sent"],
    });
  });

  it("refuses an invitation whose link was merely opened", () => {
    // Not an operator-asserted send, and refused all the same: a device fetched
    // that URL, so it is out there.
    expect(
      canDeleteInvitation([{ kind: "link_opened" }], {
        hasStoredAnswer: false,
      }),
    ).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["link_opened"],
    });
  });

  it("refuses an invitation the operator marked as failed", () => {
    expect(
      canDeleteInvitation([{ kind: "marked_failed" }], {
        hasStoredAnswer: false,
      }),
    ).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["marked_failed"],
    });
  });

  it("names every distinct kind that triggered the refusal, in the order seen", () => {
    // The refusal has to be explainable to the person reading it, and "already
    // dispatched" on an invitation nobody sent reads as a bug until it says
    // which events it means.
    const outcome = canDeleteInvitation(
      [
        { kind: "link_opened" },
        { kind: "marked_failed" },
        { kind: "link_opened" },
      ],
      { hasStoredAnswer: false },
    );

    expect(outcome).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["link_opened", "marked_failed"],
    });
  });

  it("refuses on a kind it has never heard of", () => {
    // The gate is the EXISTENCE of a row, not a list of known kinds. A kind
    // added by a later migration must refuse on the day it is added, not on the
    // day somebody remembers to extend a list here.
    expect(
      canDeleteInvitation([{ kind: "some_future_kind" }], {
        hasStoredAnswer: false,
      }),
    ).toMatchObject({
      ok: false,
      reason: "already_dispatched",
    });
  });
});

describe("canDeleteInvitation — a stored answer is its own evidence", () => {
  // THE DISPATCH LOG IS NOT THE ONLY WAY A LINK ESCAPES.
  //
  // `link_opened` is written by a best-effort `navigator.sendBeacon` fired from
  // the operator's own browser as it navigates away to wa.me. Offline handset,
  // tab torn down before the flush, a blocked request — the beacon is dropped
  // and nothing records it. If the operator then sends the message and never
  // answers the "was it sent?" prompt, the invitation carries ZERO events while
  // a real household holds the URL and may already have answered.
  //
  // A stored `rsvp_responses` row is independent proof that a guest had the
  // link. Deleting anyway either destroys that household's recorded answer or
  // dies against the append-only trigger with a raw Postgres error in the
  // operator's face.
  it("refuses when a household has answered, even with an empty dispatch log", () => {
    const outcome = canDeleteInvitation([], { hasStoredAnswer: true });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe("already_answered");
  });

  it("still permits deletion when nothing was dispatched and nobody answered", () => {
    // The permitting counterpart, in the same block: a refusal test alone
    // cannot tell you the guard refuses the RIGHT thing.
    expect(canDeleteInvitation([], { hasStoredAnswer: false })).toEqual({
      ok: true,
    });
  });

  it("reports the dispatch log first when both are true, because it came first", () => {
    const outcome = canDeleteInvitation([{ kind: "marked_sent" }], {
      hasStoredAnswer: true,
    });

    expect(outcome.ok === false && outcome.reason).toBe("already_dispatched");
  });
});
