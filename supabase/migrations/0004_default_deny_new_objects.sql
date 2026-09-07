-- 0004_default_deny_new_objects.sql — make default-deny future-proof.
--
-- WHY THIS EXISTS
--
-- `0002_rls.sql` revoked the grants that existed WHEN IT RAN. Its companion
-- `alter default privileges` was meant to cover later objects, but it binds to
-- the triple (grantor role, schema, object kind), so on this database it covers
-- exactly one case: TABLES and SEQUENCES created by `postgres` in `public`.
-- Three gaps were measured against the live instance, not assumed:
--
--   1. `supabase_admin` still holds default ACLs granting `anon` and
--      `authenticated` every privilege on new `public` tables. `postgres`
--      cannot close that: `alter default privileges for role supabase_admin`
--      fails with "permission denied to change default privileges".
--   2. FUNCTIONS were never covered. A function created by `postgres` in
--      `public` is granted EXECUTE to PUBLIC, `anon` and `authenticated`, and
--      PostgREST publishes it as an RPC endpoint. `0006` adds exactly such a
--      function.
--   3. Any tool that reinstates the default grants — a later migration, the
--      dashboard, a Supabase upgrade — silently un-does the protection for the
--      next object created, which is precisely when nobody is looking.
--
-- An event trigger has none of those blind spots: it fires on the object that
-- was actually created, whichever role created it and whatever the default
-- privileges said. It is `security invoker` on purpose — the revoke then runs
-- as the creating role, which owns the new object and is therefore always
-- allowed to revoke on it. A `security definer` version owned by `postgres`
-- could not revoke on a `supabase_admin`-owned table, which is gap 1.
--
-- Scope is deliberately `public` only. `auth`, `storage` and `realtime` are
-- Supabase's schemas, not ours, and must keep their own grants.

create function deny_anon_on_new_public_object() returns event_trigger
language plpgsql as $$
declare
  cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands() loop
    if cmd.schema_name is distinct from 'public' then
      continue;
    end if;

    -- `service_role` is never touched: it is our own server identity, and a
    -- table no server code can read would be a different outage, not security.
    if cmd.command_tag in (
      'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO',
      'CREATE VIEW', 'CREATE MATERIALIZED VIEW', 'CREATE FOREIGN TABLE'
    ) then
      execute format(
        'revoke all on %s from anon, authenticated', cmd.object_identity);

    elsif cmd.command_tag = 'CREATE SEQUENCE' then
      execute format(
        'revoke all on sequence %s from anon, authenticated', cmd.object_identity);

    -- PUBLIC is included for routines only, because EXECUTE is granted to
    -- PUBLIC by default. Revoking from `anon` alone would leave the endpoint
    -- reachable through PUBLIC membership.
    elsif cmd.command_tag = 'CREATE FUNCTION' then
      execute format(
        'revoke all on function %s from public, anon, authenticated', cmd.object_identity);

    elsif cmd.command_tag = 'CREATE PROCEDURE' then
      execute format(
        'revoke all on procedure %s from public, anon, authenticated', cmd.object_identity);
    end if;
  end loop;
end $$;

create event trigger deny_anon_on_new_public_objects
  on ddl_command_end
  execute function deny_anon_on_new_public_object();

-- The trigger cannot fire on its own creation, so its grants are revoked by
-- hand. Everything created from here on is covered by the trigger itself.
revoke all on function deny_anon_on_new_public_object() from public, anon, authenticated;

-- Close the two gaps that already exist for objects created before this point:
-- functions were never revoked at all, and the default privileges never
-- mentioned them.
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
