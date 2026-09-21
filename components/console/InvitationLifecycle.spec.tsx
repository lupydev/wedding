import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DISPATCH_STATE_LABELS } from "@/lib/domain/dispatch-state";
import type { DeletionOutcome } from "@/lib/domain/invitation-deletion";

import {
  InvitationLifecycle,
  type InvitationDeletionAction,
  type InvitationRotationAction,
} from "./InvitationLifecycle";

/**
 * The two irreversible things an operator can do to one invitation.
 *
 * DELETION IS ASKED TWICE AND THE REFUSAL IS DATA
 *
 * There is no undo: the row is hard-deleted with its members, by design, because
 * a soft-delete state would be a second definition of "exists" (migration
 * `0005`). So the affordance is two-step and the confirmation names the
 * household — a bare button next to "Guardar integrante 1" on a phone is one
 * mis-tap away from destroying a family's invitation.
 *
 * And the refusal arrives as a `DeletionOutcome`, not as a thrown sentence. Next
 * replaces a thrown message with an opaque `digest` before it reaches a browser,
 * so the server's own wording could never be shown; the reason and the event
 * kinds travel as data and the Spanish lives here. That is the same conversion
 * the four membership writes already went through.
 *
 * ROTATION MUST NOT CLAIM WHAT IT CANNOT DO
 *
 * The slug-rotation spec forbids stating or implying that a crawler's cached
 * preview card for the old URL is removed or updated. It cannot be: WhatsApp
 * keeps one preview per link, on Meta's infrastructure, and nothing in this
 * console reaches into a chat history. `WeddingFactsForm` already says this out
 * loud where the couple's names are edited, and the assertions below hold this
 * copy to the same honesty — what rotation DOES do is named, what it cannot do
 * is not promised.
 *
 * Props only, actions as spies, no database: the page binds the real Server
 * Actions on the server, the same split as `InvitationForm`.
 *
 * Operator-facing copy is Spanish; identifiers and comments stay English.
 */

const INVITATION_ID = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD = "Familia Guzmán";
const NEW_URL = "https://boda.example/i/n3wsl0gn3wsl0g";

function spyDeletion() {
  return vi.fn<InvitationDeletionAction>();
}

function spyRotation() {
  return vi.fn<InvitationRotationAction>();
}

function renderLifecycle(
  overrides: {
    readonly onDelete?: ReturnType<typeof spyDeletion>;
    readonly onRotate?: ReturnType<typeof spyRotation>;
  } = {},
) {
  const onDelete = overrides.onDelete ?? spyDeletion();
  const onRotate = overrides.onRotate ?? spyRotation();

  onDelete.mockResolvedValue({ ok: true });
  onRotate.mockResolvedValue(NEW_URL);

  render(
    <InvitationLifecycle
      invitation={{ id: INVITATION_ID, displayName: HOUSEHOLD }}
      deleteInvitation={onDelete}
      rotateSlug={onRotate}
    />,
  );

  return { onDelete, onRotate, user: userEvent.setup() };
}

/** The notice region, which carries a refusal or a transport failure. */
function notice(): HTMLElement | null {
  return screen.queryByTestId("invitation-lifecycle-notice");
}

