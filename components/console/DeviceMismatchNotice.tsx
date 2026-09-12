import type { DeviceMismatchMessage } from "@/lib/domain/device-declaration";

/**
 * The interstitial that blocks dispatch when the device and the session
 * disagree — presentational, props only.
 *
 * WHY A BLOCK AND NOT A SILENT FILTER
 *
 * Showing the operator only the invitations the DECLARED account owns would
 * look tidier and would be wrong. A silent filter cannot catch the case the
 * mechanism exists for: the bride signed in on the groom's phone. Filtered, she
 * would simply see his list and send his invitations from his account — which is
 * a perfectly consistent screen and a guest receiving a message from someone
 * they may not know. Stated, she can tell which of the two assumptions is wrong.
 *
 * NOTHING HERE DISMISSES IT. Two links out, both of which change a fact: the
 * declaration, or the session. There is no "continue anyway", because the
 * product cannot make the message leave from the other account — no amount of
 * consent changes which WhatsApp is installed on the handset.
 *
 * The read-only progress view stays rendered beneath it: the block is on
 * dispatch, not on looking.
 */

export interface DeviceMismatchNoticeProps {
  readonly message: DeviceMismatchMessage;
}

export function DeviceMismatchNotice({ message }: DeviceMismatchNoticeProps) {
  return (
    // Red, because something is BROKEN: this handset's WhatsApp account and this
    // session disagree, and nothing the operator does in the console can reconcile
    // them. It is one of the three signal colours and this is one of its meanings.
    //
    // NO BUTTON ANYWHERE IN HERE. Both exits change a fact — the declaration or the
    // session — and each is a plain link, so both survive with JavaScript disabled.
    // There is deliberately nothing that dismisses this.
    <section
      className="device-mismatch rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-4"
      role="alert"
    >
      <h2 className="text-base leading-snug text-destructive">
        {message.heading}
      </h2>
      <p className="mt-2 max-w-[68ch] text-sm text-foreground">
        {message.body}
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {message.exits.map((exit) => (
          <li key={exit.href}>
            <a
              className="text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              href={exit.href}
            >
              {exit.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
