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
   * IT MUST SAY IT IS AN INVITATION BEFORE IT SAYS ANYTHING PRACTICAL.
   *
   * A page that opens with a date and a meeting id reads as a calendar entry.
   * The guests who land here are the ones who cannot be in the room, and the
   * first thing they should read is that they were thought of — so the warmth
   * comes first and the streaming fact second.
   */
  it("welcomes the reader before it explains anything", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(screen.getByText(/te esperamos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/transmitir la ceremonia en vivo/i),
    ).toBeInTheDocument();
  });

  /**
   * IT SPEAKS TO ONE PERSON, NOT TO A HOUSEHOLD.
   *
   * `/i/[slug]` addresses a household and says "ustedes" throughout, correctly:
   * that invitation belongs to a family and names every member. THIS page is
   * read by one person at a time, and the couple asked for it to sound like it.
   *
   * The plural forms are what would drift back in, because the rest of the
   * product is written in them and this component sits in the same folder. Each
   * one asserted here is a form that appeared in this very copy before it was
   * rewritten.
   */
  it("keeps the whole page in the singular", () => {
    const { container } = render(
      <StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />,
    );

    expect(container.textContent).not.toMatch(
      /\bpueden\b|\bestén\b|\babran\b|\belijan\b|\bescriban\b/i,
    );
  });

  /**
   * AND IT DOES NOT EXPLAIN ZOOM.
   *
   * It carried a line telling the reader to open Zoom, choose "Unirse" and type
   * the id before the passcode. The couple removed it for a reason worth
   * recording: everybody already knows how to join a Zoom call, and a page that
   * explains it anyway is a page that thinks less of whoever is reading it.
   */
  it("does not explain how to use Zoom", () => {
    const { container } = render(
      <StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />,
    );

    expect(container.textContent).not.toMatch(/unirse/i);
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
   * THE REMINDER IS THE POINT, AND IT IS NOT A FILE.
   *
   * A stream guest has no journey to plan, which is exactly why the date slips
   * their mind: nothing else in their week points at it. An entry with alarms
   * inside it is the only thing on this page that will speak up on its own.
   */
  describe("adding it to a calendar", () => {
    it("offers Google Calendar, opened away from this page", () => {
      render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

      const google = screen.getByRole("link", { name: /google calendar/i });

      expect(google).toHaveAttribute("href", CALENDAR.googleHref);
      expect(google).toHaveAttribute("target", "_blank");
      // Without `noopener` the new tab can reach back into this one through
      // `window.opener`. `noreferrer` implies it, and is set for both reasons.
      expect(google).toHaveAttribute(
        "rel",
        expect.stringContaining("noopener"),
      );
    });

    /**
     * NOTHING ON THIS PAGE DOWNLOADS A FILE.
     *
     * A `.ics` sat beside the Google link and was removed on the couple's
     * instruction: a browser that answers a tap by dropping a file into a
     * downloads folder has not helped anybody reading a wedding invitation on
     * their phone.
     *
     * The rule is a test rather than only a diff because the obvious way to
     * "improve" this later is to add the file back for the Apple and Outlook
     * guests the Google link does not serve. That gap is real and so is the
     * decision — and it belongs to the couple, not to whoever is passing
     * through this component.
     */
    it("offers no file to download", () => {
      const { container } = render(
        <StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />,
      );

      for (const anchor of container.querySelectorAll("a")) {
        expect(anchor.getAttribute("href")).not.toMatch(/\.ics/);
        expect(anchor.hasAttribute("download")).toBe(false);
      }
    });
  });
});
