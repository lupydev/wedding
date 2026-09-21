import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DirectoryGuest } from "@/lib/domain/guest-directory";
import { deriveGreetingName } from "@/lib/domain/greeting-name";
import type { DraftRefusal } from "@/lib/domain/invitation-draft";

import {
  InvitationForm,
  type InvitationFormInvitation,
  type InvitationFormMember,
  type InvitationFormAction,
  type InvitationRefusingAction,
  type InvitationMemberActions,
} from "./InvitationForm";

/**
 * The one form that creates and edits an invitation.
 *
 * ONE FUNCTION, TWO RUNTIMES, AND THAT IS WHAT THESE TESTS HOLD (design D14)
 *
 * The live group-name preview is not a second implementation of the derivation.
 * It is `deriveGreetingName` from `lib/domain/greeting-name.ts` — the module the
 * Server Action imports by the same specifier — running in the browser bundle.
 * So the expectations below are computed by CALLING that function rather than by
 * writing its output as a literal: a test carrying `"Lucho y Michell"` as a
 * string would keep passing against a component that had quietly grown its own
 * joining rule, which is the exact drift D14 exists to make unrepresentable.
 *
 * NOBODY IS THE RECIPIENT UNTIL SOMEBODY CHOOSES ONE
 *
 * A previous slice deleted the auto-pick: no member is inferred to be the person
 * a WhatsApp goes to, not from `is_primary`, not from ordering, and not from
 * being the only reachable number. A radio group that defaults to its first
 * option would reinstate exactly that, silently, so the absence is asserted —
 * paired with a stored choice that IS rendered as selected, so the assertion
 * cannot pass by never checking anything.
 *
 * Props only, actions as spies, no database: the page binds the real Server
 * Actions on the server, the same split as `GuestPhoneField` and `RsvpAnswer`.
 *
 * Operator-facing copy is Spanish; identifiers and comments stay English.
 */

const INVITATION_ID = "11111111-1111-4111-8111-111111111111";
const LUIS = "22222222-2222-4222-8222-222222222222";
const MICHELL = "33333333-3333-4333-8333-333333333333";

/** A typed stand-in for a bound Server Action. */
function spyAction() {
  return vi.fn<InvitationFormAction>();
}

/** The stand-in for a write that must answer. See `InvitationRefusingAction`. */
function spyRefusingAction() {
  return vi.fn<InvitationRefusingAction>();
}

// ALL FOUR MEMBERSHIP WRITES ANSWER NOW, so all four stand-ins must be able to.
// A `spyAction()` here would type the spy as permitted to return nothing, which
// is the contract these writes just stopped having.
function memberActionSpies(): InvitationMemberActions & {
  readonly calls: {
    readonly add: ReturnType<typeof spyRefusingAction>;
    readonly edit: ReturnType<typeof spyRefusingAction>;
    readonly remove: ReturnType<typeof spyRefusingAction>;
    readonly chooseRecipient: ReturnType<typeof spyRefusingAction>;
  };
} {
  const calls = {
    add: spyRefusingAction(),
    edit: spyRefusingAction(),
    remove: spyRefusingAction(),
    chooseRecipient: spyRefusingAction(),
  };

  return { ...calls, calls };
}

function member(
  overrides: Partial<InvitationFormMember> = {},
): InvitationFormMember {
  return {
    id: LUIS,
    fullName: "Luis Guzmán",
    nickname: null,
    phoneE164: "+573001234567",
    isChild: false,
    dispatchable: true,
    ...overrides,
  };
}

function invitation(
  overrides: Partial<InvitationFormInvitation> = {},
): InvitationFormInvitation {
  return {
    id: INVITATION_ID,
    displayName: "Familia Guzmán",
    greetingName: "Luis y Michell",
    greetingNameSource: "derived",
    dispatchRecipientGuestId: null,
    dispatched: false,
    members: [
      member(),
      member({
        id: MICHELL,
        fullName: "Michell Ruiz",
        phoneE164: null,
        dispatchable: false,
      }),
    ],
    ...overrides,
  };
}

function renderCreate(freeGuests: readonly DirectoryGuest[] = []) {
  const action = spyAction();

  return {
    action,
    user: userEvent.setup(),
    ...render(<InvitationForm action={action} freeGuests={freeGuests} />),
  };
}

/** Somebody the directory holds and no household does. */
function freeGuest(overrides: Partial<DirectoryGuest> = {}): DirectoryGuest {
  return {
    id: "free-1",
    fullName: "Tía Marta",
    nickname: null,
    phoneE164: "+573001112233",
    isChild: false,
    household: null,
    ...overrides,
  };
}

function renderEdit(overrides: Partial<InvitationFormInvitation> = {}) {
  const action = spyAction();
  const memberActions = memberActionSpies();

  return {
    action,
    memberActions,
    user: userEvent.setup(),
    ...render(
      <InvitationForm
        action={action}
        invitation={invitation(overrides)}
        memberActions={memberActions}
      />,
    ),
  };
}

