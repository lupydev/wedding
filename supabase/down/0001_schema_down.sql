-- Rollback for 0001_schema.sql.
--
-- Not stored under supabase/migrations/ on purpose: the CLI applies every file
-- in that directory in order, so a down-script living there would drop the
-- schema it had just created.

drop table if exists gate_attempts;
drop table if exists rsvp_responses;
drop table if exists dispatch_events;
drop table if exists invitation_guests;
drop table if exists invitations;
drop table if exists senders;

-- pgcrypto is intentionally left installed: it is not owned by this change and
-- other extensions in the Supabase stack may depend on it.
