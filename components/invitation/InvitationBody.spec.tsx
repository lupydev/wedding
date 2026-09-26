import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RSVP_DEADLINE_TEXT } from "@/lib/domain/wedding-day";

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
};

/*
  A SECOND FIXTURE STOOD HERE, HOLDING THE DAY, THE VENUE AND ITS ADDRESS.

  It existed so two tests could assert those values were absent — from a
  component whose prop type no longer carries them, which made the assertions
  impossible to fail. What replaced them guards the LABELS, which were hard
  coded here and are what a restored list would bring back.
*/

const household: InvitationBodyInvitation = {
  // The joined short names a household is greeted by, which is what
  // `deriveGreetingName` produces — deliberately NOT one member's full name,
  // because the list below renders full names and the two must not collide.
  greetingName: "Ñoño, Aurelia y Tomás",
  guests: [
    { id: "g1", fullName: "Ñoño Muñóz", isChild: false },
    { id: "g2", fullName: "Aurelia Muñóz", isChild: false },
    { id: "g3", fullName: "Tomás Muñóz", isChild: true },
  ],
};

/**
 * THE CLOCK IS FROZEN FOR THE SNAPSHOTS, AND THAT IS NOT TIDINESS.
 *
 * The announcement this page now carries includes the COUNTDOWN, whose seconds
 * figure is different on every run. A snapshot of a live clock fails
 * immediately and for no reason anybody can act on — which is worse than no
 * guard, because a guard that cries wolf gets updated with `-u` without being
 * read, and that is precisely the failure mode these two tests exist to
 * prevent.
 *
 * Any fixed instant will do. This one is comfortably before the wedding, so
 * the counter renders figures rather than its arrived state.
 */
function freezeTheClock(): void {
  vi.useFakeTimers({ now: new Date("2026-09-22T11:00:00-05:00").getTime() });
}

