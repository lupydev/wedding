```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:039f7d6e6e0e2f9414c26f62baa9d843b5af141afe02fecc68d9f370d5dbbcdb
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 42/42
scenarios: 61/61
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:a16b4544a36726c4cb1c1bf06042e8b449f0a1b4dd18d84f8101180104770dea
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:ea10877c2338a98977cbf7e27e02411cbe44ff1455687b636639f83d36f18a42
```

## Verification Report

**Change**: whatsapp-wedding-invitations
**Version**: N/A (no version declared in the change artifacts)
**Mode**: Strict TDD (`strict_tdd: true` in `openspec/config.yaml`, runner `npm test`)
**Commit verified**: `37278ed` on `feat/whatsapp-wedding-invitations`, working tree clean before and after this run
**Artifacts read**: proposal, 7 capability specs, design, tasks, apply-progress (full spec-driven verification; no dimension skipped)
**Baseline**: the prior report at this path returned FAIL with 4 CRITICAL / 7 WARNING / 5 SUGGESTION and `npm test` exit 1. Work Unit 10 was the remediation. This report re-verifies every claim rather than accepting it.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 288 |
| Tasks complete | 288 |
| Tasks incomplete | 0 |
| Requirements | 42 |
| Scenarios | 61 |

Task count moved 292 → 288: four items were moved out of the checklist into a
"Deferred — outside this change's specified scope" section, and the three
formerly-unchecked stale items (`2.5`, `4b.12`, `7.3`) were resolved by
annotation or decision. The arithmetic reconciles. Whether each descope is
honest is judged in its own section below, because moving an unchecked box into
prose is exactly the mechanism that would let an unfinished item pass as
complete.

### Build & Tests Execution

Every command below was executed in this session against the repository at
`37278ed`, with local Supabase running.

| Command | Exit | Observed result |
|---------|------|-----------------|
| `npm test` | 0 | **89 files passed, 1459 tests passed**, 0 failed, 0 skipped (13.56s) |
| `npm run typecheck` | 0 | `tsc --noEmit`, no output |
| `npm run lint` | 0 | `eslint .`, no output |
| `npm run format:check` | 0 | `All matched files use Prettier code style!` |
| `npm run build` | 0 | Compiled; 13 routes; `Proxy (Middleware)` emitted |
| `PORT=3100 npm run e2e` | 0 | **155 passed** (37.7s) |

Both expected figures are met exactly: `npm test` exit 0 with 1459 passed, E2E
155 passed. `tools/eslint-zones.spec.ts` did **not** flake — all 89 files passed
on the first and only run, so no re-run was needed.

**Tests**: 1459 passed / 0 failed / 0 skipped.

**Coverage**: not run. `npm run test:coverage` exists, but the declared
`verify.test_command` is `npm test`; coverage is informational under this
skill's rules and `verify.coverage_threshold` is `0`.

### The four CRITICAL findings — verified closed, independently

Each was re-checked against the live stack and the source, not against the
tests or comments that claim to cover it.

#### CRITICAL-4 (open self-service signup) — CLOSED, and the reasoning holds

I did not take the config comment's word for the flag mapping. Three
independent checks:

1. **Live endpoint probe.** `POST http://127.0.0.1:54321/auth/v1/signup` with
   only the publishable/anon key → **HTTP 422**,
   `{"error_code":"signup_disabled","msg":"Signups not allowed for this instance"}`.
   The prior report's demonstrated exploit is gone.
2. **Live advertised settings.** `GET /auth/v1/settings` →
   `"disable_signup": true` alongside `"external": { "email": true }`. Two
   distinct switches, reported separately.
3. **Container environment, which is the actual proof of the CLI mapping.**
   `docker inspect supabase_auth_wedding` →
   `GOTRUE_DISABLE_SIGNUP=true`, `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`.

So `[auth] enable_signup = false` maps to `GOTRUE_DISABLE_SIGNUP` and
`[auth.email] enable_signup = true` maps to `GOTRUE_EXTERNAL_EMAIL_ENABLED` —
exactly as `supabase/config.toml:252-260` claims. Leaving `[auth.email]` true is
correct, not a residual gap: `GOTRUE_EXTERNAL_EMAIL_ENABLED` gates the email
provider, which gates sign-IN, which is why setting it false broke operator
login. The claim is verified on its own terms.

`e2e/invariants/auth-signup.spec.ts` (3 tests, all passed inside the 155)
probes the browser call, the raw POST cross-checked against `auth.users`, and a
sign-in control. The control is the load-bearing part: without it, "signup was
refused" is equally satisfied by an auth server refusing everything.

**The review's two CRITICAL over-claim findings are also closed.** The narrowed
claims now match the evidence in all three places, and I checked each for
residual over-claim:

- `lib/server/auth.ts:163-185` — rewritten. It now says the form was never the
  boundary, that `config.toml` governs only CLI-started local containers, that
  the probe reaches whatever `SUPABASE_URL` names, and — explicitly — that
  "until that step is done, a deployed project can still mint an unvetted
  identity while every command in this repository stays green". That is the
  failure mode stated, not hidden. Comment-only diff; no behavioural change.
- `supabase/config.toml:200-205` — carries a "SCOPE, AND IT IS NARROWER THAN IT
  LOOKS" paragraph naming the local-container limit and task 7.4.
- `e2e/invariants/auth-signup.spec.ts:35-43` — "WHAT THIS FILE CAN REACH, WHICH
  IS LESS THAN IT SOUNDS", stating that absence of a red test here is not
  evidence about production.
- `specs/dispatch-console/spec.md:15-21` — the requirement itself records that
  the repository can only carry the local half.

I found **no place that still over-claims**. The one thing to carry forward is
that the hosted half is enforced by nothing in this repository — see WARNING-5.

#### CRITICAL-2 (unlock cookie) — CLOSED, and both tightened assertions can fail

Code stays at 180 days (`lib/server/cookies.ts:35`,
`UNLOCK_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60`). `specs/phone-gate/spec.md:64`
now requires 180 days and carries a supersession paragraph at line 66. `design.md:287`
says `maxAge: 180d`. `tasks.md:169` records the supersession inline.

The original finding was that a `> 90 days` bound could not detect the
divergence beside it. I checked mutation sensitivity specifically:

