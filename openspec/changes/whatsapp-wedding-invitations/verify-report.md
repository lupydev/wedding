```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:7e5eea556e9919f2e3b3092bed9f3c7a541d563f54d42889155796c8ae351e91
verdict: fail
blockers: 3
critical_findings: 4
requirements: 38/42
scenarios: 55/60
test_command: npm test
test_exit_code: 1
test_output_hash: sha256:c16923c9a11edb22ef9914a191bde8726a32ae75a04cf7a9ddbf819365b0ca64
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:387fc08ca286985d550f62e9bf70c71175fe56566c437813808dddb1c27206e2
```

## Verification Report

**Change**: whatsapp-wedding-invitations
**Version**: N/A (no version declared in the change artifacts)
**Mode**: Strict TDD (`strict_tdd: true` in `openspec/config.yaml`, runner `npm test`)
**Commit verified**: `542fcf2` on `feat/whatsapp-wedding-invitations`, working tree clean
**Artifacts read**: proposal, 7 capability specs, design, tasks, apply-progress (full spec-driven verification; no dimension skipped)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 292 |
| Tasks complete | 286 |
| Tasks incomplete | 6 |
| Requirements | 42 |
| Scenarios | 60 |

Incomplete tasks: `2.5`, `6b.15`, `6b-ii.14`, `7.1`, `7.2`, `7.3`.

Native `gentle-ai sdd-status` reports `dependencies.verify: blocked` and `taskProgress.allComplete: false`. This report was produced anyway, on explicit orchestrator instruction, so the gaps are named rather than deferred. It is not archive-ready.

### Build & Tests Execution

| Command | Exit | Observed result |
|---------|------|-----------------|
| `npm test` | 1 | 1 failed, 1457 passed (1458 tests); 1 failed file, 88 passed (89 files) |
| `PORT=3100 npm run e2e` | 0 | 152 passed (27.3s) |
| `npm run typecheck` | 0 | `tsc --noEmit`, no output |
| `npm run lint` | 0 | `eslint .`, no output |
| `npm run format:check` | 0 | "All matched files use Prettier code style!" |
| `npm run build` | 0 | Compiled successfully; 13 routes; `Proxy (Middleware)` emitted |

Unit-test counts match the expected 1458 baseline; E2E matches the expected 152. `tools/eslint-zones.spec.ts` did NOT flake in this full run — it passed.

**Tests**: 1457 passed / 1 failed / 0 skipped.

```text
FAIL |unit| supabase/tests/ceremony.spec.ts > the ceremony configuration row >
     seeds clearly-unfinished placeholders rather than invented details
AssertionError: expected { column: 'couple_names', …(1) } to deeply equal { … }
-   "value": StringMatching /^\{\{[A-Z_]+\}\}$/,
+   "value": "Luis & Michell",
  supabase/tests/ceremony.spec.ts:121:46
```

**Coverage**: not run. `@vitest/coverage-v8` and `npm run test:coverage` exist, but the declared `verify.test_command` is `npm test`; coverage is informational and was not part of the commanded evidence set.

### Spec Compliance Matrix

Compliance is judged against the CODE, with a passing covering test as the runtime evidence. Where a test passes but could not have failed, that is recorded.

#### project-scaffold — 4/5 scenarios

| Requirement | Scenario | Test / evidence | Result |
|---|---|---|---|
| Next.js App Router baseline | Scaffold produces a runnable dev server | `npm run build` exit 0, `npm run typecheck` exit 0 | COMPLIANT |
| Streaming metadata disabled | Metadata is never streamed | `e2e/invitation-page-og.spec.ts > does not stream the tags after </head>` | PARTIAL |
| Absolute metadata URLs | OG image URL is absolute | `e2e/invitation-page-og.spec.ts > emits an absolute https og:image on the deployed origin` | COMPLIANT |
| Test harnesses installed | Test commands are runnable | Verified directly: `vitest run` with a zero-match filter printed "No test files found, exiting with code 0" | COMPLIANT |
| Strict TDD enabled by this change | strict_tdd reflects a runnable command | `openspec/config.yaml` has `strict_tdd: true` and `test_command: "npm test"`, but `npm test` exits 1 | FAILING |

PARTIAL on streaming metadata: `next.config.ts` does set `htmlLimitedBots: /.*/`, and the outcome is asserted against raw HTML. But the test's own comment records that the suite was re-run with `htmlLimitedBots` REMOVED and every test still passed. The covering test therefore proves the product outcome and cannot fail on the mechanism the requirement names. The file states this honestly; it is recorded here because the requirement is written about the config line, not only the outcome.

