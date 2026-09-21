import { describe, expect, it } from "vitest";

import {
  type DirectoryGuest,
  buildGuestDirectory,
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
    ...overrides,
  };
}

const HOUSEHOLD = { invitationId: "i1", greetingName: "Familia Restrepo" };

describe("buildGuestDirectory", () => {
  /**
   * ONE ORDER, AND IT IS THE FINDABLE ONE.
   *
   * The directory is where somebody goes to look for a person by name, so it
   * sorts by name. Putting the unassigned guests first would make it sort by
   * something the reader cannot see in the name they are scanning for, and a
   * list whose order is a puzzle is a list people scroll instead of read.
   *
   * Who is still unplaced is answered by the summary count and by each row
   * saying so, which does not cost the list its order.
   */
  it("lists everybody in one alphabetical order", () => {
    const directory = buildGuestDirectory([
      guest({ id: "c", fullName: "Zulema Ruiz" }),
      guest({ id: "a", fullName: "Ana Restrepo" }),
      guest({ id: "b", fullName: "Mateo Díaz" }),
    ]);

    expect(directory.guests.map((row) => row.fullName)).toEqual([
      "Ana Restrepo",
      "Mateo Díaz",
      "Zulema Ruiz",
    ]);
  });

  /**
   * SPANISH COLLATION, NOT CODE POINTS.
   *
   * `"Ñ" > "Z"` by code point, so a naive comparison files Muñóz after Zulema
   * and Álvaro after Zulema too — in a guest list for a Colombian wedding,
   * where those letters are ordinary. `localeCompare(…, "es")` files Á with A
   * and Ñ between N and O, which is where a person looking for them will look.
   */
  it("files accented and Spanish letters where a reader expects them", () => {
    const directory = buildGuestDirectory([
      guest({ id: "1", fullName: "Zulema Ruiz" }),
      guest({ id: "2", fullName: "Ñandú Peña" }),
      guest({ id: "3", fullName: "Álvaro Gómez" }),
      guest({ id: "4", fullName: "Natalia Ortiz" }),
    ]);

    expect(directory.guests.map((row) => row.fullName)).toEqual([
      "Álvaro Gómez",
      "Natalia Ortiz",
      "Ñandú Peña",
      "Zulema Ruiz",
    ]);
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
