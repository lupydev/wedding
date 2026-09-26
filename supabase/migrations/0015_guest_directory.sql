-- 0015_guest_directory.sql — a guest outlives the invitation they were in.
--
-- WHY
--
-- `invitation_guests.invitation_id` was `not null` with `on delete cascade`.
-- Two rules in one column, and both were wrong for how two people actually
-- assemble a wedding list:
--
--   1. A guest could not be written down before somebody decided which
--      household they belong to. That is why the console has no guest list at
--      all — there was nowhere for a guest to live outside an invitation.
--   2. Deleting an invitation deleted its people. The first thing a
--      non-technical operator does is delete a household they assembled wrong,
--      and the cascade takes every name and phone number they just typed.
--
-- The couple were asked directly what should happen to the people when an
-- invitation is deleted, and answered: "vuelven a la libreta".
--
-- WHAT THE NULL MEANS, AND WHAT IT ENFORCES FOR FREE
--
-- NULL is "in the directory, not in any household yet". It is not an error
-- state and nothing needs to repair it.
--
-- The couple's other rule — "cuando un invitado pertenece a una invitación no
-- debe poder pertenecer a otra, no se debería poder escoger en una próxima
-- invitación" — needs no new constraint, because it is the SHAPE of this
-- column: one row, one `invitation_id`. And `invitations_dispatch_recipient_fk`
-- (0012) references `(invitation_id, id)`, so a released guest holding NULL
-- matches nothing and is unaddressable by EVERY invitation at once. Placing
-- them in a household is what makes them addressable again.
--
-- WHAT WAS CHECKED BEFORE WRITING THIS
--
-- * RLS. `0002_rls.sql` is default-deny with ZERO policies, so no policy joins
--   through `invitations` to authorize a guest row. A NULL `invitation_id`
--   breaks no authorization path, and nothing here adds a policy — that file
--   says adding one is a spec violation.
-- * The clearing trigger. `invitation_guests_clear_recipient_on_move` (0012)
--   fires `before update of invitation_id` whenever the column CHANGES, and a
--   release changes it to NULL. It already does the right thing for a case it
--   was not written for: without it the invitation would keep pointing at
--   somebody who left, and the composite key — checked on the same statement —
--   would refuse the release outright.
-- * The one-primary index. `unique(invitation_id) where is_primary` treats each
--   NULL as distinct, so many released guests may each carry `is_primary` with
--   no collision. `is_primary` is meaningless for somebody in no household;
--   the application decides what to do with it, not this constraint.
--
-- NOTHING IS REWRITTEN. Every stored guest belongs to an invitation and keeps
-- belonging to it. This widens what is representable and changes one referential
-- action; it touches no existing row.

alter table invitation_guests
  alter column invitation_id drop not null;

-- The release itself. `set null` rather than `cascade`: the invitation goes,
-- the people stay and become unassigned.
alter table invitation_guests
  drop constraint invitation_guests_invitation_id_fkey;

alter table invitation_guests
  add constraint invitation_guests_invitation_id_fkey
  foreign key (invitation_id) references invitations(id)
  on delete set null;

-- Reading the directory means "every guest in no household", which is a scan of
-- the NULLs. The existing `invitation_guests_invitation_idx` is a plain btree
-- and does index NULLs, but a partial index over only the unassigned rows stays
-- small no matter how many guests are placed.
create index invitation_guests_unassigned_idx
  on invitation_guests(full_name) where invitation_id is null;

comment on column invitation_guests.invitation_id is
  'The household this guest belongs to, or NULL for a guest in the directory '
  'who has not been placed in one yet. NULL is a normal resting state, not an '
  'error: it is where a guest starts and where they return when their '
  'invitation is deleted. One row carries one invitation, which is what makes '
  '"a guest cannot be in two invitations" structural rather than a check.';
