-- 0018_drop_ceremony_date_time.sql — the day and the hour leave the row.
--
-- WHY THE TWO COLUMNS GO
--
-- Nothing a guest can open renders either of them, and the console said
-- otherwise.
--
-- `components/invitation/StreamDetails.tsx` was the only component that ever
-- printed them, behind `showDate` and `showTime` props that DEFAULTED TO TRUE.
-- Every real caller passed false: `StreamInvitation` (the public
-- `/transmision` page) and `CeremonyStream` (the card a declining household
-- reads behind the phone gate), and `RsvpAnswer` reaches that block only
-- through the second of them. There is no third caller. So the default was
-- never exercised by a page anybody could open, and the two values were
-- carried through the schema, the read model, the console form and every
-- fixture by inertia alone.
--
-- Meanwhile `components/console/WeddingFactsForm.tsx` told the operator, beside
-- the date field: "Se muestra tal como se escriba acá, en la invitación y en la
-- transmisión." That sentence was false. An operator correcting the date
-- changed nothing a guest reads and was told the opposite, which is worse than
-- an editor that is simply missing.
--
-- WHERE THE DATE A GUEST READS ACTUALLY COMES FROM
--
-- `lib/domain/wedding-day.ts`, from the hardcoded `WEDDING_INSTANT`. That one
-- instant drives `SaveTheDate` on every guest-facing screen, the countdown, the
-- RSVP deadline and the add-to-calendar link on `/transmision` — which is why
-- that page's own comment already says "The start comes from `WEDDING_INSTANT`,
-- not from `ceremony_time`". Dropping these columns therefore changes no pixel
-- and no calendar entry.
--
-- THE CONSEQUENCE THE COUPLE ACCEPTED, WRITTEN DOWN RATHER THAN DISCOVERED
--
-- The wedding date now lives ONLY in code. Moving the wedding is a deploy, not
-- an UPDATE. `odd/tasks/wedding-landing.md` records the opposite open question
-- — wire the landing TO this row — and this migration answers it in the
-- negative: the row is not where the day lives.
--
-- WHY IT IS SAFE TO DESTROY THESE VALUES
--
-- `DROP COLUMN` destroys every stored value and no down script can invent them
-- back. Unlike 0017, the values here are NOT placeholders: the row read at the
-- time of writing holds `28 de noviembre de 2026` and `5:00 pm`, typed by the
-- couple through the console. They are real, and they are also a restatement of
-- `WEDDING_INSTANT` — which is the whole reason this pair could drift from the
-- date every guest actually sees. Step 1 below prints them before they go.
--
-- WHAT WAS VERIFIED BEFORE WRITING THIS, AGAINST THE RUNNING CATALOG
--
-- The same four questions 0013 and 0016 asked, and for the same reason:
-- PL/pgSQL resolves a column reference when the function RUNS, not when it is
-- created, so a function still naming a dropped column survives the migration
-- and fails later — a landmine no `DROP COLUMN` error reports.
--
--     views       — none
--     indexes     — none besides `ceremony_pkey`, which is on `id`
--     functions   — none; no trigger on this table either
--     constraints — FOUR, all of them column constraints on the two columns:
--                     ceremony_ceremony_date_check      (0009, char_length)
--                     ceremony_ceremony_time_check      (0009, char_length)
--                     ceremony_ceremony_date_not_blank  (0011, btrim)
--                     ceremony_ceremony_time_not_blank  (0011, btrim)
--
-- A check constraint that names exactly one column is dropped with that column,
-- which is what 0017 relied on when it removed the two Zoom credentials and
-- their non-blank checks in a single statement. Same here: step 2 is a bare
-- `drop column` and not `drop column ... cascade`. There is nothing to cascade
-- to, and CASCADE would silently destroy whatever appeared between the check
-- above and the statement below rather than refusing.
--
-- DEPLOY ORDERING
--
--     apply this migration at any point AFTER the release that stops reading
--     the two columns is live.
--
-- Before that release `getCeremony` selects them, so applying this first makes
-- every page that reads the row fail at once — the invitation, `/transmision`,
-- the console editor and the dispatch preview.
--
-- ⚠ ROLLING BACK PAST THAT RELEASE IS NO LONGER CODE-ONLY. The down script
-- re-creates the columns holding `0009`'s placeholders, not the couple's
-- values. See its own warning.

-- 1 ─ name what is about to be destroyed, before destroying it.
--
--     One row, two values, and both of them typed by a human. The deploy log is
--     the only place they survive.
do $$
declare
  stored record;
begin
  select ceremony_date, ceremony_time into stored from ceremony;

  raise notice 'ceremony_date and ceremony_time are about to be lost: date=% time=%',
    coalesce(stored.ceremony_date, '<no row>'),
    coalesce(stored.ceremony_time, '<no row>');
end $$;

-- 2 ─ and now the destructive statement itself, alone.
--
--     The four check constraints listed above go with the columns they name;
--     so does 0011's `comment on column ceremony.ceremony_date`.
alter table ceremony
  drop column ceremony_date,
  drop column ceremony_time;

-- 3 ─ the table's own description, which named both.
--
--     Left alone it would tell the next reader the row holds a date and a time,
--     which is the belief this migration exists to remove. It also still said
--     "the stream credentials" — two columns 0017 replaced with one link — so
--     this restates what the row actually holds rather than editing two words
--     out of a sentence that was already stale.
comment on table ceremony is
  'Exactly one row: every fact about the wedding that more than one surface '
  'shows — the couple''s names, the venue, its address and the stream link. '
  'Every surface MUST read this row; never restate a value in source. The '
  'wedding DAY is deliberately not here: it lives in lib/domain/wedding-day.ts '
  'as WEDDING_INSTANT, which also drives the countdown, the RSVP deadline and '
  'the add-to-calendar link. Editing couple_names after invitations were '
  'dispatched cannot change an already-delivered Open Graph card.';
