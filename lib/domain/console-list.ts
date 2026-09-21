import { danglingAttendeeIds } from "./invitation-draft";
import {
  DISPATCH_STATE_LABELS,
  countsAsOperatorAssertedSend,
  deriveDispatchState,
  type DispatchEventRef,
  type DispatchState,
} from "./dispatch-state";
import {
  classifyPhoneDispatchability,
  type PhoneLineType,
} from "./phone-reachability";

/**
 * The console guest list, as pure data and pure arithmetic.
 *
 * The rows arrive already reduced: one row per invitation, its current answer
 * taken from the `rsvp_latest` view (migration 0008) and its dispatch state
 * from `deriveDispatchState`. Nothing here re-derives either, and nothing here
 * may be handed rows built from `rsvp_responses` directly — that table is the
 * append-only history, and counting over it double-counts every household that
 * changed its mind. A reference project shipped exactly that and reported 47
 * confirmed from 17 answers.
 *
 * WHY THE SCOPE LIVES IN THE LABEL
 *
 * The same reference project rendered "42 confirmadas" over a denominator that
 * was every guest in its database rather than the guests invited to that event.
 * The number was wrong, and worse, it was unfalsifiable: nothing on screen said
 * which population it counted, so nobody could notice. `scopedMetrics` therefore
 * cannot produce a bare count. Every line it emits carries a numerator, a
 * denominator, and the population by name.
 */

/** The current answer of one household. */
export type RsvpAnswer = "pending" | "attending" | "declined";

/** Operator-facing wording for each answer. */
export const RSVP_ANSWER_LABELS: Readonly<Record<RsvpAnswer, string>> = {
  pending: "Sin respuesta",
  attending: "Confirmada",
  declined: "No asiste",
};

/** The reduced response, as `rsvp_latest` returns it. `null` means unanswered. */
export interface LatestRsvpRef {
  readonly attending: boolean;
  readonly seatsConfirmed: number;
}

/**
 * Projects the reduced response onto the answer the console shows.
 *
 * Takes the ALREADY-REDUCED row rather than a history, so there is no way to
 * call it with an append-only list and get a plausible-looking wrong answer.
 */
export function deriveRsvpAnswer(latest: LatestRsvpRef | null): RsvpAnswer {
  if (latest === null) {
    return "pending";
  }

  return latest.attending ? "attending" : "declined";
}

/** One named guest, as the console (the authorized reader) sees them. */
export interface ConsoleListGuest {
  readonly id: string;
  readonly fullName: string;
  readonly isChild: boolean;
  /**
   * The stored E.164 number, or `null` for a guest who has none.
   *
   * Present on purpose: the console is the one surface authorized to read guest
   * phone numbers — the two operators are the couple, and they are the people
   * who typed these numbers in. Every guest-facing projection
   * (`toGuestFacingInvitation`) has no phone field at all.
   */
  readonly phoneE164: string | null;
  /**
   * Whether a WhatsApp message could reach this number, and why not.
   *
   * A landline is a perfectly valid E.164 number that no WhatsApp will ever
   * answer, so it is flagged where it is fixed — in the row — rather than
   * discovered when a dispatch reaches nobody.
   */
  readonly lineType: PhoneLineType;
  readonly dispatchable: boolean;
}

