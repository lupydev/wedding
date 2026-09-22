import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
/**
 * jsdom ships no clipboard, and `userEvent.setup()` installs one of its own.
 *
 * ORDER MATTERS AND IT COST TWO RED TESTS. Stubbing before `setup()` is
 * pointless — user-event overwrites `navigator.clipboard` with a working fake,
 * so the assertions ran against that instead, the write "succeeded" and the
 * refusal case could not happen at all. Every caller below sets up the user
 * first and then replaces the clipboard.
 */
function stubClipboard(writeText: () => Promise<void>) {
  const spy = vi.fn(writeText);

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: spy },
    configurable: true,
  });

  return spy;
}

describe("StreamDetails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
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

  /**
   * THE TWO CREDENTIALS ARE TRANSCRIBED, NOT READ.
   *
   * Everything else on the page is read once. These two are typed into ANOTHER
   * application, usually on a phone, usually while the ceremony is starting —
   * an eleven digit meeting id and a passcode. That is where a guest fails, and
   * a button that removes the typing is worth more than any amount of styling.
   */
  describe("copying a credential", () => {
    it("offers to copy the meeting id and the passcode", () => {
      render(<StreamDetails ceremony={CEREMONY} />);

      expect(
        screen.getByRole("button", { name: /copiar el id/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /copiar la clave/i }),
      ).toBeInTheDocument();
    });

    /**
     * And offers nothing for the date or the time.
     *
     * A button per row would be four buttons where two of them do something
     * nobody wants. A control that exists because the row above it had one is
     * how a card becomes noise.
     */
    it("offers nothing to copy for the date or the time", () => {
      render(<StreamDetails ceremony={CEREMONY} />);

      expect(screen.getAllByRole("button")).toHaveLength(2);
    });

    it("puts the value on the clipboard, and says it did", async () => {
      const user = userEvent.setup();
      const writeText = stubClipboard(() => Promise.resolve());

      render(<StreamDetails ceremony={CEREMONY} />);
      await user.click(screen.getByRole("button", { name: /copiar el id/i }));

      expect(writeText).toHaveBeenCalledWith(CEREMONY.streamMeetingId);
      expect(
        screen.getByRole("button", { name: /copiado/i }),
      ).toBeInTheDocument();
    });

    /**
     * A REFUSED WRITE MUST NOT CLAIM SUCCESS.
     *
     * `navigator.clipboard` is undefined outside a secure context and its write
     * can be refused by permission. Handled badly, the button says "copiado"
     * over an empty clipboard and the guest pastes nothing into Zoom, believing
     * they have the id. The value stays on screen either way, which is why
     * failing quietly is acceptable and lying is not.
     */
    it("keeps offering to copy when the browser refuses", async () => {
      const user = userEvent.setup();
      stubClipboard(() => Promise.reject(new Error("denied")));

      render(<StreamDetails ceremony={CEREMONY} />);
      await user.click(screen.getByRole("button", { name: /copiar el id/i }));

      expect(
        screen.getByRole("button", { name: /copiar el id/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /copiado/i })).toBeNull();
    });

    it("survives a browser with no clipboard at all", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup();

      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });

      render(<StreamDetails ceremony={CEREMONY} />);
      await user.click(screen.getByRole("button", { name: /copiar el id/i }));

      expect(error).not.toHaveBeenCalled();
    });
  });

  /**
   * THE DATE CAN BE LEFT OUT WHERE SOMETHING ABOVE ALREADY SAID IT.
   *
   * On `/transmision` the landing's announcement sits directly above this
   * block and names the day in prose. Repeating it here put the same date on
   * one small screen twice, in two formats — "sábado, 28 de noviembre de 2026"
   * and "28-11-2026" — which reads as a defect however good each reason is.
   *
   * The HOUR stays, because nothing above it says the hour and a stream guest
   * needs one. The invitation behind the phone gate keeps both: it has no
   * announcement above it.
   */
  describe("when the moment is already stated above", () => {
    it("drops the day when the page has already said it", () => {
      render(<StreamDetails ceremony={CEREMONY} showDate={false} />);

      expect(screen.queryByText(CEREMONY.ceremonyDate)).toBeNull();
      expect(screen.getByText(CEREMONY.ceremonyTime)).toBeInTheDocument();
    });

    /**
     * AND THE HOUR, WHERE A COUNTDOWN ALREADY LANDS ON IT.
     *
     * The couple: "hay que eliminar la hora ya que el contador llega hasta el
     * día 28 de noviembre a las 5:00pm". On a page whose counter runs to that
     * exact instant, printing the hour underneath is the same fact twice — and
     * the add-to-calendar button beside it carries the precise time for
     * anybody who wants to keep it.
     */
    it("drops the hour when a counter above already lands on it", () => {
      render(<StreamDetails ceremony={CEREMONY} showTime={false} />);

      expect(screen.queryByText(CEREMONY.ceremonyTime)).toBeNull();
      expect(screen.getByText(CEREMONY.ceremonyDate)).toBeInTheDocument();
    });

    /**
     * WITH NEITHER, THE ROW ITSELF GOES.
     *
     * An empty line above the credentials is a gap nobody put there on
     * purpose, and it is exactly what `/transmision` would render: it already
     * drops the day, and now drops the hour too.
     */
    it("renders no line at all when it would be empty", () => {
      render(
        <StreamDetails ceremony={CEREMONY} showDate={false} showTime={false} />,
      );

      const terms = screen.getAllByRole("term").map((term) => term.textContent);

      expect(terms).toEqual(["ID de la reunión", "Clave de acceso"]);
    });

    it("still shows both by default", () => {
      render(<StreamDetails ceremony={CEREMONY} />);

      expect(screen.getByText(CEREMONY.ceremonyDate)).toBeInTheDocument();
      expect(screen.getByText(CEREMONY.ceremonyTime)).toBeInTheDocument();
    });
  });
});
