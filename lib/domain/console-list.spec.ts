import { describe, expect, it } from "vitest";

import {
  ALL_INVITATIONS_POPULATION,
  RSVP_ANSWER_LABELS,
  assembleConsoleRows,
  classifyAnswerConsistency,
  deriveRsvpAnswer,
  ownedPopulation,
  scopedMetrics,
  summarizeConsoleList,
  type ConsoleInvitationInput,
  type ConsoleListGuest,
  type ConsoleListRow,
} from "./console-list";

function guest(id: string, fullName = `Persona ${id}`): ConsoleListGuest {
  return {
    id,
    fullName,
    nickname: null,
    isChild: false,
    phoneE164: "+573001234567",
    lineType: "mobile",
    dispatchable: true,
  };
}

function row(overrides: Partial<ConsoleListRow> = {}): ConsoleListRow {
  return {
    invitationId: "11111111-1111-4111-8111-111111111111",
    slug: "abcdefghijklmn23",
    greetingName: "Familia Muñóz",
    displayName: "Familia Muñóz",
    memberCount: 4,
    ownerSenderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
    dispatchRecipientGuestId: null,
    attendeeGuestIds: [],
    guests: [],
    ...overrides,
  };
}

/** A household whose stored answer still names a member who has since left. */
function contradictedRow(overrides: Partial<ConsoleListRow> = {}) {
  return row({
    answer: "attending",
    seatsConfirmed: 2,
    memberCount: 1,
    guests: [guest("g1", "Ana Muñóz")],
    attendeeGuestIds: ["g1", "g2"],
    ...overrides,
  });
}

