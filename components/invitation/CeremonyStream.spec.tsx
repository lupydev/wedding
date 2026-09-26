import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CeremonyStream, type CeremonyStreamDetails } from "./CeremonyStream";

/**
 * What a household sees once they have told us they cannot come.
 *
 * The couple is streaming the ceremony, and rather than maintaining a second
 * audience list a household that declines a personal invitation becomes a
 * stream viewer automatically. So this card replaces the form rather than
 * sitting beside it: the answer has been recorded, and what is left to say is
 * how to join.
 *
 * Props-only and synchronous, like `InvitationBody`: the values come from the
 * `ceremony` row (migration 0009) and this component performs no data access,
 * so there is no path by which it could be handed a phone number.
 */

const CEREMONY: CeremonyStreamDetails = {
  streamUrl: "https://meet.google.com/abc-defg-hij",
};

function renderCard(onReconsider = vi.fn(), memberCount = 2) {
  render(
    <CeremonyStream
      ceremony={CEREMONY}
      memberCount={memberCount}
      onReconsider={onReconsider}
    />,
  );

  return onReconsider;
}

describe("CeremonyStream", () => {
  /**
   * THE WAY IN, WHICH IS A CONTROL RATHER THAN A LIST OF VALUES.
   *
   * This asserted label/value pairs in a description list, because the block
   * held a meeting id and a passcode to transcribe. It holds one link now,
   * and the thing worth asserting is where that link GOES — a label rendered
   * beside the wrong address would have passed the old test and fails this.
   */
  it("offers a way in that points at the stored address", () => {
    renderCard();

    expect(
      screen.getByRole("link", { name: /Entrar a la transmisión/ }),
    ).toHaveAttribute("href", CEREMONY.streamUrl);
  });

  it("renders whatever the row holds, including an unfinished placeholder", () => {
    // The couple has not supplied the real details, and the seeded row says so
    // in words. A component that hid or prettified a placeholder would turn an
    // obviously unfinished invitation into a plausible wrong one.
    render(
      <CeremonyStream
        ceremony={{ streamUrl: "{{MEET_URL}}" }}
        memberCount={2}
        onReconsider={vi.fn()}
      />,
    );

    expect(screen.getByText("{{MEET_URL}}")).toBeInTheDocument();
  });

  it("tells the household their answer is not final", () => {
    renderCard();

    expect(
      screen.getByText(/Si cambian de opinión, pueden volver a responder/),
    ).toBeInTheDocument();
  });

  it("offers a control that hands the decision back to the form", async () => {
    // Declining submits on the first tap, so one mis-tap records a decline
    // instantly. The way back has to be here, next to the consequence, rather
    // than somewhere the guest has to go looking for it.
    const user = userEvent.setup();
    const onReconsider = renderCard();

    await user.click(
      screen.getByRole("button", { name: /Volver a responder/ }),
    );

    expect(onReconsider).toHaveBeenCalledTimes(1);
  });

  it("does not call back before the guest asks it to", () => {
    const onReconsider = renderCard();

    expect(onReconsider).not.toHaveBeenCalled();
  });
});

/**
 * THE WORDS A HOUSEHOLD READS AFTER SAYING THEY CANNOT COME.
 *
 * The couple: "en caso de no poder asistir entonces se les muestra la
 * información de Zoom con un mejor copy como 'los esperamos por Zoom', similar
 * a lo que aparece en /transmision."
 *
 * It said "Los acompañamos por transmisión" over two lines explaining what a
 * stream is. `/transmision` had already been rewritten to one sentence — "La
 * ceremonia se va a transmitir a través de Zoom. Te esperamos." — and this card
 * is the same offer, made to a household that has just declined.
 */
