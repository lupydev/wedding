-- Drops the reduced RSVP view.
--
-- Rolling this back removes the only object that reduces the append-only
-- history to one row per invitation. Whatever reads it must go back to doing
-- that reduction itself, correctly, at every call site — which is the state
-- this migration exists to end.

drop view if exists rsvp_latest;
