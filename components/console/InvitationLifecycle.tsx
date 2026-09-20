"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DISPATCH_STATE_LABELS,
  type DispatchState,
} from "@/lib/domain/dispatch-state";
import type { DeletionOutcome } from "@/lib/domain/invitation-deletion";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";

/**
 * The two irreversible things an operator can do to one invitation.
 *
 * WHY THIS IS NOT PART OF `InvitationForm`
 *
 * Neither of these edits the invitation; one destroys it and the other changes
 * the address it lives at. `InvitationForm` renders the page's one `<form>`, and
 * a "Guardar invitación" that sat next to "Eliminar invitación" would put a
 * destructive control inside the submit flow of an unrelated save. Separate
 * component, separate section, one screen.
 *
 * DELETION IS ASKED TWICE, AND THE CONFIRMATION NAMES THE HOUSEHOLD
 *
 * The delete is a real hard delete of the invitation and its members — there is
 * no soft-delete state and no undo, on purpose (migration `0005`). This console
 * is operated from a phone, often with several households open, so "are you
 * sure?" is not enough: the household about to disappear is named in the
 * confirmation and in the button that performs it.
 *
 * NOTHING IS PRE-DISABLED, BECAUSE THE RULE LIVES IN ONE PLACE
 *
 * `canDeleteInvitation` refuses on ANY `dispatch_events` row and on a stored
 * answer, and it refuses on the EXISTENCE of a row rather than on a list of
 * known kinds. Greying the button out from what this component happens to know
 * would be a second copy of that rule, free to disagree with it — and the copy
 * that is forgotten during a change is the one that decides. So the attempt is
 * made and the server's answer is shown.
 *
 * A REFUSAL IS DATA, NOT A THROWN SENTENCE
 *
 * Next replaces a thrown message with an opaque `digest` before it reaches a
 * browser, expressly to keep server text out of it, and a thrown value proves
 * nothing about who wrote it: a transport `TypeError` is an ordinary `Error`
 * with a non-empty message. So `DeletionOutcome` travels as data and the Spanish
 * lives here, exactly as the four membership writes already do.
 *
 * ROTATION'S COPY IS BOUND BY WHAT ROTATION CANNOT DO
 *
 * The slug-rotation spec forbids stating or implying that a crawler's cached
 * preview card for the old URL is removed or updated. WhatsApp keeps one preview
 * per link, on Meta's infrastructure, and nothing here reaches into a chat
 * history. `WeddingFactsForm` states the same limitation where the couple's
 * names are edited; this says it where the address changes. What rotation DOES
 * do is named instead: the old address stops leading here, the path-scoped
 * unlock cookie is stranded on it, and the new address asks for the phone gate
 * again.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** A deletion that MUST answer, even when it has nothing to refuse. */
export type InvitationDeletionAction = (
  formData: FormData,
) => Promise<DeletionOutcome>;

/**
 * A rotation that MUST answer with the invitation's new address.
 *
 * The new slug exists nowhere else once the write has happened, so a wrapper
 * that awaited and discarded would leave an invitation whose address nobody
 * knows. The return type is what makes that a compile error instead of a
 * silence, the same job `InvitationRefusingAction` does for the membership
 * writes.
 */
export type InvitationRotationAction = (formData: FormData) => Promise<string>;

export interface InvitationLifecycleProps {
  readonly invitation: {
    readonly id: string;
    /** The household's own name, shown in every confirmation. */
    readonly displayName: string;
  };
  readonly deleteInvitation: InvitationDeletionAction;
  readonly rotateSlug: InvitationRotationAction;
}

const ROTATE_LABEL = "Rotar el enlace";

/** Shown when a write never reached the server, or died inside it. */
const ACTION_FAILED_COPY =
  "No pudimos completar esa acción. Revisá la conexión y volvé a intentarlo.";

/**
 * What rotation does, and the one thing it must never promise.
 *
 * Three consequences, all of them real: the old address stops resolving to this
 * invitation and falls through to the same friendly page an unknown slug gets;
 * the unlock cookie is scoped to `/i/[slug]`, so a guest who had already passed
 * the phone gate holds a permission for a path that no longer leads anywhere;
 * and the new address therefore asks for the gate again.
 *
 * And one limitation, stated rather than skipped: the preview card already
 * delivered into a chat stays exactly as it is. Saying nothing would let an
 * operator assume rotation un-sends the message.
 */
