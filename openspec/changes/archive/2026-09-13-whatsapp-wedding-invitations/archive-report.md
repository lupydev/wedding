# Archive Report: whatsapp-wedding-invitations

**Change**: whatsapp-wedding-invitations  
**Archive Date**: 2026-09-13  
**Archive Path**: `openspec/changes/archive/2026-09-13-whatsapp-wedding-invitations/`  
**Artifact Store**: hybrid (OpenSpec + Engram)  
**Status**: COMPLETE — Archive-ready with advisory warnings recorded  

---

## Executive Summary

The `whatsapp-wedding-invitations` change has been successfully planned, implemented, verified, and archived. Seven capability specs have been merged into `openspec/specs/`, the change folder moved to archive, and all 288 implementation tasks completed. Verification returned **PASS WITH WARNINGS** (0 CRITICAL, 8 WARNINGS, 8 SUGGESTIONS); all warnings have been reviewed and are either carried forward to dependent work or documented as advisory findings. The change is closed and ready for the next change.

---

## Artifact Archive Completion

### Specs Merged

All seven delta specs from the change have been mechanically copied into the main spec directory. Supersession paragraphs were preserved verbatim in three specs to document changes from prior reasoning:

| Domain | Spec | Status | Supersession Paragraph |
|--------|------|--------|------------------------|
| dispatch-console | spec.md | Created | "Operator authentication by email and password" (line 9-13) — mechanism changed from magic-link to password; authority (`senders` allowlist) unchanged |
| guest-directory | spec.md | Created | "Two senders, disjoint subsets" (line 21-23) — explicitly narrows from "exactly two senders" to "allowlisted senders"; no cardinality constraint in schema |
| invitation-domain | spec.md | Created | N/A — no supersession |
| invitation-page | spec.md | Created | N/A — no supersession |
| phone-gate | spec.md | Created | "Unlock cookie persists the session" (line 64-66) — expires after 180 days (was 30 days in prior reasoning) |
| project-scaffold | spec.md | Created | N/A — no supersession |
| rsvp | spec.md | Created | N/A — no supersession |

All specs are now the source of truth in `openspec/specs/{domain}/spec.md`. Future changes baseline against these published specs.

### Change Folder Moved

- **Source**: `openspec/changes/whatsapp-wedding-invitations/`
- **Destination**: `openspec/changes/archive/2026-09-13-whatsapp-wedding-invitations/`
- **Method**: `git mv` (mechanical, with pre-move snapshot verification)
- **Contents**: proposal.md, design.md, tasks.md, verify-report.md, apply-progress.md, specs/ (7 domains)

All artifacts are intact in the archive location.

---

## Task Completion Status

| Metric | Value |
|--------|-------|
| Tasks Total | 288 |
| Tasks Complete | 288 |
| Tasks Incomplete | 0 |
| Requirements (42 specs, 7 domains) | 42/42 Satisfied |
| Scenarios (across all specs) | 61/61 Compliant |

### Completed Work Units

- ✓ WU1: Scaffold + Strict TDD
- ✓ WU2: Pure Domain Functions
- ✓ WU2b: Domain Corrections
- ✓ WU3: Supabase Schema, RLS, Triggers
- ✓ WU4a: Invitation Page + OG Image
- ✓ WU4b: Phone Gate
- ✓ WU5: RSVP Form
- ✓ WU6a: Console Auth
- ✓ WU6b: Dispatch + Previews
- ✓ WU7: Operator Features
- ✓ WU8: Accessibility & Hardening
- ✓ WU9: Polish & Final Review
- ✓ WU10: Remediation (closed all 4 CRITICAL findings)

---

## Verification Verdict

**Result**: PASS WITH WARNINGS (from commit `37278ed`)

| Category | Count | Status |
|----------|-------|--------|
| CRITICAL Findings | 0 | ✓ All closed |
| WARNING Findings | 8 | Recorded below |
| SUGGESTION Findings | 8 | Recorded below |

### Test Execution (Final)

| Command | Exit | Result |
|---------|------|--------|
| `npm test` | 0 | 1459 passed / 0 failed / 0 skipped |
| `PORT=3100 npm run e2e` | 0 | 155 passed |
| `npm run typecheck` | 0 | No errors |
| `npm run lint` | 0 | No errors |
| `npm run format:check` | 0 | All files formatted |
| `npm run build` | 0 | Production build successful |

