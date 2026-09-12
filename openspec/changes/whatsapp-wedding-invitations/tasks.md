# Tasks: WhatsApp Wedding Invitations

> **Size note**: this document exceeds the skill's generic 530-word task budget. The overage is required by the orchestrator brief for this change: ~120 tasks across 7 capability specs, strict test-first (RED before GREEN) ordering from work unit 2 onward, and roughly a dozen named security/architecture details each demanding its own explicit task (the `nullif` gate, `SameSite=Lax`, append-only-by-trigger, `server-only`, the ESLint import zone, the no-cache-buster preview URL, `sendBeacon` ordering, `htmlLimitedBots`, `metadataBase`, `DEFAULT_PHONE_COUNTRY`). Every task line is still one line, checklist-only, no paragraphs.

**Threat matrix**: every boundary in `design.md`'s threat matrix is marked `N/A` (no file-classification, VCS automation, or commit/push/PR execution surface in this change). No additional RED tasks are required beyond the spec-driven ones below.

**TDD note**: `strict_tdd` is `false` (fail-closed) until Work Unit 1 lands and flips it to `true`. From Work Unit 2 onward every production task is preceded by a RED (failing test) task. Async Server Components cannot be unit-tested (Vitest limitation) — those get Playwright E2E RED tasks instead, per `design.md`'s Testing Architecture table.

## Review Workload Forecast

**Budget note**: this session's `openspec/config.yaml` sets `delivery.review_budget_lines: 800`, superseding the skill's generic 400-line default. The `400-line budget risk` guard key below is kept literal for downstream parsing, but its Low/Medium/High value is computed against the actual **800**-line session budget. Per-unit estimates below also use 800 as the threshold, matching `design.md`'s own Migration/Rollout table.

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 (WU1) / ~600 (WU2) / ~600 (WU3) / ~500 (WU4a) / ~500 (WU4b) / ~400 (WU5) / ~550 (WU6a) / ~700 (WU6b) |
| 800-line budget risk per unit | Low (WU1) / Medium (WU2, WU3, WU4a, WU4b, WU6a) / Low-Medium (WU5) / Medium-High (WU6b) |
| Chained PRs recommended | Yes — specifically for the WU4a→WU4b and WU6a→WU6b pairs |
| Suggested split | PR1 → PR2 → PR3 → PR4a → PR4b → PR5 → PR6a → PR6b, linear chain; WU4a/4b and WU6a/6b MUST stay split per `design.md`, never re-merged into one PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — orchestrator MUST ask the user (stacked-to-main / feature-branch-chain / size-exception) before WU4a and WU6a land |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Scaffold Next.js+TS+Vitest+Playwright, flip `strict_tdd` | PR1 | `npm test` (zero files, exits 0) | `npm run build` + `npx playwright install` | Delete repo contents except `openspec/`; revert `openspec/config.yaml` |
| 2 | `lib/domain/**` pure functions | PR2 | `npm test -- lib/domain` | N/A — pure functions, no async RSC | Delete `lib/domain/**`; nothing else imports it yet |
| 3 | Supabase schema, RLS, triggers, base `lib/server/**` | PR3 | `npm test -- supabase/tests lib/server/invitations` | Local Supabase (docker) | Drop schema via down-scripts; delete `lib/server/{supabase,env,invitations}.ts` |
| 4a | `/i/[slug]` page, OG image, metadata, warming | PR4a (base: PR3) | `npm run e2e -- invitation-page-og` | Playwright, `User-Agent: WhatsApp/2.23.20.0` | Delete `app/i/[slug]/{page,opengraph-image}.tsx`, `app/robots.ts`, `lib/server/og-warm.ts` |
| 4b | Phone gate: unlock, rate limit, cookie, recovery | PR4b (base: PR4a) | `npm run e2e -- phone-gate` | Playwright, no-JS raw HTML + cookie inspection | Delete `app/i/[slug]/{gate-form,actions}.tsx`, `lib/server/{gate,cookies}.ts`; page falls back to always-gated |
| 5 | RSVP form, action, seat-cap enforcement | PR5 (base: PR4b) | `npm run e2e -- rsvp` | Playwright, unlocked-session fixture | Delete `components/invitation/RsvpForm.tsx`, `lib/server/rsvp.ts`; RSVP action removed from `actions.ts` |
| 6a | Console auth, partitioned list, device declaration | PR6a (base: PR5) | `npm run e2e -- console-auth` | Playwright, magic-link fixture | Delete `app/console/{layout,login,device}.tsx`, `app/console/auth/callback/route.ts`, `lib/server/auth.ts` |
| 6b | Dispatch, beacon route, both previews, Realtime | PR6b (base: PR6a) | `npm run e2e -- console-preview` | Playwright + RTL beacon-order test | Delete `app/console/{dispatch,preview,api/dispatch-event}/**`, `components/console/WhatsAppBubble.tsx`, `lib/server/dispatch.ts` |

## Phase 1: Scaffold + Strict TDD (Work Unit 1)

- [x] 1.1 Run `npx create-next-app@latest . --ts --app --eslint` to scaffold the Next.js App Router project with `npm`.
- [x] 1.2 Install Vitest + testing deps (`vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`); create `vitest.config.mts`.
- [x] 1.3 Install `@playwright/test`, create `playwright.config.ts`, run `npx playwright install`.
- [x] 1.4 Add `package.json` scripts `test`, `test:watch`, `test:coverage`, `typecheck`, `lint`, `format`, `build`, `e2e` per `openspec/config.yaml` `testing.recommended`.
- [x] 1.5 Create `next.config.ts` with `htmlLimitedBots: /.*/`; check `node_modules/next/package.json` (read-only) to determine whether the key is top-level or under `experimental` for the installed version and place it correctly.
- [x] 1.6 Create `app/layout.tsx` setting `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'http://localhost:3000')`.
- [x] 1.7 Add ESLint `no-restricted-imports` zone for `lib/domain/**` banning `react`, `react-dom`, `next/*`, `@supabase/*`, `server-only`, `node:*`, `../server/*`.
- [x] 1.8 Add ESLint `no-restricted-imports` zone for `components/**` banning `lib/server/**` and `@supabase/*`.
- [x] 1.9 Edit `openspec/config.yaml`: set `strict_tdd: true`, `apply.tdd: true`, `apply.test_command: "npm test"`, `verify.test_command: "npm test"`, `verify.build_command: "npm run build"`.
- [x] 1.10 Verify: clean-clone `npm install && npm run build` succeeds with zero TypeScript errors (Scaffold produces a runnable dev server).
- [x] 1.11 Verify: `npm test` with zero test files present exits successfully (Test harnesses installed).
- [x] 1.12 Verify: `openspec/config.yaml` inspection shows `strict_tdd: true` and a non-empty, executable `apply.test_command` (Strict TDD enabled by this change).

## Phase 2: Pure Domain Functions (Work Unit 2)

