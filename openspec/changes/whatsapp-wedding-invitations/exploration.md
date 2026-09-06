# Exploration: whatsapp-wedding-invitations

**Phase**: sdd-explore | **Change**: `whatsapp-wedding-invitations` | **Store**: hybrid
**Repo**: `/Users/lu/Documents/Lu/wedding` — greenfield, zero commits, no source.
**Engram mirror**: observation #1553, topic `sdd/whatsapp-wedding-invitations/explore`

## Current State

Nothing is scaffolded. Prior decisions already locked (do not re-open):
WhatsApp Cloud API ruled out; dispatch is `wa.me` text-only deep links; the image is
the Open Graph preview card; WhatsApp's crawler does not run JS so per-guest OG tags
must be in the first server HTML response; Next.js App Router + TypeScript on Vercel +
Supabase; guest phone numbers never reach the browser.

## VERIFIED FINDINGS (sources checked 2026-09-06)

### F1 — Streaming metadata is a live hazard (HIGHEST PRIORITY)

Next.js >= 15.2 STREAMS `generateMetadata` output by default: tags are appended near
`</body>` instead of `<head>` for normal user agents. Next detects "HTML-limited bots"
by User-Agent and blocks for them. The built-in `HTML_LIMITED_BOT_UA_RE` list DOES
include the token `WhatsApp` (also `facebookexternalhit`, `Twitterbot`, `Discordbot`,
`SkypeUriPreview`). So the default works — but correctness depends entirely on
UA-string matching, and a silent miss produces a blank card with no error anywhere.

Mitigation: set `htmlLimitedBots: /.*/` in `next.config.ts` to disable streaming
metadata outright. The cost is TTFB, irrelevant for a few hundred guests. One line
removes the single most fragile dependency in the product.

Sources: <https://nextjs.org/docs/app/api-reference/functions/generate-metadata>,
<https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/html-bots.ts>

### F2 — `generateMetadata` is Server-Component-only

Metadata must resolve on the server before the page renders. The gate page must be a
Server Component; the phone input lives in a child Client Component. Also
`metadataBase` must be set in the root layout or relative `og:image` URLs will not
resolve to the absolute HTTPS URL WhatsApp requires.

### F3 — `ImageResponse` / `@vercel/og`

- Import from `next/og` (moved there in v14; bundled in App Router, no install needed).
  Runs on the Node.js runtime on Vercel.
- Default response headers: `content-type: image/png`,
  `cache-control: public, immutable, no-transform, max-age=31536000`. The SECOND and
  later fetches are CDN hits; only the first is a cold generation.
- Limits: 500KB total bundle (JSX + CSS + fonts + images); fonts must be `ttf`/`otf`/
  `woff`; only flexbox and a CSS subset (no `display: grid`).
- Only Noto Sans is included by default. Noto Sans covers Latin-1, so accented vowels
  and enye render out of the box. A custom display font must ship a subset containing
  those codepoints and be read at module scope with `readFile`.
- Recommended size 1200x630.

Sources: <https://nextjs.org/docs/app/api-reference/functions/image-response>,
<https://vercel.com/docs/og-image-generation/og-image-api>

### F4 — Supabase key model

Four key types: `sb_publishable_...` and `sb_secret_...`, plus legacy `anon` /
`service_role` JWTs being deprecated by end of 2026. A publishable key is explicitly
NOT intended to protect against code analysis or network inspection — anyone can
extract it. It reaches exactly what RLS grants the `anon` role and nothing else.

Source: <https://supabase.com/docs/guides/api/api-keys>

### F5 — `wa.me` link shape

`https://wa.me/<E164 digits, no +, no spaces, no dashes>?text=<urlencoded>`. The message
is only pre-filled, never auto-sent. Unencoded `&` or `?` inside the text breaks
parameter parsing. Equivalent long form
`https://api.whatsapp.com/send?phone=..&text=..`.

**`wa.me` specifies the RECIPIENT only. There is no sender parameter.** The message is
sent from whatever WhatsApp account is installed on the device that opens the link.
Routing to a particular sender is PHYSICAL, not addressable by the app.

### F6 — Vitest and async Server Components