#### invitation-domain — 8/8 scenarios COMPLIANT

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

`SLUG_BYTE_LENGTH = 10` → 80 bits, above the required 64. Slug regex `^[a-z2-7]{16}$` enforced by a DB CHECK; `id` is a `uuid` and is never encoded into the slug.

#### guest-directory — 6/6 scenarios COMPLIANT

| Requirement | Scenario | Evidence |
|---|---|---|
| Household-as-invitation model | One link serves multiple guests | `lib/server/invitations.spec.ts`; `invitations 1—N invitation_guests` |
| Sender ownership mandatory | Import assigns an owner to every invitation | `lib/server/invitations.spec.ts > validateImportRow — sender ownership is mandatory`; `owner_sender_id uuid NOT NULL references senders(id)` |
| Two senders, disjoint subsets | Ownership partitions the guest list | Structural: one NOT NULL FK per invitation; `e2e/console-guest-list.spec.ts > the partitioned guest list` |
| Seat allowance per invitation | Seats allowed is always positive | `lib/server/invitations.spec.ts > rejects a seats_allowed of zero`; DB `check (seats_allowed between 1 and 12)` |
| Guest phones stay server-side | Guest-facing response omits phone numbers | `e2e/invitation-page-og.spec.ts > never puts a guest phone number in the invitation page source` asserts raw HTML against 6 digit forms including the last-8 |
| Import from an untracked source | No real phone number enters the repository | `/data/` git-ignored and untracked; full-history search found only fabricated fixtures (`+5730055500xx`, `+573001234567`, `+525512345678`) |

#### invitation-page — 7/7 scenarios COMPLIANT

| Requirement | Scenario | Test |
|---|---|---|
| Server-rendered per-guest OG metadata | OG tags under a WhatsApp UA | `e2e/invitation-page-og.spec.ts` |
| Server-rendered per-guest OG metadata | OG tags under an ordinary browser UA | `e2e/invitation-page-og.spec.ts` |
| OG card content is names-only | Card omits private details | `lib/domain/og-card.spec.ts`; `OgCardSource` is a two-field projection with no date/venue/phone to forget |
| OG image renders accents and enye | Name renders without corruption | `tools/og-font-coverage.spec.ts` (cmap glyph-id check with a CJK negative control) + `e2e > renders visibly different pixels for the accented and unaccented name` |
| Invalid or rotated slug | Unknown slug handled gracefully | `e2e > shows a friendly contact page instead of a raw 404` |
| Invalid or rotated slug | Unknown-slug vs wrong-phone shape-identical | `e2e/phone-gate.spec.ts > an unknown slug compared with a wrong phone` (2 tests) |
| Absolute OG image URL | og:image is absolute | `e2e > emits an absolute https og:image on the deployed origin` |

All OG assertions read the RAW response body through Playwright's `request` fixture, never a hydrated DOM. The per-guest `og:title` and `og:image` are confirmed inside `<head>` of the first HTML response, and confirmed ABSENT after `</head>`.

#### phone-gate — 7/8 scenarios (1 FAILING)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Last-8-digit any-guest match | Any guest's number unlocks | `e2e/phone-gate.spec.ts`, `lib/domain/phone.spec.ts` | COMPLIANT |
| Last-8-digit any-guest match | A near-miss does not unlock | `e2e/phone-gate.spec.ts` | COMPLIANT |
| Wrong phone reveals nothing | No content or digits leak on failure | `e2e/phone-gate.spec.ts > neither response discloses a guest name or a stored digit` | COMPLIANT |
| Rate limiting is DB-backed | Repeated failures trigger lockout | `e2e > refuses the 9th attempt after 8 failures inside 15 minutes`, `> persists across a separate browser context and request`; `gate_attempts` table | COMPLIANT |
| Exactly one unlock path | No query parameter bypasses | `e2e/phone-gate.spec.ts > exactly one unlock path` (5 parameterized cases) | COMPLIANT |
| Exactly one unlock path | An authenticated admin session does not bypass | `e2e/console-guest-list.spec.ts > the console never becomes a way past the guest gate` (2 tests, signed in as operator Ana) | COMPLIANT |
| Unlock cookie persists the session | Repeat visit skips the gate | `e2e > lets a return visit skip the gate entirely` | FAILING |
| Recovery path to the owning sender | Recovery link targets the correct owner | `e2e > offers a wa.me link addressed to the OWNING sender`, `> addresses a different invitation's own owner` | COMPLIANT |

