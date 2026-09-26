-- 0016_drop_rsvp_deadline_down.sql — puts the column back, EMPTY.
--
-- ⚠ READ THIS BEFORE RELYING ON THIS SCRIPT.
--
-- `alter table ... drop column` destroyed every stored `rsvp_deadline`. Nothing
-- in this file can recover them, and nothing else can either.
--
-- AND UNLIKE 0013, THERE IS NOTHING TO RECONSTRUCT FROM. `seats_allowed` could
-- be rebuilt from the member count, because that is what the value meant. A
-- per-invitation deadline means nothing but itself: it is a date somebody chose
-- for one household. `RSVP_DEADLINE` — the wedding-wide constant that replaced
-- this column — is not that data, and writing it into every row would be an
-- invention wearing the shape of a restore. Every household would come back
-- holding a date nobody ever set for it, indistinguishable from one that was.
--
-- So the column comes back NULL everywhere. The pre-drop NOTICE printed by
-- 0016 into the deploy log is the sole surviving record of what was there; go
-- and read it rather than assuming this script restored anything.
--
-- The importer is restored to 0012's version, which writes the column again.
-- That is what makes this a real reversal rather than half of one: leaving the
-- 0016 function in place would give back a column the import path silently
-- ignores, which is worse than not having it.

alter table invitations add column rsvp_deadline date;

comment on column invitations.rsvp_deadline is
  'RE-CREATED EMPTY by 0016''s down script. Every stored value was destroyed by '
  '0016 and none is recoverable; the wedding-wide RSVP_DEADLINE constant is not '
  'this data. 0016''s pre-drop NOTICE in the deploy log is the only record.';

-- 0012's importer, restored verbatim: it writes `rsvp_deadline` again.
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
    new_id := null;
    existing_slug := null;
    row_key := nullif(btrim(coalesce(item->>'source_key', '')), '');

    if row_key is null then
      raise exception 'every imported invitation needs a source_key; the import is not re-runnable without one';
    end if;

    insert into invitations (
      slug, owner_sender_id, display_name, greeting_name, rsvp_deadline, source_key
    )
    values (
      item->>'slug',
      (item->>'owner_sender_id')::uuid,
      item->>'display_name',
      item->>'greeting_name',
      (item->>'rsvp_deadline')::date,
      row_key
    )
    on conflict (source_key) do nothing
    returning id into new_id;

    if new_id is null then
      select i.slug into existing_slug from invitations i where i.source_key = row_key;

      if existing_slug is null then
        raise exception 'invitation % was neither created nor already present', row_key;
      end if;

      outcome := outcome || jsonb_build_object(
        'source_key', row_key, 'slug', existing_slug, 'created', false);
      continue;
    end if;

    for guest in select value from jsonb_array_elements(coalesce(item->'guests', '[]'::jsonb)) loop
      insert into invitation_guests (
        invitation_id, full_name, nickname, phone_e164, is_primary, is_child
      )
      values (
        new_id,
        guest->>'full_name',
        nullif(btrim(coalesce(guest->>'nickname', '')), ''),
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
