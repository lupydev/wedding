# Design: WhatsApp Wedding Invitations

**Change**: `whatsapp-wedding-invitations` | **Store**: hybrid | **Engram**: `sdd/whatsapp-wedding-invitations/design`
**Contract**: `openspec/changes/whatsapp-wedding-invitations/proposal.md` | **Prior art**: `exploration.md` (alternatives already compared; not re-derived here)

> **Size note**: this document exceeds the 800-word design budget. The overage is DDL, the required sequence diagram, and the module-boundary table — all explicitly required by `rules.design` and by the phase brief. Prose is kept minimal; every section is table, code, or diagram.

## Technical Approach

Hexagonal, three rings, dependency arrows pointing inward only.

```
  app/**            DELIVERY   Next.js routes, server actions, route handlers.
    │                          Async RSCs are thin containers: fetch, then delegate.
    ▼
  lib/server/**     ADAPTERS   Supabase, cookies, auth, OG warming, IP hashing.
    │                          Every file starts with `import 'server-only'`.
    ▼
  lib/domain/**     CORE       Pure functions. No React, no Next, no Supabase, no I/O.
                               Randomness and clock arrive as arguments.

  components/**     PRESENTATIONAL. Props only. May import lib/domain types.
                    MUST NOT import lib/server/**. This is what makes the shared
                    InvitationBody provably identical on both routes.
```

The four highest-risk behaviors (phone normalization, `wa.me` link building, message templating, slug generation) are the innermost ring and land first, because they are 100% unit-testable and everything else depends on them.

### Import rules and the mechanical guards

| Layer | May import | Guard |
|---|---|---|
| `lib/domain/**` | stdlib, `libphonenumber-js`, sibling domain modules | ESLint `no-restricted-imports` zone banning `react`, `react-dom`, `next/*`, `@supabase/*`, `server-only`, `node:*`, `../server/*`. Plus a Vitest suite that imports every domain module under `environment: 'node'`. |
| `lib/server/**` | `lib/domain/**`, `@supabase/supabase-js`, `next/headers`, `node:crypto` | `import 'server-only'` as the **first line of every file**. A stray Client Component import becomes a **BUILD ERROR**, not a runtime data leak. This is the single highest-value mechanical guard in the product. |
| `components/**` | `lib/domain/**` (types + pure fns), React | ESLint zone banning `lib/server/**` and `@supabase/*`. |
| `app/**` | everything above | — |

`server-only` goes in **every** `lib/server` file, not just `supabase.ts`. Transitive protection covers DB-touching modules, but a future server module that touches no DB would otherwise be unguarded.

## File Layout

