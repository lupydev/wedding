# Apply Progress: whatsapp-wedding-invitations

**Mode**: Standard (not Strict TDD)
**Batch**: 1 — Work Unit 1 (Scaffold + Strict TDD enablement)
**Branch**: `feat/whatsapp-wedding-invitations`
**Artifact store**: hybrid
**Prior progress read**: none — this is the first apply batch for this change.

## Why this batch is not Strict TDD

`openspec/config.yaml` carried `strict_tdd: false` (fail-closed) at the start of this
batch because no runnable test command existed anywhere in the repository. Work unit 1
is the unit that creates one. `tasks.md` states this explicitly, and `design.md` records
that "no RED-GREEN claim is valid before that slice". No RED-GREEN cycle was fabricated
for scaffolding. Every work unit from unit 2 onward runs under Strict TDD, which this
batch enabled.

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 1.1 Scaffold Next.js App Router + TS + ESLint with npm | Done | `create-next-app@latest` run in a scratch directory and moved in (the repository already contained `.atl/` and `openspec/`, which `create-next-app` refuses to scaffold over); Next.js 16.3.4, React 19.2.8 |
| 1.2 Install Vitest + testing deps; create `vitest.config.mts` | Done | All nine listed packages installed; `vitest.config.mts` defines a `unit` project (`environment: 'node'`) and a `component` project (`environment: 'jsdom'`) per the design's Testing Architecture table |
| 1.3 Install `@playwright/test`, create `playwright.config.ts`, run `npx playwright install` | Done | Chromium headless shell 153.0.8010.12 downloaded; `npx playwright test --list` loads the config and exits 0 |
| 1.4 `package.json` scripts | Done | `test`, `test:watch`, `test:coverage`, `typecheck`, `lint`, `format`, `format:check`, `build`, `e2e`, `dev`, `start` |
| 1.5 `next.config.ts` with `htmlLimitedBots: /.*/` | Done | Key placement verified against the installed package, not memory — see the section below |
| 1.6 `app/layout.tsx` with `metadataBase` | Done | `new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000")` |
| 1.7 ESLint `no-restricted-imports` zone for `lib/domain/**` | Done | Bans `react`, `react-dom`, `next`/`next/*`, `@supabase/*`, `server-only`, `node:*`, `../server/*`, `@/lib/server/*` |
| 1.8 ESLint `no-restricted-imports` zone for `components/**` | Done | Bans `@/lib/server/*`, `**/lib/server/*`, `@supabase/*` |
| 1.9 Flip `openspec/config.yaml` | Done | `strict_tdd: true`, `apply.tdd: true`, `apply.test_command: "npm test"`, `verify.test_command: "npm test"`, `verify.build_command: "npm run build"` |
| 1.10 Verify clean-clone install + build | Done | See Work Unit Evidence |
| 1.11 Verify `npm test` with zero test files exits successfully | Done | See Work Unit Evidence |
| 1.12 Verify `strict_tdd: true` and an executable `apply.test_command` | Done | See Work Unit Evidence |

## `htmlLimitedBots` key placement — verified, not guessed

The task and the design both flag that this key was `experimental.htmlLimitedBots` on
Next.js 15.2 and was promoted to the top level afterwards. The installed version is
**16.3.4**, and `node_modules/next/dist/server/config-shared.d.ts` declares
`htmlLimitedBots?: RegExp` as a **top-level `NextConfig` member** (adjacent to
`outputFileTracingExcludes`, `outputHashSalt`, `watchOptions`), not inside
`experimental`. It is therefore placed at the top level.

