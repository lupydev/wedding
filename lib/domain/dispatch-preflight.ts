import type { DispatchRecipientProblem } from "./dispatch-recipient";
import type {
  ConsoleListGuest,
  ConsoleListRow,
  ConsolePopulation,
} from "./console-list";
import { countsAsOperatorAssertedSend } from "./dispatch-state";
import { resolveDispatchRecipient } from "./dispatch-recipient";

/**
 * The send preflight — pure.
 *
 * WHY THIS EXISTS AT ALL
 *
 * A reference project built both a rendered message preview and a readiness
 * check. The preview was the one everybody demoed. The readiness check was the
 * one that saved the evening, because it ran BEFORE anything was spent and said
 * which households were going to fail while there was still time to fix them. A
 * preview answers "what does one message look like?"; this answers "which of my
 * eighty invitations cannot go out yet, and what do I have to do about each?"
 *
 * FIVE QUESTIONS, NOT ONE COUNT
 *
 * Each group is a different piece of work for a person:
 *
 *  - `no_recipient_chosen`         → nobody has chosen who this invitation is
 *    addressed to. Choose one of its members. On day one, most of them.
 *  - `recipient_has_no_phone`      → the CHOSEN person has no number on file,
 *    whatever their household holds. Type theirs in, or choose somebody else.
 *  - `recipient_phone_unreachable` → the chosen person's number cannot carry
 *    WhatsApp. A Colombian landline is a perfectly valid E.164 number that no
 *    WhatsApp will ever answer, and dispatching to it records a send nobody
 *    receives. Find them a mobile, or choose somebody else.
 *  - `recipient_not_in_household`  → the choice names somebody who is no longer
 *    a member. Permanently empty by construction (design D23) and rendered
 *    anyway, because a group that only appears when it is non-empty is a group
 *    nobody can tell apart from a group that stopped being computed.
 *  - `already_dispatched`          → the operator already asserted this one went
 *    out. A second pass must not send it again.
 *
 * THE TWO PHONE GROUPS CHANGED MEANING, WHICH IS WHY THEY CHANGED NAME
 *
 * They used to be about the HOUSEHOLD: `no_phone_on_file` meant nobody here has
 * a number, `no_reachable_phone` meant none of these numbers can carry WhatsApp.
 * Both are now about the chosen person. A household where one partner holds the
 * only mobile and the OTHER was chosen is blocked where it previously read as
 * ready. The `recipient_` prefix is what makes that visible at every call site.
 *
 * Collapsing them into one "no listas" figure would tell an operator how much
 * is wrong and nothing about what to do, which is how a readiness check becomes
 * a number people learn to ignore.
 *
 * NAMES, NEVER DIGITS
 *
 * Every household and every person is named; no stored phone number appears in
 * any string this module builds. The console IS the authorized reader of guest
 * numbers — they are rendered in the list, beside the field that edits them —
 * but a readiness summary is a thing an operator screenshots and forwards, and
 * a number has no business travelling in one.
 */

/**
 * The five ways a household can fail the check.
 *
 * Exactly `DispatchRecipientProblem` plus the one state that is not about the
 * recipient at all. Spelled as that union rather than re-listed, so a reason
 * added to the resolver cannot be silently dropped from the readiness report.
 */
export type PreflightBlockerKind =
  DispatchRecipientProblem | "already_dispatched";

/**
 * Display order: the most actionable group first.
 *
 * NOT the classification order. A household that was already dispatched is
 * reported as already dispatched even when its numbers are also unusable,
 * because "do not send this again" answers the operator's question and the
 * state of a number they are not going to use does not.
 */
export const PREFLIGHT_BLOCKER_ORDER: readonly PreflightBlockerKind[] = [
  "no_recipient_chosen",
  "recipient_has_no_phone",
  "recipient_phone_unreachable",
  "recipient_not_in_household",
  "already_dispatched",
];

/** One household in the check, named and never numbered. */
export interface PreflightHousehold {
  readonly invitationId: string;
  readonly householdName: string;
  /** The people this finding is about. Empty when there is nobody to fix. */
  readonly guestNames: readonly string[];
}

export interface PreflightGroup {
  readonly kind: PreflightBlockerKind;
  readonly heading: string;
  /** Why this blocks a send, in the operator's words. */
  readonly explanation: string;
  /** The count with its population baked in. Never a bare number. */
  readonly text: string;
  readonly households: readonly PreflightHousehold[];
}

export interface DispatchPreflight {
  readonly population: ConsolePopulation;
  readonly total: number;
  readonly ready: readonly PreflightHousehold[];
  readonly readyText: string;
  /** Always all five groups, in `PREFLIGHT_BLOCKER_ORDER`. */
  readonly groups: readonly PreflightGroup[];
}

interface GroupCopy {
  readonly heading: string;
  readonly explanation: string;
  readonly title: string;
}

