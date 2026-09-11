import { renderMessageTemplate } from "./message-template";
import { buildWaMeLink } from "./wa-link";

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
 * greeting and a link, and the link resolves to the one surface that can be
 * corrected after the fact. `INVITATION_MESSAGE_VARIABLES` is the complete list
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
 * Deliberately without the couple's names: nothing in this repository knows them
 * yet, and `renderMessageTemplate` fails loudly on an unresolved placeholder
 * rather than shipping `{{COUPLE_NAMES}}` to a guest. Task 7.1 is where real
 * details arrive, and adding a signature there is a template edit plus one new
 * entry below.
 */
export const INVITATION_MESSAGE_TEMPLATE =
  "Hola, {{greeting_name}}. Nos alegra mucho invitarlos a nuestra boda. " +
  "En este enlace encontrarán la invitación con todos los detalles y el " +
  "formulario para confirmar su asistencia: {{invitation_url}}";

/** Everything the draft is allowed to vary by. Nothing else is a variable. */
export const INVITATION_MESSAGE_VARIABLES: readonly string[] = [
  "greeting_name",
  "invitation_url",
];

/** Any absolute http(s) link, however it was introduced into the text. */
const URL_PATTERN = /https?:\/\/\S+/g;

export interface InvitationMessageInput {
  readonly greetingName: string;
  /** The absolute `/i/{slug}` URL. The only link the draft may contain. */
  readonly invitationUrl: string;
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

/** The `wa.me` deep link for one household: recipient plus prefilled draft. */
export function buildInvitationDispatchLink(
  input: InvitationMessageInput & { readonly recipientE164: string },
): string {
  return buildWaMeLink(input.recipientE164, buildInvitationMessage(input));
}

/** The minimum this module needs to know about a household member. */
export interface DispatchCandidateGuest {
  readonly fullName: string;
  readonly phoneE164: string | null;
  /** From `classifyPhoneDispatchability`, computed upstream on the server. */
  readonly dispatchable: boolean;
}

/** Why a household cannot be addressed at all. */
export type DispatchRecipientProblem =
  "no_phone_on_file" | "no_reachable_phone";

export type DispatchRecipientOutcome =
  | {
      readonly ok: true;
      readonly guest: DispatchCandidateGuest;
      readonly phoneE164: string;
    }
  | { readonly ok: false; readonly reason: DispatchRecipientProblem };

/**
 * Picks the household member the invitation is addressed to.
 *
 * THE FIRST REACHABLE NUMBER, NOT THE FIRST NUMBER. The repository returns a
 * household's guests with its primary contact first, so the primary wins
 * whenever it can carry the message — but a household whose primary line is a
 * landline and whose partner holds a mobile is addressable, and a rule that
 * insisted on the primary would report it as impossible.
 *
 * The two failure reasons are kept apart because they call for different work
 * from a person: one household needs a number typed in, the other needs a
 * different number found. Collapsing them into "no se puede enviar" would hide
 * which.
 */
export function selectDispatchRecipient(
  guests: readonly DispatchCandidateGuest[],
): DispatchRecipientOutcome {
  let sawPhone = false;

  for (const candidate of guests) {
    if (candidate.phoneE164 === null || candidate.phoneE164 === "") {
      continue;
    }

    sawPhone = true;

    if (candidate.dispatchable) {
      return { ok: true, guest: candidate, phoneE164: candidate.phoneE164 };
    }
  }

  return {
    ok: false,
    reason: sawPhone ? "no_reachable_phone" : "no_phone_on_file",
  };
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
