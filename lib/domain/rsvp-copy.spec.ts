import { describe, expect, it } from "vitest";

import {
  rsvpChoiceCopy,
  RSVP_CLOSED_MESSAGE,
  currentRsvpSentence,
  rsvpConfirmedHeading,
  rsvpDeclinedHeading,
  invitationSizeSentence,
  rsvpClosedNote,
  rsvpDeadlineSentence,
  rsvpReconsiderSentence,
  rsvpFeedbackMessages,
} from "./rsvp-copy";
import { RSVP_DEADLINE_TEXT } from "./wedding-day";

/**
 * What the RSVP says to a guest, as pure text.
 *
 * Here rather than inside the component for the same reason the gate's copy is:
 * pluralization and the "you already answered" sentence are real logic, and a
 * guest-facing string is worth asserting exactly once, in Spanish, where a
 * reader can see all of it at the same time.
 *
 * Unlike the gate, this surface has no secret to protect — the guest is already
 * through the gate and is reading their own household's invitation — so a
 * rejection here SHOULD say what is wrong. A form that refuses without telling
 * the guest which box to change is a form nobody completes.
 */

describe("rsvpFeedbackMessages", () => {
  it("says nothing before the first submission", () => {
    expect(rsvpFeedbackMessages({ status: "idle" })).toEqual([]);
  });

  it("confirms a recorded answer", () => {
    expect(rsvpFeedbackMessages({ status: "recorded" })).toEqual([
      "¡Listo! Guardamos su respuesta.",
    ]);
  });

  it("tells a guest whose session expired to open the link again", () => {
    expect(rsvpFeedbackMessages({ status: "not_authorized" })).toEqual([
      "Tu sesión ya no está activa. Abre de nuevo el enlace de la invitación y confirma tu número.",
    ]);
  });

  it("uses the same closed message the page shows after the deadline", () => {
    expect(rsvpFeedbackMessages({ status: "closed" })).toEqual([
      RSVP_CLOSED_MESSAGE,
    ]);
  });

  it("names the seat cap when too many people were selected", () => {
    // Both reasons mean the same thing to a guest — more people than seats —
    // and the domain reports them separately because the DB does.
    for (const reason of [
      "seats_exceed_allowed",
      "attendees_exceed_allowed",
    ] as const) {
      expect(rsvpFeedbackMessages({ status: "rejected", reason })).toEqual([
        "Seleccionaron más personas de las que tenemos reservadas para ustedes.",
      ]);
    }
  });

  it("asks for at least one person when attending with nobody selected", () => {
    expect(
      rsvpFeedbackMessages({
        status: "rejected",
        reason: "attending_without_seats",
      }),
    ).toEqual(["Selecciona quiénes asisten, al menos una persona."]);
  });

  it("falls back to one clear sentence for every other rejection", () => {
    // These reasons describe a form that could not have produced them: seats are
    // derived from the checkboxes, so a mismatch means the submission was not
    // sent by the form. The guest still gets an actionable sentence.
    for (const reason of [
      "invalid_input",
      "unknown_guest",
      "duplicate_attendees",
      "declined_with_seats",
      "seats_do_not_match_attendees",
      "seats_negative",
      "seats_not_an_integer",
    ] as const) {
      expect(rsvpFeedbackMessages({ status: "rejected", reason })).toEqual([
        "No pudimos guardar la respuesta. Revisa las opciones e inténtalo de nuevo.",
      ]);
    }
  });
});

/*
  "seatsSelectionSentence" STOOD HERE WITH FOUR ASSERTIONS ABOUT ITS WORDING.

  The couple deleted the sentence from the screen that asks who is coming, so
  the function went with it — `lib/domain/rsvp-copy.ts` records why. A spec
  that pins the wording of a sentence nothing renders is a spec about
  nothing, and keeping it would have made the function look like a live part
  of the product.
*/

