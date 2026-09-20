import { describe, expect, it } from "vitest";

import {
  CONSOLE_TONE_VALUES,
  CONTRADICTED_ANSWER_TONE,
  dispatchStateTone,
  preflightGroupTone,
  rsvpAnswerTone,
} from "./console-status";
import { DISPATCH_STATE_LABELS } from "@/lib/domain/dispatch-state";
import { RSVP_ANSWER_LABELS } from "@/lib/domain/console-list";
import { PREFLIGHT_BLOCKER_ORDER } from "@/lib/domain/dispatch-preflight";

/**
 * Which of the three signal colours each console status is allowed to wear.
 *
 * THE COLOUR RULE, AS A TOTAL FUNCTION.
 *
 * Gold means "this needs your attention", green means "done", red means "broken or
 * missing", and `quiet` means none of the three. A reference send screen put four
 * green buttons on every guest row across 388 guests and none of them read as the
 * important one — because the colour had been chosen at each call site, by whoever
 * was writing that row, for whatever "good" meant to them that afternoon.
 *
 * A total function over the state unions removes the call-site decision entirely,
 * and the exhaustiveness tests below remove the possibility of a new state
 * arriving with no tone at all.
 */

describe("dispatchStateTone", () => {
  it("covers every dispatch state, so a new one cannot arrive untoned", () => {
    for (const state of Object.keys(DISPATCH_STATE_LABELS)) {
      expect(CONSOLE_TONE_VALUES).toContain(
        dispatchStateTone(state as keyof typeof DISPATCH_STATE_LABELS),
      );
    }
  });

  it("asks for attention on a household that still has to be sent", () => {
    expect(dispatchStateTone("not_dispatched")).toBe("attention");
  });

  it("asks for attention on an opened link, because it is not a send", () => {
    // The application cannot observe a send. An opened link is unfinished work,
    // and green here would be the exact lie the labels are written to avoid.
    expect(dispatchStateTone("link_opened")).toBe("attention");
  });

  it("calls an operator-confirmed send done", () => {
    expect(dispatchStateTone("marked_sent")).toBe("done");
    expect(dispatchStateTone("resent")).toBe("done");
  });

  it("calls a failed send broken", () => {
    expect(dispatchStateTone("marked_failed")).toBe("broken");
  });
});

describe("rsvpAnswerTone", () => {
  it("covers every answer", () => {
    for (const answer of Object.keys(RSVP_ANSWER_LABELS)) {
      expect(CONSOLE_TONE_VALUES).toContain(
        rsvpAnswerTone(answer as keyof typeof RSVP_ANSWER_LABELS),
      );
    }
  });

  it("calls a confirmed household done", () => {
    expect(rsvpAnswerTone("attending")).toBe("done");
  });

  it("leaves an unanswered household quiet, because the next move is not the operator's", () => {
    // Gold would be wrong: the operator cannot answer for a guest. A list where
    // every unanswered household shouts is a list where nothing does.
    expect(rsvpAnswerTone("pending")).toBe("quiet");
  });

  it("leaves a declined household quiet rather than broken or done", () => {
    // "No asiste" is a valid, complete answer and no fault of anybody's. Red would
    // read as an error; green would read as good news.
    expect(rsvpAnswerTone("declined")).toBe("quiet");
  });

  it("uses green for exactly one answer, so green keeps one meaning", () => {
    const green = Object.keys(RSVP_ANSWER_LABELS).filter(
      (answer) =>
        rsvpAnswerTone(answer as keyof typeof RSVP_ANSWER_LABELS) === "done",
    );

    expect(green).toEqual(["attending"]);
  });
});

describe("preflightGroupTone", () => {
  it("calls an invitation nobody has chosen a recipient for broken", () => {
    // A decision is missing, which is work for the operator — the same kind of
    // work a missing number is, and it reads the same way on the row.
    expect(preflightGroupTone("no_recipient_chosen")).toBe("broken");
  });

  it("calls a chosen recipient with no number on file broken", () => {
    expect(preflightGroupTone("recipient_has_no_phone")).toBe("broken");
  });

  it("calls a chosen number that cannot receive WhatsApp broken", () => {
    expect(preflightGroupTone("recipient_phone_unreachable")).toBe("broken");
  });

  it("calls a stale recipient choice broken", () => {
    expect(preflightGroupTone("recipient_not_in_household")).toBe("broken");
  });

  it("calls an already-dispatched household done", () => {
    expect(preflightGroupTone("already_dispatched")).toBe("done");
  });

  it("gives every blocker kind a tone, so a new one cannot render untoned", () => {
    for (const kind of PREFLIGHT_BLOCKER_ORDER) {
      expect(preflightGroupTone(kind)).not.toBe("");
    }
    expect(PREFLIGHT_BLOCKER_ORDER).toHaveLength(5);
  });
});

describe("CONTRADICTED_ANSWER_TONE", () => {
  it("is one of the four tones, like every other console status", () => {
    expect(CONSOLE_TONE_VALUES).toContain(CONTRADICTED_ANSWER_TONE);
  });

  it("calls an answer its household no longer agrees with broken", () => {
    // Red for the same reason `no_recipient_chosen` is red: the data does not
    // add up and somebody has to look. Gold would promise work the operator can
    // finish, and there is none — `rsvp_responses` is append-only, so the stored
    // answer can never be corrected, only read honestly.
    expect(CONTRADICTED_ANSWER_TONE).toBe("broken");
    // And never green: on this screen green means exactly one thing, that the
    // household is coming.
    expect(CONTRADICTED_ANSWER_TONE).not.toBe(rsvpAnswerTone("attending"));
  });
});
