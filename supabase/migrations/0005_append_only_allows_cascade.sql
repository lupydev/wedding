-- 0005_append_only_allows_cascade.sql — append-only must not mean undeletable.
--
-- THE PROBLEM
--
-- `0003_triggers.sql` rejected every UPDATE and every DELETE on
-- `dispatch_events` and `rsvp_responses`. `invitations` is the parent of both
-- with `on delete cascade`, so the cascade itself was rejected too: an
-- invitation that had ever been dispatched could never be deleted. The most
-- likely reason to need that delete is an invitation created by mistake during
-- import — exactly the case the old trigger made impossible.
--
-- THE CHOICE (two candidates were considered)
--
--   (a) Allow the cascade, distinguishing it from a direct delete.
--   (b) Replace the cascade with an explicit archival path.
--
-- (a) is implemented. (b) means either `on delete restrict` plus an archive
-- table, or a soft-delete column — both of which add a second definition of
-- "this invitation exists" that every later read path (the gate, the OG image,
-- the console list, the RSVP write) would have to honour, and any one of them
-- forgetting it is a leak of a supposedly-removed invitation. A hard cascade
-- keeps one definition. The mistaken-import case wants the row gone, not
-- archived, because the row's whole content is the mistake.
--
-- THE DISCRIMINATION
--
-- The FK's cascade is an AFTER DELETE trigger on `invitations`, so when the
-- child's BEFORE DELETE trigger runs the parent row is already gone in this
-- transaction's snapshot. A direct delete always leaves it present, because
-- `invitation_id` is NOT NULL and its FK is not deferrable. This is a fact
-- about the transaction, not a heuristic like `pg_trigger_depth()`, which
-- would also have exempted any other nested trigger.
--
-- What is NOT weakened: a direct UPDATE or DELETE is still rejected, including
-- as `service_role`, which has BYPASSRLS and is why this is a trigger rather
-- than a policy (design D5).

create or replace function reject_mutation() returns trigger language plpgsql as $$
begin
  -- DELETE only. `invitations.id` is never updated, so a cascading UPDATE
  -- cannot occur here and an UPDATE exemption would be pure attack surface.
  if tg_op = 'DELETE'
     and not exists (select 1 from invitations where id = old.invitation_id)
  then
    return old;
  end if;

  raise exception 'table % is append-only', tg_table_name;
end $$;

-- Both existing triggers already call this function, so replacing the body is
-- the whole change; the triggers themselves are untouched.