describe("InvitationLifecycle — deletion is irreversible, so it asks twice", () => {
  it("writes nothing on the first press", async () => {
    const { onDelete, user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("names the household in the confirmation it reveals", async () => {
    const { user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));

    // NAMED, NOT "esta invitación". The console is operated from a phone with
    // several households open in as many tabs, and "are you sure?" does not say
    // which one is about to disappear.
    //
    // `getAllByText`, because the name appears in the sentence AND in the button
    // that carries out the deletion — a finger arriving straight at the button
    // reads only the button. Both mentions are wanted; what is asserted is that
    // at least one exists.
    const confirmation = within(
      screen.getByTestId("invitation-deletion-confirm"),
    );

    expect(
      confirmation.getAllByText(new RegExp(HOUSEHOLD)).length,
    ).toBeGreaterThan(0);
    expect(
      confirmation.getByRole("button", {
        name: new RegExp(`Sí, eliminar «${HOUSEHOLD}»`),
      }),
    ).toBeInTheDocument();

    /*
      AND IT SAYS WHAT SURVIVES, BECAUSE IT USED TO SAY THE OPPOSITE.

      The sentence read "con todas las personas que tiene dentro", which was
      true while `invitation_guests.invitation_id` cascaded. Migration 0015
      releases them instead — asked and answered by the couple: "vuelven a la
      libreta" — so the old sentence now frightens an operator away from the
      one action that fixes a household assembled wrong.

      The deletion is still irreversible and still says so. What changed is the
      scope of the loss: the invitation, not the people.
    */
    expect(
      confirmation.getByText(/vuelven a la lista de invitados/i),
    ).toBeInTheDocument();
    expect(confirmation.queryByText(/con todas las personas/i)).toBeNull();
  });

  it("deletes on the confirmation, naming the invitation it acts on", async () => {
    const { onDelete, user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(
      within(screen.getByTestId("invitation-deletion-confirm")).getByRole(
        "button",
        { name: /Sí, eliminar/i },
      ),
    );

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0].get("invitationId")).toBe(INVITATION_ID);
  });

  it("abandons the deletion on cancel and asks again from the start", async () => {
    const { onDelete, user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId("invitation-deletion-confirm")).toBeNull();
  });

  it("sends one deletion for a double-tapped confirmation", async () => {
    // The same double-tap this console already guards elsewhere: a phone gets
    // pressed twice, and the second deletion would hit an invitation that is
    // already gone and surface as a broken server.
    //
    // THE WRITE IS LEFT IN FLIGHT ON PURPOSE. A deletion that has already
    // answered takes its own confirmation off the screen, so a second press
    // would land on nothing and this test would pass with every guard removed —
    // which is exactly how it was written the first time. The promise never
    // settles, so the second press happens while the first is still out.
    const onDelete = spyDeletion();
    const { user } = renderLifecycle({ onDelete });

    onDelete.mockReturnValue(new Promise<DeletionOutcome>(() => {}));

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));

    const confirm = within(
      screen.getByTestId("invitation-deletion-confirm"),
    ).getByRole("button", { name: /Sí, eliminar/i });

    await user.click(confirm);
    await user.click(confirm);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("announces a deletion that happened and offers the way back", async () => {
    const { user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, eliminar/i }));

    const done = await screen.findByTestId("invitation-deleted");

    expect(done.textContent).toMatch(new RegExp(HOUSEHOLD));
    expect(within(done).getByRole("link")).toHaveAttribute("href", "/console");
    // NOTHING LEFT TO ACT ON. The invitation is gone; a delete button still
    // standing next to its own success message invites a second attempt that
    // can only fail, and a rotation would name a row that no longer exists.
    expect(screen.queryByRole("button", { name: /Eliminar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Rotar/i })).toBeNull();
  });
});

describe("InvitationLifecycle — a refused deletion says what refused it", () => {
  it("names the dispatch kinds the refusal found and offers rotation instead", async () => {
    const onDelete = spyDeletion();
    const { user } = renderLifecycle({ onDelete });

    onDelete.mockResolvedValue({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["link_opened", "marked_failed"],
    });

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, eliminar/i }));

    const refusal = await screen.findByTestId("invitation-lifecycle-notice");

    // The labels are READ from the module the rest of the console renders them
    // with, not written here as literals: a copy of them here would keep
    // passing against a component that had grown its own wording.
    expect(refusal.textContent).toContain(DISPATCH_STATE_LABELS.link_opened);
    expect(refusal.textContent).toContain(DISPATCH_STATE_LABELS.marked_failed);
    // And it points at the exit, by the name of the button that performs it.
    expect(refusal.textContent).toMatch(/Rotar el enlace/i);
  });

  it("shows an unknown kind verbatim instead of inventing a name for it", async () => {
    // `canDeleteInvitation` refuses on the EXISTENCE of a row, never on a list
    // of known kinds, so a kind added by a later migration arrives here with no
    // label. Showing it raw is the honest answer; dropping it would report
    // "already dispatched" while naming nothing.
    const onDelete = spyDeletion();
    const { user } = renderLifecycle({ onDelete });

    onDelete.mockResolvedValue({
      ok: false,
      reason: "already_dispatched",
      eventKinds: ["carrier_pigeon_dispatched"],
    });

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, eliminar/i }));

    expect(
      (await screen.findByTestId("invitation-lifecycle-notice")).textContent,
    ).toContain("carrier_pigeon_dispatched");
  });

  it("says a stored answer proves the link reached somebody", async () => {
    const onDelete = spyDeletion();
    const { user } = renderLifecycle({ onDelete });

    onDelete.mockResolvedValue({
      ok: false,
      reason: "already_answered",
      eventKinds: [],
    });

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, eliminar/i }));

    const refusal = await screen.findByTestId("invitation-lifecycle-notice");

    // The two facts the domain states: a stored answer is independent evidence
    // the link escaped, and rotation is the exit rather than deletion.
    expect(refusal.textContent).toMatch(/respond/i);
    expect(refusal.textContent).toMatch(/Rotar el enlace/i);
  });

  it("never leaks what a failed deletion threw", async () => {
    // A thrown value proves nothing about who wrote it: a transport `TypeError`
    // is an ordinary `Error` with a non-empty message, and the repository
    // throws English developer text. Same guard as `InvitationForm`.
    const onDelete = spyDeletion();
    const { user } = renderLifecycle({ onDelete });

    onDelete.mockRejectedValue(
      new Error("Could not delete invitation 42: violates foreign key"),
    );

    await user.click(screen.getByRole("button", { name: /Eliminar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, eliminar/i }));

    const failure = await screen.findByTestId("invitation-lifecycle-notice");

    expect(failure.textContent).not.toMatch(/foreign key|Could not delete/i);
    expect(failure.textContent).toMatch(/conexión/i);
    // And the invitation is NOT reported as gone.
    expect(screen.queryByTestId("invitation-deleted")).toBeNull();
  });
});