Next.js docs state Vitest does not support `async` Server Components and recommend E2E
for them. Synchronous Server and Client Components can be unit tested.

Source: <https://nextjs.org/docs/app/guides/testing/vitest>

---

## 1. Supabase schema shape

### Unit of invitation: household vs person

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Person is the unit (one `guests` table) | Simplest; one row, one link, one RSVP | Cannot express "one link for the Lopez family, 4 seats"; a couple gets two links and two OG cards; no place to hang seat allowance; retrofitting households later means rewriting every FK and every URL already sent | Low now, HIGH later |
| B. Invitation (household) is the unit, guests are children | Matches the real product (one message, one link, N people); seat allowance has an obvious home; the OG card greets the household; RSVP names individuals | One more table and join; must decide who the primary contact is | Medium |
| C. B plus denormalized display fields on `invitations` | OG generation reads one row (fast path for the crawler); avoids a join on the hottest route | Two sources of truth for names; needs a trigger or write-path discipline | Medium |

**Recommendation: B, with the C denormalization applied narrowly** — keep
`greeting_name` and `display_name` on `invitations` because the OG route and the
`<head>` are the latency-critical path the crawler hits, and they must not join.

The cost of choosing A is not paid at build time, it is paid after links are sent.
URLs already delivered over WhatsApp cannot be recalled. Model the household now.

### Proposed tables

- `senders(id, display_name, role, auth_user_id uuid unique, contact_wa_phone_e164)`
  Two rows. A table, not an enum, so a third operator (a parent, a planner) needs no
  migration. NOTE: `contact_wa_phone_e164` is **not** used to build dispatch links
  (see F5) — it is only the recipient of the guest's "I cannot get in" fallback link.
- `invitations(id uuid pk, slug text unique not null, owner_sender_id uuid null fk,
  display_name text, greeting_name text, seats_allowed int not null check > 0,
  message_note text null, created_at, updated_at)`
- `invitation_guests(id, invitation_id fk, full_name, phone_e164 text null,
  phone_last8 text generated, is_primary bool)`
- `dispatch_events(id, invitation_id fk, actor_sender_id fk, kind, occurred_at)`
  append-only; `kind in ('link_opened','marked_sent','marked_failed','resent')`
- `rsvp_responses(id, invitation_id fk, attending, seats_confirmed int,
  attendee_guest_ids uuid[], notes, submitted_at)` append-only, latest row wins
- `gate_attempts(id, invitation_id fk, ip_hash, succeeded bool, attempted_at)`
- optional `invitation_views(invitation_id, seen_at, ua_hash)`

Use `text` + `CHECK` over Postgres `enum` for state columns: enums require a migration
to extend, and these will be extended.

`seats_confirmed <= seats_allowed`: enforce in the form and validate server-side, but
do NOT make it a hard DB constraint. A guest trying to bring an extra person is
information the couple wants surfaced, not an error the database swallows.

---

## 2. The phone gate

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Exact E.164 match | Strictest; zero false accepts | Very high lockout rate. Stored `+52 1 55...` vs typed `55...`; Mexican `1` prefix, Argentine `9` prefix; a number saved with an old area code. Every mismatch is a real guest who cannot open their own invitation | Low |
| B. Last-N-digits match (N=8) | Immune to country-code and trunk-prefix drift, the dominant real failure cause; ~10^8 space, ample with rate limiting | Slightly weaker in theory; requires a normalized stored column | Low |
| C. Rate limiting + lockout | Makes brute force impractical | Not an alternative — a mandatory complement to A or B | Low |
| D. Match ANY guest on the invitation, not just the primary | Solves "the husband typed his own number"; big recall win | Marginally larger match surface (2-5 numbers) | Trivial |

**Recommendation: B + C + D.** Normalize input to digits, drop the country code,
compare the LAST 8 digits against every `phone_e164` on that invitation. Rate limit per
invitation and per IP-hash (e.g. 8 attempts / 15 min, then a 30 min cooldown).

- Use `libphonenumber-js` (`parsePhoneNumberFromString` with a default country). Do NOT
  hand-roll E.164 normalization — the highest-risk pure function in the product.
- Store canonical `phone_e164` at import time plus a generated, indexed `phone_last8`.
- Timing-safe comparison is not a real concern; the threat is enumeration, not timing.

