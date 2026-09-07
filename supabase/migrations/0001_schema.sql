-- 0001_schema.sql — initial schema for the WhatsApp wedding invitations.
--
-- Greenfield: there is no data to migrate. Every migration in this directory
-- ships a matching down-script under `supabase/down/`, kept OUT of this
-- directory on purpose so the CLI never applies a rollback as a migration.

create extension if not exists pgcrypto;

create table senders (
  id                     uuid primary key default gen_random_uuid(),
  display_name           text not null,
  role                   text not null check (role in ('partner_a','partner_b','helper')),
  allowlisted_email      text not null unique check (allowlisted_email = lower(allowlisted_email)),
  auth_user_id           uuid unique references auth.users(id) on delete set null,
  contact_wa_phone_e164  text not null check (contact_wa_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at             timestamptz not null default now()
);
-- `senders` IS the operator allowlist (design D7): one source of truth, so
-- adding an operator is a row rather than a redeploy.
-- contact_wa_phone_e164 is NEVER used to build a dispatch link (wa.me has no
-- sender parameter). It is only the RECIPIENT of the guest's "I cannot get in"
-- fallback link.

create table invitations (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z2-7]{16}$'),
  owner_sender_id  uuid not null references senders(id),
  display_name     text not null,
  greeting_name    text not null,
  seats_allowed    int  not null check (seats_allowed between 1 and 12),
  rsvp_deadline    date,
  og_warmed_at     timestamptz,
  slug_rotated_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index invitations_owner_idx on invitations(owner_sender_id);
-- owner_sender_id is NOT NULL by decision: joint guests are assigned at import,
-- so there is no unassigned queue and no claim flow. display_name is
-- denormalized because the crawler path must not join.

create table invitation_guests (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references invitations(id) on delete cascade,
  full_name      text not null,
  phone_e164     text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_last8    text generated always as (
                   nullif(right(regexp_replace(coalesce(phone_e164,''), '\D', '', 'g'), 8), '')
                 ) stored,
  is_primary     boolean not null default false,
  is_child       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index invitation_guests_invitation_idx on invitation_guests(invitation_id);
create index invitation_guests_last8_idx      on invitation_guests(invitation_id, phone_last8);
create unique index invitation_guests_one_primary
  on invitation_guests(invitation_id) where is_primary;
-- The nullif() is a SECURITY CONTROL, not a formatting choice. Without it a
-- guest with no phone stores '' and an empty gate submission — whose derived
-- key is also '' — matches that row, so anyone merely holding the link opens
-- the invitation. NULL never equals NULL, so it cannot.

create table dispatch_events (
  id               uuid primary key default gen_random_uuid(),
  invitation_id    uuid not null references invitations(id) on delete cascade,
  actor_sender_id  uuid not null references senders(id),
  kind             text not null check (kind in ('link_opened','marked_sent','marked_failed','resent')),
  client_event_id  uuid,
  occurred_at      timestamptz not null default now()
);
create unique index dispatch_events_client_event_idx
  on dispatch_events(client_event_id) where client_event_id is not null;
create index dispatch_events_invitation_idx on dispatch_events(invitation_id, occurred_at desc);
-- actor_sender_id always comes from the server session, never from the client.
-- text + CHECK rather than a Postgres enum: 'resent' is reserved and these
-- kinds WILL be extended.

create table rsvp_responses (
  id                  uuid primary key default gen_random_uuid(),
  invitation_id       uuid not null references invitations(id) on delete cascade,
  attending           boolean not null,
  attendee_guest_ids  uuid[] not null default '{}',
  seats_confirmed     int not null check (seats_confirmed >= 0),
  dietary_notes       text check (char_length(dietary_notes) <= 500),
  message             text check (char_length(message) <= 1000),
  submitted_at        timestamptz not null default now(),
  constraint rsvp_declined_has_zero_seats check (attending or seats_confirmed = 0)
);
create index rsvp_responses_latest_idx on rsvp_responses(invitation_id, submitted_at desc);
-- Append-only, latest row wins. "She said yes, then cancelled" is information
-- the couple wants, so a change is a new row rather than an overwrite.

create table gate_attempts (
  id             bigserial primary key,
  invitation_id  uuid not null references invitations(id) on delete cascade,
  ip_hash        text not null,
  succeeded      boolean not null,
  attempted_at   timestamptz not null default now()
);
create index gate_attempts_window_idx on gate_attempts(invitation_id, attempted_at desc);
create index gate_attempts_ip_idx     on gate_attempts(ip_hash, attempted_at desc);
-- ip_hash is HMAC-SHA256(GATE_IP_PEPPER, ip) truncated to 32 hex chars. The raw
-- IP is never stored: an unpeppered hash of an IPv4 address is reversible by
-- exhaustive enumeration in seconds. This is a table rather than in-memory
-- state because serverless instances share no memory.
