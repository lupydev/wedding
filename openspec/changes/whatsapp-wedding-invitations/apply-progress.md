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
