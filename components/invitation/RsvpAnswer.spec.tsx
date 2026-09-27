import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  rsvpDeadlineSentence,
  type RsvpFeedback,
} from "@/lib/domain/rsvp-copy";
import { WEDDING_DRESS_CODE } from "@/lib/domain/wedding-day";

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

/**
 * Where the wedding happens, which only an attending household is told.
 *
 * NO STREET, AND THAT IS THE PROP TYPE RATHER THAN THE FIXTURE. The venue has
 * no address anybody can type into a maps application — `VenueMap` opens with
 * that fact — so `RsvpConfirmed` names the place and shows the map, and the
 * `Dirección` line that used to sit between them is gone.
 */
const VENUE = {
  name: "Hacienda La Ñapa",
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
    greetingName?: string;
    current?: RsvpAnswerCurrent | null;
    ceremony?: CeremonyStreamDetails;
    announcement?: React.ReactNode;
  } = {},
) {
  const action = options.action ?? actionReturning({ status: "recorded" });

  render(
    <RsvpAnswer
      action={action}
      announcement={options.announcement ?? <p>{ANNOUNCEMENT}</p>}
      guests={options.guests ?? GUESTS}
      greetingName={options.greetingName ?? GREETING_NAME}
      current={options.current ?? null}
      ceremony={options.ceremony ?? CEREMONY}
      venue={VENUE}
    />,
  );

  return action;
}

/**
 * How this household is addressed, which is the top line of every screen.
 *
 * Deliberately NOT one of the guests' names and not a list of them: the
 * greeting names the household, the checkboxes name its members, and a
 * fixture where the two collide would let an assertion about one pass on the
 * other.
 */
const GREETING_NAME = "Familia Aguirre";

/**
 * A stand-in for the block the route actually passes.
 *
 * The real one is `InvitationAnnouncement` — a Server Component tree with a
 * live countdown in it. What this component owns is not its content but WHICH
 * SCREEN it appears on, so the fixture is a sentence that is easy to look for.
 */
const ANNOUNCEMENT = "Nos casamos, Ana y Bruno";

/** The way back from a recorded answer, on either ending. */
function reconsiderButton() {
  return screen.getByRole("button", { name: /Volver a responder/ });
}

/** The way back from the who-is-coming screen, where nothing is recorded yet. */
function backToQuestion() {
  return screen.getByRole("button", { name: /Volver a la pregunta/ });
}

