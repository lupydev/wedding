-- 0003_triggers.sql — append-only enforcement and the seat hard cap.
--
-- Both are TRIGGERS, not RLS policies, and the distinction is load-bearing
-- (design D5): the `sb_secret_` key maps to `service_role`, which has
-- BYPASSRLS. A policy therefore cannot constrain our own server code — the
-- exact code most likely to issue an accidental UPDATE. A trigger can.

create function reject_mutation() returns trigger language plpgsql as $$
begin raise exception 'table % is append-only', tg_table_name; end $$;

create trigger dispatch_events_append_only before update or delete on dispatch_events
  for each row execute function reject_mutation();
create trigger rsvp_responses_append_only before update or delete on rsvp_responses
  for each row execute function reject_mutation();

-- Seat allowance is a HARD CAP (design D6, confirmed product decision), so it
-- is an invariant rather than a signal to surface. Defended at three layers
-- because the form is the only layer an attacker controls: this trigger,
-- `lib/domain/seats.ts`, and server-action re-validation.
create function enforce_seat_cap() returns trigger language plpgsql as $$
declare cap int;
begin
  select seats_allowed into cap from invitations where id = new.invitation_id;
  if new.seats_confirmed > cap or cardinality(new.attendee_guest_ids) > cap then
    raise exception 'seats_confirmed % exceeds seats_allowed %', new.seats_confirmed, cap;
  end if;
  return new;
end $$;
create trigger rsvp_seat_cap before insert on rsvp_responses
  for each row execute function enforce_seat_cap();
