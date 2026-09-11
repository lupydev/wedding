"use client";

import { useActionState } from "react";

import { IDLE_MAGIC_LINK_STATE, type MagicLinkState } from "./magic-link-state";

/**
 * The console sign-in form.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 *
 * The action arrives as a prop so this component stays renderable in a plain
 * unit test, matching `GateForm` on the guest surface.
 */

export type MagicLinkFormAction = (
  previous: MagicLinkState,
  formData: FormData,
) => Promise<MagicLinkState>;

export function LoginForm({
  action,
}: {
  readonly action: MagicLinkFormAction;
}) {
  const [state, submit, pending] = useActionState(
    action,
    IDLE_MAGIC_LINK_STATE,
  );

  return (
    <form action={submit} className="console-login__form">
      <label htmlFor="operator-email">Correo electrónico</label>
      <input
        id="operator-email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <button type="submit" disabled={pending}>
        Enviar enlace de acceso
      </button>

      {state.notice === null ? null : (
        // `role="status"` rather than `alert`: the outcome is deliberately the
        // same message in every case, so it is information, not a warning.
        <p role="status" className="console-login__notice">
          {state.notice}
        </p>
      )}
    </form>
  );
}
