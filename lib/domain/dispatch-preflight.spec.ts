import { describe, expect, it } from "vitest";

import type { ConsoleListGuest, ConsoleListRow } from "./console-list";
import {
  PREFLIGHT_BLOCKER_ORDER,
  buildDispatchPreflight,
  type DispatchPreflight,
} from "./dispatch-preflight";

/**
 * The readiness check an operator runs BEFORE spending anything.
 *
 * A reference project's single most useful screen was not a rendered preview of
 * the message — it was the check that ran first and said which households could
 * not be reached yet. A preview tells you what one message looks like; this
 * tells you which of eighty are going to fail, while there is still time to fix
 * them, and it costs nothing to run.
 *
 * FIVE QUESTIONS NOW, NOT THREE, AND TWO OF THEM CHANGED MEANING
 *
 * Each group is a different piece of work for a person:
 *
 *  - nobody has chosen who this invitation is addressed to → choose somebody
 *  - the CHOSEN person has no number on file               → type theirs in
 *  - the CHOSEN person's number cannot receive WhatsApp    → find them a mobile
 *  - the CHOSEN person is no longer a member               → choose again
 *  - this household was already sent an invitation         → do not send again
 *
 * The two phone groups used to be about the HOUSEHOLD: "nobody here has a
 * number", "none of these numbers can carry WhatsApp". They are now about the
 * chosen person, so a household where the partner holds the only mobile is
 * blocked where it previously was ready. That is the change, not a rename.
 *
 * NAMES, NEVER DIGITS. The console is the authorized reader of guest phone
 * numbers, but a readiness summary is a thing an operator screenshots and
 * forwards. The last assertion in this file is the same one the importer's
 * output carries: no run of seven or more digits anywhere in it.
 */

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function guest(overrides: Partial<ConsoleListGuest> = {}): ConsoleListGuest {
  return {
    id: "g1",
    fullName: "Ana Muñóz",
    isChild: false,
    phoneE164: "+573001234567",
    lineType: "mobile",
    dispatchable: true,
    ...overrides,
  };
}

function row(overrides: Partial<ConsoleListRow> = {}): ConsoleListRow {
  return {
    invitationId: "11111111-1111-4111-8111-111111111111",
    slug: "abcdefghijklmn23",
    greetingName: "Familia Muñóz",
    displayName: "Familia Muñóz",
    memberCount: 1,
    ownerSenderId: ANA,
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
    // Chosen on purpose in the default fixture: an unchosen recipient is now a
    // blocker, so a fixture without one would make every "ready" case in this
    // file green for the wrong reason.
    dispatchRecipientGuestId: "g1",
    attendeeGuestIds: [],
    guests: [guest()],
    ...overrides,
  };
}

const POPULATION = "invitaciones de Ana Operadora";

function preflight(rows: readonly ConsoleListRow[]): DispatchPreflight {
  return buildDispatchPreflight(rows, POPULATION);
}

function group(result: DispatchPreflight, kind: string) {
  const found = result.groups.find((candidate) => candidate.kind === kind);

  if (found === undefined) {
    throw new Error(`The preflight did not report a "${kind}" group at all.`);
  }

  return found;
}

/**
 * Every string the preflight puts in front of a person, and nothing else.
 *
 * Invitation ids are deliberately excluded: they are opaque machine identifiers
 * that are never rendered, and a UUID contains a run of seven digits often
 * enough by chance that including them would make the assertion below a coin
 * toss rather than a guard.
 */
function renderedCopy(result: DispatchPreflight): string {
  const household = (entry: {
    householdName: string;
    guestNames: readonly string[];
  }) => `${entry.householdName} ${entry.guestNames.join(" ")}`;

  return [
    result.readyText,
    ...result.ready.map(household),
    ...result.groups.flatMap((entry) => [
      entry.heading,
      entry.explanation,
      entry.text,
      ...entry.households.map(household),
    ]),
  ].join("\n");
}

