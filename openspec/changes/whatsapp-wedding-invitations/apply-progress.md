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

---

# Work Unit 4a — Invitation Page, OG Image, Metadata

**Mode**: Strict TDD (`strict_tdd: true`, `npm test` → `vitest run`).
**Boundary**: starts at `6f1a440` (clean tree, 244 tests), ends with the
`/i/[slug]` route, its Open Graph card, `robots.ts`, card warming, and a
Playwright suite, 296 tests green plus 12 E2E. Nothing committed.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4a.4 / 4a.5 | `lib/domain/og-card.spec.ts` | Unit | N/A (new) | Written (module missing) | 8 passed | 8 cases | None needed |
| 4a.7 | `tools/og-font-coverage.spec.ts` | Unit | N/A (new) | Written (harness missing) | 4 passed | 4 cases incl. a negative | None needed |
| 4a.10 / 4a.11 | `app/robots.spec.ts` | Unit | N/A (new) | Written (module missing) | 4 passed | 4 cases | None needed |
| 4a.2 / 4a.9 body | `components/invitation/InvitationBody.spec.tsx` | Component | N/A (new) | Written (component missing) | 10 passed | 10 cases + snapshot | Extracted `seatsSentence` |
| 4a.9 | `components/invitation/InvitationUnavailable.spec.tsx` | Component | N/A (new) | Written (component missing) | 4 passed | 4 cases | None needed |
| 4a.12 / 4a.13 | `lib/server/og-warm.spec.ts` | Unit | N/A (new) | Written twice — once for the module, once for the corrected URL contract (8 failed) | 18 passed | 18 cases | Extracted `withoutTrailingSlash`, `advertisedCardUrl` |
| 4a.14 | `scripts/import-guests.spec.ts` | Unit | 5/5 passing before edit | Written (4 failed) | 9 passed | 4 cases | None needed |
| 4a.1 / 4a.6 / 4a.8 / 4a.16 | `e2e/invitation-page-og.spec.ts` | E2E | N/A (new) | Written (route missing) | 12 passed | 12 cases | Two assertions tightened after a real RED |

Async Server Components cannot be unit-tested under Vitest, so `page.tsx`,
`opengraph-image.tsx` and `load-invitation.ts` are covered by Playwright only,
per the design's Testing Architecture table. No fake unit test was written
around them.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test` → `Test Files 20 passed (20)`, `Tests 296 passed (296)` |
| Runtime harness | `npm run e2e` → `12 passed (4.6s)`, against `npm run build && npm run start` with a committed Postgres fixture |
| Rollback boundary | Delete `app/i/`, `app/robots*.ts`, `components/invitation/`, `lib/domain/og-card*.ts`, `lib/server/og-warm*.ts`, `tools/{ttf-cmap.ts,og-font-coverage.spec.ts}`, `e2e/`, and revert the four modified files. No migration, no schema change, no committed data. |

Actual output of the closing verification:

```
npm test             → Test Files 20 passed (20) | Tests 296 passed (296)
npm run e2e          → 12 passed (4.6s)
npm run typecheck    → tsc --noEmit, no output
npm run lint         → eslint ., no output
npm run format:check → All matched files use Prettier code style!
npm run build        → ✓ Compiled successfully; ƒ /i/[slug], ƒ /i/[slug]/opengraph-image, ○ /robots.txt
```

## The three things this unit measured rather than assumed

### 1. `htmlLimitedBots` is not currently the load-bearing mechanism (task 4a.15)

Key placement was confirmed against the installed declarations:
`node_modules/next/dist/server/config-shared.d.ts:1624` declares
`htmlLimitedBots?: RegExp` as the last member of the **top-level** `NextConfig`
interface in Next.js 16.3.4. Work unit 1's placement is correct.

Then the guard itself was tested by removing it: `htmlLimitedBots` was deleted
from `next.config.ts`, the whole Playwright suite was re-run against a fresh
build, and **all tests still passed**, including the ordinary-desktop-UA case
that the default bot list does not cover.

The honest reading: Next.js 16.3.4 does not stream this route's metadata at all,
because nothing above it flushes a shell early — there is no `loading.tsx` and
no Suspense boundary on the path to `generateMetadata`. The E2E therefore proves
the PRODUCT requirement (per-guest `og:title` and `og:image` inside `<head>` of
the first response, under a WhatsApp UA and a browser UA alike) but does **not**
today isolate `htmlLimitedBots` as its cause.

The config line stays, and so does the test. Work unit 4b puts a phone gate in
front of this body; the moment that introduces a Suspense boundary, streaming
becomes possible and this test is what catches the tags moving to the end of the
body. The file records this measurement in a comment so nobody later mistakes a
passing suite for proof that the config is exercised.

### 2. The design's warm URL would have warmed nothing

Design D9 specifies `fetch(`${origin}/i/${slug}/opengraph-image`)`. The E2E's
raw HTML shows what Next.js actually advertises:

```
<meta property="og:image" content="https://boda.e2e.test/i/<slug>/opengraph-image?88f8dd536f697fc4"/>
```

A build-scoped hash is appended, and a CDN keys its cache on the full URL
including the query. Warming the bare route path would have warmed an entry no
crawler ever requests — a warm that reports success and buys nothing, which is
the exact failure D9's "no cache-busting parameter" rule exists to prevent.

`warmOgCard` therefore fetches the invitation page first, reads `og:image` out
of it, and warms that exact URL. Because it now follows a URL read out of an
HTTP response body while holding server credentials, it refuses any advertised
URL that does not start with `ogCardUrl(origin, slug)`; that refusal has its own
test.

### 3. The card was not cacheable, so warming was a no-op

Design D9 states `next/og` responds `public, immutable, max-age=31536000`. That
is true of statically generated cards. Measured against `next start` on this
dynamic per-slug route:

```
cache-control: public, max-age=0, must-revalidate
```

Nothing would have been cached, so every crawler fetch would still have paid a
cold Satori + Resvg render and warming would have been pure cost. The card route
now sets `public, immutable, no-transform, max-age=31536000` explicitly, driven
by a RED E2E assertion that failed with the measured default. `immutable` is
safe because the URL changes whenever the content can: a rotated slug is a new
path, and a redeploy changes the build hash.

## Confirmed product decisions honoured

- **Card is names-only.** `buildOgCardModel` is a projection with exactly two
  output fields, so a field added to the read model later cannot leak by being
  forgotten. Tests assert the rendered values contain no wedding date, venue
  name, venue address or phone, using a fixture that deliberately carries all
  four.
- **Placeholders, not inventions.** `{{COUPLE_NAMES}}`, `{{WEDDING_DATE}}`,
  `{{VENUE_NAME}}` and `{{VENUE_ADDRESS}}` render verbatim and are asserted.
  Nothing was fabricated.
- **Spanish guest copy, English code.** All identifiers, comments, tests and
  docs are English; every rendered string is neutral Spanish.
- **Friendly page, not a 404.** An unknown, rotated or malformed slug renders
  `InvitationUnavailable` with HTTP 200. The E2E asserts the framework's
  `This page could not be found` and `next-error-h1` are absent from the
  document (scripts stripped, because every App Router response inlines the
  default not-found subtree as hydration data).
- **No phone leak.** The route reads through `toGuestFacingInvitation`. The E2E
  asserts the full E.164, the national number and the last 8 digits of both
  fixture guests are absent from the page source, inline JSON included.
- **No preview bypass on the public route.** No parameter, no token, no
  admin-session branch. `InvitationBody` is one sync props-only component so
  work unit 6b's `/console/preview/[invitationId]` renders the identical thing,
  and work unit 4b can insert the gate in front of it without restructuring.

## Accented and enye rendering (4a.6 / 4a.7)

The card ships **no custom font**; it uses the fallback `next/og` bundles.
Design says that is Noto Sans — in Next.js 16.3.4 it is
`next/dist/compiled/@vercel/og/Geist-Regular.ttf`. The design's premise (the
bundled default covers Latin-1) holds; the font's name does not.

Coverage is asserted at the character-map level, which is exactly the condition
that produces tofu: `tools/og-font-coverage.spec.ts` reads that exact file and
asserts every Spanish codepoint in both cases, plus every character of the
fixture name `Ñoño Muñóz`, maps to a non-zero glyph id. It triangulates with a
CJK ideograph (expected 0) and with `ó` vs `o` (expected different ids), so a
parser that always answered "present" would fail. The E2E additionally asserts
the card is a real PNG by magic number and that the accented household renders
different bytes than a plain-ASCII control.

Font budget: 0 bytes added — no font asset is shipped. The generated card
measures 32,401 bytes.

## Deviations from design

1. **Warm URL and cache header** — described above. Both are corrections that
   preserve D9's intent; neither changes the strategy.
2. **Bundled font is Geist, not Noto Sans.** Framework detail, verified.
3. **`invitationPageUrl` added** alongside `ogCardUrl`, required by (1).
4. **`vitest.setup.ts` now calls `cleanup` after each test.** Testing Library
   only auto-registers cleanup under `globals: true`, which this project does
   not use; without it, renders accumulated in one document and queries matched
   elements left by earlier tests. Caught by a real failing run, not predicted.
5. **`playwright.config.ts` passes `NEXT_PUBLIC_SITE_ORIGIN`** to the web
   server. The `og:image` contract is an absolute HTTPS URL; the local server
   necessarily listens on HTTP, so the public origin is injected separately
   from the address Playwright connects to, mirroring production.
6. **No styling.** The page carries semantic markup and class hooks only. The
   final guest-facing design depends on copy the couple has not supplied.

## Issues found

1. **`htmlLimitedBots` is unverified in practice** (see above). Not a defect —
   a limit on what the suite currently proves. Re-check it in 4b.
2. **The console's mock bubble (6b) will have the same URL problem.** Design
   says it renders `<img src={/i/${slug}/opengraph-image}>`, which is now known
   to be a different cache key than the `og:image` the crawler follows. The
   claim "previewing IS warming" does not hold for that URL as written. 6b
   should render the advertised URL.
3. **Immutable caching makes a household rename stale** until the next deploy
   changes the build hash. Accepted, and stated at the constant.
4. **Three work unit 3 WARNINGs remain open**, unchanged by this unit.

## Workload / PR boundary

- Mode: chained PR slice — PR4a.
- **Authored lines: ~1,540 (≈560 production, ≈980 test).** Above the session's
  800-line budget. It does not split usefully: the raw-HTML guard cannot be
  written before the route exists, and the route is meaningless without the
  card. The excess is test weight, not production weight — production is ~560
  lines against the design's ~500 estimate. Recommending `size:exception` rather
  than splitting a single-purpose deliverable.
- No commit was made. The tree is normalized: `npm run format` and
  `npm run lint` ran after the last source change and `format:check` is clean.

## Status

16/16 Work Unit 4a tasks complete. Work units 1, 2, 2b, 3 and 3b unchanged
(task 2.5 still PARTIAL on its environment-blocked `.env.example` half). Work
units 4b, 5, 6a, 6b and 7 untouched. Ready for `sdd-verify`.

---

# Work Unit 4c — Field-Learned Corrections

Five defects, each one derived from analysing a real shipped project that
solved the same problem for 97 real guests. Nothing here was speculative: every
item is something someone already paid to learn.

**Mode**: Strict TDD. RED before GREEN, per fix.
**Store**: hybrid. **Attempt**: `sha256:2a0385d8…961f`, `state: proceed`.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4c.1–4c.2 | `lib/domain/phone-reachability.spec.ts` | Unit | N/A (new file) | ✅ module did not exist | ✅ 14 passed | ✅ 11 table rows + 2 predicate cases | ➖ none needed |
| 4c.3–4c.4 | `scripts/import-guests.spec.ts` | Unit | ✅ 9/9 before | ✅ 6 failed | ✅ 15 passed | ✅ 6 cases (landline, phone-less, seat typo, clean, two format shapes) | ➖ none needed |
| 4c.5–4c.6 | `lib/domain/rsvp-deadline.spec.ts` | Unit | N/A (new file) | ✅ module did not exist | ✅ 11 passed | ✅ 11 cases incl. both sides of the Bogota midnight boundary | ➖ none needed |
| 4c.7–4c.9 | `supabase/tests/seat-parity.spec.ts` | DB (real Postgres) | ✅ 25/25 before | ✅ 1 failed — **the database ACCEPTED "2 seats, 1 name"** (error was `null`) | ✅ 7 passed | ✅ 7 cases, each asserted at both enforcement points | ✅ 4 fixtures corrected + `seedGuests` helper |
| 4c.10–4c.11 | `app/i/[slug]/error.spec.tsx` | Component (RTL) | N/A (new file) | ✅ module did not exist | ✅ 12 passed | ✅ 6 predicate cases + 4 reload cases + 2 render cases | ➖ none needed |
| 4c.12–4c.13 | `e2e/invariants/rls.spec.ts` | E2E (Playwright, anon key) | N/A (new file) | ✅ 2 failed on first run (see below) | ✅ 10 passed | ✅ 4 verbs × 6 tables + 4 verbs on a post-migration table | ✅ made serial, transaction-wrapped |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npm test` → **24 files, 346 tests passed** (baseline 20 / 296) |
| Runtime harness | `npm run e2e` → **22 passed** (baseline 12); real local Supabase + production `next build`/`next start` |
| Rollback boundary | Delete `lib/domain/phone-reachability.*`, `lib/domain/rsvp-deadline.*`, `app/i/[slug]/error.*`, `e2e/invariants/`, `supabase/tests/seat-parity.spec.ts`; apply `supabase/down/0007_seat_attendee_parity_down.sql`; revert the advisory block in `scripts/import-guests.*` and the fixture corrections in `supabase/tests/{append-only.spec.ts,helpers/db.ts}`. No earlier work unit is touched. |

