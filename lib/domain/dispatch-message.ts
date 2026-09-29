import { renderMessageTemplate } from "./message-template";
import { buildWaMeLink, buildWhatsAppAppLink } from "./wa-link";

/**
 * The invitation draft an operator sends over WhatsApp — pure.
 *
 * WHY THE TEMPLATE CARRIES NO EVENT FACT
 *
 * A reference project hard-coded the date and the venue into a message template
 * that had been reviewed and approved. The event later moved. The invitation
 * page was updated in minutes; the WhatsApp template was not, because nobody
 * thought of it as a place where the venue was written down. For weeks the
 * message announced one venue while the page it linked to showed another, and
 * every one of those messages had already been delivered and could not be
 * recalled.
 *
 * So the draft states no date, no time, no venue and no address. It carries a
 * greeting, the couple's names and a link, and the link resolves to the one
 * surface that can be corrected after the fact. The names are the one fact that
 * joined it, because a name identifies who is inviting while those four are
 * logistics that move. `INVITATION_MESSAGE_VARIABLES` is the complete list
 * of what may vary, and the unit test asserts that the only digits a rendered
 * message contains are the ones inside the URL — which is what makes "no date
 * in the template" an enforced property rather than a review habit.
 *
 * WHY A SECOND URL IS A HARD ERROR
 *
 * WhatsApp renders a preview card for the FIRST URL in a message and for no
 * other. A second link — pasted into a household name, or added later "just to
 * be helpful" — does not produce a second card. It costs the first one. The
 * Open Graph card is the single most visible thing this product makes, so a
 * draft that would contain two URLs is refused here rather than discovered in a
 * screenshot.
 */

/**
 * The one draft the console sends.
 *
 * IT SIGNS OFF WITH THE COUPLE'S NAMES, AND THEY COME FROM THE `ceremony` ROW
 *
 * It used to carry no names at all, because nothing in this repository knew them:
 * they were an unresolved brace-wrapped placeholder in a component, and
 * `renderMessageTemplate` would rather throw than ship a placeholder to a guest.
 * The note left here said the fix was "a template edit plus one new entry below",
 * once real details had somewhere to live. They now do — one editable row — so an
 * unsigned invitation is no longer the safest available draft.
 *
 * WHAT STILL DOES NOT ENTER THIS TEMPLATE, AND WHY THAT IS NOT INCONSISTENT
 *
 * The date, the time, the venue and the address stay out. The names and those
 * four facts differ in one decisive way: a name identifies who is inviting, and
 * the four facts are logistics that CHANGE. A reference project wrote the date
 * and the venue into an approved template, the event moved, the invitation page
 * was corrected in minutes, and every already-delivered message kept announcing
 * the old venue with no way to recall it. The link resolves to the surface that
 * can still be corrected; the logistics belong there and only there.
 *
 * The unit test keeps this honest by counting digits: the only digits a rendered
 * message may contain are the ones inside the URL, which is a property rather
 * than a review habit. A date or a street number cannot be added without
 * breaking it.
 *
 * ITS SHAPE IS PART OF IT, AND THAT IS WHY IT IS A TEMPLATE LITERAL
 *
 * The couple wrote this out line by line and the breaks are not decoration.
 * The URL sits ALONE on its own line with a blank line after it: that is the
 * form a thumb can hit without catching the words around it, and the form that
 * gives WhatsApp's link detector a clean target. A link with a comma or a
 * closing bracket welded to its tail is the ordinary way to ship an invitation
 * nobody can open.
 *
 * Written as one literal with real newlines rather than concatenated `\n`s, so
 * the value in the source has the shape of the message on the phone. A blank
 * line you can see is a blank line that survives an edit; `"...\n" + "\n" +
 * "..."` is one an editor eventually tidies away. `dispatch-message.spec.ts`
 * asserts the shape on the RENDERED draft rather than on this constant — a
 * correct template behind a renderer that collapsed it would pass a template
 * assertion and still reach the guest as a wall of text.
 */
export const INVITATION_MESSAGE_TEMPLATE = `Hola, {{greeting_name}}.

Nos alegra mucho invitarlos a nuestra boda 👰🏻‍♀️🤵🏼‍♂️.

En este enlace encontrarán la invitación con todos los detalles y el formulario para confirmar su asistencia:
{{invitation_url}}

Con cariño, {{couple_names}}.`;

