import type { Metadata } from "next";

import { DeviceDeclarationForm } from "@/components/console/DeviceDeclarationForm";
import {
  readDeviceDeclaration,
  requireOperator,
} from "@/lib/server/console-session";
import { listOperatorProfiles } from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import { declareDeviceAction } from "./actions";

/**
 * The per-device WhatsApp declaration.
 *
 * OUTSIDE the `(authenticated)` route group, deliberately. That group's layout
 * redirects an undeclared device here, so a page inside it would redirect to
 * itself forever. It still requires an operator — it calls `requireOperator()`
 * on its own — so being outside the group costs no authorization, only the
 * shell.
 *
 * This is also the page an operator reaches from the mismatch interstitial, so
 * it shows the current declaration rather than pretending none exists.
 */

export const metadata: Metadata = {
  title: "Cuenta de WhatsApp de este dispositivo",
  robots: { index: false, follow: false },
};

export default async function DevicePage() {
  const operator = await requireOperator();
  const declaration = await readDeviceDeclaration(operator.id);
  const operators = await listOperatorProfiles(createServerSupabaseClient());

  return (
    <main className="console__main">
      <h1>¿Qué cuenta de WhatsApp usa este dispositivo?</h1>

      <p>
        Sesión iniciada como <strong>{operator.displayName}</strong>. Esta
        pregunta es distinta: no se trata de quién inició sesión, sino de qué
        cuenta de WhatsApp está instalada en este teléfono. La respuesta se
        guarda solo en este dispositivo.
      </p>

      <DeviceDeclarationForm
        operators={operators}
        declaredSenderId={declaration.declaredSenderId}
        action={declareDeviceAction}
      />
    </main>
  );
}