describe("currentRsvpSentence", () => {
  it("reports an accepted answer with its seat count", () => {
    expect(currentRsvpSentence({ attending: true, seatsConfirmed: 2 })).toBe(
      "Tu respuesta actual: asisten 2 personas.",
    );
  });

  it("uses the singular for one confirmed seat", () => {
    expect(currentRsvpSentence({ attending: true, seatsConfirmed: 1 })).toBe(
      "Tu respuesta actual: asiste 1 persona.",
    );
  });

  it("reports a decline without a count", () => {
    expect(currentRsvpSentence({ attending: false, seatsConfirmed: 0 })).toBe(
      "Tu respuesta actual: no pueden acompañarnos.",
    );
  });

  it("says nothing at all when the household has not answered", () => {
    // Not an empty-ish placeholder: the form must show no prior answer where
    // there is none, or a guest reads someone else's state into their own page.
    expect(currentRsvpSentence(null)).toBeNull();
  });
});

/**
 * WHO THE INVITATION IS SPEAKING TO, AND THE NUMBER IT SPEAKS IN.
 *
 * The couple, once: "si la invitación es para 1 sola persona deberá decir 'Sí,
 * allá estaré' y 'No puedo acompañarlos', y si la invitación es para 2 o más
 * debe decir 'Sí, allá estaremos' y 'No podemos acompañarlos'." Every line had
 * been plural, because every invitation was assumed to be a household, and a
 * guest invited alone was answering in a voice that was not theirs on the one
 * page in the product addressed to them by name.
 *
 * AND THE COUPLE, LATER, FOR THE AFFIRMATIVE ALONE: it is "¡Sí, acepto!" now,
 * the same line whatever the number. That reverses half of the decision above
 * and it is theirs to make; what this file can do is hold the result where it
 * can be read, so that the mixture is visible rather than accidental — a
 * household is asked "¿Podrán acompañarnos?" and offered "¡Sí, acepto!"
 * beside "No podemos acompañarlos".
 *
 * IN THE DOMAIN, NOT IN THE COMPONENT. This is the second place a count has
 * decided a Spanish ending — `currentRsvpSentence` is the other, now that
 * `seatsSelectionSentence` is gone — and both live here, where they can be
 * read against each other and tested without a DOM.
 */
describe("rsvpChoiceCopy", () => {
  it("speaks to one person in the singular", () => {
    expect(rsvpChoiceCopy(1)).toEqual({
      question: "¿Podrás acompañarnos?",
      yes: "¡Sí, acepto!",
      no: "No puedo acompañarlos",
    });
  });

  it("speaks to a household in the plural", () => {
    expect(rsvpChoiceCopy(2)).toEqual({
      question: "¿Podrán acompañarnos?",
      yes: "¡Sí, acepto!",
      no: "No podemos acompañarlos",
    });
  });

  /**
   * THE AFFIRMATIVE IS ONE LINE FOR EVERYBODY, AND THE OPENING MARK IS PART
   * OF IT.
   *
   * Asserted on its own rather than left implicit in the two objects above,
   * because both halves are easy to lose quietly. A future edit that
   * re-inflected the yes would still satisfy a test that only compared each
   * number against itself; and a "Sí, acepto!" written with the closing mark
   * alone is a typo nobody catches by reading, on the one control the whole
   * screen exists to have pressed.
   */
  it("offers the same affirmative to one guest and to a household", () => {
    expect(rsvpChoiceCopy(1).yes).toBe("¡Sí, acepto!");
    expect(rsvpChoiceCopy(5).yes).toBe(rsvpChoiceCopy(1).yes);
  });

  it("keeps the plural for every size above two", () => {
    for (const memberCount of [3, 4, 9]) {
      expect(rsvpChoiceCopy(memberCount)).toEqual(rsvpChoiceCopy(2));
    }
  });

  /**
   * AND AN EMPTY INVITATION READS AS A HOUSEHOLD.
   *
   * It cannot happen — an invitation with no members is refused long before
   * this — but a count of zero must not fall into the singular by arithmetic
   * accident and address a group as one person.
   */
  it("treats a count it should never see as a household", () => {
    expect(rsvpChoiceCopy(0)).toEqual(rsvpChoiceCopy(2));
  });
});