describe("deriveRsvpAnswer", () => {
  it("reports a household that never answered as pending", () => {
    expect(deriveRsvpAnswer(null)).toBe("pending");
  });

  it("reports an accepted invitation as attending", () => {
    expect(deriveRsvpAnswer({ attending: true, seatsConfirmed: 3 })).toBe(
      "attending",
    );
  });

  it("reports a declined invitation as declined", () => {
    expect(deriveRsvpAnswer({ attending: false, seatsConfirmed: 0 })).toBe(
      "declined",
    );
  });

  it("gives each answer its own operator-facing label", () => {
    const labels = Object.values(RSVP_ANSWER_LABELS);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("summarizeConsoleList", () => {
  it("counts an empty list as zero of zero rather than throwing", () => {
    const summary = summarizeConsoleList([]);

    expect(summary).toMatchObject({
      total: 0,
      attending: 0,
      declined: 0,
      pending: 0,
      seats: 0,
      seatsConfirmed: 0,
    });
  });

  it("counts one household once, whatever its history was", () => {
    // The projection it receives is already reduced (one row per invitation,
    // from `rsvp_latest`), so this asserts the counting side of the rule: a
    // household appears in exactly one answer bucket.
    const summary = summarizeConsoleList([
      row({ answer: "declined", seatsConfirmed: 0 }),
    ]);

    expect(summary.total).toBe(1);
    expect(summary.declined).toBe(1);
    expect(summary.attending).toBe(0);
    expect(summary.pending).toBe(0);
  });

  it("totals seats confirmed against the members these households hold", () => {
    const summary = summarizeConsoleList([
      row({ memberCount: 4, answer: "attending", seatsConfirmed: 3 }),
      row({ memberCount: 2, answer: "declined", seatsConfirmed: 0 }),
      row({ memberCount: 6, answer: "pending", seatsConfirmed: 0 }),
    ]);

    expect(summary.seats).toBe(12);
    expect(summary.seatsConfirmed).toBe(3);
    expect(summary.total).toBe(3);
    expect(summary.attending).toBe(1);
    expect(summary.declined).toBe(1);
    expect(summary.pending).toBe(1);
  });

  it("counts each dispatch state separately, keeping an opened link out of the sent bucket", () => {
    const summary = summarizeConsoleList([
      row({ dispatchState: "link_opened" }),
      row({ dispatchState: "link_opened" }),
      row({ dispatchState: "marked_sent" }),
      row({ dispatchState: "marked_failed" }),
      row({ dispatchState: "resent" }),
      row({ dispatchState: "not_dispatched" }),
    ]);

    expect(summary.byDispatchState).toEqual({
      not_dispatched: 1,
      link_opened: 2,
      marked_sent: 1,
      marked_failed: 1,
      resent: 1,
    });
    // The "has been invited" population: operator testimony only.
    expect(summary.operatorAssertedSends).toBe(2);
  });

  /**
   * THE COUNT THAT MAKES THE ROW BADGE IMPOSSIBLE TO MISS (design D24).
   *
   * `attendee_guest_ids` is a bare `uuid[]`, so removing or moving a member
   * leaves their id inside a stored answer that append-only history can never
   * correct. A badge on one row of a scrolling list is invisible until somebody
   * reaches that row; a count is on screen before anybody scrolls.
   */
  it("counts an invitation whose stored answer names a member who has since left", () => {
    const summary = summarizeConsoleList([
      contradictedRow(),
      row({
        answer: "attending",
        seatsConfirmed: 1,
        memberCount: 1,
        guests: [guest("g1", "Ana Muñóz")],
        attendeeGuestIds: ["g1"],
      }),
    ]);

    expect(summary.contradictedAnswers).toBe(1);
  });

  it("counts no contradiction where nobody answered at all", () => {
    const summary = summarizeConsoleList([
      row({ guests: [guest("g1")], attendeeGuestIds: [] }),
    ]);

    expect(summary.contradictedAnswers).toBe(0);
  });

  /**
   * A declined answer confirms nobody, so nothing it names can be contradicted
   * by a membership change — which is `classifyMembershipChangeImpact`'s rule,
   * reused here rather than restated. A hand-rolled "is this id still a member?"
   * filter would count this household and send the operator to reconcile an
   * answer that seats no one.
   */
  it("leaves a declined answer out of the count, whatever ids it still holds", () => {
    const summary = summarizeConsoleList([
      contradictedRow({ answer: "declined", seatsConfirmed: 0 }),
    ]);

    expect(summary.contradictedAnswers).toBe(0);
  });
});

describe("classifyAnswerConsistency — the stored answer, measured against today", () => {
  it("resolves every id the answer names, and reports the ones that left", () => {
    const consistency = classifyAnswerConsistency(
      contradictedRow({ guests: [guest("g1", "Ana Muñóz")] }),
    );

    expect(consistency.contradicted).toBe(true);
    expect(consistency.danglingGuestIds).toEqual(["g2"]);
    // Every stored id keeps its place: an answer rendered one name short
    // understates what the household actually confirmed.
    expect(consistency.attendees).toEqual([
      { guestId: "g1", fullName: "Ana Muñóz" },
      { guestId: "g2", fullName: null },
    ]);
  });

  it("reports an answer that names only current members as consistent", () => {
    const consistency = classifyAnswerConsistency(
      row({
        answer: "attending",
        seatsConfirmed: 1,
        memberCount: 1,
        guests: [guest("g1", "Ana Muñóz")],
        attendeeGuestIds: ["g1"],
      }),
    );

    expect(consistency.contradicted).toBe(false);
    expect(consistency.danglingGuestIds).toEqual([]);
    expect(consistency.attendees).toEqual([
      { guestId: "g1", fullName: "Ana Muñóz" },
    ]);
  });

  it("reports an unanswered household as consistent and naming nobody", () => {
    const consistency = classifyAnswerConsistency(
      row({ guests: [guest("g1", "Ana Muñóz")] }),
    );

    expect(consistency.contradicted).toBe(false);
    expect(consistency.attendees).toEqual([]);
  });
});

describe("scopedMetrics — the scope is in the label", () => {
  /**
   * The defect this guards.
   *
   * A reference project's dashboard rendered "42 confirmadas" and subtracted
   * answers from every guest in the database rather than from the guests
   * actually invited to that event. The number was wrong and unfalsifiable,
   * because nothing on screen said which population it was counting.
   */
  const rows = [
    row({ answer: "attending", seatsConfirmed: 2, memberCount: 3 }),
    row({ answer: "declined", memberCount: 2 }),
    row({ answer: "pending", memberCount: 5 }),
  ];

  it("states the numerator, the denominator and the population in every line", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList(rows),
      ownedPopulation("Ana Operadora"),
    );

    for (const metric of metrics) {
      expect(metric.text).toContain(String(metric.count));
      expect(metric.text).toContain(String(metric.outOf));
      expect(metric.text).toContain("Ana Operadora");
    }
  });

  it("names the owner's own invitations when the view is partitioned", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList(rows),
      ownedPopulation("Ana Operadora"),
    );
    const attending = metrics.find((metric) => metric.key === "attending");

    expect(attending?.text).toBe(
      "Confirmadas: 1 de 3 invitaciones de Ana Operadora",
    );
  });

  it("names the whole population when the view is the shared dashboard", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList(rows),
      ALL_INVITATIONS_POPULATION,
    );
    const attending = metrics.find((metric) => metric.key === "attending");

    expect(attending?.text).toBe(
      "Confirmadas: 1 de 3 todas las invitaciones del evento",
    );
  });

  it("measures seats against the people invited, never against households", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList(rows),
      ownedPopulation("Ana Operadora"),
    );
    const seats = metrics.find((metric) => metric.key === "seats");

    expect(seats?.count).toBe(2);
    expect(seats?.outOf).toBe(10);
    expect(seats?.text).toBe(
      "Lugares confirmados: 2 de 10 personas invitadas en invitaciones de Ana Operadora",
    );
  });

  it("labels an opened link as an unconfirmed send, distinctly from a confirmed one", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList([
        row({ dispatchState: "link_opened" }),
        row({ dispatchState: "marked_sent" }),
      ]),
      ownedPopulation("Ana Operadora"),
    );
    const opened = metrics.find((metric) => metric.key === "link_opened");
    const sent = metrics.find((metric) => metric.key === "marked_sent");

    expect(opened?.text).toBe(
      "Enlace abierto, envío sin confirmar: 1 de 2 invitaciones de Ana Operadora",
    );
    expect(sent?.text).toBe(
      "Marcadas como enviadas: 1 de 2 invitaciones de Ana Operadora",
    );
  });

  /**
   * D24's exact sentence, in the same shape as every other metric on the screen.
   *
   * A second rendering convention for this one count would be a line an operator
   * reads differently from the ones beside it — and a count with no population
   * is the defect `scopedMetrics` exists to prevent.
   */
  it("names the invitations whose stored answer no longer adds up", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList([
        contradictedRow(),
        row({
          answer: "attending",
          seatsConfirmed: 1,
          memberCount: 1,
          guests: [guest("g1", "Ana Muñóz")],
          attendeeGuestIds: ["g1"],
        }),
      ]),
      ownedPopulation("Luzma"),
    );
    const contradicted = metrics.find(
      (metric) => metric.key === "contradicted_answers",
    );

    expect(contradicted?.text).toBe(
      "Respuestas que ya no cuadran: 1 de 2 invitaciones de Luzma",
    );
  });

  it("never reports a bare count with no denominator", () => {
    const metrics = scopedMetrics(
      summarizeConsoleList(rows),
      ownedPopulation("Ana Operadora"),
    );

    for (const metric of metrics) {
      expect(metric.text).toMatch(/ de \d+ /);
    }
  });
});

