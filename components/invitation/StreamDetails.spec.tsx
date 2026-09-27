import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StreamDetails, type StreamDetailsValues } from "./StreamDetails";

const CEREMONY: StreamDetailsValues = {
  streamUrl: "https://meet.google.com/abc-defg-hij",
  coupleNames: "Luis & Michell",
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
  // The test that stood here read the label/value pairs of a description
  // list. There is no list and no printed value now — see "what the block
  // holds now" below, which asserts the control instead.

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

  // The copy-to-clipboard suite stood here. It covered a button that existed
  // to remove the typing of a meeting id; a link is pressed, not typed, and
  // the button went with the printed address.

  /**
   * THE DAY AND THE HOUR ARE NOT HERE AT ALL, AND NO PROP CAN BRING THEM BACK.
   *
   * They used to be optional, behind `showDate` and `showTime`, both defaulting
   * to TRUE — and every real caller passed false. `StreamInvitation` and
   * `CeremonyStream` are the only two, and `RsvpAnswer` reaches this block only
   * through the second of them, so the default was never once exercised by a
   * page a guest can open.
   *
   * A default nothing takes is not a safe default: it is a branch that renders
   * only in this file, and it kept two columns alive in the schema, the read
   * model, the console form and every fixture that had to name them.
   *
   * So the block is stated with no props at all. Passing none is what every
   * caller already did in effect, and there is now nothing else to pass.
   */
  it("states no day and no hour, with nothing to switch off", () => {
    render(<StreamDetails ceremony={CEREMONY} />);

    // `term` is the role a `<dt>` carries, and the date and the hour were the
    // only labelled values left in this block. None means no line.
    expect(screen.queryAllByRole("term")).toHaveLength(0);
    expect(screen.queryAllByRole("definition")).toHaveLength(0);
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
  // The row holding the address beside its copy control is gone with both of
  // them. What the block's alignment means now is covered by the two tests
  // below, which are about the container rather than about that row.

  /**
   * AND NEITHER CALLER OVERRIDES IT BACK.
   *
   * Both passed `text-left` explicitly, which is why this could not be fixed
   * in one place: a component centred by default and left-aligned by every
   * caller is centred by nobody.
   */
  it("is centred by default, with no caller class needed", () => {
    const { container } = render(<StreamDetails ceremony={CEREMONY} />);

    expect(screen.getByTestId("stream-details").className).toContain(
      "text-center",
    );
  });

  /**
   * AND A CALLER'S CLASS IS ADDED TO THAT, NOT PUT IN ITS PLACE.
   *
   * This is the actual mechanism, and it was changed without being asserted:
   * the `<dl>` read `className ?? "rsvp__stream-details"`, so whatever a caller
   * passed REPLACED the component's own classes. Both callers passed
   * `text-left`, and the alignment became undecidable here. Restoring the
   * substitution would pass both tests above — a caller passing nothing is
   * still centred — so this is the one that would catch it.
   */
  it("keeps its own classes when a caller adds spacing of its own", () => {
    const { container } = render(
      <StreamDetails ceremony={CEREMONY} className="w-full max-w-sm" />,
    );

    // The OUTER container, which is a `div` now: the description list is only
    // rendered for the optional date/time line, where labels still have values.
    const list = screen.getByTestId("stream-details");

    expect(list.className).toContain("text-center");
    expect(list.className).toContain("w-full max-w-sm");
  });
});

/**
 * THE ADDRESS ITSELF IS GONE, AND THE BUTTON IS THE WHOLE BLOCK.
 *
 * The couple: "en vista de que existe un botón de ingresar a la reunión no
 * valdría la pena tener el link para copiar, entonces eso se puede quitar."
 *
 * They are right, and the argument I made for keeping it does not survive
 * contact with the page. It was: a guest on a laptop joins from their phone,
 * one who cannot join forwards it, and a destination nobody can see is a
 * destination nobody can check. But `/transmision` is a PUBLIC page whose whole
 * content is this control — forwarding the page does everything forwarding the
 * address did, and carries the day and the counter with it.
 *
 * What is genuinely lost is narrower: a household behind the phone gate who
 * wants the address on a second device has to open their invitation there
 * rather than paste a link. That is a real cost and a small one.
 *
 * AND THE CONTAINER STOPPED BEING A `<dl>`. It held one term and one
 * definition; with those gone it would have been a description list describing
 * nothing, which is invalid markup rather than merely odd. The optional
 * date/time line keeps its own list, where the labels still have values.
 */
describe("what the block holds now", () => {
  it("offers the control and not the address to copy", () => {
    render(<StreamDetails ceremony={CEREMONY} />);

    expect(
      screen.getByRole("link", { name: /Entrar a la transmisión/ }),
    ).toHaveAttribute("href", CEREMONY.streamUrl);
    expect(screen.queryByText(CEREMONY.streamUrl)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copiar/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * AND AN UNFINISHED ROW STILL SAYS SO.
   *
   * With the address no longer printed, a placeholder that rendered nothing at
   * all would leave the page looking finished and the button pointing nowhere.
   * The marker is shown as the text it is, and no control is offered.
   */
  it("says the link is missing rather than offering a dead control", () => {
    render(
      <StreamDetails ceremony={{ ...CEREMONY, streamUrl: "{{MEET_URL}}" }} />,
    );

    expect(
      screen.queryByRole("link", { name: /Entrar a la transmisión/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("{{MEET_URL}}")).toBeInTheDocument();
  });
});