- **Unit** — `lib/server/cookies.spec.ts:142`:
  `expect(UNLOCK_COOKIE_MAX_AGE_SECONDS).toBe(180 * 24 * 60 * 60)`. Exact
  equality on a constant. It fails for **every** value other than 15552000, in
  both directions. Provably sensitive by inspection; no mutation run needed.
- **E2E** — `e2e/phone-gate.spec.ts:375-376`: `daysLeft > 179.99` **and**
  `daysLeft <= 180`. A 30-day cookie yields 30 and fails the lower bound; a
  365-day cookie yields 365 and fails the upper bound. The band is now closed on
  both sides, which the `> 90` bound was not. Detection confirmed by arithmetic.

Work Unit 10 additionally records a real mutation run (code set to 30d: unit
failed `2592000 ≠ 15552000`, E2E failed `29.999… > 179.99`). My independent
analysis agrees with that evidence.

#### CRITICAL-3 (auth mechanism) — CLOSED

`specs/dispatch-console/spec.md:9-13` is rewritten to "Operator authentication by
email and password", with a supersession paragraph explaining why the mechanism
moved and stating that the authority (the `senders` allowlist, design D7) did
not. The requirement also now carries the signup clause and gained one scenario,
taking dispatch-console from 13 to 14 scenarios and the change total from 60 to 61.

`design.md` corrections verified line by line — all five formerly-stale paths are
fixed and the missing entry was added:

| Prior finding | State at `37278ed` |
|---|---|
| `app/console/layout.tsx` | `design.md:51` — `app/console/(authenticated)/layout.tsx`, with the route-group note |
| `app/console/page.tsx` | `design.md:53` — `app/console/(authenticated)/page.tsx` |
| `app/console/dispatch/[invitationId]/page.tsx` | `design.md:55` — corrected |
| `app/console/preview/[invitationId]/page.tsx` | `design.md:56` — corrected |
| `app/console/auth/callback/route.ts`, "magic-link entry and exchange" | `design.md:52` — replaced by `app/console/login/{page,actions}.tsx`, supersession stated |
| No `proxy.ts` entry at all | `design.md:58` — full entry added, naming the `/console/:path*` matcher, the session refresh, the unconditional `x-operator-identity` delete, and the Next 16.3 rename |
| `components/invitation/RsvpForm.tsx` | `design.md:60` — `RsvpAnswer.tsx`, rename recorded |
| Unlock cookie `maxAge: 30d` | `design.md:287` — `maxAge: 180d` |

One residual remains — see WARNING-7.

#### CRITICAL-1 (ceremony placeholder test) — CLOSED, and it can fail

`supabase/tests/ceremony.spec.ts` is re-aimed from the live singleton to the
migration seed. I ran the file directly: **29 tests, all passed.** The closure
is sound for three reasons I verified myself:

1. **It no longer depends on mutable product state.** The live row today holds
   `couple_names = "Luis & Michell"` (a real value the couple typed) while
   `ceremony_date` and `venue_address` are still `{{CEREMONY_DATE}}` /
   `{{VENUE_ADDRESS}}` — I read the row directly. That is the exact divergence
   that made the old assertion red, and the suite is green through it.
2. **It can fail.** `ceremony.spec.ts:201-210` is a negative control that feeds
   the pure parser `insert into ceremony (ceremony_date) values ('sábado 14 de
   noviembre')` and asserts the parser reports that value and that it does
   **not** match the placeholder regex. Passing. Work Unit 10 also records a
   real migration mutation that went red naming the column.
3. **It cannot pass vacuously.** `ceremony.spec.ts:191` asserts the parsed key
   set equals all seven `CEREMONY_COLUMNS`, so a parser that found nothing, or
   a column added by a later migration carrying an invented default, fails
   rather than being skipped.