/**
 * The row fieldset for one member, by its position in the form.
 *
 * A pattern rather than a literal: a card for somebody who is not on the
 * invitation yet is legended "Integrante 3 · sin guardar", so its accessible
 * name carries the marker too. Anchored at both ends so "Integrante 1" cannot
 * match "Integrante 10".
 */
function row(position: number) {
  return within(
    screen.getByRole("group", {
      name: new RegExp(`^Integrante ${position}(?: · sin guardar)?$`),
    }),
  );
}

function derivedPreview(): string {
  return screen.getByTestId("invitation-derived-name").textContent ?? "";
}

describe("InvitationForm's live derived group name", () => {
  it("re-derives the name as names are typed, with the server's own function", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.click(
      screen.getByRole("button", { name: "Agregar otra persona" }),
    );
    await user.type(row(2).getByLabelText("Nombre completo"), "Michell Ruiz");

    expect(derivedPreview()).toContain(
      deriveGreetingName([
        { fullName: "Luis Guzmán", nickname: null },
        { fullName: "Michell Ruiz", nickname: null },
      ]),
    );
  });

  it("re-derives the name as a nickname is typed for one member", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.click(
      screen.getByRole("button", { name: "Agregar otra persona" }),
    );
    await user.type(row(2).getByLabelText("Nombre completo"), "Michell Ruiz");
    await user.type(row(1).getByLabelText("Apodo"), "Lucho");

    // The nickname wins inside a list, and the conjunction is the domain's.
    expect(derivedPreview()).toContain(
      deriveGreetingName([
        { fullName: "Luis Guzmán", nickname: "Lucho" },
        { fullName: "Michell Ruiz", nickname: null },
      ]),
    );
  });

  it("addresses a solo member by their full name, not their first name", async () => {
    // The distinction a single flagged function would collapse: one member is
    // addressed alone and keeps the whole name.
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");

    expect(derivedPreview()).toContain(
      deriveGreetingName([{ fullName: "Luis Guzmán", nickname: null }]),
    );
  });
});

describe("InvitationForm's group-name override", () => {
  it("still reads as derived while nobody has touched the field", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");

    expect(screen.getByTestId("invitation-greeting-source")).toHaveValue(
      "derived",
    );
  });

  it("records the name as custom as soon as the field is touched", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.clear(screen.getByLabelText("Nombre del grupo"));
    await user.type(screen.getByLabelText("Nombre del grupo"), "Los Guzmán");

    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue("Los Guzmán");
    expect(screen.getByTestId("invitation-greeting-source")).toHaveValue(
      "custom",
    );
  });

  it("returns the name to the live derived value when it is reset", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.clear(screen.getByLabelText("Nombre del grupo"));
    await user.type(screen.getByLabelText("Nombre del grupo"), "Los Guzmán");
    await user.click(
      screen.getByRole("button", { name: "Volver al nombre automático" }),
    );

    expect(screen.getByTestId("invitation-greeting-source")).toHaveValue(
      "derived",
    );
    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue(
      deriveGreetingName([{ fullName: "Luis Guzmán", nickname: null }]),
    );
  });
});

describe("InvitationForm's recipient choice", () => {
  it("pre-selects nobody on mount", () => {
    renderEdit();

    const radios = screen.getAllByRole("radio");

    // The auto-pick a previous slice deleted: no member is inferred to be the
    // person a WhatsApp goes to. An unanswered question stays unanswered.
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
  });

  it("renders a stored choice as the selected option", () => {
    // The pair for the assertion above: a component that never checks anything
    // would pass that test and fail this one.
    renderEdit({ dispatchRecipientGuestId: MICHELL });

    expect(screen.getByRole("radio", { name: /Michell Ruiz/ })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Luis Guzmán/ }),
    ).not.toBeChecked();
  });

  it("records the choice the moment it is made", async () => {
    const { memberActions, user } = renderEdit();

    await user.click(screen.getByRole("radio", { name: /Michell Ruiz/ }));

    expect(memberActions.calls.chooseRecipient).toHaveBeenCalledTimes(1);

    const submitted = memberActions.calls.chooseRecipient.mock.calls[0]?.[0];

    expect(submitted?.get("invitationId")).toBe(INVITATION_ID);
    expect(submitted?.get("guestId")).toBe(MICHELL);
  });

  /**
   * IT USED TO EXPLAIN THAT NOBODY COULD BE CHOSEN YET, AND NOW IT ASKS.
   *
   * The explanation was true — members have no ids until they are written, and
   * a radio group answering with ids would have been a control whose every
   * answer was discarded. What it cost was that every invitation created in the
   * console was born in "Sin destinatario elegido", waiting for somebody to
   * find it and reopen it.
   *
   * The answer is a POSITION now, which exists before an id does, and the
   * server resolves it against the rows it has just inserted.
   */
  it("asks who receives the message rather than deferring it", () => {
    renderCreate();

    expect(screen.queryByTestId("invitation-recipient-later")).toBeNull();
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
  });
});

