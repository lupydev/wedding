-- 0016_drop_rsvp_deadline.sql — the second destructive statement of this project.
--
-- WHY THE COLUMN GOES
--
-- There is one wedding, so there is one confirmation deadline. It lives in
-- `lib/domain/wedding-day.ts` as `RSVP_DEADLINE`, derived from the ceremony
-- instant, and every invitation reads that same value. The couple asked for
-- exactly this — "que la fecha límite de confirmación sea una constante como el
-- nombre de la pareja y la fecha de la boda para que no toque estar agregándola
-- en cada una de las invitaciones" — and the expand half landed with it: since
-- then nothing reads `invitations.rsvp_deadline` to make a decision. It has
-- been carried through types, selects and inserts by inertia alone.
--
-- WHY IT IS SAFE TO DO THIS NOW, STATED PLAINLY
--
-- `DROP COLUMN` destroys every stored value and no down script can invent them
-- back. The usual answer is to wait; here there is nothing to wait for. No
-- invitation has been sent, no guest has answered one, and nothing has reached
-- the branch Vercel deploys from. The rows in the database are fixtures.
--
-- WHAT WAS VERIFIED BEFORE WRITING THIS, AGAINST THE RUNNING CATALOG
--
-- The same four questions 0013 asked, and for the same reason: PL/pgSQL
-- resolves a column reference when the function RUNS, not when it is created,
-- so a function still naming the column would survive this migration and then
-- fail on the next real import — a landmine no `DROP COLUMN` error reports.
--
--     views       — none
--     constraints — none
--     indexes     — none
--     functions   — `import_invitations`, WHICH IS EXACTLY THE CASE THE CHECK
--                   EXISTS TO CATCH. It still writes `rsvp_deadline`, so it is
--                   redefined below, in this same migration, before the column
--                   is dropped.
--
-- That is why step 3 is a bare `drop column` and not `drop column ... cascade`:
-- after step 2 there is nothing left to cascade to, and CASCADE would silently
-- destroy whatever appeared between the check and the statement rather than
-- refusing.
--
-- DEPLOY ORDERING
--
--     apply this migration at any point AFTER commit 48a51f2 and its code are
--     both live — that is the release where the constant replaced the column.
--
-- ⚠ ROLLING BACK PAST THAT RELEASE IS NO LONGER CODE-ONLY. The down script
-- re-creates the column, and it re-creates it EMPTY: unlike `seats_allowed`,
-- whose value could be reconstructed from the member count, a per-invitation
-- deadline is not derivable from anything. The wedding-wide constant is not
-- that data; writing it into every row would be an invention wearing the shape
-- of a restore. Step 1 below is the only record of what was there.

-- 1 ─ name what is about to be destroyed, before destroying it.
--
--     Every invitation created since 48a51f2 carries NULL, because nothing has
--     written this column since. A row holding a date is one an operator typed
--     before that release, and it is a fact about that household the schema is
--     about to stop being able to express. Those are listed individually; a
--     NULL says nothing and is only counted.
do $$
declare
  stored  int;
  total   int;
  row_record record;
begin
  select count(*) into total from invitations;
  select count(*) into stored from invitations where rsvp_deadline is not null;

  raise notice 'rsvp_deadline: % of % invitations hold a date that is about to be lost.',
    stored, total;

  for row_record in
    select id, display_name, rsvp_deadline
      from invitations
     where rsvp_deadline is not null
     order by display_name
  loop
    raise notice '  lost: invitation % (%) held rsvp_deadline=%',
      row_record.id, row_record.display_name, row_record.rsvp_deadline;
  end loop;
end $$;

-- 2 ─ the importer, superseded rather than edited (D13), exactly as 0012
--     superseded 0006's. Identical to 0012's except that it no longer writes
--     `rsvp_deadline`. A payload still carrying the key is ignored rather than
--     refused: an old file should import, it just cannot set a deadline that
--     no longer exists.
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
      slug, owner_sender_id, display_name, greeting_name, source_key
    )
    values (
      item->>'slug',
      (item->>'owner_sender_id')::uuid,
      item->>'display_name',
      item->>'greeting_name',
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

-- The grants, restated at the point of definition for the same reason 0006 and
-- 0012 restate them: 0004's event trigger already revokes them the moment the
-- function is created, and a reader should never have to infer that from
-- another migration.
revoke all on function import_invitations(jsonb) from public, anon, authenticated;

-- 3 ─ and now the destructive statement itself, alone.
alter table invitations drop column rsvp_deadline;