**Compliance**: 42/42 requirements satisfied; 61/61 scenarios compliant; 0 FAILING, 0 PARTIAL, 0 UNTESTED.

---

## Known-Open Advisory Findings

These items were intentionally left open by the verification review and are expected. They do not block archive but must be tracked for future work:

### Level: WARNING

**WARNING-1 — `createInvitation` compensation discards the delete's result and is unreachable by suite**  
- **File**: `lib/server/invitations.ts:398`  
- **Issue**: Result of `.delete()` is never inspected; a failed deletion silently leaves a guestless invitation
- **Exposure**: Limited by atomic import path via SQL function; `createInvitation` remains exported
- **Carried To**: `invitation-administration` change (code rewrite)  
- **Action**: Will be fixed in the next change

**WARNING-2 — Import row shape is an unchecked cast whose failure is bare `TypeError`**  
- **File**: `scripts/import-guests.ts:101`  
- **Issue**: `return invitations as ImportRow[]` after only existence/emptiness check; failure names no row, field, or file
- **Solution**: Use `zod` validation (already a dependency)  
- **Carried To**: `invitation-administration` change  
- **Action**: Will be fixed in the next change

**WARNING-3 — DB test key resolution is order-dependent; credential leaks on failure**  
- **File**: `supabase/tests/helpers/local-keys.ts:15` + 20 inline `process.env` assignments  
- **Issue**: Module-level cache + inline assignments; passing in current order, not guaranteed under `--shuffle` or `--no-isolate`; error interpolates password  
- **Default**: Well-known local credential; overridable via `SUPABASE_DB_URL`  
- **Severity**: Latent test-order issue; affects CI logs only in non-default configurations

**WARNING-4 — Ceremony migration-seed parser is blind to `UPDATE` seeding (CRITICAL LIMITATION)**  
- **File**: `supabase/tests/ceremony.spec.ts`  
- **Issue**: Parser recognizes `insert into ceremony (...)` and `add column ... not null default` but NOT `update ceremony set ...`  
- **Proof**: Appending `update ceremony set ceremony_date = 'sábado 14 de noviembre...' where id;` to migration 0009 leaves 29 tests **passing** with fabricated date  
- **Impact**: Any migration that seeds via UPDATE will pass tests falsely. A bare SELECT will not reveal the fabricated value.
- **Mitigation**: Consciously accepted; no current migration uses UPDATE seeding. Scope decision: verify before any UPDATE-based seeding.
- **Action**: Document in next operational review; verify parser syntax before seeding via UPDATE

**WARNING-5 — Signup closure is proven for LOCAL stack only; hosted projection unverified**  
- **File**: `supabase/config.toml:252-260` / `e2e/invariants/auth-signup.spec.ts:35-43`  
- **Finding**: `[auth] enable_signup = false` maps to `GOTRUE_DISABLE_SIGNUP=true` and closes self-service signup **on the local container**
- **Hosted Gap**: Production has no Supabase environment variables yet (deferred task 7.4). The hosted project's auth settings are written by no file in this repository.
- **Requirement Reference**: `specs/dispatch-console/spec.md:15-21` explicitly records this local-only scope
- **Action**: **Deferred task 7.4 MUST be closed before the console is ever pointed at a hosted project**

**WARNING-6 — Three deferred items are blocked operational work, not scope decisions**  
- **Items**: 
  - 7.1: Couple's own wedding facts (data entry; code half shipped; requires user input)
  - 7.2: Live `og:image` confirmation on deployed origin (production has no Supabase env vars; claim about Vercel unverifiable from here)
  - 7.4: Hosted-project signup closure (blocking operational work; no hosted project exists)
- **Distinction**: These are not "decided to never do"; they are "decided to do after other work lands"
- **Placement**: Descoped from task list; must remain tracked as blocking operational work

**WARNING-7 — One design coherence gap remains**  
- **File**: `design.md:371`  
- **Issue**: Body-preview heading path still omits the route group; should be `app/console/(authenticated)/preview/[invitationId]/page.tsx`
- **Why**: From WU10 remediation; five of six design paths were corrected; this heading was missed
- **Action**: One-line amendment before next change lands

