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
/**
 * THE SMALLEST HOUSEHOLD WHOSE LIST OF NAMES CROWDS THE COUNTER OFF THE
 * SCREEN.
 *
 * The couple opened the list of who is coming on a real iPhone, with a
 * three-person invitation, and `Enviar respuesta` was behind the browser
 * chrome. Their instruction: "sacalos solo cuando la invitación es de 3
 * personas, porque con dos personas sí se ve bien."
 *
 * Both halves of that were measured on the shipped build, iPhone 14, 664
 * pixels, before anything was styled:
 *
 * | household | whole announcement | without the counter and the rule |
 * | --------- | ------------------ | -------------------------------- |
 * | two       | 681 — 17 over      | 664 — fits                       |
 * | three     | 735 — 71 over      | 664 — fits, 27 to spare          |
 *
 * AND THE TWO OVERFLOWS ARE NOT THE SAME KIND OF THING, which is why the
 * couple are right about two and right about three. At two the last thing a
 * guest can press ends at 653 and all 17 overflowing pixels are the form's
 * own bottom padding: nothing is hidden and the page can be nudged. At three
 * the send button itself ends at 663 of 664 — flush against the fold on an
 * emulated viewport, and behind the chrome on the phone in their hand.
 *
 * A Pixel 7 fits every size either way; this threshold only ever changes what
 * a short phone shows.
 */
export const HOUSEHOLD_THAT_CROWDS_THE_LIST = 3;

/**
 * Whether the screen that asks who is coming can still afford the counter.
 *
 * `>=` RATHER THAN `=== 3`, EVEN THOUGH THREE IS NOW THE CEILING. The couple
 * moved it — "las invitaciones a la final van a ser 3 personas como máximo" —
 * but nothing in the schema, the console or the importer enforces any ceiling
 * at all; `e2e/invitation-one-screen.spec.ts` keeps a four-person canary for
 * exactly that reason. An equality would hand the whole announcement back to
 * the one size with least room for it: a four-person list is 789 pixels whole
 * and 690 shortened. A threshold costs nothing and is wrong in the safe
 * direction.
 *
 * A one-person invitation never reaches this screen — it records its
 * acceptance on the first tap — so the answer there is academic, and it is
 * `true` because one name crowds nothing.
 */
export function attendeesScreenFitsCountdown(memberCount: number): boolean {
  return memberCount < HOUSEHOLD_THAT_CROWDS_THE_LIST;
}

export function InvitationAnnouncement({
  coupleNames,
  showCountdown = true,
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
  /**
   * Whether this rendering keeps the counter and the hairline above it.
   *
   * The default is the whole block, which is what the gate, the question and
   * the operator preview all show. The screen that asks who is coming is the
   * only caller that ever passes `false`, and only for the household sizes
   * `attendeesScreenFitsCountdown` names above.
   *
   * A PROP RATHER THAN A SECOND COMPONENT, because the two renderings must
   * not be able to drift: `e2e/console-preview.spec.ts` compares this block
   * byte for byte between what an operator approves and what a guest reads,
   * and a second component would give that comparison two things to be
   * right about.
   */
  readonly showCountdown?: boolean;
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
      first thing the invitation did was repeat the message. That verb is
      inflected now — `invitarte` for an invitation naming one person — which
      changes nothing here: the repetition was the problem, not the number.

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
      <SaveTheDate coupleNames={coupleNames} showCountdown={showCountdown} />
    </div>
  );
}