describe("InvitationBody", () => {
  /**
   * THE ANNOUNCEMENT THE GATE MAKES, KEPT ON THE PAGE BEHIND IT.
   *
   * The couple, after reading both on a laptop: "quisiera que en esta última
   * página se conserve" — the greeting, "Nos casamos", the names, the day and
   * the counter.
   *
   * They are one tap apart, and the gate was the one that got the wedding
   * while the invitation behind it opened with a household's name and a line
   * of prose. A guest who answers the question is the one person guaranteed to
   * read this page, so it is the last place the announcement should be thin.
   *
   * SHARED, NOT REPRODUCED. `SaveTheDate` is the landing's own block and
   * already appears on `/` and on the gate; a fourth copy of those four
   * elements would match today and drift on the first tweak to any of them.
   */
  it("opens with the same announcement the gate makes", () => {
    render(<InvitationBody invitation={household} wedding={wedding} />);

    expect(
      screen.getByRole("heading", { name: "¡Hola, Ñoño, Aurelia y Tomás!" }),
    ).toBeInTheDocument();
    /*
      THE COUPLE'S NAMES COME FROM THE `ceremony` ROW, NOT FROM THE CONSTANT.

      `SaveTheDate` reads `COUPLE_NAMES` for the landing, where there is
      nothing else to read. This page already carried the operator's own value
      in a script line above the greeting, and a browser test requires a guest
      to see an edit made in the console. Rendering the block unchanged would
      have put two couple names on one page — and on the day somebody corrects
      a spelling in the console, two DIFFERENT ones.
    */
    expect(
      screen.getByRole("heading", { level: 1, name: wedding.coupleNames }),
    ).toBeInTheDocument();

    /*
      THE DAY IS IN THE ANNOUNCEMENT, EXACTLY AS THE GATE STATES IT.

      The couple read the two screens side by side and asked for one
      announcement, not two versions of it: "debería ser igual a la primera
      pantalla… para tener una misma consistencia."

      THIS REVERSES A DECISION I MADE IN U17, and the reversal is the right
      way round. I hid this line here because the details list stated the day
      too, and the two come from different places: this one from
      `WEDDING_INSTANT`, that one from the `ceremony` row an operator can
      correct. Hiding the one the guest reads FIRST to protect the one below it
      got the priority backwards — the announcement is the screen the gate
      already showed them, and it is the list that is redundant.
    */
    expect(screen.getByTestId("save-the-date-when")).toBeInTheDocument();

    // The counter stays, and it is the element that would have been quietly
    // left out: it is the one part of the announcement that is not copy.
    expect(screen.getByTestId("countdown-figures")).toBeInTheDocument();
  });

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

  /**
   * THE MEMBERS ARE NOT LISTED HERE ANY MORE, AND THAT IS A DELETION RATHER
   * THAN A MOVE.
   *
   * `.invitation__household` printed all three names in the body, and
   * `.rsvp__attendees` printed the same three as checkboxes inside the form.
   * Both rendered on the same screen once a household accepted — 93 pixels and
   * 194 pixels of the same information — on a page that was already two and a
   * half viewports tall on an iPhone.
   *
   * The checkboxes won because they are the ones a guest can act on: the
   * question the couple actually need answered is which of those people are
   * coming, and the list is the answer sheet. What the body keeps is the
   * greeting, which names the household without naming everybody in it.
   */
  it("lists no members of its own", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    for (const guest of household.guests) {
      expect(container.textContent).not.toContain(guest.fullName);
    }
  });

  it("names the household once, and never restates it", () => {
    // The greeting names this household. A count sentence, a second heading
    // and a list of members each said the same fact again, which is how the
    // section grew four lines that all answer "who is this for?".
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

    // What survives: the greeting, and nothing that repeats it.
    expect(
      screen.getByText(`¡Hola, ${household.greetingName}!`),
    ).toBeInTheDocument();
  });

  /**
   * THE GREETING CLEARS THE MUSIC CONTROL, AND THE NUMBER IS MEASURED.
   *
   * The control is fixed at `right-5` and is 44px across, so it owns the last
   * 64px of the row. The stage used to apply that gutter itself, to the
   * `overPhoto` slot this greeting replaced; with the slot gone the
   * measurement has to live somewhere, and the element that would run under
   * the control is this one.
   *
   * `px-10` on top of the article's `px-6` is exactly 64px, and it is
   * symmetric so a centred line stays centred.
   */
  it("keeps the greeting clear of the music control on a phone", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    const header = container.querySelector("header")!;

    expect(header.className).toContain("px-10");
    // And gives the gutter back above the breakpoint, where the words are in
    // their own column and the control is nowhere near them.
    expect(header.className).toContain("lg:px-0");
  });

  /**
   * ONE DEADLINE FOR THE WHOLE WEDDING, AND IT IS NO LONGER A PROP.
   *
   * It used to arrive per household — so the couple typed the same date into
   * every invitation they created, and one they forgot was an invitation that
   * said nothing and never closed. The "household with no deadline" case went
   * with it: there is one wedding, so there is always a deadline.
   *
   * Asserted against the domain constant rather than a literal, for the same
   * reason `SaveTheDate.spec.tsx` asserts against `COUPLE_NAMES`: this date is
   * going to be corrected at least once, and a spec holding a copy of it would
   * fail for the one reason a spec must never fail — the truth changed and the
   * test was still holding the old answer.
   */
  it("states the wedding's confirmation deadline, spelled for a person", () => {
    render(<InvitationBody invitation={household} wedding={wedding} />);

    expect(
      screen.getByText(new RegExp(RSVP_DEADLINE_TEXT)),
    ).toBeInTheDocument();
    // And not the machine's spelling of it, which is what used to be printed.
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument();
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
  it("renders the couple it is given", () => {
    // ONE fact now, not four. The day moved into the announcement and the venue
    // into the RSVP's affirmative branch; what this component still states on
    // its own authority is who is getting married.
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    expect(container.textContent).toContain(wedding.coupleNames);
  });

  it("renders a DIFFERENT wedding's facts when it is given different ones", () => {
    // The triangulation that makes the test above mean something: a component
    // still holding its own constants would pass the first assertion the moment
    // its constants happened to be the fixture.
    const { container } = render(
      <InvitationBody
        invitation={household}
        wedding={{ coupleNames: "Camila y Dario" }}
      />,
    );

    expect(container.textContent).toContain("Camila y Dario");
    expect(container.textContent).not.toContain("Ana y Bruno");
  });

  it("renders a placeholder verbatim when that is what the row still holds", () => {
    // The couple may not have filled the row in yet, and an unfinished value must
    // stay visibly unfinished: prettifying or hiding it would turn an obviously
    // incomplete invitation into a plausible wrong one.
    const { container } = render(
      <InvitationBody
        invitation={household}
        wedding={{ coupleNames: "{{COUPLE_NAMES}}" }}
      />,
    );

    expect(container.textContent).toContain("{{COUPLE_NAMES}}");
  });

  // The test that stood here read the body's own `dt`/`dd` pairs: Fecha, Lugar
  // and Dirección. The day is in the announcement now and the other two moved
  // into the RSVP's affirmative branch, where `RsvpAnswer.spec.tsx` asserts the
  // same property — each value under its own visible label.

  it("renders no phone number anywhere in its markup", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    // The prop type carries no phone field at all; this asserts the rendered
    // output too, including any attribute value.
    expect(container.innerHTML).not.toMatch(/\+?\d{7,}/);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches its approved markup", () => {
    freezeTheClock();

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
    freezeTheClock();

    // The operator preview has no RSVP to show. An empty section or a stray
    // heading would put a control in the preview that no guest can use.
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    expect(container.innerHTML).toMatchSnapshot();
  });
});

/**
 * THE DETAILS LIST IS GONE, AND THE DATE IS WHY.
 *
 * It held three labelled facts: Fecha, Lugar and Dirección. The day is now
 * stated by the announcement above, exactly as the gate states it, so the row
 * that repeated it had to go — and the two that remain answer a question a
 * household has not been asked yet. They moved into the RSVP's affirmative
 * branch, where somebody has just said they are coming.
 */
describe("what the body no longer states by itself", () => {
  /**
   * THE LABELS, NOT THE VALUES, AND THE DIFFERENCE IS WHETHER THIS CAN FAIL.
   *
   * The first version of these tests asserted that the venue's NAME and ADDRESS
   * were absent — values this component is no longer even given, since the prop
   * type carries `coupleNames` alone. An absence that the type already makes
   * impossible is not an assertion; it is a sentence. The review said so.
   *
   * The labels were hard-coded HERE, in the list this change removed. They are
   * the part somebody restoring that list would bring back, so they are the
   * part worth guarding — together with the list element itself, which is what
   * "the body states no facts of its own" actually means.
   */
  it("renders no details list of its own", () => {
    const { container } = render(
      <InvitationBody invitation={household} wedding={wedding} />,
    );

    for (const label of ["Fecha", "Lugar", "Dirección"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(container.querySelector("dl")).toBeNull();
  });
});