### Failure modes and recovery (make-or-break UX risk)

A wrong gate locks out a real, invited guest — the most severe failure the product can
produce, and the couple will hear about it socially. **Weight recall over precision.**
Every design tie breaks toward letting the guest in.

Recovery paths, compared:

1. **"Cannot get in?" -> a `wa.me` link back to the OWNING sender**, pre-filled with
   "Hi, I cannot open my invitation". Zero infrastructure, reuses the channel already in
   play, and a human resolves it in seconds. **Recommended default.**
2. Admin console "unlock" that mints a one-time bypass token with a short TTL. Good as a
   second tier; costs a token path (see the security note in R1b).
3. After N failures, show a masked hint ("ends in ..34"). Leaks two digits to anyone
   holding the slug. **Not recommended by default** — decide with the couple.

Unknown slug vs wrong phone: keep the responses shape-identical, or accept a 404 for
unknown slugs given the slug entropy. Do not let the wrong-phone response distinguish
"this invitation exists" from "it does not".

After a successful unlock, set a signed, `httpOnly`, `SameSite=Lax` cookie scoped to
that invitation (30 days) so the guest is never re-gated.

**Honest framing for the couple**: the gate is a privacy veil, not access control. A
forwarded link plus a family member who knows one of the listed numbers opens it. That
is acceptable — but it means the OG card must be safe when public.

---

## 3. Per-guest OG image generation

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Runtime `@vercel/og` at `app/i/[slug]/opengraph-image.tsx` | No build step; add a guest and the image exists; file convention auto-wires the meta tags; after first hit it is CDN-cached `immutable, max-age=31536000` | The FIRST fetch is a cold Satori+Resvg generation, and that first fetch is exactly the one WhatsApp makes when the sender pastes the link. A timeout means a blank card | Low |
| B. Pre-generated static images | Crawler always hits a static object; zero generation latency; deterministic | Second pipeline + storage; regeneration on name edits; if built at build time every new guest needs a redeploy (already rejected) | Medium/High |
| B'. Generate ON WRITE into Supabase Storage | Static delivery with no redeploy | A job/trigger plus a new failure mode: image missing, `og:image` points at nothing | Medium |
| C. A + explicit warm-up | Eliminates the cold-start risk almost entirely at near-zero cost | Requires the warm step to actually happen before dispatch | Low |

**Recommendation: C.** Runtime generation plus warming the canonical OG URL before the
human ever pastes the link. Two natural warm points: (1) when the invitation row is
created, fire a server-side fetch of its OG URL; (2) the console's live preview (R1a)
renders that same canonical URL — **previewing IS warming**. Escalate to B' only if
measured cold p95 turns out bad.

WhatsApp's crawler timeout is not publicly documented; do not encode a specific number.
Design so the crawler hits a warm CDN object and the question does not arise.

Fonts: Noto Sans (bundled) already covers accented vowels and enye. A custom display
font must be `ttf`/`otf`, subset to include those codepoints, read once at module
scope, and kept inside the 500KB budget. Make a name containing an enye plus an accent
a first-class test fixture, and test uppercase forms if the design uppercases names.

**Privacy trap**: the OG card is fetched by an unauthenticated crawler and rendered in
the chat before any gate. Everything on it is public to anyone holding the slug. Put
names and "You are invited" on it — NOT the venue address, NOT the date if that is
considered private, NOT any phone number. Needs the couple's explicit sign-off.

**Immutability rule**: WhatsApp/Meta caches previews per URL. Because every guest has a
unique slug there is no cross-guest cache poisoning — a real advantage of per-guest
URLs. But editing a name AFTER dispatch may leave the old cached card in place forever.
Treat the OG image as immutable once dispatched; to change it, rotate the slug and
resend.

---

