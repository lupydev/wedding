-- Reverses 0014 by restoring the sixteen-character base32 check.
--
-- HONEST WARNING, AND IT IS NOT HYPOTHETICAL
--
-- Any invitation created while 0014 was in force has a readable slug, and the
-- old pattern refuses it. Adding the constraint back will FAIL on those rows
-- rather than corrupt them — which is the right failure, but it means this
-- script is not a no-op on a database that has been used.
--
-- Rotating those invitations to random slugs first is the only way through, and
-- that changes addresses guests may already hold. The `raise notice` below
-- names them before the constraint is attempted, so whoever runs this knows
-- exactly which links they are about to break.

do $$
declare
  offender record;
begin
  for offender in
    select slug, greeting_name
    from invitations
    where slug !~ '^[a-z2-7]{16}$'
  loop
    raise notice
      'Invitation "%" holds the readable slug "%", which the restored check refuses. Rotate it before rolling back.',
      offender.greeting_name, offender.slug;
  end loop;
end $$;

alter table invitations
  drop constraint if exists invitations_slug_check;

alter table invitations
  add constraint invitations_slug_check
  check (slug ~ '^[a-z2-7]{16}$');

comment on column invitations.slug is null;