## Fix 1 — Reachability is not validity

`parsed.isValid()` answers "can this become E.164?", and a Colombian landline
answers **yes**. `+57 601 234 5678` would have been stored, turned into
`wa.me/576012345678`, stamped with a dispatch event, and delivered to nothing —
while the console showed it as sent.

**Measured, not assumed**: `libphonenumber-js`'s default ("min") metadata
carries no line types at all. `getType()` returns `undefined` for *every*
Colombian number, mobile and landline alike. Only the `max` metadata
distinguishes them:

```
["+57 601 234 5678","CO"]  min → null   max → FIXED_LINE
["+573001234567","CO"]     min → null   max → MOBILE
```

So `lib/domain/phone-reachability.ts` imports `libphonenumber-js/max`
explicitly, and `lib/domain/phone.ts` deliberately stays on the default
metadata: `normalizePhone`'s contract, and the set of inputs it accepts, does
not move. The five Colombian shapes in its table are untouched and still green.

Only `MOBILE` and `FIXED_LINE_OR_MOBILE` are dispatchable. An `unknown` line
type is NOT dispatchable, because "the metadata does not say" is not
substantiation for claiming a delivery.

**Import behaviour is flag-and-count, not reject.** The brief allowed either.
Rejecting was refused for two reasons: the import is one atomic transaction, so
refusing the file over one aunt's landline refuses all 97 households; and a
landline guest is still a real guest — they open their own invitation at the
phone gate on the last eight digits, they simply receive the link another way.
What must not happen is the product *claiming* the send. `buildImportAdvisory`
therefore returns the count and the offending households, and
`formatImportAdvisory` prints it before the write so `--dry-run` surfaces it
too. Names are printed because an operator cannot fix a row they cannot find;
digits never are, and a test asserts no run of 7+ digits appears in the output.

## Fix 2 — The deadline cut guests off early

`invitations.rsvp_deadline` is a bare `date`, which is the **right type** — the
couple chose a day, not an instant. The defect was in reading it: compared
against a timestamp, `2026-05-01` is 2026-05-01T00:00:00Z, which is 19:00 on 30
April in Bogota. The form would close five hours before the chosen day began.

`isRsvpOpen(deadline, now, timeZone = "America/Bogota")` compares the *civil
calendar date* at `now` in the zone against the deadline. ISO days sort
lexicographically in chronological order, so the comparison needs no date
arithmetic. The zone is encoded, never the offset: Colombia does not observe DST
today, so `-05:00` would give identical answers — until the day it does not, and
then every boundary case is silently an hour wrong.

Boundary cases asserted on both sides:

| Instant (UTC) | Bogota | Deadline `2026-05-01` |
|---|---|---|
| `2026-05-02T02:00:00Z` | 1 May, 21:00 | **open** |
| `2026-05-02T04:59:59.999Z` | 1 May, 23:59:59 | **open** |
| `2026-05-02T05:00:00Z` | 2 May, 00:00 | **closed** |

**No schema migration.** `date` is genuinely zone-free and is the correct
column type; the fault was entirely in evaluation. The RSVP form itself is Work
Unit 5 and remains unbuilt, so this unit ships the rule the form will consume
(task 5.7), tested at the layer that exists today.

## Fix 3 — The seats domain and the seats trigger disagreed

**Direction corrected mid-unit.** The initial instruction was to loosen the
domain (`seats_allowed` as a maximum, unnamed seats legal). The orchestrator
then supplied a product fact that invalidates it: **the couple has the name of
every guest**, so each invitation's seat count is exactly known and there is no
"Familia Pérez, 4 seats, 2 names" case in this data. Equality is therefore a
real invariant, not an over-restriction.

`lib/domain/seats.ts` was never modified — the relaxation was not written and
nothing had to be reverted. The **database** moved instead, because it was the
loose one.

`supabase/migrations/0007_seat_attendee_parity.sql` adds to `enforce_seat_cap`:

```sql
if named <> new.seats_confirmed then
  raise exception 'seats_confirmed % does not match attendee_guest_ids of length %', ...
```

evaluated **after** the hard cap, so an over-cap submission still fails for the
cap's own reason. The hard cap is untouched. A decline is unaffected: 0 = 0.

The RED run is the interesting evidence — the failure was not an assertion
mismatch but `captureError` returning `null`:

```
AssertionError: the given combination of arguments (null and string) is invalid
```

The database had **accepted** the row `lib/domain/seats.ts` rejects. That is the
disagreement, observed rather than argued.

Down/up round trip run: applying `0007…_down.sql` makes exactly that one test
fail again; re-applying `0007` makes it pass. Four fixtures in
`append-only.spec.ts` and one in `withSeededData` confirmed seats while naming
nobody — rows the product itself may no longer write — and were corrected with
a new `seedGuests` helper.

**Advisory, not a constraint** (per the corrected instruction):
`buildImportAdvisory` also reports households where `seats_allowed` differs from
the number of names entered. A hard constraint would make a partially entered
household impossible to save.

## Fix 4 — No error boundary on the invitation route

`app/i/[slug]/error.tsx` did not exist. A deploy while a guest has the page open
404s a chunk from the previous build, and the guest reads the framework's
English *"Application error: a client-side exception has occurred"* with no way
out. The detail that decides the copy: **the RSVP write has usually already
succeeded — only the screen died.**