FAILING on the unlock cookie: the behavioural half passes, but the requirement states the cookie is "valid for 30 days" and the code sets `UNLOCK_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60` — 180 days, a 6x extension of an access credential's lifetime. The E2E test was written to the code, not the spec: `e2e/phone-gate.spec.ts > outlives a month, because the wedding is further away than that` asserts `daysLeft > 90`, which a spec-conformant 30-day cookie would FAIL. The spec, `design.md:286` and `tasks.md:169` all still say 30 days. See CRITICAL-2.

**Exactly one unlock path — verified against the code, not only the tests.** `app/i/[slug]/page.tsx` reads exactly one piece of unlock state (`cookies().get(UNLOCK_COOKIE_NAME)`, cross-checked against `record.id`). `signUnlockCookie` has exactly one production caller: `unlockAction` in `app/i/[slug]/actions.ts`, reached only after `attemptUnlock` returns `unlocked`. `proxy.ts` matches `/console/:path*` only, so no operator session is even resolved on the guest route. Confirmed by exhaustive grep across non-test sources.

#### rsvp — 12/13 scenarios (1 FAILING)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| RSVP requires an unlocked session | Unauthorized submission rejected | `e2e/rsvp.spec.ts > refuses a submission once the unlock cookie is gone`; `lib/server/rsvp.ts` verifies the signed cookie server-side | COMPLIANT |
| Seat allowance is a hard cap | Form does not offer over-cap selection | `e2e > offers no way to select a fourth person` | COMPLIANT |
| Seat allowance is a hard cap | Server rejects a tampered over-cap submission | `e2e > refuses a tampered over-cap submission server-side`; trigger `rsvp_seat_cap` verified live | COMPLIANT |
| Append-only history, latest wins | A changed answer is recorded, not overwritten | `e2e > keeps both answers when the household changes its mind`; `rsvp_responses_append_only` trigger verified live | COMPLIANT |
| Optional extra fields | Submission without the optional field succeeds | `lib/server/rsvp.spec.ts` | COMPLIANT |
| Optional extra fields | A message field is neither offered nor accepted | `lib/server/rsvp.spec.ts > has no message field at all, and ignores one a payload invents` asserts the exact inserted key set; live DB confirms no `message` column anywhere in `public` | COMPLIANT |
| Declining shows the ceremony stream | Declining submits on the first tap | `e2e > records the decline on the first tap, with no second click` | COMPLIANT |
| Declining shows the ceremony stream | The stream replaces the form | `e2e > shows the stream details instead of the form` | COMPLIANT |
| Declining shows the ceremony stream | A decline can be corrected | `e2e > lets a declined household come back and accept after all` | COMPLIANT |
| Declining shows the ceremony stream | A refused decline does not reveal the stream | `components/invitation/RsvpAnswer.spec.tsx` | COMPLIANT |
| Ceremony row is default-deny | The publishable key reaches no ceremony value | `e2e/invariants/rls.spec.ts` + live probe: anon 401, authenticated 403 on select/insert/update/delete | COMPLIANT |
| Deadline behavior | Form replaced after the deadline | `e2e > shows a contact message instead of the form once it has passed` | COMPLIANT |
| Deadline behavior | Form available before the deadline | `e2e > accepts an answer on the deadline day itself`, `> …no deadline at all` | COMPLIANT |

The "visibly unfinished placeholders" clause of the ceremony requirement is currently violated in the live database and is what breaks `npm test`. See CRITICAL-1.

**`rsvp_latest` verified against the live database, not the migration text:**
`select relname, reloptions from pg_class where relname='rsvp_latest'` → `["security_invoker=true"]`. The definition is `distinct on (invitation_id) … order by invitation_id, submitted_at desc, id desc`, which reduces to exactly one row per invitation with a total ordering. Migration 0010 recreated it after dropping `message` and preserved both properties. `lib/server/invitations.ts` reads `rsvp_latest` and never `rsvp_responses` for current state.

**Append-only verified against `service_role`, by trigger not policy:**
Live `pg_trigger` shows `BEFORE DELETE OR UPDATE … FOR EACH ROW EXECUTE FUNCTION reject_mutation()` on both `rsvp_responses` and `dispatch_events`. `reject_mutation` raises unconditionally except for a cascading delete, which it detects by the parent row already being absent from the transaction snapshot — a fact about the transaction, not a `pg_trigger_depth()` heuristic. A trigger binds `service_role` because `BYPASSRLS` does not bypass triggers. Correct, and correct for the stated reason.