/** Everything the draft is allowed to vary by. Nothing else is a variable. */
export const INVITATION_MESSAGE_VARIABLES: readonly string[] = [
  "greeting_name",
  "invitation_url",
  "couple_names",
];

/** Any absolute http(s) link, however it was introduced into the text. */
const URL_PATTERN = /https?:\/\/\S+/g;

export interface InvitationMessageInput {
  readonly greetingName: string;
  /** The absolute `/i/{slug}` URL. The only link the draft may contain. */
  readonly invitationUrl: string;
  /**
   * The couple's names, read from the `ceremony` row by the calling route.
   *
   * Required rather than optional. An optional signature is a signature that
   * some households receive and others do not, decided by whichever call site
   * was written last.
   */
  readonly coupleNames: string;
}

/**
 * Renders the draft for one household.
 *
 * Throws rather than degrades, in all three failure modes. This text is pasted
 * into a real chat and sent by a human within seconds; there is no state in
 * which a partially rendered draft is better than a visible error.
 */
export function buildInvitationMessage(input: InvitationMessageInput): string {
  const message = renderMessageTemplate(INVITATION_MESSAGE_TEMPLATE, {
    greeting_name: input.greetingName,
    invitation_url: input.invitationUrl,
    couple_names: input.coupleNames,
  });

  const urls = message.match(URL_PATTERN) ?? [];

  if (urls.length > 1) {
    throw new Error(
      "El mensaje debe contener una sola dirección web: WhatsApp solo genera " +
        "vista previa del primer enlace, así que un segundo enlace elimina la " +
        `tarjeta en lugar de añadir otra. Se encontraron ${urls.length}.`,
    );
  }

  return message;
}

/**
 * The link the dispatch button opens: recipient plus prefilled draft.
 *
 * `whatsapp://`, not `wa.me`. The web link is a redirect that lands the
 * operator on `api.whatsapp.com/send/…` and asks them to press "Abrir
 * aplicación" before WhatsApp opens at all; this one is handed to the
 * operating system and reaches the installed application with no page in
 * between. `wa-link.ts` carries the full reasoning and the measurement.
 */
export function buildInvitationDispatchLink(
  input: InvitationMessageInput & { readonly recipientE164: string },
): string {
  return buildWhatsAppAppLink(
    input.recipientE164,
    buildInvitationMessage(input),
  );
}

/**
 * The same draft as a `wa.me` link, for when the custom scheme reached nobody.
 *
 * A `whatsapp://` handoff that no application claims does NOTHING — no error,
 * no page, no way for the operator to tell a missed click from a machine
 * without WhatsApp. This link is the one that fails visibly, so the console
 * offers it after the direct one has been pressed and its event written.
 *
 * Built from the same input by the same message builder. A fallback carrying a
 * different draft would be worse than no fallback at all: the operator would
 * send the wrong message and nothing would say so.
 */
export function buildInvitationWebFallbackLink(
  input: InvitationMessageInput & { readonly recipientE164: string },
): string {
  return buildWaMeLink(input.recipientE164, buildInvitationMessage(input));
}

/** The minimum this module needs to know about a household member. */
export interface DispatchCandidateGuest {
  /**
   * The guest row's id — what a stored dispatch recipient choice names.
   *
   * Present on the candidate itself rather than carried alongside it: a
   * candidate that cannot be identified cannot be chosen, and every consumer of
   * this shape now resolves an explicit choice rather than picking one.
   */
  readonly id: string;
  readonly fullName: string;
  readonly phoneE164: string | null;
  /** From `classifyPhoneDispatchability`, computed upstream on the server. */
  readonly dispatchable: boolean;
}

/**
 * The `sendBeacon` target for `link_opened`.
 *
 * Under `/console` on purpose: the proxy matcher is scoped to
 * `/console/:path*`, so a beacon posted anywhere else would arrive with no
 * resolved operator identity and the event could not be attributed to anybody.
 */
export const DISPATCH_EVENT_BEACON_PATH = "/console/api/dispatch-event";

/** The compose view for one invitation. One literal, two call sites. */
export function consoleDispatchPath(invitationId: string): string {
  return `/console/dispatch/${invitationId}`;
}