Three further tests ("still holds a real couple_names / venue_name /
venue_address once somebody types one") assert the opposite direction, so the
feature working is now explicitly a pass rather than a failure.

The parser has two real limits, carried below as WARNING-4 and SUGGESTION-2 —
they are not the same severity and the brief groups them together.

### Spec Compliance Matrix

Compliance is judged against the CODE, with a passing covering test as runtime
evidence. Where a test passes but could not have failed, that is recorded.

#### project-scaffold — 5/5 COMPLIANT

| Requirement | Scenario | Test / evidence | Result |
|---|---|---|---|
| Next.js App Router baseline | Scaffold produces a runnable dev server | `npm run build` exit 0, `npm run typecheck` exit 0 | COMPLIANT |
| Streaming metadata disabled | Metadata is never streamed | `e2e/invitation-page-og.spec.ts > does not stream the tags after </head>` | COMPLIANT (reclassified — see below) |
| Absolute metadata URLs | OG image URL is absolute | `e2e/invitation-page-og.spec.ts > emits an absolute https og:image on the deployed origin` | COMPLIANT |
| Test harnesses installed | Test commands are runnable | `vitest run` with a zero-match filter exits 0 | COMPLIANT |
| Strict TDD enabled by this change | strict_tdd reflects a runnable command | `openspec/config.yaml` `strict_tdd: true`; `apply.test_command` `npm test` **exits 0** | **COMPLIANT (was FAILING)** |

The prior FAILING is closed: the requirement demands `apply.test_command` be "a
non-empty string that executes successfully", and `npm test` now exits 0.

**Reclassification from the prior report's PARTIAL, with the reasoning stated
so it can be audited.** The prior report marked "Metadata is never streamed"
PARTIAL because the covering test's own comment
(`e2e/invitation-page-og.spec.ts:123-135`) records that the suite was re-run with
`htmlLimitedBots` REMOVED and every test still passed. I read the requirement
and that comment again and reach COMPLIANT, for three reasons:

1. The requirement carries two MUSTs and both hold. `next.config.ts:16` does set
   `htmlLimitedBots: /.*/` — verified directly. The per-guest OG tags are
   server-rendered into the first HTML response for both UA classes — verified
   at runtime against the RAW response body, and confirmed ABSENT after
   `</head>`.
2. The scenario's GIVEN is a precondition, not an outcome to assert. This skill
   marks PARTIAL when "the test passes but covers only part of the scenario";
   the test covers the WHEN and the THEN completely, under a precondition that
   is factually true in the repository.
3. The test is not blind to the regression that matters. Its comment explains
   that Next 16.3.4 does not stream this route by default because nothing above
   it flushes a shell early, and that the config line exists for the moment a
   later work unit puts a Suspense boundary in front of this page — at which
   point streaming becomes possible, the tags move to the end of the body, and
   this test goes red. It would catch the real failure; it merely cannot fail on
   deleting a line that is currently redundant on this Next version.

What remains is a regression-protection observation about one config line, not
a compliance gap. It is carried as SUGGESTION-8 rather than suppressed.

#### invitation-domain — 8/8 COMPLIANT

| Requirement | Scenario | Test |
|---|---|---|
| Phone normalization | Normalizes punctuation / country-code variants | `lib/domain/phone.spec.ts` |
| Phone normalization | Rejects unparseable input | `lib/domain/phone.spec.ts` |
| Any-guest phone match | Matches any listed guest | `lib/domain/phone.spec.ts` |
| Any-guest phone match | Rejects a near-miss | `lib/domain/phone.spec.ts` |
| wa.me link building | Produces a correctly encoded URL | `lib/domain/wa-link.spec.ts` |
| Message template rendering | Renders with the greeting name | `lib/domain/message-template.spec.ts` |
| Message template rendering | Fails loudly on a missing variable | `lib/domain/message-template.spec.ts` |
| Slug generation | Unguessable and unique per invocation | `lib/domain/slug.spec.ts > produces 10000 unique, well-formed slugs` |

`SLUG_BYTE_LENGTH = 10` → 80 bits, above the required 64. Slug regex
`^[a-z2-7]{16}$` enforced by a DB CHECK; `id` is a `uuid` never encoded into the
slug.

#### guest-directory — 6/6 COMPLIANT

| Requirement | Scenario | Evidence |
|---|---|---|
| Household-as-invitation model | One link serves multiple guests | `lib/server/invitations.spec.ts`; `invitations 1—N invitation_guests` |
| Sender ownership mandatory | Import assigns an owner to every invitation | `lib/server/invitations.spec.ts > validateImportRow`; `owner_sender_id uuid NOT NULL references senders(id)` |
| Two senders, disjoint subsets | Ownership partitions the guest list | One NOT NULL FK per invitation; `e2e/console-guest-list.spec.ts > the partitioned guest list` |
| Seat allowance per invitation | Seats allowed is always positive | `lib/server/invitations.spec.ts > rejects a seats_allowed of zero`; DB `check (seats_allowed between 1 and 12)` |
| Guest phones stay server-side | Guest-facing response omits phone numbers | `e2e/invitation-page-og.spec.ts > never puts a guest phone number in the invitation page source` (raw HTML, 6 digit forms) |
| Import from an untracked source | No real phone number enters the repository | `/data/` git-ignored and untracked; only fabricated fixtures in history |

**WARNING-4 from the prior report is closed here, and I confirmed the closure is
the honest one.** The prior report found "one of exactly two sender identities"
enforced by nothing. `guest-directory/spec.md:21` now says "exactly one of the
allowlisted senders" and line 23 adds a paragraph stating plainly that nothing
enforces a cardinality of two, that `senders` carries no cardinality
constraint, that its `role` CHECK admits `helper`, and that the E2E suite
legitimately seeds extra rows. The scenario now asserts "exactly one
allowlisted sender identity", which the NOT NULL FK does enforce. The spec was
narrowed to what is true rather than the invariant being invented — the correct
resolution. Live check: 3 sender rows, consistent with the amended wording and
not with the old one. One residual wording inconsistency: SUGGESTION-6.

#### invitation-page — 7/7 COMPLIANT

| Requirement | Scenario | Test |
|---|---|---|
| Server-rendered per-guest OG metadata | OG tags under a WhatsApp UA | `e2e/invitation-page-og.spec.ts` |
| Server-rendered per-guest OG metadata | OG tags under an ordinary browser UA | `e2e/invitation-page-og.spec.ts` |
| OG card content is names-only | Card omits private details | `lib/domain/og-card.spec.ts`; `OgCardSource` is a projection with no date/venue/phone |
| OG image renders accents and enye | Name renders without corruption | `tools/og-font-coverage.spec.ts` (cmap check + CJK negative control) + E2E pixel-difference test |
| Invalid or rotated slug | Unknown slug handled gracefully | `e2e > shows a friendly contact page instead of a raw 404` |
| Invalid or rotated slug | Unknown-slug vs wrong-phone shape-identical | `e2e/phone-gate.spec.ts > an unknown slug compared with a wrong phone` |
| Absolute OG image URL | og:image is absolute | `e2e > emits an absolute https og:image on the deployed origin` |

All OG assertions read the RAW response body through Playwright's `request`
fixture, never a hydrated DOM.

#### phone-gate — 8/8 COMPLIANT

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Last-8-digit any-guest match | Any guest's number unlocks | `e2e/phone-gate.spec.ts`, `lib/domain/phone.spec.ts` | COMPLIANT |
| Last-8-digit any-guest match | A near-miss does not unlock | `e2e/phone-gate.spec.ts` | COMPLIANT |
| Wrong phone reveals nothing | No content or digits leak on failure | `e2e/phone-gate.spec.ts > neither response discloses a guest name or a stored digit` | COMPLIANT |
| Rate limiting is DB-backed | Repeated failures trigger lockout | `e2e > refuses the 9th attempt after 8 failures`, `> persists across a separate browser context`; `gate_attempts` table | COMPLIANT |
| Exactly one unlock path | No query parameter bypasses | `e2e/phone-gate.spec.ts > exactly one unlock path` (5 cases) | COMPLIANT |
| Exactly one unlock path | An authenticated admin session does not bypass | `e2e/console-guest-list.spec.ts:388-416` (signed in as operator Ana, 4 parameters) | COMPLIANT |
| Unlock cookie persists the session | Repeat visit skips the gate | `e2e > lets a return visit skip the gate entirely` + exact-value assertions | **COMPLIANT (was FAILING)** |
| Recovery path to the owning sender | Recovery link targets the correct owner | `e2e > offers a wa.me link addressed to the OWNING sender` | COMPLIANT |

**Exactly one unlock path — re-verified against the source, not only the
tests.** `app/i/[slug]/page.tsx:110` reads exactly one piece of unlock state
(`cookies().get(UNLOCK_COOKIE_NAME)`, cross-checked against `record.id`).
`signUnlockCookie` has exactly one production caller: `app/i/[slug]/actions.ts:100`
inside `unlockAction`, reached only after `attemptUnlock` returns unlocked.
`proxy.ts:28` matches `["/console/:path*"]` only, so no operator session is
resolved on the guest route. Confirmed by exhaustive grep across non-test
sources at this commit.

#### rsvp — 13/13 COMPLIANT

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| RSVP requires an unlocked session | Unauthorized submission rejected | `e2e/rsvp.spec.ts`; `lib/server/rsvp.ts` verifies the signed cookie server-side | COMPLIANT |
| Seat allowance is a hard cap | Form does not offer over-cap selection | `e2e > offers no way to select a fourth person` | COMPLIANT |
| Seat allowance is a hard cap | Server rejects a tampered over-cap submission | `e2e`; trigger `rsvp_seat_cap` verified live | COMPLIANT |
| Append-only history, latest wins | A changed answer is recorded, not overwritten | `e2e`; `rsvp_responses_append_only` trigger verified live | COMPLIANT |
| Optional extra fields | Submission without the optional field succeeds | `lib/server/rsvp.spec.ts` | COMPLIANT |
| Optional extra fields | A message field is neither offered nor accepted | `lib/server/rsvp.spec.ts`; live DB confirms no `message` column anywhere in `public` | COMPLIANT |
| Declining shows the ceremony stream | Declining submits on the first tap | `e2e > records the decline on the first tap` | COMPLIANT |
| Declining shows the ceremony stream | The stream replaces the form | `e2e > shows the stream details instead of the form` | COMPLIANT |
| Declining shows the ceremony stream | A decline can be corrected | `e2e > lets a declined household come back and accept after all` | COMPLIANT |
| Declining shows the ceremony stream | A refused decline does not reveal the stream | `components/invitation/RsvpAnswer.spec.tsx` | COMPLIANT |
| Ceremony row is default-deny | The publishable key reaches no ceremony value | `e2e/invariants/rls.spec.ts` + live probe: anon 401 | COMPLIANT |
| Deadline behavior | Form replaced after the deadline | `e2e > shows a contact message instead of the form` | COMPLIANT |
| Deadline behavior | Form available before the deadline | `e2e > accepts an answer on the deadline day itself` | COMPLIANT |

The **"visibly unfinished placeholders" clause** (`rsvp/spec.md:68`) is now
satisfied and was the prior report's one FAILING here. The clause is conditional
— "Until the couple supplies them, that row MUST hold visibly unfinished
placeholders; no plausible date, meeting id or passcode may be invented." Live
state: `couple_names` holds a supplied value (so the "until" has expired for
that column) and every unsupplied column holds `{{...}}`. Nothing is invented.
The normative property is now asserted where it cannot be broken by the couple
filling the form in (the migration seed), and
`tools/no-source-placeholders.spec.ts` covers the "not restated in application
code" half.

#### dispatch-console — 14/14 COMPLIANT

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Operator authentication by email and password | Self-service signup is refused by the instance the console runs against | `e2e/invariants/auth-signup.spec.ts` (3 tests) + my live probe: HTTP 422 `signup_disabled` | **COMPLIANT (new scenario)** |
| Operator authentication by email and password | Unallowlisted email cannot access | `lib/server/auth.spec.ts`, `e2e/console-auth.spec.ts` | **COMPLIANT (was FAILING)** |
| Operator authentication by email and password | Allowlisted sender reaches their dashboard | `e2e/console-auth.spec.ts` | **COMPLIANT (was FAILING)** |
| Guest list partitioned by ownership | Sender's default view shows only owned | `e2e/console-guest-list.spec.ts`; `WHERE` in `listConsoleInvitations` | COMPLIANT |
| Guest list partitioned by ownership | Shared progress dashboard visible to both | `e2e > the shared dashboard covers both partitions` | COMPLIANT |
| No send affordance for non-owned | Non-owner sees no send button | `e2e > offers no send button on the other's rows` | COMPLIANT |
| Per-device WhatsApp declaration | Declaration mismatch blocks dispatch | `e2e/console-dispatch.spec.ts > the device declaration gate` | COMPLIANT |
| Per-device WhatsApp declaration | Declaration match allows dispatch | `e2e > restores the dispatch once the declaration agrees again` | COMPLIANT |
| wa.me link preparation, never auto-send | Dispatch opens WhatsApp for a human | `e2e/console-dispatch.spec.ts`; no server-side send exists anywhere | COMPLIANT |
| Append-only dispatch events | Every dispatch produces an event row | `e2e/console-preview.spec.ts` | COMPLIANT |
| Append-only dispatch events | Actor/owner mismatch recorded, not dropped | `lib/server/dispatch.spec.ts > stores an actor who is not the owner` | COMPLIANT |
| Message preview via the real OG endpoint | Preview image matches the dispatched card | `e2e/console-preview.spec.ts` (real `Buffer.equals`) | COMPLIANT |
| Body preview on a separate admin-only route | Admin preview renders the same body component | `e2e/console-preview.spec.ts`; both routes render `InvitationBody` from one projection | COMPLIANT |
| Body preview on a separate admin-only route | Admin preview requires console authentication | `requireOperator()` in the `(authenticated)` layout AND in the page | COMPLIANT |

The signup scenario is scoped to "the instance the console runs against". There
is exactly one such instance today — the local stack, which refuses. Production
has no Supabase environment variables yet (per the deferred `7.2` item), so no
hosted instance serves this console. The scenario is genuinely satisfied today;
the deploy-time gap is carried as WARNING-5 so archive does not lose it.

**Compliance summary**: **61/61 scenarios COMPLIANT** — 0 PARTIAL, **0 FAILING,
0 UNTESTED**. Requirements: 42/42.

### Correctness (Static and Live Evidence)

Re-verified this session against the live local Supabase and the source.

| Requirement | Status | Evidence |
|---|---|---|
| Exactly one unlock path on `/i/[slug]` | Implemented | One reader, one minter, proxy scoped to `/console/:path*` |
| No guest phone digits in guest-facing source | Implemented | `toGuestFacingInvitation` projection; raw-HTML E2E over 6 digit forms |
| All 7 owned tables RLS-enabled, zero policies | Implemented | Live `pg_class`/`pg_policy`: `ceremony`, `dispatch_events`, `gate_attempts`, `invitation_guests`, `invitations`, `rsvp_responses`, `senders` — all `rls=t`, `policies=0` |
| Zero grants to `anon`/`authenticated`/`PUBLIC` | Implemented | Live `information_schema.role_table_grants` → **0 rows**; `role_routine_grants` → **0 rows** |
| The anon key reaches nothing | Implemented | Live probes: **401** on all 7 tables, on `rsvp_latest`, and on `rpc/import_invitations` |
| `rsvp_latest` is `security_invoker` | Implemented | Live `pg_class.reloptions` → `{security_invoker=true}` |
| Append-only against `service_role`, by trigger | Implemented | Live `pg_trigger`: `BEFORE DELETE OR UPDATE … FOR EACH ROW EXECUTE FUNCTION reject_mutation()` on both `rsvp_responses` and `dispatch_events`. A trigger binds `service_role` because `BYPASSRLS` does not bypass triggers |
| Seat cap enforced in the database | Implemented | Live `pg_trigger`: `rsvp_seat_cap BEFORE INSERT` → `enforce_seat_cap()` |
| No `message` column anywhere in `public` | Implemented | Live `information_schema.columns` → **0 rows** |
| Self-service signup refused | Implemented (local instance) | Live 422 `signup_disabled`; `GOTRUE_DISABLE_SIGNUP=true` |
| Per-guest OG tags in `<head>` of first response | Implemented | Raw HTML, both UA classes |
| Operator sign-in's three refusals indistinguishable | Implemented | One `SIGN_IN_NOTICE`; password verified FIRST; a valid non-operator's session destroyed by `signOut()` before returning |
| Unlock cookie lifetime | **No longer deviates** | 180 days in code, spec, design and tasks |
| Operator authentication mechanism | **No longer deviates** | Password in code and spec, with supersession |
| Sender cardinality | **No longer over-claimed** | Spec narrowed to "the allowlisted senders" |
| Gate refusals indistinguishable | Implemented, residual gap | SUGGESTION-3 |
| No probe residue left in the identity store | Confirmed | `auth.users` count = 2 (both seeded operators); my own probe user cleaned up |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 direct `libphonenumber-js` import in domain | Yes | `lib/domain/phone.ts` |
| D2 randomness and clock as arguments | Yes | `encodeSlug(bytes)`, `evaluateGate(ctx, now)`, `attemptUnlock({now})` |
| D3 two normalization strictnesses | Yes | `normalizeForStorage` (throws) and `deriveGateKey` (lenient) |
| D4 80-bit slug | Yes | `SLUG_BYTE_LENGTH = 10`; DB CHECK `^[a-z2-7]{16}$` |
| D5 append-only by trigger, not RLS | Yes | Verified live |
| D6 seat cap at three layers | Yes | `enforce_seat_cap` trigger + `lib/domain/seats.ts` + server-action re-validation |
| D7 `senders` IS the allowlist | Yes | No `OPERATOR_EMAILS` variable exists |
| D8 beacon via plain route handler | Yes | `app/console/api/dispatch-event/route.ts`, 204, idempotent |
| D9 runtime `next/og` + server-side warm | Yes | `lib/server/og-warm.ts` |
| D10 unknown slug differs from wrong phone | Yes | Friendly page vs gate error |
| Password entry and Server-Action session write | **Yes** | `design.md:52`, amended in WU10 |
| Route-group console paths | **Yes** | `design.md:51,53,55,56`, corrected in WU10 |
| `proxy.ts` / `lib/proxy/operator-session.ts` recorded | **Yes** | `design.md:58`, added in WU10 |
| Unlock cookie `maxAge: 180d` | **Yes** | `design.md:287`, corrected in WU10 |
| `RsvpAnswer.tsx` rename recorded | **Yes** | `design.md:60` |
| Body-preview heading path | No | `design.md:371` still omits the route group — WARNING-7 |

All three prior design-coherence failures are closed. One heading remains stale.

### Judging the four descoped items

Each was assessed independently, because a descope is the one move that turns an
unfinished item into a complete task list.

**1. Supabase Realtime (was 6b.15 / 6b-ii.14) — HONEST descope. Verified myself.**
I searched all seven capability specs for `realtime`, `real-time`, `live`,
`websocket`, `subscribe`, `postgres_changes` and `.channel(`: **zero matches**.
So I can state it affirmatively — **no requirement in any of the seven
capability specs asks for Realtime.** Source search confirms it was never
built: the only `realtime` occurrences anywhere are the Supabase CLI's own
default `[realtime]` config block and a comment in
`0004_default_deny_new_objects.sql` explaining that its scope is `public` only.
The stated reason (publishing a table over Realtime is a publication-plus-RLS
decision on a table that is default-deny to every role but `service_role`) is
technically correct and consistent with this change's posture. Genuinely out of
scope, not merely unfinished.

**2. The couple's own wedding facts (was 7.1) — HONEST descope.**
The code half shipped in WU9: `/console/wedding` is an operator-editable form
over all seven facts, and 9.25 removed the last placeholder from source
(guarded by `tools/no-source-placeholders.spec.ts`). What remains is data entry
by the couple, which no task can close. Live state corroborates it exactly:
`couple_names = "Luis & Michell"` supplied, the other facts still
`{{PLACEHOLDER}}`. No code work is outstanding.

**3. Live `og:image` confirmation on the deployed origin (was 7.2) — HONEST, with
one claim I cannot verify from here.** The reasoning is sound: production has no
Supabase environment variables, so `/i/[slug]` cannot resolve an invitation
there and no page exists whose `og:image` could be inspected. The behaviour is
covered locally against a production build with the origin injected as
production injects it. The item is labelled "unconfirmed-in-production rather
than claimed done", which is the right framing. However, the assertion that
"`NEXT_PUBLIC_SITE_ORIGIN` is set in Vercel Production" is a claim about
external infrastructure that nothing in this repository can substantiate — see
WARNING-6.

**4. Hosted-project signup closure (7.4) — HONEST descope, correctly created.**
This item exists because the review found the gap, and it is scoped precisely:
it names the local-only reach of `config.toml`, the loopback default of the
probe, the exact re-aimed command to run against a deployed project, and its
blocking dependency (no hosted project exists). It is not a code change and
cannot be closed from here. Carried as WARNING-5 because the requirement it
serves binds every environment.

**Overall judgment on the descope mechanism**: all four are honestly labelled,
none is claimed as done, and the section states what would have to be decided
first. Items 2, 3 and 4 are *blocked operational work the product still needs*
rather than scope that is never needed, and that distinction should survive into
the archive — WARNING-6.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | 17 "TDD cycle evidence" tables across 18 work-unit sections |
| All tasks have tests | Partial | One unit section (Work Unit 8) carries no evidence table — WARNING-8 |
| RED confirmed (test files exist) | Yes | Every test file named in the tables exists on disk |
| GREEN confirmed (tests pass now) | **Yes** | 1459/1459 pass; the prior report's single red test is closed |
| Triangulation adequate | Yes | Spot-checked: 5 query-parameter cases for one-unlock-path, 10,000 slug samples, accented/unaccented OG control pair, CJK negative control for the font cmap, 3 probe shapes for signup, invented-seed negative control for the ceremony parser |
| Safety Net for modified files | Yes | Full-suite runs recorded per unit in apply-progress |
| Mutation proofs for this unit's fixes | Yes | WU10 records real mutation runs for CRITICAL-1, -2 and -4; I independently corroborated the sensitivity of each |

**TDD Compliance**: 6/7 checks passed (was 5/6).

Correction to the prior report's bookkeeping: it stated "16 tables across 17
work units" with the scaffold batch as the sole exception. Counted
case-insensitively at this commit, there are **17 tables across 18 sections**,
the scaffold batch **does** have one, and the sole exception is **Work Unit 8**.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (domain, server, tools, scripts, design) + DB-integration | 1459 total across both vitest projects | 89 | Vitest 5, `pg` against real local Postgres |
| Component (jsdom) | included in the 1459 | included in the 89 | Testing Library + jsdom |
| E2E | 155 | 13 | Playwright against a PRODUCTION build |
| **Total** | **1614** | **102** | |

The DB suites connect to a real local Supabase and fail loudly rather than
skipping when it is unreachable (`supabase/tests/helpers/db.ts` re-throws with an
actionable message instead of calling `it.skip`), so a green run cannot mean "the
database was absent".

### Changed File Coverage

Coverage analysis skipped — `npm run test:coverage` was not part of the commanded
evidence set, `verify.coverage_threshold` is `0`, and coverage is informational
rather than blocking under this skill's rules.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| — | — | — | No tautology, no `.only`, no `.skip`, no `.todo` in 102 test files | — |

**Assertion quality**: all assertions verify real behaviour. Specific strengths
confirmed this run:

- `e2e/invariants/auth-signup.spec.ts` reads `auth.users` directly after the raw
  POST, so a refusal returned after a partial write cannot pass, and its third
  test is a control proving the refusal is surgical rather than total.
- `supabase/tests/ceremony.spec.ts` pairs its placeholder assertion with a
  pure-function negative control and a key-set completeness assertion, so
  neither an invented value nor a silently-missing column passes.
- `lib/server/cookies.spec.ts:142` asserts the exact constant, replacing a bound
  that could not fail.
- `e2e/console-preview.spec.ts` compares real image bytes with `Buffer.equals`.
- `tools/og-font-coverage.spec.ts` carries a CJK negative control.
- `lib/server/rsvp.spec.ts` asserts the exact inserted key set, so a re-added
  `message` column fails.

Of the two assertions the prior report flagged as weaker than they read, the
cookie assertion is fixed and the `htmlLimitedBots` one is reclassified with
reasoning above and carried as SUGGESTION-8.

### Quality Metrics

**Linter**: no errors (`eslint .`, exit 0).
**Type Checker**: no errors (`tsc --noEmit`, exit 0).
**Formatter**: clean (`prettier --check .`, exit 0).

### Known-Open Advisory Findings — Confirmed

These were left open on purpose by the WU10 review and are expected, not
regressions. Each was re-checked; where my assessment differs from the
description, that is stated.

| Finding | Verified state |
|---|---|
| `R1-db-connection-string-in-error` | **CONFIRMED OPEN**, at `e2e/invariants/auth-signup.spec.ts:63` (not `:53`). `connect()`'s catch interpolates `LOCAL_DB_URL` — password included — into a thrown `Error`. Default is the well-known local credential; the value is overridable via `SUPABASE_DB_URL`. **Not worse than described.** See WARNING-3. |
| `R2-seed-parser-comma-split` | **CONFIRMED OPEN but LATENT, and better in kind than described.** See SUGGESTION-2. |
| `R3-ceremony-seed-parser-ignores-update-seeding` | **CONFIRMED OPEN, and this is the more serious of the two parser findings.** Escalated to WARNING-4 with reasoning. |
| `R4-cookie-expiry-band-has-zero-upper-tolerance` / `R2-cookie-band-rationale-mismatch` | **CONFIRMED OPEN. Not worse than described.** 0.01 days = 864 s = 14.4 min of slack on the lower bound, while the comment justifies only whole-second rounding plus the round trip. Detection is unaffected: the band rejects both 30 days and 365 days. A precision-of-justification gap, not a detection gap. See SUGGESTION-1. |
| `WARNING-1` (`createInvitation` compensation) | **CONFIRMED OPEN**, accurately described. Carried to `invitation-administration`. See WARNING-1. |
| `WARNING-2` (`scripts/import-guests.ts` unchecked cast) | **CONFIRMED OPEN**, accurately described. Carried to `invitation-administration`. See WARNING-2. |
| `WARNING-3` (order-dependent DB test key resolution) | **CONFIRMED OPEN**, accurately described. Now quantified — see WARNING-3. |
| Prior `WARNING-4` (exactly two senders) | **CLOSED** by spec amendment. |
| Prior `WARNING-5` (stale `design.md`) | **CLOSED** except one heading — WARNING-7. |
| Prior `WARNING-6` (`RsvpForm.tsx`) | **CLOSED in `design.md`**; still present in `tasks.md` history — SUGGESTION-5. |
| Prior `WARNING-7` (six unchecked tasks) | **CLOSED.** Zero unchecked tasks. |
| Prior `SUGGESTION-4` (cache-buster spec wording) | **CLOSED.** `dispatch-console/spec.md:111` now defines "canonical" as including the framework's build-scoped hash query and forbids only a cache-buster of the preview's own. |
| Prior `SUGGESTION-5` (E2E leaves seeded senders) | **CONFIRMED OPEN.** Live `senders` count = 3. See SUGGESTION-4. |

### Issues Found

**CRITICAL**: None. All four prior CRITICAL findings are independently verified
closed, and no new contradiction between a spec requirement and the
implementation was found in any of the seven capability specs.

**WARNING**

**WARNING-1 — `createInvitation`'s compensation discards the delete's result and
is unreachable by the suite.** `lib/server/invitations.ts:398` is
`await client.from("invitations").delete().eq("id", invitation.id);` — the result
is never inspected, so a failing compensation silently leaves a guestless
invitation that nobody can unlock and that looks valid in the console. Neither
covering test reaches the branch. `importInvitations` is the production path and
is atomic via the SQL function, which bounds real exposure, but `createInvitation`
remains exported and callable. *Carried to the separate `invitation-administration`
change, which rewrites this code. Confirmed still accurately described.*

**WARNING-2 — Import row shape is an unchecked cast whose failure is a bare
`TypeError`.** `scripts/import-guests.ts:101` is `return invitations as ImportRow[]`
after validating only that the array exists and is non-empty. The requirement it
serves says an unusable owner or unnormalizable phone must stop the import at the
row that introduced it; a `TypeError` names no row, field or file. `zod` is
already a dependency and is not used here. *Carried to `invitation-administration`.
Confirmed still accurately described.*

**WARNING-3 — DB test key resolution is order-dependent, and the helper leaks a
credential on failure.** Two halves of one file's design:
`supabase/tests/helpers/local-keys.ts:15` caches at module level, while 20
separate `process.env.SUPABASE_URL` / `SUPABASE_SECRET_KEY` assignments sit
inside test bodies across five files (`lib/server/invitations.spec.ts` ×7,
`lib/server/supabase.spec.ts` ×6, `lib/server/dispatch.spec.ts`,
`supabase/tests/operator-session-refresh.spec.ts`). These pass in the current
order and are not guaranteed to under `--shuffle`, `--no-isolate`, or a file
split. Separately, `e2e/invariants/auth-signup.spec.ts:63` interpolates the full
Postgres connection string, password included, into a thrown `Error`
(`R1-db-connection-string-in-error`). The default is the documented local
credential, but `SUPABASE_DB_URL` is env-overridable, so re-aiming the suite at a
real project — which is exactly what task 7.4 instructs — would put that
project's password into an error message.

**WARNING-4 — The ceremony seed parser ignores `UPDATE`-shaped seeding, which is
a false-PASS path.** `supabase/tests/ceremony.spec.ts:82-110` recognises exactly
two SQL shapes: `insert into ceremony (...) values (...)` and
`add column <name> <type> not null default '...'`. A future migration that
seeded a value with `update ceremony set ceremony_date = 'sábado 14 de
noviembre'` would be invisible to the parser; `seed` would still report
`{{CEREMONY_DATE}}` from `0009`, the assertion would stay green, and an invented
value would ship — precisely the outcome the requirement forbids. The negative
control at line 201 exercises only the `INSERT` shape, so it does not cover this.
I am separating this from the comma-split finding it is normally grouped with
because the two fail in opposite directions: this one passes when it should
fail; the comma-split one fails when it should pass. Recommend either asserting
the seed against the post-migration row inside `withRollback` (which the file
already has available) or making the parser refuse any unrecognised statement
that mentions `ceremony`.

**WARNING-5 — The signup requirement binds every environment and is enforced by
nothing outside the local stack.** `dispatch-console/spec.md:11` states the
project MUST refuse self-service signup at `POST /auth/v1/signup`, and lines
15-21 state this binds every environment while conceding the repository can carry
only the local half. That honesty is exactly right and is why this is not a
CRITICAL. But archiving publishes a requirement whose hosted half no command in
this repository can go red on, and the only thing holding it is deferred task
7.4 in a prose section. Before the console is pointed at a hosted project, close
signup there and run the re-aimed invariant. Until then, treat "signup is
closed" as a statement about the local stack only.

**WARNING-6 — Three of the four deferred items are blocked operational work, not
scope that is never needed, and one rests on an unverifiable external claim.**
The Realtime descope is genuinely out of scope (verified above). The other
three — the couple's wedding facts, the deployed-origin `og:image` confirmation,
and the hosted signup closure — are work the product needs before real use, and
they are complete-looking only because they cannot be done from this repository.
The archived record should carry them as an operational checklist, not as
closed scope. Additionally, the `7.2` entry asserts that
`NEXT_PUBLIC_SITE_ORIGIN` is set in Vercel Production; nothing in this repository
can substantiate that, and I did not verify it. Recorded as an unverified claim
rather than accepted or rejected.

**WARNING-7 — One stale path survives in `design.md`.** `design.md:371` reads
`### 2. Body preview — app/console/preview/[invitationId]/page.tsx`; the file is
`app/console/(authenticated)/preview/[invitationId]/page.tsx`. The file table at
`design.md:56` was corrected, so the document now contradicts itself. The URL
path is unaffected (`(authenticated)` is a route group), so the dispatch-console
spec's `/console/preview/[invitationId]` remains correct. Cosmetic for runtime,
material for the archived record.

**WARNING-8 — Work Unit 8 has no TDD cycle evidence table.** 17 of the 18
work-unit sections in `apply-progress.md` carry one; the Console Design
Foundation unit does not. This is not a CRITICAL under this skill's rule (which
fires when apply-progress reports no TDD evidence at all) and TDD was
demonstrably followed in that unit: `tasks.md` 8.1-8.25 are RED/GREEN pairs, and
the unit's own section reports two defects found BY its tests
(`tools/console-one-breakpoint.spec.ts` caught a stray `sm:px-6`,
`e2e/console-design.spec.ts` caught three tabs marked active at once). The
evidence table is what is missing, not the cycle.

