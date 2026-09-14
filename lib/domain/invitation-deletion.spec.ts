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
    expect(canDeleteInvitation([])).toEqual({ ok: true });
    expect(canDeleteInvitation([{ kind: "marked_sent" }])).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["marked_sent"],
    });
  });

  it("refuses an invitation whose link was merely opened", () => {
    // Not an operator-asserted send, and refused all the same: a device fetched
    // that URL, so it is out there.
    expect(canDeleteInvitation([{ kind: "link_opened" }])).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["link_opened"],
    });
  });

  it("refuses an invitation the operator marked as failed", () => {
    expect(canDeleteInvitation([{ kind: "marked_failed" }])).toEqual({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["marked_failed"],
    });
  });

  it("names every distinct kind that triggered the refusal, in the order seen", () => {
    // The refusal has to be explainable to the person reading it, and "already
    // dispatched" on an invitation nobody sent reads as a bug until it says
    // which events it means.
    const outcome = canDeleteInvitation([
      { kind: "link_opened" },
      { kind: "marked_failed" },
      { kind: "link_opened" },
    ]);

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
    expect(canDeleteInvitation([{ kind: "some_future_kind" }])).toMatchObject({
      ok: false,
      reason: "already_dispatched",
    });
  });
});
