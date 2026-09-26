-- The ceremony streams on Google Meet, so the row carries one address instead
-- of two credentials.
--
-- WHY THE SHAPE CHANGES RATHER THAN THE WORDING.
--
-- `stream_meeting_id` and `stream_passcode` exist because Zoom is two values a
-- guest READS and TYPES into an app. That is why the guest-facing block renders
-- them large, each with a copy button: it is a surface built for transcription.
--
-- A Meet link is a URL. The guest taps it and is in the call. Keeping two
-- columns would mean an operator inventing a passcode Meet never issues, and a
-- guest hunting for somewhere to paste it.
--
-- WHAT THIS DESTROYS, STATED PLAINLY. Dropping the two columns destroys their
-- values. At the time of writing the row holds `{{ZOOM_MEETING_ID}}` and
-- `{{ZOOM_PASSCODE}}` — the seeded placeholders, read from the database before
-- this was written — so nothing real is lost. A deployment that has since had a
-- real meeting id typed into it should capture the row first:
--
--   select stream_meeting_id, stream_passcode from ceremony;

alter table ceremony
  -- Added with the placeholder as its default so the existing row satisfies
  -- `not null` in the same statement. A nullable column filled afterwards would
  -- leave a window in which `getCeremony` could read a null it has no type for.
  --
  -- The placeholder is deliberately the same SHAPE of tell as the two it
  -- replaces: an unfinished invitation must look unfinished. `{{MEET_URL}}` is
  -- not a valid https address, so `parseWeddingFacts` refuses it and the console
  -- cannot save the row until somebody replaces it.
  add column stream_url text not null default '{{MEET_URL}}'
    check (char_length(stream_url) <= 500);

-- The default was scaffolding for the backfill above, not a rule. Left in place
-- it would let a future insert omit the address and still look complete.
alter table ceremony alter column stream_url drop default;

alter table ceremony
  add constraint ceremony_stream_url_not_blank
    check (btrim(stream_url) <> '');

-- Dropping a column drops its constraints with it, so 0011's non-blank checks on
-- these two need no statement of their own.
alter table ceremony
  drop column stream_meeting_id,
  drop column stream_passcode;
