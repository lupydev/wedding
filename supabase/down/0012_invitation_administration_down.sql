-- Restores the pre-0012 schema. Reverse order.
--
-- Two things a revert CANNOT restore, stated rather than hidden:
--
--  1. `seats_allowed` is still HERE — 0012 only relaxed it, so every value a
--     row already held survives this rollback untouched. What cannot survive is
--     a row created WHILE 0012 was applied: nothing wrote the column, so it is
--     NULL and has to be backfilled from count(*), which is exactly the value
--     the derived rule defines and therefore lossless under that rule.
--  2. 0001's check is `between 1 and 12`. A zero-member or >12-member
--     invitation created after 0012 has no legal value, so it is CLAMPED and
--     named. Clamping is preferred to failing the revert: a revert that cannot
--     run is not a rollback plan. The same applies to any pre-0012 row whose
--     stored value somehow left that range.

drop trigger if exists invitation_guests_clear_recipient_on_move on invitation_guests;
drop function if exists clear_recipient_on_guest_move();

alter table invitations drop constraint if exists invitations_dispatch_recipient_fk;
alter table invitations drop column if exists dispatch_recipient_guest_id;
alter table invitation_guests drop constraint if exists invitation_guests_invitation_id_id_key;
alter table invitations drop column if exists greeting_name_source;
alter table invitation_guests drop column if exists nickname;

comment on column invitations.seats_allowed is null;

-- Backfill ONLY the rows 0012 left without a value. A row that already carried
-- one keeps it, disagreement with the member count included: that disagreement
-- is the pre-0012 state this script is restoring, not a defect to correct.
do $$
declare r record;
begin
  for r in
    select i.id, i.display_name, count(g.id)::int as members
      from invitations i
      left join invitation_guests g on g.invitation_id = i.id
     where i.seats_allowed is null
     group by i.id, i.display_name
  loop
    if r.members < 1 or r.members > 12 then
      raise notice 'invitation "%" (%) has % members, outside 0001''s 1..12 check; seats_allowed clamped.',
        r.display_name, r.id, r.members;
    end if;

    update invitations
       set seats_allowed = least(12, greatest(1, r.members))
     where id = r.id;
  end loop;
end $$;

update invitations
   set seats_allowed = least(12, greatest(1, seats_allowed))
 where seats_allowed not between 1 and 12;

-- NOT NULL IS DELIBERATELY NOT RESTORED HERE, and that is not an oversight.
--
-- This script exists to recover from a bad 0012 while the application is still
-- running. By then the application has stopped writing `seats_allowed` at all,
-- so restoring NOT NULL would make every new invitation fail with a not-null
-- violation for the whole window between running this script and reverting the
-- commit — a write outage on the couple's own path, in the middle of a rollback.
--
-- A DEFAULT was the other option and is worse: writes would succeed carrying an
-- invented allowance, which is exactly the lie dropping the column removed.
--
-- The column comes back nullable, backfilled and range-checked (a CHECK passes
-- on NULL, so the constraint is still safe to add now). After the application
-- code is reverted, close the loop by hand:
--
--   alter table invitations alter column seats_allowed set not null;
alter table invitations
  add constraint invitations_seats_allowed_check check (seats_allowed between 1 and 12);

-- Restore 0007's body verbatim (cap from seats_allowed, cap checked first).
create or replace function enforce_seat_cap() returns trigger language plpgsql as $$
declare
  cap   int;
  named int := cardinality(new.attendee_guest_ids);
begin
  select seats_allowed into cap from invitations where id = new.invitation_id;

  if new.seats_confirmed > cap or named > cap then
    raise exception 'seats_confirmed % exceeds seats_allowed %', new.seats_confirmed, cap;
  end if;

  if named <> new.seats_confirmed then
    raise exception 'seats_confirmed % does not match attendee_guest_ids of length %',
      new.seats_confirmed, named;
  end if;

  return new;
end $$;

-- Restore 0006's import_invitations verbatim (seats_allowed present, no nickname).
create or replace function import_invitations(payload jsonb) returns jsonb
language plpgsql as $$
declare
  item          jsonb;
  guest         jsonb;
  new_id        uuid;
  existing_slug text;
  row_key       text;
  outcome       jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception 'import_invitations expects a JSON array, got %',
      coalesce(jsonb_typeof(payload), 'null');
  end if;

  for item in select value from jsonb_array_elements(payload) loop
    -- Reset explicitly. plpgsql leaves a variable untouched when a RETURNING
    -- clause matches no row, so without this an ON CONFLICT skip would inherit
    -- the previous household's id and attach this household's guests to it.
    new_id := null;
    existing_slug := null;
    row_key := nullif(btrim(coalesce(item->>'source_key', '')), '');

    if row_key is null then
      raise exception 'every imported invitation needs a source_key; the import is not re-runnable without one';
    end if;

    insert into invitations (
      slug, owner_sender_id, display_name, greeting_name,
      seats_allowed, rsvp_deadline, source_key
    )
    values (
      item->>'slug',
      (item->>'owner_sender_id')::uuid,
      item->>'display_name',
      item->>'greeting_name',
      (item->>'seats_allowed')::int,
      (item->>'rsvp_deadline')::date,
      row_key
    )
    on conflict (source_key) do nothing
    returning id into new_id;

    if new_id is null then
      select i.slug into existing_slug from invitations i where i.source_key = row_key;

      if existing_slug is null then
        -- Neither inserted nor found: a conflict on some OTHER constraint,
        -- reported rather than silently counted as "already present".
        raise exception 'invitation % was neither created nor already present', row_key;
      end if;

      outcome := outcome || jsonb_build_object(
        'source_key', row_key, 'slug', existing_slug, 'created', false);
      continue;
    end if;

    for guest in select value from jsonb_array_elements(coalesce(item->'guests', '[]'::jsonb)) loop
      insert into invitation_guests (
        invitation_id, full_name, phone_e164, is_primary, is_child
      )
      values (
        new_id,
        guest->>'full_name',
        guest->>'phone_e164',
        coalesce((guest->>'is_primary')::boolean, false),
        coalesce((guest->>'is_child')::boolean, false)
      );
    end loop;

    outcome := outcome || jsonb_build_object(
      'source_key', row_key, 'slug', item->>'slug', 'created', true);
  end loop;

  return outcome;
end $$;

revoke all on function import_invitations(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
