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
    /*
      THE GROUND IS FULL WIDTH; ONLY THE WORDS ARE NARROW.

      `max-w-md` sat on this element first, which capped the BACKGROUND too and
      left cream bars down both sides of a dark page — the kind of thing that
      reads as a broken stylesheet rather than as a design. The measure belongs
      to the text, so the text is what carries it.
    */
    <main
      className="
        invitation-unavailable flex min-h-dvh flex-col items-center
        justify-center bg-[#0d1114] px-6 text-center text-[#f6efe2]
      "
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        {/*
        THE DARK GROUND WITHOUT THE PHOTOGRAPH, AND THE ABSENCE IS DELIBERATE.

        This page answers a slug nobody holds. Framing the couple's photograph
        above "no encontramos esta invitación" would put their wedding on a
        screen reached by typing a wrong address — and, more practically, the
        page must say nothing about whether that address could have been right.
        The ground keeps it part of the same product; the picture stays behind
        the gate.
      */}
        <h1 className="font-display text-2xl text-balance sm:text-3xl">
          No encontramos esta invitación
        </h1>
        <p className="text-sm text-[#f6efe2]/85">
          Puede que el enlace esté incompleto o que haya sido reemplazado por
          uno más reciente.
        </p>
        <p className="text-sm text-[#f6efe2]/70">
          Escríbanle a la persona que les compartió el enlace y pídanle un nuevo
          enlace. Con gusto se lo enviarán otra vez.
        </p>
      </div>
    </main>
  );
}