const ROTATION_WARNING =
  "Rotar el enlace le da a esta invitación una dirección nueva. La anterior " +
  "deja de llevar acá: quien la abra va a ver la misma página de contacto que " +
  "aparece cuando un enlace no existe. Si alguien ya había pasado el filtro " +
  "del teléfono en la dirección anterior, ese permiso quedó atado a una " +
  "dirección que ya no lleva a ninguna parte, así que en la nueva hay que " +
  "volver a pasar el filtro. La vista previa que WhatsApp ya dejó en una " +
  "conversación sigue ahí tal cual: la guarda por cada enlace y no la vuelve a " +
  "pedir, y nada de acá entra en un chat a cambiarla. Lo único que cambia es " +
  "que ese enlace deja de funcionar, así que después de rotar hay que enviar " +
  "la dirección nueva.";

/**
 * One dispatch kind as the console already words it, or the kind itself.
 *
 * `DeletionOutcome.eventKinds` is `readonly string[]` and not the four-value
 * union on purpose: the domain refuses on the existence of a row, so a kind a
 * later migration adds arrives here with no label. Showing it raw is honest;
 * dropping it would report "already dispatched" while naming nothing, which is
 * the state the domain's own comment says reads as a bug.
 */
function kindLabel(kind: string): string {
  return kind in DISPATCH_STATE_LABELS
    ? DISPATCH_STATE_LABELS[kind as DispatchState]
    : kind;
}

/** Why the deletion was refused, in terms the operator can act on. */
function refusalCopy(
  outcome: Extract<DeletionOutcome, { ok: false }>,
  displayName: string,
): string {
  const exit =
    "Para que esa dirección deje de funcionar sin borrar nada, está " +
    `«${ROTATE_LABEL}».`;

  if (outcome.reason === "already_dispatched") {
    return (
      `No se puede eliminar «${displayName}»: esta invitación ya tiene ` +
      `movimientos registrados (${outcome.eventKinds.map(kindLabel).join("; ")}). ` +
      "Eso significa que el enlace pudo salir de acá y que un hogar real puede " +
      "tenerlo, así que eliminarla les dejaría una página muerta. " +
      exit
    );
  }

  return (
    `No se puede eliminar «${displayName}»: este hogar ya respondió, y una ` +
    "respuesta guardada prueba que el enlace les llegó aunque no haya quedado " +
    "registrado ningún envío. Eliminar la invitación borraría esa respuesta. " +
    exit
  );
}

/** Which confirmation is open. Only ever one, so a press cannot cross wires. */
type Pending = "delete" | "rotate" | null;

