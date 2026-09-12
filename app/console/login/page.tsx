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
    <main className="console-login">
      <h1>Panel de envíos</h1>
      <p>
        Indique el correo electrónico y la contraseña registrados para el panel.
      </p>

      {denied ? (
        <p role="alert" className="console-login__denied">
          {ACCESS_WITHDRAWN_NOTICE}
        </p>
      ) : null}

      <LoginForm action={signInAction} />
    </main>
  );
}
