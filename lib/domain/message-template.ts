/**
 * Message template rendering.
 *
 * Per the confirmed personalization decision the only variable in production is
 * `greeting_name`: no seat count, no per-guest free note, no register variant.
 * The renderer stays generic so the recovery/help template can reuse it.
 */

/** `{{name}}`, tolerating surrounding whitespace inside the delimiters. */
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type TemplateVars = Readonly<Record<string, string | undefined>>;

/**
 * Renders `template`, substituting every `{{variable}}` from `vars`.
 *
 * Fails loudly when a referenced variable is missing or empty. This is the whole
 * point of the function: the output is pasted into a WhatsApp draft that a human
 * sends immediately, so "Hola undefined" would reach a guest and could never be
 * recalled. An empty value counts as missing for the same reason — "Hola ,"
 * is just as visibly broken.
 *
 * Substitution is single-pass: a value that happens to contain `{{...}}` is
 * emitted literally and never re-expanded, so one variable's content cannot
 * inject another's.
 */
export function renderMessageTemplate(
  template: string,
  vars: TemplateVars,
): string {
  const missing: string[] = [];

  const rendered = template.replace(PLACEHOLDER_PATTERN, (_match, name) => {
    const value = vars[name as string];

    if (value === undefined || value === "") {
      missing.push(name as string);
      return "";
    }

    return value;
  });

  if (missing.length > 0) {
    throw new Error(
      `Message template is missing a value for: ${missing.join(", ")}`,
    );
  }

  return rendered;
}
