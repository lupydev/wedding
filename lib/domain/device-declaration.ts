/**
 * The per-device WhatsApp declaration, as pure decisions.
 *
 * TWO DIFFERENT QUESTIONS, AND WHY THEY MUST BE ALLOWED TO DISAGREE
 *
 * Authentication answers "who is operating this console?" and it is a fact: a
 * password, an `auth.users` row, a `senders.auth_user_id`. This module answers
 * "which WhatsApp account is installed on THIS handset?" and that is not a fact
 * the server can check. It is a self-declaration.
 *
 * It has to exist because `wa.me` addresses the RECIPIENT only. There is no
 * sender parameter. The message leaves from whichever WhatsApp is installed on
 * the device that opens the link, so which account sends is a physical property
 * of the phone in somebody's hand and not something the application can route.
 *
 * The two answers can disagree, and that disagreement is the entire point. A
 * silent filter — showing only the invitations the declared account owns — cannot
 * catch the case that matters: the bride signed in on the groom's phone, and a
 * guest is about to receive a wedding invitation from a number they may not
 * recognize. So a mismatch BLOCKS with an explanation instead of quietly
 * reshaping the list.
 *
 * And because the declaration is unverifiable, it is never an authorization
 * input. It gates one human-facing interstitial and nothing else. Console
 * access, guest-phone visibility and `actor_sender_id` all come from the
 * session.
 */

/** The picker. Where an undeclared device is sent, and the way back from a mismatch. */
export const CONSOLE_DEVICE_PATH = "/console/device";

/** The route that destroys the session, so the other operator can sign in. */
export const CONSOLE_SIGN_OUT_HREF = "/console/auth/sign-out";

/** What the device says, measured against who is signed in. */
export type DeviceDeclarationStatus = "undeclared" | "match" | "mismatch";

/**
 * Classifies the declaration this device carries.
 *
 * FAILS TO `undeclared`, NEVER TO A DEFAULT. An absent, empty or blank value is
 * a question that has not been answered, so the console asks it again. Guessing
 * "probably whoever is signed in" would make clearing site data silently pick an
 * operator, which is exactly the declaration nobody made.
 */
export function classifyDeviceDeclaration(
  declaredSenderId: string | null | undefined,
  sessionSenderId: string,
): DeviceDeclarationStatus {
  const declared = declaredSenderId?.trim() ?? "";

  if (declared === "") {
    return "undeclared";
  }

  return declared === sessionSenderId ? "match" : "mismatch";
}

/**
 * May this device dispatch?
 *
 * Only on an explicit match. `undeclared` blocks too: the console redirects to
 * the picker before a list with send affordances ever renders, and a caller that
 * somehow reached a dispatch with no declaration must not be treated as a match.
 */
export function dispatchIsBlockedBy(status: DeviceDeclarationStatus): boolean {
  return status !== "match";
}

/** One way out of the interstitial. There is no third option that dismisses it. */
export interface DeviceMismatchExit {
  readonly href: string;
  readonly label: string;
}

/** The interstitial's copy. */
export interface DeviceMismatchMessage {
  readonly heading: string;
  readonly body: string;
  readonly exits: readonly DeviceMismatchExit[];
}

/** Wording for a declared account whose sender row is gone. */
const UNKNOWN_DECLARED_ACCOUNT = "una cuenta que ya no existe en el panel";

/**
 * Explains the mismatch in terms of the two assumptions that collided.
 *
 * Both names, on purpose: the operator has to be able to tell which of the two
 * is wrong — the session or the declaration — and only they can know. The copy
 * states why the application cannot resolve it on their behalf, because an
 * unexplained block invites the reflex of looking for the way around it.
 */
export function describeDeviceMismatch(input: {
  readonly sessionDisplayName: string;
  readonly declaredDisplayName: string | null;
}): DeviceMismatchMessage {
  const declared = input.declaredDisplayName ?? UNKNOWN_DECLARED_ACCOUNT;

  return {
    heading:
      "La cuenta de WhatsApp de este dispositivo no coincide con la sesión",
    body:
      `La sesión está iniciada como ${input.sessionDisplayName}, pero en este ` +
      `dispositivo se declaró que está instalada la cuenta de WhatsApp de ${declared}. ` +
      "Los enlaces wa.me solo indican quién recibe el mensaje: no existe forma de " +
      "elegir desde qué cuenta se envía, así que el mensaje saldría de la cuenta " +
      "instalada en este teléfono. Para evitar que una invitación llegue desde un " +
      "número que la persona invitada no reconoce, los envíos quedan bloqueados " +
      "hasta que ambas coincidan. El resumen de respuestas sigue disponible solo " +
      "para lectura.",
    exits: [
      {
        href: CONSOLE_DEVICE_PATH,
        label: "Cambiar la declaración del dispositivo",
      },
      {
        href: CONSOLE_SIGN_OUT_HREF,
        label: "Iniciar sesión con la otra cuenta",
      },
    ],
  };
}