**WARNING-8 — Work Unit 8 carries no TDD evidence table**  
- **File**: `tasks.md` WU8 section  
- **Issue**: All other WU sections carry a "TDD cycle evidence" table with RED/GREEN/triangulation details; WU8 does not
- **Impact**: TDD compliance is 6/7 checks (all other metrics pass)
- **Action**: Document WU8's testing approach (accessibility/hardening work typically E2E-heavy) if re-verified

---

### Level: SUGGESTION

**SUGGESTION-1 — Cookie band precision-of-justification gap**  
- **File**: `lib/server/cookies.spec.ts:142` (fixed) / `e2e/phone-gate.spec.ts:375-376` (closed band)
- **Finding**: 0.01 days = 864 seconds of slack on lower bound; comment justifies only rounding + round-trip
- **State**: Band rejects both 30-day and 365-day mutations; detection unaffected
- **Action**: Comment could be tightened to name the slack; non-blocking

**SUGGESTION-2 — Migration-seed parser splits on bare comma (sibling to WARNING-4)**  
- **File**: `supabase/tests/ceremony.spec.ts`  
- **Issue**: Parser splits columns and values on bare comma; a venue address containing one shifts every later value
- **Detection**: Fails SAFE (mismatch caught)
- **Verdict**: Lesser of two parser findings; WARNING-4 is the primary concern
- **Action**: Document with WARNING-4 parser review

**SUGGESTION-3 — Gate refusals indistinguishable (by design)**  
- **File**: `app/i/[slug]/actions.ts` / `e2e/phone-gate.spec.ts`  
- **Finding**: Invalid slug and wrong phone return identical error pages
- **Design**: Intentional; prevents enumeration
- **Verdict**: Correctly implemented per design requirement D10
- **Action**: None; design decision documented

**SUGGESTION-4 — E2E test leaves seeded senders in live Postgres**  
- **File**: `e2e/` suite (all tests)  
- **Finding**: Local Supabase DB persists after test runs; `senders` table contains 3 rows
- **State**: Includes the two operators (Ana, Carlos) and one extra from testing
- **Action**: E2E cleanup could be tightened; not critical for CI

**SUGGESTION-5 — `tasks.md` history still names two superseded paths**  
- **File**: `tasks.md:36,203,205,322`  
- **Issue**: References to `components/invitation/RsvpForm.tsx` and pre-route-group paths
- **Note**: Renames ARE recorded later in the same file (`5b.10`, `6b-ii.10`); reader finishing document is not misled
- **Verdict**: Defensible as historical record; decision was explicit, not accidental
- **Action**: None required; decision noted

**SUGGESTION-6 — `guest-directory` spec still says "the two senders" in three places**  
- **File**: `specs/guest-directory/spec.md:5,32,34`  
- **Issue**: Purpose and requirement heading say "the two senders"; amendment at line 23 disclaims cardinality constraint
- **Verdict**: Phrasing describes the couple's use case, not a schema guarantee; project config uses same phrasing
- **Action**: One-line alignment in spec before next change (optional; no functional impact)

**SUGGESTION-7 — `.env.example` prose could not be verified this run**  
- **Issue**: Prior report's SUGGESTION-3 ("still says 'middleware' twice") unverified (outside read permissions)
- **Action**: Manual verification in next session if needed

**SUGGESTION-8 — `htmlLimitedBots` config line has no test that fails when deleted**  
- **File**: `next.config.ts:16` / `e2e/invitation-page-og.spec.ts`  
- **Issue**: E2E test asserts outcome; on Next 16.3.4 this route doesn't stream by default, so removing line leaves test green
- **Protection**: E2E would catch streaming regression if Suspense boundary added in future work
- **Action**: Cheap guard available — `tools/` test reading `next.config.ts` and asserting key presence (in style of `tools/console-theme-css.spec.ts`)

---

## Review Lineages (Authority Burned)

Two native review lineages were completed with authority burned and approved closure:

1. **review-016cb8ba2ae4a696** — Work Unit 10 code candidate  
   - Status: Approved, authority burned  
   - Lenses: 4 (risk, resilience, readability, reliability)  
   - Correction: 1 bounded correction applied and approved  
   - Verdict: Closed CRITICAL-1, CRITICAL-2, CRITICAL-3, CRITICAL-4

