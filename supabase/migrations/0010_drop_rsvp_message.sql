-- 0010_drop_rsvp_message.sql — remove the free-text message to the couple.
--
-- WHY THE COLUMN GOES, NOT JUST THE FIELD
--
-- The whole flow begins in the guest's own WhatsApp thread and arrives from the
-- couple's own personal numbers, so the guest already holds their contact. A
-- message box in the RSVP form competes with the chat they are already in — and
-- loses, because a WhatsApp reply reaches the couple where they actually are,
-- while a form field waits for somebody to remember to check it.
--
-- Removing the field but keeping the column would leave a second inbox nobody
-- reads and a column any future writer can quietly start filling. A field the
-- product does not have should not be a column the schema still offers.
--
-- `dietary_notes` STAYS. It is not a message: it is operational data the
-- catering needs, and a guest will not think to send it unprompted.
--
-- WHY THE VIEW IS RECREATED HERE
--
-- `rsvp_latest` (0008) selects `message`, so it depends on the column and the
-- DROP would fail against it. Recreating the view is therefore part of this
-- migration rather than a separate step — and recreating it rather than using
-- `drop column ... cascade`, because cascade would silently take the view with
-- it and leave every RSVP aggregate re-deriving "latest row wins" at its own
-- call site, which is the defect 0008 exists to end.
--
-- The recreated definition is 0008's, minus one column: `security_invoker`,
-- `distinct on (invitation_id)` and the total `submitted_at desc, id desc`
-- ordering are all preserved deliberately. See 0008 for why each is load-bearing.

drop view if exists rsvp_latest;

alter table rsvp_responses drop column message;

create view rsvp_latest with (security_invoker = true) as
select distinct on (invitation_id)
  id,
  invitation_id,
  attending,
  attendee_guest_ids,
  seats_confirmed,
  dietary_notes,
  submitted_at
from rsvp_responses
order by invitation_id, submitted_at desc, id desc;

comment on view rsvp_latest is
  'One row per invitation: the newest rsvp_responses row, ties broken by id. '
  'Every RSVP count, list or total MUST start here; rsvp_responses is the history.';
