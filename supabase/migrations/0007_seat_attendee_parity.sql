-- 0007_seat_attendee_parity.sql — one seat rule, stated the same way twice.
--
-- `lib/domain/seats.ts` requires a confirmed RSVP to name exactly as many
-- attendees as the seats it confirms. `enforce_seat_cap` checked the cap and
-- the attendee list independently, which is strictly looser: it accepted
-- "2 seats confirmed, 1 name". Two enforcement points holding two different
-- rules means whichever one a future code path skips is the one that mattered,
-- and the disagreement surfaces as a household seated wrong on the day.
--
-- Every seat in this guest list corresponds to a named person — the couple has
-- the names — so equality is a real invariant, not an over-restriction. The
-- database is the layer that moves, because it is the loose one.
--
-- The HARD CAP is untouched and still evaluated FIRST, so an over-cap
-- submission still fails for the cap's own reason rather than for parity.
--
-- A decline is unaffected: it carries zero seats and names nobody, and 0 = 0.

create or replace function enforce_seat_cap() returns trigger language plpgsql as $$
declare
  cap int;
  named int := cardinality(new.attendee_guest_ids);
begin
  select seats_allowed into cap from invitations where id = new.invitation_id;

  if new.seats_confirmed > cap or named > cap then
    raise exception 'seats_confirmed % exceeds seats_allowed %', new.seats_confirmed, cap;
  end if;

  if named <> new.seats_confirmed then
    raise exception 'seats_confirmed % does not match attendee_guest_ids of length %',
      new.seats_confirmed, named;
  end if;

  return new;
end $$;
