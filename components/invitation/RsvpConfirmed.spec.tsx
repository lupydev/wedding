import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  WEDDING_DRESS_CODE,
  formatWeddingDate,
  formatWeddingTime,
  formatWeddingWeekday,
} from "@/lib/domain/wedding-day";

import { RsvpConfirmed } from "./RsvpConfirmed";

/**
 * The screen a household reaches by saying yes.
 *
 * WHAT IT IS FOR: the three facts somebody who is coming has to act on — when,
 * what to wear, and where to go — and nothing else. It replaced a block that
 * opened INSIDE the form the moment the affirmative was chosen, above
 * checkboxes that still had to be ticked, which is what pushed the send button
 * 322 pixels down the page and made the accepted invitation two and a half
 * viewports tall.
 *
 * ITS HEADING IS NOT ITS OWN ANY MORE, which is why nothing here asserts one.
 * "Te esperamos, <name>" is the TOP LINE of the screen — the place every other
 * screen greets the household — so it is painted above this block by
 * `InvitationGreeting`, from the only component that knows this screen is
 * showing. `lib/domain/rsvp-copy.spec.ts` owns the words and
 * `RsvpAnswer.spec.tsx` owns which line appears when.
 *
 * Props-only and synchronous, so the whole of it can be asserted here.
 */
const VENUE = "Salón para Eventos La Ñapa";

function renderConfirmed(options: { onReconsider?: () => void } = {}) {
  const onReconsider = options.onReconsider ?? vi.fn();

  render(<RsvpConfirmed onReconsider={onReconsider} venueName={VENUE} />);

  return onReconsider;
}

