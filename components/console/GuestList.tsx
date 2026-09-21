import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CONTRADICTED_ANSWER_TONE,
  dispatchStateTone,
  rsvpAnswerTone,
} from "@/lib/design/console-status";
import {
  DISPATCH_STATE_LABELS,
  type DispatchState,
} from "@/lib/domain/dispatch-state";
import {
  RSVP_ANSWER_LABELS,
  classifyAnswerConsistency,
  type AnswerConsistency,
  type ConsoleListRow,
} from "@/lib/domain/console-list";
import { consoleDispatchPath } from "@/lib/domain/dispatch-message";
import {
  consoleInvitationEditPath,
  consolePreviewPath,
  CONSOLE_NEW_INVITATION_PATH,
} from "@/lib/domain/operator-session";

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

/**
 * The household's size, and how much of it has confirmed.
 *
 * It counts the MEMBERS rather than a stored allowance: since migration 0012
 * there is no allowance to read, and the number here has to be the same one the
 * name list below it shows.
 */
function membersSentence(row: ConsoleListRow): string {
  if (row.answer === "attending") {
    return `${row.seatsConfirmed} de ${row.memberCount} personas confirmadas`;
  }

  return row.memberCount === 1 ? "1 persona" : `${row.memberCount} personas`;
}

function dispatchLabel(state: DispatchState): string {
  return DISPATCH_STATE_LABELS[state];
}

function people(count: number): string {
  return count === 1 ? "persona" : "personas";
}

/**
 * How far the stored answer and the current member list have drifted apart.
 *
 * Both numbers, because either one alone is unactionable: "somebody who
 * confirmed is gone" does not say how much of the answer is still good, and a
 * bare seat count does not say that anything is wrong with it.
 */
function mismatchSentence(consistency: AnswerConsistency): string {
  const confirmed = consistency.attendees.length;
  const gone = consistency.danglingGuestIds.length;

  return (
    `Confirmó a ${confirmed} ${people(confirmed)} y ${gone} de ellas ya no ` +
    `${gone === 1 ? "figura" : "figuran"} entre los integrantes.`
  );
}

/** The copy for an id that resolves to nobody. Never an omission, never a crash. */
const REMOVED_ATTENDEE_LABEL = "Alguien que ya no figura en la invitación";

/**
 * The stored answer, where the household it belongs to has moved on without it.
 *
 * RENDERED FROM THE WRITE SIDE'S OWN RULE. `classifyAnswerConsistency` asks
 * `classifyMembershipChangeImpact` — the same function `removeMemberAction` and
 * `moveMemberAction` report with. A second rule here could drift from that one,
 * and the two would then disagree about the same household in the same session:
 * the form would say the answer is fine and the list would say it is not.
 *
 * NOTHING AT ALL FOR A ROW THAT STILL ADDS UP. A flag on every answered
 * household is a flag nobody reads, which is the state the reference console's
 * four-green-buttons row was in.
 *
 * WHY THE NAMES ARE HERE AND NOT ONE TAP DEEPER. "Something is inconsistent" is
 * not actionable; "Fer confirmed and Fer is gone" is. The list is rendered whole,
 * including the ids that resolve to nobody: an answer shown one name short reads
 * as a smaller answer than the household gave, and it reads that way for good,
 * because `rsvp_responses` is append-only and nothing will correct it later.
 */
