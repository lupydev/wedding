import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  InvitationBody,
  type InvitationBodyInvitation,
  type InvitationBodyWedding,
} from "./InvitationBody";

/**
 * `InvitationBody` is the one component rendered by BOTH the public route
 * (`/i/[slug]`, after the phone gate) and the operator preview
 * (`/console/preview/[invitationId]`). Two implementations would drift, and the
 * operator would approve copy no guest ever sees.
 *
 * It is synchronous and props-only precisely so it can be tested here rather
 * than only through a browser, and so it cannot reach a database — which is
 * also what keeps a phone number structurally out of it.
 */
/**
 * The wedding's own facts, which the ROUTE supplies from the `ceremony` row.
 *
 * They were four module constants in the component until Work Unit 9. That put
 * half of the wedding in a row an operator can correct and half of it in a
 * JavaScript bundle only a redeploy can change — and the two halves could
 * disagree about the same day.
 */
const wedding: InvitationBodyWedding = {
  coupleNames: "Ana y Bruno",
  ceremonyDate: "sábado 14 de noviembre de 2026",
  venueName: "Hacienda La Ñapa",
  venueAddress: "Calle 12 #34-56, Barrio Centro",
};

const household: InvitationBodyInvitation = {
  // The joined short names a household is greeted by, which is what
  // `deriveGreetingName` produces — deliberately NOT one member's full name,
  // because the list below renders full names and the two must not collide.
  greetingName: "Ñoño, Aurelia y Tomás",
  rsvpDeadline: "2027-05-01",
  guests: [
    { id: "g1", fullName: "Ñoño Muñóz", isChild: false },
    { id: "g2", fullName: "Aurelia Muñóz", isChild: false },
    { id: "g3", fullName: "Tomás Muñóz", isChild: true },
  ],
};

