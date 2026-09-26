import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RsvpFeedback } from "@/lib/domain/rsvp-copy";

import type { CeremonyStreamDetails } from "./CeremonyStream";

import {
  RsvpAnswer,
  type RsvpAnswerAction,
  type RsvpAnswerCurrent,
  type RsvpAnswerGuest,
} from "./RsvpAnswer";

/**
 * The RSVP surface — the only place a guest can answer, and the only
 * interactive element behind the gate.
 *
 * The action is a prop, exactly as `GateForm`'s is: in production the page
 * passes the bound Server Action, here it is a plain async function. That is
 * what makes the two assertions that matter testable without a server.
 *
 * The two assertions that matter:
 *
 *  1. There is NO way to select more people than the household has seats. The
 *     cap is hard by confirmed decision, so the form must not have an
 *     affordance for asking — not a number input, not a "request more" link,
 *     not a fourth checkbox that goes red after the fact.
 *  2. The submitted payload carries NAMES, never a seat count. The database
 *     requires `seats_confirmed` to equal the number of named attendees
 *     (migration 0007), so a form that can send the two independently is a form
 *     that will eventually send them disagreeing.
 */

const GUESTS: readonly RsvpAnswerGuest[] = [
  { id: "aaaaaaaa-1111-4111-8111-111111111111", fullName: "Camila Aguirre" },
  { id: "bbbbbbbb-2222-4222-8222-222222222222", fullName: "Rodrigo Aguirre" },
  { id: "cccccccc-3333-4333-8333-333333333333", fullName: "Sara Aguirre" },
];

/** Where the wedding happens, which only an attending household is told. */
const VENUE = {
  name: "Hacienda La Ñapa",
  address: "Calle 12 #34-56, Barrio Centro",
};

const CEREMONY: CeremonyStreamDetails = {
  streamUrl: "https://meet.google.com/abc-defg-hij",
};

/**
 * A fake Server Action returning a FRESH object per call, exactly as the real
 * one does: the outcome crosses the RSC boundary and is deserialized anew every
 * time. A shared object would let a component that only reacts to a CHANGED
 * result pass here and then stall in production on the second identical answer.
 */
function actionReturning(feedback: RsvpFeedback) {
  return vi.fn<RsvpAnswerAction>(async () => ({ ...feedback }));
}

function renderForm(
  options: {
    action?: ReturnType<typeof actionReturning>;
    guests?: readonly RsvpAnswerGuest[];
    current?: RsvpAnswerCurrent | null;
    ceremony?: CeremonyStreamDetails;
  } = {},
) {
  const action = options.action ?? actionReturning({ status: "recorded" });

  render(
    <RsvpAnswer
      action={action}
      guests={options.guests ?? GUESTS}
      current={options.current ?? null}
      ceremony={options.ceremony ?? CEREMONY}
      venue={VENUE}
    />,
  );

  return action;
}

function declineRadio() {
  return screen.getByRole("radio", { name: /No podemos acompañarlos/ });
}

function acceptRadio() {
  return screen.getByRole("radio", { name: /Sí, allá estaremos/ });
}

/** An answer already on file that says the household cannot come. */
const DECLINED: RsvpAnswerCurrent = {
  attending: false,
  seatsConfirmed: 0,
  attendeeGuestIds: [],
  dietaryNotes: null,
};

/**
 * The declined household's surface: the stream block that replaces the form.
 *
 * Found by its test hook rather than by a named group. It WAS a `dl`
 * with `role="group"`
 * called "Detalles de la transmisión", because it held a meeting id and a
 * passcode with their labels. It holds one link now, which carries its own
 * accessible name and needs no grouping.
 */
function streamCard(): HTMLElement {
  return screen.getByTestId("stream-details");
}

/**
 * The way to the venue, which only an attending household may be offered.
 *
 * `queryByRole` rather than `getByRole`: most of what this locator is for is
 * proving the control is NOT on screen, and `getBy` throws before an assertion
 * can read it.
 */
function mapLink(): HTMLElement | null {
  return screen.queryByRole("link", { name: /Cómo llegar/ });
}