/**
 * THE DEADLINE, MOVED OUT OF THE FOOTNOTES AND INTO THE QUESTION.
 *
 * It used to be one `text-xs` line at `70%` opacity, at the bottom of a page
 * two and a half screens tall on a phone. A household that never scrolled never
 * saw it, and the couple asked for it to be part of what a guest is being
 * asked: "confirmen antes del 21 de noviembre".
 */
describe("rsvpDeadlineSentence", () => {
  it("asks a household in the plural", () => {
    expect(rsvpDeadlineSentence(3)).toBe(
      "Confirmen antes del 21 de noviembre de 2026.",
    );
  });

  it("asks one guest in the singular", () => {
    expect(rsvpDeadlineSentence(1)).toBe(
      "Confirma antes del 21 de noviembre de 2026.",
    );
  });

  /**
   * THE DATE IS DERIVED, NOT SPELLED HERE.
   *
   * The assertions above name the day so a reader can see the whole Spanish
   * sentence in one place, which is what this file is for — but naming it is
   * also how a second source of truth starts. This binds the sentence to the
   * constant, so moving the wedding moves both the sentence and the server-side
   * gate together or fails here.
   */
  it("carries the deadline the rest of the product enforces", () => {
    expect(rsvpDeadlineSentence(3)).toContain(RSVP_DEADLINE_TEXT);
    expect(rsvpDeadlineSentence(1)).toContain(RSVP_DEADLINE_TEXT);
  });

  it("treats a count it should never see as a household", () => {
    expect(rsvpDeadlineSentence(0)).toBe(rsvpDeadlineSentence(2));
  });
});

/**
 * THE TOP LINE OF THE LAST SCREEN, IN THE COUPLE'S OWN WORDS.
 *
 * "En vez de decir: hola, nombre de la invitación debería ser para la
 * invitación individual **Te esperamos** nombre de la invitación y si la
 * invitación es 2 personas o más debería decir: **Los esperamos** nombre de la
 * invitación." It replaces the greeting rather than sitting under it, which is
 * why it carries the name itself instead of leaving it to the line above.
 */
describe("rsvpConfirmedHeading", () => {
  it("expects a household, and names it", () => {
    expect(rsvpConfirmedHeading(4, "Familia Restrepo")).toBe(
      "Los esperamos, Familia Restrepo",
    );
  });

  it("expects one guest, and names them", () => {
    expect(rsvpConfirmedHeading(1, "Camila")).toBe("Te esperamos, Camila");
  });

  /**
   * THE NUMBER IS THE INVITATION'S, WHICH IS NOT THE SAME QUESTION AS "HOW
   * MANY ARE COMING".
   *
   * The caller passes `guests.length`, and this asserts the shape of that
   * contract from the copy's side: the function has no way to be told how many
   * seats were confirmed, so no future edit can quietly make the line depend
   * on it. `RsvpAnswer.spec.tsx` asserts the same rule from the component's
   * side, where the two numbers can actually differ.
   */
  it("takes a membership and nothing about the answer", () => {
    expect(rsvpConfirmedHeading.length).toBe(2);
  });

  it("treats a count it should never see as a household", () => {
    expect(rsvpConfirmedHeading(0, "Familia Ossa")).toBe(
      rsvpConfirmedHeading(2, "Familia Ossa"),
    );
  });

  /**
   * NO EXCLAMATION MARKS, AND A VOCATIVE COMMA.
   *
   * The couple wrote it flat and the register of this surface is flat. "¡Te
   * esperamos!" is shouted at somebody who has just answered politely, and a
   * Spanish exclamation that opened without `¡` would be the kind of small
   * wrongness a guest notices and cannot name.
   */
  it("is written the way the rest of this surface is written", () => {
    const line = rsvpConfirmedHeading(3, "Familia Aguirre");

    expect(line).not.toMatch(/[¡!]/);
    expect(line).toMatch(/^Los esperamos, /);
    expect(line.endsWith(".")).toBe(false);
  });
});

