-- 0011_wedding_facts.sql — the rest of the wedding's facts join the same row.
--
-- WHY THESE THREE COLUMNS EXIST
--
-- The couple's names, the venue and its address were module constants in
-- `components/invitation/InvitationBody.tsx` and one exported string in
-- `lib/domain/og-card.ts`. That put the same facts in two kinds of place: four
-- of them in a row an operator could UPDATE, and four of them compiled into a
-- JavaScript bundle that only a redeploy can change.
--
-- Migration 0009 already wrote down why that is the wrong shape, and its own
-- comment named the fix: "`{{WEDDING_DATE}}` should be read from
-- `ceremony_date` here rather than restated in the component, for the same
-- drift reason this table exists." This is that change. There is no separate
-- `wedding_date`: the ceremony's date IS the wedding's date, and a second
-- column holding the same day is the drift the table exists to prevent.
--
-- WHY THE COUPLE'S NAMES IN PARTICULAR MATTER HERE
--
-- They are the one fact that reaches a guest through a channel this system
-- cannot correct. The Open Graph card is served `immutable, max-age=31536000`
-- and WhatsApp caches a preview per URL, so a name changed after invitations
-- went out leaves every delivered card showing the old text for good. Keeping
-- the names in a row does not fix that — nothing can, short of rotating the
-- slug and resending — but it does mean the console can say so at the moment
-- somebody edits them, which a source constant never could.
--
-- WHY EVERY VALUE COLUMN GAINS A NON-BLANK CHECK
--
-- Until now the only writer was a migration, so `not null` was the whole
-- guard. From this migration on a console form writes all seven, and a form
-- field an operator clears submits an empty STRING, not a null. That satisfies
-- `not null` exactly, and what it renders is an invitation with a hole where
-- the venue should be — which reads to a guest not as broken but as a venue
-- nobody has been told yet. `btrim` is in the check because a field holding one
-- space is indistinguishable from a filled one in a text input.
--
-- WHY THE ADDRESS IS ALLOWED TO BE LONGER
--
-- 200 characters is generous for a name, a date or a meeting id. A street
-- address with a neighbourhood, a city and a landmark ("frente a la iglesia")
-- is the one value here that plausibly runs past it, and truncation would be
-- the half-correct address that sends a car to the wrong gate.
--
-- SECURITY AND POSTURE
--
-- No new table, so the `0004` event trigger has nothing to do: `ceremony`
-- already has RLS enabled, zero policies and no `anon`/`authenticated` grant,
-- and `supabase/tests/ceremony.spec.ts` re-asserts all three after this
-- migration. Adding columns cannot widen any of them.
--
-- The Zoom passcode stays what it always was: a value visible behind the phone
-- gate to every household that declined. Changing it does not un-share the old
-- one, which is why the console editor says so beside the field.

alter table ceremony
  add column couple_names  text not null default '{{COUPLE_NAMES}}',
  add column venue_name    text not null default '{{VENUE_NAME}}',
  add column venue_address text not null default '{{VENUE_ADDRESS}}';

-- The defaults existed only to seed the one row that was already there. They
-- are dropped immediately: the singleton is never INSERTed again, so a lingering
-- default could only ever hide a write that forgot a field.
alter table ceremony
  alter column couple_names  drop default,
  alter column venue_name    drop default,
  alter column venue_address drop default;

alter table ceremony
  add constraint ceremony_couple_names_length
    check (char_length(couple_names) <= 200),
  add constraint ceremony_venue_name_length
    check (char_length(venue_name) <= 200),
  add constraint ceremony_venue_address_length
    check (char_length(venue_address) <= 300);

-- Named one per column, not one for the row: a refusal then tells the operator
-- WHICH field they cleared, and an action that has to guess would report the
-- wrong one.
alter table ceremony
  add constraint ceremony_ceremony_date_not_blank
    check (btrim(ceremony_date) <> ''),
  add constraint ceremony_ceremony_time_not_blank
    check (btrim(ceremony_time) <> ''),
  add constraint ceremony_stream_meeting_id_not_blank
    check (btrim(stream_meeting_id) <> ''),
  add constraint ceremony_stream_passcode_not_blank
    check (btrim(stream_passcode) <> ''),
  add constraint ceremony_couple_names_not_blank
    check (btrim(couple_names) <> ''),
  add constraint ceremony_venue_name_not_blank
    check (btrim(venue_name) <> ''),
  add constraint ceremony_venue_address_not_blank
    check (btrim(venue_address) <> '');

comment on table ceremony is
  'Exactly one row: every fact about the wedding that more than one surface '
  'shows — the couple''s names, the date, the time, the venue, its address and '
  'the stream credentials. Every surface MUST read this row; never restate a '
  'value in source. Editing couple_names after invitations were dispatched '
  'cannot change an already-delivered Open Graph card.';

comment on column ceremony.ceremony_date is
  'The wedding date AND the stream date. There is deliberately no second '
  'wedding_date column: one day, one place to correct it.';

comment on column ceremony.couple_names is
  'Reaches guests through the immutable, WhatsApp-cached Open Graph card. '
  'A change after dispatch is not retroactive.';
