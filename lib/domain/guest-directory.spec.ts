import { describe, expect, it } from "vitest";

import {
  type DirectoryGuest,
  buildGuestDirectory,
  canOfferSend,
  isFreeToInvite,
  validateDirectoryGuest,
} from "./guest-directory";

function guest(overrides: Partial<DirectoryGuest> = {}): DirectoryGuest {
  return {
    id: "g1",
    fullName: "Ana Restrepo",
    nickname: null,
    phoneE164: null,
    isChild: false,
    household: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const HOUSEHOLD = {
  invitationId: "i1",
  greetingName: "Familia Restrepo",
  ownerSenderId: "ana",
  recipientGuestId: null,
  dispatchState: "not_dispatched" as const,
};

describe("buildGuestDirectory", () => {
  /**
   * NEWEST FIRST, AND THE ALPHABET WAS THE WRONG ANSWER.
   *
   * It used to sort by name through a Spanish collator, on the reasoning that a
   * directory is where you look somebody up. That reasoning fits a FINISHED
   * list. It does not fit the list being built — the couple typing forty people
   * in one sitting, where the only question between one entry and the next is
   * "did that one land?". Its answer is at the top only if the newest is.
   *
   * The couple asked for it outright: "debe estar organizada por fecha de
   * creación DESC".
   */
  it("puts the most recently added person first", () => {
    const directory = buildGuestDirectory([
      guest({
        id: "old",
        fullName: "Ana Primero",
        createdAt: "2026-01-01T10:00:00.000Z",
      }),
      guest({
        id: "new",
        fullName: "Zulema Último",
        createdAt: "2026-01-03T10:00:00.000Z",
      }),
      guest({
        id: "mid",
        fullName: "Mateo Medio",
        createdAt: "2026-01-02T10:00:00.000Z",
      }),
    ]);

    expect(directory.guests.map((row) => row.fullName)).toEqual([
      "Zulema Último",
      "Mateo Medio",
      "Ana Primero",
    ]);
  });

  /**
   * TWO PEOPLE ADDED IN THE SAME INSTANT STILL GET A STABLE ORDER.
   *
   * `created_at` defaults to `now()`, and a bulk import writes a whole file
   * inside one statement — so identical timestamps are ordinary, not exotic.
   * Falling back to the id keeps the list from reshuffling between two renders
   * of the same data, which is the kind of flicker that makes a screen feel
   * broken without ever being wrong.
   */
  it("breaks a tie the same way every time", () => {
    const sameInstant = "2026-01-01T10:00:00.000Z";
    const build = () =>
      buildGuestDirectory([
        guest({ id: "b", fullName: "Beto", createdAt: sameInstant }),
        guest({ id: "a", fullName: "Ana", createdAt: sameInstant }),
      ]).guests.map((row) => row.id);

    expect(build()).toEqual(build());
  });

  it("counts everybody, and how many are in no invitation", () => {
    const directory = buildGuestDirectory([
      guest({ id: "1", household: HOUSEHOLD }),
      guest({ id: "2", fullName: "Beto Restrepo", household: HOUSEHOLD }),
      guest({ id: "3", fullName: "Carla Suelta" }),
    ]);

    expect(directory.total).toBe(3);
    expect(directory.unassigned).toBe(1);
  });

  it("survives a wedding nobody has been added to yet", () => {
    const directory = buildGuestDirectory([]);

    expect(directory.guests).toEqual([]);
    expect(directory.total).toBe(0);
    expect(directory.unassigned).toBe(0);
  });
});

/**
 * THE COUPLE'S RULE, AS A PREDICATE.
 *
 * "Cuando un invitado pertenece a una invitación no debe poder pertenecer a
 * otra, no se debería poder escoger en una próxima invitación." The database
 * already makes it unrepresentable — one row carries one `invitation_id`, and
 * the composite recipient key cannot match a NULL one — so this is not the
 * enforcement. It is what the picker reads to avoid OFFERING somebody it would
 * then have to refuse, which is a worse way to learn the same rule.
 */
describe("isFreeToInvite", () => {
  it("offers a guest who belongs to no household", () => {
    expect(isFreeToInvite(guest())).toBe(true);
  });

  it("withholds a guest who is already in one", () => {
    expect(isFreeToInvite(guest({ household: HOUSEHOLD }))).toBe(false);
  });
});

describe("validateDirectoryGuest", () => {
  it("accepts a person with only a name, because that is all a name needs", () => {
    // A phone number is what the gate uses and what a dispatch needs, and
    // neither happens from the directory. Requiring one here would stop
    // somebody writing down a guest they have not asked for a number from yet.
    expect(validateDirectoryGuest({ fullName: "Ana Restrepo" })).toEqual([]);
  });

  it("refuses a nameless guest, and says so in the shared vocabulary", () => {
    expect(validateDirectoryGuest({ fullName: "" })).toEqual([
      "member_without_name",
    ]);
  });

  /**
   * Whitespace is not a name. The field looks filled on the screen the
   * operator is looking at, which is exactly why it has to be refused here
   * rather than stored and puzzled over later.
   */
  it("refuses whitespace, which looks identical to a filled field", () => {
    expect(validateDirectoryGuest({ fullName: "   " })).toEqual([
      "member_without_name",
    ]);
  });
});

/**
 * WHO ACTUALLY RECEIVES THE MESSAGE, RESOLVED FOR EVERY ROW.
 *
 * The couple asked for a send button on a person's row: "en los invitados debe
 * existir un botón de envío de la invitación en caso tal de que se quiera hacer
 * de manera individual". A send is per INVITATION and goes to the one member
 * that invitation is addressed to — so a button on somebody who is not that
 * member would send a message to a different person than the one whose row was
 * pressed.
 *
 * The directory lists people alphabetically, not by household, so the member
 * who IS the recipient is nowhere near this row. The name is therefore resolved
 * here rather than left for the reader to find: every guest is already in hand,
 * so this costs no query.
 */
describe("who receives each household's message", () => {
  it("marks the member their own invitation is addressed to", () => {
    const directory = buildGuestDirectory([
      guest({
        id: "g1",
        fullName: "Ana Restrepo",
        household: { ...HOUSEHOLD, recipientGuestId: "g1" },
      }),
    ]);

    expect(directory.guests[0].isRecipient).toBe(true);
    expect(directory.guests[0].recipientName).toBe("Ana Restrepo");
  });

  it("names the other member for somebody who is not the recipient", () => {
    const household = { ...HOUSEHOLD, recipientGuestId: "g1" };
    const directory = buildGuestDirectory([
      guest({ id: "g1", fullName: "Ana Restrepo", household }),
      guest({ id: "g2", fullName: "Beto Restrepo", household }),
    ]);
    const beto = directory.guests.find((row) => row.id === "g2");

    expect(beto?.isRecipient).toBe(false);
    // Ana's row is somewhere else entirely — this list is alphabetical, not
    // grouped by household — so her name has to travel with Beto's row.
    expect(beto?.recipientName).toBe("Ana Restrepo");
  });

  it("answers nothing when the household has chosen nobody", () => {
    const directory = buildGuestDirectory([
      guest({ id: "g1", household: { ...HOUSEHOLD, recipientGuestId: null } }),
    ]);

    expect(directory.guests[0].isRecipient).toBe(false);
    expect(directory.guests[0].recipientName).toBeNull();
  });

  it("answers nothing for somebody in no household at all", () => {
    const directory = buildGuestDirectory([guest({ id: "g1" })]);

    expect(directory.guests[0].isRecipient).toBe(false);
    expect(directory.guests[0].recipientName).toBeNull();
  });

  /**
   * A CHOSEN MEMBER THIS LIST CANNOT SEE.
   *
   * It should not happen — the composite foreign key ties the choice to a
   * member of that same invitation — but this resolves against the rows in
   * hand, and answering with a name it could not find would be an invention.
   */
  it("answers nothing rather than guessing when the chosen member is absent", () => {
    const directory = buildGuestDirectory([
      guest({
        id: "g2",
        household: { ...HOUSEHOLD, recipientGuestId: "missing" },
      }),
    ]);

    expect(directory.guests[0].recipientName).toBeNull();
  });
});

/**
 * WHETHER A SEND CAN BE OFFERED AT ALL.
 *
 * Three conditions, and each removes a different lie. Without a household
 * there is no invitation and no link to send. Dispatch is owner-scoped — the
 * dispatch route answers `notFound()` for anybody else — so a link shown to
 * the other operator points at a 404. And a device-declaration mismatch blocks
 * the send itself, which is the one thing that gate exists for.
 *
 * `GuestList` applies exactly these on a household's row; they are stated as a
 * function here because the directory now needs the same answer about a person.
 */
describe("canOfferSend", () => {
  const owned = { ...HOUSEHOLD, ownerSenderId: "ana" };

  it("offers a send for an owned household on a matching handset", () => {
    expect(
      canOfferSend(guest({ household: owned }), {
        viewerSenderId: "ana",
        dispatchBlocked: false,
      }),
    ).toBe(true);
  });

  it("offers nothing for somebody in no invitation", () => {
    expect(
      canOfferSend(guest(), { viewerSenderId: "ana", dispatchBlocked: false }),
    ).toBe(false);
  });

  it("offers nothing on the other operator's household", () => {
    expect(
      canOfferSend(guest({ household: owned }), {
        viewerSenderId: "beto",
        dispatchBlocked: false,
      }),
    ).toBe(false);
  });

  it("offers nothing while this handset carries the other account", () => {
    expect(
      canOfferSend(guest({ household: owned }), {
        viewerSenderId: "ana",
        dispatchBlocked: true,
      }),
    ).toBe(false);
  });
});

/**
 * WHETHER THIS PERSON HAS ACTUALLY BEEN WRITTEN TO.
 *
 * The couple: "si se envía una invitación a un grupo familiar, a la persona a
 * la que se le envía esa invitación, en invitados debería aparecer como que ya
 * se le envió la invitación — y quizá distinguir los otros invitados que hacen
 * parte ya de una invitación."
 *
 * A send reaches ONE member, the one the invitation is addressed to. So a
 * household being sent does not mean everybody in it was written to, and a
 * directory that said so of all four members would be telling three of them a
 * thing that never happened.
 *
 * Four states, and each answers a different question the operator has: nobody
 * has an invitation yet; this person will receive it; somebody else will; this
 * person already did; somebody else already did.
 */
describe("whether a guest has been written to", () => {
  const sent = { ...HOUSEHOLD, dispatchState: "marked_sent" as const };

  it("says a chosen member of a sent invitation has been written to", () => {
    const [row] = buildGuestDirectory([
      guest({ id: "g1", household: { ...sent, recipientGuestId: "g1" } }),
    ]).guests;

    expect(row.wasWrittenTo).toBe(true);
  });

  /**
   * AND SAYS THE OTHER MEMBERS HAVE NOT, which is the half that matters.
   * `marked_sent` is a fact about the INVITATION; the message reached one
   * phone.
   */
  it("says the other members of that invitation have not", () => {
    const household = { ...sent, recipientGuestId: "g1" };
    const [ana, beto] = buildGuestDirectory([
      guest({
        id: "g1",
        fullName: "Ana Restrepo",
        household,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
      guest({
        id: "g2",
        fullName: "Beto Restrepo",
        household,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ]).guests;

    expect(ana.wasWrittenTo).toBe(true);
    expect(beto.wasWrittenTo).toBe(false);
    // Beto still learns who did get it, which is what the row already said.
    expect(beto.recipientName).toBe("Ana Restrepo");
  });

  it("says nobody has been written to before the invitation goes out", () => {
    const [row] = buildGuestDirectory([
      guest({ id: "g1", household: { ...HOUSEHOLD, recipientGuestId: "g1" } }),
    ]).guests;

    expect(row.wasWrittenTo).toBe(false);
  });

  /**
   * AN OPENED LINK IS NOT A SEND, and this is the one place that distinction
   * could quietly rot. `countsAsOperatorAssertedSend` is described in
   * `dispatch-state.ts` as "the ONLY predicate a 'has been invited' filter may
   * use": a guest opening their link is evidence the link escaped, not
   * evidence anybody sent it on purpose.
   */
  it("does not count an opened link as having written to them", () => {
    const [row] = buildGuestDirectory([
      guest({
        id: "g1",
        household: {
          ...HOUSEHOLD,
          recipientGuestId: "g1",
          dispatchState: "link_opened",
        },
      }),
    ]).guests;

    expect(row.wasWrittenTo).toBe(false);
  });

  /**
   * NOR A SEND THE OPERATOR SAID HAD FAILED. It is an assertion, and it
   * asserts the opposite.
   */
  it("does not count a send the operator reported as failed", () => {
    const [row] = buildGuestDirectory([
      guest({
        id: "g1",
        household: {
          ...HOUSEHOLD,
          recipientGuestId: "g1",
          dispatchState: "marked_failed",
        },
      }),
    ]).guests;

    expect(row.wasWrittenTo).toBe(false);
  });

  it("says nothing of the kind about somebody in no invitation", () => {
    const [row] = buildGuestDirectory([guest({ id: "g1" })]).guests;

    expect(row.wasWrittenTo).toBe(false);
  });
});
