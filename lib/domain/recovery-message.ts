import { renderMessageTemplate } from "./message-template";
import { buildWaMeLink } from "./wa-link";

/**
 * The gate's "I cannot get in" recovery link.
 *
 * This is the ONLY fallback. There is deliberately no one-time-password flow,
 * no email path and no second unlock mechanism: a guest who cannot match their
 * own number reaches a human over the channel the invitation arrived on, and
 * the human resolves it in seconds. A prior project shipped a complete
 * phone-plus-OTP recovery and its own records show it was never used once
 * across a whole guest list.
 *
 * The recipient is the invitation's OWNING sender. Guest numbers are never
 * disclosed here or anywhere else on this surface; the couple's own contact
 * number is disclosed to slug holders on purpose, which is the accepted
 * tradeoff for having any recovery at all.
 *
 * Like every `wa.me` link in this product, it only PREPARES a draft. A human
 * presses send inside WhatsApp; nothing here transmits a message.
 */

/**
 * `greeting_name` is the only variable, matching the confirmed personalization
 * decision. The operator needs to know which household is stuck before they can
 * help, and asking "who is this?" over WhatsApp is exactly the friction this
 * link exists to remove.
 */
export const GATE_HELP_TEMPLATE =
  "Hola, somos {{greeting_name}}. Entramos al enlace de la invitación pero " +
  "no puedo abrir mi invitación con mi número de celular. ¿Nos pueden ayudar?";

/**
 * Builds the recovery deep link for one household.
 *
 * Throws when the household name is missing: `renderMessageTemplate` treats an
 * empty value as missing on purpose, because a draft reading "Hola, somos ." is
 * pasted into a real chat and cannot be recalled.
 */
export function buildGateRecoveryLink(
  ownerContactE164: string,
  greetingName: string,
): string {
  return buildWaMeLink(
    ownerContactE164,
    renderMessageTemplate(GATE_HELP_TEMPLATE, { greeting_name: greetingName }),
  );
}
