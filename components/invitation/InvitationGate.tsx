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
        THE GROUND THE ONLY CONTROL ON THE PAGE STANDS ON.

        MEASURED, AND THE MEASUREMENT IS THE WHOLE REASON THIS EXISTS. The
        label of the field shipped at 1.2:1 against the pixels behind it and
        the field's own edge at 1.3:1 — cream on the lit cream of Michell's
        dress, with nothing in between. Not dim: absent. On the first screen
        every guest sees, for a couple whose brief was that it work for
        somebody who is not comfortable with a phone.

        WHY HERE AND NOT IN THE STAGE'S SCRIMS. `PhotoStage` lays a scrim over
        the top 55% of the photograph and another over the bottom 38%, and they
        fade towards each other so the couple keep the least veil of anywhere
        in the frame. That is right for the landing, whose words are at the two
        ends. This screen's words run down the middle — and the wedding
        photograph puts the couple in the middle, from 53% to 87% of the frame,
        where the landing's photograph puts clear sky. The field lands at 60%,
        in the gap between the two scrims, on the brightest thing in the
        picture. Deepening the stage's scrims would fix this screen by dimming
        the couple on the landing they already approved.

        WHY NOT REFRAME THE PHOTOGRAPH INSTEAD, which would be the better fix
        if it existed. It does not: `components/landing/photos.spec.ts`
        measures that a `cover` crop of a 0.75:1 picture on a phone is bound by
        its HEIGHT, so the whole height is on screen and there is no vertical
        overflow for an `object-position` to redistribute. Where the couple sit
        vertically is the photograph's, not a value that can be tuned.

        WHY IT COSTS NO HEIGHT. It is painted, not laid out: absolutely
        positioned behind the words with negative insets, so it reads as the
        card `RsvpAnswer` already uses for the same reason — a DEEPENING of the
        ground rather than a sheet of paper on it — while the words keep the
        full measure. A card with real padding would have narrowed the refusal
        and wrapped it onto another line, on the one screen whose refusal is
        already twelve pixels past the fold.

        `isolate` IS LOAD-BEARING, and the failure without it is the one
        `PhotoStage` documents for its scrims: painting order is not DOM order.
        Left in the page's own stacking context, a `-z-10` ground paints below
        every positioned element — including the photograph — and the page
        renders exactly as it did before, with nothing to see and no error
        anywhere. The stacking context makes `-z-10` mean "behind these words"
        instead of "behind everything".

        Deeper than `RsvpAnswer`'s panel, and the difference is measured rather
        than felt: that one sits at 70%–95%, where the stage's bottom scrim is
        already carrying 60% to 90% of the load. This one has none of that help.
      */}
      <div className="gate__panel relative isolate flex w-full flex-col items-center gap-3 sm:gap-4">
        <div
          aria-hidden="true"
          className="
            gate__panel-ground pointer-events-none absolute -inset-x-4
            -inset-y-3 -z-10 rounded-3xl bg-[#0d1114]/70 ring-1 ring-white/10
            shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm
            lg:hidden
          "
        />

        {/*
          ONE SENTENCE, AND IT WAS TWO. "Tenemos lista su invitación de
          matrimonio." then "Para abrirla, escribe el número de celular que
          compartiste con nosotros." — two sentences saying what one says, above
          the only thing there is to do on the page.
        */}
        <p className="gate__ask max-w-sm text-sm text-[#f6efe2]/90">
          Escribe tu número para abrir la invitación.
        </p>

        {children}
      </div>

      {/*
        THE WAY OUT, KEPT QUIET AND KEPT PRESENT.

        A household whose number is not the one the couple stored has no other
        move on this page, so this link is the only escape — but it must not
        compete with the field, which is what almost everybody needs.

        QUIET IS NOW SIZE AND WEIGHT, NOT OPACITY, and the change is measured.
        This link sits OUTSIDE the panel, on the bare photograph, and on a
        Pixel 7 the taller screen puts it at 79% rather than 89% — over the lit
        leg of Luis's trousers instead of the dark ground below them. At 60%
        cream that measured 2.9:1 against the brightest pixel under it. It is
        the one thing on the page a locked-out household can still use, so it
        is now full cream at `text-xs`, which is 5.1:1 against the same pixel
        and still the smallest thing on the screen.

        The shadow is the same one `SaveTheDate` and `StreamLink` carry for the
        same reason. It is not counted in the ratio above: WCAG has no term for
        it, and a floor that credits an unmeasurable is not a floor.
      */}
      <p className="gate__recovery text-xs text-[#f6efe2] [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
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
