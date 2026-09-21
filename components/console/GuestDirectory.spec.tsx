import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, describe, expect, it, vi } from "vitest";

import {
  type DirectoryGuest,
  buildGuestDirectory,
} from "@/lib/domain/guest-directory";
import type { DraftRefusal } from "@/lib/domain/invitation-draft";

import { GuestDirectory } from "./GuestDirectory";

/**
 * The list of PEOPLE, which the console never had.
 *
 * The couple's words: "no veo la lista de invitados por ninguna parte". They
 * were right twice — nothing pointed at such a list, and nothing could have
 * been behind it either, because `invitation_guests.invitation_id` was `not
 * null` until migration 0015 and a guest had nowhere to live outside a
 * household.
 *
 * Presentational and props-only. The ordering and the counts are decided by
 * `buildGuestDirectory`, unit-tested over rows; what is asserted here is only
 * what a rendered tree can show.
 */

function guest(overrides: Partial<DirectoryGuest> = {}): DirectoryGuest {
  return {
    id: "g1",
    fullName: "Ana Restrepo",
    nickname: null,
    phoneE164: "+573001234567",
    isChild: false,
    household: null,
    ...overrides,
  };
}

const ANA = "sender-ana";
const HOUSEHOLD = {
  invitationId: "i1",
  greetingName: "Familia Restrepo",
  ownerSenderId: ANA,
  recipientGuestId: "g1",
};

/** The two action shapes the component takes, so the props are really typed. */
type RefusingAction = (formData: FormData) => Promise<readonly DraftRefusal[]>;
type VoidAction = (formData: FormData) => Promise<void>;

function renderDirectory(
  guests: readonly DirectoryGuest[],
  actions: Partial<{
    createAction: Mock<RefusingAction>;
    updateAction: Mock<RefusingAction>;
    deleteAction: Mock<VoidAction>;
    dispatchBlocked: boolean;
  }> = {},
) {
  const dispatchBlocked = actions.dispatchBlocked ?? false;
  const createAction =
    actions.createAction ?? vi.fn<RefusingAction>().mockResolvedValue([]);
  const updateAction =
    actions.updateAction ?? vi.fn<RefusingAction>().mockResolvedValue([]);
  const deleteAction =
    actions.deleteAction ?? vi.fn<VoidAction>().mockResolvedValue(undefined);

  render(
    <GuestDirectory
      createAction={createAction}
      deleteAction={deleteAction}
      directory={buildGuestDirectory(guests)}
      dispatchBlocked={dispatchBlocked}
      updateAction={updateAction}
      viewerSenderId={ANA}
    />,
  );

  return { createAction, updateAction, deleteAction };
}

function rowFor(fullName: string): HTMLElement {
  return screen
    .getByText(fullName, { selector: ".guest-directory__name" })
    .closest("li")!;
}