**SUGGESTION**

**SUGGESTION-1 — The E2E cookie band's lower bound is looser than its own
rationale.** `e2e/phone-gate.spec.ts:375` admits `daysLeft > 179.99`, which is
864 seconds — 14.4 minutes — of slack, while the comment above it justifies only
whole-second `expires` rounding plus one render and round trip. Either tighten
to a bound the comment supports (`> 179.999` is still far above the real cost) or
widen the comment to state the true tolerance. Detection is unaffected.

**SUGGESTION-2 — The seed parser's comma split is latent and fails safe.**
`ceremony.spec.ts:92-95` splits the column list and the value list on a bare
comma, so a seeded literal containing one — a venue address being the obvious
candidate — would shift every later value by a slot. It is currently
unreachable: the only `INSERT` (`0009_ceremony.sql:65`) seeds four comma-free
placeholders, and the three columns most likely to contain a comma are seeded
via `add column ... default`, which the single-capture regex handles exactly.
And the failure direction is benign: shifted garbage matches neither the
placeholder regex nor the key-set assertion, so the test would go **red**, not
silently green. Worth fixing for maintainability, but strictly less serious than
WARNING-4.

**SUGGESTION-3 — The decoy gate has a timing side channel its own honesty section
does not mention.** `lib/server/decoy-gate.ts` documents the cold-start counter
gap carefully but not this one: a well-formed unknown slug costs one Postgres
query then pure in-memory work, while a real invitation costs that query plus a
`gate_attempts` read and an insert, so the decoy answers measurably faster. The
module's threat model already concedes this class of leak is low-value at 80 bits
of slug entropy; the recommendation is to document it beside the gap already
documented, not to fix it.

