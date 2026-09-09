/**
 * What the phone gate says to a guest, as pure text.
 *
 * Pure and here rather than inside the component for two reasons. The
 * pluralization and the minute rounding are real logic worth testing without a
 * DOM, and — more importantly — the ONE-message rule is a security property
 * that deserves a test of its own rather than a code review comment.
 *
 * The rule: a rejection never says WHY. Not "that number is not on the guest
 * list", not "this household has no number on file", not "no such invitation".
 * Any of those turns a forwarded link into a phone-number checker for that
 * household. The guest is told the state of their own attempts instead, which
 * is actionable and discloses nothing about anyone else.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** The single sentence every failed attempt produces, whatever caused it. */
export const GATE_GENERIC_FAILURE =
  "No pudimos confirmar ese número. Revisa que sea el celular que compartiste con nosotros e inténtalo de nuevo.";

export type GateFeedback =
  | { readonly status: "idle" }
  | { readonly status: "rejected"; readonly attemptsRemaining: number }
  | { readonly status: "locked"; readonly retryAfterMs: number };

function attemptsSentence(remaining: number): string {
  if (remaining <= 0) {
    // Promising "te quedan 0 intentos" reads as a bug. Saying the allowance is
    // spent is both accurate and a warning the next try will be refused.
    return "Ese fue el último intento disponible por ahora.";
  }

  return remaining === 1
    ? "Te queda 1 intento."
    : `Te quedan ${remaining} intentos.`;
}

function waitSentence(retryAfterMs: number): string {
  // Rounded UP, and never below one: "espera 0 minutos" is not an instruction,
  // and rounding down would send the guest back before the lockout expires.
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  const unit = minutes === 1 ? "1 minuto" : `${minutes} minutos`;

  return `Por seguridad, espera ${unit} antes de intentarlo de nuevo.`;
}

/** The lines to show under the phone input, in order. Empty before the first try. */
export function gateFeedbackMessages(
  feedback: GateFeedback,
): readonly string[] {
  switch (feedback.status) {
    case "idle":
      return [];
    case "rejected":
      return [
        GATE_GENERIC_FAILURE,
        attemptsSentence(feedback.attemptsRemaining),
      ];
    case "locked":
      return [waitSentence(feedback.retryAfterMs)];
  }
}
