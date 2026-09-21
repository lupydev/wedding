import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  StreamInvitation,
  type StreamInvitationCeremony,
} from "./StreamInvitation";

const CEREMONY: StreamInvitationCeremony = {
  coupleNames: "Luis & Michell",
  ceremonyDate: "sábado 28 de noviembre de 2026",
  ceremonyTime: "5:00 p. m.",
  streamMeetingId: "123 4567 8901",
  streamPasscode: "boda2026",
};

const CALENDAR = {
  icsHref: "/transmision/evento.ics",
  googleHref: "https://calendar.google.com/calendar/render?action=TEMPLATE",
};

/**
 * The invitation everybody joining over Zoom receives.
 *
 * Props-only, like `InvitationBody` and for the same reason: it performs no
 * data access, so its prop type is the complete list of what it can possibly
 * show. There is no field here for a guest name, a phone number, a venue or an
 * address — and that is not an omission, it is the guarantee. This page is
 * public and ungated, so anything it COULD render, a stranger could read.
 */
describe("StreamInvitation", () => {
  it("names the couple as its heading", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(
      screen.getByRole("heading", { level: 1, name: CEREMONY.coupleNames }),
    ).toBeInTheDocument();
  });

  it("carries the four details, each beside its own label", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    const details = screen.getByRole("group", { name: /transmisión/i });

    expect(
      within(details)
        .getAllByRole("term")
        .map((term) => [
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
   * IT MUST SAY WHAT KIND OF INVITATION THIS IS.
   *
   * A page that shows a date and a meeting id without saying "we are streaming
   * the ceremony, join us from wherever you are" reads as a calendar entry. The
   * guests who land here are the ones who cannot be in the room, and the first
   * thing they should read is that they were thought of.
   */
  it("says the ceremony is streamed and they are invited to it", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(
      screen.getByText(/transmitir la ceremonia en vivo/i),
    ).toBeInTheDocument();
  });

  /**
   * NO ADDRESS, EVER, ON THIS SURFACE.
   *
   * `/transmision` is public and has no gate. The venue and its address are the
   * one pair of facts on the `ceremony` row that a stranger should not be able
   * to read, and the prop type has no field for either — so this test is
   * belt-and-braces over a type that already forbids it. It is here because a
   * later "while we are at it, show the venue too" is exactly the change that
   * would slip through review.
   */
  it("names no venue and no address", () => {
    const { container } = render(
      <StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />,
    );

    expect(container.textContent).not.toMatch(/dirección|calle|carrera|venue/i);
  });

  /**
   * An unfinished value reaches the page exactly as the row holds it.
   *
   * The same rule `StreamDetails` enforces, asserted again at this level
   * because this is the surface a stranger reads: a prettified placeholder here
   * would send a guest to a call that does not exist, and the page would look
   * perfectly finished while doing it.
   */
  it("renders a seeded placeholder verbatim", () => {
    render(
      <StreamInvitation
        ceremony={{ ...CEREMONY, streamPasscode: "{{ZOOM_PASSCODE}}" }}
        calendar={CALENDAR}
      />,
    );

    expect(screen.getByText("{{ZOOM_PASSCODE}}")).toBeInTheDocument();
  });

  /**
   * THE REMINDER IS THE POINT, NOT THE FILE.
   *
   * A stream guest has no journey to plan, which is exactly why the date slips
   * their mind: nothing else in their week points at it. An entry they can save
   * — with alarms inside it — is the only thing on this page that will speak up
   * on its own.
   */
  describe("adding it to a calendar", () => {
    it("offers the file, named so a calendar recognises it", () => {
      render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

      const ics = screen.getByRole("link", { name: /agregar al calendario/i });

      expect(ics).toHaveAttribute("href", CALENDAR.icsHref);
    });

    /**
     * Two routes, because they fail in opposite places.
     *
     * The `.ics` opens natively on iOS and in Outlook and is a downloaded file
     * to hunt for in a desktop browser; the Google link is one tap for anybody
     * already signed in and nothing at all for anybody who is not.
     */
    it("also offers Google Calendar, opened away from this page", () => {
      render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

      const google = screen.getByRole("link", { name: /google/i });

      expect(google).toHaveAttribute("href", CALENDAR.googleHref);
      expect(google).toHaveAttribute("target", "_blank");
      // `noopener` or the new tab can reach back into this one through
      // `window.opener`. `noreferrer` implies it, and is set for both reasons.
      expect(google).toHaveAttribute(
        "rel",
        expect.stringContaining("noopener"),
      );
    });
  });
});