describe("GuestDirectory", () => {
  it("lists everybody, whether or not they are in a household", () => {
    renderDirectory([
      guest({ id: "1", fullName: "Ana Restrepo", household: HOUSEHOLD }),
      guest({ id: "2", fullName: "Carla Suelta" }),
    ]);

    expect(rowFor("Ana Restrepo")).toBeInTheDocument();
    expect(rowFor("Carla Suelta")).toBeInTheDocument();
  });

  /**
   * WHERE SOMEBODY ALREADY IS, WRITTEN OUT ON THEIR OWN ROW.
   *
   * This is the couple's rule made visible: "cuando un invitado pertenece a una
   * invitación no debe poder pertenecer a otra". The database makes it
   * unrepresentable, but a reader cannot see a constraint. They can see that
   * Ana is in Familia Restrepo and Carla is in nobody's.
   */
  it("says which household holds a guest, and says when none does", () => {
    renderDirectory([
      guest({ id: "1", fullName: "Ana Restrepo", household: HOUSEHOLD }),
      guest({ id: "2", fullName: "Carla Suelta" }),
    ]);

    expect(
      within(rowFor("Ana Restrepo")).getByText(/Familia Restrepo/),
    ).toBeInTheDocument();
    expect(
      within(rowFor("Carla Suelta")).getByText(/Sin invitación/i),
    ).toBeInTheDocument();
  });

  /**
   * BOTH FIGURES CARRY THEIR POPULATION, which is this console's oldest rule —
   * `ConsoleDashboard` and `DispatchPreflight` both hold it. A bare "1" here
   * would not say one out of how many.
   */
  it("counts the people and how many are still unplaced", () => {
    renderDirectory([
      guest({ id: "1", household: HOUSEHOLD }),
      guest({ id: "2", fullName: "Beto Restrepo", household: HOUSEHOLD }),
      guest({ id: "3", fullName: "Carla Suelta" }),
    ]);

    expect(screen.getByTestId("guest-directory-summary")).toHaveTextContent(
      "3 invitados · 1 sin invitación",
    );
  });

  it("invites the first person in rather than rendering an empty box", () => {
    renderDirectory([]);

    expect(screen.getByText(/Todavía no hay invitados/i)).toBeInTheDocument();
  });

  it("sends a new guest's details to the server", async () => {
    const user = userEvent.setup();
    const { createAction } = renderDirectory([]);

    await user.type(screen.getByLabelText("Nombre completo"), "Nueva Persona");
    await user.type(screen.getByLabelText("Apodo"), "Nue");
    await user.type(screen.getByLabelText("Teléfono"), "3005551234");
    await user.click(screen.getByLabelText(/Es menor/i));
    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));

    expect(createAction).toHaveBeenCalledTimes(1);
    const sent = createAction.mock.calls[0][0] as FormData;

    expect(sent.get("fullName")).toBe("Nueva Persona");
    expect(sent.get("nickname")).toBe("Nue");
    expect(sent.get("phone")).toBe("3005551234");
    expect(sent.get("isChild")).toBe("on");
  });

  /**
   * A REFUSAL IS SHOWN, AND NOTHING IS CLAIMED TO HAVE HAPPENED.
   *
   * The server answers with a `DraftRefusal` rather than throwing, because Next
   * replaces a thrown message with an opaque digest before it crosses to the
   * browser — so prose thrown from a server action reaches nobody. The Spanish
   * lives here, next to the field it is about.
   */
  it("shows the server's refusal in words the operator can act on", async () => {
    const user = userEvent.setup();
    renderDirectory([], {
      createAction: vi
        .fn<RefusingAction>()
        .mockResolvedValue(["member_without_name"]),
    });

    await user.click(screen.getByRole("button", { name: "Agregar invitado" }));

    expect(
      await screen.findByText(/necesita un nombre completo/i),
    ).toBeInTheDocument();
  });

  it("opens an editor holding what is already stored", async () => {
    const user = userEvent.setup();
    renderDirectory([guest({ fullName: "Ana Restrepo", nickname: "Anita" })]);

    /*
      THE ROW IS CAPTURED BEFORE THE CLICK, and it has to be: opening the
      editor replaces the name span this file finds rows by, so looking the row
      up again afterwards finds nothing. The `<li>` itself is stable — React
      keys it by guest id — so holding the element is what survives the swap.
    */
    const row = rowFor("Ana Restrepo");

    await user.click(within(row).getByRole("button", { name: /Editar/ }));

    const editor = within(row);

    expect(editor.getByLabelText("Nombre completo")).toHaveValue(
      "Ana Restrepo",
    );
    expect(editor.getByLabelText("Apodo")).toHaveValue("Anita");
  });

  /**
   * DELETING ASKS FIRST, AND NAMES THE PERSON WHILE ASKING.
   *
   * The same rule `InvitationLifecycle` holds for a household: this console is
   * operated from a phone, and "¿seguro?" does not say who is about to
   * disappear from a list of forty.
   */
  it("names the person in the confirmation before deleting them", async () => {
    const user = userEvent.setup();
    const { deleteAction } = renderDirectory([
      guest({ fullName: "Ana Restrepo" }),
    ]);

    await user.click(
      within(rowFor("Ana Restrepo")).getByRole("button", { name: /Eliminar/ }),
    );

    expect(deleteAction).not.toHaveBeenCalled();
    expect(
      within(rowFor("Ana Restrepo")).getByText(/Ana Restrepo/, {
        selector: ".guest-directory__confirm",
      }),
    ).toBeInTheDocument();

    await user.click(
      within(rowFor("Ana Restrepo")).getByRole("button", {
        name: /Sí, eliminar/,
      }),
    );

    expect(deleteAction).toHaveBeenCalledTimes(1);
    expect((deleteAction.mock.calls[0][0] as FormData).get("guestId")).toBe(
      "g1",
    );
  });

  /**
   * AND IT SAYS WHAT DELETING COSTS WHEN THE PERSON IS IN A HOUSEHOLD.
   *
   * Deleting from here removes them from their invitation too. That is the
   * right behaviour — refusing would send the operator to another screen to do
   * what they just asked for — but it is not what "eliminar" looks like from a
   * list of people, so the confirmation says it.
   */
  it("warns that a placed guest also leaves their invitation", async () => {
    const user = userEvent.setup();
    renderDirectory([
      guest({ fullName: "Ana Restrepo", household: HOUSEHOLD }),
    ]);

    await user.click(
      within(rowFor("Ana Restrepo")).getByRole("button", { name: /Eliminar/ }),
    );

    expect(
      within(rowFor("Ana Restrepo")).getByText(/Familia Restrepo/, {
        selector: ".guest-directory__confirm",
      }),
    ).toBeInTheDocument();
  });
});