| Path | Action | Purpose |
|---|---|---|
| `next.config.ts` | Create | `htmlLimitedBots: /.*/` |
| `app/layout.tsx` | Create | `metadataBase` |
| `app/robots.ts` | Create | `Disallow: /i/`; the OG image path stays crawlable |
| `app/i/[slug]/page.tsx` | Create | Async RSC container. `generateMetadata`. Renders gate or body. |
| `app/i/[slug]/opengraph-image.tsx` | Create | Names-only card, `next/og`, Node runtime |
| `app/i/[slug]/gate-form.tsx` | Create | `'use client'` phone input |
| `app/i/[slug]/actions.ts` | Create | `'use server'` — `unlockAction`, `submitRsvpAction` |
| `app/console/(authenticated)/layout.tsx` | Create | `requireOperator()` + device-declaration gate. `(authenticated)` is a route GROUP, so the URL stays `/console/...` |
| `app/console/login/page.tsx`, `app/console/login/actions.ts` | Create | Email-and-password entry. A Server Action writes the session cookie directly, which is the only thing the deleted `auth/callback` route existed to do. Supersedes the magic-link exchange (WU7a) |
| `app/console/(authenticated)/page.tsx` | Create | Guest list partitioned by `owner_sender_id` |
| `app/console/device/page.tsx` | Create | Per-device WhatsApp-account picker |
| `app/console/(authenticated)/dispatch/[invitationId]/page.tsx` | Create | Compose view + mock bubble |
| `app/console/(authenticated)/preview/[invitationId]/page.tsx` | Create | Admin-only body preview |
| `app/console/api/dispatch-event/route.ts` | Create | `sendBeacon` POST target, idempotent, returns 204 |
| `proxy.ts`, `lib/proxy/operator-session.ts` | Create | Runs on `/console/:path*` only. Refreshes the Supabase session cookie on every console request so a long dispatch sitting never expires mid-send, and unconditionally DELETES any inbound `x-operator-identity` header before forwarding, so a forwarded identity can only ever be one this process signed. Named `proxy.ts` rather than `middleware.ts` per the Next 16.3 rename (WU6a-i) |
| `components/invitation/InvitationBody.tsx` | Create | **Sync** RSC, props only — shared by public + admin routes |
| `components/invitation/RsvpAnswer.tsx` | Create | `'use client'`. Renamed from `RsvpForm.tsx` in WU5b: it renders the recorded ANSWER, which is the form or the stream card |
| `components/console/WhatsAppBubble.tsx` | Create | Mock bubble, props only |
| `lib/domain/phone.ts` | Create | `normalizeForStorage`, `deriveGateKey`, `matchesInvitation` |
| `lib/domain/wa-link.ts` | Create | `buildWaMeLink` |
| `lib/domain/message-template.ts` | Create | `renderMessageTemplate` |
| `lib/domain/slug.ts` | Create | `encodeSlug`, `SLUG_BYTE_LENGTH`, `isWellFormedSlug` |
| `lib/domain/rate-limit.ts` | Create | `evaluateGate` (pure; takes attempts + `now`) |
| `lib/domain/seats.ts` | Create | `validateRsvpSelection` (hard cap) |
| `lib/server/supabase.ts` | Create | Secret-key client, `server-only` |
| `lib/server/{invitations,gate,dispatch,rsvp,auth,og-warm,cookies,env}.ts` | Create | Adapters |
| `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_triggers.sql` | Create | Schema, default-deny RLS, append-only + seat-cap triggers |
| `openspec/config.yaml` | Modify | `strict_tdd: true`, test commands (scaffold slice) |

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | Domain purity vs. `libphonenumber-js` | Import it directly in `lib/domain/phone.ts` | Wrapping it behind a port | It is deterministic and I/O-free — a computation dependency, not a vendor. `rules.design` bans React and storage vendors, not math libraries. A port would add indirection with no testability gain. |
| D2 | Randomness and clock in the core | Passed as arguments (`encodeSlug(bytes)`, `evaluateGate(attempts, now)`) | `node:crypto` / `Date.now()` inside the domain | Keeps the domain importable under `environment: 'node'` with zero mocking, and makes lockout windows deterministically testable. The adapter supplies `randomBytes(10)` and `Date.now()`. |
| D3 | Two phone-normalization strictnesses | `normalizeForStorage` (strict, throws) at import; `deriveGateKey` (lenient, digits-only, needs ≥8) at the gate | One shared function | The DB must never hold junk (precision at write). The gate must never lock out a real guest (recall at read). One function cannot hold both biases. |
| D4 | Slug entropy | `randomBytes(10)` → 16 chars base32 `[a-z2-7]` = **80 bits** | 12 chars / 60 bits; sequential ids; signed JWT in path | Proposal requires ≥64 bits. 10 bytes encodes to base32 with no padding and no truncation bias. JWT rejected: rotating the secret invalidates messages **already delivered and unrecallable**. |
| D5 | Append-only enforcement | `BEFORE UPDATE OR DELETE` trigger raising an exception on `dispatch_events` and `rsvp_responses` | Relying on RLS | The `sb_secret_` key maps to `service_role`, which **BYPASSRLS**. RLS protects against the publishable key only; it cannot make a table append-only against our own server code. A trigger can. |
| D6 | Seat hard cap | Cross-table `enforce_seat_cap` trigger + `lib/domain/seats.ts` + server-action re-validation | DB-only, or client-only | Decision 3 is a hard cap, so it is an invariant, not a signal to surface. Defense at three layers because the form is the only layer an attacker controls. |
| D7 | Operator allowlist location | `senders.allowlisted_email text unique not null` — the table **is** the allowlist | Env var `OPERATOR_EMAILS` | One source of truth. Two allowlists that can disagree is a class of authorization bug. Adding an operator becomes a row, not a redeploy. `auth_user_id` is bound on first allowlisted login. |
| D8 | Beacon transport | Plain route handler `POST /console/api/dispatch-event`, 204, idempotent on `client_event_id` | Server Action | `navigator.sendBeacon` sends a Blob with a UA-controlled content type; a route handler is a stable, documented POST target. Server Actions have an encoding contract beacons do not honor. |
| D9 | OG image strategy | Runtime `next/og` + server-side warm on creation | Build-time static; generate-on-write to Supabase Storage | Adding a guest must not require a redeploy. The only real risk is the **first** fetch — which is exactly the one WhatsApp makes. Warming removes it at near-zero cost. Escalate to storage only if measured cold p95 is bad. |
| D10 | Unknown slug vs. wrong phone | Different responses (friendly contact page vs. gate error) | Shape-identical responses | At 80 bits an existence oracle is worthless — an attacker who can guess a slug already has the card. Identical shapes would cost real UX for no security. |

