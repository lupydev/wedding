import {
  DISPATCH_STATE_LABELS,
  type DispatchState,
} from "@/lib/domain/dispatch-state";
import {
  RSVP_ANSWER_LABELS,
  type ConsoleListRow,
} from "@/lib/domain/console-list";
import { consoleDispatchPath } from "@/lib/domain/dispatch-message";

import { GuestPhoneField } from "./GuestPhoneField";

/**
 * The console guest list — presentational, props only.
 *
 * Every value it renders was reduced upstream: the answer comes from
 * `rsvp_latest` and the dispatch state from `deriveDispatchState`. Nothing is
 * counted, compared or derived here, which is what keeps the reduction in one
 * place instead of one place per screen.
 *
 * TWO RULES THIS COMPONENT ENFORCES
 *
 * 1. A row the operator does not own has NO send affordance and says who
 *    manages it instead. Wrong-owner dispatch is unpreventable at the protocol
 *    level — `wa.me` has no sender parameter — so it is layered, and this is
 *    the layer a person actually sees.
 * 2. `link_opened` is labelled as an opened link, never as a send. The app
 *    cannot observe a send; the operator is the only sensor there is.
 *
 * NO POPOVER ROW MENU, DELIBERATELY
 *
 * A reference project put a three-dot menu in every row, positioned absolutely
 * inside a container with `overflow: hidden`. The LAST row's menu — the one
 * with the least room beneath it — was unreachable, which is the row where it
 * hurts most. The fix is either `getBoundingClientRect()` positioning with an
 * upward flip, or not having the pattern. This list does not have the pattern:
 * each row's actions are ordinary in-flow elements, so nothing can clip them.
 */

export interface GuestListProps {
  readonly rows: readonly ConsoleListRow[];
  /** Bound Server Action for the inline phone editor. */
  readonly updatePhoneAction: (formData: FormData) => void | Promise<void>;
  /**
   * True for a partition this operator may not edit at all — the other
   * operator's households. `updateGuestPhoneAction` refuses them server-side
   * too; withdrawing the control is the layer a person sees.
   */
  readonly readOnly?: boolean;
  /**
   * True while this device's WhatsApp declaration disagrees with the session.
   *
   * DELIBERATELY SEPARATE FROM `readOnly`. The device gate exists so a message
   * does not leave from the wrong WhatsApp account; correcting a typo in a phone
   * number sends nothing, so that gate has no business blocking it. Wiring the
   * two together meant being on the wrong handset prevented fixing the very data
   * the send preflight was telling the operator to go and fix.
   */
  readonly dispatchBlocked?: boolean;
  readonly emptyMessage: string;
}

function seatsSentence(row: ConsoleListRow): string {
  if (row.answer === "attending") {
    return `${row.seatsConfirmed} de ${row.seatsAllowed} lugares confirmados`;
  }

  return `${row.seatsAllowed} lugares`;
}

function dispatchLabel(state: DispatchState): string {
  return DISPATCH_STATE_LABELS[state];
}

export function GuestList({
  rows,
  updatePhoneAction,
  readOnly = false,
  dispatchBlocked = false,
  emptyMessage,
}: GuestListProps) {
  if (rows.length === 0) {
    return <p className="guest-list__empty">{emptyMessage}</p>;
  }

  return (
    <ul className="guest-list">
      {rows.map((row) => (
        <li className="guest-list__row" key={row.invitationId}>
          <h3>{row.greetingName}</h3>

          <p className="guest-list__seats">{seatsSentence(row)}</p>

          <p className="guest-list__owner">
            {row.ownedByViewer
              ? `Gestionas tú (${row.ownerDisplayName})`
              : `Gestiona ${row.ownerDisplayName}`}
          </p>

          <p className="guest-list__dispatch">
            {dispatchLabel(row.dispatchState)}
          </p>

          <p className="guest-list__answer">{RSVP_ANSWER_LABELS[row.answer]}</p>

          <ul className="guest-list__guests">
            {row.guests.map((guest) => (
              <li key={guest.id}>
                <span className="guest-list__guest-name">{guest.fullName}</span>
                {guest.isChild && (
                  <span className="guest-list__child"> (menor)</span>
                )}
                <GuestPhoneField
                  guestId={guest.id}
                  guestName={guest.fullName}
                  phoneE164={guest.phoneE164}
                  lineType={guest.lineType}
                  dispatchable={guest.dispatchable}
                  action={updatePhoneAction}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>

          {/*
            The send affordance exists only for a row this operator owns, and
            only while the device declaration agrees with the session — the one
            thing that gate is for. Editing a number stays available either way.
          */}
          {row.ownedByViewer && !dispatchBlocked && (
            <a
              className="guest-list__dispatch-link"
              href={consoleDispatchPath(row.invitationId)}
            >
              Preparar envío para {row.greetingName}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
