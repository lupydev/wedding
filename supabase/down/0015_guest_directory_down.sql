-- Reverses 0015 by putting `invitation_guests.invitation_id` back to
-- `not null` with `on delete cascade`.
--
-- HONEST WARNING, AND IT IS NOT HYPOTHETICAL
--
-- Every guest sitting in the directory — anybody typed in before being placed
-- in a household, and anybody released by a deleted invitation — holds NULL in
-- that column. `set not null` REFUSES on those rows rather than inventing a
-- household for them, which is the right failure and means this script is not a
-- no-op on a database that has been used.
--
-- There is no mechanical way through. A guest with no invitation has no
-- invitation to be put back into: the household that held them may have been
-- deleted, which is precisely why they are unassigned. Whoever rolls this back
-- has to decide, person by person, whether to place them somewhere or delete
-- them. The `raise notice` below names every one of them first, so that
-- decision is made with the list in hand instead of after a failed migration.
--
-- Restoring the cascade is the quieter half and the more dangerous one: from
-- then on, deleting an invitation deletes its people again.

do $$
declare
  stranded record;
  total integer := 0;
begin
  for stranded in
    select id, full_name
    from invitation_guests
    where invitation_id is null
    order by full_name
  loop
    total := total + 1;
    raise notice
      'Guest "%" (%) belongs to no invitation, and the restored NOT NULL refuses that. Place them in one or delete them before rolling back.',
      stranded.full_name, stranded.id;
  end loop;

  if total > 0 then
    raise notice
      '% guest(s) are in the directory with no invitation. This rollback will fail until every one of them is resolved.',
      total;
  end if;
end $$;

drop index if exists invitation_guests_unassigned_idx;

alter table invitation_guests
  drop constraint invitation_guests_invitation_id_fkey;

alter table invitation_guests
  add constraint invitation_guests_invitation_id_fkey
  foreign key (invitation_id) references invitations(id)
  on delete cascade;

alter table invitation_guests
  alter column invitation_id set not null;

comment on column invitation_guests.invitation_id is null;
