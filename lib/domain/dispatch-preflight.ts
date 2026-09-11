import type {
  ConsoleListGuest,
  ConsoleListRow,
  ConsolePopulation,
} from "./console-list";
import { countsAsOperatorAssertedSend } from "./dispatch-state";
import { selectDispatchRecipient } from "./dispatch-message";

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
 * THREE QUESTIONS, NOT ONE COUNT
 *
 * Each group is a different piece of work for a person:
 *
 *  - `no_phone_on_file`    → nobody in the household has a number. Type one in.
 *  - `no_reachable_phone`  → the numbers on file cannot carry WhatsApp. A
 *    Colombian landline is a perfectly valid E.164 number that no WhatsApp will
 *    ever answer, and dispatching to it records a send nobody receives. Find a
 *    mobile.
 *  - `already_dispatched`  → the operator already asserted this one went out. A
 *    second pass must not send it again.
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

/** The three ways a household can fail the check. */
export type PreflightBlockerKind =
  "no_phone_on_file" | "no_reachable_phone" | "already_dispatched";

/**
 * Display order: the most actionable group first.
 *
 * NOT the classification order. A household that was already dispatched is
 * reported as already dispatched even when its numbers are also unusable,
 * because "do not send this again" answers the operator's question and the
 * state of a number they are not going to use does not.
 */
export const PREFLIGHT_BLOCKER_ORDER: readonly PreflightBlockerKind[] = [
  "no_phone_on_file",
  "no_reachable_phone",
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
  /** Always all three groups, in `PREFLIGHT_BLOCKER_ORDER`. */
  readonly groups: readonly PreflightGroup[];
}

interface GroupCopy {
  readonly heading: string;
  readonly explanation: string;
  readonly title: string;
}

const GROUP_COPY: Readonly<Record<PreflightBlockerKind, GroupCopy>> = {
  no_phone_on_file: {
    heading: "Sin número en la agenda",
    title: "Sin número en la agenda",
    explanation:
      "Nadie de estas invitaciones tiene un número guardado, así que no hay " +
      "a quién dirigir el mensaje. Se corrige en la lista de invitaciones, " +
      "en el campo que está junto a cada persona.",
  },
  no_reachable_phone: {
    heading: "Con número que no recibe WhatsApp",
    title: "Con número que no recibe WhatsApp",
    explanation:
      "El número guardado es válido, pero por su tipo de línea no parece " +
      "recibir WhatsApp: una línea fija lo es. Si se envía de todas formas, " +
      "queda registrado un envío que nadie recibió. Conviene buscar un " +
      "número de celular antes de enviar.",
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

  const recipient = selectDispatchRecipient(row.guests);

  if (recipient.ok) {
    return null;
  }

  if (recipient.reason === "no_phone_on_file") {
    return { kind: "no_phone_on_file", names: row.guests.map(nameOf) };
  }

  return {
    kind: "no_reachable_phone",
    // Only the members whose stored number is the problem. Naming the whole
    // household would send the operator looking at a child with no phone when
    // the thing to fix is one landline.
    names: row.guests
      .filter((guest) => guest.phoneE164 !== null && !guest.dispatchable)
      .map(nameOf),
  };
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
