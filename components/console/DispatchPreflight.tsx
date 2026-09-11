import type {
  DispatchPreflight as Preflight,
  PreflightHousehold,
} from "@/lib/domain/dispatch-preflight";

/**
 * The readiness check, rendered — presentational, props only.
 *
 * A reference project built both a rendered message preview and a check like
 * this one. The preview was the screen everybody demoed; this was the screen
 * that saved the evening, because it ran before anything was spent and said
 * which households were going to fail while there was still time to fix them.
 *
 * TWO RULES THIS COMPONENT ENFORCES
 *
 * 1. An empty group renders as empty, never as nothing. A check that silently
 *    omits its clean sections cannot be read as "nothing is wrong here" — it
 *    reads as "this check did not run", and an operator cannot tell those apart.
 * 2. It names people and prints no stored number. The console IS the authorized
 *    reader of guest phone numbers — they appear in the list, beside the field
 *    that edits them — but a readiness summary is a thing an operator
 *    screenshots and forwards to the other operator, and a guest's number has no
 *    business travelling in one.
 */

export interface DispatchPreflightProps {
  readonly preflight: Preflight;
}

function HouseholdLine({
  household,
}: {
  readonly household: PreflightHousehold;
}) {
  return (
    <li className="dispatch-preflight__household">
      <span className="dispatch-preflight__household-name">
        {household.householdName}
      </span>
      {household.guestNames.length > 0 && (
        <span className="dispatch-preflight__guests">
          {": "}
          {household.guestNames.join(", ")}
        </span>
      )}
    </li>
  );
}

export function DispatchPreflight({ preflight }: DispatchPreflightProps) {
  return (
    <section className="dispatch-preflight">
      <h2>Revisión previa al envío</h2>

      <p className="dispatch-preflight__ready">{preflight.readyText}</p>

      <p className="dispatch-preflight__intro">
        Esta revisión no envía nada. Señala, antes de empezar, qué invitaciones
        todavía no pueden salir y qué hace falta para que puedan.
      </p>

      {preflight.groups.map((group) => (
        <section className="dispatch-preflight__group" key={group.kind}>
          <h3>{group.heading}</h3>

          <p className="dispatch-preflight__count">{group.text}</p>
          <p className="dispatch-preflight__explanation">{group.explanation}</p>

          {group.households.length === 0 ? (
            <p className="dispatch-preflight__empty">Ninguna</p>
          ) : (
            <ul className="dispatch-preflight__households">
              {group.households.map((household) => (
                <HouseholdLine
                  household={household}
                  key={household.invitationId}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}