## Supabase Schema

```sql
-- 0001_schema.sql
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
-- contact_wa_phone_e164 is NEVER used to build a dispatch link (wa.me has no sender
-- parameter). It is only the RECIPIENT of the guest's "I cannot get in" fallback link.

create table invitations (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z2-7]{16}$'),
  owner_sender_id  uuid not null references senders(id),          -- NOT NULL: decision 4
  display_name     text not null,                                  -- denormalized: the crawler path must not join
  greeting_name    text not null,
  seats_allowed    int  not null check (seats_allowed between 1 and 12),
  rsvp_deadline    date,
  og_warmed_at     timestamptz,
  slug_rotated_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index invitations_owner_idx on invitations(owner_sender_id);
-- No message_note column: decision 2 is greeting-name-only personalization.
-- No partial index on a null owner: decision 4 removed the claim queue entirely.

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
-- The nullif() is load-bearing: without it a guest with no phone stores '' and an
-- empty gate submission would match. NULL never equals NULL, so it cannot.

create table dispatch_events (
  id               uuid primary key default gen_random_uuid(),
  invitation_id    uuid not null references invitations(id) on delete cascade,
  actor_sender_id  uuid not null references senders(id),   -- from the session, never the client
  kind             text not null check (kind in ('link_opened','marked_sent','marked_failed','resent')),
  client_event_id  uuid,
  occurred_at      timestamptz not null default now()
);
create unique index dispatch_events_client_event_idx
  on dispatch_events(client_event_id) where client_event_id is not null;
create index dispatch_events_invitation_idx on dispatch_events(invitation_id, occurred_at desc);
-- text + CHECK over a Postgres enum: 'resent' is reserved and these WILL be extended.

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
-- Append-only, latest row wins. "She said yes, then cancelled" is information the couple wants.

create table gate_attempts (
  id             bigserial primary key,
  invitation_id  uuid not null references invitations(id) on delete cascade,
  ip_hash        text not null,      -- HMAC-SHA256(pepper, ip), 32 hex chars. Raw IP never stored.
  succeeded      boolean not null,
  attempted_at   timestamptz not null default now()
);
create index gate_attempts_window_idx on gate_attempts(invitation_id, attempted_at desc);
create index gate_attempts_ip_idx     on gate_attempts(ip_hash, attempted_at desc);
```

```sql
-- 0002_rls.sql — DEFAULT DENY, ZERO POLICIES
alter table senders           enable row level security;
alter table invitations       enable row level security;
alter table invitation_guests enable row level security;
alter table dispatch_events   enable row level security;
alter table rsvp_responses    enable row level security;
alter table gate_attempts     enable row level security;

-- No CREATE POLICY statements exist anywhere in this repository. RLS enabled with zero
-- policies is default-deny: anon and authenticated get permission-denied or empty results
-- on every table. Adding any policy to these tables is a spec violation.

-- Belt and braces: revoke the grants Supabase issues by default.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
```