## 4. Route and URL design

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Sequential id `/i/42` | Shortest URL | Trivially enumerable. Anyone can walk `/i/1..500` and harvest every guest's name from the ungated OG card. **Reject.** | Low |
| B. Opaque random slug `/i/k7q2m9xr4t` | Unguessable at >=64 bits; stable; short enough for a chat message; rotatable by changing one column; a plain unique-index lookup | A leaked slug is permanent access to the OG card (mitigated by the phone gate for the body); no built-in expiry | Low |
| C. Signed token / JWT in the path | Stateless; carries expiry and scope | Long ugly URL inside the message; rotating the secret invalidates messages ALREADY DELIVERED and unrecallable — fatal; expiry is actively harmful for an invitation sent months ahead; still needs a DB lookup anyway. **Reject as the primary URL.** | Medium |

**Recommendation: B.** `crypto.randomBytes` -> base32, 10-12 chars, unique index, never
expose the numeric id. Support per-invitation slug rotation for the abuse case and for
the post-dispatch name-change case above.

Forwarding is expected and unstoppable. The slug is a bearer capability for the OG card;
the phone gate is the second factor for the body. Optionally log `invitation_views` to
DETECT a broadly shared link — do not block on it.

Keep the path short (`/i/[slug]`): the URL sits inside a URL-encoded `text=` parameter
and message length matters.

---

## 5. Dispatch tracking

The app cannot observe the send. Every "sent" value is a human claim, and the design
should say so out loud rather than pretend otherwise.

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Boolean `sent`, flipped when the console opens the wa.me link | Zero friction | False positives (opened then abandoned); no history; two devices race on one row, last write wins, and one operator can silently flip the other's guest | Low |
| B. Two-step: opening sets `opened`, an explicit "Mark as sent" sets `sent` | Separates intent from completion; the human confirms reality | One extra tap per guest | Low |
| C. Append-only `dispatch_events` + derived current state | Full audit; events never conflict so two devices merge naturally; supports resend, failed, and who-did-what-when | Reads need a view or aggregate | Medium |

**Recommendation: C for storage, B for UX.**

Multi-device consistency:

- Scope the console by operator (see R2). Most conflict disappears by construction.
- Use Supabase Realtime on `dispatch_events` so both consoles update live. A concrete
  payoff of the Supabase choice.
- Never read-modify-write a counter. Insert events.
- **Practical detail**: the console runs on a phone (WhatsApp must be on the same
  device), and navigating to `wa.me` LEAVES the page. Write the `link_opened` event
  before navigation (`navigator.sendBeacon` or an awaited fetch) and never block the
  navigation on that write succeeding. Reconcile on return.

---

## 6. RSVP shape

Capture:

- `attending`: yes / no (a third "not sure yet" is a product decision)
- if yes: a checkbox per `invitation_guests` row — WHICH NAMED PEOPLE are coming. Far
  better than a raw count: it feeds the seating chart directly.
- `seats_confirmed`: derived from the checkboxes, plus an optional extra for households
  where the couple only knows the surname ("Familia X, 4 seats", 2 named)
- optional: dietary restrictions, a message to the couple
- `submitted_at`

Relation to `seats_allowed`: the form offers at most `seats_allowed`; the server
re-validates. An attempt to exceed it should be surfaced to the couple as a request,
not rejected silently (see section 1).

Changing an answer: store `rsvp_responses` append-only, latest row wins. The couple
genuinely wants to know "she said yes, then cancelled". Cost is one extra column.

The RSVP write must go through a server action / route handler authorized by the unlock
cookie — NOT a direct client Supabase insert. A client insert would require an `anon`
INSERT policy keyed on a slug the attacker already holds, which is a spam endpoint.

---

## 7. Security and privacy posture

**What an attacker with the publishable/anon key alone can reach**: exactly what RLS
grants the `anon` role. Under the posture below, that is nothing — enable RLS on every
table and create ZERO `anon` policies. RLS on with no policies is default-deny. The
attacker can confirm the project exists and hit Auth endpoints; they get permission
denied or empty results on every table. That is the honest, concrete answer.

Because of that, the browser never needs a Supabase client for the guest flow at all.
All reads and writes go through Next.js server code holding `sb_secret_...` in a Vercel
env var that is never prefixed `NEXT_PUBLIC_`.

Concrete rules:

- Put `import 'server-only'` at the top of the DB module. A stray client import then
  becomes a BUILD ERROR instead of a data leak. Single highest-value mechanical guard.
