-- 0012_invitation_administration.sql — give the couple a real write side.
--
-- Five moves: a nickname, a stored reason for the greeting name, an explicit
-- dispatch recipient held structurally, a seat cap that reads the member count,
-- and the RELAXATION of the column that cap used to read.
--
-- WHY THIS MIGRATION RELAXES `seats_allowed` INSTEAD OF DROPPING IT
--
-- Dropping a column is one statement, and at that statement every select
-- naming it starts returning an error and every seeding INSERT fails. Slice 1
-- therefore splits: 0012 (this file) makes the column optional and unused so the
-- whole application can stop reading it on a tree that stays green, and 0013
-- drops it alone, on a tree that is already green without it. The column is
-- still HERE after this migration — nullable, unconstrained and read by nobody.
--
-- 0006 and 0007 are NOT edited. This project supersedes a function in a new
-- migration (0005 over 0003, 0007 over 0003); editing a shipped file would
-- desynchronise every database that already ran it. See design D13.

-- 1 ─ nickname. Optional free text, no uniqueness: two members of one group
--     sharing one is an ADVISORY (decision 10), and a constraint cannot be an
--     advisory.
alter table invitation_guests add column nickname text;
comment on column invitation_guests.nickname is
  'What this person is actually called. Feeds the derived greeting name: a list member contributes nickname else FIRST name, a solo guest nickname else FULL name. NULL means nobody has supplied one.';

-- 2 ─ why the greeting name says what it says.
--     THE DEFAULT IS THE WHOLE POINT. 'derived' would mark every imported row
--     derivable and the first membership edit would overwrite a hand-written
--     "Familia Restrepo". 'imported' means a script wrote this and no human has
--     looked at it, which lets the console offer a reset without claiming
--     anyone chose it. Decision 9, design D15.
alter table invitations add column greeting_name_source text not null default 'imported'
  check (greeting_name_source in ('derived', 'custom', 'imported'));
comment on column invitations.greeting_name_source is
  'derived = recompute from members on every membership or nickname write. custom = a human typed it; never overwrite. imported = a script wrote it and nobody has looked.';

-- 3 ─ the composite FK target. `id` is already the primary key, so this index
--     is redundant for lookups and exists solely so (invitation_id, id) can be
--     referenced.
alter table invitation_guests
  add constraint invitation_guests_invitation_id_id_key unique (invitation_id, id);