**The anon key reaches nothing — verified by live probe, not by reading the tests:**
All 7 owned tables show `relrowsecurity = true` with `0` policies. `information_schema.role_table_grants` and `role_routine_grants` return ZERO rows for `anon`, `authenticated` and `PUBLIC` in `public`. Direct PostgREST probes: `anon` → 401 on `invitations`, `senders`, `ceremony`, `rsvp_latest` and on `rpc/import_invitations`. A fully-authenticated JWT → 403 on all seven tables and on the view.

#### dispatch-console — 11/13 scenarios (2 FAILING)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Operator authentication via magic link | Unallowlisted email cannot access | `lib/server/auth.spec.ts`, `e2e/console-auth.spec.ts` — but against PASSWORD auth | FAILING |
| Operator authentication via magic link | Allowlisted sender reaches their dashboard | `e2e/console-auth.spec.ts` — but against PASSWORD auth | FAILING |
| Guest list partitioned by ownership | Sender's default view shows only owned | `e2e/console-guest-list.spec.ts`; partition applied as a `WHERE` in `listConsoleInvitations` | COMPLIANT |
| Guest list partitioned by ownership | Shared progress dashboard visible to both | `e2e > the shared dashboard covers both partitions` | COMPLIANT |
| No send affordance for non-owned | Non-owner sees no send button | `e2e > …offers no send button on the other's rows` | COMPLIANT |
| Per-device WhatsApp declaration | Declaration mismatch blocks dispatch | `e2e/console-dispatch.spec.ts > the device declaration gate` | COMPLIANT |
| Per-device WhatsApp declaration | Declaration match allows dispatch | `e2e > restores the dispatch once the declaration agrees again` | COMPLIANT |
| wa.me link preparation, never auto-send | Dispatch opens WhatsApp for a human | `e2e/console-dispatch.spec.ts`; no server-side send exists anywhere in the codebase | COMPLIANT |
| Append-only dispatch events | Every dispatch produces an event row | `e2e/console-preview.spec.ts > the dispatch log keeps the actor and the owner apart` | COMPLIANT |
| Append-only dispatch events | Actor/owner mismatch recorded, not dropped | `lib/server/dispatch.spec.ts > stores an actor who is not the owner`; `e2e > records a link_opened attributed to the session, not to the owner` | COMPLIANT |
| Message preview via the real OG endpoint | Preview image matches the dispatched card | `e2e/console-preview.spec.ts > serves bytes identical to a direct fetch of the card route` (real `Buffer.equals`) + `> adds no cache-busting parameter` | COMPLIANT |
| Body preview on a separate admin-only route | Admin preview renders the same body component | `e2e/console-preview.spec.ts`; both routes render `components/invitation/InvitationBody` from the same `toGuestFacingInvitation` projection | COMPLIANT |
| Body preview on a separate admin-only route | Admin preview requires console authentication | `requireOperator()` called in the `(authenticated)` layout AND again in the page itself | COMPLIANT |

FAILING on operator authentication: the two scenarios' outcomes hold, but the requirement's normative mechanism does not exist. See CRITICAL-3.