describe("RsvpConfirmed", () => {
  /**
   * THE COUPLE'S OWN ORDER, ASSERTED AS AN ORDER RATHER THAN AS A LIST.
   *
   * "Te esperamos, nombre de la invitación, seguido la fecha y el código de
   * vestimenta y en la parte de abajo de la pantalla lugar y solamente el
   * botón de cómo llegar." Four `getByText` assertions would pass with the
   * blocks in any arrangement at all, including the one this screen replaced.
   */
  it("puts the day and the dress code above the place and the way there", () => {
    const { container } = render(
      <RsvpConfirmed onReconsider={vi.fn()} venueName={VENUE} />,
    );

    const order = Array.from(
      container.querySelectorAll(".rsvp__when, .rsvp__venue, .rsvp__venue-map"),
    ).map((element) =>
      // The first BEM-ish hook on the element, not the first token: these
      // class strings are multi-line template literals and open with
      // whitespace.
      Array.from(element.classList).find((token) =>
        token.startsWith("rsvp__"),
      )!,
    );

    expect(order).toEqual(["rsvp__when", "rsvp__venue", "rsvp__venue-map"]);
  });

  /**
   * AND THE TWO GROUPS ARE PUSHED APART RATHER THAN STACKED.
   *
   * `justify-between` is what puts "lugar y el botón de cómo llegar" at the
   * foot of the screen under a thumb instead of immediately under the dress
   * code with dead space below them. The map that used to fill the middle was
   * 188 pixels; the couple asked for it to go, and this is what the room it
   * left is spent on.
   */
  it("spreads its two groups to the ends of the screen", () => {
    const { container } = render(
      <RsvpConfirmed onReconsider={vi.fn()} venueName={VENUE} />,
    );

    expect(container.querySelector(".rsvp__confirmed")!.className).toContain(
      "justify-between",
    );
  });

  /**
   * THE PICTURE OF THE MAP IS GONE, AND THIS IS THE SCREEN IT WAS ON.
   *
   * "Solamente el botón de cómo llegar sin una imagen." `VenueMap.spec.tsx`
   * asserts the component renders none; this asserts nothing else on the
   * screen put one back, which is the failure that would actually reach a
   * guest.
   */
  it("shows no picture at all", () => {
    renderConfirmed();

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  /**
   * THE SCREEN CHANGING IS NOT A RECEIPT.
   *
   * The form's own "¡Listo! Guardamos su respuesta." appeared under the
   * controls the household had just used. Those controls are gone from this
   * screen, so a guest who is not comfortable with phones would otherwise have
   * nothing but a new heading to tell them the answer landed.
   */
  it("says the answer was saved, in words", () => {
    renderConfirmed();

    expect(
      screen.getByText("Su respuesta quedó guardada."),
    ).toBeInTheDocument();
  });

  it("names the place, under a label, and shows the way there", () => {
    renderConfirmed();

    expect(screen.getByText("Lugar")).toBeInTheDocument();
    expect(screen.getByText(VENUE)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Cómo llegar/ }),
    ).toBeInTheDocument();
  });

  /**
   * AND IT IS THE ONLY CONTROL DOWN THERE.
   *
   * "Solamente el botón de cómo llegar." The escape hatch back to the question
   * is not a second offer — it is the same `Volver a responder` both endings
   * carry, set as small underlined text rather than as a control competing
   * with this one.
   */
  it("offers one way to go and nothing else beside it", () => {
    renderConfirmed();

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renders an unfinished venue verbatim rather than hiding it", () => {
    // The row may still hold its seeded placeholder. An unfinished value must
    // stay visibly unfinished; hiding it turns an obviously incomplete
    // invitation into a plausible wrong one.
    render(<RsvpConfirmed onReconsider={vi.fn()} venueName="{{VENUE_NAME}}" />);

    expect(screen.getByText("{{VENUE_NAME}}")).toBeInTheDocument();
  });

  /**
   * THE DAY AND THE HOUR, AND THE HOUR HAD NEVER REACHED A GUEST BEFORE.
   *
   * `WEDDING_INSTANT` has carried five in the afternoon since the couple gave
   * it, and nothing printed it: the countdown consumed the instant and
   * migration 0018 dropped the `ceremony_time` column a household would have
   * read. This is the first surface that says it, which is why the couple were
   * asked to confirm it.
   *
   * Asserted against the formatters rather than a literal, for the reason
   * `wedding-day.spec.ts` gives: those functions are where the spelling is
   * pinned, and a second copy of the date here would be the one still holding
   * the old answer after the wedding moved.
   */
  it("states the day and the hour the household has to be there", () => {
    renderConfirmed();

    const when = document.querySelector(".rsvp__when")!;

    expect(screen.getByText("Cuándo")).toBeInTheDocument();
    expect(when.textContent).toContain(formatWeddingWeekday());
    expect(when.textContent).toContain(formatWeddingDate());
    expect(when.textContent).toContain(formatWeddingTime());
  });

  it("states what to wear", () => {
    renderConfirmed();

    expect(screen.getByText("Código de vestimenta")).toBeInTheDocument();
    expect(screen.getByText(WEDDING_DRESS_CODE)).toBeInTheDocument();
  });

  /**
   * AND NOT A STREET, BECAUSE THERE IS NOT ONE.
   *
   * The venue has no address anybody can type into a maps application —
   * `VenueMap` opens with that fact — so `Dirección` was a second answer to the
   * question the map already answers, and the one a guest cannot act on. In
   * production the row still held its seeded placeholder, so what that line
   * actually put on this screen was a pair of braces.
   *
   * The LABEL is what is asserted, because that is what somebody restoring the
   * line would bring back. The value is not a prop any more, which is the
   * stronger guard and the reason this one is cheap.
   */
  it("offers no street address, because the venue has none", () => {
    renderConfirmed();

    expect(screen.queryByText("Dirección")).not.toBeInTheDocument();
  });

  /**
   * THE ANSWER IS NEVER FINAL.
   *
   * A solo invitation records its acceptance on one tap, so a mis-tap lands
   * here. The way back sits beside the consequence, exactly as it does on the
   * stream screen, and in the same words — responses are append-only, so a
   * correction writes a new row and the couple still see that the household
   * changed its mind.
   */
  it("offers the way back, in the same words the stream screen uses", async () => {
    const onReconsider = renderConfirmed();

    await userEvent.click(
      screen.getByRole("button", { name: "Volver a responder" }),
    );

    expect(onReconsider).toHaveBeenCalledTimes(1);
  });
});
