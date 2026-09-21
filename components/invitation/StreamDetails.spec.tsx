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
});
