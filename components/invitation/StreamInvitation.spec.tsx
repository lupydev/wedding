import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COUPLE_NAMES } from "@/lib/domain/wedding-day";

import {
  StreamInvitation,
  type StreamInvitationCeremony,
} from "./StreamInvitation";

const CEREMONY: StreamInvitationCeremony = {
  ceremonyDate: "sábado 28 de noviembre de 2026",
  ceremonyTime: "5:00 p. m.",
  streamUrl: "https://meet.google.com/abc-defg-hij",
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
  /**
   * THE HEADING COMES FROM `SaveTheDate`, WHICH IS THE LANDING'S OWN BLOCK.
   *
   * Asserted against the domain constant rather than a prop, because that is
   * where it genuinely comes from. This page used to render its own `<h1>` from
   * the `ceremony` row; sharing the landing's block is what makes the two pages
   * identical instead of merely similar, and a copy would have drifted on the
   * first tweak to either.
   */
  it("carries the landing's own announcement block", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(
      screen.getByRole("heading", { level: 1, name: COUPLE_NAMES }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("save-the-date-when")).toBeInTheDocument();
  });

  /**
   * AND IT MAKES THAT ANNOUNCEMENT ONCE.
   *
   * This page carried its own "Nos casamos" script line from before the shared
   * block existed. When the line moved INTO `SaveTheDate` — so the gate could
   * make the same announcement without two halves in two files — the landing
   * dropped its copy and this one was missed. The page then said it twice, one
   * line under the other, and every check stayed green: two components each
   * rendering one correct line.
   *
   * `getByText` would not have caught it either. It throws on multiple matches,
   * but only for the string it is given, and no test asked for this one.
   */
  it("makes it once, not twice", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(screen.getAllByText("Nos casamos")).toHaveLength(1);
  });

  /**
   * INCLUDING THE COUNTDOWN.
   *
   * The couple asked for this page to open exactly as the landing does. The
   * countdown is the part that would have been quietly left out — it is the
   * one element that does not look like copy — and it is the reason the whole
   * announcement is shared rather than reproduced.
   */
  it("counts down here too", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(screen.getByTestId("countdown-summary")).toBeInTheDocument();
  });

  /**
   * THREE PAIRS, NOT FOUR, AND THE MISSING ONE IS DELIBERATE.
   *
   * The announcement above already names the day in prose. Repeating it here
   * put the same date on one small screen twice, in two formats, which reads as
   * a defect however good each reason is. The HOUR stays: nothing above says
   * it, and a guest joining a call needs one.
   *
   * Read as PAIRS. Asserting the texts are each "somewhere on the page" would
   * pass with the passcode rendered where the meeting id belongs.
   */
  it("carries the joining details, each beside its own label", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    const details = screen.getByRole("group", { name: /transmisión/i });

    expect(
      within(details)
        .getAllByRole("term")
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([["Enlace de la transmisión", CEREMONY.streamUrl]]);
  });

  /**
   * And the day is not repeated, which is the point of dropping it.
   *
   * The date the page DOES show comes from `SaveTheDate` above, in prose and
   * from the domain. This asserts the row's own rendering of it is absent.
   */
  it("does not state the day twice", () => {
    render(<StreamInvitation ceremony={CEREMONY} calendar={CALENDAR} />);

    expect(screen.queryByText(CEREMONY.ceremonyDate)).toBeNull();
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
        ceremony={{ ...CEREMONY, streamUrl: "{{MEET_URL}}" }}
        calendar={CALENDAR}
      />,
    );

    expect(screen.getByText("{{MEET_URL}}")).toBeInTheDocument();
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

/**
 * WHAT THE PAGE SAYS, AND WHAT IT STOPS SAYING TWICE.
 *
 * The couple rewrote the lead themselves — "La ceremonia se va a transmitir a
 * través de Zoom. Te esperamos." — and asked for the hour below to go, because
 * the counter on this same page runs to that exact instant.
 *
 * THE ORDER IS REVERSED FROM WHAT WAS HERE, ON PURPOSE. A test used to assert
 * that the warmth came FIRST and the practical fact second, reasoning that a
 * page opening with a date and a meeting id reads as a calendar entry. The
 * couple wrote it the other way round, and they are right about their own
 * wedding: the sentence now answers the question the reader arrived with —
 * how do I attend? — and then says they are expected. That test is gone rather
 * than repaired, because its reasoning no longer describes the page.
 */
describe("the stream page's own words", () => {
  /**
   * AND THE LEAD IS GONE, ON THE COUPLE'S OWN INSTRUCTION.
   *
   * "Esto lo podemos quitar: La ceremonia se va a transmitir por Google Meet.
   * Te esperamos."
   *
   * The sentence was written to answer the question the reader arrived with —
   * how do I attend? — back when the answer was a meeting id and a passcode to
   * transcribe. The page now carries a control that says "Entrar a la
   * transmisión" above the address itself, which answers that question by being
   * pressable. A line explaining that the ceremony arrives by Google Meet, above
   * a button labelled with the Google Meet address, is the page saying the same
   * thing twice.
   *
   * Asserted as an ABSENCE rather than deleted quietly: a sentence removed on
   * request is a decision, and the next person to feel this page is missing a
   * lead should find out here that it was taken out rather than never written.
   */
  it("does not explain the stream above a control that is the explanation", () => {
    render(<StreamInvitation calendar={CALENDAR} ceremony={CEREMONY} />);

    expect(
      screen.queryByText(/La ceremonia se va a transmitir/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Te esperamos/i)).not.toBeInTheDocument();
  });

  /**
   * NEITHER THE DAY NOR THE HOUR IS REPEATED UNDERNEATH.
   *
   * The day is above in prose, from the domain; the hour is where the counter
   * lands, and the add-to-calendar button carries the precise time for anybody
   * who wants to keep it.
   */
  it("states neither the day nor the hour a second time", () => {
    render(<StreamInvitation calendar={CALENDAR} ceremony={CEREMONY} />);

    expect(screen.queryByText(CEREMONY.ceremonyTime)).toBeNull();
    expect(screen.queryByText(CEREMONY.ceremonyDate)).toBeNull();
  });
});