/** One invitation, reduced, as the console list renders it. */
export interface ConsoleListRow {
  readonly invitationId: string;
  readonly slug: string;
  readonly greetingName: string;
  readonly displayName: string;
  /**
   * How many people this invitation names. Derived from its own members, which
   * is what the seat cap reads since migration 0012 — not an allowance somebody
   * typed that could disagree with the names (design D17).
   */
  readonly memberCount: number;
  /** ISO calendar day, or `null` for an invitation that never closes. */
  readonly ownerSenderId: string;
  readonly ownerDisplayName: string;
  /** True when the signed-in operator owns this invitation. */
  readonly ownedByViewer: boolean;
  readonly dispatchState: DispatchState;
  readonly answer: RsvpAnswer;
  /** Zero unless the household confirmed; the DB enforces that (0003/0007). */
  readonly seatsConfirmed: number;
  /** ISO 8601 of the current answer, or `null` when unanswered. */
  readonly answeredAt: string | null;
  /**
   * The member an operator chose to address this invitation to, or `null`.
   *
   * `null` is the starting state and stays until somebody chooses: nothing
   * infers a recipient from `is_primary`, from ordering, or from being the only
   * reachable number. A send with no chosen recipient is a message leaving for
   * a person nobody looked at, so the preflight reports it as a blocker.
   */
  readonly dispatchRecipientGuestId: string | null;
  /**
   * The members the stored answer named, straight from `attendee_guest_ids`.
   *
   * `[]` for an invitation nobody answered, NOT `null`. Every consumer asks the
   * same question of this field — "does this answer name somebody who left?" —
   * and `[]` answers it without a null check at each call site. A nullable field
   * would buy nothing: there is no third state to distinguish, because a stored
   * answer always names at least the people it confirmed and an absent answer
   * names nobody either way.
   *
   * The column is a bare `uuid[]` with no foreign key (Postgres cannot key array
   * elements), so an id here may name a guest who no longer exists. That is not
   * repairable — `rsvp_responses` is append-only against `service_role` too — so
   * it is made legible instead: see `classifyAnswerConsistency`.
   */
  readonly attendeeGuestIds: readonly string[];
  readonly guests: readonly ConsoleListGuest[];
}

/** One id from a stored answer, looked up in the household as it stands now. */
export interface ResolvedAttendee {
  readonly guestId: string;
  /** The member's name, or `null` for an id the household no longer holds. */
  readonly fullName: string | null;
}

/** One household's stored answer, measured against its current members. */
export interface AnswerConsistency {
  /**
   * Every id the answer named, in stored order, each one resolved or marked
   * unresolved. Never filtered: dropping an unresolvable id would render the
   * answer one name short, which understates what the household confirmed.
   */
  readonly attendees: readonly ResolvedAttendee[];
  /** The ids this invitation's members no longer include. */
  readonly danglingGuestIds: readonly string[];
  readonly contradicted: boolean;
}

/**
 * Whether one row's stored answer still agrees with its member list.
 *
 * The rule itself is NOT restated here: `danglingAttendeeIds` owns it, and
 * `classifyMembershipChangeImpact` asks it the same question for a removal. One
 * definition of "this answer names somebody who is gone", two screens.
 *
 * What this function adds is the row's framing. A removal reports what it just
 * contradicted; this reports what is contradicted right now, and it resolves
 * every named id to a member so the operator sees WHO rather than how many.
 */
export function classifyAnswerConsistency(
  row: ConsoleListRow,
): AnswerConsistency {
  // Only an ATTENDING answer can be contradicted. A decline confirms nobody, so
  // nothing it names can stop agreeing with the membership, and an unanswered
  // invitation names nobody at all.
  const danglingGuestIds =
    row.answer === "attending"
      ? danglingAttendeeIds(
          row.attendeeGuestIds,
          row.guests.map((guest) => guest.id),
        )
      : [];
  const names = new Map(row.guests.map((guest) => [guest.id, guest.fullName]));

  return {
    attendees: row.attendeeGuestIds.map((guestId) => ({
      guestId,
      fullName: names.get(guestId) ?? null,
    })),
    danglingGuestIds,
    contradicted: danglingGuestIds.length > 0,
  };
}

/** Counts over one scoped population of invitations. */
export interface ConsoleSummary {
  readonly total: number;
  readonly attending: number;
  readonly declined: number;
  readonly pending: number;
  /** Every member of every invitation in this scope: the seats there are. */
  readonly seats: number;
  readonly seatsConfirmed: number;
  readonly byDispatchState: Readonly<Record<DispatchState, number>>;
  /**
   * Households the operator personally asserted were sent.
   *
   * NOT the same as "has a dispatch event": `link_opened` is excluded, because
   * the app cannot observe a send and an opened link is only a click.
   */
  readonly operatorAssertedSends: number;
  /**
   * Invitations in this scope whose stored answer names a since-removed member.
   *
   * On screen beside every other count, deliberately (design D24). The row badge
   * alone would be decoration: a badge lives on one row of a scrolling list and
   * is invisible until somebody reaches that row, while a count is read before
   * anybody scrolls and cannot be styled away without deleting a metric.
   */
  readonly contradictedAnswers: number;
}

