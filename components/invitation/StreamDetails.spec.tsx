import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StreamDetails, type StreamDetailsValues } from "./StreamDetails";

const CEREMONY: StreamDetailsValues = {
  ceremonyDate: "sábado 28 de noviembre de 2026",
  ceremonyTime: "5:00 p. m.",
  streamMeetingId: "123 4567 8901",
  streamPasscode: "boda2026",
};

/**
 * The four values a guest needs in order to join the ceremony.
 *
 * Extracted from `CeremonyStream` so that the household behind the phone gate
 * and the public page at `/transmision` cannot disagree about what they are or
 * what they are called. Migration 0009 states the rule for the row — "every
 * surface that shows them MUST read this row" — and this component is the same
 * rule one level up: every surface that shows them renders the same block.
 */
describe("StreamDetails", () => {
  it("puts each label beside its own value, in order", () => {
    render(<StreamDetails ceremony={CEREMONY} />);

    const details = screen.getByRole("group", { name: /transmisión/i });
    const terms = within(details).getAllByRole("term");

    // Read as PAIRS. Asserting the four texts are each "somewhere on the page"
    // would pass with the passcode rendered where the meeting id belongs.
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

  /**
   * AN UNFINISHED VALUE STAYS VISIBLY UNFINISHED.
   *
   * The `ceremony` row ships seeded with brace-wrapped placeholders, and this
   * block renders them exactly as it finds them. Hiding a placeholder, or
   * prettifying it into something plausible, turns an obviously incomplete
   * invitation into a confidently wrong one — and nobody notices until a guest
   * joins a call that does not exist.
   */
  it("renders an unfinished value exactly as the row holds it", () => {
    render(
      <StreamDetails
        ceremony={{ ...CEREMONY, streamMeetingId: "{{ZOOM_MEETING_ID}}" }}
      />,
    );

    expect(screen.getByText("{{ZOOM_MEETING_ID}}")).toBeInTheDocument();
  });
});
