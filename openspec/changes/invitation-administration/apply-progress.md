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

---

# Batch 2 — Slice **2a** only (tasks 2a.1–2a.7)

**Mode**: Strict TDD (`openspec/config.yaml` → `strict_tdd: true`, `test_command: "npm test"`)
**Branch**: `feat/whatsapp-wedding-invitations` (base `6e7e931`, tree clean at start)
**Prior progress read**: yes — this file's slice-1a section above, kept verbatim and merged into.
**Not started, deliberately**: slice 2b. Nothing in the tree imports these three modules yet;
they are pure additions with no call sites, which is exactly what makes the rollback boundary
"delete six files".

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 2a.1 RED sixteen-row conjunction table + arity 0/1/3/4 | Done | `lib/domain/spanish-list.spec.ts`; RED `Cannot find module './spanish-list'` |
| 2a.2 GREEN `lib/domain/spanish-list.ts` | Done | 26/26; NFC + trim before the hiatus/diphthong test; the two non-implemented rules named in the module comment |
| 2a.3 RED `guest-name.spec.ts` | Done | RED `Cannot find module './guest-name'`; the solo/list contrast asserted on ONE guest in ONE test |
| 2a.4 GREEN `lib/domain/guest-name.ts` | Done | 8/8 |
| 2a.5 RED `greeting-name.spec.ts` | Done | RED `Cannot find module './greeting-name'`; `'custom'` and `'derived'` asserted together in ONE test |
| 2a.6 GREEN `lib/domain/greeting-name.ts` | Done | 7/7; `deriveGreetingName([])` throws |
| 2a.7 Verify | Done | See Work Unit Evidence; `domainImportZone` confirmed by a negative probe, not by a clean run alone |

## The conjunction rule, written down because it is routinely mis-stated

`y` becomes `e` only to avoid two adjacent /i/ sounds. The discriminator is therefore
**phonological — hiatus versus diphthong — never the spelling `hi-`**:

| Opening | Sound | Conjunction | Examples in the table |
|---|---|---|---|
| `i`/`í`/`hi`/`hí` + consonant, or the name ends there | hiatus, nucleus /i/ | `e` | Inés, Ignacio, Isabel, Hilda, Íñigo, Iván, Irene |
| `i`/`í`/`hi`/`hí` + vowel | diphthong, opens on the glide /j/ | `y` | Ian, **Hierro**, **Hielo** |
| anything else, including `y-` | not /i/ at all (`y-` is /ʝ/) | `y` | Luzma, Ana, Elena, Yolanda |

**`Hierro` and `Hielo` are the SAME case and both take `y`** — the identical case to the textbook
`frío y hielo`. A rule keyed on the spelling `hi-` emits `e` for both and is wrong. The genuine
contrast pair is `Hija` (hiatus → `e Hija`) against `Hielo` (diphthong → `y Hielo`), and
`spanish-list.spec.ts` asserts all three of those in one test, because that row is the one that
catches the plausible wrong rule. This matches `specs/guest-naming/spec.md` verbatim; it was
checked against the spec rather than taken on assertion.

The silent `h` is stripped before the test because it spells no sound. Input is NFC-normalized
and trimmed FIRST, so an NFD `Íñigo` from a Contacts paste behaves identically to the
precomposed form — the spec file builds the decomposed string from explicit `\u0301`/`\u0303`
escapes, since the two forms are indistinguishable on screen and a reviewer must be able to see
which one is which. Normalization is applied to the OUTPUT as well as to the sound test, so the
two encodings produce byte-identical joins.

### The sixteen rows and their outcomes

| # | Name | Result | Why |
|---|---|---|---|
| 1 | Luzma | `y` | consonant onset |
| 2 | Ana | `y` | /a/, not /i/ |
| 3 | Elena | `y` | /e/, not /i/ |
| 4 | Inés | `e` | i + n, hiatus |
| 5 | Ignacio | `e` | i + g, hiatus |
| 6 | Isabel | `e` | i + s, hiatus |
| 7 | Hilda | `e` | silent h, then i + l |
| 8 | Íñigo | `e` | accented Í + ñ |
| 9 | Iván | `e` | i + v, hiatus |
| 10 | Irene | `e` | i + r, hiatus |
| 11 | Ian | `y` | i + a, diphthong |
| 12 | Hierro | `y` | hi + e, diphthong — same as Hielo |
| 13 | Yolanda | `y` | y- is /ʝ/ |
| 14 | ÍÑIGO / íñigo | `e` / `e` | case-insensitive in both directions |
| 15 | NFD Íñigo | `e` | normalized before the test |
| 16 | `"  Inés"` | `e` | trimmed before the test, and in the output |

## Two pairings asserted together, never split

