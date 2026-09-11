import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireOperator } from "@/lib/server/console-session";

/**
 * The authenticated console shell.
 *
 * A route group rather than `app/console/layout.tsx`, because a layout at
 * `/console` would also wrap `/console/login` and `/console/auth/**` — gating
 * the two routes whose job is to create and destroy the session this layout
 * requires.
 *
 * The device-declaration gate (work unit 6a-ii) belongs here, after
 * `requireOperator()` and before any dispatch affordance renders.
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

  return (
    <div className="console">
      <header className="console__header">
        <h1>Panel de envíos</h1>
        <p className="console__operator">
          Sesión iniciada como <strong>{operator.displayName}</strong>
        </p>
        {/* A plain link, so signing out works with no JavaScript at all. */}
        <a className="console__sign-out" href="/console/auth/sign-out">
          Cerrar sesión
        </a>
      </header>

      {children}
    </div>
  );
}
