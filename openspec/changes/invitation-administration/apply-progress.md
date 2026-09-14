# Apply Progress: invitation-administration

**Mode**: Strict TDD (`openspec/config.yaml` → `strict_tdd: true`, `rules.apply.tdd: true`, `test_command: "npm test"`)
**Batch**: 1 — Slice **1a** only (tasks 1a.1–1a.30)
**Branch**: `feat/whatsapp-wedding-invitations` (base `5ea6b4f`)
**Artifact store**: hybrid — this file plus Engram `sdd/invitation-administration/apply-progress`
**Prior progress read**: none — this is the first apply batch for this change.
**Not started, deliberately**: slice 1b. `invitations.seats_allowed` still EXISTS after this
batch. It is nullable, unconstrained, written by nobody and read by nobody. The `DROP COLUMN`
is `0013`'s single destructive statement and lands on a tree that is already green without it.

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 1a.1 RED composite FK refuses a foreign recipient, permits an own one | Done | `supabase/tests/dispatch-recipient.spec.ts`; RED `column "dispatch_recipient_guest_id" of relation "invitations" does not exist` |
| 1a.2 RED move clears the recipient / leaves a non-recipient alone | Done | Both trigger branches asserted; same RED |
| 1a.3 RED dropping the trigger makes the move FAIL on the FK | Done | Asserts `violates foreign key constraint` AND `invitations_dispatch_recipient_fk` — pins probe 3 so an `on update` clause cannot be slipped in unnoticed |
| 1a.4 RED a move leaves the DESTINATION recipient untouched | Done | D25; destination keeps its own `destinationMemberId` |
| 1a.5 RED deleting the recipient guest nulls the column, invitation survives | Done | `rowCount` 1 and the column null — probe 4 under real schema |
| 1a.6 RED deleting an invitation with a recipient still cascades | Done | Both `invitation_guests` and `invitations` rows gone; 0005's lesson verified, not assumed |
| 1a.7 RED `anon` cannot execute `clear_recipient_on_guest_move` | Done | `has_function_privilege` anon `false`, authenticated `false`, owner `true` — the owner control is what keeps "false" from being vacuous |
| 1a.8 GREEN migration `0012` (expand half) + down script | Done | `supabase/migrations/0012_invitation_administration.sql`, `supabase/down/0012_invitation_administration_down.sql`; 9/9 GREEN after `supabase migration up` |
| 1a.9 RED `seat-parity.spec.ts` re-derived against `count(*)` | Done | Fixture states names, not an allowance; cap-before-parity order asserted explicitly |
| 1a.10 GREEN `enforce_seat_cap` sources the cap from `count(*)` | Done | 0007's two checks and their ORDER reproduced verbatim |
| 1a.11 DELETE `"rejects a seats_allowed of zero…"` | Done | Deleted outright from `lib/server/invitations.spec.ts`, visible in the diff |
| 1a.12 DELETE the importer's seat-mismatch advisory | Done | `SeatMismatch`, `seatMismatches`, the mismatch loop, the `Seats:` block and the doc-comment example all gone from `scripts/import-guests.ts` |
| 1a.13 DELETE its tests and fixture helper arity | Done | Seat-mismatch test removed; `household()` lost its `seatsAllowed` parameter |
| 1a.14 RED `tools/no-seats-allowed.spec.ts` with an enumerated exemption | Done | RED: 35 failing files. GREEN at the end of the slice. Exemption is a literal one-entry array, asserted to exist on disk and asserted to be exactly that array |
| 1a.15 RED `console-list.spec.ts` re-derived | Done | `memberCount` / `seats`; `:94` sum re-derived; new assertion that `assembleConsoleRows` derives the count from `guests.length` |
| 1a.16 GREEN `console-list.ts` (D17) | Done | `ConsoleListRow.memberCount`, `ConsoleSummary.seats`, accumulator, `scopedMetrics` copy, `assembleConsoleRows` mapping |
| 1a.17 RED `lib/server/invitations.spec.ts` remaining sites | Done | 23 RED failures before the source change |
| 1a.18 GREEN `lib/server/invitations.ts` | Done | `MAX_SEATS_ALLOWED` and its validation deleted entirely; column gone from the row type, both selects, both mappers, both writes and the four exported types |
| 1a.19 DELETE `rsvp.spec.ts`'s five-against-three test; re-derive `household()` | Done | The scenario is structurally impossible under a derived cap; deleted rather than patched |
| 1a.20 GREEN `lib/server/rsvp.ts` | Done | `RsvpTarget.seatsAllowed` removed; cap now `invitation.guestIds.length`; the `:24-33` comment names `0012` |
| 1a.21 GREEN `app/i/[slug]/actions.ts` + `page.tsx` | Done | Prop and field dropped; covered by the re-derived `actions.spec.ts` fixtures |
| 1a.22 RED `InvitationBody.spec.tsx` names members, not seats | Done | Three cases: 3 members, 2 members, 1 member |
| 1a.23 GREEN `InvitationBody.tsx` | Done | `seatsSentence(seatsAllowed)` → `memberSentence(guests.length)`; prop removed; two approved-markup snapshots updated |
| 1a.24 COPY `RsvpAnswer.tsx` + `rsvp-copy.ts` | Done | `seatsSelectionSentence(selected, memberCount)`; `allowanceSpent` reads `guests.length`; the `seatsAllowed` prop is gone from `RsvpAnswer` |
| 1a.25 COPY `GuestList.tsx` `:90`/`:93` | Done | `membersSentence`: `"N de M personas confirmadas"` / `"M personas"` |
| 1a.26 GREEN seed helpers | Done | `e2e/helpers/seed.ts`, `e2e/helpers/console.ts`, `supabase/tests/helpers/db.ts` lost the option and the column |
| 1a.27 DELETE leftover fixture lines across 19 files | Done | See the file table |
| 1a.28 RED `append-only.spec.ts` ×2 and `rsvp-store.spec.ts` ×1 | Done | Re-derived against the new message, never patched back to the old wording |
| 1a.29 GREEN those three assertions | Done | Only fixture member counts moved; assertion text is the new rule's |
| 1a.30 Verify | Done | See Work Unit Evidence |

