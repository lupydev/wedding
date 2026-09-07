-- Rollback for 0004_default_deny_new_objects.sql.
--
-- As in 0002, the revoked grants are NOT reissued. They are the leak this
-- migration closed, and handing them back from a rollback script would be a
-- silent regression rather than a rollback.

drop event trigger if exists deny_anon_on_new_public_objects;
drop function if exists deny_anon_on_new_public_object();
