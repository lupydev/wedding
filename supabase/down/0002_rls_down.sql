-- Rollback for 0002_rls.sql.
--
-- Restoring the revoked grants is deliberately NOT part of this rollback: those
-- grants are the leak this migration closed, and re-issuing them from a
-- rollback script would be a silent regression. Roll all the way back with
-- 0001_schema_down.sql instead when the schema itself must go.

alter table senders           disable row level security;
alter table invitations       disable row level security;
alter table invitation_guests disable row level security;
alter table dispatch_events   disable row level security;
alter table rsvp_responses    disable row level security;
alter table gate_attempts     disable row level security;