const EMPTY_DISPATCH_COUNTS = (): Record<DispatchState, number> => ({
  not_dispatched: 0,
  link_opened: 0,
  marked_sent: 0,
  marked_failed: 0,
  resent: 0,
});

/** Reduces the rows of one scope to its counts. Every household counts once. */
export function summarizeConsoleList(
  rows: readonly ConsoleListRow[],
): ConsoleSummary {
  const byDispatchState = EMPTY_DISPATCH_COUNTS();
  let attending = 0;
  let declined = 0;
  let pending = 0;
  let seats = 0;
  let seatsConfirmed = 0;
  let operatorAssertedSends = 0;
  let contradictedAnswers = 0;

  for (const row of rows) {
    byDispatchState[row.dispatchState] += 1;
    seats += row.memberCount;
    seatsConfirmed += row.seatsConfirmed;

    if (countsAsOperatorAssertedSend(row.dispatchState)) {
      operatorAssertedSends += 1;
    }

    if (classifyAnswerConsistency(row).contradicted) {
      contradictedAnswers += 1;
    }

    if (row.answer === "attending") {
      attending += 1;
    } else if (row.answer === "declined") {
      declined += 1;
    } else {
      pending += 1;
    }
  }

  return {
    total: rows.length,
    attending,
    declined,
    pending,
    seats,
    seatsConfirmed,
    byDispatchState,
    operatorAssertedSends,
    contradictedAnswers,
  };
}

/**
 * The population a set of counts was taken over, in words.
 *
 * A string rather than a boolean flag, because it is rendered verbatim into
 * every metric line. A flag would let a caller pick a denominator and a label
 * independently, which is precisely how a count ends up describing the wrong
 * population.
 */
export type ConsolePopulation = string;

/** The shared dashboard's population: every invitation, whoever owns it. */
export const ALL_INVITATIONS_POPULATION: ConsolePopulation =
  "todas las invitaciones del evento";

/** One operator's own partition, named after them. */
export function ownedPopulation(displayName: string): ConsolePopulation {
  return `invitaciones de ${displayName}`;
}

/** One count, with its scope baked into the sentence an operator reads. */
export interface ScopedMetric {
  readonly key: string;
  readonly count: number;
  readonly outOf: number;
  /** The complete sentence. Never a bare number. */
  readonly text: string;
}

function metric(
  key: string,
  title: string,
  count: number,
  outOf: number,
  population: string,
): ScopedMetric {
  return {
    key,
    count,
    outOf,
    text: `${title}: ${count} de ${outOf} ${population}`,
  };
}

/**
 * Every headline count for one scope, each one self-describing.
 *
 * Dispatch states appear with their own labels, so "enlace abierto" can never be
 * read as "enviada". Seats are measured against seats, never against households:
 * a "2 de 3" that silently switched unit between numerator and denominator is
 * the same defect as an unlabelled population.
 */
export function scopedMetrics(
  summary: ConsoleSummary,
  population: ConsolePopulation,
): readonly ScopedMetric[] {
  const households = summary.total;

  return [
    metric(
      "attending",
      "Confirmadas",
      summary.attending,
      households,
      population,
    ),
    metric("declined", "No asisten", summary.declined, households, population),
    metric("pending", "Sin respuesta", summary.pending, households, population),
    metric(
      "marked_sent",
      "Marcadas como enviadas",
      summary.byDispatchState.marked_sent,
      households,
      population,
    ),
    metric(
      "resent",
      "Reenviadas",
      summary.byDispatchState.resent,
      households,
      population,
    ),
    metric(
      "link_opened",
      DISPATCH_STATE_LABELS.link_opened,
      summary.byDispatchState.link_opened,
      households,
      population,
    ),
    metric(
      "marked_failed",
      "Marcadas como fallidas",
      summary.byDispatchState.marked_failed,
      households,
      population,
    ),
    metric(
      "not_dispatched",
      "Sin enviar",
      summary.byDispatchState.not_dispatched,
      households,
      population,
    ),
    metric(
      "seats",
      "Lugares confirmados",
      summary.seatsConfirmed,
      summary.seats,
      `personas invitadas en ${population}`,
    ),
    // D24. Measured against households rather than against people, because the
    // thing being counted is an invitation whose answer no longer adds up.
    metric(
      "contradicted_answers",
      "Respuestas que ya no cuadran",
      summary.contradictedAnswers,
      households,
      population,
    ),
  ];
}

