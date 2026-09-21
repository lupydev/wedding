"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { consoleDispatchPath } from "@/lib/domain/dispatch-message";
import {
  canOfferSend,
  type DirectoryEntry,
  type GuestDirectory as Directory,
} from "@/lib/domain/guest-directory";
import type { DraftRefusal } from "@/lib/domain/invitation-draft";

/**
 * The list of PEOPLE, which this console never had.
 *
 * "No veo la lista de invitados por ninguna parte" was true twice over: nothing
 * in the navigation pointed at such a list, and nothing could have been behind
 * it either — `invitation_guests.invitation_id` was `not null` until migration
 * 0015, so a guest could not exist before the household holding them.
 *
 * `/console` answers "which households are there". This answers "who is coming,
 * and who is still in nobody's household".
 *
 * PRESENTATIONAL AND PROPS-ONLY. The order and the counts are decided by
 * `buildGuestDirectory` and the writes by server actions; nothing is computed
 * here that a unit test could not already reach.
 */

const REFUSAL_COPY: Readonly<Record<DraftRefusal, string>> = {
  no_members: "Una invitación tiene que quedarse con al menos una persona.",
  member_without_name: "Cada invitado necesita un nombre completo.",
  duplicate_member_id: "La misma persona figura dos veces.",
  recipient_not_a_member:
    "La persona elegida para recibir el mensaje ya no pertenece a esa invitación.",
  custom_name_empty: "El nombre del grupo no puede quedar vacío.",
  guest_already_invited: "Esa persona ya pertenece a otra invitación.",
};

const WRITE_FAILED_COPY =
  "No pudimos guardar ese cambio. Revisá la conexión y volvé a intentarlo.";

export interface GuestDirectoryProps {
  readonly directory: Directory;
  /** The signed-in operator. A send is offered only on their own households. */
  readonly viewerSenderId: string;
  /** True when this handset carries the other operator's WhatsApp account. */
  readonly dispatchBlocked: boolean;
  readonly createAction: (
    formData: FormData,
  ) => Promise<readonly DraftRefusal[]>;
  readonly updateAction: (
    formData: FormData,
  ) => Promise<readonly DraftRefusal[]>;
  readonly deleteAction: (formData: FormData) => Promise<void>;
  /**
   * Mints a one-person invitation for a guest who belongs to nobody, and sends
   * the operator to its dispatch screen.
   *
   * The couple asked for it plainly: an invitation is for a family of two or
   * more, and writing to one person should not mean assembling a household
   * first. The action redirects, so nothing about navigation lives here.
   */
  readonly inviteAloneAction: (formData: FormData) => Promise<void>;
}

