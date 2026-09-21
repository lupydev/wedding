import { StatusBadge } from "@/components/console/StatusBadge";
import { preflightGroupTone } from "@/lib/design/console-status";
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
 *
 * NO EXTRA WRAPPER ELEMENTS AROUND THE GROUPS, AND THAT IS A CONSTRAINT RATHER THAN
 * a preference: the standing end-to-end suite locates each group as the `section`
 * inside this one that CONTAINS a given heading. A styling wrapper that was also a
 * `section` would match the same filter twice and make those locators ambiguous. The
 * groups are therefore restyled in place.
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
    <li className="dispatch-preflight__household text-sm">
      <span className="dispatch-preflight__household-name text-foreground">
        {household.householdName}
      </span>
      {household.guestNames.length > 0 && (
        <span className="dispatch-preflight__guests text-muted-foreground">
          {": "}
          {household.guestNames.join(", ")}
        </span>
      )}
    </li>
  );
}

export function DispatchPreflight({ preflight }: DispatchPreflightProps) {
  const blocking = preflight.groups.filter(
    (group) => group.households.length > 0,
  );

  return (
    <section className="dispatch-preflight rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-base leading-snug">Revisión previa al envío</h2>

      {/*
        The one gold figure on this panel: how many households can go out now. It is
        the number the operator opened the page for, so it is the one that is large.
      */}
      <p
        className="dispatch-preflight__ready mt-2 font-display text-2xl leading-tight text-primary"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {preflight.readyText}
      </p>

      {/*
        ONLY THE GROUPS WITH SOMETHING IN THEM, AND ONE LINE WHEN THERE IS
        NOTHING.

        Every group used to render always — heading, badge, a paragraph of
        explanation and the word "Ninguna" — five panels and about nine hundred
        pixels of mostly-empty boxes above the list the operator came to read.

        The reasoning behind that is kept, because it was right: a check that
        omits its clean sections reads as "this check did not run", and those
        are not tellable apart. It simply does not take five panels to say it.
        When nothing is blocked, this says nothing is blocked, once.

        The explanations survive too, and only where they are earned: the moment
        a group HAS households is the moment somebody needs to be told what to
        do about it. A paragraph over the word "Ninguna" is a paragraph nobody
        has a reason to read.
      */}
      {blocking.length === 0 ? (
        <p className="dispatch-preflight__clear mt-2 text-sm text-hint">
          Todo en orden: no hay nada pendiente antes de enviar.
        </p>
      ) : (
        blocking.map((group) => (
          <section
            className="dispatch-preflight__group mt-4 rounded-md bg-muted px-3 py-3"
            key={group.kind}
          >
            {/*
              The badge sits BESIDE the heading and not inside it. Inside, it
              becomes part of the heading's accessible name and every
              `getByRole("heading", { name })` in the suite stops matching. A
              visual grouping is not a semantic one.
            */}
            <h3 className="text-sm font-semibold">{group.heading}</h3>

            <p className="dispatch-preflight__count mt-1">
              <StatusBadge
                label={group.text}
                tone={preflightGroupTone(group.kind)}
              />
            </p>
            <p className="dispatch-preflight__explanation mt-1 text-sm text-muted-foreground">
              {group.explanation}
            </p>

            <ul className="dispatch-preflight__households mt-2 flex flex-col gap-1">
              {group.households.map((household) => (
                <HouseholdLine
                  household={household}
                  key={household.invitationId}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
