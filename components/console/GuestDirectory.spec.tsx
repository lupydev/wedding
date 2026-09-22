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
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ANA = "sender-ana";
const HOUSEHOLD = {
  invitationId: "i1",
  greetingName: "Familia Restrepo",
  ownerSenderId: ANA,
  recipientGuestId: "g1",
  dispatchState: "not_dispatched" as const,
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
    inviteAloneAction: Mock<VoidAction>;
  }> = {},
) {
  const dispatchBlocked = actions.dispatchBlocked ?? false;
  const inviteAloneAction =
    actions.inviteAloneAction ??
    vi.fn<VoidAction>().mockResolvedValue(undefined);
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
      inviteAloneAction={inviteAloneAction}
      updateAction={updateAction}
      viewerSenderId={ANA}
    />,
  );

  return { createAction, updateAction, deleteAction, inviteAloneAction };
}

/**
 * One person's row, BY ATTRIBUTE AND NOT BY TEXT.
 *
 * Opening the editor moves the name out of the row's text content and into an
 * input's value, so a text-based lookup loses the row at precisely the moment
 * a test is editing it. The `<li>` carries its own identity for that reason.
 */
function rowFor(fullName: string): HTMLElement {
  return document.querySelector<HTMLElement>(
    `li.guest-directory__row[data-guest-name="${fullName}"]`,
  )!;
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
   *
   * REACHED THROUGH THE EDITOR NOW. It used to sit on the resting row, which
   * put a destructive control one mis-tap away on every one of those forty.
   * The press that opens the editor is the one where somebody says they want
   * to change this person, and it is not a press anybody makes by accident.
   */
  it("names the person in the confirmation before deleting them", async () => {
    const user = userEvent.setup();
    const { deleteAction } = renderDirectory([
      guest({ fullName: "Ana Restrepo" }),
    ]);
    const opened = rowFor("Ana Restrepo");

    await user.click(within(opened).getByRole("button", { name: /Editar/ }));
    await user.click(within(opened).getByRole("button", { name: /Eliminar/ }));

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
    const opened = rowFor("Ana Restrepo");

    await user.click(within(opened).getByRole("button", { name: /Editar/ }));
    await user.click(within(opened).getByRole("button", { name: /Eliminar/ }));

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

/**
 * SENDING TO SOMEBODY WHO IS IN NO HOUSEHOLD.
 *
 * "Se le debe de poder mediante un botón o algo enviar la invitación individual
 * si se quiere al invitado sin necesidad de pertenecer a una invitación, estas
 * son para grupos familiares de 2 o más personas."
 *
 * The press mints their one-person invitation and goes to the dispatch screen.
 * It is the same destination the household rows reach, so there is still only
 * one place a message is composed, gated and audited — what disappears is
 * having to assemble a household for a cousin who is coming alone.
 */
describe("inviting a guest on their own", () => {
  it("offers it to somebody who belongs to nobody", () => {
    renderDirectory([guest()]);

    expect(
      within(rowFor("Ana Restrepo")).getByRole("button", {
        name: /Invitar por separado/i,
      }),
    ).toBeInTheDocument();
  });

  /**
   * AND NOT TO SOMEBODY ALREADY IN ONE. Their household is how they are sent,
   * and that row already carries "Enviar". Two ways to send one person is one
   * way too many, and the second would mint a duplicate invitation.
   */
  it("offers nothing of the kind to somebody already in a household", () => {
    renderDirectory([guest({ household: HOUSEHOLD })]);

    expect(
      within(rowFor("Ana Restrepo")).queryByRole("button", {
        name: /Invitar por separado/i,
      }),
    ).toBeNull();
  });

  it("withdraws it while this handset carries the other account", () => {
    renderDirectory([guest()], { dispatchBlocked: true });

    expect(
      within(rowFor("Ana Restrepo")).queryByRole("button", {
        name: /Invitar por separado/i,
      }),
    ).toBeNull();
  });

  /**
   * THE ACTION CARRIES THE ID AND THE SERVER DECIDES WHERE TO GO.
   *
   * A plain `<form action={…}>` with a hidden field, not a button wired to a
   * router: the server action redirects to the dispatch screen it just created,
   * exactly as the create page's wrapper does. Nothing about navigation lives
   * in this component, so there is nothing here to get out of step.
   */
  it("sends the guest's id to the server", async () => {
    const user = userEvent.setup();
    const { inviteAloneAction } = renderDirectory([guest()]);

    await user.click(
      within(rowFor("Ana Restrepo")).getByRole("button", {
        name: /Invitar por separado/i,
      }),
    );

    expect(
      (inviteAloneAction.mock.calls[0][0] as FormData).get("guestId"),
    ).toBe("g1");
  });
});

/**
 * A ROW THAT A PERSON CAN SCAN FORTY TIMES.
 *
 * It carried a name line, a household line, a recipient line and three
 * buttons. Forty of those is a wall, not a list — and the couple's word for it
 * was "slop", about a console their non-technical half has to run.
 *
 * What a row has to answer is who this is, where they are, and what to do
 * next. Everything else is maintenance and belongs where somebody went looking
 * for it.
 */
describe("how much a row says", () => {
  it("answers where they are and who gets the message in one line", () => {
    renderDirectory([
      guest({ id: "g1", fullName: "Ana Restrepo", household: HOUSEHOLD }),
      guest({ id: "g2", fullName: "Beto Restrepo", household: HOUSEHOLD }),
    ]);

    // One paragraph, not two. Beto's says both things.
    const context = within(rowFor("Beto Restrepo")).getByTestId(
      "guest-directory-context",
    );

    expect(context).toHaveTextContent("Familia Restrepo");
    expect(context).toHaveTextContent(/le llega a Ana Restrepo/i);
    expect(
      within(rowFor("Beto Restrepo")).queryAllByTestId(
        "guest-directory-context",
      ),
    ).toHaveLength(1);
  });

  it("says only where they are when they are the one being written to", () => {
    renderDirectory([guest({ household: HOUSEHOLD })]);

    expect(
      within(rowFor("Ana Restrepo")).getByTestId("guest-directory-context"),
    ).toHaveTextContent("Familia Restrepo · recibe el mensaje");
  });

  /**
   * DELETING IS NOT A RESTING-STATE CONTROL.
   *
   * It sat on every row, one mis-tap from a person's record, on a phone. It
   * now lives inside the editor — where somebody has already said "I want to
   * change this person" — which is both quieter and safer, and costs one press
   * that nobody makes forty times.
   */
  it("offers no delete on the row itself", () => {
    renderDirectory([guest()]);

    expect(
      within(rowFor("Ana Restrepo")).queryByRole("button", {
        name: /Eliminar/i,
      }),
    ).toBeNull();
  });

  it("offers it inside the editor, where the change was already intended", async () => {
    const user = userEvent.setup();
    renderDirectory([guest()]);
    const row = rowFor("Ana Restrepo");

    await user.click(within(row).getByRole("button", { name: /Editar/ }));

    expect(
      within(row).getByRole("button", { name: /Eliminar/i }),
    ).toBeInTheDocument();
  });

  /**
   * TWO CONTROLS AT REST, AND NEVER MORE.
   *
   * The primary one depends on the person — send, for somebody in a household
   * that can be written to; invite separately, for somebody in none — and the
   * two cannot both apply, because each needs the opposite of the other.
   */
  it("shows at most two controls on a resting row", () => {
    renderDirectory([guest({ household: HOUSEHOLD })]);

    const controls = within(rowFor("Ana Restrepo")).getAllByRole(
      "button",
      {},
    ).length;
    const links = within(rowFor("Ana Restrepo")).getAllByRole("link").length;

    expect(controls + links).toBe(2);
  });
});

/**
 * WHO HAS ACTUALLY BEEN WRITTEN TO, ON THEIR OWN ROW.
 *
 * The couple: "si se envía una invitación a un grupo familiar, a la persona a
 * la que se le envía esa invitación, en invitados debería aparecer como que ya
 * se le envió la invitación — y quizá distinguir los otros invitados que hacen
 * parte ya de una invitación."
 *
 * A send reaches ONE member. So the row has four things to say, and each
 * answers a different question: nobody has an invitation; this person will
 * receive it; somebody else will; this person already did; somebody else
 * already did.
 */
describe("what a row says about the send", () => {
  const sent = { ...HOUSEHOLD, dispatchState: "marked_sent" as const };
  const context = (fullName: string) =>
    within(rowFor(fullName)).getByTestId("guest-directory-context");

  it("says the invitation already went to the person who received it", () => {
    renderDirectory([guest({ id: "g1", household: sent })]);

    expect(context("Ana Restrepo")).toHaveTextContent(
      "En Familia Restrepo · ya se le envió la invitación",
    );
  });

  /**
   * AND TELLS THE OTHER MEMBERS THE TRUTH, which is that it went to somebody
   * else. Saying "ya se le envió" on all four rows of a household would tell
   * three people a thing that never happened.
   */
  it("tells the other members it went to somebody else", () => {
    renderDirectory([
      guest({ id: "g1", fullName: "Ana Restrepo", household: sent }),
      guest({ id: "g2", fullName: "Beto Restrepo", household: sent }),
    ]);

    expect(context("Beto Restrepo")).toHaveTextContent(
      "En Familia Restrepo · la invitación se le envió a Ana Restrepo",
    );
  });

  it("still speaks in the future before anything has gone out", () => {
    renderDirectory([
      guest({ id: "g1", fullName: "Ana Restrepo", household: HOUSEHOLD }),
      guest({ id: "g2", fullName: "Beto Restrepo", household: HOUSEHOLD }),
    ]);

    expect(context("Ana Restrepo")).toHaveTextContent("recibe el mensaje");
    expect(context("Beto Restrepo")).toHaveTextContent(
      "el mensaje le llega a Ana Restrepo",
    );
  });

  /**
   * THE SEND AFFORDANCE SURVIVES A SEND.
   *
   * "Aunque se les pueda seguir enviando la invitación de manera individual."
   * A sent invitation can be sent again — the dispatch log has a `resent` kind
   * for exactly that — and an operator whose message did not arrive should not
   * have to undo anything to try again.
   */
  it("keeps offering the send after it has gone out", () => {
    renderDirectory([guest({ id: "g1", household: sent })]);

    expect(
      within(rowFor("Ana Restrepo")).getByRole("link", { name: /Enviar/ }),
    ).toBeVisible();
  });
});