- **`guest-name.spec.ts`**: the SAME guest `{ fullName: "Luis Guzmán", nickname: null }` yields
  `"Luis Guzmán"` solo and `"Luis"` as a list member, in ONE test. Split across two tests, an
  edit to either fallback could change one and leave the other silently agreeing — the exact
  drift the two separate functions exist to prevent.
- **`greeting-name.spec.ts`**: `resolveGreetingName` at `'custom'` returns the stored string
  untouched AND at `'derived'` recomputes from the current members, in ONE test over the SAME
  stored string and the SAME members. Asserting only the `'custom'` half is satisfied by a
  function that always returns `stored` and never consults the members, which is precisely why
  `greeting_name_source` is a stored fact rather than a write-time guess.

## Three decisions this slice made that the task list did not spell out

| Decision | Why |
|---|---|
| An empty-string `nickname` is treated as no nickname, in BOTH fallbacks | A form that clears the field submits `""`, not `null`. `nickname ?? fullName` alone would address the invitation to nobody. Asserted in `guest-name.spec.ts` |
| `resolveGreetingName` at `'imported'` returns the stored string, like `'custom'` | Not in `guest-naming`, but stated explicitly in `specs/guest-directory/spec.md:109`: "only `'derived'` re-derives automatically; `'imported'` behaves like `'custom'` in this respect until an operator acts on it". `design.md` D15 gives the same reason for the column default. Asserted rather than left to the `else` branch by accident |
| `deriveGreetingName` branches on arity instead of always joining | A one-member list joined would give the LIST fallback (first name only). The spec requires the SOLO fallback for a single member: `"Ana López"`, not `"Ana"` |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2a.1/2a.2 | `lib/domain/spanish-list.spec.ts` | Unit (`environment: 'node'`, zero mocks) | N/A (new file); suite baseline re-measured at 1686/1686 | ✅ `Error: Cannot find module './spanish-list' imported from …/lib/domain/spanish-list.spec.ts`, `Test Files 1 failed (1)`, `Tests no tests` | ✅ `Test Files 1 passed (1)`, `Tests 26 passed (26)` | ✅ 26 cases: all sixteen table rows, the hierro/hielo/hija triple, the NFD-vs-NFC pair, arity 0/1/2/3/4, and a case proving the conjunction comes from the LAST item rather than an earlier one | ➖ written once; the table and the two normalization helpers were the first shape |
| 2a.3/2a.4 | `lib/domain/guest-name.spec.ts` | Unit | N/A (new file) | ✅ `Error: Cannot find module './guest-name'`, `Tests no tests` | ✅ `Tests 8 passed (8)` | ✅ 8 cases; the solo/list contrast, the nickname win, the `""` nickname and the single-token name each assert BOTH functions on the same guest | ➖ `usableNickname` extracted while writing, kept green |
| 2a.5/2a.6 | `lib/domain/greeting-name.spec.ts` | Unit | N/A (new file) | ✅ `Error: Cannot find module './greeting-name'`, `Tests no tests` | ✅ `Tests 7 passed (7)` | ✅ 7 cases: one member, three members, the y→e rule reaching through the derivation, the empty-list throw, the custom/derived contrast, a stale stored name at `'derived'`, and `'imported'` | ➖ |

### Test Summary

- **Total tests written**: 41 authored across three new spec files (26 + 8 + 7)
- **Total tests passing**: **1736** (`Test Files 94 passed (94)`), up from a re-measured baseline of **1686** (`91 passed (91)`)
- **The +50 is fully accounted for**: 41 authored, plus **9** auto-enumerated cases from the
  filesystem-scanning specs that generate one case per repository file. Measured directly, not
  inferred: `tools/no-seats-allowed.spec.ts` + `tools/no-source-placeholders.spec.ts` +
  `tools/console-one-breakpoint.spec.ts` = 362 before these six files and 371 after
- **Layers used**: Unit (41). No component, DB or E2E layer — these are pure functions with no
  I/O boundary to exercise
- **Pure functions created**: 5 exported (`spanishConjunction`, `joinSpanishList`, `firstName`,
  `soloAddressName`, `listMemberName`, plus `deriveGreetingName` and `resolveGreetingName` — 7
  in total), 3 module-private (`normalizeName`, `usableNickname`, and the two lookup sets)
- **Mocks used**: zero

## `domainImportZone` was checked, not assumed

Task 2a.7 asks for confirmation that the zone ACCEPTS all three modules. A clean `npm run lint`
proves that only if the zone actually applies to them, so both halves were checked:

1. `npx eslint --print-config lib/domain/{spanish-list,guest-name,greeting-name}.ts` returns the
   zone's `no-restricted-imports` group — all eleven patterns — for each of the three files. The
   rule is in effect, not merely absent from the output.