**SUGGESTION-4 — The E2E suite leaves seeded `senders` rows behind.** Live count
is 3 after this run. Invitations are cleaned up; operators are not. Harmless, and
now consistent with the amended guest-directory wording, but it means the row
count is test residue rather than product state.

**SUGGESTION-5 — `tasks.md` history still names two superseded paths.**
`tasks.md:36,203,205` name `components/invitation/RsvpForm.tsx` and
`tasks.md:322` names the pre-route-group preview path. Both renames ARE recorded
later in the same file (`5b.10`, `6b-ii.10`), so a reader who finishes the
document is not misled. `design.md` was corrected; `tasks.md` was left as a
historical record, which is a defensible choice — noting it so the decision is
explicit rather than accidental.

**SUGGESTION-6 — `guest-directory` still says "the two senders" in three places
its own amendment disclaims.** The Purpose line 5, the requirement heading at
line 32 and its normative sentence at line 34 all say "the two senders", while
line 23 states that nothing enforces a cardinality of two. The disjointness MUST
at line 34 is satisfied (one NOT NULL FK per invitation), and "two" there reads
as describing the couple rather than asserting a schema guarantee — and the
project's own config rule uses that phrasing. Still, one document now says both
things. A one-line alignment before archive would remove the last place a reader
could take a cardinality guarantee from this spec.