- Never return `phone_e164` from any server action to the guest-facing surface. The
  console is an authorized reader (it needs the number for the `wa.me` recipient) —
  which is precisely why the console needs real auth.
- Console auth: Supabase Auth magic link with a server-checked two-email allowlist,
  mapped to `senders.auth_user_id`.
- Rate limiting: Vercel serverless has no shared memory, so an in-memory limiter is
  useless across instances. Use the `gate_attempts` table (fine at this scale) or
  Upstash Redis.
- Do not log submitted phone numbers. Do not send the slug to third-party analytics.
- `robots.txt`: `Disallow: /i/` plus `X-Robots-Tag: noindex` on the invitation route so
  invitations are never indexed. Keep the OG image path allowed so social fetchers can
  retrieve it.
- Real phone numbers must never enter the repo, fixtures, or seed files. Import from an
  untracked CSV or env-driven source; test fixtures use fabricated numbers only.
- Migrate to `sb_publishable_` / `sb_secret_` key format now; legacy JWT keys are
  deprecated by end of 2026.

---

## 8. Testing strategy

**Stale-artifact warning**: `sdd/wedding/testing-capabilities` recommends
`npm create vite@latest -- --template react-ts`. That predates the Next.js decision and
is now WRONG. It must be superseded by the scaffold change, or downstream phases will
scaffold the wrong project.

`strict_tdd` is `false` (fail-closed) only because no runnable command exists. The
scaffold change must land `npm test` and flip `strict_tdd: true` plus
`apply.test_command` / `verify.test_command` in `openspec/config.yaml` in the same
change.

Install (npm — pnpm and yarn are absent; bun is present but not selected):

```
npx create-next-app@latest . --ts --app --eslint
npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
         @testing-library/react @testing-library/dom @testing-library/user-event \
         @testing-library/jest-dom @vitest/coverage-v8
npm i -D @playwright/test
npm i @supabase/supabase-js libphonenumber-js zod server-only
```

Scripts: `test` -> `vitest run`, `test:watch` -> `vitest`, `test:coverage`,
`typecheck` -> `tsc --noEmit`, `lint`, `e2e` -> `playwright test`.
Vitest cannot test async Server Components (F6) — those get E2E coverage.

First meaningful tests, in TDD order (pure domain first, which also matches keeping
domain logic free of React and of the storage vendor):

1. `normalizePhone(input, defaultCountry)` -> `{ e164, last8 }`. Table-driven: with and
   without `+`, with and without country code, spaces, dashes, parentheses, the Mexican
   `1` prefix, the Argentine `9` prefix, empty, garbage. Highest-risk function here.
2. `matchesInvitation(input, guests[])` -> boolean. Any-guest match; near-miss rejects.
3. `buildWaMeLink(recipientE164, text)` -> exact URL. Assert encoding of spaces, `&`,
   `?`, newlines (`%0A`), accents and emoji; assert the number carries no `+`.
4. `renderMessageTemplate(template, vars)` — a missing variable must fail loudly, never
   render `undefined` into a message a human is about to send.
5. Gate rate limiter: N attempts then lockout, scoped per invitation.
6. Slug generator: charset, entropy, collision behavior.
7. Integration: the OG route returns `image/png` with non-zero bytes for a name
   containing an enye and an accent.
8. **E2E (the test that protects the core constraint)**: fetch `/i/<slug>` with
   `User-Agent: WhatsApp/2.23.20.0` and assert `og:image` and `og:title` appear inside
   `<head>` of the RAW HTML, before any JS runs. Regression guard for F1.
9. E2E: a wrong phone yields no invitation content in the DOM or in any network
   response; assert no digit sequence from the stored phone appears in page source.
10. E2E: the public route has no query parameter or token that bypasses the gate (R1b).

Do not chase a global coverage number. Require 100% on the phone-normalization and
link-building modules specifically.

---

## R1. Live preview inside the admin console

### R1a. WhatsApp message preview (mock chat bubble)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. No preview, just show the encoded text | Trivial | The operator cannot see truncation, a broken accent, or a wrong seat count until a guest receives it — and it is unrecallable | Trivial |
| B. Styled mock bubble, placeholder image | Communicates layout | The image is the part most likely to be wrong; a placeholder verifies nothing | Low |
| C. Mock bubble + the REAL canonical OG endpoint for that guest | The previewed image is genuinely the bytes WhatsApp will fetch; catches wrong names, clipped text, broken glyphs; and the preview request WARMS the CDN entry (section 3) | The chat chrome around it is an approximation and must be labelled as such | Low/Medium |