`isChunkLoadError` matches by name *and* by message, because the wording belongs
to the bundler and the browser, not to us: webpack's `ChunkLoadError`, webpack's
`Loading chunk N failed`, the ESM loader's `Failed to fetch dynamically imported
module`, and Safari's `Importing a module script failed`. All four are asserted;
two ordinary errors are asserted NOT to match, including a bare `Failed to
fetch`, so the predicate cannot pass by being permissive.

`attemptChunkReload(error, { storage, reload })` reloads once, guarded by
`sessionStorage`. The ports are injected so the once-only decision is unit
tested without a real navigation — jsdom cannot perform one. Storage that throws
(private browsing, locked-down WebViews) is treated as *cannot record*, so no
reload happens at all: an unrecorded reload is precisely the infinite loop the
guard exists to prevent, which would be a worse failure than the wall.

Everything else renders calm Spanish that does not over-claim: *"Si ya
confirmaste tu asistencia, tu respuesta quedó guardada"* — conditional, because
a guest who never answered has nothing saved and telling them otherwise is a
lie. A `reset()` button is the way forward.

## Fix 5 — Nothing proved the RLS posture from outside

Every existing RLS test runs with privileged access, which is exactly the access
an attacker does not have. `e2e/invariants/rls.spec.ts` holds **only the
publishable key** and asserts all four verbs against all six owned tables:
SELECT returns nothing, INSERT/UPDATE/DELETE are refused `42501`. UPDATE and
DELETE were the real gap — the existing Vitest suite covered only SELECT and
INSERT.

Non-vacuity is proved twice over:

1. Every table is seeded with a **committed** row and that row is proved visible
   to a privileged reader first. Without it, "anon returned no rows" is
   satisfied by an empty database.
2. After the four verb sweeps, the database is read directly to confirm nothing
   was mutated or removed. A refusal that arrived after a partial write would
   look identical in the response.

The post-migration block creates a table under **reinstated default grants**,
which is the only way to exercise the `0004` event trigger — a table created by
`postgres` under the current ACLs would be born with no `anon` grant anyway and
the probe would prove nothing. It then asserts the grant is absent (only the
trigger can have removed it), that PostgREST really exposes the table (polled,
so an anon 404 cannot masquerade as a pass), that all four verbs are refused,
and that `service_role` still works, so the revoke was surgical.

**Two real failures were hit and fixed, not worked around:**

1. `alter default privileges` raised `tuple concurrently updated` — Playwright's
   `fullyParallel` ran `beforeAll` in two workers, which collided on the same
   catalog row. Both describes are now `mode: "serial"`.
2. The first run left the grant reinstated after a mid-setup failure. The setup
   is now **one transaction**: grant, create, insert, revoke, commit. A failure
   anywhere leaves the database exactly as it was rather than leaving a live
   instance permissive. Verified afterwards — `pg_default_acl` for `public`
   shows `{postgres, service_role}` only, and the probe table is gone.

## Deviations from design

1. **`libphonenumber-js/max` is a second metadata set** (~156 KB) alongside the
   default. It lives in its own module so no bundle that does not classify
   reachability pulls it in. Design D1 named the library, not the metadata
   profile.
2. **No schema migration for the deadline.** `date` is the correct type; the
   defect was in evaluation. Stated above.
3. **`0007` tightens a `0003` trigger.** Design D6 called the seat allowance a
   hard cap and said nothing about parity; parity is the newly confirmed product
   fact, and the design should be read as amended by it.
4. **Reachability is advisory at import, not a hard reject.** Reasoned above.

## Issues found

1. **`supabase_migrations.schema_migrations` records only `0001`–`0003`.**
   Migrations `0004`–`0006` are applied to the running instance but not
   recorded, so `0007` was applied the same way (directly) to stay consistent.
   A clean-database bootstrap has never been exercised end to end. Worth
   settling before the first deploy; out of scope here.
2. **The `sessionStorage` reload flag is never cleared.** It dies with the tab,
   which is acceptable, but a guest who hits two separate stale-chunk failures
   in one long-lived tab gets the message rather than a second reload. That is
   the safe side of the trade.
3. **`npm run build` run by hand rebuilds `.next` without
   `NEXT_PUBLIC_SITE_ORIGIN`**, and Playwright's `reuseExistingServer` will then
   serve that build — which failed the `og:image` absolute-origin E2E once. Not
   a product defect; a local-harness sharp edge. The suite is green when
   Playwright owns the server, as it does in CI.
4. **Three Work Unit 3 WARNINGs remain open**, untouched by this unit, as
   instructed.

## Explicitly out of scope, and left alone

No reminder/resend UI (`'resent'` remains reserved and unused), no public
ceremony/stream page, no Work Unit 3 WARNING or SUGGESTION work, and no start on
Work Units 4b, 5, 6a or 6b.

## Workload / PR boundary

- Mode: chained PR slice — PR4c, a correction unit between PR4a and PR4b.
- **Authored lines: ~1,686 (≈514 production, ≈1,172 test).** Far above the
  session's 800-line budget. It does not split usefully as delivered: it is five
  independent corrections mandated as one unit, and each is small on its own
  (the largest single production file is 132 lines). Recommending
  `size:exception`, or a split into five PRs if the reviewer prefers — the five
  fixes share no code and could each stand alone.
- **No commit.** The tree is normalized: `npm run format` and `npm run lint` ran
  after the last source change, and `npm run format:check` is clean.

## Verification — actual output

| Command | Observed result |
|---|---|
| `npm test` | `Test Files 24 passed (24)` / `Tests 346 passed (346)` — baseline was 20 / 296 |
| `npm run e2e` | `22 passed (7.0s)` — baseline was 12 |
| `npm run typecheck` | clean, no output |
| `npm run lint` | clean, no output |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run build` | `✓ Compiled successfully`; routes `/`, `/_not-found`, `/i/[slug]`, `/i/[slug]/opengraph-image`, `/robots.txt` |

Existing guarantees re-confirmed inside those runs: the `nullif` mutation test,
the `service_role` append-only tests, `anon` reaching nothing, and the raw-HTML
Open Graph assertions under a WhatsApp User-Agent.

## Status

14/14 Work Unit 4c tasks complete. Work units 1, 2, 2b, 3, 3b and 4a unchanged
(task 2.5 still PARTIAL on its environment-blocked `.env.example` half). Work
units 4b, 5, 6a, 6b and 7 untouched. Ready for `sdd-verify`.

---

# Work Unit 4b — Phone Gate

**Mode**: Strict TDD (`strict_tdd: true`, `npm test`). Every production file below
was preceded by a failing test that referenced code which did not exist.

## What the gate is

`/i/[slug]` previously rendered `InvitationBody` directly. It now renders the
gate first and the body only behind a verified unlock cookie. `InvitationBody`
is untouched and remains ONE shared component, so Work Unit 6b's admin-only
route can render the identical thing.

The route reads exactly **one** piece of unlock state: the signed `inv_unlock`
cookie. No query parameter, header, token or admin session participates, and
`unlockAction` is the only code that can mint one.

## The streaming-metadata question, measured

Work Unit 4a proved by measurement that this route did not stream its metadata.
Adding a gate is exactly what could have changed that. It did not, and this was
measured rather than assumed:

1. `next.config.ts` was replaced with an empty `NextConfig` (no
   `htmlLimitedBots`) and `e2e/invitation-page-og.spec.ts` was run twice — once
   normally and once with `CI=1`, which disables `reuseExistingServer` and
   therefore forces a fresh `npm run build && npm run start`. Port 3000 was
   confirmed free beforehand so no stale server could have answered.
2. **12/12 passed both times**, including `does not stream the tags after
   </head>`.
3. `next.config.ts` was restored and verified byte-identical by SHA-256
   (`e4b46dd34e2f7a0140a73128365b8c17a6ea01fb2565da42194ab9ae3440a15d` before
   and after).

**`htmlLimitedBots` is still NOT load-bearing.** The reason the gate did not
change this is structural and deliberate: there is no `loading.tsx`, no Suspense
boundary and no client-side fetch anywhere above `generateMetadata`.
`InvitationGate` is a synchronous props-only Server Component, and the only
Client Component (`GateForm`) is passed in as a child and holds no data. The
config line stays as the guard for the next structural change.

## Files

| File | Action | What |
|---|---|---|
| `lib/domain/rate-limit.ts` | Modified | `remainingAttempts(context, now)` — per-IP allowance left, clamped at 0 |
| `lib/domain/gate-copy.ts` | Created | `GATE_GENERIC_FAILURE`, `gateFeedbackMessages` — the one-message rule and the concrete counts, as pure text |
| `lib/domain/recovery-message.ts` | Created | `GATE_HELP_TEMPLATE`, `buildGateRecoveryLink` |
| `lib/server/gate.ts` | Created | `hashClientIp`, `GateAttemptsStore` port, `createGateAttemptsStore`, `attemptUnlock` |
| `lib/server/cookies.ts` | Created | `signUnlockCookie`, `verifyUnlockCookie`, `unlockCookieUnlocks`, `unlockCookieOptions` |
| `lib/server/invitations.ts` | Modified | `findSenderContactPhone` — the owning sender's contact, read separately |
| `components/invitation/InvitationGate.tsx` | Created | Sync props-only gate screen; greeting, then the form, then recovery |
| `app/i/[slug]/gate-form.tsx` | Created | `'use client'`, `useActionState`; action arrives as a prop |
| `app/i/[slug]/actions.ts` | Created | `'use server'` `unlockAction(slug, prev, formData)` |
| `app/i/[slug]/page.tsx` | Modified | Cookie check → body, else gate |
| `app/i/[slug]/load-invitation.ts` | Modified | `loadInvitationRecord`, `loadOwnerContactPhone`; projection now derives from the cached record |
| `e2e/helpers/seed.ts` | Modified | `ownerContactPhone` option, so the recovery-link assertion is not vacuous |

## Design decisions worth stating

