import { parsePhoneNumberFromString } from "libphonenumber-js/max";

import { resolveDefaultCountry } from "./phone";

/**
 * Reachability classification — pure.
 *
 * `normalizePhone` in `./phone.ts` answers one question: can this input be
 * turned into a well-formed E.164 number? A Colombian landline such as
 * `+57 601 234 5678` answers YES. It is a perfectly valid number, and nobody
 * has WhatsApp on it. Storing it, building `wa.me/576012345678` from it and
 * recording a dispatch event produces an invitation that reaches nobody while
 * the console reports it as sent.
 *
 * This module answers the SECOND, different question: is this number reachable
 * over WhatsApp at all? It is deliberately a separate function rather than a
 * stricter `normalizePhone`, because the two answers are used at different
 * boundaries. The phone gate matches on the last eight digits and must keep
 * accepting a landline: a guest whose household number is a landline still
 * opens their own invitation, they simply receive the link some other way.
 *
 * Metadata note: `libphonenumber-js`'s default ("min") metadata carries no line
 * types at all — `getType()` returns `undefined` for every Colombian number.
 * Only the `max` metadata distinguishes `MOBILE` from `FIXED_LINE`, so this
 * module imports it explicitly. `./phone.ts` deliberately stays on the default
 * metadata so its contract, and the set of inputs it accepts, does not move.
 */

/**
 * A line type, in the vocabulary of this codebase.
 *
 * Two values are ours rather than the library's: `unknown` means the number
 * parsed and validated but the metadata reports no line type for its range,
 * and `not_normalizable` means it never became an E.164 number in the first
 * place.
 */
export type PhoneLineType =
  | "mobile"
  | "fixed_line_or_mobile"
  | "fixed_line"
  | "voip"
  | "toll_free"
  | "premium_rate"
  | "shared_cost"
  | "personal_number"
  | "pager"
  | "uan"
  | "voicemail"
  | "unknown"
  | "not_normalizable";

export interface PhoneDispatchability {
  /** True only when the line type can carry WhatsApp. */
  readonly dispatchable: boolean;
  readonly lineType: PhoneLineType;
}

/**
 * The only line types a WhatsApp dispatch may be built from.
 *
 * `fixed_line_or_mobile` is included because it is what the metadata reports
 * for ranges a country assigns to both, Mexico and the United States among
 * them. Excluding it would flag most of two countries' numbers as unreachable.
 */
const MOBILE_CAPABLE: ReadonlySet<PhoneLineType> = new Set<PhoneLineType>([
  "mobile",
  "fixed_line_or_mobile",
]);

/** libphonenumber's `NumberType` values, in this module's vocabulary. */
const LINE_TYPES: Readonly<Record<string, PhoneLineType>> = {
  MOBILE: "mobile",
  FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
  FIXED_LINE: "fixed_line",
  VOIP: "voip",
  TOLL_FREE: "toll_free",
  PREMIUM_RATE: "premium_rate",
  SHARED_COST: "shared_cost",
  PERSONAL_NUMBER: "personal_number",
  PAGER: "pager",
  UAN: "uan",
  VOICEMAIL: "voicemail",
};

const UNDISPATCHABLE = (lineType: PhoneLineType): PhoneDispatchability => ({
  dispatchable: false,
  lineType,
});

/**
 * Classifies whether a WhatsApp message could actually reach this number.
 *
 * Never throws on guest DATA — an unusable input is reported as
 * `not_normalizable`, exactly as `normalizePhone` reports its failures through
 * a result rather than an exception. A misconfigured `defaultCountry` is a
 * different class of problem and still throws, because it would silently
 * mis-classify every nationally formatted number.
 *
 * An `unknown` line type is NOT dispatchable. The whole point of this module is
 * to stop the product from claiming a delivery it cannot substantiate, and
 * "the metadata does not say" is not substantiation. It is a flag at import,
 * never a hard rejection, so no legitimate guest is ever dropped over it.
 */
export function classifyPhoneDispatchability(
  input: string,
  defaultCountry: string,
): PhoneDispatchability {
  const country = resolveDefaultCountry(defaultCountry);

  if (input.trim() === "") {
    return UNDISPATCHABLE("not_normalizable");
  }

  const parsed = parsePhoneNumberFromString(input, country);

  if (!parsed || !parsed.isValid()) {
    return UNDISPATCHABLE("not_normalizable");
  }

  const rawType = parsed.getType();
  const lineType = rawType ? (LINE_TYPES[rawType] ?? "unknown") : "unknown";

  return { dispatchable: MOBILE_CAPABLE.has(lineType), lineType };
}

/** The yes/no form, for callers that do not need to explain the answer. */
export function isDispatchablePhone(
  input: string,
  defaultCountry: string,
): boolean {
  return classifyPhoneDispatchability(input, defaultCountry).dispatchable;
}
