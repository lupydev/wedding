-- 0002_rls.sql — DEFAULT DENY, ZERO POLICIES.
--
-- The browser never holds a Supabase client for guest data, so any request
-- arriving with the publishable key is already an anomaly. RLS enabled with no
-- policies is default-deny: `anon` and `authenticated` get permission-denied or
-- empty results on every table. Adding any policy to these tables is a spec
-- violation.
--
-- HONEST POSTURE: this stops the publishable key only. The `sb_secret_` key
-- maps to `service_role`, which has BYPASSRLS by design. That is exactly why
-- append-only is a trigger (0003, design D5) rather than a policy, why the
-- secret key lives in a non-`NEXT_PUBLIC_` variable, and why every file under
-- `lib/server/**` carries `import 'server-only'`.

alter table senders           enable row level security;
alter table invitations       enable row level security;
alter table invitation_guests enable row level security;
alter table dispatch_events   enable row level security;
alter table rsvp_responses    enable row level security;
alter table gate_attempts     enable row level security;

-- Belt and braces: revoke the grants Supabase issues by default. Without this,
-- `anon` could still INSERT into `senders` — writing itself into the operator
-- allowlist — because RLS governs rows, not the table-level privilege.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
