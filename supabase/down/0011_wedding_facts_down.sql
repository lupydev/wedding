-- Removes the couple's names, the venue and its address from the ceremony row.
--
-- HONEST SCOPE: this destroys data. Dropping a column destroys its values, so
-- whatever the couple typed into the console for their names, the venue and the
-- address is gone once this runs. Capture the row first if those values matter:
--
--   select couple_names, venue_name, venue_address from ceremony;
--
-- It also restores the SHAPE, not the behaviour. The application after this
-- rollback expects those three values to exist, so `getCeremony` will fail on
-- the missing columns rather than silently render blanks — which is the right
-- failure: the alternative was an invitation with no venue on it. Roll the
-- application back with the schema.
--
-- The non-blank checks on the four columns 0009 created are dropped too, since
-- 0011 is what added them. That returns the four original columns to `not null`
-- alone, which is exactly the guard they had before a form could write them.
--
-- The length checks on the three dropped columns need no statement of their
-- own: dropping a column drops its constraints with it.

alter table ceremony
  drop constraint if exists ceremony_ceremony_date_not_blank,
  drop constraint if exists ceremony_ceremony_time_not_blank,
  drop constraint if exists ceremony_stream_meeting_id_not_blank,
  drop constraint if exists ceremony_stream_passcode_not_blank;

alter table ceremony
  drop column if exists couple_names,
  drop column if exists venue_name,
  drop column if exists venue_address;

comment on table ceremony is
  'Exactly one row: the ceremony date, time and stream credentials. '
  'Every surface that shows them MUST read this row; never restate a value.';

comment on column ceremony.ceremony_date is null;