```sql
-- 0003_triggers.sql
create function reject_mutation() returns trigger language plpgsql as $$
begin raise exception 'table % is append-only', tg_table_name; end $$;

create trigger dispatch_events_append_only before update or delete on dispatch_events
  for each row execute function reject_mutation();
create trigger rsvp_responses_append_only before update or delete on rsvp_responses
  for each row execute function reject_mutation();

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
```

**Honest posture statement**: RLS default-deny stops the publishable key. It does **not** stop the secret key — `service_role` has `BYPASSRLS` by design. That is precisely why the secret key lives in a non-`NEXT_PUBLIC_` Vercel env var, why `lib/server/**` carries `import 'server-only'`, and why append-only is a trigger (D5) rather than a policy. The browser holds no Supabase client for guest data at all.

## The Open Graph Metadata Path

```
next.config.ts          htmlLimitedBots: /.*/         streaming OFF, globally
        │
app/layout.tsx          metadataBase: SITE_ORIGIN     relative og:image → absolute HTTPS
        │
app/i/[slug]/page.tsx   generateMetadata()            title/description = NAMES ONLY
        │                                             does NOT hand-write openGraph.images
        ▼
app/i/[slug]/opengraph-image.tsx                      file convention injects the absolute
                                                      og:image + og:image:width/height tags
```

| Concern | Design |
|---|---|
| `htmlLimitedBots: /.*/` | Lives in `next.config.ts` because it configures the metadata renderer globally; there is no per-route form. Matching `/.*/` treats **every** UA as HTML-limited, which disables streamed metadata outright. **Why**: Next ≥15.2 streams `generateMetadata` output near `</body>` and only blocks for UAs matching its built-in bot list. That list does contain `WhatsApp` today, so the default works — but correctness then depends entirely on a UA string, and a silent miss produces a blank card with no error anywhere. One line removes the most fragile dependency in the product; the TTFB cost is irrelevant at a few hundred guests. **Scaffold task must confirm the key location against the installed version** (`experimental.htmlLimitedBots` on 15.2, promoted to top level after); the raw-HTML E2E is the authority, not the docs. |
| `metadataBase` | Root layout, from `NEXT_PUBLIC_SITE_ORIGIN`. Without it the file-convention `og:image` stays relative and WhatsApp cannot fetch it. |
| Image content | `greeting_name` + an invitation line. **No date, no venue, no phone.** The card is fetched by an unauthenticated crawler and is visible to anyone holding a forwarded link (decision 1). |
| Fonts | Bundled Noto Sans covers Latin-1, so accented vowels and `ñ` render out of the box. A custom display font must be `ttf`/`otf`, subset to those codepoints, read once at module scope, inside the 500 KB budget. |
| Cache | `next/og` responds `cache-control: public, immutable, max-age=31536000`. Fetch #2 onward is a CDN hit; only #1 is a cold Satori+Resvg generation. |

### Warming

`lib/server/og-warm.ts` → `warmOgCard(slug)` issues `fetch(`${origin}/i/${slug}/opengraph-image`, { cache: 'no-store' })` with a 5 s timeout, called **after the invitation INSERT commits**.

- Success → `update invitations set og_warmed_at = now()`.
- Failure or timeout → **creation still succeeds**. `og_warmed_at` stays null, a structured warning is logged (slug only, never a phone), and the console renders a "preview not warmed" badge on that row.
- Recovery is free: the console's mock bubble requests the same canonical URL, so **previewing IS warming**, and the badge clears on the next successful fetch.
- Slug rotation sets `og_warmed_at = null` and re-warms, because the new URL is a new CDN key.

## The Phone Gate

```
raw input ──► deriveGateKey(raw)            digits only; last 8; null if < 8 digits
                    │                        (LENIENT — recall bias, D3)
                    ▼
              evaluateGate(attempts, now)   pure; reads gate_attempts window
                    │  allowed?
      ┌─────────────┴─────────────┐
     no                          yes
      │                           ▼
  429 + retryAfter        matchesInvitation(key, guests)   ANY guest, not just primary
                                  │
                        ┌─────────┴─────────┐
                       no                  yes
                        │                   ▼
              record failed attempt   record success + set signed unlock cookie
              show "no coincide" +    redirect to the same URL (body renders)
              the wa.me recovery link
```

