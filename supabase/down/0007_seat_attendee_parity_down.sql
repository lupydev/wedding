-- Restores the pre-0007 `enforce_seat_cap`: cap only, no seat/attendee parity.
--
-- Rolling this back re-opens the disagreement with `lib/domain/seats.ts` on
-- purpose — a down script restores the previous state, it does not improve it.

create or replace function enforce_seat_cap() returns trigger language plpgsql as $$
declare cap int;
begin
  select seats_allowed into cap from invitations where id = new.invitation_id;
  if new.seats_confirmed > cap or cardinality(new.attendee_guest_ids) > cap then
    raise exception 'seats_confirmed % exceeds seats_allowed %', new.seats_confirmed, cap;
  end if;
  return new;
end $$;
