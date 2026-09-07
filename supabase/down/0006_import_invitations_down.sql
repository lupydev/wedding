-- Rollback for 0006_import_invitations.sql.

drop function if exists import_invitations(jsonb);
drop index if exists invitations_source_key_idx;
alter table invitations drop column if exists source_key;

notify pgrst, 'reload schema';