2. **review-0f31cb4f9075d026** — Verification report candidate  
   - Status: Approved, authority burned  
   - Lens: 1 (verification readability)  
   - Correction: 1 bounded correction applied and approved  
   - Verdict: Closed remaining verification gaps

Both reviews met terminal approval with observer receipts.

---

## Four CRITICAL Findings — Closure Summary

All four CRITICAL findings from the prior verify-report were independently re-checked at this session:

1. **CRITICAL-1 (Ceremony migration-seed parser)** — Closed  
   - Parser no longer depends on live mutable state; re-aimed at migration seed
   - 29 tests pass; capable of failing (negative control present)
   - Limitation: Parser ignores UPDATE seeding (carried as WARNING-4)

2. **CRITICAL-2 (Unlock cookie maxAge)** — Closed  
   - Code: 180 days (`lib/server/cookies.ts:35`)
   - Spec: 180 days (`specs/phone-gate/spec.md:64`) with supersession paragraph
   - Both unit and E2E assertions now closed-band (pass only at 180, fail at 30 or 365)

3. **CRITICAL-3 (Auth mechanism change)** — Closed  
   - Spec: Magic-link → password (supersession paragraph at `specs/dispatch-console/spec.md:9-13`)
   - Design: `app/console/login/` with password entry (`design.md:52`)
   - All six design coherence gaps fixed except one heading (WARNING-7)

4. **CRITICAL-4 (Self-service signup)** — Closed  
   - Proof: Live endpoint 422 `signup_disabled`; container env `GOTRUE_DISABLE_SIGNUP=true`
   - Scope: Local container only; hosted projection awaits task 7.4 (WARNING-5)

---

## Descope Reconciliation

Four items were moved out of the task checklist into a "Deferred" section. Each was independently judged:

| Item | Scope | Closure | Verdict |
|------|-------|---------|---------|
| Supabase Realtime (6b.15) | **Verified out of scope** | Zero mentions in all seven specs; no code | Honest descope |
| Couple's wedding facts (7.1) | Code shipped in WU9; data entry pending | Form built; awaits user input | Honest descope |
| Live og:image on deployed origin (7.2) | Production has no Supabase env vars | Covered locally; production unverifiable | Honest descope with note |
| Hosted-project signup closure (7.4) | Blocking operational work | No hosted Supabase instance yet | **Deferred, not decided** |

All descopes are honestly labelled as blocked outside this repository, not as "decided done". Items 2, 3, 4 remain blocked operational work.

---

## SDD Cycle Complete

| Phase | Status | Artifact Location |
|-------|--------|-------------------|
| Proposal | Done | `archive/2026-09-13-whatsapp-wedding-invitations/proposal.md` |
| Spec | Done | 7 specs in `openspec/specs/{domain}/spec.md` |
| Design | Done | `archive/2026-09-13-whatsapp-wedding-invitations/design.md` |
| Tasks | Done (288/288) | `archive/2026-09-13-whatsapp-wedding-invitations/tasks.md` |
| Implementation | Done (WU1-10) | Committed to `feat/whatsapp-wedding-invitations` |
| Verification | Pass with Warnings | `archive/2026-09-13-whatsapp-wedding-invitations/verify-report.md` |
| Archive | Done | This report + `openspec/specs/` merged |

The `whatsapp-wedding-invitations` change is complete and closed. The next change (`invitation-administration`) will baseline against the published specs in `openspec/specs/`.

---

## Next Change Handoff

The `invitation-administration` change will receive:

1. **Published specs** in `openspec/specs/` — the source of truth for this domain
2. **Carried findings** — WARNING-1 (compensate deletion) and WARNING-2 (import validation) are scoped to code rewrite
3. **Advisory notes** — WARNING-4 (parser limitation), WARNING-5 (hosted signup), WARNING-6 (deferred operational work), WARNING-7 (one design line), WARNING-8 (WU8 evidence)
4. **Supersession paragraphs** preserved in three specs (phone-gate 180d, dispatch-console password, guest-directory allowlist wording)

---

**Archive created by**: sdd-archive sub-agent  
**Archive timestamp**: 2026-09-13T00:00:00Z  
**Hybrid store**: OpenSpec filesystem + Engram topic `sdd/whatsapp-wedding-invitations/archive-report`