2. A negative probe through `eslint --stdin --stdin-filename lib/domain/spanish-list.ts` with
   `import { useState } from "react"` and `import { readFile } from "node:fs/promises"` produced
   **2 errors**, both `no-restricted-imports`, both carrying the zone's message: *"lib/domain
   must stay pure: no React, Next.js, storage vendor, Node built-ins, or server adapters."*
   Nothing was written to disk.

The three modules import only each other and `String.prototype.normalize`, which is the
constraint `design.md` D14 records: they are bundled into the client graph as well as the server
one, so they may use only what both runtimes have.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run lib/domain/spanish-list.spec.ts lib/domain/guest-name.spec.ts lib/domain/greeting-name.spec.ts` → `Test Files 3 passed (3)`, `Tests 41 passed (41)` |
| Full suite | `npm test` → **exit 0**, `Test Files 94 passed (94)`, `Tests 1736 passed (1736)` |
| Runtime harness command/scenario and exact result | **N/A — no runtime boundary exists.** All three modules are pure functions under Vitest `environment: 'node'`: no I/O, no database, no React, no vendor SDK, zero mocking. Nothing in the tree imports them yet, so there is no integration path to exercise |
| E2E | **Not run, and unaffected.** The slice touches only six new files, none of which has a call site. No route, component, server adapter, migration or fixture changed; `npm run build` compiled the same 13 routes as slice 1a |
| Additional gates | `npm run typecheck` → exit 0; `npm run lint` → exit 0, zero findings; `npm run format:check` → exit 0, "All matched files use Prettier code style!"; `npm run build` → exit 0, 13 routes |
| Cold-start flake | `tools/eslint-zones.spec.ts` passed on the first run; no re-run was needed |
| Rollback boundary | Delete the six files. Nothing imports them, no schema moved, no fixture moved, and `git status` shows six untracked additions and no modifications outside `openspec/**` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `lib/domain/spanish-list.spec.ts` | Created | The sixteen-row table as `it.each` with a stated phonological reason per row; the hierro/hielo/hija triple; the NFD/NFC pair built from explicit escapes; arity 0/1/2/3/4 with a standalone no-Oxford-comma assertion |
| `lib/domain/spanish-list.ts` | Created | `spanishConjunction`, `joinSpanishList`; NFC + trim on both the sound test and the output; module comment records that `o → u` and the sentence-initial interrogative exception are deliberately NOT implemented, with the reason each one is unreachable here |
| `lib/domain/guest-name.spec.ts` | Created | `firstName` including a four-token name; the solo/list contrast and the nickname win asserted on one guest per test |
| `lib/domain/guest-name.ts` | Created | `NameableGuest`, `firstName`, `soloAddressName`, `listMemberName`; two separate functions, never one flagged function, with the reason in the module comment |
| `lib/domain/greeting-name.spec.ts` | Created | Solo/list/empty derivation; the custom-vs-derived contrast in one test; the stale-stored case; `'imported'` |
| `lib/domain/greeting-name.ts` | Created | `GreetingNameSource`, `deriveGreetingName` (throws on `[]`), `resolveGreetingName` |
| `openspec/changes/invitation-administration/tasks.md` | Modified | 2a.1–2a.7 marked `[x]` |
| `openspec/changes/invitation-administration/apply-progress.md` | Modified | This section appended; the slice-1a section above is untouched |

## Workload / PR Boundary

- Mode: **chained slice 2a of eight**, one commit per slice, no pull requests
- Current work unit: 2a — the three pure Spanish-naming modules and their specs
- Boundary: starts at `6e7e931` with a clean tree; ends with three pure modules that nothing
  imports, the whole suite green, and slice 2b not started
- **Authored changed lines: 516** (516 additions, 0 deletions, excluding `openspec/**`) against
  the recorded `review_budget_lines: 800`. **Within budget; no `size:exception` needed.** The
  design estimated 2a at ≈530
- **Not committed and not pushed**, as instructed

## Status

37/120 tasks complete (all of slice 1a, all of slice 2a). Ready for verify. Slice 2b is NOT
started by design.

---

# Batch 3 — Slice **2b** only (tasks 2b.1–2b.15)

**Mode**: Strict TDD (`openspec/config.yaml` → `strict_tdd: true`, `test_command: "npm test"`)
**Branch**: `feat/whatsapp-wedding-invitations` (base `cdc2c3c`, tree clean at start)
**Prior progress read**: yes — this file's slice-1a and slice-2a sections above, kept
byte-untouched and merged into.
**Not started, deliberately**: slice 3a.
**Over budget, stated up front**: **1,687 authored changed lines** against `review_budget_lines:
800`. See *Why this slice could not land in 800 lines* below. No compression was attempted.

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 2b.1 RED — `dispatch-recipient.spec.ts`, five outcomes | ✅ | `Error: Cannot find module './dispatch-recipient'`, `Tests no tests` |
| 2b.2 GREEN — `dispatch-recipient.ts` per §4 | ✅ | `Test Files 1 passed (1)`, `Tests 8 passed (8)` |
| 2b.3 RED — the three exports asserted ABSENT | ✅ | `AssertionError: expected [ 'INVITATION_MESSAGE_TEMPLATE', …(6) ] to not include 'selectDispatchRecipient'` |
| 2b.4 GREEN — auto-pick deleted, `DispatchCandidateGuest.id` added | ✅ | `Tests 18 passed (18)` |
| 2b.5 RED — preflight re-derived against five renamed kinds | ✅ | `Tests 14 failed \| 3 passed (17)`, `TypeError: selectDispatchRecipient is not a function` |
| 2b.6 GREEN — order, pass-through `classify()`, rewritten `GROUP_COPY` | ✅ | `Tests 17 passed (17)` |
| 2b.7 RED — `validateInvitationDraft`, refusals paired with permissions | ✅ | `Error: Cannot find module './invitation-draft'`, `Tests no tests` |
| 2b.8 GREEN — draft types + validator per §4 | ✅ | `Tests 24 passed (24)` (with 2b.10, 2b.12) |
| 2b.9 RED — `canMoveMember`, refusal/permission asserted together (D25) | ✅ | same RED run as 2b.7 |
| 2b.10 GREEN — `MoveRefusal`, `MoveOutcome`, `canMoveMember` | ✅ | `Tests 24 passed (24)` |
| 2b.11 RED — `classifyMembershipChangeImpact` | ✅ | same RED run as 2b.7 |
| 2b.12 GREEN — `ContradictedAnswer`, `MembershipChangeImpact` (D19) | ✅ | `Tests 24 passed (24)` |
| 2b.13 RED — `invitation-deletion.spec.ts`, permitting/refusing pair | ✅ | `Error: Cannot find module './invitation-deletion'`, `Tests no tests` |
| 2b.14 GREEN — `canDeleteInvitation` per §4 | ✅ | `Tests 5 passed (5)` |
| 2b.15 Verify + zero `selectDispatchRecipient` references | ✅ | see *Work Unit Evidence*; `rg` finds only historical prose and the absence assertion |

## The order question the brief asked me to resolve, resolved

The phase brief's prose and `design.md` §7's `PREFLIGHT_BLOCKER_ORDER` array agree on all five
canonical spellings and on `no_recipient_chosen` sorting first. They do NOT disagree on order:
the brief's own five-line block places `recipient_not_in_household` FOURTH, exactly as §7's
array does. `tasks.md`'s preamble had already flagged an *earlier* draft of the prose that
listed it second. **The §7 array is what was implemented**, per the phase brief's instruction
that design.md wins any such disagreement:

```
no_recipient_chosen → recipient_has_no_phone → recipient_phone_unreachable
→ recipient_not_in_household → already_dispatched
```

`recipient_no_phone` and `recipient_unreachable` do not appear anywhere in the tree.

## Advisory `R3-ordering-scenario-omits-fifth-kind` is closed

Task 2b.5's fifth kind is unrepresentable in the database: the composite foreign key
`(invitation_id, dispatch_recipient_guest_id)` makes a cross-household recipient impossible to
persist (D23). A scenario drawn from real data therefore proves only FOUR kinds sort.

Two tests close it, both synthesized straight through `resolveDispatchRecipient`'s plain-array
signature, which cannot see that constraint:

- `reports a stale choice naming somebody who is no longer a member` — one row, one kind
- `sorts all five kinds into the documented order when every one of them is populated` — five
  rows, one per kind, asserted as a single ordered `[kind, count]` sequence with **every group
  non-empty**

That second test is the advisory's actual subject: it is the only assertion in the tree where
the fourth group's ORDINAL POSITION can fail, because it is the only one where all five groups
are simultaneously populated.

## The rename changed MEANING, and the stale Spanish string is gone

`no_phone_on_file` meant *nobody in the household has a number*. `recipient_has_no_phone` means
*the chosen person has none*. A household where the partner holds the only mobile is now
BLOCKED where it previously read as ready — that is the whole reason for the `recipient_`
prefix.

The old copy `"Nadie de estas invitaciones tiene un número guardado"` is false under the new
meaning and **does not survive**. Its absence is asserted, not reviewed:

```
it("no longer claims nobody in the household has a number", …)
  expect(copy).not.toContain("Nadie de estas invitaciones tiene un número guardado")
  expect(…recipient_has_no_phone.explanation).toContain("persona elegida")
```

Both renamed entries were rewritten and two new Spanish entries added, in the register of the
surrounding copy. `GROUP_COPY` is the one deliberately Spanish artifact in this slice; it is
operator-facing console text. Every identifier, comment and test name is English.

## Every refusal is asserted beside its permitting case

Tasks 2b.7, 2b.9 and 2b.13 name the discipline; it is applied throughout, in the same `it`:

| Refusal | Permitting case in the same test |
|---|---|
| `no_members` | the one-member draft saves |
| `member_without_name` | a named member saves |
| `duplicate_member_id` | two distinct ids save; two `null` ids are two people, not one |
| `recipient_not_a_member` | a recipient who IS a member saves |
| `custom_name_empty` | a typed custom name saves; a derived name is exempt |
| `would_empty_source` | a three-member source moves; **a two-member source also moves** (the boundary) |
| `same_invitation` | a different destination moves |
| `member_not_in_source` | a member the source has moves |
| `already_dispatched` (deletion) | `canDeleteInvitation([])` → `ok` |

`clearsSourceRecipient` is asserted `true` for the chosen guest and `false` for their
non-chosen sibling in one test. Advisories are never refusals: a duplicate nickname, a
recipient with no phone, and a recipient with a landline each assert `refusals: []` alongside
the advisory.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2b.1/2b.2 | `lib/domain/dispatch-recipient.spec.ts` | Unit (`environment: 'node'`, zero mocks) | N/A (new file); suite baseline measured at 1736/1736 | ✅ `Error: Cannot find module './dispatch-recipient' imported from …/lib/domain/dispatch-recipient.spec.ts`, `Test Files 1 failed (1)`, `Tests no tests` | ✅ `Test Files 1 passed (1)`, `Tests 8 passed (8)` | ✅ 8 cases: all five outcomes, the chosen-not-first case that proves no ordering rule survived, `""` treated as no number, and an empty household under both a chosen and an unchosen id | ➖ written once; a linear four-guard function was the first shape |
| 2b.3/2b.4 | `lib/domain/dispatch-message.spec.ts` | Unit | ✅ 17/17 before the edit | ✅ `AssertionError: expected [ 'INVITATION_MESSAGE_TEMPLATE', …(6) ] to not include 'selectDispatchRecipient'` | ✅ `Tests 18 passed (18)` | ✅ absence of all three exports PLUS presence of `buildInvitationMessage`, so an empty export list cannot pass it; `DispatchCandidateGuest.id` asserted separately | ➖ deletion only |
| 2b.5/2b.6 | `lib/domain/dispatch-preflight.spec.ts` | Unit | ✅ 16/16 before the edit | ✅ `Tests 14 failed \| 3 passed (17)`; `TypeError: selectDispatchRecipient is not a function` at `dispatch-preflight.ts:165` | ✅ `Tests 17 passed (17)` | ✅ 17 cases: one per kind, the order asserted twice (literal array + `PREFLIGHT_BLOCKER_ORDER`), the all-five-populated ordering test, the stale-copy absence test, and the existing no-digits guard re-run | ✅ `classify()` collapsed to a pass-through; `blockedNames()` extracted; green after each step |
| 2b.7/2b.8 | `lib/domain/invitation-draft.spec.ts` | Unit | N/A (new file) | ✅ `Error: Cannot find module './invitation-draft'`, `Tests no tests` | ✅ `Tests 24 passed (24)` | ✅ 12 cases for the validator: five refusals each paired with a permission, three advisories each paired with a non-advisory case, the two-unsaved-rows case, the derived-name exemption, and one asserting ALL refusals are reported rather than the first | ➖ `usableNickname`/`hasDuplicateId` extracted while writing, kept green |
| 2b.9/2b.10 | same file | Unit | N/A (new file) | ✅ same RED run | ✅ `Tests 24 passed (24)` | ✅ 6 cases: three refusals with permissions, the two-member boundary, the `clearsSourceRecipient` true/false pair, and D25's ordering (emptiness refuses before the recipient is consulted) | ➖ three guards, first shape |
| 2b.11/2b.12 | same file | Unit | N/A (new file) | ✅ same RED run | ✅ `Tests 24 passed (24)` | ✅ 6 cases: contradicted, not-contradicted, no-removal, no answer, a declined answer, and a shrink below `seatsConfirmed` with no dangling id | ➖ |
| 2b.13/2b.14 | `lib/domain/invitation-deletion.spec.ts` | Unit | N/A (new file) | ✅ `Error: Cannot find module './invitation-deletion'`, `Tests no tests` | ✅ `Tests 5 passed (5)` | ✅ 5 cases: the permitting/refusing pair, `link_opened` alone, `marked_failed` alone, distinct-kind de-duplication in order seen, and an unknown future kind | ➖ |
| consequential — tone | `lib/design/console-status.spec.ts` | Unit | ✅ 12/12 relevant before the edit | ✅ `Tests 4 failed \| 12 passed (16)` | ✅ `Tests 16 passed (16)` | ✅ one case per kind plus a loop over `PREFLIGHT_BLOCKER_ORDER` asserting length 5, so a sixth kind cannot render untoned | ➖ |
| consequential — row | `lib/domain/console-list.spec.ts` | Unit | ✅ 21/21 before the edit | ✅ RED proved by `git stash`-ing the implementation: `Tests 1 failed \| 21 passed (22)` | ✅ `Tests 22 passed (22)` | ✅ chosen/unchosen asserted as a PAIR, so a mapping hard-coding `null` cannot pass | ➖ |
| consequential — render | `components/console/DispatchPreflight.spec.tsx` | Component (Testing Library) | ✅ 6/6 before the edit | ✅ `Tests 6 failed`, `expected 'Revisión previa…' to contain 'Casa Muñóz'` | ✅ `Tests 8 passed (8)` | ✅ RE-DERIVED, not patched: the old "names the people whose number is missing" test split into one naming everybody there is to choose from and one naming **only** the chosen person while asserting the reachable partner is `null` in that section | ➖ |

### Test Summary

- **Total tests written**: 65 authored `it(` blocks across new and rewritten specs (8 new +
  24 new + 5 new + 18 rewritten preflight/dispatch-message + 10 rewritten tone/row/render), for
  a net authored delta of **+42** after the five deliberate deletions below
- **Total tests passing**: **1787** (`Test Files 97 passed (97)`), up from a baseline of
  **1736** (`94 passed (94)`) measured on the clean tree before any edit
- **The +51 is accounted for exactly, measured rather than inferred.** Net-new in the three new
  files: 8 + 24 + 5 = **37**. Net change in modified spec files, counted as `it(` blocks against
  `git show HEAD:<file>`: `dispatch-message.spec.ts` 21→18 (**−3**: five auto-pick tests
  deleted, two added), `dispatch-preflight.spec.ts` 14→17 (**+3**), `console-status.spec.ts`
  13→16 (**+3**), `console-list.spec.ts` 21→22 (**+1**), `DispatchPreflight.spec.tsx` 7→8
  (**+1**) = **+5**. Authored total **42**. The remaining **+9** is auto-enumerated: the three
  filesystem-scanning specs generate one case per repository file, and measured directly by
  stashing the whole slice, `npm test -- tools/no-seats-allowed tools/no-source-placeholders
  tools/console-one-breakpoint` reports `371 passed` on the clean tree and `380 passed` after —
  exactly +9 for the six new files. 42 + 9 = **51**
- **Layers used**: Unit (59), Component (2 rewritten). No DB or E2E layer authored
- **Approval tests**: none — nothing here was a behaviour-preserving refactor. The preflight
  rename is a deliberate BEHAVIOUR change (see above), so its existing tests were re-derived
  against the new meaning rather than preserved
- **Pure functions created**: 6 exported (`resolveDispatchRecipient`, `validateInvitationDraft`,
  `canMoveMember`, `classifyMembershipChangeImpact`, `canDeleteInvitation`, plus the rewritten
  `blockedNames` helper), 3 module-private (`usableNickname`, `hasDuplicateNickname`,
  `hasDuplicateId`)
- **Mocks used**: zero in `lib/domain/**`; the two component tests mock nothing either

## Five tests were DELETED rather than patched

`lib/domain/dispatch-message.spec.ts`'s entire `describe("selectDispatchRecipient")` block — 5
tests, 68 lines — was removed, not adapted. Every one of them asserted the auto-pick: "addresses
the first household member whose number can receive WhatsApp", "skips a landline and addresses
the mobile behind it". Those are assertions that the inference this capability REMOVES works
correctly. Keeping them under new names would have been keeping the behaviour under new names.
They are replaced by one test asserting the exports are gone.

## The task list did not name four files the slice cannot land without

This is reported rather than worked around, in the same spirit as `tasks.md`'s own 40th-file
correction. Tasks 2b.1–2b.15 name only `lib/domain/**`, but 2b.6 requires `classify()` to call
`resolveDispatchRecipient`, and that function needs **the chosen guest id**, which
`ConsoleListRow` did not carry. 2b.15 additionally requires *zero remaining references to
`selectDispatchRecipient` anywhere in source*, and one live call site sat outside `lib/domain/`.
Neither is satisfiable within the stated file list. The forced set:

| File | Why the slice cannot land without it | Size |
|---|---|---|
| `lib/domain/console-list.ts` | `ConsoleListRow` + `ConsoleInvitationInput` gain `dispatchRecipientGuestId`; `assembleConsoleRows` carries it. Without it `classify()` has no id to resolve | +12 |
| `lib/server/invitations.ts` | `CONSOLE_INVITATION_SELECT` reads `dispatch_recipient_guest_id` (added by `0012` in slice 1a) and maps it. Without it every real row resolves to `no_recipient_chosen` forever | +7/−1 |
| `app/console/(authenticated)/dispatch/[invitationId]/page.tsx` | The **only** live `selectDispatchRecipient` call site. 2b.15's zero-reference check fails without it, and so does `npm run typecheck` | +40/−11 |
| `lib/design/console-status.ts` + `.spec.ts` | `preflightGroupTone`'s `switch` is exhaustive over `PreflightBlockerKind`; five kinds means it no longer compiles. `tsc` proved this, it was not assumed | +32/−6 |

Plus three one-to-fifty-six-line fixture/copy updates that are pure consequence of the row field
and the renamed headings: `components/console/DispatchPreflight.spec.tsx` (re-derived),
`components/console/GuestList.spec.tsx` (+1), `components/console/ProgressSummary.spec.tsx`
(+1), and one stale doc comment in `e2e/console-dispatch.spec.ts` naming the deleted function.

`lib/server/invitations.ts`'s `chooseRecipient` WRITE is **not** here — that is task 3a.12 and
was not touched. This slice reads the column; it does not write it.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm test -- lib/domain/dispatch-recipient lib/domain/dispatch-message lib/domain/dispatch-preflight lib/domain/invitation-draft lib/domain/invitation-deletion` (task 2b.15's own command) → all passing |
| Full suite | `npm test` → **exit 0**, `Test Files 97 passed (97)`, `Tests 1787 passed (1787)` — baseline 1736 beaten by +51, zero failures, zero skips |
| Runtime harness command/scenario and exact result | **N/A for the three new modules** — pure functions under `environment: 'node'`, no I/O, no React, no vendor SDK, zero mocking. The consequential wiring's runtime boundary (`lib/server/invitations.ts`'s new `select` column) is covered by `npm run build` compiling and by the existing `lib/server/invitations.spec.ts` fake/real split, which stayed green |
| E2E | **Not run.** Files outside `lib/domain/**` WERE touched, so this is stated explicitly rather than assumed: the one E2E edit is a doc-comment word (`selectDispatchRecipient` → `resolveDispatchRecipient`) and changes no assertion. `e2e/console-dispatch.spec.ts`'s readiness-count assertions are task **4b.15**, which is where the design puts them ("Every E2E readiness-count assertion moves… do not adjust numbers until green"). Running E2E now would fail on counts this slice is not authorized to re-derive |
| `npm run typecheck` | exit 0, no output. It found 5 of the 7 consequential files before they were fixed |
| `npm run lint` | exit 0, zero findings. The `lib/domain/**` import zone accepted all three new modules unchanged; the rule was not weakened |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" (after `prettier --write` on 5 files) |
| `npm run build` | exit 0, same 13 routes as slice 2a |
| Cold-start flake | `tools/eslint-zones.spec.ts` passed on the first run of every full-suite invocation; no re-run was needed |
| Rollback boundary | Delete the six new `lib/domain/` files; restore `dispatch-message.ts` and `dispatch-preflight.ts` to their prior exports; revert the `dispatchRecipientGuestId` field in `console-list.ts`/`invitations.ts` and the dispatch page's resolver call. No migration, no schema, no data. `git status` shows 6 untracked additions and 14 modifications, all listed above |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `lib/domain/dispatch-recipient.spec.ts` | Created | 8 cases covering all five outcomes; the chosen-not-first case; `""` as no number; empty household under chosen and unchosen ids |
| `lib/domain/dispatch-recipient.ts` | Created | `IdentifiedDispatchGuest`, `DispatchRecipientProblem`, `DispatchRecipientOutcome`, `resolveDispatchRecipient` per §4 — plain arrays, no fallback at any step |
| `lib/domain/invitation-draft.spec.ts` | Created | 24 cases: validator, `canMoveMember`, `classifyMembershipChangeImpact`, every refusal paired with a permission |
| `lib/domain/invitation-draft.ts` | Created | All eleven §4 exports; `canMoveMember` refuses emptiness before consulting the recipient (D25); `classifyMembershipChangeImpact` reports and never refuses (D19) |
| `lib/domain/invitation-deletion.spec.ts` | Created | 5 cases; permitting/refusing pair, `link_opened` and `marked_failed` each alone, an unknown kind |
| `lib/domain/invitation-deletion.ts` | Created | `DeletionRefusal`, `DeletionOutcome`, `canDeleteInvitation` — refuses on row EXISTENCE, never on a kind allowlist |
| `lib/domain/dispatch-message.ts` | Modified | `selectDispatchRecipient`, `DispatchRecipientProblem`, `DispatchRecipientOutcome` deleted (−57); `DispatchCandidateGuest.id` added |
| `lib/domain/dispatch-message.spec.ts` | Modified | 5 auto-pick tests deleted; absence-of-exports test added; `guest()` fixture carries `id` |
| `lib/domain/dispatch-preflight.ts` | Modified | Five-kind `PREFLIGHT_BLOCKER_ORDER` per §7; `PreflightBlockerKind = DispatchRecipientProblem \| "already_dispatched"`; `classify()` a pass-through; `blockedNames()` extracted; `GROUP_COPY` fully rewritten |
| `lib/domain/dispatch-preflight.spec.ts` | Modified | Re-derived against the five kinds; two tests added for the fifth kind and one for the stale copy |
| `lib/domain/console-list.ts` | Modified | `dispatchRecipientGuestId` on `ConsoleListRow` + `ConsoleInvitationInput`, carried by `assembleConsoleRows` |
| `lib/domain/console-list.spec.ts` | Modified | Fixture field; chosen/unchosen pass-through asserted as a pair |
| `lib/server/invitations.ts` | Modified | `dispatch_recipient_guest_id` selected and mapped. Read only — no write |
| `app/console/(authenticated)/dispatch/[invitationId]/page.tsx` | Modified | `resolveDispatchRecipient` with the stored choice; the two-branch ternary replaced by a four-entry `RECIPIENT_PROBLEM_COPY` record |
| `lib/design/console-status.ts` + `.spec.ts` | Modified | `preflightGroupTone` exhaustive over five kinds; spec re-derived with a `PREFLIGHT_BLOCKER_ORDER` loop |
| `components/console/DispatchPreflight.spec.tsx` | Modified | Re-derived headings and fixtures; the chosen-person naming rule asserted against a reachable partner |
| `components/console/GuestList.spec.tsx`, `ProgressSummary.spec.tsx` | Modified | Row fixture field (+1 each) |
| `e2e/console-dispatch.spec.ts` | Modified | One stale doc-comment word |
| `openspec/changes/invitation-administration/tasks.md` | Modified | 2b.1–2b.15 marked `[x]` |
| `openspec/changes/invitation-administration/apply-progress.md` | Modified | This section appended; the slice-1a and slice-2a sections above are byte-untouched |

## Workload / PR Boundary

- Mode: **chained slice 2b of eight**, one commit per slice, no pull requests
- Current work unit: 2b — `dispatch-recipient`, `invitation-draft`, `invitation-deletion`,
  the preflight rename, and the `selectDispatchRecipient` removal
- Boundary: starts at `cdc2c3c` with a clean tree; ends with the auto-pick gone from the whole
  tree, five blocker kinds classified and ordered, the whole suite green, and slice 3a not
  started
- **Authored changed lines: 1,687** — 1,018 in six new files, plus 445 insertions and 224
  deletions across 14 modified files (all excluding `openspec/**`). Against
  `review_budget_lines: 800` this is **2.1× over. `size:exception` is required for this slice**
- **Not committed and not pushed**, as instructed

### Why this slice could not land in 800 lines

Stated as a fact about the work, not as an excuse, and **no compression was attempted** — the
apply contract forbids deleting comments, tests or docs to reach a number.

1. **The six new files alone are 1,018 lines**, before a single edit to anything existing.
   `design.md` §6 estimated slice 2b at ≈730 lines TOTAL. That estimate was low: §4 specifies
   **eighteen exported symbols** across three modules, and this repository's established
   density — the module-level rationale comment that every one of `dispatch-message.ts`,
   `dispatch-preflight.ts`, `guest-name.ts` and `greeting-name.ts` carries — costs roughly 40%
   of each file. `invitation-draft.ts` implements **three** independent §4 surfaces (validator,
   move check, impact classifier) and is 288 lines; its spec is 376.
2. **The refusal-pairing discipline doubles the test count by design.** Nine refusals each
   ship with a permitting case *in the same test*, which is what makes them meaningful. That
   is a deliberate cost the spec imposes, not incidental verbosity.
3. **The preflight rename is 355 lines of churn on its own** (140 + 215), because it went from
   three kinds to five AND changed the meaning of two, so its spec had to be re-derived rather
   than renamed.
4. **~100 lines are the consequential wiring the task list omitted** (see above), which cannot
   be deferred without leaving `npm run typecheck` red.

A split is possible but was not taken, because no sub-slice is independently green. Splitting
at `invitation-draft.ts` (664 lines, the obvious seam) would leave the auto-pick removal and
the preflight rename in one ≈1,020-line half — still over budget — and the draft/deletion
modules in a half with no call sites. The single natural boundary *is* the whole slice.

## Status

52/120 tasks complete (all of slice 1a, all of slice 2a, all of slice 2b). Ready for verify.
Slice 3a is NOT started by design.