/**
 * SENDING FROM A PERSON'S ROW.
 *
 * The couple asked for it: "en los invitados debe existir un botón de envío de
 * la invitación en caso tal de que se quiera hacer de manera individual".
 *
 * It is a LINK to the existing dispatch screen, not a second way to send. That
 * screen composes the message, applies the device gate and writes the audit
 * event; a button here that sent directly would be a second dispatch path with
 * its own set of guards to keep in step, which is how one of them ends up
 * missing.
 */
describe("sending from a guest's row", () => {
  it("offers a send on an owned household, pointing at the dispatch screen", () => {
    renderDirectory([guest({ household: HOUSEHOLD })]);

    const send = within(rowFor("Ana Restrepo")).getByRole("link", {
      name: /Enviar/,
    });

    expect(send).toHaveAttribute("href", "/console/dispatch/i1");
  });

  /**
   * NOT FOR SOMEBODY IN NO INVITATION, because there is nothing to send: no
   * invitation, no link, no message. The row already says "Sin invitación
   * todavía", which is the reason and does not need repeating.
   */
  it("offers nothing to send for a guest with no invitation", () => {
    renderDirectory([guest()]);

    expect(
      within(rowFor("Ana Restrepo")).queryByRole("link", { name: /Enviar/ }),
    ).toBeNull();
  });

  /**
   * NOT ON THE OTHER OPERATOR'S HOUSEHOLD. Administration is shared between the
   * two of them; dispatch is not, and that route answers `notFound()` — so the
   * link would be an affordance pointing at a 404.
   */
  it("offers nothing on a household the other operator owns", () => {
    renderDirectory([
      guest({ household: { ...HOUSEHOLD, ownerSenderId: "sender-beto" } }),
    ]);

    expect(
      within(rowFor("Ana Restrepo")).queryByRole("link", { name: /Enviar/ }),
    ).toBeNull();
  });

  it("withdraws it while this handset carries the other account", () => {
    renderDirectory([guest({ household: HOUSEHOLD })], {
      dispatchBlocked: true,
    });

    expect(
      within(rowFor("Ana Restrepo")).queryByRole("link", { name: /Enviar/ }),
    ).toBeNull();
  });

  /**
   * AND IT NEVER LETS THE OPERATOR BELIEVE THE MESSAGE GOES TO THIS PERSON.
   *
   * A send is addressed to the member its invitation names, which need not be
   * the person whose row was pressed — and this list is alphabetical, so that
   * member's own row is nowhere nearby. Saying whose it is turns a button that
   * would quietly do something else into one that says what it does.
   */
  it("names who actually receives the message when it is somebody else", () => {
    renderDirectory([
      guest({ id: "g1", fullName: "Ana Restrepo", household: HOUSEHOLD }),
      guest({ id: "g2", fullName: "Beto Restrepo", household: HOUSEHOLD }),
    ]);

    expect(
      within(rowFor("Beto Restrepo")).getByText(/le llega a Ana Restrepo/i),
    ).toBeInTheDocument();
    expect(
      within(rowFor("Ana Restrepo")).getByText(/Recibe el mensaje/i),
    ).toBeInTheDocument();
  });

  /**
   * A household that has chosen nobody cannot be sent at all — the dispatch
   * preflight already blocks it — so the row says that instead of offering a
   * button that leads to a refusal.
   */
  it("says nobody has been chosen rather than offering a send", () => {
    renderDirectory([
      guest({ household: { ...HOUSEHOLD, recipientGuestId: null } }),
    ]);

    const row = within(rowFor("Ana Restrepo"));

    expect(row.queryByRole("link", { name: /Enviar/ })).toBeNull();
    expect(row.getByText(/Nadie elegido/i)).toBeInTheDocument();
  });
});
