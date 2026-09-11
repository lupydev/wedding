import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvitationBody } from "@/components/invitation/InvitationBody";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { requireOperator } from "@/lib/server/console-session";
import { requiredDefaultPhoneCountry, siteOrigin } from "@/lib/server/env";
import {
  findConsoleInvitation,
  findInvitationBySlug,
  toGuestFacingInvitation,
} from "@/lib/server/invitations";
import { invitationPageUrl } from "@/lib/server/og-warm";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * The operator's preview of the unlocked invitation body.
 *
 * WHY THIS IS ITS OWN ROUTE AND NOT A MODE OF THE PUBLIC ONE
 *
 * The public `/i/[slug]` route has exactly ONE unlock path, and keeping it at
 * one is the reason this file exists. Three ways of previewing the body through
 * the public route were considered and all three were rejected:
 *
 *  - `?preview=1` — a guessable, permanently open hole appended to a URL every
 *    guest already holds. It would never be closed again.
 *  - a signed, short-lived preview token — better, but still a SECOND unlock
 *    path on the public route. A token that unlocks a real guest's invitation
 *    is the same capability as the phone gate with no rate limit, and tokens
 *    leak through browser history and the `Referer` header.
 *  - an admin-session bypass inside the public route — no new secret, and it
 *    dies with the session, but it makes the public route's authorization
 *    depend on two independent identities. That is exactly where authorization
 *    bugs live.
 *
 * A separate console page introduces no new authorization axis at all. It sits
 * inside the `(authenticated)` group, so the same `requireOperator()` that
 * guards every other console page guards it, and the public route never learns
 * the word "preview".
 *
 * WHY IT CANNOT DRIFT FROM WHAT THE GUEST SEES
 *
 * It renders `InvitationBody` — the same component `/i/[slug]` renders after
 * unlock — from the same `toGuestFacingInvitation` projection the public route
 * reads. Two implementations would drift and the operator would approve copy no
 * guest ever sees, so the sharing is structural rather than a convention:
 * `InvitationBody` is synchronous and props-only, one Vitest snapshot pins it,
 * and `e2e/console-preview.spec.ts` asserts both routes produce identical body
 * text for one seeded fixture.
 *
 * WHY THERE IS NO GATE PREVIEW
 *
 * The gate screen needs no preview mechanism. An operator can open `/i/{slug}`
 * and read it exactly as a guest does — the link below does that — because
 * being unable to get past the gate is the point of the gate.
 *
 * WHY IT SHOWS NO RSVP FORM
 *
 * The `rsvp` slot is deliberately left empty. A preview must not offer a
 * control no operator can meaningfully use, and submitting one here would write
 * a household's answer on their behalf.
 */

export const metadata: Metadata = {
  title: "Vista previa de la invitación",
  robots: { index: false, follow: false },
};

export default async function InvitationPreviewPage({
  params,
}: {
  readonly params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  // The layout already established the session. Asking again here is what makes
  // this page's own authorization legible at the page, rather than inherited
  // from a file two directories up that a later refactor could move.
  const operator = await requireOperator();

  const client = createServerSupabaseClient();
  const owned = await findConsoleInvitation(client, {
    invitationId,
    viewerSenderId: operator.id,
    defaultCountry: requiredDefaultPhoneCountry(),
  });

  // Ownership is applied as part of that lookup, and "does not exist", "is not
  // yours" and "is not an identifier at all" are the same answer — exactly as
  // on the compose view. Distinguishing them would confirm the existence of a
  // household this operator was not shown.
  if (owned === null) {
    notFound();
  }

  // Re-read through the GUEST-facing path rather than reshaping the console row.
  // The console projection carries `phone_e164`; this one has no phone field at
  // all, and it is the identical projection the public route renders. Sharing
  // the read is what makes "identical output" a property of the code rather
  // than a promise two routes make separately.
  const record = await findInvitationBySlug(client, owned.slug);

  if (record === null) {
    notFound();
  }

  const invitation = toGuestFacingInvitation(record);

  return (
    <main className="console__main console__preview">
      <h2>Vista previa de la invitación de {invitation.greetingName}</h2>

      <p className="console__preview-note">
        Así se ve la invitación una vez que la persona invitada pasa la
        verificación por teléfono. El formulario de confirmación no se muestra
        aquí: responder por otra persona cambiaría su respuesta de verdad.
      </p>

      <p className="console__preview-gate">
        Para ver la pantalla de verificación tal como la ve quien recibe el
        enlace, se puede abrir la invitación directamente:{" "}
        {/* The public URL, not a preview of it. There is nothing to bypass: the
            gate screen is what an unverified visitor sees, so opening the real
            link shows exactly it. */}
        <a
          href={invitationPageUrl(siteOrigin(), invitation.slug)}
          rel="noreferrer"
          target="_blank"
        >
          {invitationPageUrl(siteOrigin(), invitation.slug)}
        </a>
      </p>

      <div className="console__preview-body">
        <InvitationBody invitation={invitation} />
      </div>

      <a href={CONSOLE_ROOT_PATH}>Volver al panel</a>
    </main>
  );
}
