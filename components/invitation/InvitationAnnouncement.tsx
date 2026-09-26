import { SaveTheDate } from "@/components/landing/SaveTheDate";

/**
 * The wedding, announced — the block two surfaces have to render identically.
 *
 * WHY IT IS A COMPONENT NOW AND WAS THREE LINES INSIDE `InvitationBody` BEFORE.
 *
 * The invitation became a sequence of screens, and the announcement belongs to
 * exactly one of them: the gate makes it, the question screen repeats it, and
 * the two screens after that must not pay 250 pixels to say it a third time.
 * That put the decision inside `RsvpAnswer`, which is where the step is known —
 * and `RsvpAnswer` is a Client Component that the operator preview does not
 * render at all.
 *
 * So the same announcement is now composed in two places: by the public route,
 * which hands it to the form as a slot, and by `InvitationBody`, which renders
 * it for the console preview. Two places building the same block out of parts
 * is exactly how the landing and the gate started drifting before `SaveTheDate`
 * absorbed the script line. One component, imported twice, cannot.
 *
 * `invitation__announcement` IS A LOCATOR AS WELL AS A HOOK. It is how
 * `e2e/console-preview.spec.ts` compares what the operator approves against
 * what the guest reads, now that the two surfaces no longer produce the same
 * document from end to end.
 *
 * Props-only and synchronous, like everything else in this folder: it performs
 * no data access and its prop type has no field for a guest or a phone number.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */
export function InvitationAnnouncement({
  coupleNames,
}: {
  /**
   * Who is getting married, from the `ceremony` row.
   *
   * Passed rather than read, because `SaveTheDate`'s own default is the module
   * constant the landing uses — and on this page the couple's names are a value
   * an operator can correct with an UPDATE. Rendering the constant here would
   * put two spellings of the same names one page apart the first time somebody
   * fixed one of them.
   */
  readonly coupleNames: string;
}) {
  return (
    /*
      A LINE OF PROSE STOOD UNDER THE ANNOUNCEMENT AND IS GONE: "Nos alegra
      mucho invitarlos a celebrar nuestro matrimonio."

      TWO REASONS, AND THE SECOND ONE IS WHY IT IS A DELETION RATHER THAN A
      MOVE. It is 68 pixels of a 664-pixel screen — a tenth of the question
      screen, spent on the only line there that neither states a fact nor asks
      anything. And the guest read it a few seconds earlier: the WhatsApp
      message that brought them here opens "Hola, X. Nos alegra mucho
      invitarlos a nuestra boda." (`lib/domain/dispatch-message.ts`), so the
      first thing the invitation did was repeat the message.

      It is a copy decision and the couple can have it back — at the price of
      the question screen no longer fitting on an iPhone 14, which is the trade
      this whole unit exists to make.
    */
    <div className="invitation__announcement flex flex-col items-center text-center">
      {/*
        THE WHOLE BLOCK, DATE LINE INCLUDED, EXACTLY AS THE GATE SHOWS IT.

        The couple read the two screens side by side: "debería ser igual a la
        primera pantalla… para tener una misma consistencia."
      */}
      <SaveTheDate coupleNames={coupleNames} />
    </div>
  );
}
