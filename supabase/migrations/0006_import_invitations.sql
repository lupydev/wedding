-- 0006_import_invitations.sql — make the guest import atomic and idempotent.
--
-- THE PROBLEM
--
-- `scripts/import-guests.ts` looped over the validated rows and called
-- `createInvitation` once per household. PostgREST has no cross-request
-- transaction, so a failure on row 40 of 60 left 39 invitations created and 21
-- not — with no clean way to re-run, because a second run would duplicate the
-- 39. Validating everything up front narrowed the window; it did not close it,
-- since FK violations, unique-slug collisions and network faults all happen at
-- write time.
--
-- ATOMIC: the whole import is ONE function call, therefore one transaction. Any
-- exception anywhere rolls back every household, including the ones that had
-- already succeeded.
--
-- IDEMPOTENT: `invitations.source_key` is the household's identity in the
-- source file, and `on conflict do nothing` makes a re-import a no-op for rows
-- that already landed. The column is NULLable and its index is a plain unique
-- index, so invitations created by any other path (the console, later) simply
-- carry no source key and never collide — many NULLs are allowed.
--
-- Slugs are still minted by the adapter (design D2), passed in with the
-- payload, so the database keeps no randomness policy of its own.

alter table invitations add column source_key text;
create unique index invitations_source_key_idx on invitations(source_key);
comment on column invitations.source_key is
  'Identity of this household in the import source. NULL for invitations created by any other path. Makes re-running the same import a no-op instead of a duplicate.';

create function import_invitations(payload jsonb) returns jsonb
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

-- Belt and braces. 0004's event trigger already revokes these grants the
-- moment the function is created; this states the intent at the point of
-- definition so a reader never has to infer it from another migration.
-- Without either, PostgREST would publish this as an anon-callable RPC that
-- writes invitations.
revoke all on function import_invitations(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
