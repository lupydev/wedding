"use client";

import { useActionState } from "react";

import {
  gateFeedbackMessages,
  type GateFeedback,
} from "@/lib/domain/gate-copy";

/**
 * The phone input, and the only interactive element on the public route.
 *
 * A Client Component, which is deliberately as far as the client boundary
 * goes: it holds no invitation data, receives no phone number, and renders no
 * Suspense boundary. Everything above it stays server-rendered in one pass,
 * which is what keeps the per-guest Open Graph tags inside `<head>` of the
 * first response — the single most fragile guarantee in the product.
 *
 * The action arrives as a prop rather than being imported: the page binds the
 * slug to the Server Action on the server, so the slug is never a client-
 * supplied value, and this component stays renderable in a plain unit test.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

export type GateFormAction = (
  previous: GateFeedback,
  formData: FormData,
) => Promise<GateFeedback>;

const IDLE: GateFeedback = { status: "idle" };

export function GateForm({ action }: { readonly action: GateFormAction }) {
  const [feedback, submit, pending] = useActionState(action, IDLE);
  const messages = gateFeedbackMessages(feedback);

  return (
    <form action={submit} className="gate__form">
      <label htmlFor="gate-phone">Número de celular</label>
      <input
        id="gate-phone"
        name="phone"
        type="tel"
        // `inputMode` raises the numeric keypad on a phone, which is where
        // essentially every guest opens this. `autoComplete` lets the browser
        // offer the number it already knows, so most guests never type at all.
        inputMode="tel"
        autoComplete="tel"
        required
      />
      <button type="submit" disabled={pending}>
        Ver la invitación
      </button>

      {messages.length === 0 ? null : (
        // `role="alert"` so a screen reader announces the outcome; a guest who
        // cannot see the message has no other way to learn the attempt failed.
        <div role="alert" className="gate__feedback">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </form>
  );
}
