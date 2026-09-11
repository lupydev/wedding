/**
 * The shape of an identifier this product is willing to ask Postgres about.
 *
 * WHY A SHAPE CHECK IS A PRODUCT DECISION AND NOT A MICRO-OPTIMISATION
 *
 * `invitations.id`, `invitation_guests.id` and `dispatch_events.id` are all
 * `uuid` columns. Postgres does not answer "no rows" for a value it cannot
 * parse into one: it raises `22P02 invalid input syntax for type uuid`, which
 * the Supabase client surfaces as an error and every repository function in
 * this codebase turns into a thrown `Error`. In a route that means a 500.
 *
 * A 500 is the wrong answer to a mistyped URL. It tells the operator the server
 * is broken when the truth is that the invitation is not there, it fills the
 * error log with noise that hides a real fault, and it makes probing with
 * nonsense ids cost a database round trip each.
 *
 * So identifiers are shape-checked BEFORE they reach a query, exactly as
 * `isWellFormedSlug` already guards the public invitation route. The check is
 * deliberately not a lookup: it says only that asking is worth a query, never
 * that the row exists.
 *
 * Anchored, and strict about it. An unanchored pattern would happily accept a
 * well-formed uuid with arbitrary text appended and pass the whole string on.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether `value` is a canonical hyphenated UUID.
 *
 * Case-insensitive, because Postgres accepts either case and refusing one would
 * turn a value the database would have found into a not-found. Whitespace is
 * NOT trimmed: every call site in this repository trims before it asks, and
 * silently accepting a padded value here would hide the one that forgot.
 */
export function isWellFormedUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
