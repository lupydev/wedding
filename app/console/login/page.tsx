import type { Metadata } from "next";

import { signInAction } from "./actions";
import { LoginForm } from "./login-form";

/**
 * The only console page an anonymous visitor may see.
 *
 * It lives outside the `(authenticated)` route group on purpose: a layout that
 * required an operator here would gate the page whose entire job is to create
 * one.
 */

export const metadata: Metadata = {
  title: "Panel de envíos",
  // Belt and braces alongside `robots.txt`: a login page in a search index
  // advertises that this wedding has an operator panel.
  robots: { index: false, follow: false },
};

/** Message shown after a session was closed because access was withdrawn. */
const ACCESS_WITHDRAWN_NOTICE =
  "La sesión se cerró porque esa cuenta ya no tiene acceso al panel.";

export default async function ConsoleLoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const denied = (await searchParams).denied === "1";

  return (
    // `console-surface`: the graphite palette the rest of the console uses. This page
    // lives outside the `(authenticated)` group, so it does not get the shell — it
    // opts into the surface on its own. The document default is paper.
    <main className="console-login console-surface flex min-h-dvh flex-col justify-center bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl leading-tight">Panel de envíos</h1>
        <p className="mt-2 text-sm text-hint" style={{ maxWidth: "48ch" }}>
          Indique el correo electrónico y la contraseña registrados para el
          panel.
        </p>

        {denied ? (
          <p
            role="alert"
            className="console-login__denied mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {ACCESS_WITHDRAWN_NOTICE}
          </p>
        ) : null}

        <div className="mt-6">
          <LoginForm action={signInAction} />
        </div>
      </div>
    </main>
  );
}