describe("the words on the card", () => {
  it("invites the household to the stream in one line", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "Los esperamos por Google Meet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Vamos a transmitir la ceremonia en vivo/),
    ).toBeInTheDocument();
  });

  /**
   * AND IN THE NUMBER THEY ANSWERED IN.
   *
   * The form above asks one person "¿Podrás acompañarnos?" since U18. A card
   * that then says "pueden acompañarnos" to that same person is the product
   * changing voice between one screen and the next.
   */
  it("speaks to one person in the singular", () => {
    renderCard(vi.fn(), 1);

    expect(screen.getByText(/puedas acompañarnos/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Si cambias de opinión, puedes volver a responder cuando quieras.",
      ),
    ).toBeInTheDocument();
  });

  /**
   * THE DAY AND THE HOUR ARE NOT STATED A SECOND TIME.
   *
   * This card sits inside the invitation, below an announcement that names the
   * day and counts down to it. The same reasoning `/transmision` already
   * applied to its own copy of this block.
   *
   * It used to say so by passing `showDate={false} showTime={false}` and
   * asserting the two fixture strings were absent. Both props are gone and so
   * are the columns behind them, so the assertion is structural now: `Fecha`
   * and `Hora` were the only labelled values this card ever carried, and a
   * `<dt>` is the role `term`. One appearing here again is somebody restating
   * the announcement.
   */
  it("leaves the day and the hour to the page around it", () => {
    renderCard();

    expect(screen.queryAllByRole("term")).toHaveLength(0);
    expect(screen.queryAllByRole("definition")).toHaveLength(0);
  });
});

/**
 * THE WORDS A HOUSEHOLD READS AFTER SAYING NO, AND HOW THEY READ.
 *
 * The couple: "un mensaje más ameno como 'comprendemos que no puedan asistir,
 * la ceremonia se transmitirá en vivo así pueden acompañarnos' o algo similar
 * que sea cercano."
 *
 * It opened with "Gracias por contarnos" and then explained the stream. Thanks
 * is not the same as understanding: a household telling the couple they cannot
 * come to their wedding has usually just decided something they are sorry
 * about, and the screen that answers them should say so before it says anything
 * practical.
 */
describe("how the card answers a decline", () => {
  it("understands first, and offers the stream second", () => {
    renderCard();

    expect(screen.getByText(/Comprendemos/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Gracias por contarnos/i),
    ).not.toBeInTheDocument();
  });

  it("says it to one person in the singular", () => {
    renderCard(vi.fn(), 1);

    expect(screen.getByText(/no puedas acompañarnos/i)).toBeInTheDocument();
  });

  /**
   * AND THE WAY BACK FILLS ITS COLUMN.
   *
   * "El botón debe ocupar todo el espacio, el de volver a responder." It sat
   * centred at its own text width under a block whose other control is full
   * width, which is the same mismatch `/transmision` already had between its
   * two buttons.
   */
  it("gives the way back the width of the block", () => {
    renderCard();

    const back = screen.getByRole("button", { name: /Volver a responder/ });

    expect(back.className).toContain("w-full");
  });
});

/**
 * THE TWO CONTROLS ARE THE SAME WIDTH, AND ONE ELEMENT DECIDES IT.
 *
 * The couple, with a screenshot of them stacked: "los botones tienen diferentes
 * anchos, deben quedar del mismo ancho."
 *
 * They were. "Entrar a la transmisión" lives inside the stream block, which
 * this card was capping at `max-w-sm`; "Volver a responder" is a sibling of
 * that block and inherited the card's full width. Both were `w-full` — of two
 * different things.
 *
 * THE MEASURE BELONGS TO THE CARD, not to one child of it. With the cap on the
 * container, every control inside is `w-full` of the same box and they cannot
 * drift apart again — which is what "same width" has to mean if it is to
 * survive somebody adding a third button.
 */
describe("how wide the controls are", () => {
  function card(): HTMLElement {
    return document.querySelector<HTMLElement>(".rsvp__stream")!;
  }

  it("puts the measure on the card itself", () => {
    renderCard();

    expect(card().className).toMatch(/max-w-/);
  });

  it("caps nothing inside it a second time", () => {
    renderCard();

    const details = screen.getByTestId("stream-details");
    const back = screen.getByRole("button", { name: /Volver a responder/ });
    const join = screen.getByRole("link", { name: /Entrar a la transmisión/ });

    for (const inside of [details, back, join]) {
      expect(inside.className).toContain("w-full");
      expect(inside.className).not.toMatch(/max-w-/);
    }
  });
});
