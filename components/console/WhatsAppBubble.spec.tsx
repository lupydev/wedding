import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MESSAGE_PREVIEW_APPROXIMATE_LABEL,
  MESSAGE_PREVIEW_DIVERGENCES,
  READ_MORE_APPROX_CHARACTERS,
} from "@/lib/domain/message-preview";

import { WhatsAppBubble, type WhatsAppBubbleProps } from "./WhatsAppBubble";

/**
 * The mock chat bubble.
 *
 * Its one real claim is the IMAGE: everything else is chrome the operator is
 * told to treat as approximate, but the card image is the actual bytes WhatsApp
 * will fetch. That claim holds only while the `<img>` points at the URL the
 * invitation page ADVERTISES — hash query and all — because a CDN keys its
 * cache on the full URL. The bare route path is a second cache entry and a
 * cache-busted URL is a third; either would show the operator a real card while
 * warming an entry no crawler ever requests.
 *
 * So the src is asserted here character by character. It is the one property of
 * this component that a refactor can silently destroy while everything still
 * looks correct on screen.
 */
const ADVERTISED_PATH = "/i/k7q2m9xr4tabcdef/opengraph-image?88f8dd536f697fc4";

const PROPS: WhatsAppBubbleProps = {
  messageText:
    "Hola, Familia Muñóz. Nos alegra mucho invitarlos a nuestra boda. " +
    "En este enlace encontrarán la invitación: https://boda.example.test/i/k7q2m9xr4tabcdef",
  waUrl: "https://wa.me/573001234567?text=Hola%2C%20Familia%20Mu%C3%B1%C3%B3z.",
  cardImagePath: ADVERTISED_PATH,
  cardTitle: "Familia Muñóz",
  cardDescription: "Nos casamos — {{COUPLE_NAMES}}",
  cardLinkLabel: "boda.example.test",
};