describe("InvitationForm's refusals, checked before the round trip", () => {
  it("refuses a draft with no members at all, and creates nothing", async () => {
    const { action, user } = renderCreate();

    // The household name is filled in FIRST on purpose. It is `required`, and a
    // browser that refuses to submit an incomplete field would carry the "no
    // invitation was created" assertion below on its own — leaving the refusal
    // this test exists for unproven.
    await user.type(
      screen.getByLabelText("Nombre del hogar"),
      "Familia Guzmán",
    );
    await user.click(
      screen.getByRole("button", { name: "Quitar integrante 1" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    // NOTHING IS CREATED. The Server Action re-applies the same refusal, but an
    // operator who has to submit to find out has been made to wait for an answer
    // the form already had.
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId("invitation-refusals")).toHaveTextContent(
      /al menos una persona/i,
    );
  });

  it("saves a draft that has a named member, which is the refusal's pair", async () => {
    const { action, user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.type(
      screen.getByLabelText("Nombre del hogar"),
      "Familia Guzmán",
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("refuses a save whose chosen recipient is no longer a member", async () => {
    // A stored choice can outlive the member: the other operator may have moved
    // them out while this form was open. The draft is inconsistent and says so
    // instead of writing a name beside a recipient nobody can send to.
    const { action, user } = renderEdit({
      dispatchRecipientGuestId: "44444444-4444-4444-8444-444444444444",
    });

    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId("invitation-refusals")).toHaveTextContent(
      /ya no pertenece a esta invitación/i,
    );
  });

  it("saves when the chosen recipient IS a member, which is that refusal's pair", async () => {
    const { action, user } = renderEdit({ dispatchRecipientGuestId: MICHELL });

    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("refuses a blank custom name and points at the way back", async () => {
    const { action, user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    // Filled for the same reason: `required` must not be what stops the save.
    await user.type(
      screen.getByLabelText("Nombre del hogar"),
      "Familia Guzmán",
    );
    await user.clear(screen.getByLabelText("Nombre del grupo"));
    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId("invitation-refusals")).toHaveTextContent(
      /nombre automático/i,
    );
  });
});

describe("InvitationForm's advisories, which never block the save", () => {
  it("saves two members who share a nickname, and says so", async () => {
    const { action, user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.type(row(1).getByLabelText("Apodo"), "Lucho");
    await user.click(
      screen.getByRole("button", { name: "Agregar otra persona" }),
    );
    await user.type(row(2).getByLabelText("Nombre completo"), "Luis Ruiz");
    await user.type(row(2).getByLabelText("Apodo"), "Lucho");
    await user.type(
      screen.getByLabelText("Nombre del hogar"),
      "Familia Guzmán",
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    // Twins are not a data error. The save happens and the operator is told.
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("invitation-advisories")).toHaveTextContent(
      /mismo apodo/i,
    );
  });

  it("says nothing when the nicknames are distinct", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.type(row(1).getByLabelText("Apodo"), "Lucho");
    await user.click(
      screen.getByRole("button", { name: "Agregar otra persona" }),
    );
    await user.type(row(2).getByLabelText("Nombre completo"), "Michell Ruiz");
    await user.type(row(2).getByLabelText("Apodo"), "Michu");

    expect(
      screen.queryByTestId("invitation-advisories"),
    ).not.toBeInTheDocument();
  });

  it("warns that the chosen recipient has no number, without blocking", async () => {
    // Michell has no phone on file. A half-finished record is what a record looks
    // like while somebody is filling it in.
    const { action, user } = renderEdit({ dispatchRecipientGuestId: MICHELL });

    await user.click(
      screen.getByRole("button", { name: "Guardar invitación" }),
    );

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("invitation-advisories")).toHaveTextContent(
      /no tiene un número guardado/i,
    );
  });
});

describe("InvitationForm's warning about an already-delivered greeting", () => {
  it("warns when a DISPATCHED invitation still derives its name", () => {
    // The message left WhatsApp carrying the name as it read then, and nothing in
    // this console can reach into a chat history to correct it. Re-deriving the
    // name here is right and it is also invisible to the people who already got
    // the old one.
    renderEdit({ dispatched: true, greetingNameSource: "derived" });

    expect(screen.getByTestId("invitation-dispatched-warning")).toBeVisible();
    expect(
      screen.getByTestId("invitation-dispatched-warning"),
    ).toHaveTextContent(/ya (se )?envi/i);
  });

  it("says nothing on an invitation that has never been dispatched", () => {
    renderEdit({ dispatched: false, greetingNameSource: "derived" });

    expect(
      screen.queryByTestId("invitation-dispatched-warning"),
    ).not.toBeInTheDocument();
  });

  it("says nothing when the dispatched invitation's name is custom", () => {
    // A custom name does not move when the membership does, so there is no
    // divergence between the stored name and the delivered one to warn about.
    renderEdit({ dispatched: true, greetingNameSource: "custom" });

    expect(
      screen.queryByTestId("invitation-dispatched-warning"),
    ).not.toBeInTheDocument();
  });
});

describe("InvitationForm's last-member refusal", () => {
  it("refuses to remove the only member, and points at deleting the invitation", async () => {
    // An invitation with zero members could never be unlocked by anybody and
    // would sit in the console looking valid while being unreachable. The exit
    // is deleting the invitation, so the refusal says so instead of failing.
    const { memberActions, user } = renderEdit({
      members: [
        {
          id: LUIS,
          fullName: "Luis Guzmán",
          nickname: null,
          phoneE164: "+573001234567",
          isChild: false,
          dispatchable: true,
        },
      ],
    });

    const remove = screen.getByRole("button", { name: "Quitar integrante 1" });

    expect(remove).toBeDisabled();
    expect(screen.getByTestId("invitation-member-refusal")).toHaveTextContent(
      /eliminarla completa/i,
    );

    await user.click(remove);

    expect(memberActions.calls.remove).not.toHaveBeenCalled();
  });

  it("removes a member from a multi-member invitation, which is the pair", async () => {
    const { memberActions, user } = renderEdit();

    await user.click(
      screen.getByRole("button", { name: "Quitar integrante 2" }),
    );

    expect(memberActions.calls.remove).toHaveBeenCalledTimes(1);

    const submitted = memberActions.calls.remove.mock.calls[0]?.[0];

    expect(submitted?.get("invitationId")).toBe(INVITATION_ID);
    expect(submitted?.get("guestId")).toBe(MICHELL);
    expect(
      screen.queryByTestId("invitation-member-refusal"),
    ).not.toBeInTheDocument();
  });

  it("still lets the creation form empty itself, because there is nothing to delete", async () => {
    // The refusal is about an invitation that EXISTS. A creation form with no
    // rows left is refused at the save instead, which is where it becomes a
    // state somebody is asking to store.
    const { user } = renderCreate();

    await user.click(
      screen.getByRole("button", { name: "Quitar integrante 1" }),
    );

    expect(screen.queryByRole("group", { name: "Integrante 1" })).toBeNull();
  });
});

describe("InvitationForm's derived name beside a custom one (B3)", () => {
  it("keeps showing the live derived name while a custom one is being typed", async () => {
    const { user } = renderCreate();

    await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
    await user.clear(screen.getByLabelText("Nombre del grupo"));
    await user.type(screen.getByLabelText("Nombre del grupo"), "Los Guzmán");

    expect(screen.getByTestId("invitation-greeting-source")).toHaveValue(
      "custom",
    );
    expect(derivedPreview()).toContain(
      deriveGreetingName([{ fullName: "Luis Guzmán", nickname: null }]),
    );
  });

  it("shows a stored custom name unchanged, beside what the members derive to", () => {
    // The custom text mentions somebody who is no longer a member. Nothing tries
    // to work out whether it "still mentions" them: matching a typed sentence
    // against member names is unreliable, and a wrong answer here silently
    // rewrites or silently keeps the wrong greeting. Both are shown instead, and
    // the operator decides.
    renderEdit({
      greetingNameSource: "custom",
      greetingName: "Lucho, Michu y Fer",
    });

    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue(
      "Lucho, Michu y Fer",
    );
    expect(derivedPreview()).toContain(
      deriveGreetingName([
        { fullName: "Luis Guzmán", nickname: null },
        { fullName: "Michell Ruiz", nickname: null },
      ]),
    );
  });

  it("re-derives the name beside a custom one as the members change", async () => {
    const { user } = renderEdit({
      greetingNameSource: "custom",
      greetingName: "Lucho, Michu y Fer",
    });

    await user.type(row(1).getByLabelText("Apodo"), "Lucho");

    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue(
      "Lucho, Michu y Fer",
    );
    expect(derivedPreview()).toContain(
      deriveGreetingName([
        { fullName: "Luis Guzmán", nickname: "Lucho" },
        { fullName: "Michell Ruiz", nickname: null },
      ]),
    );
  });
});

describe("InvitationForm — a write that fails is not a write that happened", () => {
  // EVERY WRITE HERE WAS FIRE-AND-FORGET.
  //
  // The recipient choice was applied to local state and the promise discarded,
  // so a rejected `chooseRecipient` left the radio rendered as chosen while the
  // server had recorded nothing: the operator sees the answer they gave, and
  // dispatch stays blocked forever with no explanation anywhere. Same shape for
  // add, edit, remove and the save itself.
  it("surfaces a failed recipient write instead of showing it as chosen", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();
    memberActions.calls.chooseRecipient.mockImplementation(() => {
      throw new Error("chooseRecipient rejected");
    });

    render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    const radios = screen.getAllByRole("radio");
    await user.click(radios[1]);

    // The operator is TOLD. Silence here is the bug.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // And the radio does not lie about a choice the server never took.
    expect((radios[1] as HTMLInputElement).checked).toBe(false);
  });

  it("surfaces a failed member write too, so no membership failure is silent", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();
    memberActions.calls.remove.mockImplementation(() => {
      throw new Error("removeMember rejected");
    });

    render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.click(row(1).getByRole("button", { name: /Quitar/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("InvitationForm — re-seeding must not eat unsaved typing", () => {
  // THE EDIT PAGE REVALIDATES AFTER EVERY MEMBERSHIP WRITE.
  //
  // Re-seeding replaced the whole row array whenever the incoming props array
  // changed identity, so a name typed into one row and not yet saved through
  // its own button vanished the moment an unrelated write completed. The
  // re-seed exists to give a just-added member its server id; it must not cost
  // the operator text they are still writing.
  it("absorbs a just-added member instead of showing them twice", async () => {
    // THE REASON THIS BRANCH EXISTS.
    //
    // A member added here carries no id until their add lands. When the server
    // list comes back carrying them WITH an id, the local row and the server row
    // are the same person: keeping both renders them twice and a second save
    // adds them twice. Preserving unsaved typing must not cost this.
    const action = spyAction();
    const memberActions = memberActionSpies();
    const before = invitation();
    const { rerender } = render(
      <InvitationForm
        action={action}
        invitation={before}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /Agregar otra persona/i }),
    );

    const added = row(before.members.length + 1);
    await user.type(added.getByLabelText("Nombre completo"), "Nueva Persona");

    // The server list now carries that member, with an id.
    rerender(
      <InvitationForm
        action={action}
        invitation={invitation({
          members: [
            ...before.members,
            member({
              id: "99999999-9999-4999-8999-999999999999",
              fullName: "Nueva Persona",
              phoneE164: null,
              dispatchable: false,
            }),
          ],
        })}
        memberActions={memberActions}
      />,
    );

    expect(screen.getAllByDisplayValue("Nueva Persona")).toHaveLength(1);
  });

  it("keeps text typed into another row when the server list arrives again", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();
    const { rerender } = render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    const nickname = row(1).getByLabelText("Apodo");
    await user.clear(nickname);
    await user.type(nickname, "Lucho");

    // A fresh props array with identical content: exactly what revalidation
    // hands back after an unrelated membership write.
    rerender(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    expect(row(1).getByLabelText("Apodo")).toHaveValue("Lucho");
  });
});

describe("InvitationForm — the two writes nobody was watching", () => {
  // ADD AND EDIT WERE THE ONLY UNTESTED WRITES.
  //
  // The id-presence branch decides which of the two runs, and `memberFields`
  // builds the payload for all of them. Neither was asserted: an inverted branch
  // would have made every edit create a duplicate member, and a mislabeled field
  // would have written blanks — both with the whole suite green.
  it("edits an existing member, carrying every field the server needs", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();

    render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.type(row(1).getByLabelText("Apodo"), "Lucho");
    await user.click(
      row(1).getByRole("button", { name: "Guardar integrante 1" }),
    );

    // EDIT, not add: this member already has an id.
    expect(memberActions.calls.edit).toHaveBeenCalledTimes(1);
    expect(memberActions.calls.add).not.toHaveBeenCalled();

    const sent = memberActions.calls.edit.mock.calls[0][0];
    expect(sent.get("invitationId")).toBe(INVITATION_ID);
    expect(sent.get("guestId")).toBe(LUIS);
    expect(sent.get("fullName")).toBe("Luis Guzmán");
    expect(sent.get("nickname")).toBe("Lucho");
    expect(sent.get("phone")).toBe("+573001234567");
    expect(sent.get("isChild")).toBe("false");
  });

  it("adds a brand-new member, and sends no guest id because there is none yet", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();
    const before = invitation();

    render(
      <InvitationForm
        action={action}
        invitation={before}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /Agregar otra persona/i }),
    );

    const position = before.members.length + 1;
    await user.type(
      row(position).getByLabelText("Nombre completo"),
      "Tomás Guzmán",
    );
    await user.click(row(position).getByLabelText(/niñ/i));
    await user.click(
      row(position).getByRole("button", {
        name: `Guardar integrante ${position}`,
      }),
    );

    // ADD, not edit: the branch is proved in both directions.
    expect(memberActions.calls.add).toHaveBeenCalledTimes(1);
    expect(memberActions.calls.edit).not.toHaveBeenCalled();

    const sent = memberActions.calls.add.mock.calls[0][0];
    expect(sent.get("fullName")).toBe("Tomás Guzmán");
    expect(sent.get("isChild")).toBe("true");
    // A member the server has never seen has no id to send.
    expect(sent.get("guestId")).toBeNull();
  });
});

describe("InvitationForm — a double tap is one person, not two", () => {
  // THE CONSOLE IS DESIGNED FOR A PHONE, AND PHONES GET DOUBLE-TAPPED.
  //
  // A row created here keeps `id: null` until the server list comes back and the
  // re-seed adopts an id, so a second press before the first write returns takes
  // the ADD branch again and the same person is inserted twice. Nothing catches
  // it downstream: `duplicate_member_id` compares stored ids, and the two rows
  // have different ones. A duplicated member then raises the derived greeting
  // name, the member count and the seat cap — the couple's guest list, wrong.
  it("creates one invitation when the whole form is submitted twice in flight", async () => {
    // THE SAME BUG, ONE LEVEL UP, AND WORSE.
    //
    // The member rows were guarded; the whole-form save was not. In create mode
    // two presses produce TWO households: two slugs, two recipients to choose,
    // and two possible dispatches to the same guest. Nothing de-duplicates
    // downstream — `createInvitation` mints a fresh slug per call and
    // console-created rows carry a null source_key, so neither the
    // duplicate-member check nor the source_key conflict path sees it.
    const action = spyAction();

    let release: () => void = () => {};
    action.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }) as unknown as void,
    );

    render(<InvitationForm action={action} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Nombre del hogar"),
      "Familia Aristizábal",
    );
    await user.type(
      row(1).getByLabelText("Nombre completo"),
      "Carlos Aristizábal",
    );

    const submit = screen.getByRole("button", { name: "Guardar invitación" });

    await user.click(submit);
    await user.click(submit);

    expect(action).toHaveBeenCalledTimes(1);

    release();
  });

  it("adds a new member once when its save is pressed twice in flight", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();

    // A write that has not answered yet. `add` must resolve to the refusals now,
    // so the held promise resolves to the permitted answer — no cast, because
    // the type it has to satisfy is the one the real action has.
    let release: () => void = () => {};
    memberActions.calls.add.mockImplementation(
      () =>
        new Promise<readonly DraftRefusal[]>((resolve) => {
          release = () => resolve([]);
        }),
    );

    const before = invitation();

    render(
      <InvitationForm
        action={action}
        invitation={before}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /Agregar otra persona/i }),
    );

    const position = before.members.length + 1;
    await user.type(
      row(position).getByLabelText("Nombre completo"),
      "Tomás Guzmán",
    );

    const save = row(position).getByRole("button", {
      name: `Guardar integrante ${position}`,
    });

    await user.click(save);
    await user.click(save);

    expect(memberActions.calls.add).toHaveBeenCalledTimes(1);

    release();
  });
});

