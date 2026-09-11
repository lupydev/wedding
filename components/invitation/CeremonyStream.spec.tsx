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
  ceremonyDate: "sábado 14 de noviembre",
  ceremonyTime: "4:00 p. m.",
  streamMeetingId: "123 4567 8901",
  streamPasscode: "boda2026",
};

function renderCard(onReconsider = vi.fn()) {
  render(<CeremonyStream ceremony={CEREMONY} onReconsider={onReconsider} />);

  return onReconsider;
}

describe("CeremonyStream", () => {
  it("shows all four stream details, each beside its own label", () => {
    renderCard();

    const details = screen.getByRole("group", { name: /transmisión/i });
    const terms = within(details).getAllByRole("term");

    // Each label is read WITH the value that follows it, so a passcode
    // rendered where the meeting id belongs fails this test. Asserting the
    // four texts were merely "somewhere on the card" would not.
    expect(
      terms.map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent,
      ]),
    ).toEqual([
      ["Fecha", CEREMONY.ceremonyDate],
      ["Hora", CEREMONY.ceremonyTime],
      ["ID de la reunión", CEREMONY.streamMeetingId],
      ["Clave de acceso", CEREMONY.streamPasscode],
    ]);
  });

  it("renders whatever the row holds, including an unfinished placeholder", () => {
    // The couple has not supplied the real details, and the seeded row says so
    // in words. A component that hid or prettified a placeholder would turn an
    // obviously unfinished invitation into a plausible wrong one.
    render(
      <CeremonyStream
        ceremony={{
          ceremonyDate: "{{CEREMONY_DATE}}",
          ceremonyTime: "{{CEREMONY_TIME}}",
          streamMeetingId: "{{ZOOM_MEETING_ID}}",
          streamPasscode: "{{ZOOM_PASSCODE}}",
        }}
        onReconsider={vi.fn()}
      />,
    );

    expect(screen.getByText("{{ZOOM_MEETING_ID}}")).toBeInTheDocument();
    expect(screen.getByText("{{ZOOM_PASSCODE}}")).toBeInTheDocument();
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
