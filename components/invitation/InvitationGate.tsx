import type { ReactNode } from "react";

import { SaveTheDate } from "@/components/landing/SaveTheDate";

/**
 * The gate screen: everything a guest sees before they are let through.
 *
 * Ordering is a product promise. The WhatsApp message said "your invitation",
 * so a bare number prompt would break that promise at the exact moment the page
 * demands something. The household is greeted first, the number is asked for
 * second. The greeting name discloses nothing new: WhatsApp already rendered it
 * on the preview card in the chat.
 *
 * Synchronous and props-only, like `InvitationBody`. The form itself is a
 * Client Component passed in as a child, so this file stays free of state and
 * the route keeps ONE server-rendered document with no Suspense boundary above
 * it — which is what keeps the per-guest Open Graph tags inside `<head>` of the
 * first response.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */
export function InvitationGate({
  greetingName,
  recoveryHref,
  children,
}: {
  readonly greetingName: string;
  readonly recoveryHref: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      className="
        gate mx-auto flex h-full w-full max-w-md flex-col items-center
        justify-center gap-5 px-6 pt-8 lg:max-w-none
        pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center
        text-[#f6efe2]
        sm:pt-12 sm:pb-10
        lg:px-4 lg:py-0
      "
    >
      {/*
        THE MEASURE IS THE PHONE'S, NOT THE LAPTOP'S.

        `max-w-md` keeps the lines readable on a narrow screen and is wrong
        above the breakpoint: at `lg` the announcement's names are set at
        `text-6xl`, and "Luis & Michell" at that size needs more than 448px —
        it broke after the ampersand, which reads as a mistake in the middle of
        the couple's own names. In its own grid column it has the same room the
        landing gives it.
      */}
      <h1
        className="
          gate__greeting font-display text-3xl leading-[1.05] text-balance
          text-[#f6efe2]
          [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
          sm:text-4xl
        "
      >
        ¡Hola, {greetingName}!
      </h1>

      {/*
        THE WEDDING, NOT ONLY THE QUESTION.

        This screen said "we have your invitation, now prove who you are", and
        the wedding it was about lived on the other side of the field. It is the
        first thing a guest reaches from a WhatsApp message, so it carries the
        same announcement the landing opens with — the script line, the names,
        the date and the counter, which is what makes the date feel like
        something approaching rather than small print.

        BELOW THE GREETING, ON PURPOSE. The ordering is a product promise: the
        message said "your invitation", so the household is greeted before
        anything is asked of them or announced at them.
      */}
      <SaveTheDate />

      {/*
        ONE SENTENCE, AND IT WAS TWO. "Tenemos lista su invitación de
        matrimonio." then "Para abrirla, escribe el número de celular que
        compartiste con nosotros." — two sentences saying what one says, above
        the only thing there is to do on the page.
      */}
      <p className="gate__ask max-w-sm text-sm text-[#f6efe2]/85">
        Escribe tu número para abrir la invitación.
      </p>

      {children}

      {/*
        THE WAY OUT, KEPT QUIET AND KEPT PRESENT.

        A household whose number is not the one the couple stored has no other
        move on this page, so this link is the only escape — but it must not
        compete with the field, which is what almost everybody needs.
      */}
      <p className="gate__recovery text-xs text-[#f6efe2]/60">
        <a
          className="
            underline underline-offset-4 transition-colors
            duration-(--console-motion-fast)
            hover:text-[#f6efe2]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#f6efe2]
          "
          href={recoveryHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          ¿No puedes entrar? Escríbenos por WhatsApp
        </a>
      </p>
    </section>
  );
}