/**
 * AND THE OTHER ENDING, WHICH IS THE SAME LINE IN THE OTHER DIRECTION.
 *
 * "Los vamos a extrañar, {name}" — what a household reads after saying they
 * cannot come. It replaced two things at once: the greeting that opened that
 * screen and the "Los esperamos por Google Meet" heading below it, neither
 * of which said the thing the screen is for.
 *
 * ASSERTED AS A PAIR, deliberately. These two lines are the two endings of
 * one invitation and the couple wrote them as a pair; a change to the number
 * rule, the comma or the register in one of them is a change that should be
 * made in both, and the assertion below is what tells the next reader so.
 */
describe("rsvpDeclinedHeading", () => {
  it("misses a household, and names it", () => {
    expect(rsvpDeclinedHeading(4, "Familia Restrepo")).toBe(
      "Los vamos a extrañar, Familia Restrepo",
    );
  });

  it("misses one guest, and names them", () => {
    expect(rsvpDeclinedHeading(1, "Camila")).toBe(
      "Te vamos a extrañar, Camila",
    );
  });

  it("takes a membership and nothing about the answer", () => {
    expect(rsvpDeclinedHeading.length).toBe(2);
  });

  it("treats a count it should never see as a household", () => {
    expect(rsvpDeclinedHeading(0, "Familia Ossa")).toBe(
      rsvpDeclinedHeading(2, "Familia Ossa"),
    );
  });

  it("is written the way its twin is written", () => {
    const line = rsvpDeclinedHeading(3, "Familia Aguirre");

    expect(line).not.toMatch(/[¡!]/);
    expect(line).toMatch(/^Los vamos a extrañar, /);
    expect(line.endsWith(".")).toBe(false);
  });

  /**
   * THE PAIR ITSELF, asserted rather than described: both endings switch on
   * the same number, at the same boundary, and neither of them shouts.
   */
  it("turns singular at the same place its twin does", () => {
    for (const memberCount of [1, 2, 3, 4]) {
      const expected = memberCount === 1 ? /^Te / : /^Los /;

      expect(rsvpDeclinedHeading(memberCount, "X")).toMatch(expected);
      expect(rsvpConfirmedHeading(memberCount, "X")).toMatch(expected);
    }
  });
});

/**
 * HOW MANY PEOPLE THE INVITATION IS FOR, SAID OUT LOUD, BECAUSE GUESTS WERE
 * READING IT AS AN OPEN DOOR.
 *
 * The couple started sending invitations and came back with this: "las
 * personas estan interpretando que van a poder invitar a mas personas."
 * Nothing on the accepted screen ever said how big the invitation was, so
 * "¿Podrán acompañarnos?" read to some households as an invitation they could
 * extend. Their fix, in their words: "agregar que la invitacion es para la
 * cantidad de personas a la cual se agrego de invitados por invitacion para
 * que sea mas especifica."
 *
 * IT KEYS OFF THE INVITATION, NOT THE ANSWER, which is the same rule
 * `rsvpConfirmedHeading` above is written to and the reason this sits beside
 * it. A household of three that ticks two still reads three: three is the
 * ceiling they are being told about, and saying it also quietly invites the
 * third back. The signature carries one number and it is `guests.length`, so
 * there is nothing else it could accidentally become.
 */