## The `0007` ordering rule, stated because `0012` had to preserve it

`0007`'s `enforce_seat_cap` evaluates **the hard cap first and parity second**:

```sql
if new.seats_confirmed > cap or named > cap then   -- 1. the cap
if named <> new.seats_confirmed then               -- 2. parity
```

`0012` reproduces both checks and that order verbatim, changing only where `cap` comes from
(`count(*)` of `invitation_guests` instead of `select seats_allowed into cap`).

**Why the order matters.** `0007` forces `cardinality(attendee_guest_ids) = seats_confirmed`
in every legitimate submission. An over-cap row therefore almost always trips parity as well,
so whichever check runs first is the one the operator is told about. Checking parity first
would report "seats_confirmed 2 does not match attendee_guest_ids of length 3" for a row whose
actual fault is that the household holds two people — sending the operator to fix the attendee
list when the household is the thing that is wrong. `supabase/tests/seat-parity.spec.ts`
asserts the order directly: the over-cap row's message must contain the cap's sentence and must
**not** contain the parity sentence.

Side benefit that is not the reason: the old `select seats_allowed into cap` returned `NULL` for
a missing parent, and `x > NULL` is `NULL`, so the cap silently passed. `count(*)` never returns
`NULL`.

## The product decision this batch closed

`design.md` §12's second open question — guest-facing Spanish for the member-count sentences —
**is now closed**, with the couple's chosen member-count phrasing:

| Surface | Copy |
|---|---|
| `InvitationBody`, N members | `La invitación es para N personas.` |
| `InvitationBody`, one member | `La invitación es para vos.` |
| `rsvp-copy` `seatsSelectionSentence`, all selected | `Ya seleccionaron las N.` |
| `rsvp-copy` `seatsSelectionSentence`, one member | `Ya seleccionaron a la única persona.` |
| `GuestList`, attending | `N de M personas confirmadas` |
| `GuestList`, otherwise | `M personas` / `1 persona` |

