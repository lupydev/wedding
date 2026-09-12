import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import { ConsoleNavCurrent } from "@/components/console/ConsoleNavCurrent";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { DeviceMismatchNotice } from "@/components/console/DeviceMismatchNotice";
import {
  CONSOLE_DEVICE_PATH,
  describeDeviceMismatch,
} from "@/lib/domain/device-declaration";
import {
  requireDeclaredDevice,
  requireOperator,
} from "@/lib/server/console-session";
import { listOperatorProfiles } from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * The authenticated console shell.
 *
 * A route group rather than `app/console/layout.tsx`, because a layout at
 * `/console` would also wrap `/console/login`, `/console/auth/**` and
 * `/console/device` — gating the routes whose job is to create the session and
 * answer the declaration this layout requires.
 *
 * TWO GATES, IN ORDER, ANSWERING TWO DIFFERENT QUESTIONS
 *
 * `requireOperator()` answers "who is operating?", verified against
 * `senders.auth_user_id`. `requireDeclaredDevice()` then reads "which WhatsApp
 * account is on this handset?", which nothing can verify. An undeclared device
 * is sent to the picker — never defaulted to the signed-in operator, because
 * clearing site data must re-ask rather than quietly nominate somebody.
 *
 * A MISMATCH RENDERS, IT DOES NOT REDIRECT. The children still appear, in
 * read-only form, underneath a non-dismissible explanation. Bouncing to the
 * picker would hide the disagreement behind a form, and the disagreement — the
 * bride signed in on the groom's phone — is the finding this whole mechanism
 * exists to surface.
 */

export const metadata: Metadata = {
  title: "Panel de envíos",
  robots: { index: false, follow: false },
};

export default async function AuthenticatedConsoleLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const operator = await requireOperator();
  const declaration = await requireDeclaredDevice(operator.id);

  // The declared account's NAME, resolved only when there is something to
  // explain. On a match the id is enough and the extra read would be wasted.
  const declaredDisplayName =
    declaration.status === "mismatch"
      ? ((await listOperatorProfiles(createServerSupabaseClient())).find(
          (candidate) => candidate.id === declaration.declaredSenderId,
        )?.displayName ?? null)
      : null;

  return (
    <ConsoleShell
      className="console"
      header={
        <ConsoleHeader
          devicePath={CONSOLE_DEVICE_PATH}
          operatorDisplayName={operator.displayName}
          signOutPath="/console/auth/sign-out"
        />
      }
      nav={<ConsoleNavCurrent />}
    >
      {declaration.status === "mismatch" && (
        <DeviceMismatchNotice
          message={describeDeviceMismatch({
            sessionDisplayName: operator.displayName,
            declaredDisplayName,
          })}
        />
      )}

      {children}
    </ConsoleShell>
  );
}
