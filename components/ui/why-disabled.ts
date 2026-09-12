/**
 * The props for a disabled control, WITH the reason it is disabled.
 *
 * A disabled control that does not say why is a dead end: the operator cannot
 * proceed and cannot discover what would let them. In this console the disabled
 * controls are exactly the ones where that costs an evening — a send withheld
 * because a household has no phone number on file, a submit withheld while an
 * action is in flight — so the reason travels WITH the attribute instead of
 * beside it in whoever wrote the screen.
 *
 * A pure function rather than a component so the rule holds for a shadcn
 * `Button`, a bare `<button>`, a link rendered as a button, and anything else,
 * and so it can be tested without a DOM.
 */

/** Props to spread onto the control. `title` is present exactly when disabled. */
export type DisabledProps =
  | { readonly disabled: false }
  | { readonly disabled: true; readonly title: string };

/**
 * Disables a control and states the reason, or enables it.
 *
 * @param reason - Why the control is unusable, in the operator's language, or
 *   `null` when it is usable.
 * @throws When a reason is supplied but blank. A blank reason is the exact
 *   failure this function exists to prevent, and defaulting it to something
 *   generic would hide the omission rather than surface it.
 */
export function whyDisabled(reason: string | null): DisabledProps {
  if (reason === null) {
    return { disabled: false };
  }

  const trimmed = reason.trim();

  if (trimmed === "") {
    throw new Error(
      "whyDisabled requires a non-empty reason: a disabled control with no stated reason is a dead end.",
    );
  }

  return { disabled: true, title: trimmed };
}