The box is ticked in `design.md` §12. The other two questions there are ticked too: **eight
sub-slices** was chosen (one feature branch, one commit per slice, no pull requests), and the
recorded budget is **`review_budget_lines: 800`** from `openspec/config.yaml:127` with
`delivery_strategy: ask-on-risk` — the proposal's `single-pr` and the earlier "400" are both
superseded.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1a.1–1a.7 | `supabase/tests/dispatch-recipient.spec.ts` | Integration (real Postgres) | N/A (new file); suite baseline 1459/1459 | ✅ 9 failed — `column "dispatch_recipient_guest_id" of relation "invitations" does not exist`, `function "clear_recipient_on_guest_move()" does not exist` | ✅ 9/9 after `supabase migration up` applied `0012` | ✅ 9 cases; every refusal ships its permitting case (FK refuses/permits, trigger clears/leaves alone, backstop fails/trigger passes, anon denied/owner allowed) | ➖ written once |
| 1a.9/1a.10 | `supabase/tests/seat-parity.spec.ts` | Integration (real Postgres) | ✅ 92/92 DB suite after the migration | ✅ fixture stated an allowance the helper no longer accepts | ✅ 7/7 | ✅ cap-first proved by asserting the cap sentence IS present and the parity sentence is NOT | ➖ |
| 1a.14 | `tools/no-seats-allowed.spec.ts` | Unit (filesystem scan) | N/A (new file) | ✅ 35 of 218 failed — every remaining referencing file named individually | ✅ 218/218 once 1a.11–1a.29 landed | ✅ positive control (files exist, the five ex-owners are scanned), negative control (the regex catches a re-introduced read), exemption-existence and exemption-exactness checks | ➖ |
| 1a.15/1a.16 | `lib/domain/console-list.spec.ts` | Unit | ✅ 21/21 green first | ✅ 5 failed — `expected undefined to be 12`, `expected NaN to be 10`, `expected [undefined, undefined] to deeply equal [1, 2]` | ✅ 21/21 | ✅ the derivation test uses a 1-member and a 2-member household so a fixture default cannot fake it | ➖ |
| 1a.17/1a.18 | `lib/server/invitations.spec.ts` | Unit + Integration (PostgREST) | ✅ 41/41 green first | ✅ 23 failed — `Import row "Familia Restrepo" has an invalid seats_allowed: undefined` | ✅ 40/40 (one test deleted by 1a.11) | ➖ existing cases re-derived | ✅ both PostgREST embeds disambiguated — see the discovery below |
| 1a.19/1a.20 | `lib/server/rsvp.spec.ts` | Unit | ✅ 28/28 green first | ✅ the five-against-three fixture no longer type-checks against `RsvpTarget` | ✅ 27/27 (one test deleted) | ➖ | ➖ |
| 1a.22/1a.23 | `components/invitation/InvitationBody.spec.tsx` | Component (jsdom) | ✅ 16/16 green first | ✅ 5 failed — `Unable to find an element with the text: La invitación es para 3 personas.` | ✅ 16/16 | ✅ 3 sizes: 3 members, 2 members, 1 member (the last asserts the count form is ABSENT) | ✅ 2 approved-markup snapshots re-approved deliberately |
| 1a.24 | `lib/domain/rsvp-copy.spec.ts`, `components/invitation/RsvpAnswer.spec.tsx` | Unit + Component | ✅ 15/15 and 27/27 green first | ✅ 2 failed on the old "lugares reservados" wording | ✅ 15/15 and 27/27 | ✅ plural and one-member forms asserted separately | ➖ |
| 1a.25 | `components/console/GuestList.spec.tsx` | Component (jsdom) | ✅ 132/132 console suite green first | ✅ `/3 lugares/` no longer matches | ✅ 132/132 | ✅ attending row and non-attending row both asserted | ➖ |
| 1a.28/1a.29 | `supabase/tests/append-only.spec.ts`, `rsvp-store.spec.ts` | Integration (real Postgres + PostgREST) | ✅ 92/92 | ✅ `/exceeds seats_allowed/` no longer matches the raised message | ✅ 92/92 | ✅ over-cap by seats and over-cap by named attendees are separate cases | ➖ |

### Test Summary

