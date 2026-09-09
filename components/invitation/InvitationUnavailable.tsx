/**
 * What a guest sees when a slug is unknown, malformed or has been rotated.
 *
 * A raw framework 404 is the wrong answer here twice over. It reads as an
 * accusation to someone who only clicked a link they were sent, and it gives
 * them no way forward. Rotation is a normal operation in this product — a link
 * forwarded to the wrong person is rotated on purpose — so this page is a
 * routine outcome, not a failure.
 *
 * The copy never mentions the slug and never says whether an invitation ever
 * existed: a stranger probing slugs must learn nothing from the difference.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */
export function InvitationUnavailable() {
  return (
    <main className="invitation-unavailable">
      <h1>No encontramos esta invitación</h1>
      <p>
        Puede que el enlace esté incompleto o que haya sido reemplazado por uno
        más reciente.
      </p>
      <p>
        Escríbanle a la persona que les compartió el enlace y pídanle un nuevo
        enlace. Con gusto se lo enviarán otra vez.
      </p>
    </main>
  );
}
