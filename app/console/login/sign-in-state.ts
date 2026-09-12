/**
 * The sign-in form's state.
 *
 * A plain module rather than part of `actions.ts`, because a `"use server"`
 * file may only export async functions: a type and a constant living there
 * fail the build outright. Keeping them here also means the client component
 * can import them without pulling a Server Action into its graph.
 *
 * There is exactly one field, and it is nullable rather than a discriminated
 * union of outcomes on purpose: every refusal is the same refusal, so there is
 * nothing for a richer state to carry that would not be an enumeration oracle.
 * A successful sign-in produces no state at all — the action redirects.
 */
export interface SignInState {
  /** `null` before the form has been submitted. */
  readonly notice: string | null;
}

export const IDLE_SIGN_IN_STATE: SignInState = { notice: null };
