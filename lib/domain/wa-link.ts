/**
 * `wa.me` click-to-chat deep links.
 *
 * The link addresses the RECIPIENT only. WhatsApp's click-to-chat URL has no
 * sender parameter, so nothing here can choose which account the message leaves
 * from — that is physical, per device. This module also never sends anything: it
 * prepares a URL a human opens inside WhatsApp and sends by hand.
 */

/** Matches the same E.164 shape the database enforces on `phone_e164`. */
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

const WA_ME_ORIGIN = "https://wa.me";

/**
 * Builds a `wa.me` deep link for a recipient and a prepared message.
 *
 * The recipient MUST already be E.164. Silently cleaning up a malformed number
 * here would hide the real bug — an un-normalized phone reaching the link
 * builder — and produce a link that opens a chat with the wrong person or no
 * one. `normalizeForStorage` is the one place that shape is produced.
 *
 * The message is percent-encoded with `encodeURIComponent`, which is what turns
 * a newline into `%0A` and keeps a literal `&` or `?` in the guest's text from
 * injecting a second query parameter.
 */
export function buildWaMeLink(recipientE164: string, text: string): string {
  if (!E164_PATTERN.test(recipientE164)) {
    throw new Error(
      "buildWaMeLink requires an E.164 recipient (for example +525512345678)",
    );
  }

  if (text === "") {
    throw new Error("buildWaMeLink requires a non-empty message");
  }

  const digits = recipientE164.slice(1);

  return `${WA_ME_ORIGIN}/${digits}?text=${encodeURIComponent(text)}`;
}