**Compliance summary**: 55/60 scenarios compliant, 4 FAILING, 1 PARTIAL.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Exactly one unlock path on `/i/[slug]` | Implemented | Verified by exhaustive grep: one reader, one minter, no operator session on the route |
| No guest phone digits in guest-facing source | Implemented | `toGuestFacingInvitation` is a projection with no phone field; raw-HTML E2E assertion over 6 digit forms |
| `rsvp_latest` one row per invitation + `security_invoker` | Implemented | Verified live in `pg_class.reloptions` |
| Append-only against `service_role`, by trigger | Implemented | Verified live in `pg_trigger` |
| The anon key reaches nothing | Implemented | Verified live: zero grants, RLS default-deny, 401/403 probes |
| Per-guest OG tags in `<head>` of first response | Implemented | Verified against raw HTML for both UA classes |
| Gate refusals indistinguishable | Implemented, with a residual gap | See SUGGESTION-1 |
| Operator sign-in's three refusals indistinguishable | Implemented | One constant `SIGN_IN_NOTICE`; password verified FIRST; the session a valid non-operator obtains is destroyed by `signOut()` before returning |
| Unlock cookie lifetime | Deviates | 180 days in code vs 30 days in spec, design and tasks |
| Operator authentication mechanism | Deviates | Password vs magic link in spec, design and proposal |
| Exactly two senders | Not enforced | See WARNING-4 |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1 direct `libphonenumber-js` import in domain | Yes | `lib/domain/phone.ts` |
| D2 randomness and clock as arguments | Yes | `encodeSlug(bytes)`, `evaluateGate(ctx, now)`, `attemptUnlock({now})` |
| D3 two normalization strictnesses | Yes | `normalizeForStorage` (throws) and `deriveGateKey` (lenient) both present |
| D4 80-bit slug | Yes | `SLUG_BYTE_LENGTH = 10`; DB CHECK `^[a-z2-7]{16}$` |
| D5 append-only by trigger, not RLS | Yes | Verified live |
| D6 seat cap at three layers | Yes | `enforce_seat_cap` trigger + `lib/domain/seats.ts` + server-action re-validation |
| D7 `senders` IS the allowlist | Yes | No `OPERATOR_EMAILS` variable exists |
| D8 beacon via plain route handler | Yes | `app/console/api/dispatch-event/route.ts`, 204, idempotent on `client_event_id`, 401 when unauthenticated |
| D9 runtime `next/og` + server-side warm | Yes | `lib/server/og-warm.ts`; card is `public, immutable, max-age=31536000` |
| D10 unknown slug differs from wrong phone | Yes | Friendly page vs gate error, as designed |
| Magic-link entry and exchange (`design.md:52`) | No | Superseded by password auth in WU7a; design never amended |
| `app/console/layout.tsx` (`design.md:51`) | No | Route group `app/console/(authenticated)/layout.tsx` |
| Unlock cookie `maxAge: 30d` (`design.md:286`) | No | 180 days |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | 16 "TDD Cycle Evidence" tables across 17 work units |
| All tasks have tests | Yes | The one unit without a table is the scaffold batch, which legitimately predates `strict_tdd: true` and documents that under "Why this batch is not Strict TDD" |
| RED confirmed (test files exist) | Yes | Every test file named in the tables exists on disk |
| GREEN confirmed (tests pass now) | Partial | 1457/1458 pass; the one failure is `supabase/tests/ceremony.spec.ts`, which was green when written and is now red because the product mutated the row it asserts on |
| Triangulation adequate | Yes | Spot-checked: 5 query-parameter cases for the one-unlock-path scenario, 10,000 samples for slug uniqueness, accented/unaccented control pair for the OG card, CJK negative control for the font cmap |
| Safety Net for modified files | Yes | Full-suite runs recorded per unit in apply-progress |

**TDD Compliance**: 5/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit (domain, server, tools, scripts) + DB-integration | 1458 total across both vitest projects | 89 | Vitest 5, `pg` against real local Postgres |
| Component (jsdom) | included in the 1458 | included in the 89 | Testing Library + jsdom |
| E2E | 152 | 12 | Playwright 1.63 against a PRODUCTION build |
| **Total** | **1610** | **101** | |

The DB suites connect to a real local Supabase and fail loudly rather than skipping when it is unreachable — verified by reading `supabase/tests/helpers/db.ts`, which re-throws with an actionable message instead of calling `it.skip`.

### Changed File Coverage

Coverage analysis skipped — `npm run test:coverage` was not part of the commanded evidence set, and coverage is informational rather than blocking under this skill's rules.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|---|---|---|---|---|
| — | — | — | No tautology, no `.only`, no `.skip`, no `.todo` anywhere in 101 test files | — |

**Assertion quality**: All assertions verify real behaviour. Specific strengths found:
- `e2e/invitation-page-og.spec.ts` asserts on the raw response body, never a hydrated DOM, and strips `<script>` only where the assertion is about what a human sees — never where it is about a data leak.
- `tools/og-font-coverage.spec.ts` carries a negative control (a CJK codepoint the font genuinely lacks), so a parser that always reported a glyph would be caught.
- `e2e/console-preview.spec.ts` compares real image bytes with `Buffer.equals`, not lengths.
- `lib/server/rsvp.spec.ts` asserts the exact key set of the inserted row, so a re-added `message` column would fail.

Two tests are noted as weaker than they read, and both are recorded elsewhere in this report rather than here: the `htmlLimitedBots` test (PARTIAL, above) and `e2e/phone-gate.spec.ts > outlives a month` (which encodes the 180-day deviation, CRITICAL-2).