/** One invitation as it comes out of the console repository, before reduction. */
export interface ConsoleInvitationInput {
  readonly invitationId: string;
  readonly slug: string;
  readonly greetingName: string;
  readonly displayName: string;
  readonly ownerSenderId: string;
  readonly ownerDisplayName: string;
  /** The stored `dispatch_recipient_guest_id`, or `null` while unchosen. */
  readonly dispatchRecipientGuestId: string | null;
  readonly guests: readonly {
    readonly id: string;
    readonly fullName: string;
    readonly isChild: boolean;
    readonly phoneE164: string | null;
  }[];
}

/** One row of `rsvp_latest`, already reduced by the database. */
export interface ConsoleLatestAnswer extends LatestRsvpRef {
  readonly invitationId: string;
  readonly submittedAt: string;
  /** `attendee_guest_ids`, verbatim — a bare `uuid[]` with no foreign key. */
  readonly attendeeGuestIds: readonly string[];
}

/** One `dispatch_events` row, as the reduction cares about it. */
export interface ConsoleDispatchEvent extends DispatchEventRef {
  readonly invitationId: string;
}

/**
 * Joins the three reads into the rows the console renders — pure.
 *
 * Pure, and therefore unit-testable, which matters because this is where two
 * different mistakes would be invisible: attributing one household's events to
 * another, and letting a household with no `rsvp_latest` row fall into an
 * answered bucket.
 *
 * The answers arrive from `rsvp_latest`, one row per invitation BY
 * CONSTRUCTION. This function cannot reduce a history and must never be handed
 * one: given two rows for the same household it would keep whichever came last
 * in the array, which is exactly the arbitrary answer the view exists to
 * prevent. The repository is what guarantees the input shape.
 */
export function assembleConsoleRows(input: {
  readonly invitations: readonly ConsoleInvitationInput[];
  readonly latestAnswers: readonly ConsoleLatestAnswer[];
  readonly events: readonly ConsoleDispatchEvent[];
  readonly viewerSenderId: string;
  readonly defaultCountry: string;
}): readonly ConsoleListRow[] {
  const answers = new Map(
    input.latestAnswers.map((answer) => [answer.invitationId, answer]),
  );
  const events = new Map<string, DispatchEventRef[]>();

  for (const event of input.events) {
    const bucket = events.get(event.invitationId);

    if (bucket) {
      bucket.push(event);
    } else {
      events.set(event.invitationId, [event]);
    }
  }

  return input.invitations.map((invitation) => {
    const answer = answers.get(invitation.invitationId) ?? null;

    return {
      invitationId: invitation.invitationId,
      slug: invitation.slug,
      greetingName: invitation.greetingName,
      displayName: invitation.displayName,
      memberCount: invitation.guests.length,
      ownerSenderId: invitation.ownerSenderId,
      ownerDisplayName: invitation.ownerDisplayName,
      ownedByViewer: invitation.ownerSenderId === input.viewerSenderId,
      dispatchRecipientGuestId: invitation.dispatchRecipientGuestId,
      dispatchState: deriveDispatchState(
        events.get(invitation.invitationId) ?? [],
      ),
      answer: deriveRsvpAnswer(answer),
      seatsConfirmed: answer?.seatsConfirmed ?? 0,
      answeredAt: answer?.submittedAt ?? null,
      attendeeGuestIds: answer?.attendeeGuestIds ?? [],
      guests: invitation.guests.map((guest) => ({
        id: guest.id,
        fullName: guest.fullName,
        isChild: guest.isChild,
        phoneE164: guest.phoneE164,
        // A guest with no phone is classified through the same function as one
        // with an unusable phone, rather than given a special "no phone" line
        // type: the console's question is only ever "could a WhatsApp message
        // reach this person?", and the answer is no in both cases.
        ...classifyPhoneDispatchability(
          guest.phoneE164 ?? "",
          input.defaultCountry,
        ),
      })),
    };
  });
}