describe("InvitationForm — a returned refusal is shown as itself", () => {
  // A REFUSAL THE SERVER RETURNS IS THE ONE THING WORTH SAYING OUT LOUD.
  //
  // Thrown text can never be trusted or, in production, even delivered — which
  // is what the block below locks down. A RETURNED code is different in kind:
  // the server chose it from a closed vocabulary, and this component already
  // owns the Spanish for every member of that vocabulary in REFUSAL_COPY. So a
  // returned refusal must read as itself, not as "revisá la conexión", which is
  // advice guaranteed to be futile for a rule that will refuse identically on
  // every retry.
  it("translates the code instead of blaming the connection", async () => {
    const action = spyAction();
    const memberActions = memberActionSpies();
    memberActions.calls.chooseRecipient.mockResolvedValue([
      "recipient_not_a_member",
    ]);

    render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    const radios = screen.getAllByRole("radio");
    await user.click(radios[1]);

    const alert = await screen.findByTestId("invitation-write-error");

    expect(alert.textContent).toBe(
      "La persona elegida para recibir el mensaje ya no pertenece a esta invitación. Hay que elegir de nuevo a quién se le envía.",
    );
    // And the radio does not keep showing a choice the server refused.
    expect((radios[1] as HTMLInputElement).checked).toBe(false);
  });

  it("says why a removal was refused, for the member writes too", async () => {
    // THE THREE MEMBERSHIP WRITES ANSWER NOW, NOT ONLY THE RECIPIENT CHOICE.
    //
    // `removeMember` is the one with a refusal an operator meets in ordinary use:
    // taking the last member off a household. It used to arrive as "revisá la
    // conexión", which is advice guaranteed to be futile — the rule refuses
    // identically on every retry, and what the operator actually needs to hear is
    // that the invitation itself is what gets deleted.
    const action = spyAction();
    const memberActions = memberActionSpies();
    memberActions.calls.remove.mockResolvedValue(["no_members"]);

    render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.click(row(1).getByRole("button", { name: /Quitar/i }));

    expect(
      (await screen.findByTestId("invitation-write-error")).textContent,
    ).toBe(
      "Una invitación tiene que quedarse con al menos una persona. Si la idea es que esta invitación desaparezca, hay que eliminarla completa en vez de dejarla sin integrantes.",
    );
  });
});