### Quality Metrics

**Linter**: No errors (`eslint .`, exit 0).
**Type Checker**: No errors (`tsc --noEmit`, exit 0).
**Formatter**: Clean (`prettier --check .`, exit 0).

### Known Open Items — Confirmed or Corrected

| Item | Reported state | Verified state |
|---|---|---|
| `2.5` `.env.example` half | PARTIAL, blocked by permissions | **CORRECTED — complete.** `.env.example` exists, is git-tracked (first added in `6f1a440`), and documents `DEFAULT_PHONE_COUNTRY` with the no-fallback rationale. All 8 variables `lib/server/env.ts` reads are documented. The task remains unchecked in `tasks.md`; only the checkbox is stale. |
| `4b.12` console-operator half | PARTIAL, untestable then | **CORRECTED — complete.** `e2e/console-guest-list.spec.ts:388-416` covers it with a genuinely signed-in operator (`signInAsOperator(page, ana)` at line 97), across 4 query parameters. Both tests passed. Only the task's annotation text is stale. |
| `6b.15` Supabase Realtime | Never built | **CONFIRMED.** No `realtime`, `.channel(` or `postgres_changes` usage anywhere in source. Tracked by `6b.15` and `6b-ii.14`, both unchecked. |
| `R3-create-compensation-unverified` | Open | **CONFIRMED OPEN**, and worse than reported — see WARNING-1. |
| `R3-import-row-shape-unvalidated` | Open | **CONFIRMED OPEN** with new reproduction evidence — see WARNING-2. |
| `R3-test-key-resolution-order-dependent` | Open | **CONFIRMED OPEN** — see WARNING-3. |
| WU6b-ii SUGGESTION-level findings | Unaddressed | **CONFIRMED** still unaddressed; none is behaviour-affecting. |
| `supabase/config.toml` `enable_signup = true` | Unneeded | **CONFIRMED, and demonstrated exploitable** — see CRITICAL-4. |

### Issues Found

**CRITICAL**

**CRITICAL-1 — A shipped unit test is coupled to mutable product state, and is red right now.**
`supabase/tests/ceremony.spec.ts > seeds clearly-unfinished placeholders rather than invented details` reads the LIVE singleton `ceremony` row and asserts every column matches `/^\{\{[A-Z_]+\}\}$/`. Work Unit 9 shipped `/console/wedding`, whose entire purpose is to replace those placeholders. The live row now holds `couple_names = "Luis & Michell"`, so the suite is red. This is not a flake and not an environment problem: the test cannot survive the feature that shipped alongside it. It is the only red test, and it takes `npm test` — the declared `verify.test_command` — to exit 1, which in turn breaks the project-scaffold requirement that the command "executes successfully". Either the assertion must move to a rolled-back fixture row (the file already has `withRollback` available and uses it elsewhere) or the placeholder rule must be re-expressed as a migration-seed assertion rather than a live-state assertion.

**CRITICAL-2 — The unlock cookie lives 180 days where the spec requires 30, and the test encodes the deviation.**
`lib/server/cookies.ts:35` sets `UNLOCK_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60`. `specs/phone-gate/spec.md:64` requires "valid for 30 days"; `design.md:286` says `maxAge: 30d`; `tasks.md:169` says `maxAge: 30 days`, and that task is checked. This is a 6x extension of an access credential's lifetime made in code with a good in-file rationale and no spec amendment anywhere. The covering E2E test `e2e/phone-gate.spec.ts > outlives a month, because the wedding is further away than that` asserts `daysLeft > 90` — it was written to the implementation, so a spec-conformant 30-day cookie would FAIL this suite. This is the clearest instance in the change of a test that cannot detect the divergence it sits next to. Resolve by amending the phone-gate spec the way the RSVP spec was amended for the message field (with an explicit supersession paragraph), or by changing the code back to 30 days.

**CRITICAL-3 — The dispatch-console spec requires magic-link sign-in; the product has password sign-in.**
`specs/dispatch-console/spec.md:11` states "Console access MUST require Supabase Auth magic-link sign-in". `lib/server/auth.ts` implements `signInWithPassword`, and `app/console/auth/callback/route.ts` — the magic-link exchange named in `design.md:52` and in checked tasks `6a-i.7`, `6a.3` — does not exist. Work Unit 7a made this change deliberately and documented it well in `tasks.md:362,365` and in apply-progress. What was never done is the spec delta. The RSVP spec shows this project knows how to do it properly: its "Optional extra fields" requirement carries an explicit "This supersedes the original A8 decision" paragraph. The dispatch-console spec got no such treatment, so archiving this change would publish a capability spec into `openspec/specs/` asserting an authentication mechanism the product does not have. The two scenarios' OUTCOMES still hold, which is exactly why this survived: the tests assert allowlist behaviour, not the mechanism the requirement names.

