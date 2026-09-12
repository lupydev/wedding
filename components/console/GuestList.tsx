import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { dispatchStateTone, rsvpAnswerTone } from "@/lib/design/console-status";
import {
  DISPATCH_STATE_LABELS,
  type DispatchState,
} from "@/lib/domain/dispatch-state";
import {
  RSVP_ANSWER_LABELS,
  type ConsoleListRow,
} from "@/lib/domain/console-list";
import { consoleDispatchPath } from "@/lib/domain/dispatch-message";
import { consolePreviewPath } from "@/lib/domain/operator-session";

import { GuestPhoneField } from "./GuestPhoneField";
import { StatusBadge } from "./StatusBadge";

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
 * A ROW, NOT A CARD
 *
 * A reference project recorded cutting 98 guests from roughly 17,500px of scroll by
 * showing a name, a status and one action per row. At a few hundred households that
 * matters more rather than less: an operator scrolling for a household they can see
 * in their head is the slowest part of an evening.
 *
 * This list compacts rather than hides. The guest names, the stored numbers and the
 * seat count stay ON the row, because the inline phone editor is the one thing
 * standing between a missing number and a household that never receives its
 * invitation — and because moving them one tap deeper would withdraw data the
 * standing end-to-end suite asserts is visible here. What changed is the shape: one
 * headline line carrying the name and both statuses, a compact metadata line, and
 * the guests as single lines instead of a stack of paragraphs.
 *
 * `min-w-0` ON EVERY FLEX CHILD THAT TRUNCATES. `text-overflow: ellipsis` silently
 * does nothing inside a flex item whose implicit `min-width: auto` refuses to
 * shrink below its content — so the row does not clip, it widens, and the whole
 * layout overflows sideways on a phone.
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
    // The "nothing yet" state, which is frequently correct before an import runs.
    // The filtered counterpart — `NoMatchesState` — is a different component with a
    // different exit, because an operator who reads "there is nothing" on a
    // filtered list concludes the data is gone.
    return (
      <div className="guest-list__empty">
        <EmptyState
          body="Las invitaciones se cargan con el importador de invitados."
          title={emptyMessage}
        />
      </div>
    );
  }

  return (
    <ul className="guest-list flex flex-col gap-2">
      {rows.map((row) => (
        <li
          className="guest-list__row rounded-lg border border-border bg-card px-3 py-3"
          key={row.invitationId}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base leading-snug text-balance">
                {row.greetingName}
              </h3>

              <p className="guest-list__owner truncate text-xs text-muted-foreground">
                {row.ownedByViewer
                  ? `Gestionas tú (${row.ownerDisplayName})`
                  : `Gestiona ${row.ownerDisplayName}`}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="guest-list__dispatch">
                <StatusBadge
                  label={dispatchLabel(row.dispatchState)}
                  tone={dispatchStateTone(row.dispatchState)}
                />
              </p>

              <p className="guest-list__answer">
                <StatusBadge
                  label={RSVP_ANSWER_LABELS[row.answer]}
                  tone={rsvpAnswerTone(row.answer)}
                />
              </p>
            </div>
          </div>

          <p className="guest-list__seats mt-1 text-xs text-hint">
            {seatsSentence(row)}
          </p>

          <ul className="guest-list__guests mt-2 flex flex-col gap-1 border-t border-border pt-2">
            {row.guests.map((guest) => (
              <li
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                key={guest.id}
              >
                <span className="guest-list__guest-name min-w-0 truncate text-sm text-foreground">
                  {guest.fullName}
                </span>
                {guest.isChild && (
                  <span className="guest-list__child text-xs text-muted-foreground">
                    {" "}
                    (menor)
                  </span>
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {row.ownedByViewer && !dispatchBlocked && (
              <Button asChild size="lg">
                <a
                  className="guest-list__dispatch-link"
                  href={consoleDispatchPath(row.invitationId)}
                >
                  Preparar envío para {row.greetingName}
                </a>
              </Button>
            )}

            {/*
            The preview is a READ, so unlike the send affordance above it
            survives a device-declaration mismatch: looking at an invitation
            sends nothing from any account, and the operator on the wrong
            handset is precisely the one who may still want to check the copy.
            Owned-only, though, because the route answers `notFound()` for
            anything else and a link to a 404 is an affordance that lies.
          */}
            {row.ownedByViewer && (
              <Button asChild size="lg" variant="ghost">
                <a
                  className="guest-list__preview-link"
                  href={consolePreviewPath(row.invitationId)}
                >
                  Ver la invitación de {row.greetingName}
                </a>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
