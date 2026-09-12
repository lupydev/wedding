"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whyDisabled } from "@/components/ui/why-disabled";

import { IDLE_SIGN_IN_STATE, type SignInState } from "./sign-in-state";

/**
 * The console sign-in form.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 *
 * The action arrives as a prop so this component stays renderable in a plain
 * unit test, matching `GateForm` on the guest surface.
 *
 * There is one button and nothing else: no sign-up, no password reset, no
 * "remember me". Two operators exist, they are created once by
 * `scripts/seed-operators.ts`, and a forgotten password is a maintainer running
 * that tool again rather than a self-service flow that mails a capability to
 * whoever controls the address today.
 */

export type SignInFormAction = (
  previous: SignInState,
  formData: FormData,
) => Promise<SignInState>;

export function LoginForm({ action }: { readonly action: SignInFormAction }) {
  const [state, submit, pending] = useActionState(action, IDLE_SIGN_IN_STATE);

  return (
    <form action={submit} className="console-login__form flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="operator-email">Correo electrónico</Label>
        <Input
          className="h-11"
          id="operator-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="operator-password">Contraseña</Label>
        <Input
          className="h-11"
          id="operator-password"
          name="password"
          type="password"
          // `current-password`, never `new-password`: this form signs an existing
          // operator in and cannot create anybody.
          autoComplete="current-password"
          required
        />
      </div>

      {/*
        `whyDisabled` rather than a bare `disabled={pending}`: on venue Wi-Fi this
        round trip is long enough for an operator to decide the button is broken and
        start reloading the page. A disabled control that does not say why is a dead
        end, so the reason travels with the attribute.
      */}
      <Button
        className="w-full"
        size="lg"
        type="submit"
        {...whyDisabled(
          pending ? "Se está verificando el acceso. Un momento." : null,
        )}
      >
        Iniciar sesión
      </Button>

      {state.notice === null ? null : (
        // `role="status"` rather than `alert`: the outcome is deliberately the
        // same message in every refusal, so it is information, not a warning —
        // and an `alert` would also be one more thing that could differ.
        <p
          role="status"
          className="console-login__notice text-sm text-destructive"
        >
          {state.notice}
        </p>
      )}
    </form>
  );
}