function attendeeBoxes() {
  return within(
    screen.getByRole("group", { name: /Quiénes asisten/ }),
  ).getAllByRole("checkbox");
}

function submitButton() {
  return screen.getByRole("button", { name: /Enviar respuesta/ });
}

describe("RsvpAnswer attendance choice", () => {
  it("asks the yes/no question before anything else", () => {
    renderForm();

    expect(
      screen.getByRole("radio", { name: /Sí, allá estaremos/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /No podemos acompañarlos/ }),
    ).toBeInTheDocument();
  });

  it("offers one checkbox per named guest, and nothing more", async () => {
    renderForm();
    // The list opens only on the affirmative now, so every assertion about it
    // starts by answering the question it belongs to.
    await userEvent.click(acceptRadio());

    const boxes = attendeeBoxes();

    expect(boxes).toHaveLength(GUESTS.length);
    for (const guest of GUESTS) {
      expect(
        screen.getByRole("checkbox", { name: guest.fullName }),
      ).toBeInTheDocument();
    }
  });

  it("marks a child so the couple's own list reads the same as the form", async () => {
    // TWO members, not one: a solo invitation is never shown the list at all,
    // so a one-guest fixture would be asserting about a control that no longer
    // exists rather than about how a child is marked.
    renderForm({
      guests: [
        GUESTS[0],
        { id: GUESTS[1].id, fullName: "Sara Aguirre", isChild: true },
      ],
    });
    await userEvent.click(acceptRadio());

    expect(
      screen.getByRole("checkbox", { name: /Sara Aguirre \(niño o niña\)/ }),
    ).toBeInTheDocument();
  });

  // The test that stood here asserted the attendee list was DISABLED before
  // the household answered. It is not rendered at all now — see "shows nothing
  // else until the question is answered", which asserts the stronger thing.

  it("opens the attendee list the moment they say yes", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());

    for (const box of attendeeBoxes()) {
      expect(box).toBeEnabled();
    }
  });
});

describe("RsvpAnswer seat cap", () => {
  it("never lets a guest select anybody this invitation does not name", async () => {
    // The cap IS the membership since migration 0012, so the form cannot offer
    // an over-cap selection: there is exactly one checkbox per member and no
    // affordance for anybody else. A five-member household may therefore seat
    // all five, and every box stays interactive so the guest can still change
    // their mind after checking the last one.
    const user = userEvent.setup();
    const guests: RsvpAnswerGuest[] = [
      ...GUESTS,
      { id: "dddddddd-4444-4444-8444-444444444444", fullName: "Luis Aguirre" },
      { id: "eeeeeeee-5555-4555-8555-555555555555", fullName: "Ana Aguirre" },
    ];

    renderForm({ guests });
    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));

    // Nothing is clicked: a fresh answer opens with everybody already coming,
    // which is the state this test is about — the cap spent, and said so in
    // words rather than by silently freezing the boxes.

    const checked = attendeeBoxes().filter(
      (box) => (box as HTMLInputElement).checked,
    );
    const selectable = attendeeBoxes().filter(
      (box) => !(box as HTMLInputElement).disabled,
    );

    expect(attendeeBoxes()).toHaveLength(5);
    expect(checked).toHaveLength(5);
    expect(selectable).toHaveLength(5);
    expect(screen.getByText("Ya seleccionaron las 5.")).toBeInTheDocument();
  });

  it("says everyone is selected instead of silently freezing the controls", async () => {
    const user = userEvent.setup();
    // TWO members. This used to use one, and a solo invitation no longer has
    // a list to freeze — which also means `seatsSelectionSentence`'s "la única
    // persona" branch can no longer be reached from this form. It is still a
    // correct sentence and still covered in `rsvp-copy.spec.ts`; nothing here
    // renders it any more.
    renderForm({ guests: [GUESTS[0], GUESTS[1]] });

    await user.click(acceptRadio());

    // Both are already checked, which is the allowance spent.
    expect(screen.getByText("Ya seleccionaron las 2.")).toBeInTheDocument();
  });

  it("offers no way to type a seat count or ask for more seats", () => {
    // The hard cap has no "request more" flow, by confirmed decision. A number
    // input would be both an affordance for asking and a second, independent
    // source for a column the database requires to match the names.
    renderForm();

    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText(/más lugares|cupos adicionales/i)).toBeNull();
  });
});