describe("invitationSizeSentence", () => {
  it("counts the seats a household was given", () => {
    expect(invitationSizeSentence(3)).toBe(
      "Reservamos tres lugares para ustedes.",
    );
  });

  /**
   * AND THE SOLO LINE IS THE ONE DOING THE WORK, which is why it is not the
   * plural with an `s` taken off.
   *
   * Since `1e460f8` an invitation naming one person confirms on the first tap
   * and never passes through `¿Quiénes asisten?`. A household of two or three
   * meets its own members by name on that screen, so the set is explicit
   * there whatever this line says; a solo guest sees no list, no name and no
   * number anywhere in the flow. "un lugar para ti" states the number in
   * words and the person in the second person singular, which is the whole
   * message in four words.
   */
  it("says it to one guest in the second person singular", () => {
    expect(invitationSizeSentence(1)).toBe("Reservamos un lugar para ti.");
  });

  it("takes a membership and nothing about the answer", () => {
    expect(invitationSizeSentence.length).toBe(1);
  });

  /**
   * NO DIGIT ANYWHERE IN THE RANGE THIS PRODUCT CAN PRODUCE, AND THAT IS A
   * CONTRACT WITH ANOTHER FILE RATHER THAN A PREFERENCE.
   *
   * This sentence is interpolated into the WhatsApp draft, and
   * `dispatch-message.spec.ts` asserts that the only digits a rendered
   * message contains are the ones inside the invitation URL — the property
   * that keeps a date or a street number out of an approved template. A
   * numeral here would punch a hole straight through it, so the words are
   * load-bearing and this is where that is checked.
   */
  it("spells every size out, so the WhatsApp draft stays digit-free", () => {
    for (let memberCount = 0; memberCount <= 10; memberCount += 1) {
      expect(invitationSizeSentence(memberCount)).not.toMatch(/\d/);
    }
  });

  /**
   * ZERO SAYS "cero lugares", AND THAT IS THE DELIBERATE FAILURE MODE.
   *
   * Every other function in this file treats a count it should never see as a
   * household, because being wrong in the plural costs nothing when the
   * number is not printed. Here it IS printed, so there is no harmless
   * branch: "un lugar" for an empty invitation would be a plausible lie, and
   * "cero lugares" is visibly broken. An invitation with no members is
   * refused long before this is reached; if one ever arrives, the screen
   * should say so rather than invent a seat.
   */
  it("does not invent a seat for an invitation that has none", () => {
    expect(invitationSizeSentence(0)).toBe(
      "Reservamos cero lugares para ustedes.",
    );
  });

  /**
   * IT IS A SENTENCE, SO IT IS PUNCTUATED LIKE ONE — and it still does not
   * shout. The two headings take no full stop because they are headings;
   * `rsvpDeadlineSentence` takes one because it is a sentence, and so is
   * this.
   */
  it("is written the way the rest of this surface is written", () => {
    for (const memberCount of [1, 2, 3, 4]) {
      const line = invitationSizeSentence(memberCount);

      expect(line).not.toMatch(/[¡!]/);
      expect(line.endsWith(".")).toBe(true);
      expect(line).toMatch(/^Reservamos /);
    }
  });

  /**
   * AND IT NAMES THE SIZE IT WAS GIVEN, FOR EVERY SIZE THIS PRODUCT CAN
   * PRODUCE.
   *
   * Nothing enforces the stated ceiling of three — the feature document's
   * `## Next` carries that, and the geometry guard keeps a four-person
   * canary for the same reason — so the line has to be right for a size
   * nobody intended as well as for the three that were.
   */
  it("names whatever size the invitation actually is", () => {
    for (const [memberCount, word] of [
      [2, "dos"],
      [3, "tres"],
      [4, "cuatro"],
      [10, "diez"],
    ] as const) {
      expect(invitationSizeSentence(memberCount)).toBe(
        `Reservamos ${word} lugares para ustedes.`,
      );
    }
  });

  /**
   * PAST THE TABLE IT FALLS BACK TO THE NUMERAL, which is the one input that
   * can put a digit outside the URL in a WhatsApp draft.
   *
   * Asserted rather than left to be discovered: eleven people on one
   * invitation is far past anything the couple have described, and a
   * truthful numeral is a better failure than a table that silently runs
   * out. If an invitation that size ever becomes real, this test is where
   * the digit guard's exception is written down.
   */
  it("falls back to a numeral past the size table, digit and all", () => {
    expect(invitationSizeSentence(11)).toBe(
      "Reservamos 11 lugares para ustedes.",
    );
  });
});

