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
    /*
      ONE VIEWPORT, AND CENTRED RATHER THAN SPREAD — WHICH IS THE KEYBOARD
      DECISION, WRITTEN WHERE IT IS MADE.

      Every other screen of the invitation pushes its controls to the foot of
      the viewport, the way the landing page does. This one must not, and it is
      the only screen with a text field.

      On real iOS Safari the software keyboard changes neither
      `window.innerHeight` nor the `dvh` unit — only `visualViewport.height`.
      So a gate pinned to the bottom of `100dvh` keeps its full height BEHIND
      the keyboard, and the field a guest has just tapped is under it. Safari
      then has to scroll the document to bring the field back, and the further
      down the screen the field sits, the further it has to move.

      TWO WAYS OUT WERE WEIGHED AND ONLY ONE OF THEM IS FREE. The visual
      viewport can be read in JavaScript and projected into a custom property,
      which tracks the keyboard exactly — and makes the height of the one screen
      every guest must get past depend on a script running. The other is to keep
      this screen short, put the field in the middle of it, and let the browser
      do what browsers already do: `min-h-dvh` rather than a locked height, so
      nothing here forbids a scroll that the keyboard makes necessary, and
      `justify-center` so there is less to scroll. That is what is written
      below. The measured cost is nothing when there is no keyboard, and the
      failure mode with one is an ordinary page that scrolls a little.

      `e2e/invitation-one-screen.spec.ts` checks the gate at a viewport the
      height of a phone with its keyboard up. Emulation cannot raise a real
      keyboard, so that test does not pretend to: it asserts the shape of the
      degradation — the document may scroll, and the submit button is reachable
      — rather than claiming to have measured iOS.
    */
    <section
      className="
        gate mx-auto flex min-h-dvh w-full max-w-md flex-col items-center
        justify-center gap-4 px-6 sm:gap-5
        pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-none
        pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center
        text-[#f6efe2]
        lg:min-h-0 lg:px-4 lg:py-0
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

        `px-10` CLEARS THE MUSIC CONTROL, the same 64px gutter the invitation's
        own greeting takes for the same reason: the control is fixed at
        `right-5` and is 44px across, so it owns the last 64px of the row.
      */}
      <h1
        className="
          gate__greeting px-10 font-display text-2xl leading-[1.05]
          text-balance text-[#f6efe2]
          [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
          sm:text-3xl
          lg:px-0 lg:text-4xl
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