describe("RsvpAnswer submission", () => {
  it("sends the checked names and no seat count at all", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));
    // Everybody starts checked, so this household is UNCHECKING the one who
    // cannot come — which is the exception the new default is built around.
    await user.click(screen.getByRole("checkbox", { name: "Sara Aguirre" }));
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("attending")).toBe("yes");
    expect(formData.getAll("attendee")).toEqual([GUESTS[0].id, GUESTS[1].id]);
    // The derivation, asserted from the outside: there is no seat field.
    expect(formData.get("seatsConfirmed")).toBeNull();
    expect(formData.get("seats")).toBeNull();
  });

  // Three tests stood here, all about the dietary field: that a filled value was
  // sent, that a blank one was sent as empty rather than as invented text, and
  // that its length was bounded to what the database accepts. The couple removed
  // the field — see "no longer asks anybody to type" above. The column and its
  // bound remain, and `lib/server/rsvp.ts` still owns both.

  it("offers no message box, and sends no message field", async () => {
    // The whole flow starts in the guest's own WhatsApp thread with the couple
    // and arrives from the couple's own numbers, so the guest already holds
    // their contact. A box here competes with the chat they are already in and
    // loses: a WhatsApp reply reaches the couple where they actually are, while
    // a form field waits for somebody to remember to check it.
    const user = userEvent.setup();
    const action = renderForm();

    expect(screen.queryByLabelText(/Mensaje/i)).toBeNull();
    expect(screen.queryByText(/Mensaje para los novios/i)).toBeNull();

    await user.click(acceptRadio());
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    expect(action.mock.calls[0][1].get("message")).toBeNull();
    // `dietaryNotes` STAYS: that is not a message, it is operational data the
    // catering needs and a guest will not think to send unprompted.
    // And nothing else is sent either: the dietary field went with the
    // question, so the payload carries the answer and the people alone.
    expect(action.mock.calls[0][1].get("dietaryNotes")).toBeNull();
    expect(action.mock.calls[0][1].get("mensaje")).toBeNull();
  });

  it("shows what came back from the action", async () => {
    const user = userEvent.setup();
    renderForm({ action: actionReturning({ status: "recorded" }) });

    await user.click(acceptRadio());
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));
    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¡Listo! Guardamos su respuesta.",
      ),
    );
  });

  it("shows a rejection in words rather than failing silently", async () => {
    const user = userEvent.setup();
    renderForm({
      action: actionReturning({
        status: "rejected",
        reason: "attending_without_seats",
      }),
    });

    await user.click(screen.getByRole("radio", { name: /Sí, allá estaremos/ }));
    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Selecciona quiénes asisten, al menos una persona.",
      ),
    );
  });
});

describe("RsvpAnswer with an answer already on file", () => {
  const CURRENT: RsvpAnswerCurrent = {
    attending: true,
    seatsConfirmed: 2,
    attendeeGuestIds: [GUESTS[0].id, GUESTS[1].id],
    dietaryNotes: "Sin mariscos",
  };

  it("tells the household what they answered last time", () => {
    renderForm({ current: CURRENT });

    expect(
      screen.getByText("Tu respuesta actual: asisten 2 personas."),
    ).toBeInTheDocument();
  });

  it("shows nothing of the sort when they have never answered", () => {
    renderForm({ current: null });

    expect(screen.queryByText(/Tu respuesta actual/)).toBeNull();
  });

  it("pre-fills the form so changing one thing does not retype everything", () => {
    renderForm({ current: CURRENT });

    expect(
      screen.getByRole("radio", { name: /Sí, allá estaremos/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Camila Aguirre" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Rodrigo Aguirre" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Sara Aguirre" }),
    ).not.toBeChecked();
    // The dietary field is gone, so there is nothing else to pre-fill: what
    // survives is the answer and the people, which is what "not retyping
    // everything" actually meant.
  });

  it("lets the household change a yes into a no", async () => {
    // Append-only means this is a NEW row, not an edit — but from the guest's
    // side it has to feel like simply changing their answer.
    const user = userEvent.setup();
    const action = renderForm({ current: CURRENT });

    await user.click(declineRadio());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    expect(action.mock.calls[0][1].get("attending")).toBe("no");
  });

  it("shows a household that already declined the stream, not the form", () => {
    // They answered. Re-offering the form as though nothing had happened is
    // how a household ends up answering twice and wondering which one counted.
    renderForm({ current: DECLINED });

    expect(streamCard()).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /allá estaremos/ })).toBeNull();
  });
});

