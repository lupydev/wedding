-- Restores `rsvp_responses.message` and the view that reads it.
--
-- HONEST SCOPE: this restores the STRUCTURE, not the data. Dropping a column
-- destroys its values, so every message a guest had written before 0010 ran is
-- gone and every restored row reads NULL. A down script returns the schema to
-- its previous shape; it cannot return the database to its previous contents.
-- Capture the column before applying 0010 if those values still matter.
--
-- The column comes back nullable with its original `char_length` CHECK, exactly
-- as `0001_schema.sql` declared it, and the view is restored to 0008's
-- definition — column for column, `security_invoker` and the total ordering
-- included.

drop view if exists rsvp_latest;

alter table rsvp_responses
  add column message text check (char_length(message) <= 1000);

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
