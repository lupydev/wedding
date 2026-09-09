import type { ReactNode } from "react";

/**
 * The gate screen: everything a guest sees before they are let through.
 *
 * Ordering is a product promise. The WhatsApp message said "your invitation",
 * so a bare number prompt would break that promise at the exact moment the page
 * demands something. The household is greeted first, the number is asked for
 * second. The greeting name discloses nothing new: WhatsApp already rendered it
 * on the preview card in the chat.
 *
 * Synchronous and props-only, like `InvitationBody`. The form itself is a
 * Client Component passed in as a child, so this file stays free of state and
 * the route keeps ONE server-rendered document with no Suspense boundary above
 * it — which is what keeps the per-guest Open Graph tags inside `<head>` of the
 * first response.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */
export function InvitationGate({
  greetingName,
  recoveryHref,
  children,
}: {
  readonly greetingName: string;
  readonly recoveryHref: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="gate">
      <h1 className="gate__greeting">¡Hola, {greetingName}!</h1>
      <p className="gate__lead">Tenemos lista su invitación de matrimonio.</p>
      <p className="gate__ask">
        Para abrirla, escribe el número de celular que compartiste con nosotros.
      </p>

      {children}

      <p className="gate__recovery">
        <a href={recoveryHref} target="_blank" rel="noopener noreferrer">
          ¿No puedes entrar? Escríbenos por WhatsApp
        </a>
      </p>
    </section>
  );
}