export function GuestDirectory({
  createAction,
  deleteAction,
  directory,
  dispatchBlocked,
  inviteAloneAction,
  updateAction,
  viewerSenderId,
}: GuestDirectoryProps) {
  const [pending, startTransition] = useTransition();
  const [createRefusals, setCreateRefusals] = useState<readonly string[]>([]);
  /** The row whose editor is open. One at a time, because a phone is narrow. */
  const [editing, setEditing] = useState<string | null>(null);
  /** The row whose deletion has been proposed but not confirmed. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rowRefusals, setRowRefusals] = useState<readonly string[]>([]);

  function create(formData: FormData) {
    startTransition(async () => {
      try {
        const refusals = await createAction(formData);

        setCreateRefusals(refusals.map((refusal) => REFUSAL_COPY[refusal]));
      } catch {
        setCreateRefusals([WRITE_FAILED_COPY]);
      }
    });
  }

  function update(formData: FormData) {
    startTransition(async () => {
      try {
        const refusals = await updateAction(formData);

        setRowRefusals(refusals.map((refusal) => REFUSAL_COPY[refusal]));

        // The editor closes only on a clean save. Closing it on a refusal
        // would throw away what the operator typed AND hide the reason.
        if (refusals.length === 0) {
          setEditing(null);
        }
      } catch {
        setRowRefusals([WRITE_FAILED_COPY]);
      }
    });
  }

  function remove(guest: DirectoryEntry) {
    const formData = new FormData();

    formData.set("guestId", guest.id);

    startTransition(async () => {
      try {
        await deleteAction(formData);
        setConfirming(null);
      } catch {
        setRowRefusals([WRITE_FAILED_COPY]);
      }
    });
  }

  return (
    <section className="guest-directory flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Invitados</h2>
        {/*
          BOTH FIGURES CARRY THEIR POPULATION. It is this console's oldest rule
          — `ConsoleDashboard` and `DispatchPreflight` both hold it — and it
          exists because a bare number is one nobody can check.
        */}
        <p
          className="text-sm text-muted-foreground"
          data-testid="guest-directory-summary"
        >
          {directory.total} invitados · {directory.unassigned} sin invitación
        </p>
      </header>

      <form
        action={create}
        // The console is operated on phones; the browser's own suggestions are
        // the operator's identity, never a guest's.
        autoComplete="off"
        className="guest-directory__new flex flex-col gap-3 rounded-md border border-border p-4"
        key={directory.total}
      >
        <h3 className="text-sm font-medium">Agregar invitado</h3>

        <GuestFields idPrefix="new" />

        <div>
          <Button disabled={pending} size="sm" type="submit">
            Agregar invitado
          </Button>
        </div>

        {createRefusals.map((message) => (
          <p className="text-sm text-destructive" key={message}>
            {message}
          </p>
        ))}
      </form>

      {directory.guests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay invitados. Agregá a la primera persona acá arriba; no
          hace falta saber todavía en qué invitación va.
        </p>
      ) : (
        <ul className="guest-directory__list flex flex-col gap-2">
          {directory.guests.map((guest) => (
            <li
              className="guest-directory__row rounded-md border border-border p-3"
              /*
                THE ROW KEEPS ITS IDENTITY WHILE ITS CONTENTS SWAP.

                Opening the editor moves the name out of the row's TEXT and
                into an input's value, so anything locating this row by the
                name it displays — a browser test, a screen reader moving by
                text — loses it at the exact moment the operator is editing.
                The attribute survives both states.
              */
              data-guest-name={guest.fullName}
              key={guest.id}
            >
              {editing === guest.id ? (
                <form
                  action={update}
                  autoComplete="off"
                  className="flex flex-col gap-3"
                >
                  <input name="guestId" type="hidden" value={guest.id} />

                  <GuestFields guest={guest} idPrefix={guest.id} />

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={pending} size="sm" type="submit">
                      Guardar
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setEditing(null);
                        setRowRefusals([]);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                  </div>

                  {rowRefusals.map((message) => (
                    <p className="text-sm text-destructive" key={message}>
                      {message}
                    </p>
                  ))}
                </form>
              ) : (
                <GuestRow
                  confirming={confirming === guest.id}
                  guest={guest}
                  inviteAloneAction={inviteAloneAction}
                  // True where it is true: she is in no household, and this
                  // handset carries the right WhatsApp account.
                  canInviteAlone={guest.household === null && !dispatchBlocked}
                  canSend={
                    canOfferSend(guest, { viewerSenderId, dispatchBlocked }) &&
                    guest.recipientName !== null
                  }
                  onCancelDelete={() => setConfirming(null)}
                  onConfirmDelete={() => remove(guest)}
                  onEdit={() => {
                    setEditing(guest.id);
                    setRowRefusals([]);
                  }}
                  onProposeDelete={() => setConfirming(guest.id)}
                  pending={pending}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One guest, at rest.
 *
 * WHERE SOMEBODY ALREADY IS, WRITTEN OUT. The couple's rule — one guest belongs
 * to one invitation and cannot be chosen for another — is held by the database
 * and invisible there. A reader cannot see a constraint; they can see that Ana
 * is in Familia Restrepo and that Carla is in nobody's.
 */
function GuestRow({
  canInviteAlone,
  canSend,
  confirming,
  guest,
  inviteAloneAction,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onProposeDelete,
  pending,
}: {
  readonly canInviteAlone: boolean;
  readonly canSend: boolean;
  readonly confirming: boolean;
  readonly guest: DirectoryEntry;
  readonly inviteAloneAction: (formData: FormData) => Promise<void>;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
  readonly onEdit: () => void;
  readonly onProposeDelete: () => void;
  readonly pending: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="guest-directory__name text-sm text-foreground">
          {guest.fullName}
        </span>
        {guest.nickname !== null && (
          <span className="text-xs text-muted-foreground">
            ({guest.nickname})
          </span>
        )}
        {guest.isChild && (
          <span className="text-xs text-muted-foreground">(menor)</span>
        )}
        {guest.phoneE164 !== null && (
          <span className="text-xs text-muted-foreground">
            {guest.phoneE164}
          </span>
        )}
      </div>

      <p className="guest-directory__household text-xs text-hint">
        {guest.household === null
          ? "Sin invitación todavía"
          : `En ${guest.household.greetingName}`}
      </p>

      {/*
        WHO THE MESSAGE ACTUALLY REACHES, SAID OUT LOUD.

        A send is addressed to the member its invitation names, which need not
        be the person whose row this is — and the list is alphabetical, so that
        member's own row is nowhere nearby. Without this line the button beside
        it would quietly do something other than what its row suggests.
      */}
      {guest.household !== null && (
        <p className="guest-directory__recipient text-xs text-muted-foreground">
          {guest.recipientName === null
            ? "Nadie elegido para recibir el mensaje de esta invitación."
            : guest.isRecipient
              ? "Recibe el mensaje de esta invitación."
              : `El mensaje de esta invitación le llega a ${guest.recipientName}.`}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-2">
          {/*
            IT SAYS WHAT DELETING COSTS. Removing somebody from here removes
            them from their household too — which is right, because refusing
            would send the operator to another screen to do what they just
            asked for — but that is not what "eliminar" looks like from a list
            of people, so the sentence says it.
          */}
          <p className="guest-directory__confirm max-w-[68ch] text-sm">
            {guest.household === null
              ? `Se va a eliminar a ${guest.fullName} de la lista de invitados. No se puede deshacer.`
              : `Se va a eliminar a ${guest.fullName}, que además sale de «${guest.household.greetingName}». La invitación queda en pie. No se puede deshacer.`}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={onConfirmDelete}
              size="sm"
              type="button"
              variant="destructive"
            >
              Sí, eliminar a {guest.fullName}
            </Button>
            <Button
              disabled={pending}
              onClick={onCancelDelete}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/*
            A LINK TO THE DISPATCH SCREEN, NOT A SECOND WAY TO SEND.

            That screen composes the message, applies the device gate and
            writes the audit event. A button here that sent directly would be a
            second dispatch path with its own copy of those guards to keep in
            step, which is how one of them ends up missing.

            `canSend` already carries the three conditions — the person is in a
            household, this operator owns it, and the handset agrees — plus a
            chosen recipient, without which the send would only reach a refusal.
          */}
          {canSend && guest.household !== null && (
            <Button asChild size="sm">
              <a
                aria-label={`Enviar la invitación de ${guest.household.greetingName}`}
                className="guest-directory__dispatch-link"
                href={consoleDispatchPath(guest.household.invitationId)}
              >
                Enviar
              </a>
            </Button>
          )}

          {/*
            ONE PRESS FOR SOMEBODY COMING ALONE.

            An invitation is a household of two or more, and writing to a
            cousin who is coming by herself should not mean assembling one. The
            press mints her own one-person invitation and the server redirects
            to the same dispatch screen every household reaches — so a message
            is still composed, gated and audited in exactly one place.

            A plain form, because the action redirects. Offered only where it
            is true: she is in no household, and this handset carries the right
            WhatsApp account.
          */}
          {canInviteAlone && (
            <form action={inviteAloneAction}>
              <input name="guestId" type="hidden" value={guest.id} />
              <Button disabled={pending} size="sm" type="submit">
                Invitar a {guest.fullName} sola
              </Button>
            </form>
          )}

          {/*
            The person's name lives in `aria-label` and not on the button. A
            list of forty bare "Editar" tells two rows apart by position only;
            the same reasoning `GuestList` records for its own row actions, and
            the visible word is contained in the accessible name so the two
            can never say different things.
          */}
          <Button
            aria-label={`Editar a ${guest.fullName}`}
            disabled={pending}
            onClick={onEdit}
            size="sm"
            type="button"
            variant="outline"
          >
            Editar
          </Button>
          <Button
            aria-label={`Eliminar a ${guest.fullName}`}
            disabled={pending}
            onClick={onProposeDelete}
            size="sm"
            type="button"
            variant="ghost"
          >
            Eliminar
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The four fields a guest has, shared by the add form and every row editor.
 *
 * ONE COMPONENT AND NOT TWO, because the two must not drift: a field present
 * when adding and missing when editing is a value nobody can ever correct.
 *
 * ONLY THE NAME IS REQUIRED. A phone number is what the gate matches and what a
 * dispatch needs, and neither happens from this screen — demanding one here
 * would stop an operator writing down a cousin whose number they have not asked
 * for yet, which is most of what a directory is for.
 */
function GuestFields({
  guest,
  idPrefix,
}: {
  readonly guest?: DirectoryEntry;
  readonly idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label
        className="flex flex-col gap-1 text-sm"
        htmlFor={`${idPrefix}-name`}
      >
        Nombre completo
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          defaultValue={guest?.fullName ?? ""}
          id={`${idPrefix}-name`}
          name="fullName"
          type="text"
        />
      </label>

      <label
        className="flex flex-col gap-1 text-sm"
        htmlFor={`${idPrefix}-nickname`}
      >
        Apodo
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          defaultValue={guest?.nickname ?? ""}
          id={`${idPrefix}-nickname`}
          name="nickname"
          type="text"
        />
      </label>

      <label
        className="flex flex-col gap-1 text-sm"
        htmlFor={`${idPrefix}-phone`}
      >
        Teléfono
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          defaultValue={guest?.phoneE164 ?? ""}
          id={`${idPrefix}-phone`}
          inputMode="tel"
          name="phone"
          type="tel"
        />
      </label>

      <label
        className="flex items-center gap-2 text-sm"
        htmlFor={`${idPrefix}-child`}
      >
        <input
          defaultChecked={guest?.isChild ?? false}
          id={`${idPrefix}-child`}
          name="isChild"
          type="checkbox"
        />
        Es menor
      </label>
    </div>
  );
}