/**
 * THE SENTENCE THAT PROMISED SOMETHING THE PRODUCT DOES NOT DO.
 *
 * The declined screen said "puedes volver a responder cuando quieras" —
 * whenever you like. The answer freezes seven days before the wedding, so for
 * that whole last week the page was telling a household that had said no that
 * they could still change their mind. It names the date now, and it names it
 * by reading the SAME constant the question screen's deadline sentence reads.
 */
describe("rsvpReconsiderSentence", () => {
  it("names the deadline to a household", () => {
    expect(rsvpReconsiderSentence(3)).toBe(
      `Si cambian de opinión, pueden volver a responder hasta el ${RSVP_DEADLINE_TEXT}.`,
    );
  });

  it("names it to one guest, in their own number", () => {
    expect(rsvpReconsiderSentence(1)).toBe(
      `Si cambias de opinión, puedes volver a responder hasta el ${RSVP_DEADLINE_TEXT}.`,
    );
  });

  /**
   * AND IT PROMISES NOTHING OPEN-ENDED, which is the thing that was wrong.
   * Asserted as an absence as well as a presence: a future edit that softened
   * the date back into "cuando quieras" would restore the lie while still
   * passing a test that only checked the date was mentioned somewhere.
   */
  it("makes no open-ended promise", () => {
    for (const memberCount of [1, 4]) {
      expect(rsvpReconsiderSentence(memberCount)).not.toMatch(/cuando quiera/);
      expect(rsvpReconsiderSentence(memberCount)).toContain(RSVP_DEADLINE_TEXT);
    }
  });

  /**
   * AND IT SAYS THE SAME DAY AS THE QUESTION SCREEN, which is the reason it
   * lives in this file at all. Two screens naming one deadline from two
   * places is two dates waiting to disagree.
   */
  it("names the same day the question screen names", () => {
    expect(rsvpReconsiderSentence(3)).toContain(RSVP_DEADLINE_TEXT);
    expect(rsvpDeadlineSentence(3)).toContain(RSVP_DEADLINE_TEXT);
  });
});

/**
 * AND WHAT THE INVITATION SAYS ONCE THAT DAY HAS PASSED.
 *
 * One line per ending, because the deadline closes the ability to change an
 * answer rather than the invitation: an accepted household still has a venue
 * to reach, a declined one still has a stream to join, and one that never
 * answered is offered the stream and not the address.
 */
describe("rsvpClosedNote", () => {
  it.each([
    ["accepted" as const, "todo lo que necesitan"],
    ["declined" as const, "Los esperamos por la transmisión"],
    ["unanswered" as const, "Si quieren, pueden acompañarnos"],
  ])("says the %s ending is closed, and what is left", (state, expected) => {
    const line = rsvpClosedNote(state, 3);

    expect(line).toContain("Ya cerramos las confirmaciones");
    expect(line).toContain(expected);
  });

  it("speaks to one person in the singular, on every ending", () => {
    for (const state of ["accepted", "declined", "unanswered"] as const) {
      expect(rsvpClosedNote(state, 1)).not.toBe(rsvpClosedNote(state, 3));
    }
  });

  /**
   * AND IT IS NOT THE MESSAGE A LATE SUBMISSION GETS.
   *
   * `RSVP_CLOSED_MESSAGE` answers a household whose form was already open
   * when the day turned, and it tells them to write by WhatsApp. This is the
   * standing state of a screen. Keeping them distinct is what stops the
   * screen reading like an error.
   */
  it("is not the late-submission message", () => {
    for (const state of ["accepted", "declined", "unanswered"] as const) {
      expect(rsvpClosedNote(state, 3)).not.toBe(RSVP_CLOSED_MESSAGE);
    }
  });
});
