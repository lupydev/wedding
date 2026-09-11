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
 * The three questions it answers are three different pieces of work for a
 * person, so they are three groups and never one count:
 *
 *  - nobody in this household has a number on file  → type one in
 *  - the numbers on file cannot receive WhatsApp    → find a different number
 *  - this household was already sent an invitation  → do not send it again
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
    seatsAllowed: 2,
    rsvpDeadline: null,
    ownerSenderId: ANA,
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
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
  it("reports a household with a reachable number as ready, and names it", () => {
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

  it("names the people a household has no number for, so the operator can go fix them", () => {
    const result = preflight([
      row({
        greetingName: "Familia Sin Número",
        guests: [
          guest({
            id: "g1",
            fullName: "Ana Muñóz",
            phoneE164: null,
            lineType: "not_normalizable",
            dispatchable: false,
          }),
          guest({
            id: "g2",
            fullName: "Niña Muñóz",
            isChild: true,
            phoneE164: null,
            lineType: "not_normalizable",
            dispatchable: false,
          }),
        ],
      }),
    ]);
    const missing = group(result, "no_phone_on_file");

    expect(missing.households).toEqual([
      {
        invitationId: "11111111-1111-4111-8111-111111111111",
        householdName: "Familia Sin Número",
        guestNames: ["Ana Muñóz", "Niña Muñóz"],
      },
    ]);
    expect(result.ready).toHaveLength(0);
  });

  it("separates a number that exists but cannot receive WhatsApp from one that is missing", () => {
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

    expect(group(result, "no_reachable_phone").households).toEqual([
      expect.objectContaining({
        householdName: "Familia Fija",
        guestNames: ["Casa Muñóz"],
      }),
    ]);
    expect(group(result, "no_phone_on_file").households).toHaveLength(0);
  });

  it("names only the unreachable members, not the whole household", () => {
    const result = preflight([
      row({
        greetingName: "Familia Mixta",
        guests: [
          guest({
            id: "g1",
            fullName: "Casa Muñóz",
            phoneE164: "+576012345678",
            lineType: "fixed_line",
            dispatchable: false,
          }),
          guest({ id: "g2", fullName: "Ana Muñóz" }),
        ],
      }),
    ]);

    // One member IS reachable, so the household is ready and appears in no
    // blocker group at all.
    expect(result.ready).toHaveLength(1);
    expect(group(result, "no_reachable_phone").households).toHaveLength(0);
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

  it("reports an already-dispatched household once, even when its numbers are also unusable", () => {
    const result = preflight([
      row({
        dispatchState: "marked_sent",
        guests: [guest({ phoneE164: null, dispatchable: false })],
      }),
    ]);

    expect(group(result, "already_dispatched").households).toHaveLength(1);
    expect(group(result, "no_phone_on_file").households).toHaveLength(0);
  });

  it("always reports all three groups, so an empty one is visible rather than absent", () => {
    const result = preflight([row()]);

    expect(result.groups.map((entry) => entry.kind)).toEqual([
      ...PREFLIGHT_BLOCKER_ORDER,
    ]);
    for (const entry of result.groups) {
      expect(entry.heading).not.toBe("");
      expect(entry.explanation).not.toBe("");
    }
  });

  it("states each group's count against the same named population", () => {
    const result = preflight([
      row({ guests: [guest({ phoneE164: null, dispatchable: false })] }),
    ]);

    expect(group(result, "no_phone_on_file").text).toBe(
      `Sin número en la agenda: 1 de 1 ${POPULATION}`,
    );
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