- [x] 2.1 RED — `lib/domain/phone.spec.ts`: table-driven `normalizePhone(input, defaultCountry)` cases (with/without `+`, spaces, dashes, parens, Mexican `1` mobile prefix, Argentine `9` prefix, empty string, garbage).
- [x] 2.2 GREEN — `lib/domain/phone.ts`: implement `normalizePhone` via `libphonenumber-js`'s `parsePhoneNumberFromString`; never throws, returns a discriminated success/failure result.
- [x] 2.3 RED — `phone.spec.ts`: `normalizeForStorage` (throws on invalid input), `deriveGateKey` (lenient, digits-only, `null` if <8 digits), `matchesInvitation` (any-guest match true; one-digit near-miss false).
- [x] 2.4 GREEN — `phone.ts`: implement `normalizeForStorage`, `deriveGateKey`, `matchesInvitation`; run `npm run test:coverage` and confirm 100% coverage on this file.
- [ ] 2.5 (PARTIAL — test table done; `.env.example` write BLOCKED by the environment's permission settings, see apply-progress) Add `DEFAULT_PHONE_COUNTRY` to `.env.example`; confirm 2.1/2.3's table spans MX/AR/US candidate default-country values (extend the table if a candidate is missing).
- [x] 2.6 RED — `lib/domain/wa-link.spec.ts`: `buildWaMeLink` encoding table (space, `&`, `?`, newline as `%0A`, accented character, emoji, digits contain no `+`).
- [x] 2.7 GREEN — `lib/domain/wa-link.ts`: implement `buildWaMeLink`; confirm 100% coverage on this file.
- [x] 2.8 RED — `lib/domain/message-template.spec.ts`: renders `{{greeting_name}}`; a template referencing a missing variable throws/errors and never renders the literal string `undefined`.
- [x] 2.9 GREEN — `lib/domain/message-template.ts`: implement `renderMessageTemplate`.
- [x] 2.10 RED — `lib/domain/slug.spec.ts`: `encodeSlug(bytes)` on 10-byte input produces a 16-char `[a-z2-7]` string; `isWellFormedSlug` validates the shape; a 10,000-sample uniqueness check using varied injected byte arrays (no `node:crypto` inside the test target).
- [x] 2.11 GREEN — `lib/domain/slug.ts`: implement `encodeSlug`, `SLUG_BYTE_LENGTH = 10`, `isWellFormedSlug`.
- [x] 2.12 RED — `lib/domain/rate-limit.spec.ts`: `evaluateGate(attempts, now)` pure — (invitation, ip_hash) 15 min / 8-fail / 30 min lockout; (invitation, all-IP) 60 min / 30-fail / 60 min lockout; deterministic via an injected `now`.
- [x] 2.13 GREEN — `lib/domain/rate-limit.ts`: implement `evaluateGate`.
- [x] 2.14 RED — `lib/domain/seats.spec.ts`: `validateRsvpSelection` rejects a selection exceeding `seats_allowed`, accepts at/under the cap.
- [x] 2.15 GREEN — `lib/domain/seats.ts`: implement `validateRsvpSelection`.
- [x] 2.16 Verify: 1.7's ESLint zone against the real `lib/domain/**` files — a deliberately added banned import fails `npm run lint`; remove the smoke violation after confirming.
- [x] 2.17 Verify: `npm run test:coverage` shows 100% specifically on `phone.ts` and `wa-link.ts` (not a global threshold, per `design.md`'s Testing Architecture table).

## Phase 2b: Domain Corrections (Work Unit 2b)

Driven by the confirmed product fact that every guest phone is a Colombian mobile
(10 national digits, country code 57, `DEFAULT_PHONE_COUNTRY=CO`) and by three
review findings on the Work Unit 2 domain modules.

- [x] 2b.1 RED — `lib/domain/message-template.spec.ts`: `{{constructor}}`, `{{toString}}`, `{{hasOwnProperty}}` and `{{valueOf}}` are reported as MISSING and throw; an own property that shadows a prototype member still substitutes.
- [x] 2b.2 GREEN — `lib/domain/message-template.ts`: resolve placeholders with `Object.hasOwn(vars, name)` so the prototype chain can never render a function body into a WhatsApp draft (`R3-template-inherited-key`).
- [x] 2b.3 RED — `lib/domain/phone.spec.ts`: an unset or unsupported `defaultCountry` (`""`, `MEX`, `ZZ`, `57`) fails with the named `DEFAULT_PHONE_COUNTRY` error; a lowercase `co` is accepted.
- [x] 2b.4 GREEN — `lib/domain/phone.ts`: `normalizePhone` validates through the existing `resolveDefaultCountry` instead of casting `defaultCountry as CountryCode` (`R3-unvalidated-default-country`).
- [x] 2b.5 RED — `phone.spec.ts`: pin the five real Colombian input shapes (`3001234567`, `300 123 4567`, `+573001234567`, `57 300 123 4567`, `+57 300 1234567`) to `+573001234567` / `01234567`, then flip the legacy Mexican `1`-token rows to `invalid`.
- [x] 2b.6 GREEN — `phone.ts`: delete `canonicalizeLegacyMexicanMobile`, its `MEXICO_*` constants and its call site in `normalizePhone`; drop the tests that existed solely to exercise it, including the foreign-rewrite guard (`R3-legacy-mx-foreign-rewrite`). No Mexican, Argentine or other-country guests exist, so the path could not occur and its only remaining effect was the ability to rewrite a foreign number into a Mexican one.
- [x] 2b.7 Verify: `npm test` green, `npm run test:coverage` still 100% statements/branches/functions/lines on `phone.ts` and `wa-link.ts`, `npm run typecheck`, `npm run lint` and `npm run format:check` clean, zero `eslint-disable` under `lib/domain/**`.

## Phase 3: Supabase Schema, RLS, Triggers, Base Adapters (Work Unit 3)

- [x] 3.1 RED — `supabase/tests/phone-last8.spec.ts` (dedicated security test): `invitation_guests.phone_last8` is `NULL` — never `''` — when `phone_e164` is `NULL`; an empty/blank gate submission therefore cannot match a phone-less guest.
- [x] 3.2 GREEN — `supabase/migrations/0001_schema.sql`: all six tables (`senders`, `invitations`, `invitation_guests`, `dispatch_events`, `rsvp_responses`, `gate_attempts`) per `design.md`'s DDL, including `phone_last8 generated always as (nullif(right(regexp_replace(coalesce(phone_e164,''), '\D', '', 'g'), 8), '')) stored`; matching `0001_schema_down.sql`.
- [x] 3.3 RED — `supabase/tests/rls.spec.ts`: the anon key gets permission-denied or empty results on all six tables.
- [x] 3.4 GREEN — `supabase/migrations/0002_rls.sql`: enable RLS on all six tables with zero `CREATE POLICY` statements (default-deny); revoke default grants from `anon`/`authenticated`; matching down-script.
- [x] 3.5 RED — `supabase/tests/append-only.spec.ts`: `UPDATE`/`DELETE` on `dispatch_events` and `rsvp_responses` raise an exception even when run as `service_role` (proves the trigger, not RLS, is the enforcement — `service_role` has `BYPASSRLS`).
- [x] 3.6 GREEN — `supabase/migrations/0003_triggers.sql`: `reject_mutation()` + `BEFORE UPDATE OR DELETE` triggers on `dispatch_events` and `rsvp_responses`; matching down-script.
- [x] 3.7 RED — `append-only.spec.ts` addendum: an `rsvp_responses` INSERT with `seats_confirmed` or `cardinality(attendee_guest_ids)` exceeding the invitation's `seats_allowed` raises.
- [x] 3.8 GREEN — `0003_triggers.sql`: add `enforce_seat_cap()` + `BEFORE INSERT` trigger on `rsvp_responses`.
- [x] 3.9 GREEN — `lib/server/supabase.ts`: `import 'server-only'` as the first line; secret-key (`sb_secret_`) Supabase client.
- [x] 3.10 Verify: a throwaway `'use client'` component importing `lib/server/supabase.ts` fails `npm run build`; delete the throwaway after confirming.
- [x] 3.11 Add a lint/CI check verifying every file under `lib/server/**` begins with `import 'server-only'`; wire it into `npm run lint`.
- [x] 3.12 GREEN — `lib/server/env.ts`: `import 'server-only'` first line; typed accessors for `DEFAULT_PHONE_COUNTRY`, `UNLOCK_COOKIE_SECRET`, `GATE_IP_PEPPER`, `NEXT_PUBLIC_SITE_ORIGIN`.
- [x] 3.13 RED — `lib/server/invitations.spec.ts`: import rejects a row with a missing/unrecognized owner rather than creating an unassigned invitation; the guest-facing read mapper never exposes `phone_e164`/`phone_last8`.
- [x] 3.14 GREEN — `lib/server/invitations.ts`: `import 'server-only'` first line; repository + import-validation functions; guest-facing mapper strips phone fields.
- [x] 3.15 Create `scripts/import-guests.ts` reading the untracked guest source file and calling the invitations repository; add the source path to `.gitignore`; document usage in a header comment.
- [x] 3.16 Verify: run local Supabase (docker) and the DB-layer Vitest suite — confirm 3.1, 3.3, 3.5, 3.7, 3.13 RED tests now pass GREEN.

## Phase 3b: Schema and Import Hardening (Work Unit 3b)

Closes three WARNING-level findings from the Work Unit 3 reliability review. The
three SUGGESTION-level findings and the other three WU3 WARNINGs are explicitly
out of scope and remain open.

- [x] 3b.1 RED — `supabase/tests/rls.spec.ts` addendum: a table created after `0002_rls.sql` with the default grants reinstated is still denied to `anon` for SELECT and INSERT; a function created after it is denied EXECUTE; `service_role` still reaches the new table; the enforcing event trigger is present and enabled.
- [x] 3b.2 GREEN — `supabase/migrations/0004_default_deny_new_objects.sql`: `deny_anon_on_new_public_object()` event trigger on `ddl_command_end` revoking `anon`/`authenticated` (and PUBLIC for routines) on every new `public` table, view, sequence, function and procedure; plus the never-issued `revoke execute on all functions` and the functions-scoped `alter default privileges` that `0002` omitted; matching down-script (`R3-default-deny-not-future-proof`).
- [x] 3b.3 RED — `supabase/tests/append-only.spec.ts` addendum: deleting an invitation that already has dispatch events and RSVPs succeeds and removes its children; a DIRECT single-row `DELETE` on `dispatch_events` and on `rsvp_responses` is still rejected as `service_role` with the row surviving; a direct `UPDATE` is still rejected.
- [x] 3b.4 GREEN — `supabase/migrations/0005_append_only_allows_cascade.sql`: `reject_mutation()` exempts a `DELETE` only when the parent `invitations` row is already gone, which is true exactly for the FK cascade; matching down-script restoring `0003`'s body (`R3-append-only-blocks-cascade-delete`).
- [x] 3b.5 RED — `lib/server/invitations.spec.ts` addendum: `validateImportRows` derives a stable source key, keeps two households distinct, honours an explicit `sourceKey`, and rejects a file whose rows collide; a mid-import failure persists zero rows; the same source imported twice leaves the row count unchanged and reports the original slugs; `anon` cannot execute the import RPC.
- [x] 3b.6 GREEN — `supabase/migrations/0006_import_invitations.sql`: `invitations.source_key` + unique index; `import_invitations(jsonb)` performing the whole import in one transaction with `on conflict (source_key) do nothing`; grants revoked from PUBLIC/`anon`/`authenticated`; matching down-script (`R3-import-loop-not-atomic-or-idempotent`).
- [x] 3b.7 GREEN — `lib/server/invitations.ts`: `sourceKey` on `ImportRow`/`NewInvitation`, `validateImportRows`, `importInvitations` calling the RPC with adapter-minted slugs; `scripts/import-guests.ts` uses both and reports created vs. already-present.
- [x] 3b.8 Verify: `npm test` green (244, up from 229), migrations rolled fully down and back up then re-verified, `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` clean.

## Phase 4a: Invitation Page, OG Image, Metadata (Work Unit 4a)

- [x] 4a.1 RED — `e2e/invitation-page-og.spec.ts`: fetch `/i/<slug>` with `User-Agent: WhatsApp/2.23.20.0`, assert `og:title`/`og:image` inside raw `<head>...</head>` before JS runs; repeat with an ordinary browser UA; assert `og:image` starts with `https://` and matches the deployed origin.
- [x] 4a.2 GREEN — `app/i/[slug]/page.tsx`: thin async container fetching the invitation by slug and `generateMetadata`.
- [x] 4a.3 GREEN — `app/i/[slug]/opengraph-image.tsx`: `next/og`, Node runtime, greeting name + invitation line only, bundled font loaded once at module scope.
- [x] 4a.4 RED — Vitest test: the OG image's render props/inputs exclude wedding date, venue name/address, and phone.
- [x] 4a.5 GREEN — confirm `opengraph-image.tsx` only receives `greeting_name` + a static invitation line from the repository read.
- [x] 4a.6 RED — `e2e/invitation-page-og.spec.ts` addendum: fixture `greeting_name = "Ñoño Muñóz"` returns `content-type: image/png`, non-zero bytes, no tofu/placeholder glyphs.
- [x] 4a.7 GREEN — verify/adjust the bundled font subset renders `ñ` and accented vowels correctly.
- [x] 4a.8 RED — E2E addendum: `/i/<unknown-slug>` renders a friendly contact page, not the framework's default 404.
- [x] 4a.9 GREEN — `page.tsx`: unknown/rotated-slug handling renders a friendly contact component instead of calling `notFound()`.
- [x] 4a.10 RED — test for `app/robots.ts`: `/i/` is disallowed while the OG image sub-path stays crawlable.
- [x] 4a.11 GREEN — `app/robots.ts`: implement per 4a.10.
- [x] 4a.12 RED — `lib/server/og-warm.spec.ts`: warm success sets `og_warmed_at`; warm failure/timeout leaves invitation creation successful and logs only the slug, never a phone.
- [x] 4a.13 GREEN — `lib/server/og-warm.ts`: `import 'server-only'` first line; `warmOgCard(slug)` fetches the canonical OG URL with a 5s timeout after the invitation INSERT commits.
- [x] 4a.14 GREEN — wire `warmOgCard` into `scripts/import-guests.ts`'s creation path.
- [x] 4a.15 Verify: using 4a.1's E2E result as authority, confirm `next.config.ts`'s `htmlLimitedBots` key placement (top-level vs. `experimental`) against `node_modules/next/package.json` (read-only); adjust if tags are still streamed.
- [x] 4a.16 Verify: run `e2e/invitation-page-og.spec.ts` — confirm 4a.1, 4a.4, 4a.6, 4a.8, 4a.10 RED tests pass GREEN.

## Phase 4c: Field-Learned Corrections (Work Unit 4c)

> Five defects derived from a real shipped project that solved the same problem for 97 guests. Each one is something someone already paid to learn. `seats_allowed` parity direction was corrected mid-unit by the orchestrator: the couple has every guest's name, so equality is a real invariant and the DATABASE moves to match the domain, not the other way round.

- [x] 4c.1 RED — `lib/domain/phone-reachability.spec.ts`: table-driven; a Colombian landline (`+57 601 234 5678`, bare `6012345678`, `+57 604 444 5555`) is NOT dispatchable while a mobile (`+573001234567`, `3001234567`, `300 123 4567`) is; a misconfigured default country throws.
- [x] 4c.2 GREEN — `lib/domain/phone-reachability.ts`: `classifyPhoneDispatchability` / `isDispatchablePhone` via `libphonenumber-js/max`'s `getType()`; only `MOBILE` and `FIXED_LINE_OR_MOBILE` are dispatchable; `normalizePhone`'s contract and metadata are left untouched.
- [x] 4c.3 RED — `scripts/import-guests.spec.ts`: `buildImportAdvisory` flags a landline, ignores a phone-less guest, and flags a household whose `seats_allowed` differs from the names entered; `formatImportAdvisory` names households but emits no digits.
- [x] 4c.4 GREEN — `scripts/import-guests.ts`: `buildImportAdvisory` / `formatImportAdvisory`, reported before the write so `--dry-run` surfaces both counts; advisory only, never a rejection.
- [x] 4c.5 RED — `lib/domain/rsvp-deadline.spec.ts`: a timestamp that is still the deadline day in Bogota but already the next day in UTC leaves the RSVP OPEN; the first second of the next Bogota day closes it; the zone is a parameter, not an offset.
- [x] 4c.6 GREEN — `lib/domain/rsvp-deadline.ts`: `isRsvpOpen(deadline, now, timeZone = RSVP_TIME_ZONE)` and `calendarDateInZone` via `Intl`, comparing ISO calendar days; `America/Bogota` encoded as a zone, never as `-05:00`.
- [x] 4c.7 RED — `supabase/tests/seat-parity.spec.ts`: the same three cases asserted against BOTH enforcement points — 2 seats/2 names accepted, 2 seats/1 name rejected, 3 names against a 2-seat cap still rejected for the cap's own reason — with the DB cases run as `service_role`.
- [x] 4c.8 GREEN — `supabase/migrations/0007_seat_attendee_parity.sql` (+ down script): `enforce_seat_cap` additionally requires `cardinality(attendee_guest_ids) = seats_confirmed`, evaluated AFTER the hard cap so an over-cap row still fails for the cap. `lib/domain/seats.ts` is deliberately UNCHANGED.
- [x] 4c.9 GREEN — correct the fixtures that relied on the looser rule: `seedGuests` helper in `supabase/tests/helpers/db.ts`, and four `rsvp_responses` fixtures in `append-only.spec.ts` now name as many attendees as they confirm.
- [x] 4c.10 RED — `app/i/[slug]/error.spec.tsx`: chunk-load failures are recognized by name and by all three bundler/browser wordings; `attemptChunkReload` reloads once, refuses a second reload, never reloads an ordinary error, and does nothing when storage throws; the rendered copy is Spanish, says the answer was kept, and is never the framework's English wall.
- [x] 4c.11 GREEN — `app/i/[slug]/error.tsx`: `'use client'` error boundary; `isChunkLoadError`, `attemptChunkReload` with a `sessionStorage` guard and injected ports, calm Spanish copy plus a `reset()` button.
- [x] 4c.12 RED/GREEN — `e2e/invariants/rls.spec.ts`: external suite holding only the publishable key; every owned table is seeded with a committed row proved visible to a privileged reader, then SELECT returns nothing and INSERT, UPDATE and DELETE are all refused `42501`; a database read confirms nothing was mutated.
- [x] 4c.13 RED/GREEN — same file: a table created AFTER the migrations, born under reinstated default grants inside one transaction, has no `anon` grant (the `0004` event trigger removed it), is reachable through PostgREST so the probe is not vacuous, refuses the publishable key all four verbs, and stays usable by `service_role`.
- [x] 4c.14 Verify: `npm test` (346, up from 296), `npm run e2e` (22, up from 12), `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` all clean; 0007 rolled down and back up with the parity test failing in between.

## Phase 4b: Phone Gate (Work Unit 4b)

- [x] 4b.1 RED — `lib/server/gate.spec.ts`: adapter wiring accepts any-guest match, rejects a near-miss.
- [x] 4b.2 GREEN — `lib/server/gate.ts`: `import 'server-only'` first line; `attemptUnlock(invitationId, rawPhone, ipHash, now)`.
- [x] 4b.3 RED — `gate.spec.ts` addendum: (invitation, ip_hash) 15 min/8-fail/30 min lockout; (invitation, all-IP) 60 min/30-fail/60 min lockout; a 9th attempt is rejected regardless of correctness.
- [x] 4b.4 GREEN — wire `lib/domain/rate-limit.ts`'s `evaluateGate` into `gate.ts` against `gate_attempts`.
- [x] 4b.5 GREEN — implement `ip_hash = HMAC-SHA256(GATE_IP_PEPPER, ip)` truncated to 32 hex chars via `node:crypto`, called only from `gate.ts`.
- [x] 4b.6 RED — `lib/server/cookies.spec.ts`: unlock-cookie sign/verify round-trip; a tampered payload fails verification; the payload's `invitationId` is cross-checked against the invitation resolved from the current slug.
- [x] 4b.7 GREEN — `lib/server/cookies.ts`: `import 'server-only'` first line; `inv_unlock` cookie — `httpOnly`, `secure`, `sameSite: 'lax'` (explicitly Lax, not Strict — the guest arrives via cross-site navigation from WhatsApp, and Strict would drop the cookie on that exact navigation), `path: '/i/' + slug`, `maxAge: 30 days`.
- [x] 4b.8 GREEN — `app/i/[slug]/gate-form.tsx`: `'use client'` phone input calling `unlockAction`.
- [x] 4b.9 GREEN — `app/i/[slug]/actions.ts`: `'use server'` `unlockAction(slug, rawPhone)`; generic failure message, no leaked digits.
- [x] 4b.10 GREEN — wire `page.tsx`: render `gate-form.tsx` when no valid unlock cookie is present; delegate to body content when unlocked.
- [x] 4b.11 RED — `e2e/phone-gate.spec.ts`: any guest's last-8 digits unlock; a near-miss is rejected; a failed-attempt response (HTML, inline JSON, network payloads) contains no guest name, no RSVP/dietary/message fields, and no digit sequence matching any stored guest phone.
- [x] 4b.12 (PARTIAL — query-parameter half done; the console-operator half is DEFERRED: the console and its session do not exist until Work Unit 6a, so no operator can be authenticated yet. Covered today by an equivalent assertion that no session-shaped cookie — `admin_session`, `device_sender`, `sb-access-token`, `unlocked` — bypasses the gate, plus a forged `inv_unlock`. Re-assert with a real operator session in 6a.) RED — E2E addendum: `?preview=1`, `?admin=1`, and other query parameters never bypass the gate; an authenticated console operator visiting the public route directly still sees the gate.
- [x] 4b.13 RED — E2E addendum: 8 failed attempts within 15 minutes lock out the 9th; the lockout persists across separate requests.
- [x] 4b.14 RED — E2E addendum: a successful unlock sets `inv_unlock` with `SameSite=Lax`; a repeat visit within 30 days skips the gate.
- [x] 4b.15 GREEN — recovery UI: "¿No puedes entrar?" link via `buildWaMeLink(owner.contact_wa_phone_e164, renderMessageTemplate(HELP_TEMPLATE, { greetingName }))`, resolved server-side against the owning sender.
- [x] 4b.16 RED — E2E addendum: the recovery link's recipient digits match the invitation's owning sender's contact number.
- [x] 4b.17 RED — E2E addendum: unknown-slug and wrong-phone response shapes are compared; neither reveals invitation existence beyond the intentional friendly-page distinction.
- [x] 4b.18 Verify: run `e2e/phone-gate.spec.ts` and `e2e/invitation-page-og.spec.ts` together — confirm 4b.1, 4b.3, 4b.6, 4b.11–4b.14, 4b.16, 4b.17 RED tests pass GREEN and the one-unlock-path invariant holds.

## Phase 4d: Phone Gate Hardening (Work Unit 4d)

Three fixes from the Work Unit 4b reliability review. Two are security defects
in the gate that unit built; the third is an unasserted attribute.

- [x] 4d.1 RED — `lib/server/decoy-gate.spec.ts`: the SAME sequence of forged attempts against an unknown slug and against a real invitation with wrong numbers is compared step by step — outcome values, the attempts countdown, the lockout attempt, the retry duration and the rendered Spanish copy must be equal at every step, with a negative control proving the shipped constant-zero behaviour was separable on the first call.
- [x] 4d.2 GREEN — `lib/server/decoy-gate.ts`: an unknown slug is answered by running the REAL gate (`attemptUnlock`, `evaluateGate`, `remainingAttempts`) against an empty guest list, so the counter, the lockout moment and the wait are identical by construction rather than by a second hand-written mapping. History lives in a bounded LRU keyed by slug; nothing is persisted, because writing `gate_attempts` rows for attacker-chosen slugs would trade an existence oracle for an unauthenticated storage-abuse channel. Residual gap recorded in `apply-progress.md`.
- [x] 4d.3 GREEN — `lib/server/gate.ts`: export `GATE_HISTORY_WINDOW_MS` and add `toGateFeedback` / `FailedUnlockOutcome`, so the real path and the decoy share ONE outcome-to-copy mapping. Two hand-written mappings are how the values drifted apart the first time.
- [x] 4d.4 RED — `lib/server/client-ip.spec.ts`: a forged `x-forwarded-for` (and `forwarded`, `x-client-ip`, `true-client-ip`, `cf-connecting-ip`, `x-cluster-client-ip`) never moves the rate-limit bucket; off Vercel every header is ignored and one shared bucket is used.
- [x] 4d.5 GREEN — `lib/server/client-ip.ts`: `trustedClientIp` reads only `x-vercel-forwarded-for` then `x-real-ip`, and only when `process.env.VERCEL === "1"`; otherwise the constant `shared-untrusted-origin` bucket. `x-forwarded-for` is never read: Vercel's Trusted Proxy feature makes it customer-proxy input on Enterprise, and a security property that depends on a billing plan is not one.
- [x] 4d.6 GREEN — `app/i/[slug]/actions.ts`: delete the left-most-`x-forwarded-for` reader, take one clock reading and one bucket per request, and route BOTH the real and the unknown-slug outcome through `toGateFeedback`.
- [x] 4d.7 RED — `e2e/phone-gate.spec.ts` addendum: eight failures split across two browser contexts each announcing a different `x-forwarded-for` still walk one countdown 7 → 0; a third forged address is refused by the lockout; a forged address plus the CORRECT number still cannot reach the invitation body.
- [x] 4d.8 RED/GREEN — `lib/server/cookies.spec.ts` addendum: `unlockCookieOptions().secure` asserted in BOTH branches — true under `NODE_ENV=production`, false under `development` and `test` — with a mutation run confirming each branch kills its mutant.
- [x] 4d.9 Verify: `npm test` (451, up from 424), `npm run e2e` (53, up from 50), `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` all clean.

## Phase 5: RSVP (Work Unit 5)

- [x] 5.1 RED — `lib/server/rsvp.spec.ts`: a submission without a valid unlock cookie is rejected and creates no `rsvp_responses` row.
- [x] 5.2 GREEN — `lib/server/rsvp.ts`: `import 'server-only'` first line; `submitRsvp` verifies the unlock cookie via `cookies.ts` before any write.
- [x] 5.3 RED — `rsvp.spec.ts` addendum: the server re-validates seats/attendee count against `seats_allowed` and rejects an over-cap submission even bypassing the client form; every submission inserts a new row, never updates/deletes existing ones; current state is the latest row by `submitted_at`; blank optional fields succeed with null/empty values.
- [x] 5.4 GREEN — wire `lib/domain/seats.ts`'s `validateRsvpSelection` into `rsvp.ts`; implement append-only insert + `getCurrentRsvp(invitationId)`; zod schema with dietary/message optional, matching the DB `char_length` limits.
- [x] 5.5 GREEN — `components/invitation/RsvpForm.tsx`: `'use client'`; attendee checkboxes capped at `seats_allowed` with no over-cap affordance; dietary/message fields; calls `submitRsvpAction`.
- [x] 5.6 GREEN — `app/i/[slug]/actions.ts`: add `submitRsvpAction` calling `lib/server/rsvp.ts`.
- [x] 5.7 GREEN — deadline behavior: past-deadline shows a contact message instead of `RsvpForm`; pre-deadline or no-deadline shows and accepts the form.
- [x] 5.8 RED — `e2e/rsvp.spec.ts`: the form never renders more than `seats_allowed` options; a tampered over-cap direct submission is rejected server-side with no row created; a changed answer produces two rows with the latest reflecting the new answer; past-deadline shows the contact message; pre-deadline/no-deadline shows and accepts the form.
- [x] 5.9 Verify: run `e2e/rsvp.spec.ts` and full `npm run test:coverage` — confirm 5.1, 5.3, 5.8 RED tests pass GREEN.

## Phase 5b: Decline-to-Stream, Ceremony Row, Message Removal (Work Unit 5b)

- [x] 5b.1 RED — `supabase/tests/ceremony.spec.ts`: exactly one row after the migrations; a second row is refused by the primary key and an `id = false` row by the singleton CHECK; the seeded values are `{{...}}` placeholders, never invented details; an UPDATE still works.
- [x] 5b.2 RED — `ceremony.spec.ts` addendum: RLS enabled with zero policies; the table was born with NO anon grant even though `0009` writes no revoke of its own, which is the verification that the `0004` event trigger really covers a plain `CREATE TABLE`; the publishable key selects nothing while a privileged reader sees the row.
- [x] 5b.3 GREEN — `supabase/migrations/0009_ceremony.sql` + `supabase/down/0009_ceremony_down.sql`: single-row `ceremony` table (`id boolean primary key` + `ceremony_is_singleton` CHECK), RLS on, zero policies, seeded with `{{CEREMONY_DATE}}`, `{{CEREMONY_TIME}}`, `{{ZOOM_MEETING_ID}}`, `{{ZOOM_PASSCODE}}`.
- [x] 5b.4 GREEN — `lib/server/ceremony.ts`: `import 'server-only'` first line; `getCeremony(client)` maps the row and throws loudly when it is missing.
- [x] 5b.5 GREEN — extend the anon-key RLS invariants to `ceremony`: `OWNED_TABLES` in `supabase/tests/helpers/db.ts` and in `e2e/invariants/rls.spec.ts`, with insert/update payloads and an assertion that the row survives all four verbs untouched.
- [x] 5b.6 RED — `lib/server/rsvp.spec.ts` + `supabase/tests/rsvp-store.spec.ts`: no `message` column on `rsvp_responses` or `rsvp_latest` (with `dietary_notes` asserted present on both, so the query is proved to be looking); a write naming `message` is refused; a `message` field on the wire is IGNORED rather than rejected, exactly like `seatsConfirmed`.
- [x] 5b.7 GREEN — `supabase/migrations/0010_drop_rsvp_message.sql` + matching down-script: drop and recreate `rsvp_latest` around `alter table rsvp_responses drop column message` (never `cascade`, which would silently take the view); remove `message` from `lib/server/rsvp.ts`, its zod schema, its port types and both selects.
- [x] 5b.8 RED — `components/invitation/CeremonyStream.spec.tsx`: all four details rendered each beside its own label; placeholders rendered verbatim; the reconsider control calls back exactly once and not before.
- [x] 5b.9 GREEN — `components/invitation/CeremonyStream.tsx`: props-only, no data access, Spanish neutral copy including "si cambian de opinión, pueden volver a responder".
- [x] 5b.10 RED — `components/invitation/RsvpAnswer.spec.tsx` (renamed from `RsvpForm.spec.tsx`): declining submits on the first tap with no second click and names nobody even after boxes were checked; the stream replaces the form; a REFUSED decline keeps the form; reconsidering returns an empty form; a second identical decline still returns to the stream; there is no message field.
- [x] 5b.11 GREEN — `components/invitation/RsvpAnswer.tsx`: auto-submit from an effect so the payload is built after the fieldset is disabled; the surface follows the RECORDED answer, never the tap; message field removed.
- [x] 5b.12 GREEN — `app/i/[slug]/load-invitation.ts` `loadCeremony` (React `cache`) and `app/i/[slug]/page.tsx` passing it to `RsvpAnswer`.
- [x] 5b.13 RED — `e2e/rsvp.spec.ts`: a decline auto-submits and shows the stream details read FROM the row; a decline followed by an acceptance leaves `rsvp_latest` reporting the acceptance over a three-row history; the form carries no message box.
- [x] 5b.14 Verify: `npm test`, `npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, plus `supabase db reset` followed by `npm test` so 0009 and 0010 are proved to replay from an empty database in order.
- [x] 5b.15 Task 7.1 addendum — when the couple supplies the real details, `UPDATE` the `ceremony` row and collapse `InvitationBody`'s `{{WEDDING_DATE}}` into `ceremony_date` rather than leaving the date stated in two places.

## Phase 6a-i: Console Authentication and Session Survival (Work Unit 6a-i)

> Work Unit 6a was split again at apply time: the ledger ceiling refused an elevation, so
> authentication and session survival land here and the guest list plus the device
> declaration (`6a.5`–`6a.12`) land in Work Unit 6a-ii. `6a.13`/`6a.14` are therefore split
> too: the auth half of the console E2E lands here, the list/device half in 6a-ii.

- [x] 6a-i.1 RED — `lib/domain/operator-session.spec.ts`: console redirect routing is a pure decision; a forwarded operator identity is signed, verified, and stripped from inbound request headers before anything trusts it.
- [x] 6a-i.2 GREEN — `lib/domain/operator-session.ts`: pure routing + Web Crypto HMAC sign/verify of the forwarded identity, usable from both the edge middleware and Node.
- [x] 6a-i.3 RED — `lib/server/auth.spec.ts`: an unallowlisted email is denied and creates no session mapped to any sender; an allowlisted email resolves to exactly one `senders.auth_user_id` identity; the magic-link request returns a byte-identical acknowledgement whether or not the address is an operator.
- [x] 6a-i.4 GREEN — `lib/server/auth.ts`: `import 'server-only'` first line; `resolveOperator` binds `auth_user_id` on first allowlisted login; `requireOperator()` re-checks the SESSION identity and signs out on mismatch; `readSessionIdentity()` keeps a non-header `getUser()` fallback.
- [x] 6a-i.5 RED — `supabase/tests/operator-session-refresh.spec.ts`: a stale access token with a live refresh token, driven through the middleware handler, must put TWO session `Set-Cookie` headers on the response — including on a REDIRECT — and the rotated refresh token must reach the browser.
- [x] 6a-i.6 GREEN — `proxy.ts` + `lib/proxy/operator-session.ts` (Next 16.3 deprecated the `middleware` file convention in favour of `proxy`): one response is built and every return path carries the cookies Supabase wrote; the matcher is scoped to `/console/:path*` so the guest gate never pays for an auth round-trip.
- [x] 6a-i.7 GREEN — `app/console/login/**` and `app/console/auth/callback/route.ts`: magic-link entry and exchange, with the allowlist checked server-side before any mail is sent.
- [x] 6a-i.8 GREEN — `app/console/layout.tsx` and a minimal authenticated `app/console/page.tsx` landing that proves the session works.
- [x] 6a-i.9 RED — `e2e/console-auth.spec.ts`: an unauthenticated visitor cannot reach `/console`; an unallowlisted address gets the same response as an operator address and receives no mail; an allowlisted address completes the magic link, reaches the console, and binds `senders.auth_user_id`.
- [x] 6a-i.10 GREEN — `playwright.config.ts` may no longer attach to a foreign dev server; the E2E suite always builds and starts its own.
- [x] 6a-i.11 Verify: `npm test`, `npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

## Phase 6a: Console Auth, Guest List, Device Declaration (Work Unit 6a)

- [x] 6a.1 (Done by 6a-i.3.) RED — `lib/server/auth.spec.ts`: an unallowlisted email is denied and creates no session mapped to any sender; an allowlisted email resolves to exactly one `senders.auth_user_id` identity.
- [x] 6a.2 (Done by 6a-i.4.) GREEN — `lib/server/auth.ts`: `import 'server-only'` first line; Supabase Auth magic-link helpers; `requireOperator()` resolves via `senders.allowlisted_email`/`auth_user_id`, binding `auth_user_id` on first allowlisted login.
- [x] 6a.3 (Done by 6a-i.7.) GREEN — `app/console/login/page.tsx` and `app/console/auth/callback/route.ts`: magic-link entry/exchange.
- [x] 6a.4 (Done by 6a-i.8.) GREEN — `app/console/layout.tsx`: calls `requireOperator()`; redirects unauthenticated/non-allowlisted visitors to `/console/login`.
- [x] 6a.5 (Done by 6a-ii.1/6a-ii.2.) RED — `lib/server/invitations.spec.ts` addendum: a sender's default query returns only `owner_sender_id`-matching invitations; the shared dashboard query returns aggregate counts across all invitations.
- [x] 6a.6 (Done by 6a-ii.2.) GREEN — add partitioned + shared-dashboard query functions to `lib/server/invitations.ts`.
- [x] 6a.7 (Done by 6a-ii.5.) RED — RTL test: a non-owned row renders no send/dispatch button and shows an "owned by {name}" label.
- [x] 6a.8 (Done by 6a-ii.6/6a-ii.10.) GREEN — `app/console/page.tsx`: owned guest list with send buttons; non-owned rows show the owner label with no send affordance.
- [x] 6a.9 (Done by 6a-ii.3.) RED — `cookies.spec.ts` addendum: `device_sender` cookie sign/verify round-trip; an absent cookie is distinguished from a mismatched value.
- [x] 6a.10 (Done by 6a-ii.4.) GREEN — add device-cookie helpers to `lib/server/cookies.ts`.
- [x] 6a.11 (Done by 6a-ii.8.) GREEN — `app/console/device/page.tsx`: per-device WhatsApp-account picker writing the signed `device_sender` cookie (`httpOnly`, `path=/console`, 1 year).
- [x] 6a.12 (Done by 6a-ii.9.) GREEN — wire `app/console/layout.tsx`: an absent device cookie redirects to `/console/device` (never a silent default); a mismatch renders a non-dismissible interstitial blocking dispatch while the read-only progress view stays available.
- [x] 6a.13 (The auth half landed in 6a-i.9; the list/device half in 6a-ii.11.) RED — `e2e/console-auth.spec.ts`: unallowlisted email denied; allowlisted sender reaches their dashboard; default view lists only owned invitations; shared dashboard shows all; non-owner sees no send button; device mismatch blocks dispatch with the interstitial and a match allows it to proceed.
- [x] 6a.14 (Done by 6a-ii.12.) Verify: run the console E2E — confirm 6a.1, 6a.5, 6a.7, 6a.9, 6a.13 RED tests pass GREEN.

## Phase 6a-ii: Console Guest List and Per-Device Declaration (Work Unit 6a-ii)

> The second half of Work Unit 6a. Authentication and session survival landed in 6a-i;
> this unit adds the partitioned guest list, the scoped progress figures, the inline
> phone editor and the per-device WhatsApp declaration with its blocking interstitial.
> It sends nothing: dispatch and both preview surfaces remain Work Unit 6b.

- [x] 6a-ii.1 RED — `lib/domain/dispatch-state.spec.ts` and `lib/domain/console-list.spec.ts`: `link_opened` never satisfies a "has been invited" predicate and carries its own label; every scoped metric states numerator, denominator and population; a reduced answer is projected without re-deriving it from a history.
- [x] 6a-ii.2 GREEN — `lib/domain/dispatch-state.ts`, `lib/domain/console-list.ts`, and the console read side of `lib/server/invitations.ts` (`listConsoleInvitations`, `listOperatorProfiles`, `findGuestInvitationOwner`, `updateGuestPhone`); every answer read goes through `rsvp_latest`, never `rsvp_responses`.
- [x] 6a-ii.3 RED — `lib/server/cookies.spec.ts` addendum: `device_sender` sign/verify round-trip; an absent declaration is distinguished from a mismatched one; a forwarded operator-identity header is not accepted as a declaration.
- [x] 6a-ii.4 GREEN — device-cookie helpers in `lib/server/cookies.ts`, HMACed with `OPERATOR_SESSION_SECRET` under a distinct signing prefix so the two message spaces cannot be replayed into each other.
- [x] 6a-ii.5 RED — RTL: a non-owned row renders no send affordance and names its owner; an opened link is never labelled as a send; the list uses no popover row menu; the inline editor submits guest id plus phone and flags an unreachable line.
- [x] 6a-ii.6 GREEN — `components/console/{GuestList,GuestPhoneField,ProgressSummary}.tsx`, props-only, with row actions in normal flow rather than an absolutely positioned menu.
- [x] 6a-ii.7 RED/GREEN — `lib/domain/device-declaration.ts` + `components/console/{DeviceDeclarationForm,DeviceMismatchNotice}.tsx`: an absent or blank declaration classifies as `undeclared` and never as the signed-in operator; the picker preselects nobody; the interstitial names both sides and offers two exits and no dismissal.
- [x] 6a-ii.8 GREEN — `app/console/device/{page,actions}.tsx`, outside the `(authenticated)` group so the redirect to it cannot loop; the submitted id is validated against the real sender list before it is signed.
- [x] 6a-ii.9 GREEN — `lib/server/console-session.ts` gains `readDeviceDeclaration`/`requireDeclaredDevice`; `app/console/(authenticated)/layout.tsx` redirects an undeclared device to the picker and renders the interstitial over a read-only view on a mismatch.
- [x] 6a-ii.10 GREEN — `app/console/(authenticated)/page.tsx` (owned partition + shared dashboard) and `actions.ts` (`updateGuestPhoneAction`: session identity, declaration match, and server-resolved guest ownership all checked before the write).
- [x] 6a-ii.11 RED — `e2e/console-guest-list.spec.ts`: an undeclared device is asked rather than defaulted; clearing the declaration re-asks; a match opens the console and a mismatch blocks it with the interstitial; the default view lists only owned invitations; the shared dashboard is strictly wider and offers no send button on the other's rows; a household that answered yes then no is counted once as declined; an opened link is never counted as a send; the inline editor stores E.164 and flags a landline. Also re-asserts the deferred half of 4b.12 with a real operator session.
- [x] 6a-ii.12 Verify: `npm test`, `PORT=3100 npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

## Phase 6b-i: Dispatch and the Send Preflight (Work Unit 6b-i)

> The first half of Work Unit 6b. The dispatch action, the two-step confirmation
> and the readiness check land here; both preview surfaces, the `InvitationBody`
> extraction and Realtime land in Work Unit 6b-ii. It also carries the
> `updateGuestPhoneAction` decoupling from the 6a-ii review.

- [x] 6b-i.1 RED — `lib/domain/dispatch-message.spec.ts`: the draft greets the household and carries exactly one URL; every digit it renders comes from that URL, so no date or venue can be hard-coded into it; a second URL is refused because only the first gets a preview card; the recipient is the first household member whose number can actually receive WhatsApp.
- [x] 6b-i.2 GREEN — `lib/domain/dispatch-message.ts`: `INVITATION_MESSAGE_TEMPLATE` (Spanish, neutral, `{{greeting_name}}` + `{{invitation_url}}` only), `buildInvitationMessage`, `buildInvitationDispatchLink`, `selectDispatchRecipient`, `DISPATCH_EVENT_BEACON_PATH`, `consoleDispatchPath`.
- [x] 6b-i.3 RED — `lib/domain/dispatch-preflight.spec.ts`: households with no number, with a number that cannot receive WhatsApp, and already dispatched are three separate groups with three different remedies; an opened link is NOT already dispatched; every group states its count against a named population; the rendered copy names people and contains no stored number.
- [x] 6b-i.4 GREEN — `lib/domain/dispatch-preflight.ts`: `buildDispatchPreflight`, `PREFLIGHT_BLOCKER_ORDER`, reusing `classifyPhoneDispatchability` (through `selectDispatchRecipient`) and `countsAsOperatorAssertedSend`.
- [x] 6b-i.5 RED/GREEN — `lib/browser/beacon.ts` + spec: `postEventBeacon` returns synchronously in every path, falls back to `fetch(..., { keepalive: true })` without awaiting it, and reports a failure as a value rather than throwing. `lib/browser/navigation.ts` is the untestable seam that makes the ordering assertable.
- [x] 6b-i.6 RED — `lib/server/dispatch.spec.ts` (local Supabase): the same `client_event_id` is written once and the retry reports `recorded: false`; two absent ids stay two rows; an actor who is not the owner is STORED, not rejected; an event for a missing invitation is refused; a correction is appended, never an edit.
- [x] 6b-i.7 GREEN — `lib/server/dispatch.ts`: `import 'server-only'` first line; `recordDispatchEvent` (idempotent via `dispatch_events_client_event_idx`, catching `23505`), `recordLinkOpened`, `markSent`, `markFailed`, `listDispatchEvents`.
- [x] 6b-i.8 GREEN — `app/console/api/dispatch-event/route.ts`: plain `POST` route handler per D8, 204 always, `link_opened` only, `actor_sender_id` from the session, body read as text then parsed so one parser serves the beacon and the keepalive fallback.
- [x] 6b-i.9 RED — `components/console/DispatchLauncher.spec.tsx`: the beacon is posted BEFORE the navigation and the navigation happens synchronously inside the click, awaiting nothing; it navigates even when the write is unavailable; the stashed `client_event_id` is re-posted on return rather than a new one; there is no second route to `wa.me` that would skip the recording.
- [x] 6b-i.10 GREEN — `components/console/DispatchLauncher.tsx`: mint, stash, beacon, navigate; reconcile on mount and on `visibilitychange`; "Marcar como enviada" / "No se pudo enviar" wired to the Server Actions.
- [x] 6b-i.11 RED/GREEN — `components/console/DispatchPreflight.{spec.tsx,tsx}`: an empty group renders as empty rather than absent, and no stored number reaches the DOM.
- [x] 6b-i.12 GREEN — `lib/server/invitations.ts` `findConsoleInvitation`: ownership and id applied as one `WHERE`, reduced by the same path as the list.
- [x] 6b-i.13 GREEN — `app/console/(authenticated)/dispatch/[invitationId]/page.tsx` inside the route group, so the device gate holds above it; `notFound()` answers "does not exist" and "not yours" identically.
- [x] 6b-i.14 GREEN — `app/console/(authenticated)/actions.ts`: `markDispatchSentAction` / `markDispatchFailedAction` behind session, declaration and server-resolved ownership. **`updateGuestPhoneAction` no longer checks the declaration** — editing a number sends nothing, and the gate that stops a message leaving the wrong account must not stop the data entry the preflight is asking for.
- [x] 6b-i.15 GREEN — `components/console/GuestList.tsx` splits `readOnly` from `dispatchBlocked`, and `app/console/(authenticated)/page.tsx` renders the preflight over the operator's own partition.
- [x] 6b-i.16 RED — `e2e/console-dispatch.spec.ts`: the preflight names each blocked household and prints no digits; opening the link navigates to a `wa.me` URL whose text carries one URL and no other digit, and records `link_opened` attributed to the session; returning re-posts and does not double-count; the confirmation records `marked_sent`; a landline household is refused; a not-owned invitation 404s exactly like a missing one; a mismatched declaration blocks the dispatch while the phone editor keeps working.
- [x] 6b-i.17 Verify: `npm test`, `PORT=3100 npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

## Phase 6b: Dispatch and Previews (Work Unit 6b)

- [x] 6b.1 (Done by 6b-i.6.) RED — `lib/server/dispatch.spec.ts`: a `link_opened` insert is idempotent on `client_event_id`; `marked_sent`/`marked_failed` always attribute `actor_sender_id` from the server session; an owner/actor mismatch is stored, not rejected.
- [x] 6b.2 (Done by 6b-i.7.) GREEN — `lib/server/dispatch.ts`: `import 'server-only'` first line; `recordDispatchEvent(...)` upserting on `dispatch_events_client_event_idx`; `markSent`/`markFailed`.
- [x] 6b.3 (Done by 6b-i.8.) GREEN — `app/console/api/dispatch-event/route.ts`: plain `POST` route handler (not a Server Action, per design decision D8 — beacons carry a UA-controlled content type a Server Action's encoding contract does not honor), returns 204, idempotent on `client_event_id`.
- [x] 6b.4 (Done by 6b-i.9.) RED — RTL/Vitest test: `navigator.sendBeacon` fires the `link_opened` payload BEFORE `window.location.href` is set, and the call site never awaits anything before navigating.
- [x] 6b.5 (Done by 6b-i.10/6b-i.13.) GREEN — `app/console/dispatch/[invitationId]/page.tsx` compose view: mint `client_event_id`, stash in `sessionStorage`, call `sendBeacon` before navigation; if `sendBeacon` returns `false`, fall back to `fetch(url, { keepalive: true })` without awaiting it.
- [x] 6b.6 (Done by 6b-i.9; the "only if no row exists" check is the unique index, server-side — see apply-progress.) RED — RTL/Vitest test: on `visibilitychange` to visible, the compose view refetches dispatch state and re-POSTs the stashed `client_event_id` only if no matching row exists yet (idempotent retry, no duplicate).
- [x] 6b.7 (Done by 6b-i.10/6b-i.14.) GREEN — implement the `visibilitychange` reconciliation handler plus the "Mark as sent" / "Could not send" UI wired to `markSent`/`markFailed`.
- [x] 6b.8 (Done by 6b-ii.8.) RED — Vitest/RTL snapshot: `WhatsAppBubble`'s rendered `<img src>` carries no query string or cache-busting parameter.
- [x] 6b.9 (Done by 6b-ii.8/6b-ii.9. DEVIATION: the `<img src>` is the ADVERTISED `og:image` path, not the bare route path — see apply-progress.) GREEN — `components/console/WhatsAppBubble.tsx`: props-only; `<img src="/i/{slug}/opengraph-image">` with no cache-buster (a busted URL would be a different CDN cache key and defeat warming); message text, raw `wa.me` URL, character count, "Aproximado — el resultado real varía según el dispositivo" disclosure listing truncation behavior, card-size selection, per-platform rendering, the single-URL-preview limit, and the emoji-set difference.
- [x] 6b.10 (Delivered earlier; verified by 6b-ii.) RED — Vitest snapshot pinning `components/invitation/InvitationBody.tsx` as the drift guard.
- [x] 6b.11 (Delivered earlier; verified by 6b-ii.) GREEN — `components/invitation/InvitationBody.tsx`: sync RSC, props-only, shared by both the public and admin routes.
- [x] 6b.12 (Delivered earlier; verified by 6b-ii.) GREEN — wire `app/i/[slug]/page.tsx` to render `InvitationBody` after unlock, replacing Phase 4b's placeholder.
- [x] 6b.13 (Done by 6b-ii.10.) GREEN — `app/console/preview/[invitationId]/page.tsx`: admin-only RSC behind `requireOperator()`, fetches by id, renders `InvitationBody`; no new authorization axis.
- [x] 6b.14 (Done by 6b-ii.12.) RED — `e2e/console-preview.spec.ts`: the admin preview body and the unlocked public body render identical text for a seeded fixture; an unauthenticated visitor is denied with no content rendered; the mock-bubble preview image is byte-identical to a direct fetch of `/i/<slug>/opengraph-image`; every dispatch produces a `dispatch_events` row with `actor_sender_id`; a bypassed device-declaration mismatch still records the mismatched actor/owner pair.
- [ ] 6b.15 NOT DONE — deferred out of Work Unit 6b-ii; see 6b-ii.14. GREEN — wire Supabase Realtime on `dispatch_events` so both consoles receive live updates after a `marked_sent`/`marked_failed` insert.
- [x] 6b.16 (Done by 6b-ii.13.) Verify: run `e2e/console-preview.spec.ts`, the dispatch RTL suite, and full `npm test`/`npm run e2e` — confirm 6b.1, 6b.4, 6b.6, 6b.8, 6b.10, 6b.14 RED tests pass GREEN.

## Phase 6b-ii: The Two Console Preview Surfaces (Work Unit 6b-ii)

> The second half of Work Unit 6b, and the last unit of the original plan.
> Both preview surfaces land here, together with the three findings left open by
> the 6b-i review. `InvitationBody` and its public wiring (6b.10-6b.12) were
> already delivered by earlier units; this unit verified them and built the two
> routes around them. Supabase Realtime (6b.15) is NOT included — see below.

- [x] 6b-ii.1 RED/GREEN — `lib/domain/uuid.{ts,spec.ts}`: one anchored, case-insensitive `isWellFormedUuid`, shared by the console repository and the beacon route so a malformed identifier never reaches the driver.
- [x] 6b-ii.2 RED/GREEN — `lib/server/invitations.ts` `listConsoleInvitations` answers a malformed `invitationId` as not-found WITHOUT a round trip, closing **`R3-malformed-invitation-id-500`**. `invitations.id` is a `uuid` column and Postgres raises `22P02` rather than returning zero rows, so a mistyped console URL used to report a broken server.
- [x] 6b-ii.3 RED — `app/console/(authenticated)/actions.spec.ts`: proves all four guards on `markDispatchSentAction` / `markDispatchFailedAction` (session identity, server-resolved ownership applied as part of the lookup, the device-declaration gate, the missing-id refusal) and the deliberate ABSENCE of the declaration gate on `updateGuestPhoneAction`. Closes **`R3-dispatch-action-guard-unproved`**; mutation-checked by disabling each guard.
- [x] 6b-ii.4 RED — `app/console/api/dispatch-event/route.spec.ts`: proves every refusal — 401 without a session and never a redirect, 400 for non-JSON, non-object, missing or non-uuid ids, 204 for a duplicate and for a vanished invitation, an empty body on every path, and `actor_sender_id` taken from the session while a body-supplied actor or `kind` is ignored. Closes **`R3-beacon-route-refusals-unproved`**.
- [x] 6b-ii.5 RED/GREEN — `resolveConsoleRedirect` exempts `/console/api/**`. **Defect found by 6b-ii.4's end-to-end half**: the proxy redirected an unauthenticated beacon with a 307 before the route could answer 401, so `sendBeacon` followed it, received the login page with a 200 and reported success while nothing was recorded. The route's 401 was unreachable in production.
- [x] 6b-ii.6 RED/GREEN — `lib/server/og-warm.ts` gains `resolveAdvertisedCardPath`, sharing one `og:image` extractor with `warmOgCard`. Reads the page from a REACHABLE origin (`consoleOrigin()`) and returns the ADVERTISED URL as a same-origin path; `null` on every failure, never a fallback to the bare route path.
- [x] 6b-ii.7 RED/GREEN — `lib/domain/message-preview.{ts,spec.ts}`: the approximation label, the six known divergences, and `describeMessageLength` with an explicitly approximate `READ_MORE_APPROX_CHARACTERS` soft warning.
- [x] 6b-ii.8 RED/GREEN — `components/console/WhatsAppBubble.{tsx,spec.tsx}` (subsumes 6b.8/6b.9): props-only, snapshot-pinned, `<img src>` asserted character by character against the advertised path, no cache-buster, plain `<img>` rather than `next/image`, no clickable `wa.me`, all six divergences rendered uncollapsed.
- [x] 6b-ii.9 GREEN — `app/console/(authenticated)/dispatch/[invitationId]/page.tsx` resolves the advertised card path server-side and renders the bubble beside the launcher.
- [x] 6b-ii.10 GREEN — `app/console/(authenticated)/preview/[invitationId]/page.tsx` (6b.13): admin-only RSC inside the `(authenticated)` group, owned-only lookup, `notFound()` for missing / foreign / malformed alike, renders `InvitationBody` from the same `toGuestFacingInvitation` projection the public route reads, with no RSVP slot and a plain link to `/i/{slug}` for reading the gate screen as a guest does.
- [x] 6b-ii.11 RED/GREEN — `consolePreviewPath` in `lib/domain/operator-session.ts`, and an owned-row preview link in `components/console/GuestList.tsx` that SURVIVES a device-declaration mismatch (reading sends nothing) while the send affordance does not.
- [x] 6b-ii.12 RED — `e2e/console-preview.spec.ts` (6b.14), 22 tests: the admin body and the unlocked public body are byte-identical outside the RSVP slot; an unauthenticated visitor is denied with no content; the bubble's image is exactly the advertised `og:image` and its bytes equal a direct fetch of the card route; no query parameter bypasses the public gate even with an operator session; a mismatched actor/owner pair is still recorded.
- [x] 6b-ii.13 Verify: `npm test` 933 passed, `PORT=3100 npm run e2e` 124 passed, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` — all clean.
- [ ] 6b-ii.14 NOT DONE — 6b.15 Supabase Realtime on `dispatch_events`. Deliberately excluded from this unit: it is a live-update concern rather than a preview surface, it needs a publication/RLS decision and probably a migration, and adding it would have pushed this unit past its changed-line ceiling. It is the only item of the original Work Unit 6b still outstanding.

## Phase 7-auth: Operator Password Sign-In and Seeding (Work Unit 7)

> The sign-in METHOD changes and nothing else. The session rotation fix and its
> mutation-proven test, the HMAC-signed identity header, the `senders`
> allowlist (D7), the belt-and-braces session re-check, the device declaration
> and the `/console/api` redirect exemption are all untouched.
>
> Phone auth was considered and rejected: it needs an SMS provider or extra
> configuration flags, while email and password is what Supabase gives natively
> with nothing added.

- [x] 7a.1 RED — `lib/server/auth.spec.ts`: the three refusals (a wrong password, a correct password for an address that is not in `senders`, and an address with no account at all) are compared against ONE ANOTHER, not against a literal; a companion asserts the admitted case is the one thing allowed to differ, so "refuse everybody" cannot pass.
- [x] 7a.2 GREEN — `lib/server/auth.ts`: `MagicLinkMailer`, `MAGIC_LINK_NOTICE` and `requestOperatorMagicLink` are replaced by `OperatorPasswordAuthenticator`, `SIGN_IN_NOTICE` and `signInOperator`. The password is verified FIRST, always — consulting the allowlist first would refuse a non-operator without any password check, which is a timing oracle no identical sentence can hide — and a session created by valid non-operator credentials is destroyed before returning.
- [x] 7a.3 GREEN — `supabaseOperatorPasswordAuthenticator` replaces `supabaseMagicLinkMailer`: `signInWithPassword`, every Supabase error collapsed to `null`, and `signOut` on the same cookie-bound client. `signInWithPassword` never creates a user, so no `auth.users` row can be made to appear by typing into the form.
- [x] 7a.4 RED/GREEN — `app/console/login/login-form.{spec.tsx,tsx}`: an email field and a masked `current-password` field, both credentials reaching the action byte for byte (the password is never trimmed), the refusal rendered as `role="status"`, the password never echoed back into the markup, and no sign-up, no reset, no "remember me", no link at all.
- [x] 7a.5 GREEN — `app/console/login/actions.ts` `signInAction`, and `magic-link-state.ts` renamed to `sign-in-state.ts`. A Server Action may write cookies, which is the whole reason the callback route existed.
- [x] 7a.6 GREEN — `app/console/auth/callback/route.ts` DELETED, with the E2E test of the tampered code that only it could fail. `e2e/console-auth.spec.ts` asserts the path now answers 404, so its absence is proved rather than assumed.
- [x] 7a.7 GREEN — `CONSOLE_AUTH_PATH_PREFIX` keeps its exemption for `/console/auth/sign-out`, which is still the only exit from "signed in but not an operator". The two tests that exercised the exemption through the callback path now exercise it through the sign-out path.
- [x] 7a.8 RED/GREEN — `lib/server/operators.{spec.ts,ts}` against a REAL local Supabase: `seedOperator` creates or updates the auth user through the admin API, upserts the `senders` row, binds `auth_user_id`, and is idempotent by address. The decisive assertion signs in with the seeded password using the PUBLISHABLE key, exactly as the login form does.
- [x] 7a.9 RED/GREEN — `scripts/seed-operators.{spec.ts,ts}`, following `import-guests.ts`: `parseOperatorSource`, `resolveOperatorSeeds`, `formatSeedOutcomes`. The untracked source (`data/operators.source.json`) carries display name, role, email, contact phone and the NAME of an environment variable; a row carrying a literal `password` key is REFUSED. Passwords come from the environment, never from the file and never from argv. No output line carries an address, a phone number, a run of seven digits, or a password — not even in an error message.
- [x] 7a.10 GREEN — `npm run seed:operators` wired in `package.json`; `.gitignore` names both untracked source paths explicitly; `.env.example`, `supabase/config.toml`, `playwright.config.ts` and the E2E header comments describe password sign-in rather than a mailbox.
- [x] 7a.11 RED — `e2e/helpers/operator.ts` seeds a confirmed auth user with a password through the admin API and adds `seedAuthOnlyAccount` (a valid identity that is NOT an operator); `senders.auth_user_id` is still left NULL so the binding is observed rather than assumed. `waitForMagicLink` and `messagesFor` are deleted.
- [x] 7a.12 RED — `e2e/console-auth.spec.ts`: the three refusals compared against one another as full observable outcomes (notice, landing path, session-cookie count), the stranger's momentary session proved not to survive, the seeded operator signing in and binding, the typed password absent from page source, the callback route 404, and the login page offering no sign-up or reset.
- [x] 7a.13 Verify: `npm test`, `PORT=3100 npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

## Phase 8: Console Design Foundation (Work Unit 8)

Presentation only: no route, behaviour, server action or query changed. Two palettes — graphite console, papery invitation — bound by shared type. Every rule is asserted as a measurement, not described.

- [x] 8.1 RED — `lib/design/contrast.spec.ts`: WCAG 2.x arithmetic pinned against published values (black-on-white 21:1, sRGB coefficients, alpha compositing, refusal of unmeasurable `oklch()`).
- [x] 8.2 GREEN — `lib/design/contrast.ts`: `parseCssColor`, `relativeLuminance`, `flatten`, `contrastRatio`, `WCAG_AA_NORMAL_TEXT`. Pure, dependency-free.
- [x] 8.3 RED — `lib/design/console-theme.spec.ts`: every declared foreground/background pair walked and held to 4.5:1; white-on-gold asserted BELOW the threshold so the suite is proven to have teeth.
- [x] 8.4 GREEN — `lib/design/console-theme.ts`: measured graphite tokens, `CONSOLE_SEMANTIC_COLOR_ROLES` (gold = attention, green = done, red = broken/missing, nothing else), hairlines excluded from the text threshold by name, `CONSOLE_RADIUS`, `CONSOLE_INPUT_MIN_FONT_SIZE_PX = 16`.
- [x] 8.5 RED/GREEN — `lib/design/paper-theme.{spec.ts,ts}`: the guest-facing palette under the same measurement, plus an assertion that the console gold is unreadable on paper.
- [x] 8.6 RED/GREEN — `tools/console-theme-css.spec.ts`: reads `app/globals.css` off disk and fails on token drift, on a surviving `oklch` grey from a `shadcn init`, on a `--font-*: var(--font-*)` self-reference, on `font-size: 15px`, on a missing `prefers-reduced-motion` block, and on any duration over 200ms.
- [x] 8.7 GREEN — `app/globals.css` rewritten: paper on `:root`, graphite on `.console-surface`, paper island on `.paper-surface`, literal font families in `@theme inline`, a 16px floor on every field, and reduced-motion honoured.
- [x] 8.8 RED/GREEN — `tools/app-fonts.spec.ts` + `app/layout.tsx`: Yeseva One (400), Hanken Grotesk (400/500/600/700), Caveat (`preload: false`), all `display: "swap"`, variable classes on `<html>` and never on `<body>`.
- [x] 8.9 GREEN — shadcn/ui initialised on the Radix base (`init -p nova -b radix`) with Tailwind v4: `button`, `card`, `input`, `label`, `table`, `badge`, `alert`, `separator`, `skeleton`, `sheet`, `alert-dialog`, `dropdown-menu`. `shadcn` and `tw-animate-css` moved to `devDependencies`; `md:text-sm` removed from the Input floor by a base-layer rule.
- [x] 8.10 RED/GREEN — `components/ui/panel.{spec.tsx,tsx}`: title is a REQUIRED prop, hint capped at 48ch, heading level selectable.
- [x] 8.11 RED/GREEN — `components/ui/stat.{spec.tsx,tsx}`: two emphases only, `tabular-nums`, `dt`/`dd` pairing, opt-in emphasis.
- [x] 8.12 RED/GREEN — `components/ui/stat-bar.{spec.tsx,tsx}`: `repeat(auto-fit, minmax(88px, 1fr))`, never `flex-wrap`.
- [x] 8.13 RED/GREEN — `components/ui/empty-state.{spec.tsx,tsx}`: `EmptyState` for "nothing yet" and a DIFFERENT `NoMatchesState` that keeps the filter visible and offers to clear it.
- [x] 8.14 RED/GREEN — `components/ui/error-region.{spec.tsx,tsx}`: an `aria-live="polite"` region mounted BEFORE its first message, with node identity preserved across the change.
- [x] 8.15 RED/GREEN — `components/ui/why-disabled.{spec.ts,ts}`: a disabled control always carries a stated reason; a blank reason throws.
- [x] 8.16 RED/GREEN — `components/ui/confirm-destructive.{spec.tsx,tsx}`: `AlertDialog` and never `Dialog`, `window.confirm` proven unused, focus proven trapped across six Tab presses.
- [x] 8.17 RED/GREEN — `lib/design/console-nav.{spec.ts,ts}`: ONE breakpoint (768px / `md`), 56px tab bar base, four parameterless destinations, no overflow sheet, and three redundant active signals (colour, weight, geometric mark).
- [x] 8.18 RED/GREEN — `tools/console-one-breakpoint.spec.ts`: reads every console source and fails on any responsive variant other than `md:`. It caught a stray `sm:px-6` in the shell.
- [x] 8.19 RED/GREEN — `lib/design/console-status.{spec.ts,ts}`: total tone functions over the dispatch, answer and readiness unions, so no call site chooses a colour. Green is reachable by exactly one RSVP answer.
- [x] 8.20 RED/GREEN — `components/console/{ConsoleShell,ConsoleNav,ConsoleNavCurrent,ConsoleHeader,StatusBadge,ConsoleSkeleton}`: sidebar above the breakpoint, bottom bar below, content padding read from `--console-tabbar-height`, skip link, sign-out kept out of the thumb-reach bar. `ConsoleNav` asserted to spend NONE of the three signal colours on the active tab.
- [x] 8.21 GREEN — the guest list restyled as a compact row: one headline line carrying the name and both status badges, a metadata line, guests as single lines, `min-w-0` on every truncating flex child. Guest names, stored numbers and the inline editor stay ON the row, because the standing E2E suite asserts they are visible there.
- [x] 8.22 GREEN — `ProgressSummary`, `DispatchPreflight`, `GuestPhoneField`, `DeviceMismatchNotice`, `DeviceDeclarationForm`, `DispatchLauncher`, `WhatsAppBubble` restyled in place, every class hook and DOM shape the E2E suite selects on preserved. The WhatsApp pane moved to `.paper-surface`; its approved-markup snapshot updated deliberately.
- [x] 8.23 GREEN — `app/console/{login,device}` and the authenticated pages restyled; the nested `<main>` elements collapsed to `div`s under the shell's single `main`.
- [x] 8.24 RED/GREEN — `components/console/ConsoleSkeleton.{spec.tsx,tsx}` plus an explicit local `<Suspense>` in the console root page. A `loading.tsx` was tried first and reverted: the route-group boundary turned the compose and preview routes' `notFound()` into a streamed 200, which an E2E run caught.
- [x] 8.25 RED/GREEN — `e2e/console-design.spec.ts`: computed input font-size at least 16px on a phone AND a desktop width, the console measured graphite, the invitation measured light, "Hanken Grotesk" measured as the loaded body family, the shell's single breakpoint flip, content padding equal to the measured bar height, the active tab's geometric mark, and reduced motion honoured. It caught three tabs marked active at once on `/console`.
- [x] 8.26 Verify: `npm test` (1215 passed), `PORT=3100 npm run e2e` (136 passed), `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` — all clean. Every standing invariant held.

### Work Unit 8 size

Authored change is roughly 3.7k lines (excluding ~1.1k of vendored shadcn registry files), far above the session's 800-line budget. It is one cohesive foundation — tokens, primitives, shell and the tests that hold them — and cannot be sliced without shipping a half-themed console. Recommend `size:exception`.

## Phase 9: Pinned Sidebar and Editable Wedding Facts (Work Unit 9)

- [x] 9.1 RED — `components/console/ConsoleNav.spec.tsx`: the sidebar declares sticky positioning, a top offset, a full dynamic-viewport height and its own vertical overflow; it spends no `vh`-based height class anywhere.
- [x] 9.2 GREEN — `components/console/ConsoleNav.tsx`: the sidebar becomes `md:sticky md:top-0 md:h-dvh md:overflow-y-auto`. `dvh` over `vh` because `vh` ignores a retracting mobile URL bar and this shell is phone-first. The bottom tab bar is untouched.
- [x] 9.3 RED — `supabase/tests/ceremony.spec.ts`: the singleton row also carries `couple_names`, `venue_name` and `venue_address`, all three seeded as visibly-unfinished placeholders; every one of the seven value columns refuses blank text; the singleton and default-deny postures still hold.
- [x] 9.4 GREEN — `supabase/migrations/0011_wedding_facts.sql` plus `supabase/down/0011_wedding_facts_down.sql`: three new `not null` text columns seeded with placeholders, and a non-empty check on all seven value columns now that a form can write them.
- [x] 9.5 RED — `supabase/tests/ceremony.spec.ts` addendum: `getCeremony` maps all seven columns; `updateCeremony` writes all seven and a later read returns exactly what was written.
- [x] 9.6 GREEN — `lib/server/ceremony.ts`: `CeremonyDetails` gains `coupleNames`, `venueName` and `venueAddress`; new `updateCeremony` writes the singleton by its boolean key and logs nothing.
- [x] 9.7 RED — `lib/domain/wedding-facts.spec.ts`: pure validation trims, refuses blank and over-long values, refuses line breaks and control characters, reports one error per field, and accepts a complete set.
- [x] 9.8 GREEN — `lib/domain/wedding-facts.ts`: the field list, the max lengths and `parseWeddingFacts`, free of React and of any storage vendor.
- [x] 9.9 RED — `components/invitation/InvitationBody.spec.tsx`: the body renders the couple, date, venue and address it is GIVEN, renders two different sets for two different props, and the module exports no hard-coded value.
- [x] 9.10 GREEN — `components/invitation/InvitationBody.tsx`: the four module constants are deleted and a `wedding` prop replaces them.
- [x] 9.11 RED — `lib/domain/og-card.spec.ts`: the card's one line of copy is built from the couple names supplied to it, and the constant no longer exists.
- [x] 9.12 GREEN — `lib/domain/og-card.ts`: `buildOgCardInvitationLine(coupleNames)`; `OG_CARD_INVITATION_LINE` deleted; `OgCardSource` gains `coupleNames`.
- [x] 9.13 RED — `lib/domain/dispatch-message.spec.ts`: the draft signs off with the couple names it is given, still contains exactly one URL, and still carries no digit outside that URL — so no date, time, venue or address entered the template.
- [x] 9.14 GREEN — `lib/domain/dispatch-message.ts`: `{{couple_names}}` added to the template and to `INVITATION_MESSAGE_VARIABLES`. Date, time, venue and address stay out, for the reason the module already records.
- [x] 9.15 GREEN — every surface reads the one row: `app/i/[slug]/page.tsx` (body and `generateMetadata`), `app/i/[slug]/opengraph-image.tsx`, `app/console/(authenticated)/preview/[invitationId]/page.tsx` and `.../dispatch/[invitationId]/page.tsx`, all through the request-cached `loadCeremony` or `getCeremony`.
- [x] 9.16 RED — `tools/no-source-placeholders.spec.ts`: no `{{UPPER_SNAKE}}` token survives anywhere in `app/**`, `components/**` or `lib/**` non-test source, comments included. The migration and the tests are exempt: the row's seeded placeholders are DATA, and that is the whole point.
- [x] 9.17 RED — `components/console/WeddingFactsForm.spec.tsx`: one form with all seven fields, one save; the immutable-Open-Graph-card warning beside the couple's names and the already-shared-passcode warning beside the passcode, both as text and not as a tooltip; the passcode field is not a browser-savable password; per-field errors render.
- [x] 9.18 GREEN — `components/console/WeddingFactsForm.tsx` and `app/console/(authenticated)/wedding/wedding-facts-state.ts`.
- [x] 9.19 RED — `app/console/(authenticated)/wedding/actions.spec.ts`: the action refuses without an operator session, validates on the server and writes nothing when validation fails, writes all seven fields when it passes, and passes no value to any logger.
- [x] 9.20 GREEN — `app/console/(authenticated)/wedding/actions.ts` and `page.tsx`. Either operator may edit: two people, no approval workflow.
- [x] 9.21 RED — `lib/design/console-nav.spec.ts`: the wedding editor is a navigation destination, and the bar is still at most five tabs with no overflow sheet.
- [x] 9.22 GREEN — `lib/design/console-nav.ts`: a fifth item, `Boda`, with a `calendar` icon.
- [x] 9.23 RED — `e2e/console-wedding.spec.ts`: an operator edits all seven facts through the real form; the invitation body and the page's `og:description` then both show the new couple names; both warnings are on the page; a blank field is refused with the old value still stored.
- [x] 9.24 Verify: `npm test`, `PORT=3100 npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `supabase db reset` followed by `npm test` again.
- [x] 9.25 Closes 5b.15 and the code half of 7.1: `{{WEDDING_DATE}}` is collapsed into `ceremony_date` and no wedding fact is stated in source any more. The VALUES are still the couple's to supply — now through the console instead of a migration.

### Work Unit 9 size

Authored change is roughly **3.5k lines** across 24 modified and 14 new files, far above the session's 800-line budget. It does not slice: the four constants cannot leave the source without a row to hold them, the row cannot be edited without the editor, the editor cannot exist without the nav destination and the validation, and the placeholder guard is the only thing that keeps any of it from being undone by the next value somebody needs in a hurry. Half of it would ship an invitation with no venue on it. Recommending `size:exception`; no comment, test or doc was compressed to chase the number.

## Phase 7: Placeholders and Finalization (non-blocking, no dependent tasks)

- [ ] 7.1 (Code half DONE by 9.1–9.25; the VALUES remain the couple's to supply, now through `/console/wedding` instead of a migration.) Once the couple supplies `{{COUPLE_NAMES}}`, `{{WEDDING_DATE}}`, `{{VENUE_NAME}}`, `{{VENUE_ADDRESS}}`, `{{APPROX_GUEST_COUNT}}`, `{{CEREMONY_DATE}}`, `{{CEREMONY_TIME}}`, `{{ZOOM_MEETING_ID}}` and `{{ZOOM_PASSCODE}}` (the last four are an `UPDATE` on the `ceremony` row, not a code edit), replace every placeholder occurrence in invitation copy, message templates, and RSVP deadline defaults. Do not invent values; do not block any other work unit on this.
- [ ] 7.2 Set `NEXT_PUBLIC_SITE_ORIGIN` before the first deploy; confirm `metadataBase`/`og:image` resolve to the real deployed origin.
- [ ] 7.3 Finalize the OG-card font choice (bundled Noto Sans vs. a custom ≤500 KB subset covering `ñ` and accented vowels); update `opengraph-image.tsx` if a custom font is chosen.