**Recommendation: C.** Render `<img src="/i/{slug}/opengraph-image">` — the canonical
URL, with NO cache-busting parameter, because a busted URL would create a different CDN
entry and defeat the warming benefit. Also display the raw encoded `wa.me` URL and a
character count with a soft warning.

**Where the mock necessarily diverges** — document these so the operator does not
over-trust it:

- **Truncation**: WhatsApp collapses long messages behind "Read more", and the bubble
  wraps by device width and the user's font-size setting. Exact thresholds are not
  documented by WhatsApp. Show an approximate cut line; do not claim precision.
- **Card size**: WhatsApp draws either a large card (image on top) or a small card
  (left thumbnail) depending on image dimensions and platform. 1200x630 normally yields
  the large card, but this is behavioral, not contractual.
- **Platform differences**: iOS, Android, and WhatsApp Web differ in corner radius,
  title and description line counts, and whether the description shows at all.
- **First-URL-only**: only the FIRST URL in a message gets a preview. Hard design
  constraint — the template must contain exactly one URL.
- **Timing**: the card only appears once the sender's own client has fetched the
  preview. Before that the operator sees plain text or a spinner. The warm-up above
  fixes this operator-facing symptom too.
- **Emoji**: the OG image renders Twemoji; the bubble text renders the platform's native
  emoji set. They will not match.

Label the pane "Approximate — actual rendering varies by device".

### R1b. Invitation page preview (SECURITY-RELEVANT)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Render the invitation React component in a pane with fetched data | Fast; no gate involvement; no new route | Proves the component, not the page — does not exercise the real server render, metadata, or the gate boundary | Low |
| B. iframe the LIVE public route with a gate bypass | Pixel-true; exercises the real route | Requires a bypass on the PUBLIC route — the hazard below | Medium |
| C. iframe a SEPARATE admin-only preview route that renders the same shared body component with server-fetched data | Pixel-true for the body; the public gated route never learns the word "preview" and keeps exactly ONE unlock path; protected by ordinary admin auth like every other console page | The two routes must share one component or they drift | Medium |

Bypass mechanisms, compared explicitly:

1. **`?preview=1` on the public route — REJECT.** A plain, guessable, permanently open
   hole appended to a URL every guest already holds.
2. **Signed short-lived preview token on the public route** — better, but it still places
   a second unlock path on the public route. A token that unlocks a real guest's
   invitation is the same capability as the phone gate with no rate limit, and tokens
   leak through browser history and referrers.
3. **Admin-session bypass inside the public route** — no new secret and it dies with the
   session, but it makes the public route's authorization depend on two independent
   identities. That is exactly where authorization bugs live.
4. **Separate admin-only route (C)** — no new authorization axis at all.

**Recommendation: C.** Extract `<InvitationBody invitation={...} />` as one shared server
component consumed by both `/i/[slug]` (post-unlock) and
`/console/preview/[invitationId]` (admin-authed). Add a test asserting both render
identical output for the same fixture, and the E2E from test 10 asserting the public
route has no bypass parameter.

Preview BOTH surfaces: the gate screen itself needs no bypass at all — just iframe
`/i/[slug]` directly and let the operator read the gate copy as a guest sees it. Only
the unlocked body needs the admin route.

---

## R2. Sender partition as a session mode

**Governing constraint (F5)**: `wa.me` addresses the recipient only. The sending account
is whichever WhatsApp is installed on the device that opens the link. The app cannot
route a send — it can only make the wrong send hard to perform.

Schema consequence, correcting section 1: `senders.contact_wa_phone_e164` is NOT used to
build dispatch links. It is only the recipient of the guest's "I cannot get in" fallback
link.

