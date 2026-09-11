-- 0009_ceremony.sql — the ceremony and its stream, as ONE row.
--
-- WHY A TABLE AND NOT ENVIRONMENT VARIABLES
--
-- These four values are needed by two surfaces: the invitation page shows them
-- to a household that has declined a personal invitation (they become stream
-- viewers instead), and the public ceremony page — a later work unit — shows
-- exactly the same values to everyone else. A fact stored in two places is a
-- fact that will drift. A reference project hard-coded the date and the venue
-- into its WhatsApp template, the event moved, and the message kept announcing
-- the old venue while the invitation page showed the new one.
--
-- One row also means correcting the Zoom passcode the morning of the wedding
-- is an UPDATE against a running system, not an edit to a deployment
-- environment followed by a redeploy nobody has time for.
--
-- WHY THE ROW IS SINGULAR BY CONSTRUCTION
--
-- A configuration table grows a second row the first time somebody INSERTs
-- where they meant to UPDATE, and from that moment every reader silently picks
-- one of them. The primary key is a boolean that only `true` satisfies, so the
-- second row is a primary-key violation and the `false` row is a check
-- violation. Singularity is enforced rather than agreed.
--
-- WHY THE VALUES ARE TEXT AND VISIBLY UNFINISHED
--
-- The couple has not supplied the real ones. A `date` column would demand a
-- plausible date and a plausible date is a wrong invitation that reads as a
-- correct one — nobody notices until a guest joins a call that does not exist.
-- The seeded values are placeholders in the same form `{{WEDDING_DATE}}` and
-- `{{VENUE_NAME}}` already use in `components/invitation/InvitationBody.tsx`,
-- and task 7.1 replaces them all together. When it does, `{{WEDDING_DATE}}`
-- should be read from `ceremony_date` here rather than restated in the
-- component, for the same drift reason this table exists.
--
-- SECURITY
--
-- RLS is enabled with ZERO policies, exactly like the other six tables. The
-- table-level grants are deliberately NOT revoked here: the `0004` event
-- trigger revokes `anon` and `authenticated` on every new `public` table as it
-- is created, and `supabase/tests/ceremony.spec.ts` asserts the grant list is
-- empty. That assertion is the verification that the trigger really covers a
-- plain `CREATE TABLE` — a revoke written here would satisfy the test on its
-- own and hide the answer.
--
-- The Zoom passcode lives behind the phone gate rather than on a public page
-- for the invitation surface, which is the more protected of the two places
-- these values are read.

create table ceremony (
  id                 boolean primary key default true,
  ceremony_date      text not null check (char_length(ceremony_date) <= 200),
  ceremony_time      text not null check (char_length(ceremony_time) <= 200),
  stream_meeting_id  text not null check (char_length(stream_meeting_id) <= 200),
  stream_passcode    text not null check (char_length(stream_passcode) <= 200),
  constraint ceremony_is_singleton check (id)
);

alter table ceremony enable row level security;

comment on table ceremony is
  'Exactly one row: the ceremony date, time and stream credentials. '
  'Every surface that shows them MUST read this row; never restate a value.';

insert into ceremony (ceremony_date, ceremony_time, stream_meeting_id, stream_passcode)
values ('{{CEREMONY_DATE}}', '{{CEREMONY_TIME}}', '{{ZOOM_MEETING_ID}}', '{{ZOOM_PASSCODE}}');
