import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

function renderConfirmed() {
  return render(<RsvpConfirmed venueName={VENUE} />);
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
    const { container } = renderConfirmed();

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
    const { container } = renderConfirmed();

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
   * AND IT NO LONGER SAYS SO IN WORDS, WHICH REVERSES U36.
   *
   * "Su respuesta quedó guardada." was kept against the couple's list and
   * flagged as theirs to overrule; they have overruled it. The assertion is
   * kept as a negative rather than deleted, because the argument for the line
   * was real — a guest who is not comfortable with phones has only the change
   * of screen to tell them the answer landed — and a sentence that quietly
   * reappears should be a decision rather than a merge.
   */
  it("does not say the answer was saved, because the couple removed it", () => {
    renderConfirmed();

    expect(screen.queryByText(/quedó guardada/)).not.toBeInTheDocument();
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
   * AND IT IS NOW THE ONLY CONTROL ON THE SCREEN AT ALL.
   *
   * "Solamente el botón de cómo llegar", read the way the couple have now
   * finished it: the escape hatch beside it is gone too, so this screen holds
   * one link and no buttons. Asserted by COUNT rather than by name, because
   * the failure worth catching is a second control appearing, whatever it
   * says.
   */
  it("offers one way to go and no other control beside it", () => {
    renderConfirmed();

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders an unfinished venue verbatim rather than hiding it", () => {
    // The row may still hold its seeded placeholder. An unfinished value must
    // stay visibly unfinished; hiding it turns an obviously incomplete
    // invitation into a plausible wrong one.
    render(<RsvpConfirmed venueName="{{VENUE_NAME}}" />);

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
  /**
   * THE SAME THREE FACTS, IN THE ANNOUNCEMENT'S VOICE RATHER THAN A SPEC
   * SHEET'S.
   *
   * These asserted the LABELS as well — `Cuándo`, `Código de vestimenta` —
   * because the block was a `dl` of label-over-value pairs. The couple said
   * the screen "se ve muy diferente a las demas y se ve un poco fea", and
   * that form was the cause: every other screen says its facts in one quiet
   * line of spaced caps under the couple's names. The labels are gone and
   * the facts are not, which is exactly what is asserted now.
   */
  it("states the day, the hour and what to wear", () => {
    renderConfirmed();

    const when = document.querySelector(".rsvp__when")!;

    expect(when.textContent).toContain(formatWeddingWeekday());
    expect(when.textContent).toContain(formatWeddingDate());
    expect(when.textContent).toContain(formatWeddingTime());
    expect(when.textContent).toContain(WEDDING_DRESS_CODE);
  });

  /**
   * AND IT SPEAKS THEM RATHER THAN LABELLING THEM.
   *
   * Asserted as an absence because the regression is a tidy-minded one:
   * label-over-value is the obvious way to present two facts, and it is the
   * shape the couple rejected by name.
   */
  it("labels nothing, the way the other three screens label nothing", () => {
    renderConfirmed();

    expect(screen.queryByText("Cuándo")).toBeNull();
    expect(screen.queryByText("Código de vestimenta")).toBeNull();
    expect(document.querySelector(".rsvp__when dt")).toBeNull();
    expect(document.querySelector(".rsvp__when dl")).toBeNull();
  });

  /**
   * AND IT COUNTS DOWN, WHICH IS WHAT THEY ASKED FOR FIRST.
   *
   * "Importante que en la ultima pagina de afirmacion tambien tenga la cuenta
   * regresiva." The same `Countdown` the landing and the other three screens
   * run, so it counts to the same instant rather than to a second reading of
   * the same date.
   */
  it("counts down to the ceremony, like every other screen", () => {
    renderConfirmed();

    const when = document.querySelector(".rsvp__when")!;

    expect(
      when.querySelector('[data-testid="countdown-figures"]'),
    ).not.toBeNull();
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
   * AND THE ANSWER IS NOW FINAL, WHICH IS THE HEAVIEST THING ON THE LIST.
   *
   * This screen used to carry "Volver a responder", the same escape the
   * stream screen offers, and the couple asked for it to go knowing what it
   * costs: an accepted household has no way to change its answer from inside
   * the invitation. A solo invitation records its acceptance on ONE tap, so a
   * mis-tap lands here permanently.
   *
   * Asserted as an absence, and deliberately not by deleting the test: the
   * declining screen keeps its own way back for a reason that has not
   * changed, and the two endings are now deliberately different. See
   * `CeremonyStream.spec.tsx`, which still asserts the positive.
   */
  it("offers no way back, which the couple chose knowing the cost", () => {
    renderConfirmed();

    expect(
      screen.queryByRole("button", { name: /Volver a responder/ }),
    ).not.toBeInTheDocument();
  });
});
