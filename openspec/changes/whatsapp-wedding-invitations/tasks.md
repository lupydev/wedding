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
- [ ] 5b.15 Task 7.1 addendum — when the couple supplies the real details, `UPDATE` the `ceremony` row and collapse `InvitationBody`'s `{{WEDDING_DATE}}` into `ceremony_date` rather than leaving the date stated in two places.

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

## Phase 6b: Dispatch and Previews (Work Unit 6b)

- [ ] 6b.1 RED — `lib/server/dispatch.spec.ts`: a `link_opened` insert is idempotent on `client_event_id`; `marked_sent`/`marked_failed` always attribute `actor_sender_id` from the server session; an owner/actor mismatch is stored, not rejected.
- [ ] 6b.2 GREEN — `lib/server/dispatch.ts`: `import 'server-only'` first line; `recordDispatchEvent(...)` upserting on `dispatch_events_client_event_idx`; `markSent`/`markFailed`.
- [ ] 6b.3 GREEN — `app/console/api/dispatch-event/route.ts`: plain `POST` route handler (not a Server Action, per design decision D8 — beacons carry a UA-controlled content type a Server Action's encoding contract does not honor), returns 204, idempotent on `client_event_id`.
- [ ] 6b.4 RED — RTL/Vitest test: `navigator.sendBeacon` fires the `link_opened` payload BEFORE `window.location.href` is set, and the call site never awaits anything before navigating.
- [ ] 6b.5 GREEN — `app/console/dispatch/[invitationId]/page.tsx` compose view: mint `client_event_id`, stash in `sessionStorage`, call `sendBeacon` before navigation; if `sendBeacon` returns `false`, fall back to `fetch(url, { keepalive: true })` without awaiting it.
- [ ] 6b.6 RED — RTL/Vitest test: on `visibilitychange` to visible, the compose view refetches dispatch state and re-POSTs the stashed `client_event_id` only if no matching row exists yet (idempotent retry, no duplicate).
- [ ] 6b.7 GREEN — implement the `visibilitychange` reconciliation handler plus the "Mark as sent" / "Could not send" UI wired to `markSent`/`markFailed`.
- [ ] 6b.8 RED — Vitest/RTL snapshot: `WhatsAppBubble`'s rendered `<img src>` carries no query string or cache-busting parameter.
- [ ] 6b.9 GREEN — `components/console/WhatsAppBubble.tsx`: props-only; `<img src="/i/{slug}/opengraph-image">` with no cache-buster (a busted URL would be a different CDN cache key and defeat warming); message text, raw `wa.me` URL, character count, "Aproximado — el resultado real varía según el dispositivo" disclosure listing truncation behavior, card-size selection, per-platform rendering, the single-URL-preview limit, and the emoji-set difference.
- [ ] 6b.10 RED — Vitest snapshot pinning `components/invitation/InvitationBody.tsx` as the drift guard.
- [ ] 6b.11 GREEN — `components/invitation/InvitationBody.tsx`: sync RSC, props-only, shared by both the public and admin routes.
- [ ] 6b.12 GREEN — wire `app/i/[slug]/page.tsx` to render `InvitationBody` after unlock, replacing Phase 4b's placeholder.
- [ ] 6b.13 GREEN — `app/console/preview/[invitationId]/page.tsx`: admin-only RSC behind `requireOperator()`, fetches by id, renders `InvitationBody`; no new authorization axis.
- [ ] 6b.14 RED — `e2e/console-preview.spec.ts`: the admin preview body and the unlocked public body render identical text for a seeded fixture; an unauthenticated visitor is denied with no content rendered; the mock-bubble preview image is byte-identical to a direct fetch of `/i/<slug>/opengraph-image`; every dispatch produces a `dispatch_events` row with `actor_sender_id`; a bypassed device-declaration mismatch still records the mismatched actor/owner pair.
- [ ] 6b.15 GREEN — wire Supabase Realtime on `dispatch_events` so both consoles receive live updates after a `marked_sent`/`marked_failed` insert.
- [ ] 6b.16 Verify: run `e2e/console-preview.spec.ts`, the dispatch RTL suite, and full `npm test`/`npm run e2e` — confirm 6b.1, 6b.4, 6b.6, 6b.8, 6b.10, 6b.14 RED tests pass GREEN.

## Phase 7: Placeholders and Finalization (non-blocking, no dependent tasks)

- [ ] 7.1 Once the couple supplies `{{COUPLE_NAMES}}`, `{{WEDDING_DATE}}`, `{{VENUE_NAME}}`, `{{VENUE_ADDRESS}}`, `{{APPROX_GUEST_COUNT}}`, `{{CEREMONY_DATE}}`, `{{CEREMONY_TIME}}`, `{{ZOOM_MEETING_ID}}` and `{{ZOOM_PASSCODE}}` (the last four are an `UPDATE` on the `ceremony` row, not a code edit), replace every placeholder occurrence in invitation copy, message templates, and RSVP deadline defaults. Do not invent values; do not block any other work unit on this.
- [ ] 7.2 Set `NEXT_PUBLIC_SITE_ORIGIN` before the first deploy; confirm `metadataBase`/`og:image` resolve to the real deployed origin.
- [ ] 7.3 Finalize the OG-card font choice (bundled Noto Sans vs. a custom ≤500 KB subset covering `ñ` and accented vowels); update `opengraph-image.tsx` if a custom font is chosen.