**CRITICAL-4 — Open self-service signup on the Supabase project, demonstrated.**
`supabase/config.toml:186,231` set `enable_signup = true` with `enable_confirmations = false`. `SUPABASE_PUBLISHABLE_KEY` is, by design, in the browser. I confirmed by direct probe against the running instance that a stranger holding only that key can `POST /auth/v1/signup` and receive a full `authenticated` JWT for an arbitrary address. No product flow needs this: `lib/server/auth.ts` uses only `signInWithPassword`, and operator accounts are created out of band by `scripts/seed-operators.ts`. The code comment at `lib/server/auth.ts:164` reads "a stranger cannot make an `auth.users` row appear by typing into this form" — true of the form, and false of the project, because the endpoint is open independently of the form. Blast radius is bounded, and I verified that too: the resulting `authenticated` role gets 403 on all seven tables and on `rsvp_latest`. The exposure is unauthenticated `auth.users` growth, mailbox traffic and an unnecessary attack surface on a project whose entire authorization posture is "no untrusted identity exists". Set `enable_signup = false` in both blocks. (Probe user was deleted; `auth.users` left as found.)

**WARNING**

**WARNING-1 — `createInvitation`'s compensation path is untested AND its own failure is unchecked.** `lib/server/invitations.ts:398` deletes the invitation when the guest insert fails, but discards the delete's result, so a failing compensation silently leaves a guestless invitation that can never be unlocked by anybody and looks valid in the console. Neither of the two covering tests reaches the branch: the happy path succeeds, and `refuses to create an invitation whose owner does not exist` fails at the INVITATION insert, before any guest insert is attempted. The compensation is dead code as far as the suite is concerned. (`importInvitations` is the production path and IS atomic via the SQL function, which limits real exposure — but `createInvitation` remains exported and callable.)

**WARNING-2 — Import row shape is an unchecked cast, and the failure is a `TypeError`, not the loud domain error the design promises.** `scripts/import-guests.ts:101` does `return invitations as ImportRow[]` after validating only that the array exists and is non-empty. I reproduced both halves directly:
- `parseGuestSource('{"invitations":[{"nonsense":true},42,null]}')` returns `[{nonsense:true}, 42, null]` with no complaint.
- `validateImportRow` on a row missing `guests` throws `TypeError: Cannot read properties of undefined (reading 'length')` — naming no row, no field and no file, against a requirement whose whole point is that "an unusable owner or an unnormalizable phone must stop the import at the row that introduced it". `zod@^4.6.1` is already a dependency and is not used here.

**WARNING-3 — DB test key resolution is order-dependent.** `supabase/tests/helpers/local-keys.ts` caches module-level, and individual `it` bodies mutate `process.env.SUPABASE_URL` / `SUPABASE_SECRET_KEY` inline (for example `lib/server/invitations.spec.ts:305,316`). Tests that mutate shared process state inside test bodies pass in the current order and are not guaranteed to under `--shuffle`, `--no-isolate`, or a future file split.

**WARNING-4 — "Exactly two senders" is enforced by nothing.** `guest-directory` requires `owner_sender_id` to be "one of exactly two sender identities" and `dispatch-console` requires "a two-email allowlist". The `senders` table has no cardinality constraint and its `role` CHECK admits a third value, `helper`. The live database currently holds 3 sender rows (E2E seeds). The invariant lives only in prose and in operational discipline. Either constrain it or soften the spec wording to "the allowlisted senders".

