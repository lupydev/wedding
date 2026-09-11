/**
 * The sign-in form's state.
 *
 * A plain module rather than part of `actions.ts`, because a `"use server"`
 * file may only export async functions: a type and a constant living there
 * fail the build outright. Keeping them here also means the client component
 * can import them without pulling a Server Action into its graph.
 */
export interface MagicLinkState {
  /** `null` before the form has been submitted. */
  readonly notice: string | null;
}

export const IDLE_MAGIC_LINK_STATE: MagicLinkState = { notice: null };