**Storage side**: `normalizeForStorage(raw, DEFAULT_PHONE_COUNTRY)` runs at import via `parsePhoneNumberFromString`, throws on an invalid number, and writes `phone_e164`. `phone_last8` is the generated column. Hand-rolled E.164 normalization is banned: it is the highest-risk pure function in the product.

**Rate limit** (`lib/domain/rate-limit.ts`, pure — attempts and `now` are arguments):

| Scope | Window | Threshold | Lockout |
|---|---|---|---|
| (invitation, ip_hash) | 15 min | 8 **failed** attempts | 30 min |
| invitation, all IPs | 60 min | 30 **failed** attempts | 60 min |

Only failures count, so a guest who unlocks and returns is never punished. The second scope exists because the first is trivially defeated by rotating source IPs. `ip_hash = HMAC-SHA256(GATE_IP_PEPPER, ip)` truncated to 32 hex chars — an unpeppered hash of an IPv4 address is reversible by exhaustive enumeration in seconds. `gate_attempts` is a table rather than in-memory because Vercel serverless instances share no memory.

**Unlock cookie**: name `inv_unlock`, value = `base64url(payload) + '.' + HMAC-SHA256(UNLOCK_COOKIE_SECRET, payload)` where payload is `{ invitationId, exp }`. `httpOnly` (JS must never read it), `secure`, `sameSite: 'Lax'`, `path: '/i/' + slug`, `maxAge: 180d`.

- **180 days, superseding the original 30**: the gate stops a forwarded link, not a guest who already proved they hold a number on the invitation — and the capability protected is the slug, which that guest keeps either way. A short lifetime therefore buys nothing and only re-gates the household that answered early and returns the week of the wedding. The expiry is enforced server-side from the signed payload, never from the browser's copy. `specs/phone-gate/spec.md` carries the full supersession.

- **`SameSite=Lax`, not `Strict`**: the guest arrives by a cross-site top-level navigation from WhatsApp. `Strict` drops the cookie on exactly that navigation and re-gates the guest every time they reopen the link from the chat — the failure this cookie exists to prevent. `Lax` sends it on top-level GETs. `None` is unnecessary; nothing embeds the page cross-site.
- **Path-scoped to the slug**: slug rotation makes the old cookie unreachable with no revocation list. The server additionally verifies the payload's `invitationId` matches the invitation resolved from the slug.

**Recovery**: the gate renders "¿No puedes entrar?" → `buildWaMeLink(owner.contact_wa_phone_e164, renderMessageTemplate(HELP_TEMPLATE, { greetingName }))`, built server-side against the **owning** sender. Zero infrastructure; a human resolves it in seconds over the channel already in play. Accepted tradeoff: this discloses the couple's own number to slug holders — deliberately. Guests' numbers are never disclosed. The masked-hint alternative ("ends in ..34") is rejected: it leaks two digits of a guest's number to anyone holding the slug.

**The one-unlock-path invariant**: everything under `app/i/[slug]/**` has exactly **one** code path that reads or sets unlock state, and it reads only the unlock cookie or a submitted phone. No query parameter, header, or token participates. This is a testable invariant, not a convention.

## Dispatch Flow