describe("WhatsAppBubble — the card image", () => {
  it("points the image at the advertised card URL, query included", () => {
    render(<WhatsAppBubble {...PROPS} />);

    expect(screen.getByRole("img")).toHaveAttribute("src", ADVERTISED_PATH);
  });

  it("points a different invitation's bubble at its own advertised URL", () => {
    render(
      <WhatsAppBubble
        {...PROPS}
        cardImagePath="/i/zzzzzzzzzzzzzzzz/opengraph-image?88f8dd536f697fc4"
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/i/zzzzzzzzzzzzzzzz/opengraph-image?88f8dd536f697fc4",
    );
  });

  it("adds no cache-busting parameter of its own", () => {
    const { container } = render(<WhatsAppBubble {...PROPS} />);

    // A `?t=...` appended here would be a third CDN cache key, warmed by
    // nobody, and the preview would stop being the crawler's fetch.
    expect(container.innerHTML).not.toMatch(/opengraph-image[^"']*[?&]t=/);
    expect(container.innerHTML).not.toMatch(/opengraph-image[^"']*[?&]cb=/);
    expect(container.innerHTML).not.toMatch(/opengraph-image[^"']*[?&]_=/);
  });

  it("does not truncate the advertised query to the bare route path", () => {
    const { container } = render(<WhatsAppBubble {...PROPS} />);

    expect(container.innerHTML).not.toContain(
      'src="/i/k7q2m9xr4tabcdef/opengraph-image"',
    );
  });

  it("matches its approved markup", () => {
    const { container } = render(<WhatsAppBubble {...PROPS} />);

    expect(container.innerHTML).toMatchSnapshot();
  });

  it("says the card cannot be previewed when the URL could not be resolved", () => {
    // Resolution failed, so which URL the crawler will fetch is unknown.
    // Guessing the bare path would warm the wrong entry and quietly assert
    // something untrue, so the pane says it does not know instead.
    render(<WhatsAppBubble {...PROPS} cardImagePath={null} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/no se pudo cargar la tarjeta/i)).toBeVisible();
  });

  it("still renders the message text when the card cannot be resolved", () => {
    // The card is the fragile half. The draft is the half the operator most
    // needs to read before sending, and it must not disappear with it.
    render(<WhatsAppBubble {...PROPS} cardImagePath={null} />);

    expect(screen.getByText(/Nos alegra mucho invitarlos/)).toBeVisible();
  });
});

describe("WhatsAppBubble — what it shows the operator", () => {
  it("renders the exact prefilled message text", () => {
    render(<WhatsAppBubble {...PROPS} />);

    expect(screen.getByText(PROPS.messageText)).toBeVisible();
  });

  it("renders the raw wa.me URL, encoded exactly as it will be opened", () => {
    render(<WhatsAppBubble {...PROPS} />);

    expect(screen.getByText(PROPS.waUrl)).toBeVisible();
  });

  it("renders the card's title and description as WhatsApp will read them", () => {
    render(<WhatsAppBubble {...PROPS} />);

    expect(screen.getByText("Familia Muñóz")).toBeVisible();
    expect(screen.getByText("Nos casamos — {{COUPLE_NAMES}}")).toBeVisible();
  });

  it("states the character count of the draft", () => {
    render(<WhatsAppBubble {...PROPS} />);

    expect(
      screen.getByText(new RegExp(`${PROPS.messageText.length} caracteres`)),
    ).toBeVisible();
  });

  it("warns when the draft is long enough to be folded", () => {
    // Matched against the LENGTH sentence specifically. The standing disclosure
    // list also mentions folding, and a bare text query would pass on that
    // alone — a green that proves the caveat exists, not that the draft was
    // measured.
    const { container } = render(
      <WhatsAppBubble
        {...PROPS}
        messageText={"a".repeat(READ_MORE_APPROX_CHARACTERS + 1)}
      />,
    );

    expect(container.querySelector(".wa-preview__length")!.textContent).toMatch(
      /Ver más/,
    );
  });

  it("does not warn about folding for an ordinary draft", () => {
    const { container } = render(<WhatsAppBubble {...PROPS} />);

    expect(
      container.querySelector(".wa-preview__length")!.textContent,
    ).not.toMatch(/Ver más/);
  });

  it("offers no link to wa.me, only the URL as text", () => {
    // A clickable `wa.me` here would be a second route to the send that records
    // no `link_opened` event at all — and the one an operator would reach for.
    const { container } = render(<WhatsAppBubble {...PROPS} />);

    expect(container.querySelector('a[href^="https://wa.me/"]')).toBeNull();
  });

  it("renders no phone number of its own", () => {
    // The recipient's number is inside the `wa.me` URL the operator is shown on
    // purpose; nothing else in the pane may carry one.
    render(<WhatsAppBubble {...PROPS} />);

    const withoutTheLink = screen
      .getByRole("region", { name: /vista previa del mensaje/i })
      .textContent!.replace(PROPS.waUrl, "");

    expect(withoutTheLink).not.toMatch(/\d{7,}/);
  });
});

describe("WhatsAppBubble — the approximation disclosure", () => {
  it("labels the whole pane as approximate and device-dependent", () => {
    render(<WhatsAppBubble {...PROPS} />);

    expect(screen.getByText(MESSAGE_PREVIEW_APPROXIMATE_LABEL)).toBeVisible();
  });

  it("states every known divergence, not a summary of them", () => {
    render(<WhatsAppBubble {...PROPS} />);

    for (const divergence of MESSAGE_PREVIEW_DIVERGENCES) {
      expect(screen.getByText(divergence)).toBeVisible();
    }
  });

  it("keeps the disclosure visible rather than behind a control", () => {
    // A collapsed `<details>` is a disclosure nobody reads, and the operator
    // most likely to over-trust the mock is the one who will not open it.
    const { container } = render(<WhatsAppBubble {...PROPS} />);

    expect(container.querySelector("details")).toBeNull();
  });
});