### Establishing operator identity

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Per-person URL (`/console/groom`, `/console/bride`) | Zero friction; bookmarkable on any device | A bearer URL that also exposes every guest phone number — one forwarded link is a full personal-data leak; nothing stops one person typing the other's path; no trustworthy actor attribution | Low |
| B. Local per-device preference (a one-time picker stored in localStorage/cookie) | Trivial; per-device granularity, which is exactly right because the WhatsApp account IS per-device | No security whatsoever on its own; clearing storage silently resets — must fail to the picker, never to a default | Low |
| C. Real authentication (Supabase Auth magic link, two allowlisted emails, `senders.auth_user_id`) | Identity cannot be self-declared; `dispatch_events.actor_sender_id` becomes trustworthy; the phone list is behind a real login, which section 7 requires anyway | Magic-link friction on a phone; being locked out during wedding week would be very bad | Medium |

**Recommendation: C for authentication AND B for the device assertion — they answer
different questions.** Auth answers "who are you". The device preference answers "which
WhatsApp account is installed on this handset". They can disagree, and that disagreement
is precisely the failure mode below.

### The wrong-sender failure mode

The groom opens the bride's list on his phone and sends; the guest receives an invitation
from someone they may not know. Guards, ordered by weight:

1. **Partition by default** — the authenticated operator sees only their own guests.
   Cheapest guard; removes most of the risk by construction.
2. **No send affordance for guests you do not own** — the shared progress view may still
   LIST them, but the button is replaced by "owned by {name}".
3. **Device self-declaration** — on first console load on a device: "Which WhatsApp
   account is on THIS phone?" If the device declaration and the authenticated operator
   disagree, block dispatch with an explanatory interstitial rather than a silent filter.
   **This is the only guard that catches "the bride logged in on the groom's phone".**
4. **Named confirm on send** — "This will be sent from Ana's WhatsApp. Is this Ana's
   phone?" One tap; catches the residual case. Optional.

**Reject as disproportionate** for a two-person wedding app: device fingerprinting or
hard device binding, per-guest send tokens, an approval workflow. The blast radius of a
mis-sent invitation is social awkwardness, recoverable with a follow-up message.
Recommend guards 1 + 2 + 3, with 4 only if the couple wants it.

### Shared state vs partition

Separate the read model from the write model. BOTH operators read the full progress
dashboard (sent counts, RSVPs in, who remains) — the shared-state payoff of Supabase
Realtime. ONLY the owner writes dispatch events for their guests. Record
`dispatch_events.actor_sender_id` (who acted, from auth) separately from
`invitations.owner_sender_id` (who should have); a mismatch is a data-quality signal
worth STORING rather than only preventing.

### Joint / shared guests

| Approach | Pros | Cons |
|---|---|---|
| A. `owner_sender_id NOT NULL` — exactly one owner, assigned at import | Simplest; forces the decision at data-entry time, which is the right time | They genuinely will not know upfront who messages Aunt Rosa |
| B. Nullable owner + a shared "unassigned" queue both see and can claim | Matches the real workflow; a claim is one `UPDATE ... WHERE owner_sender_id IS NULL`, race-safe on Postgres | One more state to render |
| C. Many-to-many `invitation_senders` | Expresses "both know them" | Over-modeled, and it breaks the invariant that exactly one number must send — the entire point. **Reject.** |

**Recommendation: A's invariant plus B's pre-dispatch state.** `owner_sender_id` is
nullable, an unassigned queue is visible to both, and dispatch requires a non-null owner
(enforced server-side). Add a partial index on `owner_sender_id IS NULL`.

---

## Affected Areas (all to be created — greenfield)

- `package.json`, `tsconfig.json`, `next.config.ts` (**must set `htmlLimitedBots`**),
  `vitest.config.mts`, `playwright.config.ts`
- `app/layout.tsx` (**must set `metadataBase`**)
- `app/i/[slug]/page.tsx` (Server Component, `generateMetadata`), its gate Client child
- `app/i/[slug]/opengraph-image.tsx`
- `app/console/**` (auth, guest list, preview panes, dispatch)
- `app/console/preview/[invitationId]/page.tsx` (admin-only unlocked preview)
- `lib/domain/**` — `phone.ts`, `wa-link.ts`, `message-template.ts`, `slug.ts`
  (vendor-free and React-free; the hexagonal core, and where the first tests go)