export function InvitationLifecycle({
  invitation,
  deleteInvitation,
  rotateSlug,
}: InvitationLifecycleProps) {
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [rotatedUrl, setRotatedUrl] = useState<string | null>(null);
  // THE DOUBLE-TAP GUARD THE REST OF THIS CONSOLE ALREADY HAS.
  //
  // Phones get pressed twice. A second deletion would name a row that is
  // already gone and surface as a broken server; a second rotation would mint a
  // third slug and throw away the second one, which is the address the operator
  // was just told to send.
  const [inFlight, setInFlight] = useState(false);

  function fields(): FormData {
    const formData = new FormData();

    formData.set("invitationId", invitation.id);

    return formData;
  }

  async function confirmDeletion(): Promise<void> {
    if (inFlight) {
      return;
    }

    setInFlight(true);

    try {
      const outcome = await deleteInvitation(fields());

      setPending(null);

      if (!outcome.ok) {
        setNotice(refusalCopy(outcome, invitation.displayName));

        return;
      }

      setNotice(null);
      setDeleted(true);
    } catch {
      setPending(null);
      setNotice(ACTION_FAILED_COPY);
    } finally {
      setInFlight(false);
    }
  }

  async function confirmRotation(): Promise<void> {
    if (inFlight) {
      return;
    }

    setInFlight(true);

    try {
      const url = await rotateSlug(fields());

      setPending(null);
      setNotice(null);
      setRotatedUrl(url);
    } catch {
      setPending(null);
      setNotice(ACTION_FAILED_COPY);
    } finally {
      setInFlight(false);
    }
  }

  return (
    <section
      className="invitation-lifecycle flex flex-col gap-4 rounded-lg border border-input px-3 py-3"
      data-testid="invitation-lifecycle"
    >
      <h3 className="text-sm font-medium">Eliminar o cambiar el enlace</h3>

      {deleted ? (
        // WHAT IS LEFT TO DO HERE IS LEAVE.
        //
        // The invitation is gone, so both affordances go with it: a delete
        // button beside its own success message invites a second attempt that
        // can only fail, and a rotation would name a row that no longer exists.
        // The console list was revalidated by the action, so the way back shows
        // the household already missing.
        <p
          // Announced as a live region rather than through `role="status"`: this
          // page already renders `InvitationForm`, whose refusal and advisory
          // regions carry `status` and `alert`, and a third of either makes a
          // page-level role query ambiguous for every spec that uses one.
          aria-atomic="true"
          aria-live="polite"
          className="flex max-w-[68ch] flex-col gap-2 text-sm"
          data-testid="invitation-deleted"
        >
          <span>
            Se eliminó «{invitation.displayName}» con todas las personas que
            tenía. No queda nada de esta invitación.
          </span>
          <a
            className="self-start text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            href={CONSOLE_ROOT_PATH}
          >
            Volver al panel
          </a>
        </p>
      ) : (
        <>
          <div className="invitation-lifecycle__delete flex flex-col gap-2">
            {pending === "delete" ? (
              <div
                aria-atomic="true"
                aria-live="polite"
                className="flex flex-col gap-2"
                data-testid="invitation-deletion-confirm"
              >
                <p className="max-w-[68ch] text-sm">
                  Se va a eliminar «{invitation.displayName}» con todas las
                  personas que tiene dentro. No se puede deshacer.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={inFlight}
                    onClick={() => void confirmDeletion()}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Sí, eliminar «{invitation.displayName}»
                  </Button>
                  <Button
                    onClick={() => setPending(null)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  className="self-start"
                  onClick={() => {
                    setNotice(null);
                    setPending("delete");
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Eliminar invitación
                </Button>
                <p className="max-w-[68ch] text-xs text-muted-foreground">
                  Se borra la invitación y sus integrantes, sin vuelta atrás. No
                  se puede eliminar una invitación que ya tiene envíos
                  registrados o una respuesta guardada.
                </p>
              </>
            )}
          </div>

          <div className="invitation-lifecycle__rotate flex flex-col gap-2">
            {pending === "rotate" ? (
              <div
                aria-atomic="true"
                aria-live="polite"
                className="flex flex-col gap-2"
                data-testid="invitation-rotation-confirm"
              >
                <p className="max-w-[68ch] text-sm">{ROTATION_WARNING}</p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={inFlight}
                    onClick={() => void confirmRotation()}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Sí, {ROTATE_LABEL.toLowerCase()}
                  </Button>
                  <Button
                    onClick={() => setPending(null)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  className="self-start"
                  onClick={() => {
                    setNotice(null);
                    setPending("rotate");
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {ROTATE_LABEL}
                </Button>
                <p className="max-w-[68ch] text-xs text-muted-foreground">
                  Es la salida para una invitación que se envió por error: la
                  dirección anterior deja de funcionar y esta invitación pasa a
                  vivir en una nueva.
                </p>
              </>
            )}
          </div>

          {rotatedUrl !== null && (
            <p
              aria-atomic="true"
              aria-live="polite"
              className="max-w-[68ch] rounded-lg border border-input px-3 py-2 text-sm break-all"
              data-testid="invitation-rotated-link"
            >
              Dirección nueva: {rotatedUrl} — hay que volver a enviarla, porque
              la anterior ya no lleva a esta invitación.
            </p>
          )}
        </>
      )}

      {notice !== null && (
        <p
          // Assertive, and deliberately not `role="alert"`: see the note on the
          // deletion notice above. `aria-live="assertive"` with `aria-atomic` is
          // what that role means, without adding a third alert region to a page
          // whose specs query one by role.
          aria-atomic="true"
          aria-live="assertive"
          className="max-w-[68ch] rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          data-testid="invitation-lifecycle-notice"
        >
          {notice}
        </p>
      )}
    </section>
  );
}