const GROUP_COPY: Readonly<Record<PreflightBlockerKind, GroupCopy>> = {
  no_recipient_chosen: {
    heading: "Sin destinatario elegido",
    title: "Sin destinatario elegido",
    explanation:
      "Todavía nadie eligió a qué integrante de estas invitaciones va " +
      "dirigido el mensaje. Nada lo elige solo: se marca a una persona en el " +
      "formulario de la invitación, y recién ahí queda lista para enviar.",
  },
  recipient_has_no_phone: {
    heading: "Con destinatario sin número",
    title: "Con destinatario sin número",
    explanation:
      "La persona elegida no tiene un número guardado, aunque alguien más de " +
      "la invitación sí pueda tenerlo: el mensaje va a quien se eligió, no a " +
      "quien esté disponible. Se corrige agregando su número en la lista de " +
      "invitaciones, o eligiendo a otro integrante.",
  },
  recipient_phone_unreachable: {
    heading: "Con destinatario que no recibe WhatsApp",
    title: "Con destinatario que no recibe WhatsApp",
    explanation:
      "El número de la persona elegida es válido, pero por su tipo de línea " +
      "no parece recibir WhatsApp: una línea fija lo es. Si se envía de todas " +
      "formas, queda registrado un envío que nadie recibió. Conviene buscarle " +
      "un número de celular o elegir a otro integrante.",
  },
  recipient_not_in_household: {
    heading: "Con destinatario que ya no pertenece",
    title: "Con destinatario que ya no pertenece",
    explanation:
      "La persona elegida ya no figura entre los integrantes de la " +
      "invitación. La base de datos no permite guardar una elección así, de " +
      "modo que este grupo debería estar siempre vacío; aparece igual para " +
      "que deje de estarlo a la vista de alguien si alguna vez ocurre.",
  },
  already_dispatched: {
    heading: "Ya enviadas",
    title: "Ya enviadas",
    explanation:
      "Alguien de las dos cuentas ya confirmó el envío de estas " +
      "invitaciones. Aparecen aquí para que una segunda ronda no las " +
      "vuelva a enviar.",
  },
};

/** The same sentence shape `scopedMetrics` uses: count, total, population. */
function countSentence(
  title: string,
  count: number,
  outOf: number,
  population: ConsolePopulation,
): string {
  return `${title}: ${count} de ${outOf} ${population}`;
}

function household(
  row: ConsoleListRow,
  guestNames: readonly string[],
): PreflightHousehold {
  return {
    invitationId: row.invitationId,
    householdName: row.greetingName,
    guestNames,
  };
}

const nameOf = (guest: ConsoleListGuest): string => guest.fullName;

/**
 * Classifies one household, or reports it ready.
 *
 * Precedence is deliberate and is documented on `PREFLIGHT_BLOCKER_ORDER`.
 * `link_opened` and `marked_failed` are NOT already-dispatched: the application
 * cannot observe a send, so an opened link is a claim about a click, and a
 * failure is the operator saying it did not arrive. Both households are still
 * waiting for an invitation and belong in the ready list.
 */
function classify(row: ConsoleListRow): {
  readonly kind: PreflightBlockerKind;
  readonly names: readonly string[];
} | null {
  if (countsAsOperatorAssertedSend(row.dispatchState)) {
    return { kind: "already_dispatched", names: [] };
  }

  const recipient = resolveDispatchRecipient(
    row.guests,
    row.dispatchRecipientGuestId,
  );

  if (recipient.ok) {
    return null;
  }

  // A pass-through, now that `PreflightBlockerKind` IS the resolver's reason
  // plus `already_dispatched`. The translation that used to sit here could
  // disagree with the resolver; there is nothing left to disagree about.
  return { kind: recipient.reason, names: blockedNames(row, recipient.reason) };
}

/**
 * Who the operator has to go look at, for each reason.
 *
 * `no_recipient_chosen` names everybody, because they are the people there are
 * to choose from. The two phone reasons name ONLY the chosen person: naming the
 * household would send the operator looking at a partner whose number is fine.
 * `recipient_not_in_household` names nobody — the person it is about is, by
 * definition, not in the list there is to name from.
 */
function blockedNames(
  row: ConsoleListRow,
  reason: DispatchRecipientProblem,
): readonly string[] {
  if (reason === "no_recipient_chosen") {
    return row.guests.map(nameOf);
  }

  if (reason === "recipient_not_in_household") {
    return [];
  }

  return row.guests
    .filter((guest) => guest.id === row.dispatchRecipientGuestId)
    .map(nameOf);
}

/**
 * Runs the readiness check over one scope of invitations.
 *
 * `population` is the same named scope `scopedMetrics` requires, and for the
 * same reason: a count whose population is not on screen is a count nobody can
 * check. The caller passes `ownedPopulation(operator.displayName)`, because the
 * only scope worth preflighting is the one the operator can actually send.
 */
export function buildDispatchPreflight(
  rows: readonly ConsoleListRow[],
  population: ConsolePopulation,
): DispatchPreflight {
  const buckets = new Map<PreflightBlockerKind, PreflightHousehold[]>(
    PREFLIGHT_BLOCKER_ORDER.map((kind) => [kind, []]),
  );
  const ready: PreflightHousehold[] = [];

  for (const row of rows) {
    const finding = classify(row);

    if (finding === null) {
      ready.push(household(row, row.guests.map(nameOf)));
      continue;
    }

    buckets.get(finding.kind)?.push(household(row, finding.names));
  }

  return {
    population,
    total: rows.length,
    ready,
    readyText: countSentence(
      "Listas para enviar",
      ready.length,
      rows.length,
      population,
    ),
    groups: PREFLIGHT_BLOCKER_ORDER.map((kind) => {
      const households = buckets.get(kind) ?? [];
      const copy = GROUP_COPY[kind];

      return {
        kind,
        heading: copy.heading,
        explanation: copy.explanation,
        text: countSentence(
          copy.title,
          households.length,
          rows.length,
          population,
        ),
        households,
      };
    }),
  };
}
