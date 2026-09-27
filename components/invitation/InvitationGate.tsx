import type { ReactNode } from "react";

import { SaveTheDate } from "@/components/landing/SaveTheDate";
import { greetingLine } from "@/lib/domain/greeting-name";

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
  children,
}: {
  readonly greetingName: string;
  readonly children: ReactNode;
}) {
  return (
    /*
      ONE VIEWPORT, WITH THE TWO GROUPS AT ITS TWO ENDS — AND THE PHOTOGRAPH
      BETWEEN THEM, WHICH IS WHY THEY MOVED.

      The couple looked at this screen on a phone: "los bloques quedan sobre la
      mitad de la foto y nos tapan". Everything the gate says used to run down
      the middle of the frame, which is exactly where the two of them are
      standing. So the announcement goes to the top, the form to the foot, and
      the middle is left to the picture — the landing page's own composition,
      which pins one control at the bottom with `justify-between`.

      AND THAT IS A DELIBERATE TRADE AGAINST THE KEYBOARD, RECORDED HERE
      BECAUSE THE PREVIOUS DECISION WENT THE OTHER WAY.

      On real iOS Safari the software keyboard changes neither
      `window.innerHeight` nor the `dvh` unit — only `visualViewport.height`.
      So a field near the foot of `100dvh` sits BEHIND the keyboard once it is
      raised, and Safari has to scroll the document to bring it back: the
      further down the screen the field is, the further it has to move. This
      screen used to be `justify-center` for exactly that reason — keep it
      short, keep the field in the middle, and there is less for the browser to
      do.

      What has NOT changed is the part that makes the degradation safe:
      `min-h-dvh` rather than a locked height, so nothing here forbids the
      scroll the keyboard makes necessary. The cost is a longer scroll on iOS
      once the keypad is up; the gain is the couple's faces uncovered on the
      first screen every guest sees. That was the couple's call, not a
      measurement.

      The other way out was weighed again and is still not free: the visual
      viewport can be read in JavaScript and projected into a custom property,
      which tracks the keyboard exactly — and makes the height of the one
      screen every guest must get past depend on a script running.

      `e2e/invitation-one-screen.spec.ts` checks the gate at a viewport the
      height of a phone with its keyboard up. Emulation cannot raise a real
      keyboard, so that test does not pretend to: it asserts the shape of the
      degradation — the document may scroll, and the submit button is reachable
      — rather than claiming to have measured iOS.
    */
    <section
      className="
        gate mx-auto flex min-h-dvh w-full max-w-md flex-col items-center
        justify-between gap-4 px-6 sm:gap-5
        pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-none
        pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center
        text-[#f6efe2]
        lg:min-h-0 lg:px-4 lg:py-0
      "
    >
      {/*
        WHAT THE SCREEN SAYS, AT THE TOP OF IT.

        One group rather than two siblings, because `justify-between` spreads
        whatever children it is given: left loose, the greeting would go to the
        top, the announcement to the middle and the form to the foot, and the
        middle is the part the couple asked to have back.
      */}
      <div className="gate__announcement flex w-full flex-col items-center gap-4 sm:gap-5">
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
          {/*
            THE SAME SENTENCE THE INVITATION BEHIND THIS SCREEN OPENS WITH,
            from the one place it is written. The two are read a second apart
            and each used to spell it out for itself.
          */}
          {greetingLine(greetingName)}
        </h1>

        {/*
          THE WEDDING, NOT ONLY THE QUESTION.

          This screen said "we have your invitation, now prove who you are",
          and the wedding it was about lived on the other side of the field. It
          is the first thing a guest reaches from a WhatsApp message, so it
          carries the same announcement the landing opens with — the script
          line, the names, the date and the counter, which is what makes the
          date feel like something approaching rather than small print.

          BELOW THE GREETING, ON PURPOSE. The ordering is a product promise:
          the message said "your invitation", so the household is greeted
          before anything is asked of them or announced at them.
        */}
        <SaveTheDate />
      </div>

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

        AND IT IS AT THE FOOT OF THE SCREEN NOW, WHICH CHANGED WHAT IT IS
        COVERING. Centred, the panel landed at 60%–72% — the gap where the top
        scrim has faded out and the bottom one has not begun, over the #FAF8EF
        edge of Michell's dress. Pushed down it sits at 66%–96% on an iPhone 14
        and 73%–97% on a Pixel 7, over the couple's legs and the dark ground
        below them, and the brightest pixel inside it at rest is #DEC799.

        `gate-legibility.spec.tsx` was re-sampled at the new position rather
        than trusted at the old one, and it KEPT the old number on purpose.
        This panel is bottom-anchored and grows upwards: the refusal line is
        reserved for one line and a real refusal wraps to three or four on a
        narrow phone, which lifts the top of the card back over the 62% mark.
        The state a guest most needs to read this in is the state that puts it
        back on the brightest pixel in the frame, so that is the state the
        floor is set from.
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
        A WAY OUT STOOD HERE, AND THE COUPLE DELETED IT.

        "¿No puedes entrar? Escríbenos por WhatsApp" — a `wa.me` link to the
        invitation's owning sender, with a draft already written. It was the
        only thing a household whose number is not the stored one could do on
        this page, and it is gone on the couple's instruction, with the
        consequence stated to them first: a guest the gate does not recognise
        now has nothing on the screen to press. They still have the WhatsApp
        thread the invitation arrived in — that is what the couple weighed it
        against — but the page no longer says so.

        The whole chain went with it rather than being left to be
        rediscovered: `lib/domain/recovery-message.ts` and its spec,
        `loadOwnerContactPhone`, and `findSenderContactPhone` had no other
        caller between them. The `senders.contact_wa_phone_e164` COLUMN stays.
        It is NOT NULL, `scripts/seed-operators.ts` writes it, and it is the
        couple's own number rather than a guest's — deleting a column is a
        migration, and this link may come back.
      */}
    </section>
  );
}
