-- Returns the ceremony row to the two Zoom credentials.
--
-- HONEST SCOPE: this destroys data. The Meet link is dropped, and the two
-- columns come back holding the placeholder rather than whatever they held
-- before 0017 — those values were destroyed when 0017 ran. Capture the link
-- first if it matters:
--
--   select stream_url from ceremony;
--
-- It restores the SHAPE, not the behaviour. The application after this rollback
-- expects `stream_url`, so `getCeremony` will fail on the missing column rather
-- than render a call nobody can join. Roll the application back with the schema.

alter table ceremony
  add column stream_meeting_id text not null default '{{ZOOM_MEETING_ID}}'
    check (char_length(stream_meeting_id) <= 200),
  add column stream_passcode text not null default '{{ZOOM_PASSCODE}}'
    check (char_length(stream_passcode) <= 200);

alter table ceremony
  alter column stream_meeting_id drop default,
  alter column stream_passcode drop default;

alter table ceremony
  add constraint ceremony_stream_meeting_id_not_blank
    check (btrim(stream_meeting_id) <> ''),
  add constraint ceremony_stream_passcode_not_blank
    check (btrim(stream_passcode) <> '');

alter table ceremony drop column stream_url;
