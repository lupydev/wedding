# Project Scaffold Specification

## Purpose

Establish the Next.js + TypeScript baseline, test harnesses, and metadata guarantees that every other capability in this change depends on, and enable strict TDD for the rest of the pipeline.

## Requirements

### Requirement: Next.js App Router baseline

The system MUST be scaffolded as a Next.js App Router project with TypeScript, using `npm` as the package manager.

#### Scenario: Scaffold produces a runnable dev server

- GIVEN a freshly cloned repository with no `node_modules`
- WHEN `npm install` then `npm run build` are run
- THEN the build MUST succeed with zero TypeScript errors

### Requirement: Streaming metadata disabled

`next.config.ts` MUST set `htmlLimitedBots: /.*/` to disable streaming metadata for all clients, because per-guest Open Graph tags MUST be server-rendered into the first HTML response for every user agent, not only recognized bot user agents.

#### Scenario: Metadata is never streamed

- GIVEN `next.config.ts` with `htmlLimitedBots: /.*/`
- WHEN any page using `generateMetadata` is requested with an arbitrary User-Agent
- THEN the response's raw HTML MUST contain the metadata tags inside `<head>` before `</head>` closes, not appended near `</body>`

### Requirement: Absolute metadata URLs

The root layout MUST set `metadataBase` to the deployed origin so relative `og:image` URLs resolve to absolute HTTPS URLs.

#### Scenario: OG image URL is absolute

- GIVEN `metadataBase` is set in `app/layout.tsx`
- WHEN a page emits a relative `og:image` path via `generateMetadata`
- THEN the raw HTML `<head>` MUST contain the fully-qualified HTTPS URL for `og:image`

### Requirement: Test harnesses installed

The scaffold MUST install Vitest for unit tests and Playwright for E2E tests, with `npm test` mapped to `vitest run` and `npm run e2e` mapped to `playwright test`.

#### Scenario: Test commands are runnable

- GIVEN the scaffold is complete
- WHEN `npm test` is run with zero test files present
- THEN the command MUST exit successfully (no test files is not a failure)

### Requirement: Strict TDD enabled by this change

This change MUST flip `strict_tdd: true` and populate `apply.test_command`, `verify.test_command`, and `verify.build_command` in `openspec/config.yaml` in the same work unit that lands the scaffold, superseding the prior fail-closed `strict_tdd: false` state.

#### Scenario: strict_tdd reflects a runnable command

- GIVEN the scaffold work unit has landed
- WHEN `openspec/config.yaml` is inspected
- THEN `strict_tdd` MUST be `true` AND `apply.test_command` MUST be a non-empty string that executes successfully
