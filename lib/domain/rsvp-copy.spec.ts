import { describe, expect, it } from "vitest";

import {
  rsvpChoiceCopy,
  RSVP_CLOSED_MESSAGE,
  currentRsvpSentence,
  rsvpFeedbackMessages,
  seatsSelectionSentence,
} from "./rsvp-copy";

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

describe("seatsSelectionSentence", () => {
  it("counts the seats still available in the plural", () => {
    expect(seatsSelectionSentence(1, 3)).toBe(
      "Puedes seleccionar 2 personas más.",
    );
  });

  it("uses the singular for the last remaining seat", () => {
    expect(seatsSelectionSentence(2, 3)).toBe(
      "Puedes seleccionar 1 persona más.",
    );
  });

  it("says everyone is selected rather than offering zero more", () => {
    // "Puedes seleccionar 0 personas más" reads as a bug, and it is also the
    // moment the remaining checkboxes are disabled — the sentence must explain
    // that rather than leave it looking broken. It names the PEOPLE now, not a
    // reserved-seat allowance that no longer exists.
    expect(seatsSelectionSentence(3, 3)).toBe("Ya seleccionaron las 3.");
  });

  it("addresses the single member of a one-person invitation", () => {
    expect(seatsSelectionSentence(1, 1)).toBe(
      "Ya seleccionaron a la única persona.",
    );
  });
});

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
 * The couple: "si la invitación es para 1 sola persona deberá decir 'Sí, allá
 * estaré' y 'No puedo acompañarlos', y si la invitación es para 2 o más debe
 * decir 'Sí, allá estaremos' y 'No podemos acompañarlos'."
 *
 * Every line was plural, because every invitation was assumed to be a
 * household. A guest invited alone was answering in a voice that was not
 * theirs, on the one page in the product that is addressed to them by name.
 *
 * IN THE DOMAIN, NOT IN THE COMPONENT. This is the third place a count has
 * decided a Spanish ending — `seatsSelectionSentence` and `currentRsvpSentence`
 * are the other two — and all three live here, where they can be read against
 * each other and tested without a DOM.
 */
describe("rsvpChoiceCopy", () => {
  it("speaks to one person in the singular", () => {
    expect(rsvpChoiceCopy(1)).toEqual({
      question: "¿Podrás acompañarnos?",
      yes: "Sí, allá estaré",
      no: "No puedo acompañarlos",
    });
  });

  it("speaks to a household in the plural", () => {
    expect(rsvpChoiceCopy(2)).toEqual({
      question: "¿Podrán acompañarnos?",
      yes: "Sí, allá estaremos",
      no: "No podemos acompañarlos",
    });
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