- `lib/server/db.ts` (`import 'server-only'`)
- `supabase/migrations/**`
- `openspec/config.yaml` (flip `strict_tdd` with the scaffold)

## Recommendation summary

Build it as: household-as-invitation schema; opaque random slugs; runtime `@vercel/og`
with preview-as-warming; streaming metadata disabled outright; last-8-digit any-guest
phone gate with rate limiting and a `wa.me`-back recovery path; append-only dispatch
events with a two-step confirm; Supabase RLS default-deny with all access through
server-only code; auth-based operator identity layered with a per-device
WhatsApp-account declaration; and a separate admin preview route so the public gate keeps
exactly one unlock path.

Sequence the work so the scaffold + `strict_tdd: true` + the pure domain functions
(phone, wa-link, template, slug) land first — they are fully testable, carry the highest
risk, and everything else depends on them.

## Risks

1. **Streaming metadata (F1)** — silent, UA-dependent, produces a blank card with no
   error. Mitigate with `htmlLimitedBots: /.*/` and the E2E in test 8.
2. **OG cold start** vs WhatsApp's undocumented crawler timeout. Mitigate by warming.
3. **Phone-gate lockout** of a real guest — the worst UX outcome. Mitigate with last-8 +
   any-guest matching and a human recovery path.
4. **Post-dispatch immutability** — cached previews and delivered URLs cannot be recalled.
   Name changes after dispatch require slug rotation and a resend.
5. **Wrong-sender dispatch** — unpreventable at the protocol level; only mitigable.
6. **Publishable-key exposure** is only safe if RLS is default-deny on EVERY table and
   the browser never holds a Supabase client for guest data.
7. **Stale testing artifact** recommends Vite; will misdirect the scaffold phase.
8. **`strict_tdd: false`** — the RED-GREEN loop is not executable until the scaffold
   lands. Downstream phases must not assume it.
9. **Real phone numbers as personal data** — must never enter the repo or fixtures.

## Open product questions (SURFACE — do not answer)

1. Which fields personalize the message? Greeting name, formal vs informal register, a
   per-guest custom line? Does the wording differ between the two senders' voices?
2. Does the phone gate double as RSVP identity, or is it purely an unlock?
3. Can a guest change their RSVP after submitting, and until when?
4. What happens for guests with no WhatsApp — SMS, email, a printed card with a QR to the
   same slug?
5. Is the OG card content safe to be fully public (it is ungated)? Names only, or date
   and venue too?
6. Is `seats_allowed` a hard cap, or a starting point a guest may request to exceed?
7. Guest-facing copy language: Spanish only, or bilingual? (Artifacts stay English;
   product copy is a separate decision.)
8. Console auth mechanism, and who gets access — only the two of them, or also a planner
   or a parent?
9. Is there a "plus one" concept distinct from named guests?
10. Is there an RSVP deadline, and what does the page show after it passes?
11. Extra RSVP fields wanted — dietary restrictions, song requests, transport, lodging?
12. Can the operator edit the message per guest before sending, or template only?
13. Is this one dispatch or two waves (save-the-date, then formal invitation)? A second
    wave adds a campaign dimension to `dispatch_events`.
14. What does a revoked or invalid slug show — a 404, or a friendly "contact us" page?
15. (R1a) Must the mock bubble reproduce iOS and Android separately, or is one
    approximation enough?
16. (R1b) Should previewing be REQUIRED before the send button unlocks, as a forcing
    function against typos, or optional?
17. (R2) Are joint guests assigned upfront at import, or claimed from a shared unassigned
    queue during dispatch?
18. (R2) Should each operator see the other's full guest list including phone numbers, or
    only aggregate progress?
19. (R2) If an operator dispatches a guest they do not own, is that an error to prevent
    outright, or a fact to record?
20. (R2) Could a third operator ever be needed (a parent, a planner)?
21. Is a "resend / nudge" flow wanted for guests who never opened their link, and does it
    need its own template?

## Ready for Proposal

**Not yet.** The technical space is mapped and the recommendations are defensible, but
questions 1, 2, 5, 6, 8, and 17 materially change the schema and the gate design. Put
those to the user before `sdd-propose`. Question 5 in particular is a privacy decision
only the couple can make.