/** The last screen: where to go, when, and what to wear. */
function confirmedScreen(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".rsvp__confirmed");
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

  /**
   * A RECORDED ANSWER IS A NEW SCREEN, NOT A SENTENCE UNDER THE FORM.
   *
   * "¡Listo! Guardamos su respuesta." used to appear below the controls the
   * household had just used, which was the only acknowledgement there was.
   * Those controls are replaced now by the screen that says where to go, and
   * that screen says the answer was saved in its own words.
   *
   * The alert region still exists and still carries REFUSALS — see the test
   * below — because a refusal leaves the household exactly where they were.
   */
  it("hands over to the screen that says where to go", async () => {
    const user = userEvent.setup();
    renderForm({ action: actionReturning({ status: "recorded" }) });

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(
      screen.getByText("Su respuesta quedó guardada."),
    ).toBeInTheDocument();
  });

  /**
   * AND THE REGION THAT CARRIES A REFUSAL IS THERE BEFORE THERE IS ONE.
   *
   * An alert that mounts on submit adds height with no warning — 82 pixels,
   * measured — on a screen whose whole promise is that it is exactly one
   * viewport tall. The slot is in the document from the first paint, holding
   * nothing.
   */
  it("holds the space a refusal will need before there is one", () => {
    renderForm();

    const alert = screen.getByRole("alert");

    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toBe("");
    expect(alert.className).toContain("min-h-10");
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

  /**
   * AN ACCEPTED HOUSEHOLD LANDS ON THE DIRECTIONS, NOT ON THE FORM.
   *
   * They answered. What somebody reopening their invitation wants is where to
   * go and at what hour — the question is settled, and re-offering it is how a
   * household ends up answering twice and wondering which one counted. The way
   * back is on that screen, beside the consequence, exactly as it is for a
   * decline.
   */
  it("shows a household that already accepted the directions, not the form", () => {
    renderForm({ current: CURRENT });

    expect(confirmedScreen()).not.toBeNull();
    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /allá estaremos/ })).toBeNull();
  });

  it("tells the household what they answered last time", async () => {
    renderForm({ current: CURRENT });

    await userEvent.click(reconsiderButton());

    expect(
      screen.getByText("Tu respuesta actual: asisten 2 personas."),
    ).toBeInTheDocument();
  });

  it("shows nothing of the sort when they have never answered", () => {
    renderForm({ current: null });

    expect(screen.queryByText(/Tu respuesta actual/)).toBeNull();
  });

  it("pre-fills the form so changing one thing does not retype everything", async () => {
    const user = userEvent.setup();
    renderForm({ current: CURRENT });

    // Through the way back, because an accepted answer opens on the
    // directions. Nothing is preselected there on purpose — see
    // `reconsider` — so the affirmative is chosen again to reach the list.
    await user.click(reconsiderButton());
    await user.click(acceptRadio());

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

    await user.click(reconsiderButton());
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
    // Back through the question, which is the only way to reach "no" now that
    // the two screens are separate — and the path a mis-tapping household
    // takes.
    await user.click(backToQuestion());
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

  it("records an acceptance after reconsidering, and leaves the stream behind", async () => {
    const user = userEvent.setup();
    const action = renderForm({ current: DECLINED });

    await user.click(reconsiderButton());
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
    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
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
    // There is nothing left to ask, so the tap IS the answer and the next
    // thing on screen is where to go.
    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
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

    // One tap is the whole answer for a solo invitation, so there is no send
    // button to press afterwards — see "submits on the first tap when the
    // invitation names one person".
    await userEvent.click(
      screen.getByRole("radio", { name: "Sí, allá estaré" }),
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
  });

  /**
   * AND NOTHING WHILE THEY ARE STILL CHOOSING WHO IS COMING.
   *
   * The venue and the map used to open the instant the affirmative was
   * chosen, ABOVE the checkboxes that still had to be ticked — which pushed
   * the send button 322 pixels down the page and is why this component once
   * needed a `scrollIntoView`. The answer is not on file until it is sent, and
   * directions before that are directions to a household the couple are not
   * expecting yet.
   */
  it("says nothing about the venue while they are still choosing who comes", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    expect(attendeeBoxes()).toHaveLength(GUESTS.length);
    expect(screen.queryByText(VENUE.name)).not.toBeInTheDocument();
    expect(mapLink()).toBeNull();
  });

  it("gives the household the place once the acceptance is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(screen.getByText(VENUE.name)).toBeVisible());
  });

  /**
   * AND THE HOUR, AND WHAT TO WEAR — the two facts this screen exists to add.
   *
   * The hour had never reached a guest before: `WEDDING_INSTANT` fed the
   * countdown and migration 0018 dropped the column a household would have
   * read. The dress code did not exist at all.
   */
  it("states the hour and the dress code once the acceptance is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(confirmedScreen()!.textContent).toContain("5:00 p. m.");
    expect(confirmedScreen()!.textContent).toContain(WEDDING_DRESS_CODE);
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
  it("gives the household the way there once the acceptance is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(mapLink()).not.toBeNull());

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
 * THE LINE AT THE TOP OF THE SCREEN, WHICH IS NOT THE SAME LINE ON ALL FOUR.
 *
 * The couple, on the accepted screen: "en la parte de arriba en vez de decir:
 * hola, nombre de la invitación debería ser para la invitación individual Te
 * esperamos nombre de la invitación y si la invitación es 2 personas o más
 * debería decir: Los esperamos nombre de la invitación."
 *
 * IN VEZ DE — instead of, not underneath. Which is why this component paints
 * it at all: the greeting used to belong to `InvitationBody`, a Server
 * Component that cannot see which step is showing, so a screen that opens
 * differently was not something it could express.
 */
describe("the line at the top of each screen", () => {
  function heading(): string {
    return document.querySelector(".invitation__greeting")!.textContent ?? "";
  }

  it("greets the household while there is still a question on screen", () => {
    renderForm();

    expect(heading()).toBe("¡Hola, Familia Aguirre!");
  });

  it("still greets them while they choose who is coming", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    expect(heading()).toBe("¡Hola, Familia Aguirre!");
  });

  it("says they are expected once the acceptance is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(heading()).toBe("Los esperamos, Familia Aguirre");
    // And the greeting it replaced is not still standing above it.
    expect(screen.queryByText(/¡Hola,/)).not.toBeInTheDocument();
  });

  it("says it in the singular to an invitation that names one person", async () => {
    const [only] = GUESTS;
    renderForm({ guests: [only], greetingName: only.fullName });

    // A solo invitation records its acceptance on the first tap.
    await userEvent.click(
      screen.getByRole("radio", { name: /Sí, allá estaré/ }),
    );

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(heading()).toBe(`Te esperamos, ${only.fullName}`);
  });

  /**
   * THE PLURAL KEYS OFF THE INVITATION, NOT OFF THE ANSWER, AND THIS IS THE
   * ONLY PLACE THE TWO CAN DIFFER.
   *
   * "Si la invitación es 2 personas o más" — the couple's own rule, read
   * literally. A household of three of whom one can come is still addressed
   * as the three people the couple invited; a line that dropped to "te
   * esperamos" because two boxes came unticked would read as the couple
   * striking people off a list at the moment those people had just been
   * apologised for.
   */
  it("addresses the whole invitation even when one person is coming", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());

    const boxes = attendeeBoxes();
    for (const box of boxes.slice(1)) {
      await user.click(box);
    }

    expect(
      boxes.filter((box) => (box as HTMLInputElement).checked),
    ).toHaveLength(1);

    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(heading()).toBe("Los esperamos, Familia Aguirre");
  });

  it("greets a household that cannot come, rather than expecting them", async () => {
    renderForm();

    await userEvent.click(declineRadio());
    await waitFor(() => expect(streamCard()).toBeInTheDocument());

    expect(heading()).toBe("¡Hola, Familia Aguirre!");
  });

  /**
   * ONE ELEMENT, NEVER TWO WITH ONE OF THEM HIDDEN.
   *
   * The alternative considered was leaving the body's greeting in place and
   * hiding it with CSS on this step. A name printed twice is a name read out
   * twice by anything that does not honour the stylesheet, and the guard is
   * cheap: there is exactly one of these on the page, always.
   */
  it("paints exactly one of them, on every screen", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(document.querySelectorAll(".invitation__greeting")).toHaveLength(1);

    await user.click(acceptRadio());
    expect(document.querySelectorAll(".invitation__greeting")).toHaveLength(1);

    await user.click(submitButton());
    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(document.querySelectorAll(".invitation__greeting")).toHaveLength(1);
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

  it("keeps the answer already on file rather than selecting everybody", async () => {
    const user = userEvent.setup();
    renderForm({
      current: {
        attending: true,
        seatsConfirmed: 1,
        attendeeGuestIds: [GUESTS[0].id],
        dietaryNotes: null,
      },
    });

    await user.click(reconsiderButton());
    await user.click(acceptRadio());

    expect(
      screen.getByRole("checkbox", { name: GUESTS[0].fullName }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: GUESTS[1].fullName }),
    ).not.toBeChecked();
  });

  /**
   * NOTHING SCROLLS ANY MORE, AND THREE TESTS WENT WITH THE CODE THAT DID.
   *
   * They asserted that answering "yes" called `scrollIntoView`, that merely
   * reopening an accepted invitation did not, and that changing one's mind
   * scrolled again. All three were right about a page that opened a block
   * below the fold — "se abre y se pierde la información, toca hacer un
   * scroll", which is what the couple saw.
   *
   * Choosing an answer REPLACES the screen now. There is nothing below the
   * fold to bring into view, and a page that is exactly one viewport tall
   * cannot be scrolled to anything. Kept as one assertion rather than three,
   * because "the component asks the browser to move the page" is now a defect
   * rather than a feature — and it is the kind that comes back the next time
   * somebody adds a block to a screen.
   */
  it("never asks the browser to move the page", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderForm();

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

/**
 * ONE SCREEN AT A TIME, WHICH IS THE WHOLE OF THIS UNIT.
 *
 * The invitation used to be one document: the announcement, the household's
 * names, the question, the venue, the map, the checkboxes, the send button and
 * a deadline footnote, stacked. 1663 pixels on an iPhone 14 against 664 of
 * screen. Close to every guest opens this from a WhatsApp message on a phone,
 * so everything past the first 664 pixels was content most households never
 * saw — including the deadline.
 *
 * What each screen carries is therefore a property worth asserting directly,
 * because "it still renders somewhere in the document" is exactly the check
 * that let the page grow to two and a half viewports in the first place.
 */
describe("what each screen carries, and what it refuses to", () => {
  it("opens with the announcement and the question", () => {
    renderForm();

    expect(screen.getByText(ANNOUNCEMENT)).toBeInTheDocument();
    expect(acceptRadio()).toBeInTheDocument();
    expect(declineRadio()).toBeInTheDocument();
  });

  /**
   * THE DEADLINE IS PART OF THE QUESTION NOW.
   *
   * It was the last line of the third screenful, `text-xs` at 70% opacity. The
   * couple asked for it where the decision is made.
   */
  it("says how long they have to answer, beside the question", () => {
    renderForm();

    expect(
      screen.getByText(rsvpDeadlineSentence(GUESTS.length)),
    ).toBeInTheDocument();
  });

  it("asks one guest for their own deadline, in the singular", () => {
    renderForm({ guests: [GUESTS[0]] });

    expect(screen.getByText(rsvpDeadlineSentence(1))).toBeInTheDocument();
  });

  /**
   * AND THE ANNOUNCEMENT IS NOT REPEATED ON THE SCREENS AFTER IT.
   *
   * It is 250 pixels of a 664-pixel screen. The gate makes it, the question
   * screen makes it again because the couple asked for the two to match, and a
   * household choosing who is coming has now read it twice.
   */
  it("does not repeat the announcement while they choose who is coming", async () => {
    renderForm();

    await userEvent.click(acceptRadio());

    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
    expect(attendeeBoxes()).toHaveLength(GUESTS.length);
  });

  it("does not repeat the announcement on the directions", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
  });

  it("does not repeat the announcement on the stream", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(declineRadio());

    await waitFor(() => expect(streamCard()).toBeInTheDocument());
    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
  });

  /**
   * THE QUESTION IS NOT ON THE SCREEN THAT ASKS WHO IS COMING, SO THE ANSWER
   * HAS TO TRAVEL AS A HIDDEN FIELD.
   *
   * An unmounted radio contributes nothing to a payload. Without this the
   * server would receive a submission with no `attending` at all — and the
   * schema would refuse it, which is the good outcome; the bad one is a
   * default somewhere deciding it meant "no".
   */
  it("still says yes in the payload once the radios are off screen", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(acceptRadio());
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("attending")).toBe("yes");
  });

  /**
   * AND A MIS-TAP ON "YES" HAS A WAY BACK.
   *
   * The radio group used to stay on screen above the checkboxes, so changing
   * a wrong "yes" into "no" was one tap. With the two screens separated that
   * escape disappeared, and a household with no way back would have to close
   * the invitation and open it again.
   */
  it("lets a household that tapped yes by mistake go back to the question", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptRadio());
    await user.click(backToQuestion());

    expect(acceptRadio()).not.toBeChecked();
    expect(declineRadio()).not.toBeChecked();
    expect(screen.getByText(ANNOUNCEMENT)).toBeInTheDocument();
  });

  /**
   * A FIVE-PERSON HOUSEHOLD IS THE SIZE THAT DECIDES WHETHER THIS FITS.
   *
   * Each extra member is about 54 pixels of checkbox. The screen that asks who
   * is coming is therefore the one that grows with the household, and it is the
   * reason the announcement and the deadline are not on it.
   * `e2e/invitation-one-screen.spec.ts` measures the real thing; this asserts
   * the shape it depends on.
   */
  it("gives a household of five nothing but the list and the send button", async () => {
    const five: readonly RsvpAnswerGuest[] = [
      ...GUESTS,
      { id: "dddddddd-4444-4444-8444-444444444444", fullName: "Tomás Aguirre" },
      {
        id: "eeeeeeee-5555-4555-8555-555555555555",
        fullName: "Emilia Aguirre",
      },
    ];
    renderForm({ guests: five });

    await userEvent.click(acceptRadio());

    expect(attendeeBoxes()).toHaveLength(5);
    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
    expect(screen.queryByText(rsvpDeadlineSentence(5))).not.toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });
});