describe("InvitationBody", () => {
  it("greets the household by its greeting name", () => {
    render(<InvitationBody invitation={household} wedding={wedding} />);

    expect(
      screen.getByRole("heading", { name: /Ñoño, Aurelia y Tomás/ }),
    ).toBeInTheDocument();
  });

  it("greets a different household by its own greeting name", () => {
    render(
      <InvitationBody
        invitation={{ ...household, greetingName: "Familia Restrepo" }}
        wedding={wedding}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Familia Restrepo/ }),
    ).toBeInTheDocument();
  });

  it("names every guest of the household", () => {
    render(<InvitationBody invitation={household} wedding={wedding} />);

    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);

    expect(names).toHaveLength(3);
    expect(names[0]).toContain("Ñoño Muñóz");
    expect(names[1]).toContain("Aurelia Muñóz");
    expect(names[2]).toContain("Tomás Muñóz");
  });

  it("names the household once, and never restates it", () => {
    // The greeting already names this household and the list below already
    // names every member. A count sentence and a second heading each said the
    // same fact a third and fourth time, which is how the section grew four
    // lines that all answer "who is this for?".
    render(<InvitationBody invitation={household} wedding={wedding} />);

    expect(
      screen.queryByText(/Esta invitación es para/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/es para \d+ personas?\./),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("La invitación es para vos."),
    ).not.toBeInTheDocument();

    // What survives: the greeting, and the members by name.
    expect(screen.getByText(household.greetingName)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("still names every member of a one-person household", () => {
    // The count sentence is gone, so a one-member invitation is carried by the
    // greeting and the single name — with no "1 persona" ration to get wrong.
    //
    // Deliberately guests[1] and not guests[0]: this fixture's first guest
    // shares the household's greeting name, which is the real shape of a solo
    // guest with no nickname. The list then repeats the greeting verbatim. That
    // is a live copy question for the visual design and NOT something to paper
    // over with a string comparison here — the list is the authoritative record
    // of who is invited, so it renders either way.
    render(
      <InvitationBody
        invitation={{ ...household, guests: [household.guests[1]] }}
        wedding={wedding}
      />,
    );

    expect(screen.queryByText(/personas?/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Aurelia Muñóz")).toBeInTheDocument();
  });

  it("states the confirmation deadline the household was given", () => {
    render(<InvitationBody invitation={household} wedding={wedding} />);

    expect(screen.getByText(/2027-05-01/)).toBeInTheDocument();
  });

  it("says nothing about a deadline when the household has none", () => {
    render(
      <InvitationBody
        invitation={{ ...household, rsvpDeadline: null }}
        wedding={wedding}
      />,
    );

    expect(screen.queryByText(/Confirmen/)).not.toBeInTheDocument();
  });

  /**
   * THE WEDDING'S FACTS ARE GIVEN TO THIS COMPONENT, NEVER WRITTEN INSIDE IT.
   *
   * Four module constants used to hold them, seeded with `{{...}}` placeholders
   * awaiting the couple. That was the right instinct — never invent a date — and
   * the wrong location: the `ceremony` row already held the ceremony's date and
   * the stream credentials, so the same wedding was described in two places, one
   * of which needed a deploy to correct. A fact stored twice is a fact that will
   * drift, which is how a reference project's WhatsApp template kept announcing
   * a venue the event had already left.
   */
  it("renders the couple, date, venue and address it is given", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    for (const value of Object.values(wedding)) {
      expect(container.textContent).toContain(value);
    }
  });

  it("renders a DIFFERENT wedding's facts when it is given different ones", () => {
    // The triangulation that makes the test above mean something: a component
    // still holding its own constants would pass the first assertion the moment
    // its constants happened to be the fixture.
    const { container } = render(
      <InvitationBody
        invitation={household}
        wedding={{
          coupleNames: "Camila y Dario",
          ceremonyDate: "viernes 3 de abril de 2027",
          venueName: "Casa del Río",
          venueAddress: "Vereda El Alto, kilómetro 4",
        }}
      />,
    );

    expect(container.textContent).toContain("Camila y Dario");
    expect(container.textContent).toContain("Casa del Río");
    expect(container.textContent).not.toContain("Ana y Bruno");
    expect(container.textContent).not.toContain("Hacienda La Ñapa");
  });

  it("renders a placeholder verbatim when that is what the row still holds", () => {
    // The couple may not have filled the row in yet, and an unfinished value must
    // stay visibly unfinished: prettifying or hiding it would turn an obviously
    // incomplete invitation into a plausible wrong one.
    const { container } = render(
      <InvitationBody
        invitation={household}
        wedding={{
          coupleNames: "{{COUPLE_NAMES}}",
          ceremonyDate: "{{CEREMONY_DATE}}",
          venueName: "{{VENUE_NAME}}",
          venueAddress: "{{VENUE_ADDRESS}}",
        }}
      />,
    );

    expect(container.textContent).toContain("{{COUPLE_NAMES}}");
    expect(container.textContent).toContain("{{VENUE_ADDRESS}}");
  });

  it("keeps the date and the venue apart, each under its own term", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );
    const terms = [...container.querySelectorAll("dt")].map(
      (term) => term.textContent,
    );
    const values = [...container.querySelectorAll("dd")].map(
      (value) => value.textContent,
    );

    expect(terms).toEqual(["Fecha", "Lugar", "Dirección"]);
    expect(values).toEqual([
      wedding.ceremonyDate,
      wedding.venueName,
      wedding.venueAddress,
    ]);
  });

  it("renders no phone number anywhere in its markup", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    // The prop type carries no phone field at all; this asserts the rendered
    // output too, including any attribute value.
    expect(container.innerHTML).not.toMatch(/\+?\d{7,}/);
  });

  it("matches its approved markup", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    // Drift guard: the operator preview and the public page render this exact
    // component, so a change here is a change to what every guest sees.
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("InvitationBody's RSVP slot", () => {
  it("renders whatever the route puts in the RSVP slot", () => {
    // A slot rather than the form itself: `components/**` may not reach into
    // `lib/server/**`, and the RSVP needs a bound Server Action and the
    // household's current answer. The route composes those; the body only
    // decides WHERE the answer belongs, which is after the guest list.
    render(
      <InvitationBody
        invitation={household}
        rsvp={<p>Aquí va la confirmación</p>}
        wedding={wedding}
      />,
    );

    expect(screen.getByText("Aquí va la confirmación")).toBeInTheDocument();
  });

  it("renders exactly as before when the route supplies nothing", () => {
    // The operator preview has no RSVP to show. An empty section or a stray
    // heading would put a control in the preview that no guest can use.
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    expect(container.innerHTML).toMatchSnapshot();
  });
});