/**
 * Declining is one tap, and one tap is reversible.
 *
 * WHY IT AUTO-SUBMITS. There is genuinely nothing left to fill in: a decline
 * confirms zero seats and names nobody, so the cap and the seat/attendee parity
 * rule (migration 0007) are satisfied trivially. A second click would be a
 * button whose only job is to ask "are you sure" without saying so. Accepting
 * still needs the explicit submit, because there the household must first
 * choose who is coming.
 *
 * WHY THE WAY BACK MATTERS. Auto-submitting means one mis-tap records a decline
 * instantly. Responses are append-only, so correcting it writes a NEW row and
 * the couple still sees that the household changed its mind — which is the
 * information they want, and the reason a correction is safe to offer.
 */
describe("RsvpAnswer declining", () => {
  it("submits on the first tap, with no second click anywhere", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(declineRadio());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("attending")).toBe("no");
    // A decline names nobody and holds no seats, by construction.
    expect(formData.getAll("attendee")).toEqual([]);
  });

  it("names nobody even when the household had already checked people", async () => {
    // The dangerous ordering: boxes checked under a "yes", then the answer
    // flipped to "no". The submitted payload must not still carry them, or the
    // database's `rsvp_declined_has_zero_seats` constraint is the only thing
    // left standing between a mis-tap and a 500.
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(acceptRadio());
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));
    await user.click(screen.getByRole("checkbox", { name: "Rodrigo Aguirre" }));
    await user.click(declineRadio());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    expect(action.mock.calls[0][1].get("attending")).toBe("no");
    expect(action.mock.calls[0][1].getAll("attendee")).toEqual([]);
  });

  it("replaces the form with the ceremony stream once the answer is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(declineRadio());

    await waitFor(() => expect(streamCard()).toBeInTheDocument());

    // The address is no longer PRINTED; the control that carries it is the
    // evidence that the stream block replaced the form.
    expect(
      screen.getByRole("link", { name: /Entrar a la transmisión/ }),
    ).toHaveAttribute("href", CEREMONY.streamUrl);
    // Not a form beside the card, and not a disabled copy of it. No form.
    expect(
      screen.queryByRole("button", { name: /Enviar respuesta/ }),
    ).toBeNull();
  });

  it("keeps the form when the server refuses the decline", async () => {
    // The surface follows the RECORDED answer, never the tap. A refusal that
    // swapped in the stream card would tell a household they are expected on a
    // call while the couple's list still has them as unanswered.
    const user = userEvent.setup();
    renderForm({ action: actionReturning({ status: "not_authorized" }) });

    await user.click(declineRadio());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Tu sesión ya no está activa.",
      ),
    );
    expect(screen.queryByText(CEREMONY.streamUrl)).toBeNull();
    // The QUESTION is what must still be here. The submit button belongs to
    // the affirmative branch, and this household has just said no.
    expect(acceptRadio()).toBeInTheDocument();
    expect(declineRadio()).toBeInTheDocument();
  });

  it("hands the form back, with nothing preselected, when they reconsider", async () => {
    // Nothing preselected on purpose: a mis-tap must not be one more tap away
    // from repeating itself, and re-choosing "no" has to be a real choice that
    // fires the auto-submit again.
    const user = userEvent.setup();
    renderForm({ current: DECLINED });

    await user.click(
      screen.getByRole("button", { name: /Volver a responder/ }),
    );

    // The question, with neither answer chosen — which is also why the rest
    // of the form is not here: nothing has been answered yet.
    expect(declineRadio()).not.toBeChecked();
    expect(acceptRadio()).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: /Enviar respuesta/ }),
    ).not.toBeInTheDocument();
  });

  it("records an acceptance after reconsidering, and stays on the form", async () => {
    const user = userEvent.setup();
    const action = renderForm({ current: DECLINED });

    await user.click(
      screen.getByRole("button", { name: /Volver a responder/ }),
    );
    await user.click(acceptRadio());
    // Nothing is ticked afterwards: reconsidering opens with the whole
    // household coming, which is the fix this test now stands beside — a
    // decline names nobody, so seeding the boxes from it left them empty.
    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    const formData = action.mock.calls[0][1];

    expect(formData.get("attending")).toBe("yes");
    expect(formData.getAll("attendee")).toEqual(
      GUESTS.map((guest) => guest.id),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "¡Listo! Guardamos su respuesta.",
      ),
    );
    expect(screen.queryByText(CEREMONY.streamUrl)).toBeNull();
  });

  it("returns to the stream when a reconsidered answer is a decline again", async () => {
    // Two identical outcomes in a row. A component that only reacted to a
    // CHANGED result would stall on the form here, showing "¡Listo!" while the
    // household waits for the stream details they were shown a minute ago.
    const user = userEvent.setup();
    const action = renderForm({ current: DECLINED });

    await user.click(
      screen.getByRole("button", { name: /Volver a responder/ }),
    );
    await user.click(declineRadio());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(streamCard()).toBeInTheDocument());
  });
});