describe("InvitationLifecycle — rotation, and what its copy must not claim", () => {
  it("writes nothing on the first press", async () => {
    const { onRotate, user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Rotar/i }));

    expect(onRotate).not.toHaveBeenCalled();
  });

  it("states what rotation does: the old address dies and the gate returns", async () => {
    const { user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Rotar/i }));

    const copy =
      screen.getByTestId("invitation-rotation-confirm").textContent ?? "";

    // The three consequences the spec names, in the operator's words.
    expect(copy).toMatch(/dirección nueva|enlace nuevo/i);
    expect(copy).toMatch(/deja de/i);
    expect(copy).toMatch(/filtro del teléfono|volver a pasar/i);
  });

  it("never claims the delivered preview card is removed or updated", async () => {
    const { user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Rotar/i }));

    const copy =
      screen.getByTestId("invitation-rotation-confirm").textContent ?? "";

    // THE HARD CONSTRAINT (slug-rotation spec, task 4b.18). Meta caches one
    // preview per URL on its own infrastructure; once a chat has rendered the
    // card for the old link, rotating the slug does not touch it. The copy must
    // say so rather than go quiet about it, and it must promise no change it
    // cannot make.
    expect(copy).toMatch(/vista previa/i);
    expect(copy).toMatch(/sigue|no cambia|tal cual/i);
    expect(copy).not.toMatch(
      /se actualiza|se borra|se elimina|se reemplaza|desaparece/i,
    );
  });

  it("shows the new address the rotation returned, so it is not lost", async () => {
    // The new slug exists nowhere else after the write. Losing it leaves an
    // invitation whose address nobody knows.
    const { user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Rotar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, rotar/i }));

    expect(
      (await screen.findByTestId("invitation-rotated-link")).textContent,
    ).toContain(NEW_URL);
  });

  it("rotates on the confirmation, naming the invitation it acts on", async () => {
    const { onRotate, user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Rotar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, rotar/i }));

    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(onRotate.mock.calls[0][0].get("invitationId")).toBe(INVITATION_ID);
  });

  it("never leaks what a failed rotation threw, and shows no address", async () => {
    const onRotate = spyRotation();
    const { user } = renderLifecycle({ onRotate });

    onRotate.mockRejectedValue(
      new Error("Could not rotate the slug of invitation 42: timeout"),
    );

    await user.click(screen.getByRole("button", { name: /Rotar/i }));
    await user.click(screen.getByRole("button", { name: /Sí, rotar/i }));

    const failure = await screen.findByTestId("invitation-lifecycle-notice");

    expect(failure.textContent).not.toMatch(/timeout|Could not rotate/i);
    expect(failure.textContent).toMatch(/conexión/i);
    expect(screen.queryByTestId("invitation-rotated-link")).toBeNull();
  });

  it("abandons the rotation on cancel", async () => {
    const { onRotate, user } = renderLifecycle();

    await user.click(screen.getByRole("button", { name: /Rotar/i }));
    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(onRotate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("invitation-rotation-confirm")).toBeNull();
    expect(notice()).toBeNull();
  });
});
