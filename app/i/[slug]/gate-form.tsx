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
    <form
      action={submit}
      className="gate__form flex w-full flex-col items-stretch gap-3"
    >
      {/*
        THE LABEL IS VISIBLE, not a placeholder standing in for one. A
        placeholder disappears the moment somebody types, which on the one
        field this page has is the moment they most want to check they are
        answering the right question.
      */}
      <label
        className="text-xs tracking-[0.18em] text-[#f6efe2]/60 uppercase"
        htmlFor="gate-phone"
      >
        Número de celular
      </label>
      {/*
        A VISIBLE EDGE, because an unbordered input on a photograph is an
        invisible control — and on this screen a guest who cannot tell there is
        anywhere to type has nothing else to try.
      */}
      <input
        className="
          w-full rounded-xl border border-[#f6efe2]/25 bg-black/30 px-4 py-3
          text-center text-base text-[#f6efe2] backdrop-blur-sm
          focus-visible:border-[#f6efe2]/60 focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-[#f6efe2]
        "
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
      <button
        className="
          w-full rounded-full border border-[#f6efe2]/40 bg-[#f6efe2]/10 px-5
          py-3 text-sm text-[#f6efe2] backdrop-blur-sm transition-colors
          duration-(--console-motion-fast) ease-(--ease-console-out)
          hover:bg-[#f6efe2]/20
          focus-visible:outline-2 focus-visible:outline-offset-2
          focus-visible:outline-[#f6efe2]
          disabled:opacity-50
        "
        type="submit"
        disabled={pending}
      >
        Ver la invitación
      </button>

      {/*
        THE REFUSAL, AND THE SPACE IT WILL NEED, HELD FROM THE FIRST PAINT.

        `role="alert"` so a screen reader announces the outcome; a guest who
        cannot see the message has no other way to learn the attempt failed.

        IT USED TO MOUNT ON FAILURE AND THE PAGE GREW BY 106 PIXELS, measured on
        an iPhone 14. On a screen whose whole promise is that it is one viewport
        tall, an element that appears and pushes the recovery link off the
        bottom is the failure mode arriving exactly when the guest is already
        stuck. The region is now always in the document; when there is nothing
        to say it holds a single line's worth of nothing.

        RESERVED FOR ONE LINE, NOT FOR THE WORST CASE. A refusal is two
        sentences and wraps to about four lines on a narrow phone, and holding
        that much empty ground on every successful visit to spare the unlucky
        one a small scroll is the wrong trade. What the reservation buys is that
        the common refusal does not shove the page; the longest one may still,
        and it degrades to a scroll, which the gate deliberately allows.
      */}
      <div
        role="alert"
        className="gate__feedback flex min-h-6 flex-col gap-1 text-sm text-[#f6efe2]"
      >
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </form>
  );
}
