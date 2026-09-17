import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InvitationForm } from "@/components/console/InvitationForm";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { requireOperator } from "@/lib/server/console-session";

import { createInvitationAction } from "../../actions";

/**
 * Where an invitation is created by hand.
 *
 * Before this capability the ONLY way to create one was
 * `scripts/import-guests.ts`, which meant a household remembered the week
 * before the wedding had to be added by editing a JSON file and running an
 * import. This page is the answer to that, and it deliberately uses the same
 * form the edit route uses: one component, one write path, and no separate
 * "single guest" mode to disagree with the model.
 *
 * A thin async container, like every async RSC in this codebase. Vitest cannot
 * render one, so nothing is DECIDED here — the derivation, the refusals, the
 * advisories and the recipient rule all live in `InvitationForm` and
 * `lib/domain`, which are under unit test, and the round trip belongs to the
 * end-to-end suite.
 *
 * INSIDE THE `(authenticated)` GROUP ON PURPOSE. The group's layout calls
 * `requireOperator()` and renders the device-mismatch interstitial; this page
 * calls `requireOperator()` again anyway, for the same reason every other page
 * in the group does — one cached identity header and one indexed row, against a
 * page whose authorization would otherwise depend on a layout continuing to
 * exist above it.
 *
 * OWNERSHIP DOES NOT GATE ADMINISTRATION. Either operator may create an
 * invitation; `createInvitationAction` records the session's own operator as its
 * owner, which decides which partition it appears in and who may DISPATCH it.
 *
 * Operator-facing copy is Spanish, neutral register.
 */

export const metadata: Metadata = {
  title: "Nueva invitación",
  robots: { index: false, follow: false },
};

export default async function NewInvitationPage() {
  await requireOperator();

  /**
   * Creates it, then leaves.
   *
   * `createInvitationAction` returns nothing — the new invitation's id exists
   * only inside the write — so there is no edit URL to send the operator to.
   * The console list is where the invitation they just made is, and staying on
   * a form that has apparently done nothing is the worse answer.
   */
  async function create(formData: FormData) {
    "use server";

    await createInvitationAction(formData);

    redirect(CONSOLE_ROOT_PATH);
  }

  return (
    // A `div`, not a `main`: `ConsoleShell` above already renders this page's
    // one `main` landmark, and two of them makes "skip to content" ambiguous.
    <div className="console__main console__invitation flex flex-col gap-6">
      <h2 className="text-balance">Nueva invitación</h2>

      <p className="max-w-[68ch] text-sm text-muted-foreground">
        Una invitación es un hogar: una persona sola o un grupo que recibe un
        solo mensaje y responde una sola vez. El saludo se arma con los nombres
        y apodos que se escriban acá, y se puede cambiar a mano. A quién se le
        manda el mensaje se elige después de guardar.
      </p>

      <InvitationForm action={create} />

      <a
        className="self-start text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        href={CONSOLE_ROOT_PATH}
      >
        Volver al panel
      </a>
    </div>
  );
}
