import type { RsvpAnswer } from "@/lib/domain/console-list";
import type { PreflightBlockerKind } from "@/lib/domain/dispatch-preflight";
import type { DispatchState } from "@/lib/domain/dispatch-state";

/**
 * THE COLOUR RULE, AS A TOTAL FUNCTION OVER EVERY CONSOLE STATUS.
 *
 * Gold means "this needs your attention". Green means "done". Red means "broken or
 * missing". `quiet` means none of the three, and most statuses are quiet.
 *
 * WHY THIS IS A FUNCTION AND NOT A CONVENTION
 *
 * A reference send screen put four green buttons on every guest row, across 388
 * guests, and none of them read as the important one. Nobody decided that: the
 * colour was picked at each call site, by whoever wrote that row, for whatever
 * "good" meant to them that afternoon. A total function over the state unions
 * removes the call-site decision, and `console-status.spec.ts` walks every member
 * of every union so a new state cannot arrive with no tone at all.
 *
 * `lib/design/console-theme.ts` holds the matching values and
 * `CONSOLE_SEMANTIC_COLOR_ROLES` states each meaning in words.
 */

/** The four tones. Three signal colours, plus "no signal". */
export type ConsoleTone = "attention" | "done" | "broken" | "quiet";

/** Every tone, so a test can prove a mapping returned one of them. */
export const CONSOLE_TONE_VALUES: readonly ConsoleTone[] = [
  "attention",
  "done",
  "broken",
  "quiet",
];

/**
 * The tone for one household's dispatch state.
 *
 * `link_opened` is ATTENTION and not done. The application cannot observe a send —
 * opening `wa.me` hands a draft to WhatsApp and a human presses the button, or does
 * not — so an opened link is unfinished work. Green there would be the exact lie
 * the state labels are written to avoid.
 */
export function dispatchStateTone(state: DispatchState): ConsoleTone {
  switch (state) {
    case "not_dispatched":
    case "link_opened":
      return "attention";
    case "marked_sent":
    case "resent":
      return "done";
    case "marked_failed":
      return "broken";
  }
}

/**
 * The tone for one household's answer.
 *
 * Only `attending` is green, so green on this screen means exactly one thing:
 * this household is coming.
 *
 * `pending` is QUIET, not gold. The operator cannot answer on a guest's behalf, so
 * an unanswered household is not work waiting for them — and a list where every
 * unanswered row shouts is a list where nothing does.
 *
 * `declined` is QUIET too. It is a valid, complete answer and nobody's fault: red
 * would read as an error and green would read as good news.
 */
export function rsvpAnswerTone(answer: RsvpAnswer): ConsoleTone {
  switch (answer) {
    case "attending":
      return "done";
    case "pending":
    case "declined":
      return "quiet";
  }
}

/** The tone for one readiness-check group. */
export function preflightGroupTone(kind: PreflightBlockerKind): ConsoleTone {
  switch (kind) {
    case "no_recipient_chosen":
    case "recipient_has_no_phone":
    case "recipient_phone_unreachable":
    case "recipient_not_in_household":
      return "broken";
    case "already_dispatched":
      return "done";
  }
}
