-- Rollback for 0003_triggers.sql.

drop trigger if exists rsvp_seat_cap on rsvp_responses;
drop trigger if exists rsvp_responses_append_only on rsvp_responses;
drop trigger if exists dispatch_events_append_only on dispatch_events;
drop function if exists enforce_seat_cap();
drop function if exists reject_mutation();
