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
    <section className="device-mismatch" role="alert">
      <h2>{message.heading}</h2>
      <p>{message.body}</p>
      <ul>
        {message.exits.map((exit) => (
          <li key={exit.href}>
            <a href={exit.href}>{exit.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