function AnswerMismatchNotice({ row }: { readonly row: ConsoleListRow }) {
  const consistency = classifyAnswerConsistency(row);

  if (!consistency.contradicted) {
    return null;
  }

  return (
    <div className="guest-list__answer-mismatch mt-1 flex flex-col items-start gap-1">
      <StatusBadge
        label="La respuesta ya no cuadra"
        tone={CONTRADICTED_ANSWER_TONE}
      />

      <p className="text-xs text-hint">{mismatchSentence(consistency)}</p>

      <ul
        aria-label={`Personas que confirmó la respuesta de ${row.greetingName}`}
        className="guest-list__attendees flex flex-col gap-0.5"
      >
        {consistency.attendees.map((attendee) => (
          <li
            className="guest-list__attendee text-xs text-muted-foreground"
            key={attendee.guestId}
          >
            {attendee.fullName ?? REMOVED_ATTENDEE_LABEL}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuestList({
  rows,
  updatePhoneAction,
  readOnly = false,
  dispatchBlocked = false,
  emptyMessage,
}: GuestListProps) {
  /**
   * The door, for the one case where it still belongs inside the list.
   *
   * It used to render in BOTH branches, which produced two of them on the
   * console home — one at the foot of the operator's own list and one at the
   * foot of the read-only list of the other account's households, where every
   * other control had been deliberately withdrawn. Both sat below a scrolling
   * list, so the more invitations existed the further the way to make another
   * one scrolled away.
   *
   * Creation is in the console header now, above the fold on every page. What
   * stays here is the empty state, where the operator's eye already is and
   * where an exit is the whole point of the screen.
   */
  const createLink = (
    <Button asChild variant="secondary">
      <a className="guest-list__create-link" href={CONSOLE_NEW_INVITATION_PATH}>
        Crear invitación
      </a>
    </Button>
  );

  if (rows.length === 0) {
    // The "nothing yet" state, which is frequently correct before an import runs.
    // The filtered counterpart — `NoMatchesState` — is a different component with a
    // different exit, because an operator who reads "there is nothing" on a
    // filtered list concludes the data is gone.
    return (
      <div className="guest-list__empty flex flex-col items-start gap-3">
        <EmptyState
          body="Se pueden cargar con el importador de invitados o crear de a una desde acá."
          title={emptyMessage}
        />
        {createLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="guest-list flex flex-col gap-2">
        {rows.map((row) => {
          /*
            ONE ANSWER, READ BY BOTH DOORS.

            A household this operator does not own is read-only whatever the
            list is: `updateGuestPhoneAction` refuses it on the server, and a
            control that is always refused is worse than no control. The prop
            keeps its own meaning — "this whole list may not be edited" — and
            simply widens it.
          */
          const rowReadOnly = readOnly || !row.ownedByViewer;

          return (
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
                {membersSentence(row)}
              </p>

              {/*
              Directly under the seat sentence, because it is that number the
              answer disagrees with. An operator who reads "2 de 1 personas
              confirmadas" and finds no explanation beside it concludes the
              console is broken — and then stops trusting the counts that are
              right.
            */}
              <AnswerMismatchNotice row={row} />

              {/*
              WHY THE ABSENCE IS WRITTEN OUT INSTEAD OF SHOWING NOTHING.

              No recipient is inferred anywhere — not from `is_primary`, not from
              ordering, not from being the only reachable number — so `null` is
              where every invitation starts, and dispatch stays blocked until
              somebody chooses. A row that renders no indicator for `null` looks
              identical to a row whose choice is simply further down, and the
              operator learns which only when the send refuses.
            */}
              {row.dispatchRecipientGuestId === null && (
                <p className="guest-list__no-recipient mt-1 text-xs text-hint">
                  Nadie elegido para recibir el mensaje.
                </p>
              )}

              <ul className="guest-list__guests mt-2 flex flex-col gap-1 border-t border-border pt-2">
                {row.guests.map((guest) => (
                  <li
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                    key={guest.id}
                  >
                    <span className="guest-list__guest-name min-w-0 truncate text-sm text-foreground">
                      {guest.fullName}
                    </span>
                    {/*
                      BESIDE THE NAME, NOT INSTEAD OF IT. The nickname is what
                      the greeting says; the full name is who the person is, and
                      a list showing only "Anita" stops being one you can check
                      against reality.
                    */}
                    {guest.nickname !== null && (
                      <span className="guest-list__guest-nickname text-xs text-muted-foreground">
                        ({guest.nickname})
                      </span>
                    )}
                    {guest.isChild && (
                      <span className="guest-list__child text-xs text-muted-foreground">
                        {" "}
                        (menor)
                      </span>
                    )}
                    {guest.id === row.dispatchRecipientGuestId && (
                      <span className="guest-list__recipient text-xs text-foreground">
                        Recibe el mensaje
                      </span>
                    )}
                    <GuestPhoneField
                      guestId={guest.id}
                      guestName={guest.fullName}
                      phoneE164={guest.phoneE164}
                      lineType={guest.lineType}
                      dispatchable={guest.dispatchable}
                      action={updatePhoneAction}
                      readOnly={rowReadOnly}
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
                    {/*
                      SHORT ON SCREEN, WHOLE IN THE ACCESSIBLE NAME.

                      Every button on a row used to repeat the household's name
                      — "Preparar envío para Familia Guzmán Peña", "Ver la
                      invitación de Familia Guzmán Peña", "Editar invitación de
                      Familia Guzmán Peña" — and the name is already the heading
                      directly above them. Three long labels per row read as a
                      paragraph, not as controls.

                      The name stays in `aria-label` because it is what keeps
                      two rows' buttons apart: a suite full of bare "Editar"
                      would have to guess which household each one belongs to,
                      and so would anybody navigating by control rather than by
                      eye. The visible word is contained IN the accessible name,
                      never a different word, so the two never contradict.
                    */}
                    <a
                      aria-label={`Enviar la invitación de ${row.greetingName}`}
                      className="guest-list__dispatch-link"
                      href={consoleDispatchPath(row.invitationId)}
                    >
                      Enviar
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
                      aria-label={`Ver la invitación de ${row.greetingName}`}
                      className="guest-list__preview-link"
                      href={consolePreviewPath(row.invitationId)}
                    >
                      Ver
                    </a>
                  </Button>
                )}

                {/*
                GATED LIKE ITS NEIGHBOURS, AND NOT FOR THE SAME REASON.

                The preview link above is gated because its route answers
                `notFound()` for anything else, so an ungated one would link to a
                404. This route does NOT refuse: it takes `requireOperator()` and
                then reads the invitation with no owner filter, because console
                administration is deliberately not owner-scoped (confirmed
                decision 4, pinned in `actions.spec.ts`). So this link would
                work.

                It is withdrawn anyway, because the partition it would appear in
                already tells the operator they may not edit these households —
                the inline phone editor is removed there for exactly that reason.
                An edit door standing open beside a withdrawn control makes the
                screen tell two stories, and the one a person believes is
                whichever they read second.

                Withdrawing an affordance is not a security boundary and is not
                pretending to be one: the route still accepts either operator,
                by design, for anybody who navigates to it.

                BOTH DOORS READ ONE DERIVATION NOW, AND THAT IS WHY.

                They used to be two separate conditions, and this comment said
                the only caller passed `readOnly` together with rows the viewer
                did not own, "so the two guards never disagree — which is
                exactly why leaving one out would go unnoticed until they did."

                The console home renders ONE list over both partitions now, so
                they do disagree: a row the viewer does not own sits in a list
                that is not read-only. `rowReadOnly` is the single answer both
                read, so they cannot drift apart.
              */}
                {!rowReadOnly && (
                  <Button asChild variant="secondary">
                    <a
                      aria-label={`Editar la invitación de ${row.greetingName}`}
                      className="guest-list__edit-link"
                      href={consoleInvitationEditPath(row.invitationId)}
                    >
                      Editar
                    </a>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
