-- 0013_drop_seats_allowed_down.sql — puts the column back, NOT the data.
--
-- ⚠ READ THIS BEFORE RELYING ON THIS SCRIPT.
--
-- `alter table ... drop column` destroyed every stored `seats_allowed` value.
-- Nothing in this file can recover them, and no other file can either. What this
-- script does is re-create the column and fill it with a RECONSTRUCTION: the
-- number of members each invitation currently names, which is exactly what
-- 0012's `enforce_seat_cap` already uses as the cap.
--
-- For every row whose stored value agreed with its member count, that
-- reconstruction is the original number and nothing was lost. For any row where
-- the two DISAGREED, the reconstruction is wrong, and the original figure exists
-- only in whatever 0013's pre-drop NOTICE printed into the deploy log. That
-- output is the sole surviving record — go and read it rather than assuming this
-- script restored the household to what it was.
--
-- A household whose membership changed AFTER 0013 ran reconstructs to its new
-- size, not the size it had when the column was dropped. There is no way to tell
-- the two cases apart from inside the database.
--
-- The column is left NULLABLE and without the old `between 1 and 12` check, to
-- match the state 0012 left it in — this script undoes 0013 only. Restoring NOT
-- NULL belongs to 0012's own down script and the manual step it names, and doing
-- it here would fail the moment an invitation names more than 12 people or none.

alter table invitations add column seats_allowed int;

-- The reconstruction. `coalesce` covers an invitation that names nobody, which
-- the old `between 1 and 12` check would have rejected outright — another reason
-- the constraint is not restored here.
update invitations i
   set seats_allowed = coalesce(
         (select count(*)::int from invitation_guests g where g.invitation_id = i.id),
         0
       );

comment on column invitations.seats_allowed is
  'RECONSTRUCTED by 0013''s down script from the member count, not restored. Any value that originally disagreed with that count is lost; 0013''s pre-drop NOTICE in the deploy log is the only record of it.';
