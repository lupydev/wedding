import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  invitationSizeSentence,
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
  coupleNames: "Luis & Michell",
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
    attendeesAnnouncement?: React.ReactNode;
  } = {},
) {
  const action = options.action ?? actionReturning({ status: "recorded" });

  render(
    <RsvpAnswer
      action={action}
      announcement={options.announcement ?? <p>{ANNOUNCEMENT}</p>}
      attendeesAnnouncement={options.attendeesAnnouncement}
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

/**
 * And the SHORTER one, which only the screen that asks who is coming may show.
 *
 * The route builds two blocks and hands both down, because which screen is
 * showing is state only this component holds. A distinct sentence rather than
 * a subset of the first, so an assertion cannot pass by finding the wrong
 * block: the couple's instruction is that the question screen keeps the
 * counter and only the list loses it.
 */
const SHORT_ANNOUNCEMENT = "Nos casamos, Ana y Bruno — sin reloj";

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

/**
 * THE TWO ANSWERS, WHICH ARE BUTTONS AND WERE A RADIO GROUP.
 *
 * "Deberían ser como dos botones" — the couple. A radio describes a selection
 * that a later submit will send, and that stopped being true a long time
 * before it was changed: pressing either answer here ACTS. The negative
 * records a decline on the spot, the affirmative opens the list of who is
 * coming, and for an invitation that names one person it records the
 * acceptance too.
 *
 * The queries are by ROLE, so the swap is not a rename: a radio that came
 * back wearing a button's label would not satisfy `getByRole("button")`.
 */
function declineButton() {
  return screen.getByRole("button", { name: /No podemos acompañarlos/ });
}

function acceptButton() {
  return screen.getByRole("button", { name: /Sí, acepto/ });
}

/** What the form is carrying as the household's answer, if anything. */
function answerInPayload(container: HTMLElement): string | null {
  return (
    container.querySelector("input[name='attending']")?.getAttribute("value") ??
    null
  );
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

/**
 * The same render, handing back the container for the structural assertions.
 *
 * Those are about which elements sit INSIDE the card and which sit on the
 * bare photograph, which is a containment question rather than a
 * role-and-name one — `screen` cannot answer it.
 */
function renderWithContainer() {
  return render(
    <RsvpAnswer
      action={actionReturning({ status: "recorded" })}
      announcement={<p>{ANNOUNCEMENT}</p>}
      guests={GUESTS}
      greetingName={GREETING_NAME}
      current={null}
      ceremony={CEREMONY}
      venue={VENUE}
    />,
  );
}

describe("RsvpAnswer attendance choice", () => {
  it("asks the yes/no question before anything else", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: /Sí, acepto/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /No podemos acompañarlos/ }),
    ).toBeInTheDocument();
  });

  /**
   * AND IT OFFERS THEM AS BUTTONS, WHICH RETIRES A DEFECT THIS PROJECT HAD
   * WRITTEN DOWN RATHER THAN FIXED.
   *
   * U28, in as many words: "Both radios answer on `change`, so a keyboard
   * user arrowing through the group passes over the first option and answers
   * it. That shape predates this work — the decline has always had it — and
   * it is recoverable from either side."
   *
   * It was true, and it was worse than recoverable-from-either-side makes it
   * sound: arrowing onto the refusal RECORDED a decline, because a decline
   * submits on the first answer. A keyboard user exploring the group answered
   * for the household.
   *
   * A button has no such behaviour. Tab moves focus, arrow keys do nothing at
   * all, and nothing is answered until Enter or Space. This is the
   * measurement that closes U28 rather than a promise that it is gone: the
   * test walks the whole group with a keyboard and then asserts that the
   * household has answered nothing.
   */
  it("answers nothing when a keyboard walks through the two answers", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.tab();
    expect(acceptButton()).toHaveFocus();

    // The four keys a radio group would have consumed, one of which would
    // have moved the selection — and, here, sent it.
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowRight}{ArrowLeft}");
    await user.tab();
    expect(declineButton()).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowUp}");

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByTestId("stream-details")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Enviar respuesta" }),
    ).not.toBeInTheDocument();
    // And the group a guest could arrow through is gone from the document,
    // not merely re-labelled.
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("answers only when one of the two buttons is pressed", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.tab();
    await user.keyboard("{Enter}");

    // The affirmative for a household opens the list rather than submitting,
    // so what proves the key landed is the screen it opened.
    expect(action).not.toHaveBeenCalled();
    expect(attendeeBoxes()).toHaveLength(GUESTS.length);
  });

  it("offers one checkbox per named guest, and nothing more", async () => {
    renderForm();
    // The list opens only on the affirmative now, so every assertion about it
    // starts by answering the question it belongs to.
    await userEvent.click(acceptButton());

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
    await userEvent.click(acceptButton());

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

    await user.click(acceptButton());

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
    await user.click(screen.getByRole("button", { name: /Sí, acepto/ }));

    // Nothing is clicked: a fresh answer opens with everybody already coming,
    // which is the state this test is about — every member on the list, every
    // box live, and no sixth choice to refuse.

    const checked = attendeeBoxes().filter(
      (box) => (box as HTMLInputElement).checked,
    );
    const selectable = attendeeBoxes().filter(
      (box) => !(box as HTMLInputElement).disabled,
    );

    expect(attendeeBoxes()).toHaveLength(5);
    expect(checked).toHaveLength(5);
    expect(selectable).toHaveLength(5);
  });

  /**
   * AND IT COUNTS NOTHING OUT LOUD, WHICH THE COUPLE ASKED FOR.
   *
   * "Ya seleccionaron las 2." stood under the heading, from
   * `seatsSelectionSentence`. It was there to explain the moment the
   * remaining boxes freeze — and since migration 0012 made the cap the
   * MEMBERSHIP there is no such moment: every box is a member, they all
   * start ticked, and unticking one always leaves room. The couple deleted
   * the line; the domain function went with it.
   */
  it("counts nothing out loud above the list", async () => {
    const user = userEvent.setup();
    renderForm({ guests: [GUESTS[0], GUESTS[1]] });

    await user.click(acceptButton());

    expect(screen.queryByText(/Ya seleccionaron/)).toBeNull();
    expect(screen.queryByText(/Puedes seleccionar/)).toBeNull();
    // What replaced it is nothing: the heading and the names, and both boxes
    // still live.
    for (const box of attendeeBoxes()) {
      expect(box).toBeEnabled();
    }
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

    await user.click(screen.getByRole("button", { name: /Sí, acepto/ }));
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

    await user.click(acceptButton());
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
   * A RECORDED ANSWER IS A NEW SCREEN, AND NOW THAT IS ALL IT IS.
   *
   * "¡Listo! Guardamos su respuesta." used to appear below the controls the
   * household had just used, which was the only acknowledgement there was.
   * Those controls are replaced by the screen that says where to go, and that
   * screen used to repeat the receipt in its own words — "Su respuesta quedó
   * guardada." U36 kept that line against the couple's list; they have now
   * removed it, so what tells a household the answer landed is the line that
   * names them and the directions under it.
   *
   * The alert region still exists and still carries REFUSALS — see the test
   * below — because a refusal leaves the household exactly where they were.
   */
  it("hands over to the screen that says where to go", async () => {
    const user = userEvent.setup();
    renderForm({ action: actionReturning({ status: "recorded" }) });

    await user.click(acceptButton());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
    expect(screen.queryByText(/quedó guardada/)).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Sí, acepto/ }));
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
   * household ends up answering twice and wondering which one counted.
   */
  it("shows a household that already accepted the directions, not the form", () => {
    renderForm({ current: CURRENT });

    expect(confirmedScreen()).not.toBeNull();
    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sí, acepto/ })).toBeNull();
  });

  /**
   * AND THERE IS NO WAY BACK FROM IT, WHICH IS THE COUPLE'S OWN DECISION AND
   * THE HEAVIEST CONSEQUENCE IN THIS PASS.
   *
   * The accepted screen used to carry "Volver a responder", the same escape
   * the stream screen offers. It is gone, so an accepted answer cannot be
   * changed from inside the invitation at all: a household that ticks three
   * people and then loses one is back to the WhatsApp thread.
   *
   * FOUR TESTS STOOD WHERE THIS ONE DOES, and all four reached the form
   * through that button: the sentence naming the current answer, the boxes
   * pre-filled from it, turning a yes into a no, and keeping an answer on
   * file rather than re-selecting everybody. None of those paths exists any
   * more. The COMPONENT still seeds `selected` from an accepted answer and
   * `currentRsvpSentence` still has its attending branch — kept rather than
   * deleted, because what made them unreachable is one button the couple may
   * put back, and the seeding is what stops a re-offered form quietly
   * re-adding somebody. Unreachable is recorded here rather than tested as if
   * it were live.
   */
  it("offers a household that already accepted no way back to the question", () => {
    renderForm({ current: CURRENT });

    expect(
      screen.queryByRole("button", { name: /Volver a responder/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Tu respuesta actual/)).toBeNull();
  });

  /**
   * THE SENTENCE NAMING THE CURRENT ANSWER SURVIVES ON THE OTHER ENDING.
   *
   * A decline still has its way back, so a household that changes its mind
   * still meets the question with a line above it saying where they stand.
   */
  it("tells a household that declined what they answered last time", async () => {
    renderForm({ current: DECLINED });

    await userEvent.click(reconsiderButton());

    expect(
      screen.getByText("Tu respuesta actual: no pueden acompañarnos."),
    ).toBeInTheDocument();
  });

  it("shows nothing of the sort when they have never answered", () => {
    renderForm({ current: null });

    expect(screen.queryByText(/Tu respuesta actual/)).toBeNull();
  });

  it("shows a household that already declined the stream, not the form", () => {
    // They answered. Re-offering the form as though nothing had happened is
    // how a household ends up answering twice and wondering which one counted.
    renderForm({ current: DECLINED });

    expect(streamCard()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sí, acepto/ })).toBeNull();
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

    await user.click(declineButton());

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

    await user.click(acceptButton());
    await user.click(screen.getByRole("checkbox", { name: "Camila Aguirre" }));
    await user.click(screen.getByRole("checkbox", { name: "Rodrigo Aguirre" }));
    // Back through the question, which is the only way to reach "no" now that
    // the two screens are separate — and the path a mis-tapping household
    // takes.
    await user.click(backToQuestion());
    await user.click(declineButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    expect(action.mock.calls[0][1].get("attending")).toBe("no");
    expect(action.mock.calls[0][1].getAll("attendee")).toEqual([]);
  });

  it("replaces the form with the ceremony stream once the answer is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(declineButton());

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

    await user.click(declineButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Tu sesión ya no está activa.",
      ),
    );
    expect(screen.queryByText(CEREMONY.streamUrl)).toBeNull();
    // The QUESTION is what must still be here. The submit button belongs to
    // the affirmative branch, and this household has just said no.
    expect(acceptButton()).toBeInTheDocument();
    expect(declineButton()).toBeInTheDocument();
  });

  it("hands the form back holding no answer when they reconsider", async () => {
    // Nothing carried over on purpose: a mis-tap must not be one more tap away
    // from repeating itself, and re-choosing "no" has to be a real choice that
    // fires the auto-submit again.
    //
    // A radio used to show that as an unchecked dot. With two buttons there is
    // nothing to be checked, so what is asserted is the thing that actually
    // mattered underneath it: the form is carrying no answer at all, and the
    // household is back on the question.
    const user = userEvent.setup();
    const { container } = render(
      <RsvpAnswer
        action={actionReturning({ status: "recorded" })}
        announcement={<p>{ANNOUNCEMENT}</p>}
        guests={GUESTS}
        greetingName={GREETING_NAME}
        current={DECLINED}
        ceremony={CEREMONY}
        venue={VENUE}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Volver a responder/ }),
    );

    expect(answerInPayload(container)).toBeNull();
    expect(declineButton()).toBeInTheDocument();
    expect(acceptButton()).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Enviar respuesta/ }),
    ).not.toBeInTheDocument();
  });

  it("records an acceptance after reconsidering, and leaves the stream behind", async () => {
    const user = userEvent.setup();
    const action = renderForm({ current: DECLINED });

    await user.click(reconsiderButton());
    await user.click(acceptButton());
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
    await user.click(declineButton());

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
      screen.getByRole("button", { name: "¡Sí, acepto!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No podemos acompañarlos" }),
    ).toBeInTheDocument();
  });

  it("asks one person in the singular", () => {
    renderForm({ guests: SOLO });

    expect(
      screen.getByRole("button", { name: "¡Sí, acepto!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No puedo acompañarlos" }),
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

    await userEvent.click(screen.getByRole("button", { name: "¡Sí, acepto!" }));

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

    await userEvent.click(screen.getByRole("button", { name: "¡Sí, acepto!" }));

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText(/Quiénes asisten/i)).not.toBeInTheDocument();
    // There is nothing left to ask, so the tap IS the answer and the next
    // thing on screen is where to go.
    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(screen.getByText(VENUE.name)).toBeInTheDocument();
  });

  /**
   * AND IT NEVER PASSES THROUGH THE SCREEN THAT ASKS WHO IS COMING — NOT EVEN
   * FOR THE LENGTH OF THE REQUEST.
   *
   * "Para la invitación de una persona el paso de quiénes asisten no existe."
   * It already took no second tap: `acceptNow` submits from an effect. But
   * the step still RENDERED while the Server Action was in flight, with a
   * card holding one hidden field, a send button pressing itself, and a way
   * back — a flash of a screen that exists for a choice this household does
   * not have, for as long as the round trip took.
   *
   * AGAINST AN ACTION THAT NEVER SETTLES, which is the only way to observe
   * the in-flight state at all. A fake action that resolves immediately is
   * already past it by the time `userEvent.click` returns, so this test would
   * have been green against the behaviour it exists to catch. Holding the
   * promise open freezes the screen exactly where a real round trip does.
   */
  it("never shows one person a send button while the answer is in flight", async () => {
    // Held open, then released: the component stays wherever the tap left it
    // for as long as the "server" takes, which is the frame this test is
    // about. Releasing it at the end matters — an action left unsettled keeps
    // React's transition open and every test after this one in the file
    // stops seeing its own updates.
    let record!: (feedback: RsvpFeedback) => void;
    const action = vi.fn<RsvpAnswerAction>(
      () =>
        new Promise<RsvpFeedback>((resolve) => {
          record = resolve;
        }),
    );
    renderForm({ guests: SOLO, action });

    await userEvent.click(screen.getByRole("button", { name: "¡Sí, acepto!" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    // The answer is not recorded, so the screen has not moved on.
    expect(confirmedScreen()).toBeNull();
    // And what it is showing is the question, not a card with a send button
    // pressing itself.
    expect(
      screen.queryByRole("button", { name: "Enviar respuesta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Volver a la pregunta/ }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector("[data-rsvp-step='question']"),
    ).not.toBeNull();

    await act(async () => {
      record({ status: "recorded" });
    });

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
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
    await userEvent.click(screen.getByRole("button", { name: "¡Sí, acepto!" }));

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

    await userEvent.click(acceptButton());

    expect(attendeeBoxes()).toHaveLength(GUESTS.length);
    expect(screen.queryByText(VENUE.name)).not.toBeInTheDocument();
    expect(mapLink()).toBeNull();
  });

  it("gives the household the place once the acceptance is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptButton());
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

    await user.click(acceptButton());
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

    await user.click(declineButton());
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

    await user.click(acceptButton());
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

    await userEvent.click(acceptButton());

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

    await userEvent.click(acceptButton());

    expect(heading()).toBe("¡Hola, Familia Aguirre!");
  });

  it("says they are expected once the acceptance is recorded", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptButton());
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
    await userEvent.click(screen.getByRole("button", { name: /Sí, acepto/ }));

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

    await user.click(acceptButton());

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

  /**
   * AND THE OTHER ENDING SAYS THE OTHER HALF OF THE SAME SENTENCE.
   *
   * This asserted "¡Hola, Familia Aguirre!" — the declined screen kept the
   * greeting and put "Los esperamos por Google Meet" under it as a second
   * heading. The couple replaced both with the pair to the accepted line:
   * "Los vamos a extrañar, {name}", in the singular for an invitation that
   * names one person, in the same place, with the same vocative comma and no
   * exclamation mark.
   */
  it("says it will miss a household that cannot come", async () => {
    renderForm();

    await userEvent.click(declineButton());
    await waitFor(() => expect(streamCard()).toBeInTheDocument());

    expect(heading()).toBe("Los vamos a extrañar, Familia Aguirre");
    // And the heading it replaced is not still standing above or below it.
    expect(screen.queryByText(/¡Hola,/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Los esperamos por Google Meet/),
    ).not.toBeInTheDocument();
  });

  it("misses one person in the singular", async () => {
    const [only] = GUESTS;
    renderForm({ guests: [only], greetingName: only.fullName });

    // A solo invitation refuses in its own number too.
    await userEvent.click(
      screen.getByRole("button", { name: "No puedo acompañarlos" }),
    );
    await waitFor(() => expect(streamCard()).toBeInTheDocument());

    expect(heading()).toBe(`Te vamos a extrañar, ${only.fullName}`);
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

    await user.click(acceptButton());
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

    await userEvent.click(screen.getByRole("button", { name: "¡Sí, acepto!" }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0]![1];
    expect(formData.get("attending")).toBe("yes");
    expect(formData.getAll("attendee")).toEqual([SOLO[0]!.id]);
  });

  it("asks a household to send, and does not answer for them", async () => {
    const action = renderForm();

    await userEvent.click(acceptButton());

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

    await userEvent.click(acceptButton());

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
    await userEvent.click(acceptButton());

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

  /*
    "KEEPS THE ANSWER ALREADY ON FILE RATHER THAN SELECTING EVERYBODY" STOOD
    HERE, AND IT REACHED THE FORM THROUGH A BUTTON THAT NO LONGER EXISTS.

    An accepted household lands on the directions and the couple have removed
    the way back from that screen, so there is no longer any path from an
    accepted answer to the list of who is coming. The seeding it asserted is
    still in `RsvpAnswer` — see the note beside "offers a household that
    already accepted no way back to the question" — but a test that has to
    reach it through a control the product does not offer is a test about
    nothing a guest can do.

    The other half of the behaviour is still live and still asserted below:
    a DECLINED household that reconsiders starts with everybody coming.
  */

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

    await user.click(acceptButton());
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
    expect(acceptButton()).toBeInTheDocument();
    expect(declineButton()).toBeInTheDocument();
  });

  /**
   * THE DEADLINE IS PART OF THE QUESTION NOW.
   *
   * It was the last line of the third screenful, `text-xs` at 70% opacity. The
   * couple asked for it where the decision is made.
   */
  it("says how long they have to answer, beside the question", () => {
    renderForm();

    expect(document.querySelector(".rsvp__deadline")).toHaveTextContent(
      rsvpDeadlineSentence(GUESTS.length),
    );
  });

  it("asks one guest for their own deadline, in the singular", () => {
    renderForm({ guests: [GUESTS[0]] });

    expect(document.querySelector(".rsvp__deadline")).toHaveTextContent(
      rsvpDeadlineSentence(1),
    );
  });

  /**
   * AND HOW MANY PEOPLE THE INVITATION IS FOR, ON THE SCREEN WHERE THE
   * HOUSEHOLD IS DECIDING.
   *
   * "Las personas estan interpretando que van a poder invitar a mas
   * personas", reported by the couple about invitations they had already
   * sent. The confirmation can only tell a household what it already
   * decided; this screen is where the decision happens, so this is where the
   * ceiling has to be readable.
   *
   * ASSERTED AGAINST THE SAME PARAGRAPH AS THE DEADLINE, because sharing it
   * is not an accident: the card is pinned to this line and all three asking
   * screens are one shape, so a second paragraph here would have broken one
   * of the couple's two rules. The count goes first.
   */
  it("says how many people the invitation is for, in front of the deadline", () => {
    renderForm();
    const line = document.querySelector(".rsvp__deadline")!;

    expect(line).toHaveTextContent(
      `${invitationSizeSentence(GUESTS.length)} ${rsvpDeadlineSentence(
        GUESTS.length,
      )}`,
    );
    expect(line.textContent!.trim()).toMatch(/^La invitación es para /);
  });

  /**
   * AND IT IS THE INVITATION'S OWN SIZE, which is the number a solo guest
   * never meets anywhere else: they confirm on the first tap and never see
   * the list of who is coming.
   */
  it("counts the invitation in the singular when it names one person", () => {
    renderForm({ guests: [GUESTS[0]] });

    expect(document.querySelector(".rsvp__deadline")).toHaveTextContent(
      "La invitación es para una (1) persona.",
    );
  });

  /**
   * THE ANNOUNCEMENT IS ON THE SCREEN THAT ASKS WHO IS COMING, AND THIS TEST
   * ASSERTED THE OPPOSITE UNTIL THE COUPLE CHANGED THEIR MINDS.
   *
   * It used to read "does not repeat the announcement while they choose who
   * is coming", and the reasoning was U34's: 250 pixels of a 664-pixel
   * screen, read once on the gate and again on the question.
   *
   * The couple reversed it with a reason that outranks the pixels: "sin
   * importar que se lleguen a tapar las dos personas de la foto, porque sino
   * despues de aceptar esa pagina de escoger las personas se ve extraña."
   * Answering used to throw the announcement away and jump the card from the
   * foot of the screen to the top of it; the screen a household lands on is
   * the screen they just left now, with the list where the answers were.
   *
   * THE COST IS REAL AND WAS ACCEPTED WITH THE NUMBER IN FRONT OF THEM: a
   * four-person list plus the whole announcement is 124 pixels past an
   * iPhone 14. "No saques nada todavia haz los cambios y yo creo una
   * invitacion de 4 personas para ver como queda."
   * `e2e/invitation-one-screen.spec.ts` holds the measured overflow.
   */
  it("keeps the announcement on the screen that asks who is coming", async () => {
    renderForm();

    await userEvent.click(acceptButton());

    expect(screen.getByText(ANNOUNCEMENT)).toBeInTheDocument();
    expect(attendeeBoxes()).toHaveLength(GUESTS.length);
  });

  /**
   * AND THE LIST MAY BE HANDED A SHORTER ANNOUNCEMENT THAN THE QUESTION'S.
   *
   * The couple found `Enviar respuesta` behind the browser chrome on a real
   * iPhone with a three-person invitation, and asked for the counter and the
   * hairline to go from that screen alone: "sacalos solo cuando la invitación
   * es de 3 personas, porque con dos personas sí se ve bien."
   *
   * WHY THIS COMPONENT TAKES TWO SLOTS RATHER THAN DECIDING. The announcement
   * is a Server Component tree with a live countdown in it, so it cannot be
   * composed on this side of the client boundary — and which screen is
   * showing is state only this side holds. The route therefore builds both
   * blocks for the household it already knows the size of, and this component
   * chooses between them by STEP. `InvitationAnnouncement` holds the size
   * threshold; nothing here knows the number three.
   */
  it("shows the list the shorter announcement when it is given one", async () => {
    renderForm({ attendeesAnnouncement: <p>{SHORT_ANNOUNCEMENT}</p> });

    expect(screen.getByText(ANNOUNCEMENT)).toBeInTheDocument();
    expect(screen.queryByText(SHORT_ANNOUNCEMENT)).not.toBeInTheDocument();

    await userEvent.click(acceptButton());

    expect(screen.getByText(SHORT_ANNOUNCEMENT)).toBeInTheDocument();
    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
  });

  /**
   * AND WHEN IT IS NOT, THE LIST KEEPS THE QUESTION'S OWN BLOCK.
   *
   * Two guests get exactly what they got before this change, and so does
   * every caller that passes one announcement — the console preview builds no
   * form at all, and the legibility fixtures pass a single stand-in. A second
   * slot that silently blanked the screen for them would be a worse bug than
   * the one this fixes.
   */
  it("falls back to the question's announcement when given only one", async () => {
    renderForm();

    await userEvent.click(acceptButton());

    expect(screen.getByText(ANNOUNCEMENT)).toBeInTheDocument();
  });

  it("does not repeat the announcement on the directions", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(acceptButton());
    await user.click(submitButton());

    await waitFor(() => expect(confirmedScreen()).not.toBeNull());
    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
  });

  it("does not repeat the announcement on the stream", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(declineButton());

    await waitFor(() => expect(streamCard()).toBeInTheDocument());
    expect(screen.queryByText(ANNOUNCEMENT)).not.toBeInTheDocument();
  });

  /**
   * THE QUESTION IS NOT ON THE SCREEN THAT ASKS WHO IS COMING, SO THE ANSWER
   * HAS TO TRAVEL AS A HIDDEN FIELD.
   *
   * An unmounted control contributes nothing to a payload. Without this the
   * server would receive a submission with no `attending` at all — and the
   * schema would refuse it, which is the good outcome; the bad one is a
   * default somewhere deciding it meant "no".
   */
  it("still says yes in the payload once the two answers are off screen", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.click(acceptButton());
    expect(screen.queryByRole("button", { name: /Sí, acepto/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /No podemos acompañarlos/ }),
    ).toBeNull();

    await user.click(submitButton());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action.mock.calls[0][1].get("attending")).toBe("yes");
  });

  /**
   * AND A MIS-TAP ON "YES" HAS A WAY BACK.
   *
   * The two answers used to stay on screen above the checkboxes, so changing
   * a wrong "yes" into "no" was one tap. With the two screens separated that
   * escape disappeared, and a household with no way back would have to close
   * the invitation and open it again.
   */
  it("lets a household that tapped yes by mistake go back to the question", async () => {
    const user = userEvent.setup();
    const { container } = renderWithContainer();

    await user.click(acceptButton());
    await user.click(backToQuestion());

    // Back on the question, carrying no answer — the "yes" that opened the
    // list does not survive the way back.
    expect(answerInPayload(container)).toBeNull();
    expect(acceptButton()).toBeInTheDocument();
    expect(declineButton()).toBeInTheDocument();
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
  /**
   * WHERE THE BLOCKS STAND ON THE SCREEN, WHICH THE COUPLE MOVED.
   *
   * They read the live flow on a phone and said the same thing about every
   * step: "los bloques quedan sobre la mitad de la foto y nos tapan." So the
   * question's card lost the deadline and kept only the two answers, the list
   * of who is coming went to the top of its screen, and the way back went to
   * the foot of it.
   *
   * ASSERTED AS CONTAINMENT, NOT AS CLASS NAMES. What matters is which
   * elements share a painted ground — that is what decides both the shape of
   * the screen and, because the ground is what the words are read against,
   * `step-legibility.spec.tsx`'s numbers. A test that matched on
   * `justify-between` alone would stay green through exactly the regression
   * that puts a line back on the couple's faces.
   */
  it("keeps the two answers on the card and the deadline off it", () => {
    const { container } = renderWithContainer();
    const panel = container.querySelector(".rsvp__panel")!;

    expect(panel.querySelector(".rsvp__attending")).not.toBeNull();
    expect(panel.querySelector(".rsvp__deadline")).toBeNull();
    expect(container.querySelector(".rsvp__deadline")).not.toBeNull();
    // And the sentence still follows the card rather than preceding it.
    expect(
      panel.compareDocumentPosition(
        container.querySelector(".rsvp__deadline")!,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  /**
   * AND THE SLOT A REFUSAL WILL NEED IS OFF THE CARD TOO, WHICH IS THE OTHER
   * HALF OF THE COUPLE'S COMPLAINT.
   *
   * They named the card's width. Underneath the second answer there was also
   * a band of empty card taller than an answer is — 76 pixels on an iPhone
   * 14, measured: the gap above the refusal slot, the slot's own 40 reserved
   * pixels, and the card's bottom padding.
   *
   * The slot is still reserved, in the same `min-h-10`, and it still holds
   * the space before there is anything in it — see "holds the space a refusal
   * will need". It holds that space ABOVE the card, and that position is the
   * couple's second instruction rather than a preference: "el componente debe
   * quedar abajo pegado a la fecha de confirmación", so nothing may stand
   * between the card and the deadline. Above the card the space is free —
   * the group is bottom-anchored, so a refusal grows upward into the empty
   * middle of the photograph and neither the card nor the deadline moves.
   *
   * ONLY ON THIS SCREEN. The screen that asks who is coming keeps its slot on
   * the card, because that card holds a whole form rather than two answers
   * and has no band to lose.
   */
  it("reserves the refusal above the card, not inside it", () => {
    const { container } = renderWithContainer();
    const panel = container.querySelector(".rsvp__panel")!;
    const feedback = container.querySelector(".rsvp__feedback")!;

    expect(feedback).not.toBeNull();
    expect(panel.querySelector(".rsvp__feedback")).toBeNull();
    expect(
      feedback.compareDocumentPosition(panel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // And nothing at all stands between the card and the deadline.
    expect(panel.nextElementSibling).toBe(
      container.querySelector(".rsvp__deadline"),
    );
  });

  /**
   * AND IT IS ONLY A CARD WHEN IT HAS SOMETHING TO SAY.
   *
   * The slot reserves 58%–64% of an iPhone 14, which crosses the brightest
   * pixel in the photograph. A refusal there needs the card's own ground
   * under it — and an empty dark bar floating over the couple is the defect
   * this pass exists to remove, so the ground arrives with the sentence.
   */
  it("paints a ground under a refusal, and none while there is none", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RsvpAnswer
        action={actionReturning({ status: "not_authorized" })}
        announcement={<p>{ANNOUNCEMENT}</p>}
        guests={GUESTS}
        greetingName={GREETING_NAME}
        current={null}
        ceremony={CEREMONY}
        venue={VENUE}
      />,
    );
    const feedback = () => container.querySelector(".rsvp__feedback")!;

    expect(feedback().className).not.toContain("bg-[#0d1114]");

    await user.click(declineButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Tu sesión ya no está activa.",
      ),
    );
    expect(feedback().className).toContain("bg-[#0d1114]");
  });

  /**
   * AND THE SAME BAND CAME OFF THE SECOND CARD, ON THE OTHER SIDE OF IT.
   *
   * The couple named the empty card under `Enviar respuesta` too. This card
   * is anchored to the TOP of its screen rather than the foot, so its slot
   * reserves the space below it: a refusal grows down into the photograph,
   * and neither the card nor "Volver a la pregunta" moves.
   */
  it("reserves the refusal above the list, not inside it", async () => {
    const { container } = renderWithContainer();

    await userEvent.click(acceptButton());

    const panel = container.querySelector(".rsvp__panel")!;
    const feedback = container.querySelector(".rsvp__feedback")!;

    expect(feedback).not.toBeNull();
    expect(panel.querySelector(".rsvp__feedback")).toBeNull();
    // Above the card, as on the question screen: both cards are anchored to
    // the foot now, so a refusal has to grow up into the photograph rather
    // than push the way back off the bottom of the screen.
    expect(
      feedback.compareDocumentPosition(panel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // And the send button keeps its place as the last thing on the card.
    expect(panel.lastElementChild?.getAttribute("type")).toBe("submit");
    // With the way back immediately after it, the way the deadline follows
    // the question's card.
    expect(panel.nextElementSibling).toBe(
      container.querySelector(".rsvp__back"),
    );
  });

  /**
   * AND THE THREE ASKING SCREENS ARE ONE SHAPE.
   *
   * The couple asked for it in those words — "para que se mantenga la misma
   * ui" about the width, and then the announcement back on the second screen
   * so that answering does not rearrange the page under them. Asserted as
   * structure rather than as class names: announcement first, then a group
   * holding the refusal's slot, the card, and one small line.
   */
  it("gives the question and the list the same three-part shape", async () => {
    const { container } = renderWithContainer();
    const form = () => container.querySelector("form.rsvp__form")!;
    const shape = () =>
      Array.from(form().children[1].children).map((child) =>
        child.classList.contains("rsvp__feedback")
          ? "slot"
          : child.classList.contains("rsvp__panel")
            ? "card"
            : "line",
      );

    expect(form().children[0]).toHaveTextContent(ANNOUNCEMENT);
    expect(shape()).toEqual(["slot", "card", "line"]);

    await userEvent.click(acceptButton());

    expect(form().children[0]).toHaveTextContent(ANNOUNCEMENT);
    expect(shape()).toEqual(["slot", "card", "line"]);
  });

  it("puts the list of who is coming on the card, and the way back below it", async () => {
    const { container } = renderWithContainer();

    await userEvent.click(acceptButton());

    const panel = container.querySelector(".rsvp__panel")!;

    expect(panel.querySelector(".rsvp__attendees")).not.toBeNull();
    expect(panel.querySelector("button[type='submit']")).not.toBeNull();
    expect(panel.querySelector(".rsvp__back")).toBeNull();

    const back = container.querySelector(".rsvp__back")!;

    expect(back).not.toBeNull();
    expect(
      panel.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  /**
   * AND EVERY STEP PUSHES ITS TWO GROUPS APART.
   *
   * `justify-between` over exactly two children is what leaves the middle of
   * the photograph to the photograph. Over three it would strand one of them
   * in the middle, which is the arrangement being replaced.
   */
  it("spreads each step into two groups at the ends of the screen", async () => {
    const { container } = renderWithContainer();
    const form = () => container.querySelector("form.rsvp__form")!;

    expect(form().className).toContain("justify-between");
    expect(form().children).toHaveLength(2);

    await userEvent.click(acceptButton());

    expect(form().className).toContain("justify-between");
    expect(form().children).toHaveLength(2);
  });

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

    await userEvent.click(acceptButton());

    expect(attendeeBoxes()).toHaveLength(5);
    // The announcement is back on this screen — see "keeps the announcement
    // on the screen that asks who is coming" for the couple's reversal. The
    // DEADLINE is not: it belongs to the question, where the decision is
    // made, and this screen is already past an iPhone 14 without it.
    expect(screen.getByText(ANNOUNCEMENT)).toBeInTheDocument();
    expect(screen.queryByText(rsvpDeadlineSentence(5))).not.toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });
});