- **Total tests written**: 14 new (9 DB + 5 scanner groups, the scanner expanding to 218 parameterized cases)
- **Total tests passing**: 1686 unit (from 1459; the delta is the scanner's per-file cases plus the nine DB tests, minus three deletions), 154 E2E
- **Layers used**: Unit (many), Component/jsdom (InvitationBody, RsvpAnswer, GuestList), Integration/real Postgres (dispatch-recipient, seat-parity, append-only, rsvp-store, invitations), E2E (Playwright)
- **Approval tests**: the two `InvitationBody` markup snapshots, re-approved because the copy deliberately changed
- **Pure functions created**: `memberSentence` (InvitationBody), `membersSentence` (GuestList)

## Three tests were DELETED rather than patched

Each tested a scenario the derived cap makes structurally impossible. Patching one to pass would
have left an assertion that no longer describes anything.

| Deleted | Where | Why it cannot exist |
|---|---|---|
| `"rejects a seats_allowed of zero, which the hard cap forbids"` | `lib/server/invitations.spec.ts` | The rule it tests was deleted with `MAX_SEATS_ALLOWED` |
| `"rejects a tampered over-cap submission and writes nothing"` | `lib/server/rsvp.spec.ts` | It built a five-member household capped at three. A household's cap can no longer be lower than its own member count |
| `"refuses a tampered over-cap submission server-side"` | `e2e/rsvp.spec.ts` | Same shape in the browser: it un-disabled the fourth and fifth checkboxes of a five-member household, which are now legitimately selectable. The tampered-payload path is still covered by `"refuses a submission naming somebody from another household"`, which injects an id the household does not own |

Two more tests were **re-derived** rather than deleted, because a real behaviour survived the
change: `RsvpAnswer`'s seat-cap test now asserts that the form offers exactly one box per member
and that all of them stay interactive, and `e2e/rsvp.spec.ts`'s now asserts the same thing over
the real page. The E2E count therefore moves from 155 to **154**: one deletion, no losses.

## Discovery: `0012` made two PostgREST embeds ambiguous

Not predicted by the design, found by a RED run, fixed inside this slice.

`invitations` and `invitation_guests` now have foreign keys pointing at each other — a guest's
`invitation_id`, and an invitation's `dispatch_recipient_guest_id`. PostgREST refuses an embed
it cannot disambiguate:

```
Could not embed because more than one relationship was found for 'invitations' and 'invitation_guests'
```

Three selects were affected and now name their constraint explicitly:
`INVITATION_SELECT`, `CONSOLE_INVITATION_SELECT` and `findGuestInvitationOwner`, all in
`lib/server/invitations.ts`, using `invitation_guests!invitation_guests_invitation_id_fkey(...)`
and `invitations!invitation_guests_invitation_id_fkey(...)`. This is a correctness fix, not a
workaround: the read means the household's members, and now it says so.

## Discovery: `ceremony.spec.ts`'s seed parser was unscoped

`parseCeremonySeed` scanned EVERY migration for `add column X ... not null default '...'` without
checking which table the statement targets, so `0012`'s
`alter table invitations add column greeting_name_source text not null default 'imported'` was
read as a `ceremony` seed and the spec failed for a migration that never touched that table.
The parser is now scoped to `alter table ceremony` statements, and a new negative control asserts
exactly that: another table's defaulted column must not appear in the parsed seed. The test is
stricter than it was, not looser.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run supabase/tests tools/no-seats-allowed.spec.ts lib/domain/console-list.spec.ts lib/server/invitations.spec.ts lib/server/rsvp.spec.ts` — all green; full `npm test` → **exit 0**, `Test Files 91 passed (91)`, `Tests 1686 passed (1686)` |
| Runtime harness command/scenario and exact result | Local Supabase (docker) already running with the couple's seeded data. **`supabase db reset` was NEVER run.** `supabase migration up` applied `0012` forward: `{"applied":[".../0012_invitation_administration.sql"],"message":"Migrations applied"}`. The down script was then applied and `0012` re-applied forward, both clean. `PORT=3100 npm run e2e` → **154 passed** against a production build |
| Migration down/up roll | After the down script: `invitations.seats_allowed` back to `is_nullable: NO`, `greeting_name_source` and `dispatch_recipient_guest_id` gone. After re-applying `0012`: `seats_allowed` `YES`, `greeting_name_source` `NO`, `dispatch_recipient_guest_id` `YES`; constraints `invitation_guests_invitation_id_id_key` and `invitations_dispatch_recipient_fk` present, `invitations_seats_allowed_check` absent |
| Operator-account guard (before AND after every DB operation) | `select email from auth.users order by email;` → `lumigu.dev@gmail.com`, `sruiz7541@gmail.com` — both present before the migration, after the migration, after the down script and after the re-apply |
| Ceremony-row guard | `select couple_names from ceremony;` → `Luis & Michell` at every one of those four checkpoints. Not a placeholder |
| Additional gates | `npm run typecheck` → exit 0; `npm run lint` → exit 0, zero findings; `npm run format:check` → "All matched files use Prettier code style!"; `npm run build` → `Compiled successfully`, `Finished TypeScript`, 13 routes |
| Rollback boundary | `supabase/down/0012_invitation_administration_down.sql`, then revert this slice's commit. `seats_allowed` regains `NOT NULL` and its `between 1 and 12` check; `nickname`, `greeting_name_source`, `dispatch_recipient_guest_id`, the unique constraint, the trigger and its function all disappear; `enforce_seat_cap` and `import_invitations` return to `0007`'s and `0006`'s bodies verbatim. Nothing else in the repository depends on this slice yet |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `supabase/migrations/0012_invitation_administration.sql` | Created | `nickname`; `greeting_name_source`; the `(invitation_id, id)` unique constraint; `dispatch_recipient_guest_id` + the composite FK with `on delete set null (dispatch_recipient_guest_id)` and deliberately NO `on update`, all three rejected forms reproduced with their exact error text; `clear_recipient_on_guest_move()` + its `before update of invitation_id` trigger + its own `revoke all on function`; `enforce_seat_cap` sourcing the cap from `count(*)`; `seats_allowed` relaxed (NOT NULL and check dropped, column kept); `import_invitations` superseded |
| `supabase/down/0012_invitation_administration_down.sql` | Created | Reverse order, with the two honesty notes in the file itself; backfills only the rows `0012` left null, clamps to `[1, 12]` with a `NOTICE`, restores `0007`'s and `0006`'s function bodies verbatim |
| `supabase/tests/dispatch-recipient.spec.ts` | Created | The nine DB assertions from `design.md` §3; the one exempt path in the scanner |
| `tools/no-seats-allowed.spec.ts` | Created | The enumerated-exemption scanner |
| `supabase/tests/seat-parity.spec.ts` | Modified | Fixtures state names; cap-before-parity asserted directly |
| `supabase/tests/append-only.spec.ts` | Modified | Both `/exceeds seats_allowed/` assertions re-derived |
| `supabase/tests/rsvp-store.spec.ts` | Modified | The third re-derived assertion; the seed INSERT lost the column |
| `supabase/tests/rls.spec.ts` | Modified | Anon-insert payload lost the column |
| `supabase/tests/rsvp-latest.spec.ts` | Modified | `seedInvitation`'s seat argument dropped |
| `supabase/tests/ceremony.spec.ts` | Modified | Seed parser scoped to `alter table ceremony`, plus its negative control |
| `supabase/tests/helpers/db.ts` | Modified | `seedInvitation` lost its `seatsAllowed` parameter and the column |
| `lib/domain/console-list.ts` / `.spec.ts` | Modified | D17 rename and derivation |
| `lib/domain/seats.ts` | Modified | `validateRsvpSelection(selection, memberCount)`; reason names unchanged |
| `lib/domain/rsvp-copy.ts` / `.spec.ts` | Modified | `seatsSelectionSentence(selected, memberCount)` and the settled Spanish |
| `lib/domain/dispatch-preflight.spec.ts`, `lib/domain/og-card.spec.ts` | Modified | Fixture lines deleted; `ConsoleListRow` fixture gained `memberCount` |
| `lib/server/invitations.ts` / `.spec.ts` | Modified | 18 sites; `MAX_SEATS_ALLOWED` deleted; three embeds disambiguated; one test deleted |
| `lib/server/rsvp.ts` / `.spec.ts` | Modified | Cap from `guestIds.length`; comment names `0012`; one test deleted |
| `lib/server/dispatch.spec.ts` | Modified | Seed INSERT lost the column |
| `app/i/[slug]/actions.ts`, `page.tsx`, `actions.spec.ts` | Modified | Field and prop dropped; fixtures re-derived |
| `components/invitation/InvitationBody.tsx` / `.spec.tsx` / `__snapshots__` | Modified | `memberSentence`; prop removed; snapshots re-approved |
| `components/invitation/RsvpAnswer.tsx` / `.spec.tsx` | Modified | Prop removed; cap from `guests.length`; seat-cap test re-derived |
| `components/console/GuestList.tsx` / `.spec.tsx` | Modified | `membersSentence` and its assertions |
| `components/console/ProgressSummary.spec.tsx`, `DispatchPreflight.spec.tsx` | Modified | Fixture field renamed to `memberCount` |
| `e2e/helpers/seed.ts`, `e2e/helpers/console.ts` | Modified | Option and column removed from both seeders |
| `e2e/phone-gate.spec.ts`, `console-guest-list.spec.ts`, `console-dispatch.spec.ts`, `rsvp.spec.ts`, `console-wedding.spec.ts`, `console-design.spec.ts`, `invitation-page-og.spec.ts`, `console-preview.spec.ts`, `invariants/rls.spec.ts` | Modified | Fixture deletions; two assertions re-derived; one test deleted |
| `scripts/import-guests.ts` / `.spec.ts` | Modified | Seat-mismatch advisory deleted whole |
| `openspec/changes/invitation-administration/tasks.md` | Modified | 1a.1–1a.30 marked `[x]` |
| `openspec/changes/invitation-administration/design.md` | Modified | §12's three remaining open questions ticked |

## Workload / PR Boundary

- Mode: **chained slice 1a of eight**, feature-branch chain adapted to one commit per slice, no PRs
- Current work unit: 1a — migration `0012` (expand) and the removal of every `seats_allowed` read
- Boundary: starts at `5ea6b4f`; ends with `seats_allowed` present but read by nobody, the whole suite green, and `0013` not yet written
- **Authored changed lines: 1,519** (1,129 additions + 390 deletions, excluding `openspec/**`) against the recorded `review_budget_lines: 800`. **`size:exception` is recommended for this slice.** See below

### Why 1,519 lines cannot be brought under 800

`design.md` §6 estimated 1a at ≈700. The estimate was low, and the overage is concentrated in
four files that are all new and none of which is optional:

| File | Lines | Why it cannot shrink |
|---|---|---|
| `supabase/tests/dispatch-recipient.spec.ts` | 268 | The design's own §3 table requires nine DB tests, and `strict_tdd: true` requires each refusal to ship its permitting case. Removing any one of them removes a claim D11 makes |
| `supabase/migrations/0012_…sql` | 252 | Roughly 130 of those lines are the comment the phase brief mandates: all three rejected FK forms with their exact error text, plus MATCH SIMPLE's rationale and the trigger's. The DDL itself is about 70 lines |
| `supabase/down/0012_…_down.sql` | 159 | Every migration in this project ships a matching down script, and this one must restore `0006`'s `import_invitations` body verbatim — that copy alone is ~70 lines |
| `tools/no-seats-allowed.spec.ts` | 121 | The enumerated-exemption design the brief requires, with its positive control, negative control, existence check and exactness check |

The remaining ~700 lines are the 40-file removal itself, which matches the design's estimate.

**The slice cannot be split further.** The moment `enforce_seat_cap` reads `count(*)` and the
seed helpers stop writing the column, every one of those 40 files has to move in the same commit
or the tree is knowingly red — which `strict_tdd: true` forbids. This is the same argument
§6 already makes for why slice 1 could not be split below the 1a/1b boundary; 1a is that
boundary. Nothing was compressed, no comment was deleted and no test was dropped to chase the
number.

## Status

30/120 tasks complete (all of slice 1a). Ready for verify. Slice 1b is NOT started by design.