```
Operator      Console (client)        Server            Supabase          WhatsApp      Guest
   │                 │                   │                  │                 │           │
   │ open /console   │                   │                  │                 │           │
   ├────────────────►│                   │                  │                 │           │
   │                 │ RSC render        │                  │                 │           │
   │                 ├──────────────────►│ requireOperator()│                 │           │
   │                 │                   ├─ session ───────►│                 │           │
   │                 │                   │◄─ sender row ────┤                 │           │
   │                 │                   │ read device cookie                 │           │
   │                 │                   │  ├ absent ─► redirect /console/device          │
   │                 │                   │  └ ≠ session ─► BLOCKING INTERSTITIAL, no send │
   │                 │                   ├─ invitations WHERE owner_sender_id = me ──►│   │
   │                 │◄── list (owned rows have a send button; others: "owned by X") │   │
   │                 │                   │                  │                 │           │
   │ open compose    │                   │                  │                 │           │
   ├────────────────►│ RSC: buildWaMeLink(guest.phone_e164, renderMessageTemplate(...))   │
   │                 │      + <img src="/i/{slug}/opengraph-image">  ── warms the CDN ──► │
   │◄── mock bubble + encoded URL + char count (labelled "Approximate") ─────────────────│
   │                 │                   │                  │                 │           │
   │ tap "Send"      │                   │                  │                 │           │
   ├────────────────►│ (1) mint client_event_id (uuid), stash in sessionStorage           │
   │                 │ (2) navigator.sendBeacon('/console/api/dispatch-event', blob)      │
   │                 │        └── fire-and-forget, NOT awaited ──►│ insert link_opened ──►│
   │                 │ (3) window.location.href = waUrl   ── PAGE UNLOADS ──►│            │
   │                 │                   │                  │                 │           │
   │           WhatsApp opens with the recipient and the prefilled text; the human sends  │
   │                 │                   │                  │                 ├──────────►│
   │ return to browser                   │                  │                 │           │
   ├────────────────►│ visibilitychange → visible:                                        │
   │                 │  (a) refetch dispatch state                                        │
   │                 │  (b) if stashed client_event_id has no row, POST again (idempotent)│
   │                 │  (c) prompt "Mark as sent" / "Could not send"                      │
   │ tap confirm     │                   │                  │                 │           │
   ├────────────────►│ server action ───►│ insert marked_sent / marked_failed ───────────►│
   │                 │                   │  actor_sender_id from the SESSION, never client│
   │                 │◄── Realtime on dispatch_events pushes to BOTH consoles ────────────│
```

**The `sendBeacon` detail, precisely.** Navigating to `wa.me` **leaves the page**, so an ordinary `fetch` is cancelled on unload and an `await`ed one delays the navigation the operator just asked for. `navigator.sendBeacon` is queued by the user agent, survives unload, and returns a boolean **synchronously** — so:

1. The event is written **before** navigation.
2. The navigation **never** awaits the write and is never blocked by its failure.
3. If `sendBeacon` returns `false` (queue full), fall back to `fetch(url, { keepalive: true })` — still not awaited.
4. `client_event_id` is minted client-side and stored in `sessionStorage`, making the write idempotent via `dispatch_events_client_event_idx`, so the reconciliation retry on return cannot double-count.

`link_opened` is a claim that a link was opened, not that a message was sent. The two-step confirm (`marked_sent` / `marked_failed`) is what records reality. The app cannot observe the send, and the UI says so.

## Operator Identity — Two Different Questions

| | Q1: Who is operating? | Q2: Which WhatsApp account is on this handset? |
|---|---|---|
| Mechanism | Supabase Auth email and password (WU7a; was a magic link) | Per-device signed cookie `device_sender`, `httpOnly`, `path=/console`, 1 year |
| Source of truth | `senders.allowlisted_email` → `senders.auth_user_id` (D7) | The operator's own declaration on this device |
| Verifiable? | **Yes** — cryptographic | **No** — unverifiable by construction |
| Used for | Authorization: console access, guest phone visibility, `actor_sender_id` | Nothing but a human-facing interstitial |

**Why they must stay separate.** `wa.me` addresses the recipient only; there is no sender parameter. The message is sent from whichever WhatsApp is installed on the device that opens the link. Sender routing is **physical**, not addressable by the app. So the device answer is a self-declaration the server can never check — which means it must **never** be an authorization input. Conflating them fails in one of two ways: a self-declared value would grant access to guest phone numbers, or authentication would be pretending it proves which SIM is in the phone. Neither is true. Auth is a fact; the declaration is a hint.

**Flow.** `app/console/(authenticated)/layout.tsx` calls `requireOperator()`; unauthenticated or non-allowlisted → `/console/login`. Then it reads `device_sender`: absent → redirect to `/console/device` (**fail to the picker, never to a default** — clearing storage must not silently pick someone). If `device_sender ≠ session sender`, dispatch is blocked by a non-dismissible interstitial explaining the mismatch, offering "Change the device declaration" or "Sign in as the other operator". The read-only progress view stays available. This is the only guard that catches "the bride logged in on the groom's phone".

