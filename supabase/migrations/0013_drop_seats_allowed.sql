-- 0013_drop_seats_allowed.sql — the one destructive statement of this capability.
--
-- WHY THIS IS A MIGRATION OF ITS OWN
--
-- 0012 did the whole expand half: it rewrote `enforce_seat_cap` to take the cap
-- from `count(*)` of `invitation_guests`, dropped `seats_allowed`'s NOT NULL and
-- its `between 1 and 12` check, and left a comment on the column saying it is
-- dead and that 0013 removes it. Everything in that migration is reversible.
--
-- This one is not. `DROP COLUMN` destroys every stored value, and no down script
-- can invent them back. Landing it alone, on a tree that is already green
-- without it, is the entire point of the 1a/1b split: if anything here goes
-- wrong, the thing to reason about is one statement, not seven hundred lines.
--
-- WHAT WAS VERIFIED BEFORE WRITING THIS, AGAINST THE RUNNING SCHEMA
--
-- Reading 0012 is not proof that nothing depends on the column, because PL/pgSQL
-- resolves column references when the function RUNS, not when it is created. A
-- trigger function still naming `seats_allowed` would survive this migration and
-- then fail on the next real RSVP — a landmine that no `DROP COLUMN` error
-- reports. So the live catalog was asked directly, for functions (excluding
-- aggregates, where `pg_get_functiondef` errors), views, constraints and
-- indexes whose definition mentions the column. All four came back empty.
--
-- That is why this is a bare `drop column` and not `drop column ... cascade`:
-- there is nothing to cascade to, and CASCADE would silently destroy whatever
-- appeared between that check and this statement instead of refusing.
--
-- DEPLOY ORDERING
--
--     apply this migration at any point AFTER 0012 and its code are both live.
--
-- Unlike 0012 this migration needs no coordination with a deploy, because by
-- 0012 nothing reads or writes the column any more: the application cannot tell
-- the difference between a dead column and an absent one.
--
-- ⚠ WHAT IT DOES BREAK IS ROLLING BACK PAST 0012.
--
-- The pre-0012 release DID read `seats_allowed`, on the invitation page and in
-- the console. Once this migration has run, reverting the application that far
-- back is no longer a code-only operation, and the data those readers wanted is
-- gone rather than merely untrusted. The rollback is ordered and it is lossy:
--
--     1. run supabase/down/0013_drop_seats_allowed_down.sql
--        (re-creates the column and RECONSTRUCTS a value — it does not restore
--         the old one; read that script's own warning before relying on it)
--     2. run supabase/down/0012_invitation_administration_down.sql
--     3. then revert the application commits
--     4. alter table invitations alter column seats_allowed set not null;
--
-- Step 1 is the step that cannot give back what step 0 took. If the stored
-- numbers still matter to anybody, copy them out BEFORE applying this migration.

-- 1 ─ name what is about to be destroyed, before destroying it.
--
--     A value equal to the invitation's member count carries no information: the
--     new cap derives exactly that number, so losing it loses nothing. A value
--     that DISAGREES is the opposite — it is a fact about this household that
--     the schema will no longer be able to express, and the only moment anybody
--     can still see it is now. Those rows are listed individually; the rest are
--     counted. A NULL disagrees with nothing, because 0012 already stopped
--     maintaining the column and every invitation created since carries NULL.
do $$
declare
  total      int;
  informative int;
  row_record record;
begin
  select count(*) into total
    from invitations
   where seats_allowed is not null;

  select count(*) into informative
    from (
      select i.id
        from invitations i
        left join invitation_guests g on g.invitation_id = i.id
       where i.seats_allowed is not null
       group by i.id, i.seats_allowed
      having i.seats_allowed <> count(g.id)::int
    ) disagreeing;

  raise notice 'seats_allowed: % of % rows hold a value that disagrees with the member count and is about to be lost.',
    informative, total;

  for row_record in
    select i.id, i.display_name, i.seats_allowed, count(g.id)::int as members
      from invitations i
      left join invitation_guests g on g.invitation_id = i.id
     where i.seats_allowed is not null
     group by i.id, i.display_name, i.seats_allowed
    having i.seats_allowed <> count(g.id)::int
     order by i.display_name
  loop
    raise notice '  lost: invitation % (%) had seats_allowed=% with % named members',
      row_record.id, row_record.display_name, row_record.seats_allowed, row_record.members;
  end loop;
end $$;

-- 2 ─ and now the destructive statement itself, alone.
alter table invitations drop column seats_allowed;