**SUGGESTION-8 — The `htmlLimitedBots` config line has no test that fails when
it is deleted.** `e2e/invitation-page-og.spec.ts > does not stream the tags after
`</head>`` asserts the product outcome and would catch the streaming regression
the line guards against, but on Next 16.3.4 this route does not stream by
default, so removing the line from `next.config.ts` leaves the suite green. The
requirement names the config line explicitly. A cheap direct guard — a
`tools/` test reading `next.config.ts` off disk and asserting the key, in the
style of the existing `tools/console-theme-css.spec.ts` — would close the gap
without pretending the E2E test can do it.

**SUGGESTION-7 — `.env.example` prose could not be checked this run.** The prior
report's SUGGESTION-3 (the file still says "middleware" twice) is neither
confirmed nor refuted here: the file is outside this session's read permissions.
Recorded as unverified rather than carried forward as fact.

### Verdict

**PASS WITH WARNINGS** — archive-ready.

What makes it archive-ready:

- **Every commanded command passes.** `npm test` exit 0 with 1459 passed (was
  exit 1, 1457 passed / 1 failed), `PORT=3100 npm run e2e` 155 passed (was 152),
  and typecheck, lint, format:check and build all exit 0. No flake occurred.
- **Zero CRITICAL findings and zero blockers.** All four prior CRITICAL findings
  are closed, and I verified each against the live stack and the source rather
  than against the tests or comments that claim to cover it: a live 422
  `signup_disabled` plus the GoTrue container environment proving the CLI flag
  mapping the comment asserts; exact-equality and closed-band cookie assertions
  that provably fail in both directions; a migration-seed ceremony assertion with
  a passing negative control and a key-set completeness check; and a
  dispatch-console spec whose requirement now matches the password
  implementation it describes.
