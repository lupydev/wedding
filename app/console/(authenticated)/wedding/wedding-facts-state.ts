import type { WeddingFactErrors } from "@/lib/domain/wedding-facts";

/**
 * The wedding-facts form's state, as the Server Action returns it.
 *
 * A plain module rather than part of `actions.ts`, for the same reason
 * `sign-in-state.ts` is one: a `"use server"` file may only export async
 * functions, so a type and a constant living there fail the build outright.
 * Keeping them here also lets the client component import them without pulling a
 * Server Action into its graph.
 *
 * THREE FIELDS, BECAUSE THERE ARE THREE DIFFERENT THINGS TO SAY
 *
 * `errors` belongs to individual fields and is rendered beside each one — four
 * fields and one error per round trip is how a form stops getting filled in.
 * `notice` is a refusal that belongs to no single field, such as the database
 * declining a write the pure validator had no way to foresee; without it that
 * failure would surface as an error page and the operator would not know whether
 * anything was saved. `saved` exists because this form re-renders with exactly
 * the values the operator just typed, so a successful save is visually identical
 * to a save that never happened.
 */
export interface WeddingFactsState {
  /** One message per refused field. Empty before the first submission. */
  readonly errors: WeddingFactErrors;
  /** A refusal that belongs to no single field. `null` when there is none. */
  readonly notice: string | null;
  /** Whether the last submission was written. */
  readonly saved: boolean;
}

export const IDLE_WEDDING_FACTS_STATE: WeddingFactsState = {
  errors: {},
  notice: null,
  saved: false,
};
