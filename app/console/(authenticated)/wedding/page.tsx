import type { Metadata } from "next";

import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { getCeremony } from "@/lib/server/ceremony";
import { requireOperator } from "@/lib/server/console-session";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import { saveWeddingFactsAction } from "./actions";
import { WeddingFactsEditor } from "./wedding-facts-editor";

/**
 * The wedding's own facts, editable.
 *
 * WHY THIS PAGE EXISTS
 *
 * Four of these values used to be module constants in
 * `components/invitation/InvitationBody.tsx` and one was an exported string in
 * `lib/domain/og-card.ts`, all holding visibly-unfinished placeholders awaiting
 * the couple. The other three lived in the `ceremony` row, editable with an
 * UPDATE. So half of the wedding needed a deploy to correct and half did not, and
 * the two halves could describe the same day differently — which is precisely how
 * a reference project's WhatsApp template went on announcing a venue the event had
 * already left.
 *
 * Now all four live in one row and this is where they are edited. Nothing about
 * the couple, the date or the venue is written anywhere in the source, which
 * `tools/no-source-placeholders.spec.ts` keeps true.
 *
 * A thin async container, like every async RSC in this codebase: it reads the row
 * and hands props over. Vitest cannot render one, so nothing is DECIDED here. The
 * validation lives in `lib/domain/wedding-facts.ts`, the write in
 * `lib/server/ceremony.ts`, the two warnings and the field wiring in
 * `components/console/WeddingFactsForm.tsx` — all three under unit test, and the
 * round trip under `e2e/console-wedding.spec.ts`.
 *
 * `requireOperator()` again, even though the group's layout already called it: it
 * is one cached identity header and one indexed row, and the alternative is a page
 * whose authorization depends on a layout continuing to exist above it.
 *
 * NO SUSPENSE BOUNDARY. One read of one row by primary key is not worth a
 * skeleton, and the boundary would put the redirect this page can throw after the
 * shell has flushed — which turns a 307 into a 200 with a client-side bounce.
 *
 * Operator-facing copy is Spanish, neutral register.
 */

export const metadata: Metadata = {
  title: "Datos de la boda",
  robots: { index: false, follow: false },
};

export default async function WeddingFactsPage() {
  await requireOperator();

  const facts = await getCeremony(createServerSupabaseClient());

  return (
    // A `div`, not a `main`: `ConsoleShell` above already renders this page's one
    // `main` landmark, and two of them makes "skip to content" ambiguous.
    <div className="console__main console__wedding flex flex-col gap-6">
      <h2 className="text-balance">Datos de la boda</h2>

      <p className="max-w-[68ch] text-sm text-muted-foreground">
        Estos datos son los que ven las personas invitadas: en la invitación, en
        la vista previa que aparece en WhatsApp y en la tarjeta de la
        transmisión. Se guardan en un solo lugar, así que corregir algo acá lo
        corrige en todas esas pantallas a la vez. Cualquiera de las dos cuentas
        puede editarlos.
      </p>

      <WeddingFactsEditor action={saveWeddingFactsAction} facts={facts} />

      <a
        className="self-start text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        href={CONSOLE_ROOT_PATH}
      >
        Volver al panel
      </a>
    </div>
  );
}
