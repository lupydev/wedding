import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StreamDetails, type StreamDetailsValues } from "./StreamDetails";

const CEREMONY: StreamDetailsValues = {
  ceremonyDate: "sábado 28 de noviembre de 2026",
  ceremonyTime: "5:00 p. m.",
  streamUrl: "https://meet.google.com/abc-defg-hij",
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
      ["Enlace de la transmisión", CEREMONY.streamUrl],
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
      <StreamDetails ceremony={{ ...CEREMONY, streamUrl: "{{MEET_URL}}" }} />,
    );

    expect(screen.getByText("{{MEET_URL}}")).toBeInTheDocument();
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
    it("offers to copy the one address there is", () => {
      render(<StreamDetails ceremony={CEREMONY} />);

      expect(
        screen.getByRole("button", { name: /copiar el enlace/i }),
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

      // One copy control, because there is one value to copy. The link itself is
      // an anchor, not a button, so it is not counted here.
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("puts the value on the clipboard, and says it did", async () => {
      const user = userEvent.setup();
      const writeText = stubClipboard(() => Promise.resolve());

      render(<StreamDetails ceremony={CEREMONY} />);
      await user.click(
        screen.getByRole("button", { name: /copiar el enlace/i }),
      );

      expect(writeText).toHaveBeenCalledWith(CEREMONY.streamUrl);
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
      await user.click(
        screen.getByRole("button", { name: /copiar el enlace/i }),
      );

      expect(
        screen.getByRole("button", { name: /copiar el enlace/i }),
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
      await user.click(
        screen.getByRole("button", { name: /copiar el enlace/i }),
      );

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

      expect(terms).toEqual(["Enlace de la transmisión"]);
    });

    it("still shows both by default", () => {
      render(<StreamDetails ceremony={CEREMONY} />);

      expect(screen.getByText(CEREMONY.ceremonyDate)).toBeInTheDocument();
      expect(screen.getByText(CEREMONY.ceremonyTime)).toBeInTheDocument();
    });
  });
});

/**
 * THE GUEST PRESSES IT; THEY DO NOT TRANSCRIBE IT.
 *
 * Zoom was two values a guest READ and TYPED into an app, which is why this
 * block was a `dl` of credentials set in a grotesque so a 1 could not become a
 * 7. Google Meet is one address. Rendering it as a value to copy would leave
 * every guest doing by hand what a link does by itself.
 *
 * THE ADDRESS STAYS VISIBLE ANYWAY, and the copy control with it. A guest
 * reading the invitation on a laptop joins from their phone; one who cannot
 * join forwards it to somebody who can. A button whose destination is invisible
 * is also a button nobody can check before a wedding.
 */
describe("the link to the ceremony", () => {
  it("offers a control that opens the call", () => {
    render(<StreamDetails ceremony={CEREMONY} />);

    const join = screen.getByRole("link", { name: /Entrar a la transmisión/ });

    expect(join).toHaveAttribute("href", CEREMONY.streamUrl);
  });

  /**
   * IN A NEW TAB, AND `noopener` IS NOT DECORATION.
   *
   * Without it the opened tab can reach back into this one through
   * `window.opener` — and this page sits behind a phone gate.
   */
  it("opens it away from the invitation, safely", () => {
    render(<StreamDetails ceremony={CEREMONY} />);

    const join = screen.getByRole("link", { name: /Entrar a la transmisión/ });

    expect(join).toHaveAttribute("target", "_blank");
    expect(join.getAttribute("rel")).toContain("noopener");
  });

  /**
   * AND AN UNFINISHED ROW IS NOT A BUTTON THAT GOES NOWHERE.
   *
   * `{{MEET_URL}}` is the seeded placeholder and is not an address. Rendered as
   * a link it would be a control that fails on the one day it is pressed; the
   * placeholder is shown as the text it is, exactly as the venue placeholder is,
   * so an unfinished invitation cannot pass for a finished one.
   */
  it("does not offer a control for an address nobody has filled in", () => {
    render(
      <StreamDetails ceremony={{ ...CEREMONY, streamUrl: "{{MEET_URL}}" }} />,
    );

    expect(
      screen.queryByRole("link", { name: /Entrar a la transmisión/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("{{MEET_URL}}")).toBeInTheDocument();
  });
});

/**
 * THE BLOCK IS CENTRED, LIKE EVERY OTHER BLOCK ON THESE PAGES.
 *
 * The couple, with a screenshot of it: "esto debe quedar centrado."
 *
 * It was left-aligned, and the row holding the value used `justify-between` —
 * which pushed the address to one edge and the copy button to the other, with
 * the centred join and calendar buttons directly beneath. Two alignments in one
 * column reads as a mistake, because it is one.
 *
 * IT WAS RIGHT FOR TWO CREDENTIALS AND STOPPED BEING RIGHT FOR ONE. A meeting
 * id and a passcode are a column somebody's eye runs DOWN while typing into
 * another app, and a shared left edge is what makes that possible. There is one
 * value now, it is read once, and the thing below it is a button.
 */
describe("how the block is aligned", () => {
  /**
   * The row holding the ADDRESS, found by the address.
   *
   * `querySelector("dd")` was wrong and failed against a working component:
   * the first `dd` in the document belongs to the date/time line above, which
   * carries no alignment of its own. Locating the row by the value it holds is
   * what makes this test about the thing it names.
   */
  function valueRow(): HTMLElement {
    return screen.getByText(CEREMONY.streamUrl).closest("dd")!;
  }

  it("keeps the address and its copy control together, centred", () => {
    render(<StreamDetails ceremony={CEREMONY} />);

    expect(valueRow().className).toContain("justify-center");
    expect(valueRow().className).not.toContain("justify-between");
  });

  /**
   * AND NEITHER CALLER OVERRIDES IT BACK.
   *
   * Both passed `text-left` explicitly, which is why this could not be fixed
   * in one place: a component centred by default and left-aligned by every
   * caller is centred by nobody.
   */
  it("is centred by default, with no caller class needed", () => {
    const { container } = render(<StreamDetails ceremony={CEREMONY} />);

    expect(container.querySelector("dl")!.className).toContain("text-center");
  });
});
