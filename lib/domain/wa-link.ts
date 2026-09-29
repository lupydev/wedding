/**
 * The two WhatsApp links for one recipient and one prepared message.
 *
 * Both address the RECIPIENT only. WhatsApp's click-to-chat URL has no sender
 * parameter, so nothing here can choose which account the message leaves from —
 * that is physical, per device. Neither one sends anything either: they prepare
 * a draft a human opens inside WhatsApp and sends by hand.
 *
 * WHY THERE ARE TWO, AND WHICH ONE IS THE DISPATCH
 *
 * `https://wa.me/…` is a REDIRECTOR owned by Meta. On a desktop it answers with
 * `api.whatsapp.com/send/?phone=…`, a full web page carrying an "Abrir
 * aplicación" button — so the operator presses twice, and the second press is
 * on a page that exists to ask for permission they already gave. Across an
 * evening of fifty invitations that is fifty round trips through a page nobody
 * needed.
 *
 * `whatsapp://send?phone=…&text=…` is not fetched at all. The browser hands it
 * to the operating system, which passes it to the installed application. No
 * page, no redirect, no second press. That is the dispatch link.
 *
 * AND WHY THE REDIRECTOR IS STILL BUILT
 *
 * A custom scheme that nothing claims fails SILENTLY: no navigation, no error,
 * no page. `wa.me` degrades visibly instead — it answers with a page offering
 * the download. So the web link stays as the fallback the console reveals after
 * the direct one has been pressed, and the two are built from the same
 * recipient and the same text so a fallback can never carry a different draft.
 *
 * MEASURED, NOT ASSUMED: assigning `whatsapp://` does NOT unload the document.
 * In Chromium 1243 and WebKit 26.6 the page survives, `pagehide` never fires,
 * no request leaves, and a `sendBeacon` queued on the line before is delivered.
 * That is strictly more room for the `link_opened` write than `wa.me` gave it,
 * not less — `components/console/DispatchLauncher.tsx` depends on the ordering
 * either way and says so.
 */

/** Matches the same E.164 shape the database enforces on `phone_e164`. */
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

const WA_ME_ORIGIN = "https://wa.me";

/** The URI the operating system routes to the installed WhatsApp. */
const WHATSAPP_APP_TARGET = "whatsapp://send";

/**
 * Validates one dispatch and returns the recipient's digits.
 *
 * The recipient MUST already be E.164. Silently cleaning up a malformed number
 * here would hide the real bug — an un-normalized phone reaching the link
 * builder — and produce a link that opens a chat with the wrong person or no
 * one. `normalizeForStorage` is the one place that shape is produced.
 *
 * Shared by both builders on purpose: a fallback that accepted a number the
 * primary refused would be a way in through the quieter door.
 */
function dispatchDigits(recipientE164: string, text: string): string {
  if (!E164_PATTERN.test(recipientE164)) {
    throw new Error(
      "A WhatsApp link requires an E.164 recipient (for example +525512345678)",
    );
  }

  if (text === "") {
    throw new Error("A WhatsApp link requires a non-empty message");
  }

  return recipientE164.slice(1);
}

/**
 * Builds the `whatsapp://` URI the console's dispatch button opens.
 *
 * The message is percent-encoded with `encodeURIComponent`, which is what turns
 * a newline into `%0A`, carries a multi-codepoint emoji through as its UTF-8
 * bytes, and keeps a literal `&` or `?` in the guest's text from inventing a
 * third parameter beside `phone` and `text`. That last one matters more here
 * than it did on `wa.me`: the recipient travels in this query too, so an
 * unescaped `&phone=` inside a household's name could open the wrong chat.
 */
export function buildWhatsAppAppLink(
  recipientE164: string,
  text: string,
): string {
  const digits = dispatchDigits(recipientE164, text);

  return `${WHATSAPP_APP_TARGET}?phone=${digits}&text=${encodeURIComponent(text)}`;
}

/**
 * Builds the `wa.me` web link — the fallback, not the dispatch.
 *
 * Same recipient, same encoding, same draft. What differs is who resolves it:
 * this one goes to Meta and comes back as a page, which is the cost that made
 * it the fallback and the visible failure that keeps it one.
 */
export function buildWaMeLink(recipientE164: string, text: string): string {
  const digits = dispatchDigits(recipientE164, text);

  return `${WA_ME_ORIGIN}/${digits}?text=${encodeURIComponent(text)}`;
}