**Wrong-owner dispatch** is unpreventable at the protocol level, so it is layered: (1) the list is partitioned by `owner_sender_id`; (2) non-owned rows render "owned by {name}" instead of a send button; (3) the interstitial; (4) if an event is recorded anyway, `actor_sender_id ≠ owner_sender_id` is **stored** and surfaced as a data-quality flag rather than only prevented.

## The Two Preview Surfaces

### 1. Mock WhatsApp bubble — `components/console/WhatsAppBubble.tsx`

Renders `<img src={`/i/${slug}/opengraph-image`} />`: the **real canonical URL**, with **no cache-busting parameter**. A `?t=...` would create a different CDN cache key, so the entry warmed by the preview would not be the entry the crawler later fetches — defeating the entire warming strategy (D9). Also shows the rendered message text, the raw encoded `wa.me` URL, and a character count with a soft warning.

Labelled **"Aproximado — el resultado real varía según el dispositivo"**, with these divergences stated in the pane so the operator does not over-trust it: truncation thresholds behind "Read more" are undocumented and device-dependent; large-vs-small card selection is behavioral, not contractual; iOS / Android / Web differ in radius, line counts, and whether the description appears at all; **only the first URL in a message gets a preview**, so the template must contain exactly one; the card renders Twemoji while the bubble text renders the platform's native emoji set.

### 2. Body preview — `app/console/preview/[invitationId]/page.tsx`

Admin-authed RSC that fetches by id and renders `<InvitationBody />` — the **same** component `/i/[slug]/page.tsx` renders after unlock. Protected by the console layout's ordinary `requireOperator()`; **no new authorization axis exists**. The public route never learns the word "preview". The gate screen itself needs no preview mechanism at all: the console iframes `/i/[slug]` directly and the operator reads the gate copy exactly as a guest sees it.

Drift guard: `InvitationBody` is **sync** and props-only, so one Vitest snapshot pins it, plus an E2E asserting the admin preview body and the unlocked public body produce identical text for one seeded fixture.

**Every public-route bypass, and why each was rejected:**

| Bypass | Verdict |
|---|---|
| `?preview=1` | **Reject.** A guessable, permanently open hole appended to a URL every guest already holds. |
| Signed short-lived preview token | **Reject.** A second unlock path on the public route. A token that unlocks a real guest's invitation is the same capability as the phone gate with no rate limit, and tokens leak through browser history and `Referer`. |
| Admin-session bypass inside the public route | **Reject.** Makes the public route's authorization depend on two independent identities. That is exactly where authorization bugs live. |
| Separate admin-only route | **Chosen.** No new authorization axis at all. |

## Testing Architecture

The hexagonal split is what makes this testable, and the reason is mechanical: **Vitest cannot test async Server Components**. So every behavior that exists only inside an `async` RSC is E2E-only, and E2E is slow and brittle. The design therefore keeps async RSCs as thin containers — fetch, then delegate to a pure domain function or a props-only presentational component — which pushes almost all logic into layers Vitest *can* reach. Container/presentational is load-bearing here, not stylistic.

| Layer | Tool / env | Scope | Bar |
|---|---|---|---|
| Unit | Vitest, `environment: 'node'` | all of `lib/domain/**` | **100%** on `phone.ts` and `wa-link.ts`. Table-driven: `+`/no `+`, spaces, dashes, parens, Mexican `1` prefix, Argentine `9` prefix, empty, garbage; link encoding of space, `&`, `?`, `%0A`, accents, emoji, and no `+` on the number; a missing template variable must **fail loudly**, never render `undefined` into a message a human is about to send. |
| Component | Vitest + RTL + jsdom | `GateForm`, `RsvpAnswer`, `WhatsAppBubble`, `InvitationBody` (sync) | Behavior + one `InvitationBody` snapshot as the drift guard |
| DB | Vitest (node) against local Supabase | migrations, generated column, triggers | `phone_last8` is NULL when the phone is NULL; UPDATE/DELETE on `dispatch_events` raises; over-cap RSVP insert raises; **anon key gets permission-denied on all six tables** |
| Integration | Vitest (node) | `lib/server/**` with a repository fake | Gate lockout arithmetic, cookie sign/verify, warm-failure path leaves creation successful |
| E2E | Playwright | everything async-RSC | `og:image`/`og:title` inside `<head>` of the **raw** HTML under `User-Agent: WhatsApp/2.23.20.0` before any JS runs (the single highest-value test — regression guard for streaming metadata); wrong phone leaks no invitation content and no stored digit sequence into page source; **no query parameter bypasses the gate**; RSVP over-cap rejected server-side; dispatch interstitial blocks on device mismatch |