-- 4 ─ the explicit recipient, held structurally rather than remembered.
--
--     MATCH SIMPLE (the default) is load-bearing and MUST NOT become MATCH
--     FULL. Under SIMPLE the constraint is satisfied whenever ANY referencing
--     column is null, so a null recipient is legal. Under FULL both columns
--     would have to be null together, and `invitations.id` is never null — so
--     MATCH FULL would make "no recipient chosen" a constraint violation, which
--     is the state every invitation starts in.
--
--     THERE IS DELIBERATELY NO `on update` CLAUSE, AND IT MUST NOT BE ADDED.
--     Measured against this instance (PostgreSQL 17.6), not read from a manual.
--     All three rejected forms, with the exact error each produced:
--
--       on update set null (dispatch_recipient_guest_id)
--         ERROR:  a column list with SET NULL is only supported for ON DELETE
--                 actions
--         (rejected at DDL time; the statement never even creates)
--
--       on update set null            -- no column list; accepted, then at runtime:
--         ERROR:  null value in column "a" of relation "t_child" violates
--                 not-null constraint
--         CONTEXT:  UPDATE ONLY "public"."t_child" SET "a" = NULL,
--                   "chosen" = NULL WHERE ...
--         (it nulls EVERY referencing column, and one of ours is the PK `id`)
--
--       (no on update clause at all, i.e. the default NO ACTION) -- the move is
--       REFUSED:
--         ERROR:  update or delete on table "t_parent" violates foreign key
--                 constraint
--         DETAIL:  Key (a, b)=(...) is still referenced from table "t_child".
--
--     `on update cascade` is a fourth form and is worse than all of them: it
--     would rewrite `invitations.id` into a collision with the destination
--     invitation's primary key.
--
--     The default NO ACTION is therefore what we want, and it is the BACKSTOP:
--     if the trigger below is ever dropped, a move FAILS with that third error
--     instead of silently producing a cross-household recipient. The clearing
--     itself lives in that trigger. Design D11.
-- ⚠ DEPLOY ORDERING IS LOAD-BEARING, AND THIS MIGRATION IS NOT BACKWARD
--   COMPATIBLE WITH THE READER THAT PRECEDED IT.
--
--   This constraint is the SECOND foreign key between `invitations` and
--   `invitation_guests`, and PostgREST refuses an embed it can satisfy two
--   ways: `invitation_guests(...)` starts answering
--
--       Could not embed because more than one relationship was found
--
--   for every select that does not name the constraint. `INVITATION_SELECT`
--   (the guest's own invitation page) and `CONSOLE_INVITATION_SELECT` are both
--   on that path, and line 252 of this file ends with
--   `notify pgrst, 'reload schema'`, so the break is immediate rather than
--   eventual. It does not degrade: the page errors.
--
--   The application code in this same commit names the constraint
--   (`invitation_guests!invitation_guests_invitation_id_fkey(...)`) and is
--   therefore compatible BOTH before and after. So on any environment with a
--   running instance:
--
--       deploy the code FIRST, then apply this migration.
--
--   Applying this migration to a database whose application has not been
--   redeployed takes the invitation page and the console down until it is.
alter table invitations add column dispatch_recipient_guest_id uuid;
alter table invitations
  add constraint invitations_dispatch_recipient_fk
  foreign key (id, dispatch_recipient_guest_id)
  references invitation_guests (invitation_id, id)
  on delete set null (dispatch_recipient_guest_id);
comment on column invitations.dispatch_recipient_guest_id is
  'The member this invitation is addressed to. NULL means nobody has chosen, which BLOCKS dispatch on purpose (decision 2). Never backfilled from is_primary.';

-- 5 ─ moving a guest clears the choice. This is what the FK cannot do (D11),
--     and a trigger is house style here rather than a workaround: append-only
--     (0003/0005) and the seat cap (0007) are both triggers for the same
--     reason, that service_role carries BYPASSRLS and a policy binds nothing
--     against our own server code. A trigger binds against every writer.
--
--     BEFORE, so the clear lands before the row change and unambiguously ahead
--     of any constraint check. Scoped `update of invitation_id`, so an ordinary
--     phone or nickname edit never enters the function.
--
--     It clears the SOURCE only and sets nothing on the destination. Carrying
--     the choice across would be an auto-pick nobody made, which decision 2
--     removed. After a move the source reports no_recipient_chosen, a state the
--     preflight already handles. Design D25.
create function clear_recipient_on_guest_move() returns trigger language plpgsql as $$
begin
  if new.invitation_id is distinct from old.invitation_id then
    update invitations
       set dispatch_recipient_guest_id = null
     where id = old.invitation_id
       and dispatch_recipient_guest_id = old.id;
  end if;

  return new;
end $$;

create trigger invitation_guests_clear_recipient_on_move
  before update of invitation_id on invitation_guests
  for each row execute function clear_recipient_on_guest_move();

-- 0004's event trigger already revokes this, because `alter default privileges`
-- never covered FUNCTIONS and PostgREST would otherwise publish it as an
-- anon-callable RPC. Stated here too so a reader never has to infer it from
-- another migration (0006's precedent).
revoke all on function clear_recipient_on_guest_move()
  from public, anon, authenticated;

-- 6 ─ the cap now reads the member count.
--     0007's two checks and THEIR ORDER are reproduced verbatim. The hard cap
--     is evaluated FIRST so an over-cap submission still fails for the cap's own
--     reason: 0007 forces named = seats_confirmed in every legitimate
--     submission, so an over-cap row almost always trips parity too, and
--     checking parity first would send the operator to fix the wrong field.
--     count(*) additionally never returns NULL, unlike the old
--     `select seats_allowed into cap`, where a missing parent made `x > NULL`
--     null and the cap silently passed.
create or replace function enforce_seat_cap() returns trigger language plpgsql as $$
declare
  cap   int;
  named int := cardinality(new.attendee_guest_ids);
begin
  select count(*)::int into cap
    from invitation_guests
   where invitation_id = new.invitation_id;

  if new.seats_confirmed > cap or named > cap then
    raise exception 'seats_confirmed % exceeds the % named members of this invitation',
      new.seats_confirmed, cap;
  end if;

  if named <> new.seats_confirmed then
    raise exception 'seats_confirmed % does not match attendee_guest_ids of length %',
      new.seats_confirmed, named;
  end if;

  return new;
end $$;

-- 7 ─ `seats_allowed` stops being trustworthy, without yet disappearing.
--     From here nothing reads it and nothing writes it, so NOT NULL would make
--     every new invitation unwritable and `between 1 and 12` would constrain a
--     number nobody maintains. The column itself survives until 0013 so that
--     this migration's tree is green without the destructive statement in it.
alter table invitations alter column seats_allowed drop not null;
alter table invitations drop constraint invitations_seats_allowed_check;
comment on column invitations.seats_allowed is
  'DEAD as of 0012 and DROPPED by 0013. The seat cap is now count(*) of invitation_guests. Do not read this column and do not write it.';

-- 8 ─ the importer, superseded rather than edited (D13). Identical to 0006
--     except: no seats_allowed, guests carry nickname, and greeting_name_source
--     is left to its 'imported' DEFAULT so the importer has no way to write the
--     wrong value.
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

revoke all on function import_invitations(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
