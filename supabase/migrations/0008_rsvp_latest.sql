-- 0008_rsvp_latest.sql — the current RSVP state, reduced once and in one place.
--
-- WHY THIS EXISTS
--
-- `rsvp_responses` is append-only by trigger (0003). A guest who changes her
-- mind writes a SECOND row and the first one stays, because "she said yes,
-- then cancelled" is information the couple wants. That history is correct.
-- It is also the shape that makes the obvious query wrong: over the raw table,
-- `count(*) where attending` counts every mind ever changed, and
-- `sum(seats_confirmed)` totals seats that were released weeks ago.
--
-- That is not hypothetical. A reference project's dashboard reported 47
-- confirmed while 17 households had answered, and shipped the same defect
-- twice, in two screens, because the reduction was re-derived at each call
-- site instead of existing as one object.
--
-- So the reduction is an object. Every count, every list and every total —
-- in the RSVP flow, in the console, and in anything added later — reads
-- `rsvp_latest`, never `rsvp_responses` directly. `rsvp_responses` remains the
-- correct source for one thing only: showing the history AS history.
--
-- WHY `distinct on` AND WHY TWO ORDER KEYS
--
-- `distinct on (invitation_id)` keeps the first row of each invitation's
-- group in the given `order by`, which is exactly one row per invitation, in
-- the database, evaluated once — not a window function whose partition a later
-- `where` can quietly widen.
--
-- `submitted_at desc` alone is not enough. `submitted_at` defaults to `now()`,
-- which is the TRANSACTION timestamp: two rows written in one transaction
-- carry the identical value to the microsecond, and the winner would be left
-- to the planner — stable in a test, arbitrary in production, and silently
-- different after a plan change. `id desc` makes the ordering total, so the
-- answer is fixed by the definition rather than by luck.
--
-- The existing `rsvp_responses_latest_idx (invitation_id, submitted_at desc)`
-- already serves the leading keys of this ordering.
--
-- SECURITY
--
-- `security_invoker = true` is required, not stylistic. A view runs with its
-- OWNER's privileges by default, so an ordinary view over an RLS-protected
-- table is a hole straight through that protection. With invoker rights the
-- caller's own RLS applies — default-deny for `anon` and `authenticated`
-- (0002), bypassed by `service_role` as our own server identity. The event
-- trigger from 0004 additionally revokes `anon`/`authenticated` on this view
-- as it is created; both guards are kept because either one alone has been the
-- missing one somewhere.

create view rsvp_latest with (security_invoker = true) as
select distinct on (invitation_id)
  id,
  invitation_id,
  attending,
  attendee_guest_ids,
  seats_confirmed,
  dietary_notes,
  message,
  submitted_at
from rsvp_responses
order by invitation_id, submitted_at desc, id desc;

comment on view rsvp_latest is
  'One row per invitation: the newest rsvp_responses row, ties broken by id. '
  'Every RSVP count, list or total MUST start here; rsvp_responses is the history.';