describe("assembleConsoleRows", () => {
  const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const BETO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
  const OTHER_HOUSEHOLD = "22222222-2222-4222-8222-222222222222";

  function invitation(
    overrides: Partial<ConsoleInvitationInput> = {},
  ): ConsoleInvitationInput {
    return {
      invitationId: HOUSEHOLD,
      slug: "abcdefghijklmn23",
      greetingName: "Familia Muñóz",
      displayName: "Familia Muñóz",
      ownerSenderId: ANA,
      ownerDisplayName: "Ana Operadora",
      dispatchRecipientGuestId: null,
      guests: [
        {
          id: "g1",
          fullName: "Ana Muñóz",
          nickname: null,
          isChild: false,
          phoneE164: "+573001234567",
        },
      ],
      ...overrides,
    };
  }

  it("marks the viewer's own invitations as owned and the other's as not", () => {
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [
        invitation(),
        invitation({
          invitationId: OTHER_HOUSEHOLD,
          ownerSenderId: BETO,
          ownerDisplayName: "Beto Operador",
        }),
      ],
      latestAnswers: [],
      events: [],
    });

    expect(rows.map((row) => row.ownedByViewer)).toEqual([true, false]);
    expect(rows[1].ownerDisplayName).toBe("Beto Operador");
  });

  it("carries the chosen dispatch recipient through, and leaves an unchosen one unset", () => {
    // Asserted as a PAIR: a mapping that hard-coded `null` would satisfy the
    // unchosen half alone, and nothing downstream could ever be addressed.
    const [chosen] = assembleConsoleRows({
      invitations: [invitation({ dispatchRecipientGuestId: "g1" })],
      latestAnswers: [],
      events: [],
      viewerSenderId: ANA,
      defaultCountry: "CO",
    });
    const [unchosen] = assembleConsoleRows({
      invitations: [invitation({ dispatchRecipientGuestId: null })],
      latestAnswers: [],
      events: [],
      viewerSenderId: ANA,
      defaultCountry: "CO",
    });

    expect(chosen?.dispatchRecipientGuestId).toBe("g1");
    // Nothing infers one from `is_primary`, from ordering, or from being the
    // only reachable number — the guest IS reachable and is still not chosen.
    expect(unchosen?.dispatchRecipientGuestId).toBeNull();
  });

  it("derives the member count from the household's own members", () => {
    // D17: the row carries `memberCount`, not an allowance somebody typed. The
    // two-member household proves the number tracks the guests rather than a
    // fixture default that would happen to match a one-member one.
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [
        invitation(),
        invitation({
          invitationId: OTHER_HOUSEHOLD,
          guests: [
            {
              id: "g1",
              fullName: "Ana Muñóz",
              nickname: null,
              isChild: false,
              phoneE164: "+573001234567",
            },
            {
              id: "g2",
              fullName: "Luis Muñóz",
              nickname: null,
              isChild: false,
              phoneE164: null,
            },
          ],
        }),
      ],
      latestAnswers: [],
      events: [],
    });

    expect(rows.map((row) => row.memberCount)).toEqual([1, 2]);
  });

  it("carries the current answer from the reduced response, not from a history", () => {
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [invitation()],
      latestAnswers: [
        {
          invitationId: HOUSEHOLD,
          attending: false,
          seatsConfirmed: 0,
          attendeeGuestIds: [],
          submittedAt: "2026-02-02T10:00:00Z",
        },
      ],
      events: [],
    });

    expect(rows[0].answer).toBe("declined");
    expect(rows[0].seatsConfirmed).toBe(0);
    expect(rows[0].answeredAt).toBe("2026-02-02T10:00:00Z");
  });

  /**
   * WHY THE ATTENDEE IDS TRAVEL AT ALL.
   *
   * `attendee_guest_ids` is the only record of WHO a household confirmed, and it
   * is a bare `uuid[]`: removing a member leaves their id in a row that
   * append-only history can never correct. The console is where that becomes
   * legible, and it cannot become legible from a count alone.
   */
  it("carries the attendee ids the stored answer names", () => {
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [invitation()],
      latestAnswers: [
        {
          invitationId: HOUSEHOLD,
          attending: true,
          seatsConfirmed: 2,
          attendeeGuestIds: ["g1", "g2"],
          submittedAt: "2026-02-02T10:00:00Z",
        },
      ],
      events: [],
    });

    expect(rows[0].attendeeGuestIds).toEqual(["g1", "g2"]);
  });

  it("gives a household with no stored answer an empty attendee list, never null", () => {
    // `[]` rather than a nullable field: every consumer asks "does this answer
    // name somebody who left", and `[]` answers that with no null check.
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [invitation()],
      latestAnswers: [],
      events: [],
    });

    expect(rows[0].attendeeGuestIds).toEqual([]);
  });

  it("leaves a household with no reduced response pending", () => {
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [invitation()],
      latestAnswers: [],
      events: [],
    });

    expect(rows[0].answer).toBe("pending");
    expect(rows[0].answeredAt).toBeNull();
  });

  it("attributes each household's events to that household only", () => {
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [
        invitation(),
        invitation({ invitationId: OTHER_HOUSEHOLD }),
      ],
      latestAnswers: [],
      events: [
        {
          invitationId: OTHER_HOUSEHOLD,
          kind: "marked_sent",
          occurredAt: "2026-01-01T10:00:00Z",
        },
      ],
    });

    expect(rows[0].dispatchState).toBe("not_dispatched");
    expect(rows[1].dispatchState).toBe("marked_sent");
  });

  it("flags a landline where it is fixed — in the row", () => {
    // A Colombian landline is a perfectly valid E.164 number that no WhatsApp
    // will ever answer. Without the flag the dispatch reaches nobody while the
    // console reports it as sent.
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [
        invitation({
          guests: [
            {
              id: "g1",
              fullName: "Casa Muñóz",
              nickname: null,
              isChild: false,
              phoneE164: "+576012345678",
            },
            {
              id: "g2",
              fullName: "Ana Muñóz",
              nickname: null,
              isChild: false,
              phoneE164: "+573001234567",
            },
          ],
        }),
      ],
      latestAnswers: [],
      events: [],
    });

    expect(rows[0].guests[0]).toMatchObject({
      lineType: "fixed_line",
      dispatchable: false,
    });
    expect(rows[0].guests[1]).toMatchObject({
      lineType: "mobile",
      dispatchable: true,
    });
  });

  it("treats a guest with no phone as not dispatchable without inventing a line type", () => {
    const rows = assembleConsoleRows({
      viewerSenderId: ANA,
      defaultCountry: "CO",
      invitations: [
        invitation({
          guests: [
            {
              id: "g1",
              fullName: "Niña Muñóz",
              nickname: null,
              isChild: true,
              phoneE164: null,
            },
          ],
        }),
      ],
      latestAnswers: [],
      events: [],
    });

    expect(rows[0].guests[0]).toMatchObject({
      phoneE164: null,
      lineType: "not_normalizable",
      dispatchable: false,
    });
  });
});
