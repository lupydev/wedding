-- Rollback for 0005_append_only_allows_cascade.sql.
--
-- Restores 0003's body: every UPDATE and every DELETE is rejected, including
-- the ON DELETE CASCADE from `invitations`. Rolling back therefore reinstates
-- the undeletable-invitation defect on purpose — that is what this migration
-- fixed, and a rollback that kept the fix would not be a rollback.

create or replace function reject_mutation() returns trigger language plpgsql as $$
begin raise exception 'table % is append-only', tg_table_name; end $$;