Three independent confirmations: `tsc --noEmit` accepts it against the installed types;
`next build` runs `next.config.ts` and emits no "invalid next.config.ts options"
warning; and the declaration itself was read from the installed package. Task 4a.15
still holds the raw-HTML E2E as the final authority once a `generateMetadata` route
exists.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm test` → `vitest run` → **exit 0**, `Test Files 1 passed (1)`, `Tests 8 passed (8)` |
| Zero-test-file behaviour | `npx vitest run zzz-no-such-file` → **exit 0** (`passWithNoTests: true`), satisfying the spec scenario "no test files is not a failure" |
| Runtime harness command/scenario and exact result | Clean-copy of the working tree (no `node_modules`, no `.next`, no `next-env.d.ts`, no `tsbuildinfo`): `npm ci` → exit 0; `npm run build` → **exit 0**, `Compiled successfully`, `Finished TypeScript`, routes `/` and `/_not-found` prerendered, zero TypeScript errors; `npm test` in that same clean copy → exit 0, 8 passed. Playwright browser install completed; `npx playwright test --list` loads `playwright.config.ts` and exits 0 with zero E2E specs (the first E2E specs land in work unit 4a) |
| Additional gates | `npm run typecheck` → exit 0; `npm run lint` → exit 0, zero findings; `npm run format:check` → "All matched files use Prettier code style" |
| Rollback boundary | Delete every repository entry except `.git/`, `.atl/`, `openspec/`, and revert `.gitignore` and `openspec/config.yaml` to `a2a371e`. Nothing outside the scaffold exists yet, so no other work can be orphaned |

## Architectural import zones are proven, not asserted

`tools/eslint-zones.spec.ts` (8 assertions) drives the real ESLint configuration
through the ESLint Node API and asserts that:

- an import of `react`, `next/navigation`, `@supabase/supabase-js`, `node:crypto`, or
  `server-only` from a `lib/domain/**` path produces exactly one `no-restricted-imports`
  error at severity 2;
- `libphonenumber-js` (a deterministic, I/O-free computation dependency, per design
  decision D1) is still allowed inside `lib/domain/**`;
- an import of `@/lib/server/*` from a `components/**` path is an error, while `react`
  is allowed there.

This is what makes task 2.16's smoke check meaningful rather than ceremonial: the zone
is under test, so a config refactor that silently stops matching fails `npm test`.

## Files Changed

| File | Action | Notes |
|---|---|---|
| `package.json` | Created | Next 16.3.4 / React 19.2.8; all task 1.4 scripts |
| `package-lock.json` | Created | Generated lockfile (excluded from authored-line risk count) |
| `tsconfig.json` | Created | Scaffold default; `@/*` path alias |
| `next.config.ts` | Created | `htmlLimitedBots: /.*/` at top level |
| `eslint.config.mjs` | Modified | Added the `lib/domain/**` and `components/**` import zones and project ignores |
| `app/layout.tsx` | Created | `metadataBase`; `lang="es"` |
| `app/page.tsx` | Created | Minimal placeholder; the real surfaces are `/i/[slug]` and `/console` |
| `app/globals.css` | Created | Minimal reset; system font stack |
| `app/favicon.ico` | Created | Scaffold default |
| `vitest.config.mts` | Created | `unit` (node) and `component` (jsdom) projects; `passWithNoTests: true`; v8 coverage |
| `vitest.setup.ts` | Created | `@testing-library/jest-dom/vitest` |
| `playwright.config.ts` | Created | `testDir: ./e2e`; runs against a production build, not `next dev` |
| `tools/eslint-zones.spec.ts` | Created | Proof that both import zones are active |
| `.prettierignore` | Created | Excludes `openspec/` so planning artifacts are never reformatted |
| `.gitignore` | Modified | Merged scaffold ignores with the existing `.atl/` rule; added Playwright artifacts and a `!.env.example` exception |
| `lib/domain/`, `lib/server/`, `components/invitation/`, `components/console/`, `e2e/` | Created | Directory skeleton with `.gitkeep`, so later units have somewhere to land |
| `openspec/config.yaml` | Modified | `strict_tdd: true`; `strict_tdd_intent` removed; `testing.status: installed`; apply/verify commands populated |
| `openspec/changes/.../tasks.md` | Modified | Tasks 1.1–1.12 marked `[x]` |

## Decisions and deviations

1. **Scaffolded via a scratch directory.** `create-next-app` refuses to scaffold into a
   directory containing `.atl/` and `openspec/`. The generated tree was produced in a
   scratch directory and moved in. The resulting configuration is the unmodified
   `create-next-app` output plus the changes the tasks require.
2. **No Tailwind, no `src/` directory.** Neither `design.md` nor
   `specs/project-scaffold/spec.md` specifies a styling system, and the design's module
   map is root-relative (`lib/domain/**`, `lib/server/**`, `components/**`). Adding an
   unrequested dependency was treated as scope expansion. Tailwind can be added later
   without touching the module boundaries.
3. **`@types/node` bumped from `^20` to `^26`.** Vitest 5 declares a peer of
   `@types/node@^22 || >=24`, and the scaffold pinned `^20`. This is a genuine conflict,
   not a resolver quirk, so it was fixed by matching the installed Node runtime (26.8.1)
   rather than by `--legacy-peer-deps`.
4. **Scaffold boilerplate removed.** `AGENTS.md`, the generated `CLAUDE.md`, the Next.js
   welcome `README.md`, `app/page.module.css`, and `public/*.svg` were dropped. They are
   template marketing content, and the generated `CLAUDE.md`/`AGENTS.md` would have
   injected unrelated agent instructions into the repository.
5. **`next/font/google` removed from the root layout.** It requires a network fetch at
   build time. The layout uses a system font stack instead. Font selection for the OG
   card is task 7.3 and is deliberately untouched.
6. **`strict_tdd_intent` removed rather than kept.** It recorded a deferred intention
   that this work unit fulfilled. Leaving it beside `strict_tdd: true` would suggest the
   gate is still pending. The reason is documented in the config comment.
7. **`lang="es"` on `<html>`.** No guest-facing copy lands in this unit; this is
   document metadata for a Spanish-language product, consistent with the locked context.

## Known follow-ups (not blockers)

- `vite-tsconfig-paths` is installed as `tasks.md` 1.2 requires, but Vite 8 resolves
  tsconfig paths natively and prints an informational notice on every `npm test` run.
  A later unit may drop the plugin for `resolve.tsconfigPaths: true`.
- `npm run e2e` exits non-zero while `e2e/` holds no specs ("No tests found"). The spec
  only requires the zero-file guarantee for `npm test`, and work unit 4a lands the first
  E2E spec, so no `--pass-with-no-tests` flag was added.
- npm 11 did not run the `unrs-resolver` postinstall script (its install-scripts
  approval gate). `npm run lint` works regardless. If a future ESLint import-resolver
  rule needs the native binary, run `npm install-scripts approve unrs-resolver`.
- Runtime dependencies (`@supabase/supabase-js`, `libphonenumber-js`, `zod`,
  `server-only`) are deliberately NOT installed; they belong to work units 2 and 3.

## Workload / PR boundary

- Mode: single PR, branch-level `size:exception` accepted by the maintainer.
- Current work unit: 1 of 8.
- Boundary: starts from `a2a371e` (planning artifacts only), ends with a runnable,
  buildable, lintable, testable Next.js scaffold and Strict TDD enabled.
- Authored lines: ~460 excluding the generated `package-lock.json`, against a session
  budget of 800. The forecast estimated ~150; the overage is the ESLint zone proof test
  (87 lines) and the two harness configs, all of which the tasks require.
- No commit was made. The working tree is convergent: every source-mutating normalizer
  (`prettier --write`, `eslint`) was run before finishing, and `format:check` is clean.

## Status

12/12 Work Unit 1 tasks complete. Work units 2–8 (tasks 2.1 onward) are untouched and
now run under Strict TDD. Ready for `sdd-verify`.

## Native attempt settlement — maintainer decision required

`gentle-ai sdd-attempt settle` recorded attempt 1 with `outcome: passed` and the
evidence revision, then returned `blocked` with `reason: maintainer_decision`. Current
accounting:

| Field | Value |
|---|---|
| `active/attempt outcome` | `passed` |
| `changed_lines` | 8991 |
| `max_changed_lines` | 800 |
| `decision_required` | `true` |
| `next_action` | `reset` |

The overrun is **not** authored code. `package-lock.json` alone is 8326 generated lines;
authored text is roughly 460 lines, comfortably inside the session's 800-line review
budget, and `sdd-phase-common.md` section E explicitly excludes generated artifacts from
the authored-risk count. The native counter does not make that distinction.

This is a maintainer decision by design, so the executor did not run it. The maintainer
resolves it with `gentle-ai sdd-attempt reset --cwd <repo> --change
whatsapp-wedding-invitations --expected-revision <the revision status prints>
--request-id "<unique>" --reason "<why>" --actor "<actor>"`. No implementation work is
outstanding, and nothing was committed.

---

# Apply Progress — Batch 2

**Mode**: Strict TDD (active)
**Batch**: 2 — Work Unit 2 (pure domain functions)
**Branch**: `feat/whatsapp-wedding-invitations`
**Artifact store**: hybrid
**Prior progress read**: yes — batch 1 above was read in full and is preserved unchanged.
**Attempt token**: continued the parent's active attempt (`sha256:fd240f58…a51827`).

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 2.1 RED `normalizePhone` table | Done | 23 table-driven cases; failed with `Cannot find module './phone'` |
| 2.2 GREEN `normalizePhone` | Done | `parsePhoneNumberFromString`; discriminated `{ ok }` union, never throws |
| 2.3 RED storage/gate/match | Done | 25 new failures before implementation |
| 2.4 GREEN storage/gate/match | Done | 100% coverage on `phone.ts` (see 2.17) |
| 2.5 **PARTIAL** | Blocked | Table spans MX/AR/US and is extended with a `resolveDefaultCountry` guard; the `.env.example` write is denied by the environment |
| 2.6 RED `buildWaMeLink` encoding | Done | 22 cases; failed with `Cannot find module './wa-link'` |
| 2.7 GREEN `buildWaMeLink` | Done | 100% coverage on `wa-link.ts` |
| 2.8 RED `renderMessageTemplate` | Done | 14 cases; module did not exist |
| 2.9 GREEN `renderMessageTemplate` | Done | Missing/empty variable throws and names every offender |
| 2.10 RED slug | Done | 24 cases including the 10,000-sample uniqueness check |
| 2.11 GREEN slug | Done | `encodeSlug`, `SLUG_BYTE_LENGTH = 10`, `isWellFormedSlug` |
| 2.12 RED `evaluateGate` | Done | 16 cases; module did not exist |
| 2.13 GREEN `evaluateGate` | Done | Both scopes with injected `now` |
| 2.14 RED `validateRsvpSelection` | Done | 11 cases; module did not exist |
| 2.15 GREEN `validateRsvpSelection` | Done | Hard cap plus tampering shapes |
| 2.16 Verify ESLint zone | Done | See below — smoke violation added, failed lint, removed |
| 2.17 Verify coverage | Done | See the coverage table below |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.1/2.2 | `lib/domain/phone.spec.ts` | Unit | N/A (new) | Written — `Cannot find module './phone'` | Passed (23) | 23 cases | Extracted `MEXICO_*` constants; restructured the legacy retry |
| 2.3/2.4 | `lib/domain/phone.spec.ts` | Unit | 24/24 passing before edit | Written — 25 failures | Passed (49) | 25 cases | Reused `deriveGateKey` inside `matchesInvitation` |
| 2.5 | `lib/domain/phone.spec.ts` | Unit | 51/51 passing before edit | Written — 12 failures | Passed (63) | 11 cases | None needed |
| 2.6/2.7 | `lib/domain/wa-link.spec.ts` | Unit | N/A (new) | Written — module missing | Passed (22) | 22 cases | None needed |
| 2.8/2.9 | `lib/domain/message-template.spec.ts` | Unit | N/A (new) | Written — module missing | Passed (14) | 14 cases | None needed |
| 2.10/2.11 | `lib/domain/slug.spec.ts` | Unit | N/A (new) | Written — module missing | Passed (24) | 24 cases | None needed |
| 2.12/2.13 | `lib/domain/rate-limit.spec.ts` | Unit | N/A (new) | Written — module missing | Passed (16) | 16 cases | Extracted `lockedUntil` |
| 2.14/2.15 | `lib/domain/seats.spec.ts` | Unit | N/A (new) | Written — module missing | Passed (11) | 11 cases | Extracted the `REJECTED` helper |

### Test Summary

- Total tests written: 158 (all under `lib/domain/**`, plus the 8 pre-existing zone tests already counted in the suite total)
- Total tests passing: 158
- Layers used: Unit (158), Integration (0), E2E (0)
- Approval tests: none — no refactoring of existing code
- Pure functions created: 8 exported, 3 private helpers

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm test` → `vitest run` → exit 0, `Test Files 7 passed (7)`, `Tests 158 passed (158)` |
| Coverage | `npm run test:coverage` → exit 0, 100% statements / 100% branches / 100% functions / 100% lines. Per file: `phone.ts` **100/100/100/100**, `wa-link.ts` **100/100/100/100**, plus `message-template.ts`, `slug.ts`, `rate-limit.ts`, `seats.ts` all at 100% |
| ESLint zone proof (2.16) | Added `lib/domain/zone-smoke.ts` importing `node:crypto`; `npm run lint` → `error 'node:crypto' import is restricted … no-restricted-imports`. File deleted; `npm run lint` → exit 0, zero findings |
| Runtime harness | N/A — this unit is pure functions with no async RSC, no I/O and no runtime boundary. `npm run build` → exit 0 as a regression check only |
| Other gates | `npm run typecheck` → exit 0; `npm run lint` → exit 0; `npm run format:check` → "All matched files use Prettier code style" |
| Rollback boundary | Delete `lib/domain/*.ts` and `lib/domain/*.spec.ts`, and revert the `libphonenumber-js` dependency line in `package.json`/`package-lock.json`. Nothing imports these modules yet |

## Decisions and deviations

1. **The legacy Mexican `1` mobile token needed an explicit fix.** libphonenumber-js
   1.13.12 parses `+52 1 55 1234 5678` to `+5215512345678` and reports it INVALID:
   Mexico dropped the mobile token in August 2019 and current metadata pins MX
   national numbers at 10 digits. Task 2.1 requires this exact case to normalize.
   `canonicalizeLegacyMexicanMobile` therefore rewrites the deprecated input shape
   and hands it back to the library; it runs only as a retry after the library has
   already rejected the input, and it never builds, validates or formats a number.
   The design's ban on hand-rolled E.164 normalization is intact — the library still
   does all of the work. This matters in production, not in theory: every contact
   exported from a Mexican phone before 2019 carries that token, and each one would
   otherwise be a guest who cannot open their own invitation.

2. **No crypto inside `lib/domain/**`, and no eslint-disable.** Design decision D2
   injects randomness rather than sourcing it, so `slug.ts` exports `encodeSlug(bytes)`
   and the adapter will supply `randomBytes(SLUG_BYTE_LENGTH)`. The ESLint zone was
   never in conflict, so nothing was suppressed and nothing was relocated. The spec's
   `generateSlug()` name refers to that adapter-side composition, which lands with
   `lib/server/**`.

3. **`DEFAULT_PHONE_COUNTRY` is validated, never defaulted.** The domain stays pure and
   does not read the environment. `resolveDefaultCountry(raw)` throws a named error
   when the value is unset or is not a supported ISO 3166-1 alpha-2 code. No production
   value was invented. `lib/server/env.ts` (task 3.12) will pass `process.env` through it.

4. **`evaluateGate(context, now)` rather than `evaluateGate(attempts, now)`.** The
   per-IP scope cannot be evaluated without knowing which IP is asking, so the first
   argument is `{ ipHash, attempts }`. The injected-clock shape the design specifies is
   unchanged.

5. **When both rate-limit scopes are locked, the LONGER lockout is reported.** Returning
   the shorter one would tell a guest to retry at a moment they would still be blocked.

6. **`buildWaMeLink` rejects a non-E.164 recipient instead of cleaning it up.** Silently
   stripping spaces would hide the real defect — an un-normalized phone reaching the
   link builder — and could produce a link to the wrong person.

7. **A `/s` regex flag in one test was replaced** with an explicit message match: the
   scaffold's `tsconfig` target predates ES2018 and `tsc --noEmit` rejected the flag.
   The compiler target was left alone; widening it is not this unit's decision.

## Blocked

- **Task 2.5, `.env.example`**: both `Write` and a shell heredoc to
  `/Users/lu/Documents/Lu/wedding/.env.example` were denied by the environment's
  permission settings ("File is in a directory that is denied by your permission
  settings"). No workaround was attempted. The maintainer should create the file with:

  ```
  # ISO 3166-1 alpha-2 country code used to interpret phone numbers entered in
  # national format. There is NO default: resolveDefaultCountry throws when this is
  # unset or unsupported, because a wrong default mis-normalizes every nationally
  # formatted phone and those guests would never match at the gate.
  # Production value undecided. Candidates: MX, AR, US.
  DEFAULT_PHONE_COUNTRY=
  ```

  The testable half of 2.5 is done: the tables span MX, AR and US.

## Workload / PR boundary

- Mode: single PR slice for work unit 2; **`size:exception` recommended**.
- Current work unit: 2 of 8.
- Boundary: starts at `f21c38e` (WU1 scaffold), ends with eight pure domain functions
  under test. Nothing imports them yet.
- Authored lines: **~1565** (`lib/domain`: 606 production, 955 test) plus one dependency
  line in `package.json`, against a session budget of 800. The tasks forecast said ~600
  and flagged the unit as test-heavy; the tests are the deliverable here, since this is
  the unit the design calls "the four highest-risk behaviors". The slice cannot shrink
  without deleting required test cases: 2.1 mandates a table across eight input shapes,
  2.6 mandates a seven-way encoding table, 2.10 mandates a 10,000-sample uniqueness
  check, and 2.17 mandates 100% coverage on two files. Coverage was not chased by
  padding; it fell out of the mandated tables.
- No commit was made. The tree is convergent: `npm run format` and `npm run lint` were
  both run after the last source change and `format:check` is clean.

## Status

29/29 tasks complete for work units 1 and 2, except task 2.5's `.env.example` half,
which is environment-blocked. Work units 3–8 are untouched. Ready for `sdd-verify`.

---

# Work Unit 2b — Domain Corrections

**Mode**: Strict TDD. **Runner**: `vitest run`. **Baseline safety net**: 158 tests
passing across 7 files before any change.

## Driver

The confirmed product fact changed the risk calculus: every guest phone on this
list is a Colombian mobile — 10 national digits behind country code 57,
`DEFAULT_PHONE_COUNTRY=CO`, dispatch links `wa.me/57XXXXXXXXXX`. There are no
Mexican, Argentine or other-country guests.

## Completed tasks

- [x] 2b.1 RED — inherited-key tests in `message-template.spec.ts`
- [x] 2b.2 GREEN — `Object.hasOwn` lookup in `message-template.ts`
- [x] 2b.3 RED — unvalidated-default-country tests in `phone.spec.ts`
- [x] 2b.4 GREEN — `normalizePhone` routes through `resolveDefaultCountry`
- [x] 2b.5 RED — Colombian approval rows, then legacy Mexican rows flipped to `invalid`
- [x] 2b.6 GREEN — legacy Mexican path deleted from `phone.ts`
- [x] 2b.7 Verify — full gate run

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2b.1/2b.2 | `lib/domain/message-template.spec.ts` | Unit | 15/15 passing | 5 failed — `constructor`/`toString` rendered `function Object() { [native code] } function toString() { [native code] }` | 20/20 passing | 4 inherited members plus a shadowing own property | Doc comment records why indexing is unsafe |
| 2b.3/2b.4 | `lib/domain/phone.spec.ts` | Unit | 63/63 passing | 5 failed — `MEX`, `ZZ`, `57`, `""` silently produced results; `co` was rejected | 68/68 passing | 3 unsupported shapes + unset + lowercase-accepted | `normalizePhone` doc now distinguishes guest-data failure from deployment fault |
| 2b.5/2b.6 | `lib/domain/phone.spec.ts` | Unit | 73/73 passing (incl. 5 new Colombian approval rows, green before the change) | 2 failed — `+52 1 55 1234 5678` and `+5215512345678` still normalized to `+525512345678` | 66/66 passing | Colombian table spans 5 real input shapes; MX/AR/US non-legacy rows retained | ~30 lines of production code and 3 constants removed; `digitsOf` retained for `deriveGateKey` |

Note on 2b.5/2b.6: the RED rows asserting the deprecated Mexican token is
`invalid` were deliberately transient. They proved the deletion changed real
behavior, then were removed with the rest of the legacy-only tests, because a
test whose only subject is a path that no longer exists is not a spec.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command / result | `npx vitest run lib/domain/phone.spec.ts` → 66 passed; `npx vitest run lib/domain/message-template.spec.ts` → 20 passed |
| Full suite | `npm test` → **7 files, 167 tests passed** (was 158; +9 net) |
| Coverage | `npm run test:coverage` → global 100% (118/118 stmts, 58/58 branches, 21/21 funcs, 113/113 lines). Per-file `json-summary`: `lib/domain/phone.ts` 100% (32/32 stmts, 18/18 branches, 7/7 funcs, 31/31 lines); `lib/domain/wa-link.ts` 100% (8/8, 4/4, 1/1, 8/8) |
| Runtime harness | N/A — all three changes are pure functions in `lib/domain/**` with no runtime boundary; nothing imports them yet |
| Gates | `npm run typecheck`, `npm run lint`, `npm run format:check` all clean; zero `eslint-disable` under `lib/domain/**` |
| Rollback boundary | Exactly four files: `lib/domain/phone.ts`, `lib/domain/phone.spec.ts`, `lib/domain/message-template.ts`, `lib/domain/message-template.spec.ts`. Reverting them restores Work Unit 2 verbatim and touches no other work unit. |

## Line delta (`git diff --numstat`)

| File | Added | Removed | Net |
|---|---|---|---|
| `lib/domain/phone.ts` (production) | 8 | 69 | **−61** |
| `lib/domain/message-template.ts` (production) | 7 | 1 | **+6** |
| `lib/domain/phone.spec.ts` (test) | 60 | 44 | +16 |
| `lib/domain/message-template.spec.ts` (test) | 29 | 0 | +29 |
| **Production subtotal** | **15** | **70** | **−55** |
| **Total** | **104** | **114** | **−10** |

Production code is net **−55 lines**, as required. The `+6` on
`message-template.ts` is one behavioral line plus a five-line comment explaining
why the prototype chain must not be consulted; the deletion in `phone.ts` more
than absorbs it.

## Decisions and rationale

1. **The legacy Mexican path was deleted, not repaired.** `R3-legacy-mx-foreign-rewrite`
   (WARNING) flagged that `canonicalizeLegacyMexicanMobile` could rewrite a
   foreign number into a Mexican one. With a Colombian-only guest list that was
   roughly 30 lines of production code, three constants and a retry branch
   guarding a case that cannot occur — while retaining the ability to corrupt a
   case that can. Deleting it closes the finding and shrinks the highest-risk
   module in the product. This supersedes Work Unit 2's decision 1, which was
   correct under the then-unknown default country and is now obsolete.

2. **`Object.hasOwn`, not a denylist.** `renderMessageTemplate`'s stated invariant
   is that a missing variable fails loudly rather than reaching a message a human
   is about to send. Plain indexing quietly broke it: `{{constructor}}` rendered
   `function Object() { [native code] }` into the draft. Blocking specific names
   would have been a patch on the symptom; only own properties count as provided.

3. **`normalizePhone` may now throw — but only on misconfiguration.** The
   "never throws" contract is about guest DATA, and it still holds: every input
   failure is still returned through the discriminated union. An unsupported
   `DEFAULT_PHONE_COUNTRY` is a deployment fault, and casting it silently
   mis-normalizes every nationally formatted phone, so those guests would never
   match at the gate. `resolveDefaultCountry` already threw a named error; it is
   now wired in rather than bypassed. A side effect worth noting: a lowercase
   `co` is now accepted, because `resolveDefaultCountry` upper-cases.

4. **The MX/AR/US rows that do not depend on the legacy path were kept.** They
   are the generic evidence that the library, not hand-rolled logic, does the
   normalizing. Five Colombian rows were added ahead of the deletion as approval
   tests and were green before any production code moved.

5. **`R3-last8-includes-plus` was left alone, deliberately.** Colombian E.164 is
   13 characters, so `slice(-8)` yields eight clean digits matching the Postgres
   generated column. The finding cannot manifest for this guest list.

## Out of scope, untouched

`.env.example` (still environment-blocked; the maintainer creates it — the value
is now known to be `CO`), Work Unit 3, schema, migrations, pages and console code.

## Workload / PR boundary

- Mode: small correction slice appended to Work Unit 2.
- Boundary: starts at `ff9d7fc` (Work Unit 2 domain), ends with the legacy path
  deleted and both findings closed.
- Authored lines: 104 added / 114 removed — comfortably inside budget and net
  negative overall.
- No commit was made. The tree is convergent: `npm run format` and `npm run lint`
  were run after the last source change, and `format:check` is clean.

## Status

7/7 Work Unit 2b tasks complete. Work unit 1 and 2 status is unchanged (29/29,
except task 2.5's environment-blocked `.env.example` half). Work units 3–8 are
untouched. Ready for `sdd-verify`.

---

# Work Unit 3 — Supabase Schema, RLS, Triggers, Base Adapters

**Mode**: Strict TDD. **Runner**: `vitest run`. **Baseline safety net**: 167
tests passing across 7 files before any change (matches Work Unit 2b's exit
state).

**Runtime**: `supabase` CLI 2.116.0, Docker 29.1.3. `supabase init` created the
`supabase/` directory; `supabase start` brought up the full local stack and
`supabase db reset` applied all three migrations. Every DB assertion below ran
against that real Postgres. `psql` is not on PATH, so the harness uses the `pg`
Node client for privileged SQL and `@supabase/supabase-js` for the anon-key
HTTP surface.

## Completed tasks

- [x] 3.1 RED — `supabase/tests/phone-last8.spec.ts` (dedicated security test)
- [x] 3.2 GREEN — `supabase/migrations/0001_schema.sql` + `supabase/down/0001_schema_down.sql`
- [x] 3.3 RED — `supabase/tests/rls.spec.ts`
- [x] 3.4 GREEN — `supabase/migrations/0002_rls.sql` + down-script
- [x] 3.5 RED — `supabase/tests/append-only.spec.ts` (as `service_role`)
- [x] 3.6 GREEN — `supabase/migrations/0003_triggers.sql` append-only triggers + down-script
- [x] 3.7 RED — seat-cap addendum in `append-only.spec.ts`
- [x] 3.8 GREEN — `enforce_seat_cap()` + `BEFORE INSERT` trigger
- [x] 3.9 GREEN — `lib/server/supabase.ts`
- [x] 3.10 Verify — throwaway `'use client'` import fails `npm run build`; throwaway deleted
- [x] 3.11 Standing lint check that every `lib/server/**` file opens with `import 'server-only'`
- [x] 3.12 GREEN — `lib/server/env.ts`
- [x] 3.13 RED — `lib/server/invitations.spec.ts`
- [x] 3.14 GREEN — `lib/server/invitations.ts`
- [x] 3.15 `scripts/import-guests.ts` + `/data/` in `.gitignore` + usage header
- [x] 3.16 Verify — local Supabase + full suite green

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1/3.2 | `supabase/tests/phone-last8.spec.ts` | DB | N/A (new) | 4 failed — `relation "senders" does not exist` against the live empty DB | 4/4 passing after `0001_schema.sql` | 4 cases: NULL phone, real phone, empty-submission lookup, matching lookup | Fixture slug generator rewritten to emit valid `[a-z2-7]{16}` after the CHECK constraint rejected digit padding |
| 3.3/3.4 | `supabase/tests/rls.spec.ts` | DB + HTTP | N/A (new) | 4 failed — RLS disabled on all six tables, 84 live `anon`/`authenticated` grants, anon read returned the seeded row from every table, and anon **INSERT into `senders` succeeded** (`NO_ERROR`) | 4/4 passing after `0002_rls.sql` | SQL-level catalog assertions + grant assertions + anon HTTP read + anon HTTP insert | Anon read test rewritten to seed committed rows first, so "0 rows" is proven against data a privileged reader can see |
| 3.5/3.6 | `supabase/tests/append-only.spec.ts` | DB | N/A (new) | 5 failed — `relation "senders" does not exist` | 6/6 passing after `0003_triggers.sql` | UPDATE + DELETE on both tables, a guard asserting `service_role.rolbypassrls = true`, and a second INSERT that must still succeed | Second-INSERT case given explicit timestamps after it exposed a real tie (see Issues) |
| 3.7/3.8 | `append-only.spec.ts` (seat cap) | DB | N/A (new) | 3 failed | 3/3 passing after `enforce_seat_cap()` | over-cap `seats_confirmed`, over-cap `cardinality(attendee_guest_ids)`, and an at-cap acceptance | None needed |
| 3.9 | `lib/server/supabase.spec.ts` | Integration | N/A (new) | `Cannot find module './supabase'` | 4/4 passing | missing URL, missing key, publishable-key-in-secret-slot, and a live read the anon key is denied | `persistSession`/`autoRefreshToken` disabled with rationale |
| 3.11 | `tools/eslint-zones.spec.ts` | Unit (ESLint API) | 9/9 passing | 2 failed — no rule existed | 14/14 passing | absent import, misplaced import, correct import, empty file, non-`lib/server` file, and every real `lib/server` file | Selector split into two so an empty program is also caught |
| 3.12 | `lib/server/env.spec.ts` | Unit | N/A (new) | `Cannot find module './env'` | 13/13 passing | 4 country cases, 3 cookie-secret cases, 2 pepper cases, 4 origin cases | `MIN_SECRET_LENGTH` extracted with the reason it is 32 |
| 3.13/3.14 | `lib/server/invitations.spec.ts` | Unit + Integration | N/A (new) | `Cannot find module './invitations'` | 17/17 passing | 4 ownership cases, 6 guest-data cases, 3 mapper cases, 4 repository cases | `toGatePhoneRefs` split out so the two audiences cannot be confused by one flag |
| 3.15 | `scripts/import-guests.spec.ts` | Unit | N/A (new) | `Cannot find module './import-guests'` | 5/5 passing | valid source, invalid JSON, missing array, empty array, git-ignored path | Parser extracted from the entry point so it is testable without I/O |

## Mutation evidence for the `nullif` (task 3.1)

The security claim was proved, not asserted. Inside a rolled-back transaction
the generated column was redefined WITHOUT the `nullif` wrapper, exactly as a
careless edit would leave it:

```
phone_last8 without nullif = ""
empty gate submission matched rows: 1 [ { full_name: 'No Phone' } ]
```

A phone-less guest matched an empty submission — anyone holding the link would
have opened that invitation. With the shipped definition the same query matches
zero rows. The throwaway script was deleted and the transaction rolled back.

## Task 3.10 — the exact build error observed

A throwaway `app/throwaway-server-only-check/page.tsx` carrying `'use client'`
and importing `@/lib/server/supabase` produced:

```
./lib/server/supabase.ts:1:1
Error: 'server-only' cannot be imported from a Client Component module
> 1 | import "server-only";
It should only be used from a Server Component.

Import traces:
  Client Component Browser:
    ./lib/server/supabase.ts [Client Component Browser]
    ./app/throwaway-server-only-check/page.tsx [Client Component Browser]
```

The throwaway directory was deleted and `npm run build` is green again.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command / result | `npx vitest run supabase/tests` → 3 files, 17 passed. `npx vitest run lib/server` → 3 files, 34 passed |
| Full suite | `npm test` → **14 files, 229 tests passed** (was 167; +62) |
| Runtime harness — database | `supabase start` (full stack up), `supabase db reset` applied `0001`, `0002`, `0003` in order. All DB assertions ran against that instance |
| Runtime harness — import script | `npm run import:guests -- --dry-run` correctly aborted with `Import row "Familia Probe" has an unrecognized owner`. After seeding a matching sender, a real run printed `Created invitation z7ogapc7serodwvn` and the row read back as `phone_e164=+573001234567`, `phone_last8=01234567`. The probe sender, invitation and the `data/` directory were all removed afterwards |
| Gates | `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build` all clean |
| Rollback boundary | Delete `supabase/`, `lib/server/{supabase,env,invitations}.{ts,spec.ts}`, `scripts/`, `vitest/`; revert the `serverOnlyGuard` block in `eslint.config.mjs`, the `resolve.alias` + `scripts/**` include in `vitest.config.mts`, the `server-only`/`@supabase/supabase-js`/`pg`/`tsx` dependencies and the `import:guests` script in `package.json`, the `/data/` line in `.gitignore`, and the appended block in `tools/eslint-zones.spec.ts`. Nothing in `lib/domain/**`, `app/**` or `components/**` was touched |

## Decisions and rationale

1. **Down-scripts live in `supabase/down/`, not `supabase/migrations/`.** The
   CLI applies every file in the migrations directory in filename order, so a
   `0001_schema_down.sql` sitting there would drop the schema it had just
   created. The task text names the file, not its directory; the directory is
   the only placement that makes the file harmless.

2. **`0002_rls_down.sql` deliberately does NOT restore the revoked grants.**
   Those grants were the leak the migration closed — the RED run proved `anon`
   could INSERT a row into `senders`, i.e. write itself into the operator
   allowlist. Re-issuing them from a rollback script would be a silent
   regression, so full rollback goes through `0001_schema_down.sql` instead.

3. **DB tests fail loudly when the database is unreachable; they never skip.**
   A conditional skip reads as coverage while proving nothing. The harness
   raises `Cannot reach the local Supabase database at ... Run 'supabase start'`
   so the cause is unmistakable. The consequence is explicit: **`npm test`
   requires a running local Supabase** from this work unit onward.

4. **`server-only` is aliased away in Vitest only.** The real package throws on
   import outside a React Server Component — that is the guard, and task 3.10
   proves it fires in the Next build. It also makes every `lib/server/**` module
   unimportable from a plain node test, so `vitest.config.mts` aliases it to
   `vitest/server-only-stub.ts`. The alias never reaches the Next.js build.

5. **The `server-only` guard is a lint rule, not a script.** Two
   `no-restricted-syntax` selectors on `lib/server/**`: one rejecting any first
   statement that is not `import 'server-only'`, one rejecting a file with no
   statements at all. It rides `npm run lint` with no new tooling, and a
   temporary violating file was used to confirm `eslint .` reports it.

6. **`requiredDefaultPhoneCountry()` is the single boundary.** It resolves
   `DEFAULT_PHONE_COUNTRY` through the domain's own `resolveDefaultCountry`, so
   every call site downstream receives a validated `CountryCode` and no code
   path ever hands a raw env string to `normalizePhone`. This is the Work
   Unit 2b contract, honoured at the adapter edge.

7. **`toGuestFacingInvitation` is a projection, not a redaction.** It builds a
   new object containing only the fields a guest may see. A column added to
   `invitation_guests` later cannot leak by being forgotten, because it is never
   copied in the first place. `toGatePhoneRefs` is a separate function rather
   than an options flag on the same one, so the two audiences cannot be
   conflated at a call site.

8. **`createInvitation` compensates explicitly.** PostgREST offers no
   cross-statement transaction, so a failed guest insert deletes the invitation
   row it had just created. An invitation with no guests can never be unlocked
   by anyone yet would sit in the console looking valid.

9. **The import script validates every row before writing any row.** A
   partially imported guest list is harder to reason about than one that never
   started. `--dry-run` performs the same validation with no writes.

10. **`npm run import:guests` passes `--conditions=react-server`.** The script
    transitively imports `lib/server/**`, and `server-only` resolves to a module
    that throws under any other condition. That is correct behaviour, not a
    defect; the Node entry point opts out explicitly rather than the guard being
    weakened.

## Issues found

1. **`rsvp_responses` has no deterministic tie-break for "latest row wins".**
   `rsvp_responses_latest_idx` orders by `(invitation_id, submitted_at desc)`
   alone. Two rows inserted in one transaction share `now()` and the ordering is
   then arbitrary — the append-only test caught this directly. Real submissions
   arrive in separate transactions so it does not bite today, but
   `getCurrentRsvp(invitationId)` in Work Unit 5 should order by
   `submitted_at desc, id desc` rather than trusting the timestamp alone.

2. **`enforce_seat_cap`'s message is misleading for the array case.** Design's
   DDL always reports `seats_confirmed % exceeds seats_allowed %`, so an
   over-cap `attendee_guest_ids` with an in-cap `seats_confirmed` produces
   "seats_confirmed 2 exceeds seats_allowed 2". The DDL was followed verbatim
   rather than improvised on; the message is worth a one-line fix in a later
   slice.

3. **`.env.example` is still environment-blocked**, as in Work Unit 2. The write
   is denied by the environment's permission settings. The intended contents are
   now larger than in Work Unit 2 — `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `DEFAULT_PHONE_COUNTRY=CO`, `UNLOCK_COOKIE_SECRET`, `GATE_IP_PEPPER`,
   `NEXT_PUBLIC_SITE_ORIGIN` — and the maintainer must create the file. Task 2.5
   remains PARTIAL for this reason.

4. **Test-isolation defect, found and fixed during the final full-suite run.**
   `supabase/tests/helpers/db.ts` originally generated fixture slugs and sender
   emails from module-level counters. Vitest runs spec files in parallel worker
   threads, each with its own copy of the module, so two files produced the same
   slug and collided on `invitations.slug`'s unique index. The symptom was a
   test that passed in isolation and failed in `npm test` —
   `lib/server/supabase.spec.ts > reads rows the publishable key is denied`.
   Both generators now draw from `randomBytes`. Five consecutive full-suite runs
   are green at 229/229.

## Deviations from design

- Down-script location (`supabase/down/`) as explained above. Design says only
  "every migration ships a down-script"; it names no directory.
- `lib/server/env.ts` adds a 32-character minimum on `UNLOCK_COOKIE_SECRET` and
  `GATE_IP_PEPPER`. Design does not specify a length. A short pepper on an IPv4
  address is equivalent to no pepper, so the floor is enforced rather than
  documented.
- `createServerSupabaseClient` rejects a `sb_publishable_` value handed to it in
  the secret slot. Not in design; without it the misconfiguration is silent and
  presents as "the guest list is empty".
- `listSenderDirectory` and `mintSlug` were added to `lib/server/invitations.ts`.
  Design lists the file but not its exact function set; both are required by the
  import path task 3.15 defines.

## Workload / PR boundary

- Mode: chained PR slice — **PR3**, base PR2, per the tasks artifact's linear
  chain. `Chain strategy` is still `pending`, which the orchestrator must
  resolve before WU4a; it does not block this slice.
- Boundary: starts at `831812c` (clean tree, 167 tests), ends with the schema,
  RLS, triggers and base adapters in place and 229 tests green.
- **Authored lines: ~2,360 (≈940 production, ≈1,420 test), plus a generated
  413-line `supabase/config.toml` from `supabase init`.** The session budget is
  800 and the forecast for this unit was ~600. This slice is roughly 3x over.
  **`size:exception` is recommended, or a split into WU3a (migrations + DB
  tests, ~850 lines) and WU3b (`lib/server/**` + import script, ~1,500 lines).**
  It was not compressed to fit: the overage is real test coverage and explicit
  type contracts, and cutting either to reach a number would have traded a
  security-critical work unit's evidence for an arithmetic target.
- No commit was made. The tree is convergent: `npm run format` and `npm run lint`
  were run after the last source change and `format:check` is clean.

## Status

16/16 Work Unit 3 tasks complete. Work units 1, 2 and 2b are unchanged (task 2.5
still PARTIAL on its environment-blocked `.env.example` half). Work units 4a
onward are untouched. Ready for `sdd-verify`.

---

# Work Unit 3b — Schema and Import Hardening

**Mode**: Strict TDD. **Baseline safety net**: `npm test` → 229/229 passing
before any edit. **Final**: `npm test` → 244/244 passing.

Three WARNING-level findings from the Work Unit 3 reliability review, and
nothing else. The three SUGGESTION-level findings
(`R3-seat-cap-partial-invariant`, `R3-sender-directory-unpaginated`,
`R3-site-origin-accepts-path`) and the other three WU3 WARNINGs
(`R3-create-compensation-unverified`, `R3-import-row-shape-unvalidated`,
`R3-test-key-resolution-order-dependent`) were deliberately left untouched and
**remain open**.

## Completed tasks

- [x] 3b.1 RED — default-deny-for-future-objects tests
- [x] 3b.2 GREEN — `0004_default_deny_new_objects.sql` + down-script
- [x] 3b.3 RED — cascade-vs-direct-delete tests
- [x] 3b.4 GREEN — `0005_append_only_allows_cascade.sql` + down-script
- [x] 3b.5 RED — import atomicity/idempotency tests
- [x] 3b.6 GREEN — `0006_import_invitations.sql` + down-script
- [x] 3b.7 GREEN — `lib/server/invitations.ts` + `scripts/import-guests.ts`
- [x] 3b.8 Verify — full suite, down/up migration replay, typecheck, lint,
      format:check, build

## Files changed

| File | Action | What was done |
|---|---|---|
| `supabase/migrations/0004_default_deny_new_objects.sql` | Created | Event trigger revoking `anon`/`authenticated` on every new `public` object; the functions-scoped revoke `0002` never issued |
| `supabase/down/0004_default_deny_new_objects_down.sql` | Created | Drops the event trigger and its function; does NOT reissue grants |
| `supabase/migrations/0005_append_only_allows_cascade.sql` | Created | `reject_mutation()` now exempts the FK cascade only |
| `supabase/down/0005_append_only_allows_cascade_down.sql` | Created | Restores `0003`'s reject-everything body |
| `supabase/migrations/0006_import_invitations.sql` | Created | `invitations.source_key` + unique index + `import_invitations(jsonb)` |
| `supabase/down/0006_import_invitations_down.sql` | Created | Drops the function, index and column |
| `supabase/tests/rls.spec.ts` | Modified | +4 tests on default-deny for objects created later |
| `supabase/tests/append-only.spec.ts` | Modified | +4 tests on cascade vs. direct delete |
| `lib/server/invitations.spec.ts` | Modified | +7 tests on source keys, atomicity, idempotency, anon RPC denial |
| `lib/server/invitations.ts` | Modified | `sourceKey`, `validateImportRows`, `importInvitations` |
| `scripts/import-guests.ts` | Modified | One atomic RPC call instead of a per-row loop; created/skipped reporting |

## TDD cycle evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3b.1–3b.2 | `supabase/tests/rls.spec.ts` | Integration (real Postgres) | 229/229 | ✅ 3 failed of 8 | ✅ 8/8 | ✅ 4 cases (table, function, `service_role` counter-case, trigger state) | ➖ migration written once |
| 3b.3–3b.4 | `supabase/tests/append-only.spec.ts` | Integration (real Postgres) | 12/12 in file | ✅ 1 failed of 13 | ✅ 13/13 | ✅ 4 cases (cascade, direct DELETE ×2, direct UPDATE) | ➖ single-function change |
| 3b.5–3b.7 | `lib/server/invitations.spec.ts` | Unit + Integration | 17/17 in file | ✅ 7 failed of 24 | ✅ 24/24 | ✅ 7 cases (key derivation, distinctness, explicit key, collision, atomicity, idempotency, anon denial) | ✅ `deriveSourceKey` extracted as a pure function |

### Exact RED evidence

- 3b.1 → `Tests 3 failed | 5 passed (8)`. The function case failed with
  `expected [ 'PUBLIC', 'anon', 'authenticated' ] to deeply equal []`.
- 3b.3 → `Tests 1 failed | 12 passed (13)`, failing with
  `error: table dispatch_events is append-only` raised by
  `delete from invitations where id = $1` — the cascade, exactly as the finding
  described.
- 3b.5 → `Tests 7 failed | 17 passed (24)`.

## What was actually measured, and what it changed

The finding asked whether `alter default privileges` covers migrations applied
by a different role. It was **measured against the live instance**, not assumed:

1. `0002`'s `alter default privileges` ran as `postgres`, so it covers TABLES
   and SEQUENCES created by `postgres` — and a probe confirmed a new table
   created by `postgres` is already denied to `anon` today.
2. `supabase_admin` **still holds default ACLs granting `anon` everything on new
   `public` tables**, and `postgres` cannot fix that:
   `alter default privileges for role supabase_admin ...` fails with
   `ERROR: permission denied to change default privileges`.
3. **FUNCTIONS were never covered at all.** A probe created
   `public.__probe_f()` as `postgres` and it was granted EXECUTE to `PUBLIC`,
   `anon` and `authenticated`. PostgREST publishes such a function as an RPC
   endpoint — and `0006` adds exactly such a function.

So the corrected-default-privileges option could not close the gap, and the
event trigger could: `postgres` is permitted to create one on this instance
(probed before committing to the design). It is `security invoker` on purpose,
so the revoke runs as the creating role, which always owns the new object; a
`security definer` version owned by `postgres` could not revoke on a
`supabase_admin`-owned table, which is gap 2.

The table test is RED-by-construction rather than RED-by-accident: it reinstates
the default grants (`alter default privileges ... grant all on tables to anon`)
inside the rolled-back transaction before creating the table, which is precisely
the lapse the finding describes. Stated plainly: **without that reinstatement, a
`postgres`-created table was already denied**. The function test was RED with no
help at all.

## The design choice on fix 2

Two candidates were on the table:

- **(a) allow the cascade, distinguishing it from a direct delete** — chosen.
- **(b) replace the cascade with an explicit archival path.**

(b) was rejected because it requires either `on delete restrict` plus an archive
table or a soft-delete column, and both introduce a *second* definition of "this
invitation exists". Every later read path — the gate, the OG image, the console
list, the RSVP write — would have to honour it, and the first one that forgets
leaks a supposedly-removed invitation. A hard cascade keeps one definition. The
motivating case (a household created by mistake at import) wants the row gone,
not archived: the row's entire content is the mistake.

The discrimination is the parent's existence, not `pg_trigger_depth()`. The FK
cascade is an AFTER DELETE trigger on `invitations`, so the child's BEFORE
DELETE trigger sees the parent already gone; a direct delete always leaves it
present, because `invitation_id` is NOT NULL and its FK is not deferrable. That
is a fact about the transaction. `pg_trigger_depth()` would have exempted *any*
nested trigger, which is a strictly weaker guarantee. The exemption is DELETE
only — `invitations.id` is never updated, so an UPDATE exemption would be pure
attack surface.

## Guarantees re-verified, not assumed

- `nullif` mutation test (`supabase/tests/phone-last8.spec.ts`): 4/4 passing.
- `rolbypassrls` companion assertion: still passing (`service_role` → `true`).
- Direct `UPDATE` and direct `DELETE` on `dispatch_events` and `rsvp_responses`
  as `service_role`: still rejected, now also proven at single-row granularity
  with the row asserted to survive.
- `anon` still reaches nothing on all six owned tables (`rls.spec.ts`, both the
  grant query and the live anon-key HTTP probe).
- The new `import_invitations(jsonb)` RPC grants:
  `postgres | EXECUTE` and `service_role | EXECUTE` only.

## Verification output (actual)

```
npm test          → Test Files 14 passed (14) | Tests 244 passed (244)
npm run typecheck → tsc --noEmit, no output
npm run lint      → eslint ., no output
npm run format:check → All matched files use Prettier code style!
npm run build     → ✓ Compiled successfully in 320ms
```

Migration integrity was proven by replay, not by inspection: all six
down-scripts were applied in reverse order (`0006 → 0001`), then all six
migrations re-applied in order, then `npm test` re-run → 244/244.

## Deviations from design

- `invitations.source_key` and `import_invitations(jsonb)` are not in
  `design.md`. Design specifies neither an atomicity nor an idempotency
  mechanism for the import; it only says a partial import is undesirable. The
  column is NULLable with a plain unique index, so any non-import creation path
  (the console, later) carries no key and cannot collide.
- Slugs are still minted in the adapter and passed into the RPC, preserving
  design D2 (randomness lives in the adapter, not the core).
- `0005` weakens `0003`'s literal wording ("rejects every UPDATE or DELETE") in
  the cascade case only. `design.md` D5's stated intent — a trigger because
  `service_role` has BYPASSRLS — is unchanged and re-tested.

## Issues found

1. **A shadowing bug was caught before it shipped.** The first draft of
   `import_invitations` declared a plpgsql variable named `source_key`, which
   shadows the column of the same name; `on conflict (source_key)` and the
   lookup `where i.source_key = source_key` would have raised an ambiguous
   column reference at runtime while `CREATE FUNCTION` succeeded. Renamed to
   `row_key` and the function was dropped and recreated from clean before the
   GREEN run.
2. **A latent plpgsql trap is documented in the migration**: `RETURNING ... INTO`
   leaves the variable untouched when no row matches, so an `ON CONFLICT` skip
   would inherit the previous household's id and attach this household's guests
   to it. `new_id := null` at the top of each iteration is load-bearing, not
   defensive style.
3. **`.env.example` remains environment-blocked** (unchanged from WU2/WU3). Not
   attempted here; the path is denied to agents.
4. **Three WU3 WARNINGs remain open**: `R3-create-compensation-unverified`,
   `R3-import-row-shape-unvalidated`, `R3-test-key-resolution-order-dependent`.
   Note that `createInvitation`'s unverified compensation is now bypassed by the
   import path, which no longer calls it — but the function itself is unchanged
   and the finding still stands for any other caller.

## Workload / PR boundary

- Mode: chained PR slice — a small follow-up to PR3.
- Boundary: starts at `a64c862` (clean tree, 229 tests), ends with three
  migrations, three down-scripts and the import rewrite, 244 tests green.
- **Authored lines: ~710 (≈340 production/SQL, ≈370 test).** Within a single
  reviewable slice.
- No commit was made. The tree is convergent: `npm run format` and
  `npm run lint` were run after the last source change and `format:check` is
  clean.

## Status

8/8 Work Unit 3b tasks complete. Work units 1, 2, 2b and 3 are unchanged
(task 2.5 still PARTIAL on its environment-blocked `.env.example` half). Work
units 4a onward are untouched. Ready for `sdd-verify`.