/**
 * THE QUESTION IS ASKED ONE STEP AT A TIME, IN THE READER'S OWN NUMBER.
 *
 * The couple, reading the unlocked invitation: two buttons, worded for one
 * person or for several; the list of who is coming only AFTER the affirmative,
 * and never at all when there is only one person to tick.
 *
 * Before this the whole form was on screen at once — the choice, a dimmed list
 * of names, a dietary field and a submit — so a guest invited alone was shown a
 * checkbox asking whether they themselves were attending, under a question
 * addressed to a household they were not part of.
 */
describe("what the form asks, and when", () => {
  const SOLO: readonly RsvpAnswerGuest[] = [GUESTS[0]];

  it("asks a household in the plural", () => {
    renderForm();

    expect(
      screen.getByRole("radio", { name: "Sí, allá estaremos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "No podemos acompañarlos" }),
    ).toBeInTheDocument();
  });

  it("asks one person in the singular", () => {
    renderForm({ guests: SOLO });

    expect(
      screen.getByRole("radio", { name: "Sí, allá estaré" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "No puedo acompañarlos" }),
    ).toBeInTheDocument();
  });

  /**
   * NOTHING BUT THE TWO CHOICES UNTIL ONE IS PICKED.
   *
   * The attendee list used to be rendered `disabled` and dimmed, which the
   * browser honoured and a reader did not: it looked like a control that
   * refused to work. A question that is not theirs yet should not be on the
   * screen yet.
   */
  it("shows nothing else until the question is answered", () => {
    renderForm();

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(
      screen.queryByLabelText(/Restricciones alimentarias/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar respuesta" }),
    ).not.toBeInTheDocument();
  });

  it("opens the rest of the form once a household accepts", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("radio", { name: "Sí, allá estaremos" }),
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(GUESTS.length);
    expect(
      screen.getByRole("button", { name: "Enviar respuesta" }),
    ).toBeInTheDocument();
  });

  /**
   * AND NEVER ASKS ONE PERSON TO TICK THEIR OWN NAME.
   *
   * There is no choice to make: the only person who could attend has just said
   * they are attending. A checkbox here is a question with one answer, and the
   * guest still has to find it and press it before the form will submit.
   */
  it("asks one person only what is left to ask", async () => {
    renderForm({ guests: SOLO });

    await userEvent.click(
      screen.getByRole("radio", { name: "Sí, allá estaré" }),
    );

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText(/Quiénes asisten/i)).not.toBeInTheDocument();
    // What DOES open for one person: the place, and the way to send it.
    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar respuesta" }),
    ).toBeInTheDocument();
  });

  /**
   * THE SEAT IS STILL NAMED IN THE PAYLOAD, WHICH IS NOT OPTIONAL.
   *
   * `seats_confirmed` is derived from the attendee names and must EQUAL their
   * count (migration 0007). A solo invitation that submitted no name would
   * record an accepted answer holding zero seats — a household the couple
   * would cook for nobody.
   */
  it("names the one guest in the payload even though nothing was ticked", async () => {
    const action = renderForm({ guests: SOLO });

    await userEvent.click(
      screen.getByRole("radio", { name: "Sí, allá estaré" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar respuesta" }),
    );

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0]![1];
    expect(formData.getAll("attendee")).toEqual([SOLO[0]!.id]);
  });
});

/**
 * WHERE THE WEDDING IS, AND WHO GETS TOLD.
 *
 * The couple: "el lugar y la dirección deben aparecer solamente cuando al
 * confirmar la asistencia es positiva."
 *
 * They were in the invitation's body, above the form, shown to every household
 * before anybody had been asked anything. A household that cannot come does not
 * need a street — and handing one to everybody before the question is answered
 * buries the question under directions.
 *
 * IT HAD TO MOVE INTO THIS COMPONENT, and that is not an arbitrary home. The
 * answer lives here, in client state; the body is a Server Component and cannot
 * see it. The alternative was lifting the answer out of the form, which would
 * make a page that is mostly static depend on a client boundary.
 */
describe("where the wedding is", () => {
  it("says nothing about the venue before the question is answered", () => {
    renderForm();

    expect(screen.queryByText(VENUE.name)).not.toBeInTheDocument();
    expect(screen.queryByText(VENUE.address)).not.toBeInTheDocument();
  });

  it("gives the household the place once they say they are coming", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
    expect(screen.getByText(VENUE.address)).toBeInTheDocument();
  });

  /**
   * AND A HOUSEHOLD THAT ALREADY ACCEPTED SEES IT ON ARRIVAL.
   *
   * The answer is read from the row on the first render, so somebody coming
   * back to check the address finds it without answering again.
   */
  it("shows it straight away to a household already on file as attending", () => {
    renderForm({
      current: {
        attending: true,
        seatsConfirmed: 1,
        attendeeGuestIds: [GUESTS[0].id],
        dietaryNotes: null,
      },
    });

    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
  });

  /**
   * AND THE MAP IS BEHIND THE SAME GATE, WHICH IS THE REAL RISK IN ADDING IT.
   *
   * The venue HAS NO STREET ADDRESS, so the map is not an illustration beside
   * the address — it is the only thing on this page that says where the wedding
   * is. That makes it exactly as private as the two lines above it, and it
   * arrives as an IMAGE and a LINK rather than as text: the three assertions
   * about `VENUE.name` and `VENUE.address` above cannot see it, so a map
   * rendered outside the `isAttending` branch would leak the location to every
   * household with every existing check still green.
   *
   * Absence is asserted in all three states a household can be in without
   * having accepted — unanswered, declining now, and declined on a previous
   * visit — because they are three different code paths: the branch that
   * renders nothing, the `CeremonyStream` early return, and that same return
   * reached from the server's row on the first render.
   */
  it("offers no directions before the question is answered", () => {
    renderForm();

    expect(mapLink()).toBeNull();
  });

  it("offers no directions to a household that has just declined", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(declineRadio());
    await waitFor(() => expect(streamCard()).toBeInTheDocument());

    expect(mapLink()).toBeNull();
  });

  it("offers no directions to a household whose decline is already on file", () => {
    renderForm({ current: DECLINED });

    expect(mapLink()).toBeNull();
  });

  /**
   * THE COUPLE'S OWN INSTRUCTION FOR WHAT REPLACES PINCHING A PICTURE: "todo lo
   * del zoom etc debe realizarse desde la app, por lo tanto deberia existir un
   * boton de como llegar con las indicaciones ya listas."
   *
   * The exact destination is `VenueMap`'s own spec to assert. What belongs here
   * is that the control reaches the guest at all, and that it is the DIRECTIONS
   * form rather than a place page they would then have to press again.
   */
  it("gives the household the way there once they say they are coming", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    const link = mapLink();

    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toContain("/maps/dir/?api=1");
  });

  /**
   * THE DIETARY FIELD IS GONE, ON THE COUPLE'S OWN INSTRUCTION.
   *
   * "Podríamos quitar lo de restricciones alimentarias." It was the one thing
   * on this form that asked the household to type rather than to choose, and
   * it asked it of everybody who said yes.
   *
   * The COLUMN stays. `rsvp_responses.dietary_notes` is nullable, the payload
   * schema accepts a missing value as null, and dropping a column to remove a
   * field is a migration that buys nothing.
   */
  it("no longer asks anybody to type", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    expect(
      screen.queryByLabelText(/Restricciones alimentarias/),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

/**
 * HOW MANY TAPS IT TAKES TO SAY YES.
 *
 * The couple, watching it on a phone: "al dar click en 'sí voy a asistir' se
 * abre y se pierde la información, toca hacer un scroll… ¿qué propones para que
 * sea lo suficiente para confirmar evitándose un click de más?"
 *
 * The count was worse than the scroll. A household of three had to tap five
 * times — yes, three empty boxes, send — because the boxes started EMPTY. The
 * common case is that everybody named on an invitation comes; starting from
 * nobody made the form ask the household to re-enter what the invitation
 * already says.
 */
describe("how many taps it takes to say yes", () => {
  const SOLO: readonly RsvpAnswerGuest[] = [GUESTS[0]];

  /**
   * ONE PERSON CONFIRMS IN ONE TAP, EXACTLY AS A DECLINE DOES.
   *
   * There is nothing to choose: one person, one seat. The second tap carried no
   * information at all, which is the definition of friction.
   *
   * IT IS SAFE HERE FOR THE REASON THE DECLINE IS SAFE. A mis-tap cannot store
   * a wrong NUMBER — the only person who could attend is attending. A household
   * keeps its explicit send, because there a mis-tap would confirm seats the
   * couple then cook for.
   */
  it("submits on the first tap when the invitation names one person", async () => {
    const action = renderForm({ guests: SOLO });

    await userEvent.click(
      screen.getByRole("radio", { name: "Sí, allá estaré" }),
    );

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0]![1];
    expect(formData.get("attending")).toBe("yes");
    expect(formData.getAll("attendee")).toEqual([SOLO[0]!.id]);
  });

  it("asks a household to send, and does not answer for them", async () => {
    const action = renderForm();

    await userEvent.click(acceptRadio());

    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Enviar respuesta" }),
    ).toBeInTheDocument();
  });

  /**
   * AND THE HOUSEHOLD STARTS WITH EVERYBODY COMING.
   *
   * Unchecking one person is the exception; checking three is what every
   * household was made to do. The invitation already names them, so an empty
   * list asked the household to repeat it.
   */
  it("starts a fresh answer with every member selected", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    /*
      BY NAME, AND THE COUNT PINNED.

      "every checkbox I happened to find is checked" is a weaker claim than it
      reads as: it also passes when only one box rendered, and it says nothing
      about WHICH guests those boxes belong to. The whole point of this default
      is that the household arrives COMPLETE, so the assertion names them.
    */
    expect(screen.getAllByRole("checkbox")).toHaveLength(GUESTS.length);

    for (const guest of GUESTS) {
      expect(
        screen.getByRole("checkbox", { name: guest.fullName }),
      ).toBeChecked();
    }
    expect(screen.getByText("Ya seleccionaron las 3.")).toBeInTheDocument();
  });

  /**
   * BUT AN ANSWER ON FILE IS NOT OVERWRITTEN.
   *
   * A household that already said two of three are coming must find that
   * answer, not a form that quietly re-added the third.
   */
  /**
   * AND A DECLINE NAMES NOBODY, WHICH IS NOT AN ANSWER ABOUT WHO.
   *
   * A recorded decline stores an EMPTY attendee list, by construction — it
   * confirms zero seats. Seeding the form from that list gave a household that
   * declines and then reconsiders an empty set of boxes: the exact friction
   * this default removed, in the one case where somebody is changing their
   * mind, which is when a form should be at its most helpful.
   *
   * The review found it. `?? ` does not fall back for an empty array.
   */
  it("starts from everybody when the answer on file is a decline", async () => {
    renderForm({
      action: actionReturning({ status: "not_authorized" }),
      current: {
        attending: false,
        seatsConfirmed: 0,
        attendeeGuestIds: [],
        dietaryNotes: null,
      },
    });

    // A declined household meets the stream card, not the form: the way back
    // is what this case is actually about.
    await userEvent.click(
      screen.getByRole("button", { name: /Volver a responder/ }),
    );
    await userEvent.click(acceptRadio());

    /*
      BY NAME, AND THE COUNT PINNED.

      "every checkbox I happened to find is checked" is a weaker claim than it
      reads as: it also passes when only one box rendered, and it says nothing
      about WHICH guests those boxes belong to. The whole point of this default
      is that the household arrives COMPLETE, so the assertion names them.
    */
    expect(screen.getAllByRole("checkbox")).toHaveLength(GUESTS.length);

    for (const guest of GUESTS) {
      expect(
        screen.getByRole("checkbox", { name: guest.fullName }),
      ).toBeChecked();
    }
  });

  it("keeps the answer already on file rather than selecting everybody", () => {
    renderForm({
      current: {
        attending: true,
        seatsConfirmed: 1,
        attendeeGuestIds: [GUESTS[0].id],
        dietaryNotes: null,
      },
    });

    expect(
      screen.getByRole("checkbox", { name: GUESTS[0].fullName }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: GUESTS[1].fullName }),
    ).not.toBeChecked();
  });

  /**
   * AND WHAT OPENS IS BROUGHT INTO VIEW.
   *
   * On a phone the revealed block lands below the fold, so the household taps
   * yes and the screen appears not to change. Asserted against a stub because
   * jsdom has no layout and no scrolling — what is being checked is that the
   * component ASKS, which is the part a browser cannot be relied on to do by
   * itself.
   */
  it("brings what it opened into view", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderForm();
    await userEvent.click(acceptRadio());

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  /**
   * AND DOES NOT MOVE THE PAGE FOR SOMEBODY WHO JUST ARRIVED.
   *
   * `attending` is read from the row on the first render, so a household that
   * already accepted mounts with the block ALREADY open. An effect keyed on
   * that value alone fires on mount and smooth-scrolls the page under somebody
   * who has done nothing but reopen their invitation.
   *
   * The test above cannot tell the two apart: it clicks first, so a scroll on
   * load satisfies it just as well as a scroll on answering. The review found
   * this, and this is the assertion it was missing.
   */
  it("does not move the page for a household that merely reopens it", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderForm({
      current: {
        attending: true,
        seatsConfirmed: 1,
        attendeeGuestIds: [GUESTS[0].id],
        dietaryNotes: null,
      },
    });

    // The block IS open — this is not a test about it being closed.
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  /**
   * AND STILL SCROLLS WHEN THAT SAME HOUSEHOLD CHANGES ITS MIND AND COMES BACK.
   *
   * A guard that simply remembered "we already mounted as yes" would also
   * silence the scroll for a household that declines and then accepts again in
   * the same visit, which is a real answer given in front of us.
   */
  it("scrolls again when an answer changes back to yes", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderForm({
      action: actionReturning({ status: "not_authorized" }),
      current: {
        attending: true,
        seatsConfirmed: 1,
        attendeeGuestIds: [GUESTS[0].id],
        dietaryNotes: null,
      },
    });

    await userEvent.click(declineRadio());
    expect(scrollIntoView).not.toHaveBeenCalled();

    await userEvent.click(acceptRadio());

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });
});