Fixtures use **fabricated** numbers only, and a name containing both `ñ` and an accented vowel is a first-class fixture in the OG test. No real phone number enters the repo, fixtures, seeds, or logs.

`strict_tdd` is `false` (fail-closed) until the scaffold slice lands `npm test`. No RED-GREEN claim is valid before that slice.

## Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | **N/A** | No file-classification or execution-of-content boundary; the change ships no interpreter of repository files. |
| Git repository selection | **N/A** | No VCS automation; the app never shells out to `git`. |
| Commit state | **N/A** | Same. |
| Push state | **N/A** | Same. |
| PR commands | **N/A** | Same. |

No shell commands, subprocesses, executable-file classification, or process integration exist in this change. The change *does* have an HTTP route-authorization boundary (the phone gate and the console), which is not what this matrix covers — it is specified above as the one-unlock-path invariant, the rejected-bypass table, and the default-deny RLS posture, each with its own planned E2E.

## Migration / Rollout

Greenfield: `supabase/migrations/**` is the initial schema; no data migration. Every migration ships a down-script.

| Slice | Content | Authored-line forecast (budget 800) |
|---|---|---|
| 1 | Scaffold + `strict_tdd: true` + test commands | **Low** — mostly generated by `create-next-app`; authored config ≈ 150 |
| 2 | `lib/domain/**` + unit tests | **Medium** (~600, test-heavy) |
| 3 | Schema, RLS, triggers, `lib/server` repositories | **Medium** (~600) |
| 4a | `/i/[slug]` page, `generateMetadata`, `opengraph-image`, warming, raw-HTML E2E | **Medium** (~500) |
| 4b | Gate: unlock action, cookie, rate-limit adapter, recovery link, no-bypass E2E | **Medium** (~500) |
| 5 | RSVP form, action, seat cap end-to-end | **Low/Medium** (~400) |
| 6a | Console auth, layout, partitioned list, device declaration, interstitial | **Medium** (~550) |
| 6b | Dispatch: compose, beacon route, events, Realtime, both previews | **Medium/High** (~700) |

**Budget warning**: slices 4 and 6 exceed 800 authored lines if kept whole. They are pre-split above into 4a/4b and 6a/6b, each with an independent start, finish, verification, and rollback. `sdd-tasks` must preserve that split. Chained PRs recommended for the 4a→4b and 6a→6b pairs.

**Rollback**: before the first dispatch, everything is reversible — revert the branch, delete the deployment, drop the schema. After the first dispatch, rollback is forward-only: delivered `wa.me` URLs cannot be recalled and Meta caches previews per URL, so any invitation whose content must change requires slug rotation plus a resend. Keep `/i/[slug]` serving.

## Open Questions

- [ ] `{{COUPLE_NAMES}}`, `{{WEDDING_DATE}}`, `{{VENUE_NAME}}`, `{{VENUE_ADDRESS}}`, `{{APPROX_GUEST_COUNT}}` — placeholders until the couple supplies them. Blocks final guest-facing copy only, not any slice's structure.
- [ ] `DEFAULT_PHONE_COUNTRY` for `normalizeForStorage`. Not blocking: it is an env var and the unit tests are table-driven across candidate countries.
- [ ] Custom display font on the OG card, or bundled Noto Sans? Default is Noto Sans; a custom font must ship a subset with `ñ` and accented vowels inside the 500 KB budget.
- [ ] `NEXT_PUBLIC_SITE_ORIGIN` for `metadataBase` — needed before the first deploy, not before slice 1.
- [ ] Exact `htmlLimitedBots` config key for the installed Next.js version (top-level vs. `experimental`). The scaffold task must verify against the installed version; the raw-HTML E2E is the authority.