- **No capability spec asserts a requirement the implementation does not
  satisfy.** 42/42 requirements and 61/61 scenarios compliant, zero FAILING,
  zero UNTESTED, zero PARTIAL. Three
  spec amendments (phone-gate 180 days, dispatch-console password, guest-directory
  allowlist wording) each carry an explicit supersession paragraph rather than a
  silent edit, which is what makes them safe to publish into `openspec/specs/`.
- **The security posture holds, re-verified live this session**: all 7 owned
  tables RLS-enabled with zero policies, zero grants to `anon`/`authenticated`/
  `PUBLIC` on tables and routines, anon 401 on all 7 tables plus `rsvp_latest`
  plus the import RPC, `rsvp_latest` `security_invoker=true`, append-only by
  trigger on both event tables, seat cap by trigger, no `message` column
  anywhere in `public`, exactly one unlock path in the source, and no probe
  residue in `auth.users`.
- **All 288 tasks are complete, and I judged the four descopes rather than
  accepting them.** The Realtime descope is verified honest: zero mentions of
  Realtime or any synonym in all seven capability specs, and no usage in source.
  The other three are genuinely blocked outside this repository.

Nothing blocks archive. What the eight WARNINGs carry forward is not a
contradiction between code and spec — that class of problem is gone — but three
things the archive should not lose: two defects deliberately handed to the
`invitation-administration` change (WARNING-1, -2), one test-quality hole that
can pass when it should fail (WARNING-4, the `UPDATE`-shaped seed the ceremony
parser cannot see), and the fact that "signup is closed" is proven for the local
stack only, with the hosted half resting on a deferred prose item (WARNING-5,
-6).

I have deliberately not softened two things because a remediation unit just ran:
WARNING-4 is escalated above the advisory grouping it arrived in, because a
false-PASS path and a false-ALARM path are not the same finding; and WARNING-6
records that three "deferred" items are blocked operational work rather than
scope that was never needed, because a reader of the archived record would
otherwise read four descopes as four decisions.