describe("InvitationForm — a failed write never leaks what was thrown", () => {
  // NOTHING THROWN BY A WRITE IS OPERATOR COPY.
  //
  // It is tempting to surface a rejection's message so a refusal reads as
  // itself instead of "check your connection". It cannot work: an incidental
  // `TypeError: Failed to fetch` is an ordinary `Error` with a non-empty
  // message, indistinguishable from a deliberate refusal, and Next replaces a
  // thrown message with an opaque `digest` in production, so the refusal text
  // never reaches the browser anyway. Delivering refusals means the actions
  // RETURNING them instead of throwing them. Until then, this locks the door.
  it.each([
    ["a domain refusal", new Error("No se puede quitar al último integrante.")],
    ["a transport failure", new TypeError("Failed to fetch")],
    ["an empty message", new Error("")],
    ["a plain object", { code: 500 } as unknown],
    ["null", null as unknown],
    ["a framework digest", Object.assign(new Error("boom"), { digest: "d1" })],
  ])("shows the generic copy for %s", async (_label, thrown) => {
    const action = spyAction();
    const memberActions = memberActionSpies();
    memberActions.calls.remove.mockImplementation(() => {
      throw thrown;
    });

    render(
      <InvitationForm
        action={action}
        invitation={invitation()}
        memberActions={memberActions}
      />,
    );

    const user = userEvent.setup();
    await user.click(row(1).getByRole("button", { name: /Quitar/i }));

    // Equality, not `toHaveTextContent`: that helper is substring containment,
    // so an alert that appended the thrown message would still pass.
    expect((await screen.findByRole("alert")).textContent).toBe(
      "No pudimos guardar ese cambio. Revisá la conexión y volvé a intentarlo.",
    );
  });

  /**
   * THE BUTTON USED TO SAY IT ADDED SOMEBODY, AND IT DID NOT.
   *
   * "Agregar otra persona" only opened a blank card; the person reached the
   * invitation on a SECOND press, on a different button, further down. An
   * operator who pressed it once and walked away had added nobody, and the
   * screen had told them otherwise.
   *
   * So the card says out loud that it is not saved yet, and the button that
   * opens it says what it opens.
   */
  describe("adding a person to the household", () => {
    it("names the button for what it actually does", () => {
      renderEdit();

      expect(
        screen.getByRole("button", { name: "Agregar otra persona" }),
      ).toBeInTheDocument();
      // The old wording, which claimed the press added somebody.
      expect(
        screen.queryByRole("button", { name: "Agregar integrante" }),
      ).toBeNull();
    });

    it("marks the new card as not yet saved", async () => {
      const { user } = renderEdit();

      await user.click(
        screen.getByRole("button", { name: "Agregar otra persona" }),
      );

      expect(screen.getByText(/sin guardar/i)).toBeInTheDocument();
    });

    /**
     * And a saved card never claims to be unsaved.
     *
     * The marker is the whole signal, so it has to be absent where the person
     * is already on the invitation — otherwise it is decoration and an operator
     * learns to ignore it.
     */
    it("does not mark the people who are already saved", () => {
      renderEdit();

      expect(screen.queryByText(/sin guardar/i)).toBeNull();
    });

    /**
     * The cursor lands in the new name field.
     *
     * Adding somebody is: press, type, save. Without this it is press, AIM,
     * type, save — and the aiming is on a phone, at a field that just appeared
     * below the fold.
     */
    it("puts the cursor in the new person's name", async () => {
      const { user } = renderEdit();

      await user.click(
        screen.getByRole("button", { name: "Agregar otra persona" }),
      );

      const names = screen.getAllByLabelText("Nombre completo");

      expect(names.at(-1)).toHaveFocus();
    });
  });

  /**
   * AN INVITATION USED TO BE BORN BLOCKED.
   *
   * The create form showed a paragraph where the recipient chooser belongs —
   * "A quién se le envía el mensaje se elige después de guardar" — because the
   * members have no ids until they are written. So every household created in
   * the console landed straight in the readiness panel's "Sin destinatario
   * elegido", and the operator had to find it again and reopen it to finish
   * something they thought they had finished.
   *
   * The members have POSITIONS even before they have ids, and a position is
   * all the server needs: it inserts the guests and resolves the choice
   * against the rows it just created.
   */
  describe("choosing who receives the message while creating", () => {
    it("offers the choice instead of a paragraph about later", () => {
      renderCreate();

      expect(
        screen.getByRole("group", { name: /Quién recibe el mensaje/i }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("invitation-recipient-later")).toBeNull();
    });

    /**
     * The first person is chosen to begin with, and the choice is on screen.
     *
     * Nothing is defaulted SILENTLY — the operator can see who is marked and
     * change it in one tap. The alternative was the state this replaces: an
     * invitation saved, apparently complete, and unsendable.
     */
    it("starts with the first person marked", () => {
      renderCreate();

      const chosen = screen.getAllByRole("radio");

      expect(chosen[0]).toBeChecked();
    });

    it("follows the operator to another member", async () => {
      const { user } = renderCreate();

      await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
      await user.click(
        screen.getByRole("button", { name: "Agregar otra persona" }),
      );
      await user.type(row(2).getByLabelText("Nombre completo"), "Michell Peña");

      const radios = screen.getAllByRole("radio");
      await user.click(radios[1]);

      expect(radios[1]).toBeChecked();
      expect(radios[0]).not.toBeChecked();
    });

    /**
     * The choice travels as a POSITION, because that is all that exists yet.
     *
     * A guest id would be an invention: the people on this form have not been
     * written, so there is nothing to name them by except where they sit.
     */
    it("submits the position, since there is no id yet", async () => {
      const { action, user } = renderCreate();

      // `required`, so a browser refuses to submit without it and the
      // assertion below would never be reached.
      await user.type(
        screen.getByLabelText("Nombre del hogar"),
        "Familia Guzmán Peña",
      );
      await user.type(row(1).getByLabelText("Nombre completo"), "Luis Guzmán");
      await user.click(
        screen.getByRole("button", { name: "Agregar otra persona" }),
      );
      await user.type(row(2).getByLabelText("Nombre completo"), "Michell Peña");
      await user.click(screen.getAllByRole("radio")[1]);
      await user.click(
        screen.getByRole("button", { name: "Guardar invitación" }),
      );

      const submitted = action.mock.calls[0][0] as FormData;

      expect(submitted.get("recipientIndex")).toBe("1");
    });
  });
});

/**
 * BUILDING A HOUSEHOLD OUT OF PEOPLE WHO ALREADY EXIST.
 *
 * Since migration 0015 a guest can be written down in the directory before any
 * household holds them, which is what the couple asked for: "la creación de
 * invitaciones donde se pueda agregar un invitado". Picking one MOVES that
 * person into this household rather than writing a second record with the same
 * name — and the rule underneath it, "no se debería poder escoger en una
 * próxima invitación", is why the picker is fed only free guests and why a
 * person already added here disappears from it.
 */
describe("picking somebody who is already in the directory", () => {
  it("says nothing about a directory that has nobody spare", async () => {
    renderCreate([]);

    expect(
      screen.queryByRole("button", { name: /Agregar de la lista/ }),
    ).toBeNull();
  });

  /**
   * SHE TAKES THE EMPTY CARD, SHE DOES NOT LAND UNDER IT.
   *
   * A new form opens with one blank member card. Appending after it would
   * leave an empty "Integrante 1" above the person just added — which the
   * validator then refuses for having no name, on a form where the operator
   * did nothing wrong. Their first action was "add Tía Marta", so Tía Marta is
   * Integrante 1.
   */
  it("adds the chosen person as the first member of an empty form", async () => {
    const { user } = renderCreate([freeGuest()]);

    await user.click(
      screen.getByRole("button", { name: "Agregar de la lista: Tía Marta" }),
    );

    expect(row(1).getByLabelText("Nombre completo")).toHaveValue("Tía Marta");
    expect(screen.queryByRole("group", { name: /^Integrante 2$/ })).toBeNull();
  });

  /**
   * AND A CARD SOMEBODY HAS TYPED INTO IS NEVER CONSUMED.
   *
   * The rule above exists to swallow an UNTOUCHED card. Swallowing a half-typed
   * one would delete a person's name because the operator reached for the
   * directory next, which is the opposite of helpful.
   */
  it("keeps a half-typed card and adds her after it", async () => {
    const { user } = renderCreate([freeGuest()]);

    await user.type(row(1).getByLabelText("Nombre completo"), "Ana Ruiz");
    await user.click(
      screen.getByRole("button", { name: "Agregar de la lista: Tía Marta" }),
    );

    expect(row(1).getByLabelText("Nombre completo")).toHaveValue("Ana Ruiz");
    expect(row(2).getByLabelText("Nombre completo")).toHaveValue("Tía Marta");
  });

  /**
   * HER DETAILS ARE NOT EDITABLE HERE, and that is not a restriction for its
   * own sake: the directory owns them. A name corrected in two places drifts,
   * and the screen where it is corrected for everybody is `/console/guests`.
   */
  it("shows her details without offering to rewrite them here", async () => {
    const { user } = renderCreate([freeGuest()]);

    await user.click(
      screen.getByRole("button", { name: "Agregar de la lista: Tía Marta" }),
    );

    expect(row(1).getByLabelText("Nombre completo")).toHaveAttribute(
      "readonly",
    );
  });

  /**
   * AND SHE LEAVES THE PICKER THE MOMENT SHE IS ADDED.
   *
   * Offering her twice would let one form build a household containing the
   * same person twice — which `duplicate_member_id` would refuse on submit,
   * after the operator had done the work.
   */
  it("stops offering somebody this form has already taken", async () => {
    const { user } = renderCreate([freeGuest()]);

    await user.click(
      screen.getByRole("button", { name: "Agregar de la lista: Tía Marta" }),
    );

    expect(
      screen.queryByRole("button", { name: /Agregar de la lista: Tía Marta/ }),
    ).toBeNull();
  });

  /**
   * EVERY ROW EMITS THE ID COLUMN, EMPTY OR NOT.
   *
   * `readMemberRows` reads the member fields as parallel arrays and refuses a
   * column whose length disagrees with the names — a rule it holds precisely
   * because a short column would attach one person's value to another
   * person's row. A picked row is the only one with an id, so the typed rows
   * have to send an empty string rather than nothing at all.
   */
  it("sends one id column entry per member, so the arrays cannot slip", async () => {
    const { user } = renderCreate([freeGuest()]);

    await user.type(screen.getByLabelText("Nombre del hogar"), "Familia Ruiz");
    await user.type(row(1).getByLabelText("Nombre completo"), "Ana Ruiz");
    await user.click(
      screen.getByRole("button", { name: "Agregar de la lista: Tía Marta" }),
    );

    const form = screen.getByLabelText("Nombre del hogar").closest("form")!;
    const sent = new FormData(form);

    expect(sent.getAll("memberFullName")).toEqual(["Ana Ruiz", "Tía Marta"]);
    expect(sent.getAll("memberExistingId")).toEqual(["", "free-1"]);
  });

  /**
   * THE EDIT SCREEN DOES NOT OFFER THIS, and the reason is that adding a
   * member there is already its own server action against a saved invitation —
   * a different write with a different shape. That is U3b; until it exists,
   * showing a picker here that did nothing would be worse than showing none.
   */
  it("is not offered while editing an invitation that already exists", () => {
    renderEdit();

    expect(
      screen.queryByRole("button", { name: /Agregar de la lista/ }),
    ).toBeNull();
  });
});
