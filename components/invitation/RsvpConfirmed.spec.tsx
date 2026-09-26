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
 * WHAT IT IS FOR: the three facts somebody who is coming has to act on — where,
 * when, and what to wear — and nothing else. It replaced a block that opened
 * INSIDE the form the moment the affirmative was chosen, above checkboxes that
 * still had to be ticked, which is what pushed the send button 322 pixels down
 * the page and made the accepted invitation two and a half viewports tall.
 *
 * Props-only and synchronous, so the whole of it can be asserted here.
 */
const VENUE = "Salón para Eventos La Ñapa";

function renderConfirmed(
  options: { memberCount?: number; onReconsider?: () => void } = {},
) {
  const onReconsider = options.onReconsider ?? vi.fn();

  render(
    <RsvpConfirmed
      memberCount={options.memberCount ?? 3}
      onReconsider={onReconsider}
      venueName={VENUE}
    />,
  );

  return onReconsider;
}

describe("RsvpConfirmed", () => {
  it("expects a household, and one guest, in their own number", () => {
    const { unmount } = render(
      <RsvpConfirmed
        memberCount={3}
        onReconsider={vi.fn()}
        venueName={VENUE}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Los esperamos" }),
    ).toBeInTheDocument();
    unmount();

    render(
      <RsvpConfirmed
        memberCount={1}
        onReconsider={vi.fn()}
        venueName={VENUE}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Te esperamos" }),
    ).toBeInTheDocument();
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

  it("renders an unfinished venue verbatim rather than hiding it", () => {
    // The row may still hold its seeded placeholder. An unfinished value must
    // stay visibly unfinished; hiding it turns an obviously incomplete
    // invitation into a plausible wrong one.
    render(
      <RsvpConfirmed
        memberCount={2}
        onReconsider={vi.fn()}
        venueName="{{VENUE_NAME}}"
      />,
    );

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
