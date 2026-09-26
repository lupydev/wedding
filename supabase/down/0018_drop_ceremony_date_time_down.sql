-- 0018_drop_ceremony_date_time_down.sql — puts the two columns back, holding
-- the PLACEHOLDERS, not the couple's own values.
--
-- ⚠ READ THIS BEFORE RELYING ON THIS SCRIPT.
--
-- `alter table ... drop column` destroyed both stored values. Nothing in this
-- file can recover them, and nothing else can either. At the time 0018 was
-- written the row held `28 de noviembre de 2026` and `5:00 pm`, typed by the
-- couple through the console — real values, not the seeded markers.
--
-- WHY IT RESTORES THE PLACEHOLDER RATHER THAN THE DATE WE KNOW
--
-- `WEDDING_INSTANT` is the wedding day, and writing a rendering of it into this
-- column would be an invention wearing the shape of a restore: the column would
-- come back holding a value nobody typed, indistinguishable from one somebody
-- did. Worse, that is exactly the drift these columns were dropped for — the
-- typed prose and the instant disagreeing with nobody able to tell which is
-- authoritative.
--
-- So the columns come back with `0009`'s own markers, which are visibly
-- unfinished on purpose. 0018's pre-drop NOTICE in the deploy log is the sole
-- surviving record of what was there; go and read it rather than assuming this
-- script restored anything.
--
-- It restores the SHAPE, not the behaviour. The application after 0018 does not
-- read these columns at all, so this script alone changes nothing a guest sees.
-- Roll the application back with the schema, in this order:
--
--     1. run this script (re-creates the two columns holding placeholders)
--     2. then revert the application commits
--     3. then correct the two values at /console/wedding
--
-- The defaults are set in the `add column` and dropped immediately afterwards,
-- exactly as 0011 and 0017 do it: they exist so the one existing row satisfies
-- `not null` in the same statement, and a lingering default would only ever
-- hide a write that forgot a field.

alter table ceremony
  add column ceremony_date text not null default '{{CEREMONY_DATE}}'
    check (char_length(ceremony_date) <= 200),
  add column ceremony_time text not null default '{{CEREMONY_TIME}}'
    check (char_length(ceremony_time) <= 200);

alter table ceremony
  alter column ceremony_date drop default,
  alter column ceremony_time drop default;

-- 0011's non-blank checks, restored under their original names so a later
-- rollback of 0011 finds what it expects to drop.
alter table ceremony
  add constraint ceremony_ceremony_date_not_blank
    check (btrim(ceremony_date) <> ''),
  add constraint ceremony_ceremony_time_not_blank
    check (btrim(ceremony_time) <> '');

comment on column ceremony.ceremony_date is
  'RE-CREATED holding 0009''s placeholder by 0018''s down script, NOT restored. '
  'The value the couple typed was destroyed by 0018 and is not recoverable; '
  'WEDDING_INSTANT is not this data. 0018''s pre-drop NOTICE in the deploy log '
  'is the only record.';

-- And the table comment 0018 rewrote, back to naming the day and the hour.
comment on table ceremony is
  'Exactly one row: every fact about the wedding that more than one surface '
  'shows — the couple''s names, the date, the time, the venue, its address and '
  'the stream link. Every surface MUST read this row; never restate a value in '
  'source. Editing couple_names after invitations were dispatched cannot change '
  'an already-delivered Open Graph card.';
