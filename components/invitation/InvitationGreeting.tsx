import type { ReactNode } from "react";

/**
 * The line at the top of every screen of the invitation.
 *
 * IT USED TO BE A BLOCK INSIDE `InvitationBody` AND HAD TO LEAVE IT.
 *
 * The body is a Server Component and the screen a household is standing on is
 * CLIENT state owned by `RsvpAnswer`. That was fine while every screen opened
 * the same way — "¡Hola, Familia Aguirre!" — and stopped being fine the moment
 * one of them opened differently: the couple asked the accepted screen to say
 * "Te esperamos, Familia Aguirre" in that exact place, and a Server Component
 * above the stepper cannot know which step is showing.
 *
 * So the markup moved here, where both callers can reach it, and WHICH LINE
 * goes in it became the caller's decision. `InvitationBody` paints it for the
 * surfaces with no stepper behind them — the operator preview and a closed
 * RSVP; `RsvpAnswer` paints it for the four screens, because only it knows
 * which one is showing.
 *
 * ONE ELEMENT AND ONE CLASS, DELIBERATELY. `e2e/console-preview.spec.ts`
 * compares `.invitation__greeting` between the guest's page and the operator's
 * preview to prove the two have not drifted, and that comparison is only worth
 * anything while both surfaces build the line from the same component.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */
export function InvitationGreeting({
  children,
}: {
  /** The line itself, from `greetingLine` or `rsvpConfirmedHeading`. */
  readonly children: ReactNode;
}) {
  return (
    /*
      `px-10` ON TOP OF THE ARTICLE'S `px-6` IS 64 PIXELS, AND IT IS MEASURED.
      The music control is fixed at `right-5` and is 44px across, so it
      occupies the last 64px of the row; a centred line reaching further would
      run underneath it. `PhotoStage` applied the same gutter to the slot this
      replaces, for the same reason. Symmetric, so the line stays centred.
    */
    <header className="flex shrink-0 flex-col items-center px-10 text-center lg:px-0">
      {/*
        THE SHADOW IS THE ONLY GROUND THIS LINE HAS, and it is enough where the
        line sits. It is the topmost thing on the screen, under the strongest
        part of `PhotoStage`'s upper scrim — unlike the gate's field, which
        lands in the gap between the two scrims and needed a card of its own.
        `app/i/[slug]/confirm-legibility.spec.tsx` measures it rather than
        assuming it.
      */}
      <h2
        className="
          invitation__greeting font-display text-2xl leading-[1.05]
          text-balance text-[#f6efe2]
          [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]
          sm:text-3xl
        "
      >
        {children}
      </h2>
    </header>
  );
}