**No oracle.** `UnlockOutcome.rejected` carries no reason, and
`GATE_GENERIC_FAILURE` is the single sentence produced by a wrong number, a
guest with no phone on file, and a nonexistent invitation alike. `gate-copy.spec.ts`
and an E2E both assert that no reason-naming string ("lista de invitados", "no
está registrado", "no existe", "sin teléfono") ever appears. A forged action
call against an unknown slug returns the same rejection shape and records no
attempt. The friendly unknown-slug page remains the one intentional distinction,
per design D10, and an E2E pins that it is the ONLY one.

**Concrete numbers, though.** "Te quedan 2 intentos.", "Te queda 1 intento.",
"Ese fue el último intento disponible por ahora.", "Por seguridad, espera 12
minutos antes de intentarlo de nuevo." — minutes rounded UP and floored at 1, so
"espera 0 minutos" is impossible and the guest is never sent back early.

**Lockout before comparison.** `attemptUnlock` reads history, calls
`evaluateGate`, and returns `locked` BEFORE touching a stored digit. A locked
attempt is not recorded, so a lockout cannot renew itself against a guest who
keeps refreshing. Tested with a correct number and with no guests at all.

**`ip_hash`.** `HMAC-SHA256(GATE_IP_PEPPER, ip)` truncated to 32 hex chars, in
`lib/server/gate.ts` only. `lib/server/env.ts` already refuses a pepper under 32
characters. The raw address is never stored or logged, and no submitted phone
appears in any error message or return value.

**Recovery, deliberately without an OTP.** `buildGateRecoveryLink` composes the
existing `renderMessageTemplate` and `buildWaMeLink` against the OWNING sender's
`contact_wa_phone_e164`. No one-time password, no email fallback: a prior
project shipped a complete phone+OTP recovery and its own migration records zero
rows used across 97 real guests. An E2E asserts no second mechanism is even
mentioned on the page.

**Greeting before the prompt.** The WhatsApp message promised "your invitation",
so the household is greeted first and asked second. Asserted structurally by
`compareDocumentPosition`, not by reading the markup. The greeting name is
already on the Open Graph card, so it is not a new disclosure.

## Deviations from design and spec

1. **Cookie lifetime is 180 days, not 30.** `specs/phone-gate/spec.md` and task
   4b.7 say 30 days; the work-unit instruction said months, not days, for an
   event this far out. 180 days satisfies the spec's only testable claim ("within
   30 days ... the gate MUST NOT be shown") and is asserted both in
   `cookies.spec.ts` and in an E2E reading the real `Set-Cookie` expiry. **The
   spec sentence "valid for 30 days" should be amended to a minimum rather than
   an exact value.** Flagging rather than silently reinterpreting.
2. **Re-issue on each successful VISIT is not implemented.** A fresh cookie is
   minted on each successful UNLOCK. Next.js cannot set a cookie during a Server
   Component render, so per-visit re-issue would require either middleware or a
   route handler on this path — both of which introduce a boundary in front of
   the route whose metadata guarantee this unit was explicitly told to protect.
   Traded for the 180-day lifetime instead. Stating it rather than describing the
   weaker guarantee as equivalent.
3. **Task 4b.12's console-operator half is deferred to 6a**, marked PARTIAL in
   `tasks.md`. The console and its session do not exist yet, so no operator can
   be authenticated. What is asserted today is the same invariant from the other
   side: no session-shaped cookie (`admin_session`, `device_sender`,
   `sb-access-token`, `unlocked`) and no forged `inv_unlock` bypasses the gate,
   because the page reads exactly one piece of unlock state.
4. **Three modules the design did not name**: `lib/domain/gate-copy.ts`,
   `lib/domain/recovery-message.ts`, and the `GateAttemptsStore` port inside
   `lib/server/gate.ts`. All three exist to keep logic testable without mocks —
   the alternative was asserting Spanish pluralization through a rendered DOM and
   the lockout arithmetic through a mocked PostgREST query builder.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4b.1–4b.2 | `lib/server/gate.spec.ts` | Integration (node) | N/A (new) | Written | Passed | 5 matching cases | Clean |
| 4b.3–4b.4 | `lib/server/gate.spec.ts` | Integration (node) | N/A (new) | Written | Passed | 6 rate-limit cases | Clean |
| 4b.5 | `lib/server/gate.spec.ts` | Unit | N/A (new) | Written | Passed | 6 hash cases | Clean |
| (support) | `lib/domain/rate-limit.spec.ts` | Unit | 40/40 green first | Written | Passed | 7 cases | None needed |
| 4b.6–4b.7 | `lib/server/cookies.spec.ts` | Unit | N/A (new) | Written | Passed | 16 cases | `unlockCookieUnlocks` extracted, 4 more cases |
| 4b.8 | `app/i/[slug]/gate-form.spec.tsx` | Component (RTL) | N/A (new) | Written | Passed | 6 cases | Clean |
| (support) | `lib/domain/gate-copy.spec.ts` | Unit | N/A (new) | Written | Passed | 9 cases | Clean |
| 4b.9–4b.10 | `e2e/phone-gate.spec.ts` | E2E | 22/22 green first | Written | Passed | 28 cases | Clean |
| 4b.15 | `lib/domain/recovery-message.spec.ts` | Unit | N/A (new) | Written | Passed | 7 cases | Clean |
| 4b.15 | `components/invitation/InvitationGate.spec.tsx` | Component (RTL) | N/A (new) | Written | Passed | 8 cases | Clean |
| 4b.11–4b.14, 4b.16–4b.18 | `e2e/phone-gate.spec.ts` | E2E | 22/22 green first | Written | Passed | 28 cases | Clean |

Two RED→GREEN cycles required real fixes rather than test edits:

1. `attemptUnlock` double-counted the attempt it had just recorded. The FAKE was
   at fault — it returned a live array that `recordAttempt` then mutated — and
   the fix was to return a snapshot, which is what a database read does anyway.
2. The E2E lockout loop outran the server: asserting the generic sentence passed
   against the PREVIOUS render. It now asserts the exact countdown, which is
   unique per attempt, and therefore also proves the countdown is real.

### Test summary

- Unit/component tests added: **78** (346 → 424)
- E2E tests added: **28** (22 → 50)
- Pure functions created: `remainingAttempts`, `gateFeedbackMessages`,
  `buildGateRecoveryLink`, plus two private helpers
- Mock count: highest in any new file is **one** fake (`GateAttemptsStore`)

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run lib/server/gate.spec.ts lib/server/cookies.spec.ts lib/domain/gate-copy.spec.ts lib/domain/recovery-message.spec.ts "app/i/[slug]/gate-form.spec.tsx" components/invitation/InvitationGate.spec.tsx` — all passed during the cycle |
| Runtime harness | `npm run e2e -- e2e/phone-gate.spec.ts` → **28 passed**, against a real `next build && next start` and a real local Supabase |
| Rollback boundary | Delete the 14 new files, revert the 6 modified ones. `InvitationBody`, the OG image route, `robots.ts`, every migration and every Work Unit 1–4c test are untouched. |

## Issues found

1. **`e2e/helpers/seed.ts` hard-coded one owner contact for every fixture.** The
   recovery-link assertion would have passed even if the link addressed the
   wrong sender. Fixed by making it a per-fixture option and asserting two
   different owners.
2. **`react-hooks/purity` rejects `Date.now()` inside a Server Component.**
   Correctly: the clock belongs in the adapter (design D2). `unlockCookieUnlocks`
   owns it now.
3. **Next.js renders its own empty `role="alert"` route announcer**, so an
   unscoped `getByRole("alert")` is ambiguous. The E2E scopes it to the form.
4. **Three Work Unit 3 WARNINGs remain open**, untouched, as instructed.

## Explicitly out of scope, and left alone

RSVP (Work Unit 5), the console (6a), dispatch and previews (6b), the public
ceremony/Zoom page, reminders, and the three open Work Unit 3 WARNINGs. No
migration was added or changed; `gate_attempts` already existed from Work Unit 3.

## Workload / PR boundary

- Mode: chained PR slice — PR4b, following PR4c.
- **Authored lines: ~2,381 (≈780 production, ≈1,601 test).** Far above the
  400-line default budget. The slice is one cohesive deliverable — a gate whose
  cookie, rate limiter, copy and route wiring are useless apart — and the test
  half is two thirds of it. Recommending `size:exception`. If the reviewer
  prefers a split, the natural seam is (a) `cookies.ts` + `gate.ts` + their
  specs, then (b) the route, component and E2E.
- **No commit.** The tree is normalized: `npm run format` and `npm run lint` ran
  after the last source change and `npm run format:check` is clean.

## Verification — actual output

| Command | Observed result |
|---|---|
| `npm test` | `Test Files 30 passed (30)` / `Tests 424 passed (424)` — baseline 24 / 346 |
| `npm run e2e` | `50 passed (11.1s)` — baseline 22 |
| `npm run typecheck` | clean, no output |
| `npm run lint` | clean, no output |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run build` | `✓ Compiled successfully`; routes `/`, `/_not-found`, `/i/[slug]`, `/i/[slug]/opengraph-image`, `/robots.txt` |

Re-confirmed inside those runs: the raw-HTML Open Graph assertions under a
WhatsApp User-Agent including `does not stream the tags after </head>`, no phone
digits in the page source, the `nullif` mutation test, `service_role`
append-only, seat parity, and the external anon-key RLS invariants.

## Status

18/18 Work Unit 4b tasks complete (4b.12 PARTIAL — console-operator half
deferred to 6a). Work units 1, 2, 2b, 3, 3b, 4a and 4c unchanged (task 2.5 still
PARTIAL). Work units 5, 6a, 6b and 7 untouched. Ready for `sdd-verify`.

---

# Work Unit 4d — Phone Gate Hardening

Three fixes from the Work Unit 4b reliability review. Two are security defects
in the gate that unit built; the third is a correct line nothing asserted.

## Fix 1 — `R3-unknown-invitation-oracle`

### What was wrong

`app/i/[slug]/actions.ts` answered an unknown invitation with a constant
`{ status: "rejected", attemptsRemaining: 0 }`, and its own comment claimed an
unknown slug and a wrong number therefore "both come back as the same generic
rejection". The SHAPE matched. The VALUES did not. A real invitation answers a
wrong number with a counter that walks 7, 6, 5 … 0 and then a lockout, so the
very first forged call separated the two: "te quedan 7 intentos" meant the slug
was real. The oracle leaked through the data, not the structure — which is
exactly why a single-call, shape-only assertion never caught it.

### What was done

The decoy no longer re-implements the rejection. It runs the REAL gate:
`attemptUnlock` with the real `evaluateGate` and `remainingAttempts`, against a
household with an EMPTY guest list. `matchesInvitation` over an empty list is
false for every input, so every attempt is a rejection and the counter, the
lockout moment and the retry duration are identical **by construction** rather
than by two implementations agreeing. `toGateFeedback` was extracted into
`lib/server/gate.ts` so both branches of the action share one outcome-to-copy
mapping — two hand-written mappings are precisely how the values drifted apart
the first time.

The test compares whole SEQUENCES, twelve steps deep, plus the rendered Spanish
at every step, plus the exact lockout attempt and duration. It carries two
guards against vacuity: one asserting the decoy counter actually walks down
(so the equality cannot pass because both sides are flat), and one negative
control asserting the shipped constant-zero value is separable from the real
first response.

### The honest constraint, and the residual gap

Nothing is persisted for a slug with no row, and nothing should be: writing
`gate_attempts` rows for attacker-chosen slugs would hand an unauthenticated
caller an unbounded write channel into the table that exists to slow attackers
down. That trades an existence oracle for a storage-abuse vector. So the decoy
counts in bounded process memory (LRU, `DECOY_SLUG_CAPACITY = 512` slugs).

**A perfectly indistinguishable counter is therefore not achievable here, and
this is not it.** What remains observable, stated plainly rather than described
as equivalent:

1. **Cold starts and horizontal scale.** A real invitation's counter lives in
   Postgres and is shared by every serverless instance. The decoy's lives in one
   instance's memory. An attacker whose requests land on a fresh instance sees
   the decoy counter restart while a real one would not.
2. **LRU eviction.** Probing ~512 other unknown slugs evicts this one and resets
   its counter for free. A real invitation cannot be reset that way. This is
   asserted directly in `decoy-gate.spec.ts` rather than left implicit, together
   with the companion test showing an actively probed slug stays resident.
3. **Latency.** The real path costs two extra Postgres round trips (the attempt
   read and the insert) that the decoy does not. Closing this would mean issuing
   decoy queries driven by attacker-chosen slugs — real database load bought
   with a forged request — so it was left open deliberately.
4. **Pre-existing, not introduced here:** a malformed slug is rejected by
   `isWellFormedSlug` with no database round trip at all, which is a coarser
   timing distinction than any of the above. It predates this unit and was left
   alone.

Every one of these is a far weaker signal than a constant zero on the first
call, and reading any of them requires an attacker who is already forging Server
Action calls against an 80-bit slug they have no reason to believe exists.

## Fix 2 — `R3-client-ip-untrusted-and-untested`

### What was actually verified, not assumed

The instruction was explicit about not taking the diagnosis on trust. Sources
read directly:

- **`https://vercel.com/docs/headers/request-headers`** (page states "Last
  updated December 13, 2025"), fetched and read:
  - `x-forwarded-for` — "If you are trying to use Vercel behind a proxy, we
    currently overwrite the X-Forwarded-For header and do not forward external
    IPs. **This restriction is in place to prevent IP spoofing.**"
  - The same page then documents **"Custom X-Forwarded-For IP"**: "Trusted Proxy
    is available on Enterprise plans. Enterprise customers can purchase and
    enable a trusted proxy to allow your custom X-Forwarded-For IP."
  - `x-vercel-forwarded-for` — "This header is identical to the x-forwarded-for
    header. However, x-forwarded-for could be overwritten if you're using a proxy
    on top of Vercel."
  - `x-real-ip` — "This header is identical to the x-forwarded-for header."
- **`@vercel/functions@3.9.6`**, downloaded with `npm pack` and read: `headers.js`
  defines `const IP_HEADER_NAME = "x-real-ip"` and `ipAddress()` returns
  `getHeader(headers, IP_HEADER_NAME)` — that header and nothing else, with no
  comma splitting and no `x-forwarded-for` fallback. `headers.d.ts` documents it
  as "Client IP as calculated by Vercel Proxy". The package is NOT a project
  dependency and was not added; it was read as evidence of what Vercel itself
  trusts.
- **`https://vercel.com/docs/environment-variables/system-environment-variables`**:
  `VERCEL = 1`, "Available at: Both build and runtime".

**Where the review's premise needs a correction.** On a default Vercel
deployment the reviewer's specific claim — that anyone can send
`X-Forwarded-For: 1.2.3.4` and get a fresh bucket — is FALSE, because Vercel
overwrites that header expressly to prevent spoofing. The finding is still
correct that the code was wrong, for two other reasons: the left-most-entry
parse is a parser for a list only an untrusted intermediary produces, and
Trusted Proxy turns that header back into customer-proxy input on Enterprise. A
security property that depends on a billing plan is not one. This was reported
rather than quietly implemented as if the original diagnosis had been exact.

### What was done

`lib/server/client-ip.ts` reads `x-vercel-forwarded-for`, then `x-real-ip`, and
only when `process.env.VERCEL === "1"`. `x-forwarded-for` is never read at all.
Whole trimmed values are used; nothing is split on a comma. Off Vercel — local
development, any self-hosted Node process — no header is trustworthy, so every
visitor shares the constant `shared-untrusted-origin` bucket. That is coarse and
it is the correct direction to fail: a shared lockout inconveniences visitors
who share an origin, a client-chosen bucket removes the lock entirely.

Local development is unaffected in practice, because `next dev` and `next start`
set none of these headers, so the previous code was already producing its
`"unknown"` constant there.

### Residual gap

If Vercel's system environment variables are switched off for the project,
`VERCEL` is absent and every visitor falls into the shared bucket. That costs
bucket granularity, never safety, and is the deliberate fail-closed direction.

## Fix 3 — `R3-unlock-cookie-secure-unasserted`

`secure: process.env.NODE_ENV === "production"` was correct and untested, which
for a security attribute is the same as absent — a refactor could pin it to a
constant in either direction and every test would still pass. Both branches are
now asserted, plus the `test` branch. Because the production code already
existed, RED was demonstrated by mutation instead: `secure: true` fails 2 of the
3 new tests, `secure: false` fails 1, and the unmutated line passes 23/23.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4d.1–4d.3 | `lib/server/decoy-gate.spec.ts` | Integration (node) | 73/73 green first | Written first — `Cannot find module './decoy-gate'` | Passed, 12 tests | 12 cases: 12-step sequence equality, non-flatness guard, negative control, copy equality, lockout equality, real-guest number, four never-unlock inputs, per-slug scoping, per-address allowance, window expiry, LRU eviction, LRU hotness | `toGateFeedback` extracted so both paths share one mapping |
| 4d.4–4d.6 | `lib/server/client-ip.spec.ts` | Unit | N/A (new) | Written first — `Cannot find module './client-ip'` | Passed, 12 tests | 12 cases across 2 platforms and 6 forgeable headers | Clean |
| 4d.7 | `e2e/phone-gate.spec.ts` | E2E | 50/50 green first | Ran against the restored defective reader — FAILED with `Expected "Te quedan 3 intentos." / Received "…Te quedan 7 intentos."` | Passed, 3 tests | 3 cases: split-context countdown, third address vs lockout, forged address + correct number | Clean |
| 4d.8 | `lib/server/cookies.spec.ts` | Unit | 23/23 green first | Mutation-proved (see below) | Passed, 3 new tests | 3 branches: production, development, test | Clean |

### Mutation proof for 4d.8 and 4d.7

RED for an already-correct line cannot come from a missing module, so the
assertions were proved non-vacuous by breaking the production code instead:

| Mutation | Result |
|---|---|
| `secure: true` | 2 failed, 21 passed |
| `secure: false` | 1 failed, 22 passed |
| unmutated | 23 passed |
| `clientIpHash` restored to the left-most `x-forwarded-for` read | new E2E group FAILED at the second context's first attempt |
| fix restored | new E2E group 3 passed |

### Test summary

- Unit tests added: **27** (424 → 451)
- E2E tests added: **3** (50 → 53)
- Pure functions created: `trustedClientIp`, `toGateFeedback`
- Mock count: highest in any new file is **one** fake (`GateAttemptsStore`)

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run lib/server/` → **127 passed** |
| Runtime harness | `npm run e2e -- e2e/phone-gate.spec.ts -g "client-supplied forwarding header"` → RED 1 failed / 2 did not run against the restored defect, then **3 passed** against the fix, on a real `next build && next start` and a real local Supabase |
| Rollback boundary | Delete `lib/server/client-ip.ts`, `lib/server/client-ip.spec.ts`, `lib/server/decoy-gate.ts`, `lib/server/decoy-gate.spec.ts`; revert `app/i/[slug]/actions.ts`, `lib/server/gate.ts`, `lib/server/cookies.spec.ts` and the one added describe in `e2e/phone-gate.spec.ts`. Nothing from work units 1–4c is touched, no migration is added or changed, and no RSVP/console file exists yet to disturb. |

## Issues found

1. **Lint caught a false claim in a comment.** `decoy-gate.ts` imported
   `GATE_HISTORY_WINDOW_MS` and its comment said pruning used it directly. It
   does not — the horizon arrives as the `since` argument `attemptUnlock`
   computes, which is better (one source, not a copy). The import was dead and
   the comment was wrong; both were fixed rather than the import being "used" to
   silence the warning.
2. **Two of my own test expectations were arithmetically wrong** and were
   corrected against production behaviour, not the reverse: the ninth attempt's
   `retryAfterMs` is `30 min − 1 s` (thirty minutes from the eighth failure at
   `NOW + 7 s`, asked at `NOW + 8 s`), and the LRU-hotness case leaves 4
   attempts, not 3. In both, the primary assertion — decoy equals real — had
   already passed; only the redundant absolute values were off.
3. **The review's `x-forwarded-for` premise is inexact on Vercel** (see Fix 2).
   Reported rather than implemented silently.
4. **Fix 1 has no E2E.** Reaching the unknown-invitation path requires forging a
   Server Action call with a build-specific `Next-Action` id; an unknown slug
   renders the friendly page with no form. It is covered at the unit layer,
   which is where a whole-sequence comparison belongs anyway.
5. **The three open Work Unit 3 WARNINGs and the three SUGGESTION findings from
   this review were left untouched**, as instructed.

## Explicitly out of scope, and left alone

The three SUGGESTION findings from the 4b review, the three open Work Unit 3
WARNINGs, RSVP (Work Unit 5), the console (6a), dispatch and previews (6b), the
public ceremony page, and reminders.

## Workload / PR boundary

- Mode: chained PR slice — PR4d, following PR4b.
- Authored lines: ~700 (≈180 production, ≈520 test and documentation). Above the
  400-line default budget, and the test half is three quarters of it. The slice
  is one cohesive deliverable: three findings from one review of one module,
  each with its own rollback boundary. Recommending `size:exception`. If a split
  is preferred, the natural seam is (a) `client-ip.ts` + `cookies.spec.ts`, then
  (b) `decoy-gate.ts`.
- **No commit.** The tree is normalized: `prettier --write` ran after the last
  source change and `npm run format:check` is clean.

## Verification — actual output

| Command | Observed result |
|---|---|
| `npm test` | `Test Files 32 passed (32)` / `Tests 451 passed (451)` — baseline 30 / 424 |
| `npm run e2e` | `53 passed (11.3s)` — baseline 50 |
| `npm run typecheck` | clean, no output, exit 0 |
| `npm run lint` | clean, no output (after fixing the unused import it surfaced) |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run build` | `✓ Generating static pages using 8 workers (5/5)`; routes `/`, `/_not-found`, `/i/[slug]`, `/i/[slug]/opengraph-image`, `/robots.txt` |

Re-confirmed inside those runs: the raw-HTML Open Graph assertions under a
WhatsApp User-Agent including `does not stream the tags after </head>`, no phone
digits in the page source, exactly one unlock path with no query-parameter
bypass, the `nullif` mutation test, `service_role` append-only, seat parity, and
the external anon-key RLS invariants.

## Status

9/9 Work Unit 4d tasks complete. Work units 1, 2, 2b, 3, 3b, 4a, 4b and 4c
unchanged (task 2.5 and 4b.12 still PARTIAL). Work units 5, 6a, 6b and 7
untouched. Ready for `sdd-verify`.

# Work Unit 5 — RSVP

Phase 5 (tasks 5.1–5.9), plus the four leftover findings from the Work Unit 4d
review. Strict TDD active; test runner `npm test`; local Supabase up.

## What this unit delivers

Without it the product does nothing: a guest could open their invitation and had
no way to answer it. Now they can, and the answer reaches Postgres through one
authorized path.

## The aggregate rule, and why it is a database object

`rsvp_responses` is append-only by trigger. A guest who changes her mind writes a
SECOND row and the first one stays, because "she said yes, then cancelled" is
information the couple wants. That history is correct, and it is also the shape
that makes the obvious query wrong: `count(*) where attending` over the raw table
counts every mind ever changed, and `sum(seats_confirmed)` totals seats released
weeks ago. A reference project's dashboard reported 47 confirmed from 17 answers
and shipped the defect twice, in two screens, because the reduction was
re-derived at every call site.

So the reduction is one object. `supabase/migrations/0008_rsvp_latest.sql` adds:

```sql
create view rsvp_latest with (security_invoker = true) as
select distinct on (invitation_id) ... from rsvp_responses
order by invitation_id, submitted_at desc, id desc;
```

Three decisions inside that, each load-bearing:

- **`distinct on`** keeps exactly one row per invitation, in the database,
  evaluated once — not a window function whose partition a later `where` can
  silently widen.
- **`id desc` after `submitted_at desc`.** `submitted_at` defaults to `now()`,
  which is the TRANSACTION timestamp: two rows written in one transaction carry
  the identical value to the microsecond, and the winner would be left to the
  planner — stable in a test, arbitrary in production, different after a plan
  change. The second key makes the ordering total.
- **`security_invoker = true`.** A view runs with its OWNER's privileges by
  default, so an ordinary view over an RLS-protected table is a hole straight
  through that protection. The 0004 event trigger additionally revokes
  `anon`/`authenticated` on it at creation; both guards are kept, because either
  one alone has been the missing one somewhere.

Every RSVP count, list and total — here, in the console (6a), and in anything
added later — MUST start from `rsvp_latest`. `rsvp_responses` stays correct for
exactly one thing: showing the history AS history.

The RED test is the one that would have caught the reference defect: seed, submit
yes, submit no, then assert the aggregate reports ONE response and reports it as
no. `supabase/tests/rsvp-latest.spec.ts` also measures the defect directly —
`naiveAttending === 1` and `naiveSeats === 2` over the raw table beside
`reducedAttending === 0` and `reducedSeats === 0` over the view — and
`e2e/rsvp.spec.ts` repeats the two-submission sequence through a real browser.
A test that submits once cannot detect this class of bug at all: the naive count
and the correct one agree on every household that never changed its mind.

## Seats are derived, never typed

The database enforces two rules that must agree with the form: the hard cap
(`seats_confirmed <= seats_allowed`, 0003) and parity (`seats_confirmed =
cardinality(attendee_guest_ids)`, 0007). Every seat on this guest list belongs to
a named person, so the honest input is the set of checked boxes and nothing else.
`seats_confirmed` is computed from that set inside `submitRsvp`. There is no
field on the wire that reaches that column — a payload adding `seatsConfirmed` is
not rejected, it is simply never read — so a mismatch cannot be submitted, not
merely cannot be submitted by the form.

A consequence worth recording: because the seat count IS the attendee count, an
over-cap submission always trips `seats_exceed_allowed` first, and
`attendees_exceed_allowed` is unreachable from this module. Both map to one guest
sentence, and `lib/server/rsvp.spec.ts` states the reason in a comment rather than
leaving a reader to wonder which fires.

Check ORDER inside `submitRsvp` is the security property, exactly as it is in the
gate: cookie → deadline → parse → seat validation → household membership → write.
An unauthorized caller learns nothing about the invitation, including whether it
is closed. Shape is checked before identity, matching `validateRsvpSelection`'s
own ordering: five names against three seats is over the cap whoever those five
people are, and answering "we do not recognize one of them" would report a
downstream symptom.

## Authorization

The write goes through a Server Action behind the signed unlock cookie, and the
cookie is verified against THIS invitation's id. A direct client insert would
need an `anon` INSERT policy on `rsvp_responses` keyed on a slug the caller
already holds — an unauthenticated write endpoint whose only credential is the
value being checked, which is a spam channel rather than authorization.

`attendee_guest_ids` is a uuid array, not a foreign key, so the database cannot
notice a stranger being seated with a household. The action passes
`record.guests.map(g => g.id)` and `submitRsvp` refuses anything outside it. Both
halves are tested, and the E2E injects a real guest id from a DIFFERENT seeded
household to prove it end to end.

## Deadline

`rsvpIsOpenNow` in `lib/server/rsvp.ts` is the adapter that supplies the clock to
the existing `isRsvpOpen`, mirroring `unlockCookieUnlocks`. No offset is
hard-coded and the Bogota day-end rule is untouched. Past the deadline the page
renders `RsvpClosed` INSTEAD OF the form — not a disabled form, not one whose
submissions are dropped, because a household that fills in a discarded form
believes they answered and nobody finds out until the seating chart is wrong.
The E2E asserts `form.rsvp__form` has count 0.

## The four Work Unit 4d findings

### 1. `R3-action-wiring-unproved`

New `app/i/[slug]/actions.spec.ts`, ten tests on the actions themselves. The
seam is now asserted in both directions: an unknown slug reaches
`decoyUnlockOutcome` and never `attemptUnlock`, a known one the reverse, and both
paths produce byte-identical feedback and identical Spanish copy for the same
outcome. RED was demonstrated by mutation, because the production code already
existed: changing line 70 to `if (record === null && false)` fails 2 of the 10.

### 2. `R3-e2e-third-case-asserts-lockout-not-its-name`

The test was named "cannot use one to reach the invitation body either" while
what it actually proves is stronger and different: it submits Camila's CORRECT
number and the lockout still wins, because the gate consults the lockout before
it compares anything. Renamed to "does not open for a CORRECT number while the
lockout holds", the number is now derived from `PHONE_ONE` so the intent is
visible at the call site, the regex assertion matches the sibling test, and every
entry in `GATED_TEXT` is asserted absent rather than one hard-coded sentence.

### 3. `R3-lru-test-coupled-to-scope-tuning`

The two eviction tests asserted literal `attemptsRemaining: 7` and `4`, which are
`IP_SCOPE.threshold` arithmetic. They now derive from a local `remainingAfter()`
helper. **Proven, not assumed**: retuning `IP_SCOPE.threshold` from 8 to 6 fails
7 of the 12 decoy tests and the two LRU tests are not among them. The
sequence-equality tests deliberately KEEP their literals — what those assert IS
the exact counter a guest sees, and deriving them from the same constant the
production code uses would let both drift together in silence.

### 4. `R3-shared-bucket-collapses-per-ip-scope`

Behaviour unchanged, as instructed. The tradeoff is now stated at the exact line
that makes it (`trustedClientIp`'s early return) rather than only in the module
header a reader may not reach, and a new test pins it as INTENT: two different
visitors off Vercel resolve to the SAME bucket. Mutation check: making that
branch read `x-real-ip` fails 3 tests, including the new one.

## Deviations from design

- **`rsvp_latest` is new.** `design.md` names the index
  `rsvp_responses_latest_idx` and the "latest row wins" rule but no view. The
  view was added because the rule needs one owner: two screens re-deriving it is
  precisely how the reference project double-counted. The index still serves the
  leading keys of the view's ordering.
- **`components/invitation/RsvpClosed.tsx` is new**, not in the design's file
  table. It exists so the deadline surface is unit-testable; the page itself is
  an async Server Component and cannot be.
- **`InvitationBody` gained an optional `rsvp` slot.** The design has the form
  living inside the body, and `components/**` may not import `lib/server/**`, so
  the route composes the bound action and the body decides only where the answer
  belongs. With no slot passed the rendered markup is byte-identical — the
  approved snapshot passes unchanged, and a second snapshot asserts it.
- **`zod` moved from a dev-only transitive dependency to a declared runtime
  dependency**, which `openspec/config.yaml` already listed under
  `testing.runtime_dependencies` and task 5.4 required.
- **Three assertions in `e2e/phone-gate.spec.ts` are now scoped** to
  `section.invitation__household`. Guest names appear twice on an unlocked page
  since the RSVP shipped — once in the household list, once as a checkbox label —
  and Playwright's strict mode was right to refuse the ambiguous query: "the name
  is somewhere on the page" would have been satisfied by the form alone.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| aggregate rule | `supabase/tests/rsvp-latest.spec.ts` | Integration (real Postgres) | 451/451 green first | ✅ 5 failed — `relation "rsvp_latest" does not exist` | ✅ 5/5 after `supabase db reset` applied 0008 | 5 cases: latest wins, naive-vs-reduced counter-measurement, same-instant tie-break, per-invitation isolation, anon/invoker posture | ➖ view written once |
| 5.1–5.4 | `lib/server/rsvp.spec.ts` | Unit (port) | 456/456 | ✅ `Cannot find module './rsvp'` | ✅ 23/23, then 27/27 | 27 cases across authorization, derivation, optional fields, append-only, deadline | ✅ seat validation reordered before membership so the reported reason is the first thing actually wrong |
| store adapter | `supabase/tests/rsvp-store.spec.ts` | Integration (PostgREST + secret key) | — | ✅ mutation: `.from("rsvp_latest")` → `"rsvp_responses"` fails 2 of 5 | ✅ 5/5 | 5 cases: no answer, round-trip, changed answer, `service_role` update refused, cap refused | ➖ |
| copy | `lib/domain/rsvp-copy.spec.ts` | Unit (pure) | — | ✅ `Cannot find module './rsvp-copy'` | ✅ 15/15 | 15 cases incl. every rejection reason mapped | ➖ |
| 5.5 | `components/invitation/RsvpForm.spec.tsx` | Component (jsdom) | — | ✅ `Failed to resolve import "./RsvpForm"` | ✅ 18/18 | 18 cases: cap, decline, derivation, optional fields, pre-fill, feedback | ➖ |
| 5.7 | `components/invitation/RsvpClosed.spec.tsx` | Component (jsdom) | — | ✅ `Failed to resolve import "./RsvpClosed"` | ✅ 2/2 | 2 cases | ➖ |
| slot | `components/invitation/InvitationBody.spec.tsx` | Component (jsdom) | 11/11 | ✅ 1 failed — no `rsvp` prop | ✅ 12/12 | 2 cases incl. unchanged-markup snapshot | ➖ |
| 5.6 + finding 1 | `app/i/[slug]/actions.spec.ts` | Unit (mocked boundaries) | — | ✅ 4 failed — `submitRsvpAction is not a function`; and mutation on line 70 fails 2 | ✅ 10/10 | 10 cases across both actions | ➖ |
| 5.8 | `e2e/rsvp.spec.ts` | E2E (Playwright + real DB) | 53/53 | ✅ file absent | ✅ 10/10 | 10 cases: derivation, pre-fill, changed answer, cap, DOM-tampered over-cap, foreign guest, three deadline states, lost session | ➖ |
| finding 3 | `lib/server/decoy-gate.spec.ts` | Integration (node) | 12/12 | ✅ retuning `IP_SCOPE.threshold` 8→6 fails 7 of 12, and NOT the two LRU tests | ✅ 12/12 | — | ✅ literals replaced by `remainingAfter()` |
| finding 4 | `lib/server/client-ip.spec.ts` | Unit | 12/12 | ✅ mutation: reading `x-real-ip` off Vercel fails 3 | ✅ 13/13 | — | ➖ behaviour deliberately unchanged |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run lib/server/rsvp.spec.ts` → `Tests 27 passed (27)`; `npm run e2e -- e2e/rsvp.spec.ts` → `10 passed` |
| Runtime harness | `supabase db reset` applied `0001`–`0008` in order; `supabase/tests/rsvp-latest.spec.ts` and `rsvp-store.spec.ts` ran against that live instance, the latter over PostgREST with the real secret key; the full E2E suite ran against `npm run build && npm run start` |
| Rollback boundary | Revert `lib/server/rsvp.ts`, `lib/domain/rsvp-copy.ts`, `components/invitation/Rsvp*.tsx`, `e2e/rsvp.spec.ts`, the `submitRsvpAction` block in `actions.ts`, the `loadCurrentRsvp` block in `load-invitation.ts`, the unlocked branch of `page.tsx`, the `rsvp` slot in `InvitationBody.tsx`, and run `supabase/down/0008_rsvp_latest_down.sql`. Nothing in work units 1–4d depends on any of it. The three finding fixes are independently revertible and touch tests plus one comment |

## Verification

| Command | Observed result |
|---|---|
| `npm test` | `Test Files 39 passed (39)` / `Tests 536 passed (536)` — baseline 32 / 451 |
| `npm run e2e` | `63 passed (11.8s)` — baseline 53 |
| `npm run typecheck` | clean, no output, exit 0 |
| `npm run lint` | clean, no output, exit 0 |
| `npm run format:check` | `All matched files use Prettier code style!` (after one `npm run format` pass over 6 new files) |
| `npm run build` | `✓ Compiled successfully`; `✓ Generating static pages using 8 workers (5/5)`; routes `/`, `/_not-found`, `/i/[slug]`, `/i/[slug]/opengraph-image`, `/robots.txt` |
| `npm run test:coverage` (task 5.9) | `Tests 536 passed (536)`; `All files 94.07% stmts / 88.51% branch`; `rsvp.ts 95.23 / 95.45` |

Two E2E tests in `phone-gate.spec.ts` failed on the first full run — strict-mode
violations from guest names now appearing twice on an unlocked page. Scoped to
the household list and re-run green; this is recorded rather than quietly fixed
because it is a real consequence of shipping the form, not a flake.

Re-confirmed inside those runs: the raw-HTML Open Graph assertions under a
WhatsApp User-Agent including that the tags do not appear after `</head>`, no
phone digits in the page source, exactly one unlock path with no query-parameter
bypass, the `nullif` mutation test, `service_role` append-only, seat parity, and
the external anon-key RLS invariants.

## Status

9/9 Work Unit 5 tasks complete. Work units 1, 2, 2b, 3, 3b, 4a, 4b, 4c and 4d
unchanged (task 2.5 and 4b.12 still PARTIAL). Work units 6a, 6b and 7 untouched;
the console, dispatch, the public ceremony page, reminders and the three open WU3
WARNINGs remain out of scope. Ready for `sdd-verify`.


---

# Work Unit 5b — Decline-to-Stream, Ceremony Row, Message Removal

Appended. Work units 1, 2, 2b, 3, 3b, 4a, 4b, 4c, 4d and 5 above are unchanged;
tasks 2.5 and 4b.12 remain PARTIAL. The console (6a), dispatch (6b), reminders,
the public ceremony page and the three open WU3 WARNINGs stay out of scope.

## The four deliverables

### 1. Declining auto-submits

`components/invitation/RsvpAnswer.tsx` (renamed from `RsvpForm.tsx`, because it
is no longer always a form). Choosing "No podremos acompañarlos" submits on the
first tap. Accepting still requires the explicit button, because there the
household must first choose who is coming.

The submit is fired from an EFFECT rather than from the change handler. A
synchronous `requestSubmit()` runs before React has re-rendered, so the attendee
fieldset is still enabled and the payload would carry whatever boxes the
household had checked under a previous "yes". The server drops them anyway
(`payload.attending ? ids : []`), but a payload that says "we cannot come, and
here are two of us" is one refactor away from reaching the database and failing
`rsvp_declined_has_zero_seats` as a 500. A test pins the ordering: check two
people under "yes", then decline, and the submitted `attendee` list is empty.

The trigger is a COUNTER, not a boolean. Two declines in a row are two distinct
requests, and a boolean already `true` produces no change for the effect to act on.

### 2. The stream replaces the form

`components/invitation/CeremonyStream.tsx` — props-only, no data access, its
prop type has no field for a phone number. Date, time, meeting id and passcode,
each rendered beside its own `<dt>`.

The surface follows the RECORDED answer, never the tap: `answerOnFile` moves
only when the action returns `recorded`. A refusal keeps the form, because
swapping in the stream card on a refused decline would tell a household they are
expected on a call while the couple's list still has them as unanswered. That is
an explicit test, and so is the second-identical-decline case — a component that
only reacted to a CHANGED result would stall on the form there. The unit test's
fake action returns a FRESH object per call for that reason, matching what the
real one does across the RSC boundary.

### 3. The answer stays changeable

"Volver a responder" returns the form with NOTHING preselected: a mis-tap must
not be one more tap away from repeating itself, and re-choosing "no" has to be a
real change that fires the auto-submit again.

`e2e/rsvp.spec.ts` proves the round trip against the real database — decline,
reconsider, accept — and asserts the history is `[true, false, true]` while
`rsvp_latest` reports the acceptance with one seat.

### 4. The message field is gone, column included

`0010_drop_rsvp_message.sql`. The reasoning is recorded in the migration itself:
the flow begins in the guest's own WhatsApp thread and arrives from the couple's
own numbers, so a box here competes with the chat they are already in and loses.
Removing the field but keeping the column would leave a second inbox nobody
reads and a column any future writer can quietly start filling.

`rsvp_latest` selects `message`, so the DROP is wrapped in an explicit
drop-and-recreate of the view. NOT `drop column ... cascade`, which would take
the view with it and leave every RSVP aggregate re-deriving "latest row wins" at
its own call site — the exact defect 0008 exists to end.

**`dietary_notes` STAYS.** Not a message: operational data the catering needs
that a guest will not send unprompted. Asserted positively in three places so
"no message column" can never be satisfied by a query that was looking in the
wrong table.

A `message` field on the wire is IGNORED, not rejected — the same treatment
`seatsConfirmed` gets, for the same reason: nothing reads it, so there is
nothing to validate and nowhere for it to land.

## The ceremony row

`0009_ceremony.sql`. One row, `id boolean primary key default true` plus a
`ceremony_is_singleton` CHECK, so a second row is a primary-key violation and an
`id = false` row is a check violation. Singularity is enforced, not agreed.

Columns are `text`, and the seeded values are `{{CEREMONY_DATE}}`,
`{{CEREMONY_TIME}}`, `{{ZOOM_MEETING_ID}}`, `{{ZOOM_PASSCODE}}` — the same
visibly-unfinished form `{{WEDDING_DATE}}` already uses. A `date` column would
have demanded a plausible date, and a plausible date is a wrong invitation that
reads as a correct one. Nothing was invented.

**The `0004` event trigger was VERIFIED, not assumed.** `0009` deliberately
writes NO revoke of its own, and `supabase/tests/ceremony.spec.ts` asserts the
`anon`/`authenticated` grant list on `ceremony` is empty. A revoke in the
migration would have satisfied that test on its own and hidden the answer. The
down/forward replay below re-created the table at a completely different point
in time and the grant list was empty again.

`ceremony` was added to `OWNED_TABLES` in BOTH `supabase/tests/helpers/db.ts`
and `e2e/invariants/rls.spec.ts`, with insert and update payloads, plus a direct
database read proving the row still holds its own passcode after all four anon
verbs were refused.

## Mutation checks (RED where production code already existed)

| Mutation | Observed |
|---|---|
| `alter table ceremony disable row level security` on the live instance | 2 of 17 fail, including `supabase/tests/rls.spec.ts`'s posture assertion — the `alter table` line in 0009 is load-bearing |
| `supabase/tests/ceremony.spec.ts` written before `lib/server/ceremony.ts` | `Cannot find package '@/lib/server/ceremony'` |
| `message` expectations inverted before 0010 existed | 5 failed across `lib/server/rsvp.spec.ts` and `supabase/tests/rsvp-store.spec.ts` |
| `RsvpAnswer.spec.tsx` written before the component was renamed/rewritten | 27 failed — `Element type is invalid` |
| `CeremonyStream.spec.tsx` written before the component | `Failed to resolve import "./CeremonyStream"` |

## Migration replay, proved twice

Both down-scripts were APPLIED and then re-applied forward against the live
instance, and the schema probed at each step:

```
after migrations   : message columns = []                              | ceremony rows = 1
after 0010 down    : message columns = [rsvp_latest, rsvp_responses]   | ceremony rows = 1
after 0010 forward : message columns = []                              | ceremony rows = 1
after 0009 down    : message columns = []                              | ceremony table = 0
after 0009 forward : message columns = []                              | ceremony rows = 1
anon grants on the RE-created ceremony table: []
```

`supabase db reset` then applied `0001`–`0010` in order from an empty database,
and the full unit suite ran green against it.

## Deviations from design and spec

- **`openspec/.../specs/rsvp/spec.md` was edited.** The "Optional extra fields"
  requirement said the form MUST offer exactly TWO optional fields including a
  free-text message (decision A8). This work unit removes one of them, so the
  requirement was superseded in place with the reasoning recorded, and three new
  requirements were added for the decline-to-stream flow and the ceremony row's
  default-deny posture. Flagged rather than done silently: rewriting a spec is
  normally the spec phase's job, and leaving a requirement that contradicts the
  shipped code would have handed `sdd-verify` a guaranteed failure with no
  record of why.
- **`components/invitation/RsvpForm.tsx` was renamed to `RsvpAnswer.tsx`** (and
  its spec with it). A component called `RsvpForm` that sometimes renders no
  form is a name that lies. The `form.rsvp__form` class the E2E locates is
  unchanged, so no test outside the two renamed files was affected by the rename
  itself.
- **`ceremony` is not yet the source for `{{WEDDING_DATE}}`.** `InvitationBody`
  still states the wedding date as its own constant, so that fact now exists in
  two places — precisely what this table was created to prevent. Collapsing it
  is task 5b.15, deliberately deferred rather than done here: `InvitationBody`
  is props-only and shared with the console preview, so making it read the row
  is a change to that component's contract and belongs with the work unit that
  builds the public ceremony page. It is recorded as a live risk, not as done.
- **`ceremony` has no `updated_at`.** Considered and dropped: without a trigger
  to maintain it the column would lie, and adding one was more surface than this
  unit needs.

## Environment finding (not a code defect)

The first full E2E run reported 1 failure — `invitation-page-og.spec.ts` "emits
an absolute https og:image on the deployed origin". Cause: a `next dev` server
had been listening on port 3000 for twelve hours, and `playwright.config.ts` sets
`reuseExistingServer: !process.env.CI`, so Playwright attached to it instead of
building. That server never received the `NEXT_PUBLIC_SITE_ORIGIN` the config
injects, so `metadataBase` was unset and `og:image` came back relative.

Recorded rather than quietly worked around, because the same trap silently
invalidates every raw-HTML assertion in the suite. Every reported E2E result
below is from `PORT=3100 npm run e2e`, which built and started a production
server on a free port. The developer's own dev server was left running.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 5b.1–5b.2 | `supabase/tests/ceremony.spec.ts` | Integration (real Postgres + PostgREST) | 536/536 green first | ✅ `Cannot find package '@/lib/server/ceremony'` | ✅ 9/9 after `supabase db reset` applied 0009 | 9 cases: row count, duplicate PK, `id = false`, placeholder shape, UPDATE still allowed, RLS posture, anon grants, anon SELECT vs. privileged SELECT, adapter mapping | ➖ |
| 5b.3–5b.4 | same | same | — | ✅ mutation: disabling RLS on `ceremony` fails 2 of 17 | ✅ | — | ➖ |
| 5b.5 | `e2e/invariants/rls.spec.ts`, `supabase/tests/rls.spec.ts` | E2E + Integration (publishable key) | 8/8, 63 E2E | ✅ `ceremony` absent from `OWNED_TABLES` meant zero coverage | ✅ 8/8 and 66/66 | 4 verbs plus a database read proving the row is untouched | ➖ |
| 5b.6–5b.7 | `lib/server/rsvp.spec.ts`, `supabase/tests/rsvp-store.spec.ts` | Unit (port) + Integration | 536/536 | ✅ 5 failed — column still present, write still accepted | ✅ 40/40 across three files | `dietary_notes` asserted present on BOTH relations so the query is proved non-vacuous; wire-level `message` ignored not rejected | ✅ `MESSAGE_MAX_LENGTH` and the message branch removed from the zod schema, port types and both selects |
| 5b.8–5b.9 | `components/invitation/CeremonyStream.spec.tsx` | Component (jsdom) | N/A (new) | ✅ `Failed to resolve import "./CeremonyStream"` | ✅ 5/5 | 5 cases: label/value pairing, placeholder passthrough, reconsider sentence, callback fires once, callback does not fire early | ✅ first draft queried `getByRole("term", { name })`; `dt` has no accessible name, so the assertion became an ordered label→value pairing, which is strictly stronger |
| 5b.10–5b.11 | `components/invitation/RsvpAnswer.spec.tsx` | Component (jsdom) | 18/18 as `RsvpForm.spec.tsx` | ✅ 27 failed — `Element type is invalid` | ✅ 27/27 | 27 cases; the six new ones cover first-tap submit, no names after a prior "yes", surface swap, refusal keeps the form, empty form on reconsider, second identical decline | ✅ auto-submit moved out of the change handler into an effect |
| 5b.12 | `e2e/rsvp.spec.ts` | E2E (Playwright + real DB) | 63/63 | ✅ old decline tests still clicked a submit button that no longer runs the flow | ✅ 66/66 | — | ➖ |
| 5b.13 | `e2e/rsvp.spec.ts` | E2E | — | ✅ file had no stream or reconsider coverage | ✅ 66/66 | 3 new cases: first-tap decline, stream details read FROM the row, decline→reconsider→accept reducing to the acceptance | ➖ |

### Test Summary

- **Total tests written**: 26 net new unit/component/integration (536 → 562), 3 net new E2E (63 → 66)
- **Total tests passing**: 562 unit + 66 E2E
- **Layers used**: Unit (1), Component (2), Integration/real Postgres (3), E2E (2)
- **Approval tests**: none — no pure-refactoring task in this unit
- **Pure functions created**: none; `getCeremony` is an adapter and `CeremonyStream` is a props-only component

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run supabase/tests/ceremony.spec.ts` → `Tests 9 passed (9)`; `npx vitest run components/invitation/RsvpAnswer.spec.tsx` → `Tests 27 passed (27)` |
| Runtime harness | `supabase db reset` applied `0001`–`0010` in order from an empty database; both down-scripts applied and re-applied forward with the schema probed at each step; the full E2E suite ran against `npm run build && npm run start` on port 3100 |
| Rollback boundary | Revert `components/invitation/CeremonyStream.tsx`, `lib/server/ceremony.ts`, the `RsvpAnswer` rename, the `message` deletions in `lib/server/rsvp.ts`, the `loadCeremony`/`ceremony` wiring in `load-invitation.ts` and `page.tsx`, the `ceremony` entries in both `OWNED_TABLES`, and run `supabase/down/0010_drop_rsvp_message_down.sql` then `supabase/down/0009_ceremony_down.sql` (in that order). Nothing in work units 1–5 depends on any of it; the two down-scripts were proved to run |

## Verification

Every command run in the foreground.

| Command | Observed result |
|---|---|
| `npm test` | `Test Files 41 passed (41)` / `Tests 562 passed (562)` — baseline 39 / 536 |
| `npm run e2e` (as `PORT=3100 npm run e2e`) | `66 passed (11.7s)` — baseline 63 |
| `npm run typecheck` | clean, no output, exit 0 |
| `npm run lint` | clean, no output, exit 0 |
| `npm run format:check` | `All matched files use Prettier code style!` (after one `npm run format` pass over 6 files) |
| `npm run build` | `✓ Compiled successfully`; `✓ Generating static pages using 8 workers (5/5)`; routes `/`, `/_not-found`, `/i/[slug]`, `/i/[slug]/opengraph-image`, `/robots.txt` |
| `supabase db reset` | applied `0001` through `0010` in order from an empty database, no errors |
| `npm test` after that reset | `Test Files 41 passed (41)` / `Tests 562 passed (562)` |

Re-confirmed inside those runs: the raw-HTML Open Graph assertions under a
WhatsApp User-Agent including that the tags do not appear after `</head>`, no
phone digits in the page source, exactly one unlock path with no query-parameter
bypass, the `nullif` mutation test, `service_role` append-only, seat parity,
`rsvp_latest` reducing to one row per invitation with `security_invoker`, and the
external anon-key RLS invariants — now including `ceremony`.

## Workload / PR boundary

- Mode: **`size:exception` RECOMMENDED — this unit does not fit the 800-line
  session budget.**
- Authored lines: **1625** (`git diff --numstat HEAD` plus the eight new files),
  of which 78 are OpenSpec planning artifacts and roughly 1030 are tests.
- Why it will not shrink: the four deliverables are one atomic change. Dropping
  `rsvp_responses.message` requires recreating `rsvp_latest`, which touches the
  adapter, which touches the port types, which touches the form. The decline
  auto-submit is meaningless without somewhere for a decline to land, and the
  stream card is meaningless without the row that feeds it. Splitting it would
  ship a schema whose only writer disagrees with it.
- Nothing was compressed to reach a number: no comment, blank line, doc or test
  was removed for budget reasons.

## Status

14/15 Work Unit 5b tasks complete. Task 5b.15 is deliberately open — it belongs
with the couple's real details (task 7.1) and with the public ceremony page.
Working tree left uncommitted and fully normalized. Ready for `sdd-verify`.