**WARNING-5 — `design.md` is stale in five places that a reader would act on.** None affects runtime, all affect the archived record:
| `design.md` says | Reality |
|---|---|
| `app/console/layout.tsx` (:51) | `app/console/(authenticated)/layout.tsx` |
| `app/console/page.tsx` (:53) | `app/console/(authenticated)/page.tsx` |
| `app/console/dispatch/[invitationId]/page.tsx` (:55) | `app/console/(authenticated)/dispatch/[invitationId]/page.tsx` |
| `app/console/preview/[invitationId]/page.tsx` (:56) | `app/console/(authenticated)/preview/[invitationId]/page.tsx` |
| `app/console/auth/callback/route.ts` (:52), "Magic-link entry and exchange" | Does not exist; replaced by `app/console/login/actions.ts` |
The URL paths are unchanged — `(authenticated)` is a route group — so the dispatch-console spec's `/console/preview/[invitationId]` is still correct. `design.md` also has no entry at all for `proxy.ts` / `lib/proxy/operator-session.ts`, so the session-refresh mechanism that Work Unit 6a-i added is absent from the design record. Note for the record: `tasks.md` is NOT stale on this point — task `6a-i.6` already names `proxy.ts` and explains the Next 16.3 rename. The remaining `middleware` wording is in `.env.example` prose (two places) and in `design.md` by omission.

**WARNING-6 — `components/invitation/RsvpForm.tsx` in `design.md:59,390` and `tasks.md:36,203,205`.** Renamed to `RsvpAnswer.tsx`; the rename IS recorded in `tasks.md:220` and apply-progress, but the earlier checked tasks still name the old file.

**WARNING-7 — Six tasks are unchecked, and native status therefore blocks verify.** `2.5` and `4b.12` are stale annotations over completed work (see the table above). `7.2` (`NEXT_PUBLIC_SITE_ORIGIN` before first deploy) and `7.3` (OG font choice) are deploy-time items. `7.1` genuinely blocks the product: the live `ceremony` row still holds `{{CEREMONY_DATE}}`, `{{CEREMONY_TIME}}`, `{{ZOOM_MEETING_ID}}`, `{{ZOOM_PASSCODE}}`, `{{VENUE_NAME}}` and `{{VENUE_ADDRESS}}`. `6b.15`/`6b-ii.14` (Realtime) are deferred scope. Archive cannot proceed while any remain unchecked.

**SUGGESTION**

**SUGGESTION-1 — The decoy gate has a timing side channel its own honesty section does not mention.** `lib/server/decoy-gate.ts` documents its residual gap carefully (in-memory counters reset on a cold start where a real invitation's Postgres counter does not). It does not mention the other one: a well-formed unknown slug costs ONE Postgres query (`findInvitationBySlug`) and then pure in-memory work, while a real invitation costs that query plus a `gate_attempts` read and an insert. The decoy answers measurably faster. The module's threat model already concedes this class of leak is low-value at 80 bits of slug entropy, so the recommendation is to document it beside the gap already documented, not to fix it.

**SUGGESTION-2 — The forwarded operator identity token has no expiry, nonce or path binding.** `signOperatorIdentity` signs `{authUserId, email}` and nothing else, so a captured `x-operator-identity` value is valid forever. `proxy.ts` unconditionally deletes the header on every `/console/*` request, which is the real defence, and capture would require a position inside the server infrastructure. Adding an `exp` would make the token safe on its own terms, which is what the module's own docstring claims for it.

**SUGGESTION-3 — `.env.example` prose still says "middleware" twice.** Cosmetic, but it is the file a new maintainer reads first.

**SUGGESTION-4 — The spec text "no cache-busting parameter" is imprecise, though the behaviour is right.** `specs/dispatch-console/spec.md:95` reads as "no query string"; the implementation deliberately uses Next.js's own build-scoped hash query (`?88f8dd53`) because that is the exact URL the crawler fetches and a CDN keys on the full URL. The implementation is better than the literal spec, and `e2e/console-preview.spec.ts` correctly distinguishes a build hash from a cache buster in two separate tests. Worth a one-line spec clarification before archive.

**SUGGESTION-5 — The E2E suite leaves seeded `senders` rows behind.** Three rows present after the run. Invitations are cleaned up; operators are not.

### Verdict

**FAIL** — `npm test` exits 1 on a test coupled to mutable product state, six tasks are unchecked with native status reporting `verify: blocked`, and three capability specs (`phone-gate`, `dispatch-console`, `project-scaffold`) assert requirements the implementation deliberately superseded without ever amending the spec, so archiving would publish four incorrect requirement statements into `openspec/specs/`.

The engineering underneath is strong and the security claims hold: I verified exactly-one-unlock-path, no-phone-digits-in-page-source, `rsvp_latest` reduction plus `security_invoker`, trigger-based append-only against `service_role`, and the anon key reaching nothing — each against the live database and the source, not against the tests that claim to cover them. What fails here is bookkeeping between the code and its own specification, plus one open signup endpoint that nothing in the product needs.