describe("buildDispatchPreflight", () => {
  it("reports a household with a chosen, reachable recipient as ready, and names it", () => {
    const result = preflight([row()]);

    expect(result.ready.map((household) => household.householdName)).toEqual([
      "Familia Muñóz",
    ]);
    expect(result.total).toBe(1);
  });

  it("states the ready count against its population, never as a bare number", () => {
    const result = preflight([
      row(),
      row({
        invitationId: "22222222-2222-4222-8222-222222222222",
        greetingName: "Familia Sin Número",
        guests: [guest({ phoneE164: null, dispatchable: false })],
      }),
    ]);

    expect(result.readyText).toBe(`Listas para enviar: 1 de 2 ${POPULATION}`);
  });

  it("lists an invitation nobody has chosen a recipient for, and names who there is to choose from", () => {
    const result = preflight([
      row({
        greetingName: "Familia Sin Elegir",
        dispatchRecipientGuestId: null,
        guests: [
          guest({ id: "g1", fullName: "Ana Muñóz" }),
          guest({ id: "g2", fullName: "Beto Muñóz" }),
        ],
      }),
    ]);

    expect(group(result, "no_recipient_chosen").households).toEqual([
      {
        invitationId: "11111111-1111-4111-8111-111111111111",
        householdName: "Familia Sin Elegir",
        guestNames: ["Ana Muñóz", "Beto Muñóz"],
      },
    ]);
    expect(result.ready).toHaveLength(0);
  });

  it("blocks a chosen recipient with no number even when a partner holds a reachable one", () => {
    // THE MEANING THAT CHANGED. Under the old `no_phone_on_file` this household
    // was ready, because the auto-pick would have found Beto. The message is
    // addressed to Ana now, because somebody chose her, and Ana has no number.
    const result = preflight([
      row({
        greetingName: "Familia Mixta",
        dispatchRecipientGuestId: "g1",
        guests: [
          guest({
            id: "g1",
            fullName: "Ana Muñóz",
            phoneE164: null,
            lineType: "not_normalizable",
            dispatchable: false,
          }),
          guest({ id: "g2", fullName: "Beto Muñóz" }),
        ],
      }),
    ]);

    expect(group(result, "recipient_has_no_phone").households).toEqual([
      expect.objectContaining({
        householdName: "Familia Mixta",
        // Only the chosen person. Naming the household would send the operator
        // looking at Beto, whose number is fine and is not what is wrong.
        guestNames: ["Ana Muñóz"],
      }),
    ]);
    expect(result.ready).toHaveLength(0);
  });

  it("separates a chosen number that exists but cannot receive WhatsApp from one that is missing", () => {
    // A Colombian landline is valid and unreachable. Dispatching to it records a
    // send nobody receives, which is the exact failure this group prevents.
    const result = preflight([
      row({
        greetingName: "Familia Fija",
        guests: [
          guest({
            fullName: "Casa Muñóz",
            phoneE164: "+576012345678",
            lineType: "fixed_line",
            dispatchable: false,
          }),
        ],
      }),
    ]);

    expect(group(result, "recipient_phone_unreachable").households).toEqual([
      expect.objectContaining({
        householdName: "Familia Fija",
        guestNames: ["Casa Muñóz"],
      }),
    ]);
    expect(group(result, "recipient_has_no_phone").households).toHaveLength(0);
  });

  it("reports a stale choice naming somebody who is no longer a member", () => {
    // Unwritable through the composite foreign key (design D23), and resolved
    // anyway: `resolveDispatchRecipient` takes plain arrays and cannot see that
    // constraint. Synthesized here through exactly that signature so all FIVE
    // kinds are proved to sort, not the four the database can produce.
    const result = preflight([
      row({
        greetingName: "Familia Mudada",
        dispatchRecipientGuestId: "moved-away",
        guests: [guest({ id: "g1", fullName: "Ana Muñóz" })],
      }),
    ]);

    expect(group(result, "recipient_not_in_household").households).toEqual([
      expect.objectContaining({
        householdName: "Familia Mudada",
        // Nobody to name: the chosen person is not in this household to point at.
        guestNames: [],
      }),
    ]);
    expect(result.ready).toHaveLength(0);
  });

  it("lists an invitation the operator already asserted as sent, so a second pass does not re-send", () => {
    const result = preflight([row({ dispatchState: "marked_sent" })]);

    expect(group(result, "already_dispatched").households).toEqual([
      expect.objectContaining({ householdName: "Familia Muñóz" }),
    ]);
    expect(result.ready).toHaveLength(0);
  });

  it("counts a resend as already dispatched too", () => {
    const result = preflight([row({ dispatchState: "resent" })]);

    expect(group(result, "already_dispatched").households).toHaveLength(1);
  });

  it("does NOT treat an opened link as already dispatched", () => {
    // `link_opened` is a claim that WhatsApp was opened. The application cannot
    // observe a send, so a household whose link was merely opened is still
    // waiting for one and must stay in the ready list.
    const result = preflight([row({ dispatchState: "link_opened" })]);

    expect(group(result, "already_dispatched").households).toHaveLength(0);
    expect(result.ready).toHaveLength(1);
  });

  it("does NOT treat a failed attempt as already dispatched", () => {
    const result = preflight([row({ dispatchState: "marked_failed" })]);

    expect(group(result, "already_dispatched").households).toHaveLength(0);
    expect(result.ready).toHaveLength(1);
  });

  it("reports an already-dispatched household once, even when nobody chose a recipient", () => {
    const result = preflight([
      row({ dispatchState: "marked_sent", dispatchRecipientGuestId: null }),
    ]);

    expect(group(result, "already_dispatched").households).toHaveLength(1);
    expect(group(result, "no_recipient_chosen").households).toHaveLength(0);
  });

  it("always reports all five groups, in order, so an empty one is visible rather than absent", () => {
    const result = preflight([row()]);

    expect(result.groups.map((entry) => entry.kind)).toEqual([
      "no_recipient_chosen",
      "recipient_has_no_phone",
      "recipient_phone_unreachable",
      "recipient_not_in_household",
      "already_dispatched",
    ]);
    expect(result.groups.map((entry) => entry.kind)).toEqual([
      ...PREFLIGHT_BLOCKER_ORDER,
    ]);
    for (const entry of result.groups) {
      expect(entry.heading).not.toBe("");
      expect(entry.explanation).not.toBe("");
    }
  });

  /**
   * All five kinds present at once, each populated, asserted as one ordered
   * sequence of counts. The per-kind tests above prove each classification; this
   * proves the ORDER survives a scope where every group is non-empty — including
   * the fourth kind the database can never produce, which is precisely the one a
   * fixture drawn from real data would leave empty and unproved.
   */
  it("sorts all five kinds into the documented order when every one of them is populated", () => {
    const result = preflight([
      row({
        invitationId: "11111111-1111-4111-8111-111111111111",
        dispatchRecipientGuestId: null,
      }),
      row({
        invitationId: "22222222-2222-4222-8222-222222222222",
        dispatchRecipientGuestId: "g1",
        guests: [
          guest({
            phoneE164: null,
            lineType: "not_normalizable",
            dispatchable: false,
          }),
        ],
      }),
      row({
        invitationId: "33333333-3333-4333-8333-333333333333",
        dispatchRecipientGuestId: "g1",
        guests: [
          guest({
            phoneE164: "+576012345678",
            lineType: "fixed_line",
            dispatchable: false,
          }),
        ],
      }),
      row({
        invitationId: "44444444-4444-4444-8444-444444444444",
        dispatchRecipientGuestId: "moved-away",
      }),
      row({
        invitationId: "55555555-5555-4555-8555-555555555555",
        dispatchState: "marked_sent",
      }),
    ]);

    expect(
      result.groups.map((entry) => [entry.kind, entry.households.length]),
    ).toEqual([
      ["no_recipient_chosen", 1],
      ["recipient_has_no_phone", 1],
      ["recipient_phone_unreachable", 1],
      ["recipient_not_in_household", 1],
      ["already_dispatched", 1],
    ]);
    expect(result.ready).toHaveLength(0);
  });

  it("states each group's count against the same named population", () => {
    const result = preflight([row({ dispatchRecipientGuestId: null })]);

    expect(group(result, "no_recipient_chosen").text).toBe(
      `Sin destinatario elegido: 1 de 1 ${POPULATION}`,
    );
  });

  /**
   * The copy for the two RENAMED kinds had to change with them, not just their
   * keys. The old text said "Nadie de estas invitaciones tiene un número
   * guardado", which is false the moment the group means "the chosen person has
   * none" — the partner may well have one. A stale string that still reads
   * plausibly is exactly the failure this rename exists to prevent, so its
   * absence is asserted rather than reviewed.
   */
  it("no longer claims nobody in the household has a number", () => {
    const copy = renderedCopy(preflight([row()]));

    expect(copy).not.toContain(
      "Nadie de estas invitaciones tiene un número guardado",
    );
    expect(
      group(preflight([row()]), "recipient_has_no_phone").explanation,
    ).toContain("persona elegida");
  });

  it("reports an empty scope as empty rather than as ready", () => {
    const result = preflight([]);

    expect(result.total).toBe(0);
    expect(result.ready).toHaveLength(0);
    expect(result.readyText).toBe(`Listas para enviar: 0 de 0 ${POPULATION}`);
  });

  /**
   * The same line `scripts/import-guests.spec.ts` holds over the importer's
   * output. A readiness summary is a thing an operator screenshots and forwards,
   * so it names people and never prints the number it is complaining about.
   */
  it("names people and prints no stored phone number in any copy it renders", () => {
    const result = preflight([
      row({
        guests: [
          guest({
            fullName: "Casa Muñóz",
            phoneE164: "+576012345678",
            lineType: "fixed_line",
            dispatchable: false,
          }),
        ],
      }),
      row({
        invitationId: "22222222-2222-4222-8222-222222222222",
        greetingName: "Familia Sin Número",
        guests: [
          guest({
            fullName: "Ana Muñóz",
            phoneE164: null,
            dispatchable: false,
          }),
        ],
      }),
    ]);
    const copy = renderedCopy(result);

    expect(copy).toContain("Casa Muñóz");
    expect(copy).toContain("Familia Sin Número");
    expect(copy).not.toMatch(/\d{7,}/);
  });
});
