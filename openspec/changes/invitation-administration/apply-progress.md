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

---

# Batch 4 — Slice **3a** only (tasks 3a.1–3a.17)

**Mode**: Strict TDD (`openspec/config.yaml` → `strict_tdd: true`, `test_command: "npm test"`)
**Branch**: `feat/whatsapp-wedding-invitations` (base `4314333`, tree clean at start)
**Prior progress read**: yes — this file's slice-1a, slice-2a and slice-2b sections above, kept
byte-untouched and merged into.
**Not started, deliberately**: slice 3b (Server Actions and the importer's Zod layer), and
slice 1b, which remains unstarted from batch 1.
**Over budget, stated up front**: **1,697 authored changed lines** against `review_budget_lines:
800`. See *Why this slice could not land in 800 lines* below. One deduplication refactor was
taken because it improved the tests; no comment, test or doc was removed to reach a number.

## This slice closes the interim gap slice 2b opened

Slice 2b made the console READ `dispatch_recipient_guest_id` and made
`no_recipient_chosen` the first preflight blocker kind. Nothing wrote that column. Between
2b landing and this slice, **every invitation reported `no_recipient_chosen` and dispatch was
blocked for all of them** — correct behaviour for a column that is legitimately null, but a
state no operator could leave.

`chooseRecipient` (3a.11/3a.12) is what ends that, and it is the load-bearing task of this
slice rather than a routine one. It is also the narrowest function here, deliberately: the
composite FK `(id, dispatch_recipient_guest_id) → invitation_guests (invitation_id, id)` does
the refusing, and **no application-level pre-check was added**. A second copy of that rule
would hide whether the constraint still works. The test proves the database refuses a
cross-household guest (`violates foreign key constraint`) and that the previously stored,
valid choice is still in place afterwards.

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 3a.1 RED — `createInvitation` validates before writing; one path for solo and group | ✅ | `Tests 4 failed \| 40 passed (44)`; `AssertionError: expected '' to be 'Luis Guzmán'`, `expected 'imported' to be 'custom'`, `promise resolved "{ …(7) }" instead of rejecting` ×2 |
| 3a.2 GREEN — validation + `greeting_name`/`greeting_name_source` from ONE function | ✅ | `Tests 44 passed (44)`; `greetingNameColumns()` is the single producer of the pair (§8) |
| 3a.3 RED — **D21**, guest insert AND compensation both fail | ✅ | `AssertionError: expected 'Could not create guests for invitatio…' to contain 'deadlock detected'` — the compensation's own error was discarded, exactly the bug at the old `:398` |
| 3a.4 GREEN — both failures plus the orphan's `id` and `slug` named | ✅ | `Tests 46 passed (46)`; permitting counterpart asserts the message does NOT claim an orphan when the compensation succeeded |
| 3a.5 RED — `addMember`/`editMember`/`removeMember`, last-member refusal paired | ✅ | `Tests 6 failed \| 46 passed (52)`; `TypeError: addMember is not a function`, `editMember is not a function`, `removeMember is not a function` |
| 3a.6 GREEN — all three validate the AFTER-state before any write | ✅ | `Tests 52 passed (52)` |
| 3a.7 RED — a refused move issues NO call at all (D25) | ✅ | `AssertionError: expected '(0 , …moveMemberToInvitation…' to match /delete the invitation/i` |
| 3a.8 GREEN — `canMoveMember` decides before SQL; the trigger clears the source | ✅ | `Tests 56 passed (56)`; `expect(calls).toEqual([])` passes — zero calls, not zero writes |
| 3a.9 RED — the refusal precedes any greeting-name derivation | ✅ | `Tests 4 failed \| 52 passed (56)` after the assertion was strengthened to require the named reason, not merely the absence of a crash |
| 3a.10 GREEN — refusal ordered before derivation in every member path | ✅ | `deriveGreetingName([])` is unreachable: `expect(failure).toContain("would_empty_source")` and `.not.toMatch(/cannot derive a greeting name/i)` both hold |
| 3a.11 RED — `chooseRecipient`, same-invitation accepted, foreign refused by the FK | ✅ | RED captured as `TypeError: chooseRecipient is not a function` in the 3a.7 run, where the move test used it as a fixture. The FK-refusal assertion itself passed on its first run — see the honesty note below |
| 3a.12 GREEN — `chooseRecipient` writes `dispatch_recipient_guest_id` | ✅ | `Tests 57 passed (57)`; stored recipient unchanged after the refused write |
| 3a.13 RED — `deleteInvitation` permitted at zero events, refused by any history | ✅ | `Tests 4 failed \| 57 passed (61)`; `TypeError: deleteInvitation is not a function`, `to contain 'link_opened'`, `to contain 'marked_failed'` |
| 3a.14 GREEN — `canDeleteInvitation` consulted before the hard delete | ✅ | `Tests 61 passed (61)`; refusal names the kinds AND offers rotation |
| 3a.15 RED — `rotateInvitationSlug` mints, records, nulls the warm, re-warms | ✅ | `Tests 2 failed \| 61 passed (63)`; `TypeError: rotateInvitationSlug is not a function` |
| 3a.16 GREEN — rotation per D16, `mintSlug()` reused | ✅ | `Tests 63 passed (63)` |
| 3a.17 Verify | ✅ | see *Work Unit Evidence* |

## An honesty note on 3a.11's RED

Task 3a.11's cross-household assertion **passed on its first execution**, and that is recorded
rather than dressed up. Its RED is real but was captured one step earlier: the move test (3a.7)
used `chooseRecipient` as a fixture and failed with `TypeError: chooseRecipient is not a
function`, which is what drove `chooseRecipient` into existence. The dedicated FK test then
pinned behaviour the DATABASE already provides, because slice 1a delivered the composite
constraint. It is a triangulation case over an existing guarantee, not a fresh RED→GREEN cycle,
and it is exactly the test that would fail if a future change dropped the constraint or if
somebody added the application-level pre-check this slice deliberately refused to add.

## D21 — what the old code actually did, and what closes it

```ts
// before — the delete's own result is discarded
await client.from("invitations").delete().eq("id", invitation.id);
throw new Error(`Could not create guests …: ${guestsError.message}`);
```

A failing compensation left a **guestless invitation nobody can ever unlock**, looking valid in
the console, while the operator was told only that the guest insert failed — the wrong thing,
and no handle on the row. The fix captures `compensationError` and, when it is non-null, throws
a message naming **both** failures plus the orphan's `id` and `slug`. A test proving only that
the guest-insert failure surfaces would not have closed this: the old code already did that.
The refusing test asserts all four facts; its permitting counterpart asserts that a SUCCESSFUL
compensation does not claim an orphan exists.

## D25 — the refusal that issues nothing

`moveMemberToInvitation` takes `sourceMemberIds` and `sourceRecipientGuestId` as ARGUMENTS
rather than reading them, and that is a deliberate consequence of what 3a.7 has to prove. The
test asserts `calls` is `[]` — zero calls through the client, not zero writes. A repository
that read the membership first in order to decide would have touched the database to answer a
question it then refuses, and the assertion could only have been weakened to "zero writes".
`canMoveMember`'s own §4 signature already takes exactly this snapshot, so the repository
mirrors the pure function it delegates to.

The cost is stated plainly: a stale snapshot could let a move empty its source. `design.md`
D25 already answers this — the zero-member state is made **inert rather than prevented** (a
`count(*)` cap of 0 refuses every attending RSVP, no phone matches, and the invitation stays
visible and deletable). This slice does not introduce a second definition of existence to
guard a race the design chose to absorb.

## §8 — one function writes the pair

`greetingNameColumns({ source, stored, members })` returns `{ greeting_name,
greeting_name_source }` together and is the ONLY producer of either column in the repository.
Both the `INSERT` in `createInvitation` and the `UPDATE` in `rewriteGreetingName` spread its
result. Two write sites is how the stored name and the source that explains it drift apart,
and `greeting_name_source` exists precisely so "should this be re-derived?" is a stored fact
rather than a guess made by matching text against member names.

Proven by a paired test: a `derived` invitation re-derives on every member change
(`"Lucho e Inés"` after a nickname edit), and a `custom` one is left untouched by the same code
path (`"Los del salón"` survives an `addMember`, source still `custom`).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3a.1/3a.2 | `lib/server/invitations.spec.ts` | Integration (real local Supabase) | ✅ 40/40 measured before the first edit | ✅ `Tests 4 failed \| 40 passed (44)`; `expected '' to be 'Luis Guzmán'` | ✅ `Tests 44 passed (44)` | ✅ 4 cases: solo vs group through the identical call, a custom name stored untouched, `no_members` refused, `member_without_name` refused — each refusal asserting zero rows written | ✅ create's message moved onto the shared `refusalMessage()` when 3a.6 introduced it; green after |
| 3a.3/3a.4 | same file | Integration (fake client) | ✅ 44/44 | ✅ `expected 'Could not create guests for invitatio…' to contain 'deadlock detected'` | ✅ `Tests 46 passed (46)` | ✅ 2 cases: compensation fails (both failures + id + slug named) and compensation succeeds (no orphan claimed) — the pair is what makes the first assertion falsifiable | ➖ |
| 3a.5/3a.6 | same file | Integration (real local Supabase) | ✅ 46/46 | ✅ `Tests 6 failed \| 46 passed (52)`; three `is not a function` | ✅ `Tests 52 passed (52)` | ✅ 6 cases: add re-derives, edit re-derives, a `custom` name is never overwritten, the LAST member is refused with the invitation intact, a two-member removal succeeds and falls back to the SOLO name, and a blanked name is refused | ✅ `readMembership`, `refuseInvalidMembership`, `rewriteGreetingName`, `REFUSAL_EXPLANATION` extracted so all three functions share one shape |
| 3a.7/3a.8/3a.9/3a.10 | same file | Integration (fake client + real local Supabase) | ✅ 52/52 | ✅ `Tests 4 failed \| 52 passed (56)` | ✅ `Tests 56 passed (56)` | ✅ 4 cases: `would_empty_source` with zero calls, the same refusal asserted NOT to be a derivation crash, `same_invitation` with zero calls, and a real three-member move that clears the source's recipient, leaves the destination's alone and re-derives both names | ➖ |
| 3a.11/3a.12 | same file | Integration (real local Supabase) | ✅ 56/56 | ✅ `TypeError: chooseRecipient is not a function` (captured in the 3a.7 run) | ✅ `Tests 57 passed (57)` | ✅ permitting counterpart written FIRST in the same test, so the FK refusal can fail if the constraint is dropped | ➖ |
| 3a.13/3a.14 | same file | Integration (real local Supabase) | ✅ 57/57 | ✅ `Tests 4 failed \| 57 passed (61)` | ✅ `Tests 61 passed (61)` | ✅ 4 cases via `it.each`: zero-event deletion succeeds (invitation AND members gone), then `marked_sent`, `link_opened` and `marked_failed` each ALONE refuse, name themselves and offer rotation | ➖ |
| 3a.15/3a.16 | same file | Integration (real local Supabase) | ✅ 61/61 | ✅ `Tests 2 failed \| 61 passed (63)` | ✅ `Tests 63 passed (63)` | ✅ 2 cases: rotation asserts the new slug's alphabet, `slug_rotated_at` set, `og_warmed_at` nulled, the warm invoked with the NEW slug, members/name/history preserved, the old slug resolving to `null` and the new one to the same id; plus a rotated-then-still-undeletable case | ➖ |

### Test Summary

- **Total tests written**: **23** authored `it(` blocks (one of them an `it.each` over three
  event kinds, counted as 3), all appended to `lib/server/invitations.spec.ts`
- **Total tests passing**: **1810** (`Test Files 97 passed (97)`), up from the batch-3 baseline
  of **1787**. The delta is exactly the 23 authored cases; no file-scanning spec gained a case,
  because no new source file was created
- **Focused file**: `lib/server/invitations.spec.ts` went from **40** to **63** passing
- **Layers used**: Integration against the real local Supabase (19), Integration against a
  recording fake client (4). No new unit or E2E tests — every behaviour in this slice is a
  write against a schema, and the pure logic it composes was already covered by slices 2a/2b
- **Approval tests**: none. `createInvitation` was rewritten with a behaviour CHANGE (it now
  validates and writes a source), so its existing tests were extended rather than preserved;
  the three pre-existing `createInvitation` tests stayed green untouched throughout
- **Mocks used**: zero. The fake client is a recording stub with a scripted result table, not
  a mocking framework; the two tests that use it assert on recorded calls and thrown text
- **Pure functions created**: 3 module-private (`greetingNameColumns`, `toDraftMember`,
  `refusalMessage`). No new pure logic was added to `lib/server/**` — `validateInvitationDraft`,
  `canMoveMember`, `canDeleteInvitation`, `resolveGreetingName` are all imported from
  `lib/domain/**` and none of them was reimplemented here

## Nothing in `lib/domain/**` was reimplemented

Stated explicitly because it was the standing instruction for this slice. The repository
imports and delegates: `validateInvitationDraft` (create, add, edit, remove), `canMoveMember`
(move), `canDeleteInvitation` (delete), `resolveGreetingName` (every name write). `rg` finds
no second copy of a refusal rule, a conjunction rule or a naming fallback under `lib/server/`.
`mintSlug()` is reused by rotation exactly as D16 requires, so randomness stays in the adapter
and rotation does not become the exception to D2.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm test -- lib/server/invitations` → `Test Files 1 passed (1)`, `Tests 63 passed (63)` (task 3a.17's own command; baseline 40) |
| Full suite | `npm test` → **exit 0**, `Test Files 97 passed (97)`, `Tests 1810 passed (1810)` — baseline 1787 beaten by +23, zero failures, zero skips |
| Runtime harness command/scenario and exact result | **Local Supabase (docker), exercised for real.** 19 of the 23 new tests issue genuine SQL through PostgREST against migration `0012`'s schema: the composite FK, the `clear_recipient_on_guest_move` trigger, the `invitation_guests` cascade and the `greeting_name_source` check constraint all participated. The fake-client tests cover only the two states a real database cannot be made to reach on demand (a compensation that itself fails; a refusal that must issue nothing) |
| E2E | **Not run, and that is the correct answer here.** Only `lib/server/invitations.ts` and its own spec changed — nothing under `app/**`, `components/**` or `e2e/**`. The E2E readiness counts remain knowingly stale until task 4b.15 |
| `npm run typecheck` | exit 0, no output |
| `npm run lint` | exit 0, zero findings. `import "server-only"` is still the first statement of `lib/server/invitations.ts` |
| `npm run format:check` | exit 0, "All matched files use Prettier code style!" (after `prettier --write` on the two changed files) |
| `npm run build` | exit 0, `✓ Compiled successfully in 872ms`, same 13 routes as slice 2b |
| Cold-start flake | `tools/eslint-zones.spec.ts` passed on the first run of every full-suite invocation and again in isolation (`Tests 14 passed (14)`). No re-run was needed |
| Database survival check | Run before and after all database work, as instructed. Before: `auth.users` = `lumigu.dev@gmail.com`, `sruiz7541@gmail.com`; `ceremony.couple_names` = `Luis & Michell`. After: identical. `supabase db reset` was NOT run. Zero fixture rows leaked — every write-side test tears down through `withSenderFixture` |
| Rollback boundary | Delete the seven new exported functions and their five private helpers from `lib/server/invitations.ts`, and the appended `describe` blocks from its spec. The prior read-only surface, `importInvitations`, `validateImportRow*` and every console read are untouched. No migration, no schema, no data. `git status` shows exactly 2 modified files outside `openspec/**` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `lib/server/invitations.ts` | Modified | +695/−2. `createInvitation` now validates the draft before any statement and writes the greeting pair from `greetingNameColumns()`; D21's compensation captures its own error; new exports `addMember`, `editMember`, `removeMember`, `moveMemberToInvitation`, `chooseRecipient`, `deleteInvitation`, `rotateInvitationSlug`; new private helpers `greetingNameColumns`, `toDraftMember`, `refusalMessage`, `readMembership`, `refuseInvalidMembership`, `rewriteGreetingName`; `NewInvitationGuest` gains optional `nickname`, `NewInvitation` gains optional `greetingNameSource` |
| `lib/server/invitations.spec.ts` | Modified | +1000/−0. 23 new cases across 7 `describe` blocks; a recording fake Supabase client; `withSenderFixture` and a `member()` fixture helper |
| `openspec/changes/invitation-administration/tasks.md` | Modified | 3a.1–3a.17 marked `[x]` |
| `openspec/changes/invitation-administration/apply-progress.md` | Modified | This section appended; the slice-1a, slice-2a and slice-2b sections above are byte-untouched |

## Workload / PR Boundary

- Mode: **chained slice 3a of eight**, one commit per slice, no pull requests
- Current work unit: 3a — the repository write side
- Boundary: starts at `4314333` with a clean tree; ends with every write-side repository
  function shipped and green, `dispatch_recipient_guest_id` finally writable, and slice 3b not
  started
- **Authored changed lines: 1,697** — 1,000 insertions in the spec plus 695 insertions and 2
  deletions in the source, all excluding `openspec/**`. Against `review_budget_lines: 800` this
  is **2.1× over. `size:exception` is required for this slice**
- **Not committed and not pushed**, as instructed

### Why this slice could not land in 800 lines

`design.md` §6 estimated slice 3a at ≈750 lines. That estimate was low, for reasons that are
facts about the work rather than excuses:

1. **Seven exported functions, not one.** The slice's own task list names `createInvitation`,
   `addMember`, `editMember`, `removeMember`, `moveMemberToInvitation`, `chooseRecipient`,
   `deleteInvitation` and `rotateInvitationSlug`. At this repository's established density —
   every existing function in this file carries a 10-to-20-line rationale comment explaining
   why it is shaped as it is — 695 source lines for eight surfaces plus six helpers is the
   house rate, not padding.
2. **Every refusal ships its permitting counterpart in the same test**, which the
   invitation-administration spec requires by name. Nine refusal/permission pairs is eighteen
   assertions' worth of fixture.
3. **Integration fixtures are expensive.** A real-Supabase test needs a sender row, one or two
   invitations, their members, and a full teardown. `withSenderFixture` already factors the
   sender and teardown out; what remains is per-test data that differs per test.
4. **A recording fake client had to be written** (≈75 lines) because two of this slice's
   load-bearing guarantees — D21's failed compensation and D25's zero-call refusal — are
   unreachable against a real database on demand.

**One compression WAS taken, because it improved the tests**: a `member()` fixture helper
replaced 16 repeated six-line guest literals, removing 50 lines of duplication. It is a
REFACTOR-step deduplication, and the suite was green before and after. No comment, test or doc
was removed to reach a number, and no further compression was attempted.

A split is possible but no half is independently meaningful: `chooseRecipient` without
`createInvitation`'s `nickname` write has nothing to choose between, and the member functions
share `readMembership`, `refuseInvalidMembership` and `rewriteGreetingName` with each other
and with create. The natural boundary is the whole write side.

## Status

69/120 tasks complete (all of slice 1a, 2a, 2b and 3a). Slice 1b and slice 3b are NOT started.
Ready for verify.

---

# Slice 3b — Server Actions; importer Zod parse + `nickname`

**Change**: invitation-administration
**Mode**: Strict TDD
**Work unit**: 3b — the console's write surface and the importer's front door
**Starts at**: `3b83efe` (slice 3a), clean tree

## Completed Tasks

| Task | Status | Evidence |
|---|---|---|
| 3b.1 RED — sender B writes on ANA's invitation X; dispatch stays owner-scoped and device-gated | ✅ | `Tests 30 failed \| 25 passed (55)`; every failure `TypeError: createInvitationAction is not a function` and its eight siblings. The three dispatch assertions PASSED in the same run — they exercise code that already exists, which is what makes them the control |
| 3b.2 GREEN — `createInvitationAction`/`updateInvitationAction`, no ownership check | ✅ | `Tests 55 passed (55)`. Mutation-proved: reinstating an ownership lookup on ONE action turned the block red — `Tests 2 failed \| 53 passed (55)` |
| 3b.3 RED — the four member actions require a session, never ownership; `removeMemberAction` surfaces `classifyMembershipChangeImpact` | ✅ | same RED run; `addMemberAction`/`editMemberAction`/`removeMemberAction`/`moveMemberAction` all `is not a function` |
| 3b.4 GREEN — the four member actions wired | ✅ | `Tests 55 passed (55)`; the impact record is returned, not a boolean, and the membership is read BEFORE the removal (`expect(order).toEqual(["read", "remove"])`) |
| 3b.5 RED — `chooseRecipientAction` refuses a non-member id, accepts a member id | ✅ | same RED run; `chooseRecipientAction is not a function` |
| 3b.6 GREEN — `chooseRecipientAction` | ✅ | `Tests 55 passed (55)`; the refusal names the fact (`no pertenece a esta invitación`) rather than surfacing a constraint violation |
| 3b.7 RED — `deleteInvitationAction` refuses with the `eventKinds`-naming message and offers rotation | ✅ | same RED run; `deleteInvitationAction is not a function` |
| 3b.8 GREEN — `deleteInvitationAction` | ✅ | `Tests 55 passed (55)`; the repository refusal is propagated **verbatim** — asserted with `/link_opened, marked_failed[\s\S]*Rotate its slug instead/` |
| 3b.9 RED — `rotateSlugAction` returns the new slug and records no dispatch event | ✅ | same RED run; `rotateSlugAction is not a function` |
| 3b.10 GREEN — `rotateSlugAction` | ✅ | `Tests 55 passed (55)` |
| 3b.11 RED — **D22**, the first Zod issue names file, index and field | ✅ | `Tests 6 failed \| 16 passed (22)`; `AssertionError: expected [Function] to throw an error` — a behavioural gap, not a missing symbol. Today's parse accepts the malformed row and it fails much later as a bare `TypeError` |
| 3b.12 GREEN — `z.array(importRowSchema).safeParse`, first issue only | ✅ | `Tests 22 passed (22)`; exact message `data/guests.source.json → invitations[7].guests[1].full_name: expected string, received number` |
| 3b.13 RED — `nickname` in, a seats column REJECTED (closes `R3-old-format-import-rejection-unproved`) | ✅ | same RED run; `expected undefined to be 'Lucho'` (validation dropped the nickname) and `expected [Function] to throw an error` (the old format was silently accepted) |
| 3b.14 GREEN — optional `nickname`; any seats column rejected by name | ✅ | `Tests 22 passed (22)`, and a further RED→GREEN below for the payload that silently dropped the nickname on its way to the row |
| 3b.15 Verify | ✅ | see *Work Unit Evidence* |

## The authorization change, and why the tests can fail

Confirmed decision 4 removes owner scoping from console **writes** and leaves **dispatch**
alone. Removing an authorization check is the kind of change that looks fine and is not, so
three things were done rather than one:

1. **The session is BETO throughout and every invitation acted on is owned by ANA.** The
   assertions are on the write actually issued with the submitted values, not on the absence
   of an exception.
2. **`findConsoleInvitation` answers `null` for BETO in that block** — the truth, because it
   applies `owner_sender_id = viewer` as a `WHERE`. Any action that consulted ownership would
   therefore refuse, and every assertion in the block would fail. The tests cannot pass by
   accident while a check is still in place.
3. **A mutation test.** An ownership lookup was temporarily reinstated on `addMemberAction`:

   ```
   FAIL  … > lets the non-owning operator add a member to ANA's invitation
   FAIL  … > never consults the owner-scoped lookup on any administration write
   Tests  2 failed | 53 passed (55)
   ```

   Reverted, `Tests 55 passed (55)`. The guard is live, not decorative.

**"No ownership check" is not "no auth check".** Every one of the nine actions still begins
with `requireOperator()`, proved by an `it.each` over a nine-entry table whose length is
asserted separately so a dropped entry cannot silently stop being checked. Dispatch keeps both
its ownership lookup and its per-device WhatsApp declaration gate, and three tests in
`dispatch is still owner-scoped and still device-gated` refuse BETO on all three counts.

## D22 — what the old parse actually did

```ts
// before — an unchecked cast over a value checked only for being a non-empty array
return invitations as ImportRow[];
```

A malformed row survived the parse and failed downstream as a bare `TypeError: Cannot read
properties of undefined (reading 'length')`, naming no row, no field and no file — against a
requirement whose whole point is stopping at the row that introduced the problem. It is now a
`safeParse` over `z.array(importRowSchema)` reporting only the **first** issue, because
`ZodError.issues` for a malformed array is dominated by cascade noise from the first bad row.
A second test asserts the message does **not** mention the second broken row.

Field names are rendered in the importer's existing vocabulary — `full_name`, not `fullName` —
because `validateImportRow` has always spoken in column names (`Import row is missing a value
for full_name.`) and two vocabularies for one field is one more than an operator can hold.
This is a deliberate choice and it is the one place in this slice where the message names a
key that is spelled differently in the JSON.

## The one-way door needed one exemption, and it is argued in the guard

`tools/no-seats-allowed.spec.ts` forbids the literals `seatsAllowed`/`seats_allowed` anywhere
under `app`, `components`, `lib`, `scripts`, `e2e` and `supabase/tests`, with an exemption list
that was **empty on purpose**. Proving that an OLD-format source file is rejected requires
naming the key that format used, and `git show 5ea6b4f~1:lib/server/invitations.ts` confirms
that key was exactly `seatsAllowed` on `ImportRow`. The list therefore grows one entry,
`scripts/import-guests.spec.ts`, and the guard's own `expect(EXEMPT_PATHS).toEqual([])`
assertion was rewritten to name it and carry the argument — which is precisely the speed bump
that assertion exists to be. No glob was widened, and `seats_allowed` is no longer named at
all: the test covers `seatsAllowed`, `seats` and `seatCount`.

## Two repository functions this slice had to add

Neither is a reimplementation of slice 3a's work; both are gaps 3a's task list did not name.

- **`updateInvitation`** (`lib/server/invitations.ts`). Task 3b.2 requires
  `updateInvitationAction`, and nothing in the repository could write an invitation's own
  fields — 3a shipped creation and membership only, while `design.md` §8 lists
  `insert/update invitations`. It writes the greeting pair through the same
  `greetingNameColumns` every other path uses, so a `derived` invitation re-derives from its
  CURRENT members and the round-tripped string is ignored. RED
  `Tests 3 failed | 65 passed (68)`, GREEN `Tests 68 passed (68)`.
- **The `nickname` key in `importInvitations`'s payload.** Migration 0012 gave
  `import_invitations` a `nickname` to read and `validateImportRow` now carries one through,
  but the payload assembled for the RPC never sent it, so an imported nickname was dropped in
  silence with every other layer looking correct. RED was the database itself:
  `expected [ …(2) ] to deeply equal [ …(2) ] — "nickname": "Lucho" / + "nickname": null`.
  GREEN `Tests 69 passed (69)`.

## A pre-existing failure in slice 3a, reported and NOT fixed

`lib/server/invitations.spec.ts > moveMemberToInvitation — a permitted move > moves the member,
clears the SOURCE's recipient and leaves the destination's alone` fails nondeterministically:

```
AssertionError: expected 'Inés y Ana' to be 'Ana e Inés'
```

Reproduced on the **stashed, unmodified** slice-3a files **5 times out of 6**. `readMembership`
issues no `ORDER BY`, so the member order — and therefore the derived greeting name — depends
on heap order. With this slice's rows present it passed 3/3 and the full suite passed 3/3, which
is luck rather than a fix. It belongs to slice 3a's `readMembership` and is left for the
verifier to route; touching it here would edit code this work unit did not change.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3b.1–3b.10 | `app/console/(authenticated)/actions.spec.ts` | Integration (mocked repository, real action code) | ✅ 24/24 measured before the first edit | ✅ `Tests 30 failed \| 25 passed (55)`, plus a post-GREEN mutation run `Tests 2 failed \| 53 passed (55)` | ✅ `Tests 55 passed (55)` | ✅ 31 cases: nine writes by a non-owning operator, the owner-scoped lookup asserted absent, the unpartitioned read asserted present, the declaration asserted unread, nine session refusals by table, three dispatch refusals, the impact record with and without a contradicted answer, read-before-remove ordering, recipient accepted and refused, delete permitted and refused verbatim, rotation returning its slug and refusing a missing id | ✅ five parse helpers (`requiredInvitationId`, `text`, `requiredText`, `optionalText`, `flag`, `storedPhone`, `readMemberRows`, `readInvitation`) extracted so the nine actions share one shape; green after |
| 3b.2 (repository half) | `lib/server/invitations.spec.ts` | Integration (real local Supabase) | ✅ 65/65 | ✅ `Tests 3 failed \| 65 passed (68)`; `updateInvitation is not a function` | ✅ `Tests 68 passed (68)` | ✅ 3 cases: a custom name stored verbatim with its deadline, a `derived` source re-deriving `"Lucho y Ana"` while the submitted string is deliberately a lie, and `custom_name_empty` refused with the stored name intact | ➖ |
| 3b.11/3b.12 | `scripts/import-guests.spec.ts` | Unit (pure parse) | ✅ 16/16 | ✅ `Tests 6 failed \| 16 passed (22)`; `expected [Function] to throw an error` | ✅ `Tests 22 passed (22)` | ✅ 4 cases: the exact D22 message at `invitations[7].guests[1]`, first-issue-only (asserting `invitations[1]` is NOT named), a missing required field on the row, and a well-formed file still returning its rows | ✅ `issuePath` and `firstIssueMessage` extracted as pure functions |
| 3b.13/3b.14 | same file + `lib/server/invitations.spec.ts` | Unit + Integration (real local Supabase) | ✅ 16/16 and 68/68 | ✅ `expected undefined to be 'Lucho'`; then `"nickname": "Lucho"` vs `null` straight from Postgres | ✅ `Tests 22 passed (22)` and `Tests 69 passed (69)` | ✅ 5 cases: nickname through the parse, through validation (and `null`, never `undefined`, for a guest without one), through the RPC into the row, `seats` rejected on a guest, and `seatsAllowed`/`seats`/`seatCount` rejected on a row | ➖ |

### Test Summary

- **Total tests written**: **43** authored `it(` blocks — 31 in `actions.spec.ts` (one an
  `it.each` over nine actions, counted as 9), 4 in `lib/server/invitations.spec.ts`, 8 in
  `scripts/import-guests.spec.ts`
- **Total tests passing**: **1857** (`Test Files 97 passed (97)`), up from the slice-3a
  baseline of **1812**. Run three consecutive times, 1857 every time
- **Layers used**: Integration 35 (mocked-repository action tests and real-Supabase repository
  tests), Unit 8
- **Pure functions created**: 8 — `issuePath`, `firstIssueMessage`, `importedNickname`,
  `requiredInvitationId`, `text`/`requiredText`/`optionalText`, `flag`

## Work Unit Evidence

| Evidence | Result |
|---|---|
| `npm test` | `Test Files 97 passed (97)`, `Tests 1857 passed (1857)`, exit 0. Three consecutive runs, identical |
| `npm run typecheck` | Clean after two `RegExp` `s`-flag uses were rewritten as `[\s\S]` (`error TS1501`, the project targets below es2018) |
| `npm run lint` | Clean, no output |
| `npm run format:check` | `All matched files use Prettier code style!` (two files were written by Prettier first) |
| `npm run build` | Succeeded; twelve routes compiled, no new route yet — the console UI is slice 4a |
| `npm run e2e` | Run because this slice touches `lib/server/**` and `tools/**`. `114 passed`, **2 failed**, 38 did not run. Both failures reproduce on the STASHED tree: `console-dispatch › names the households that cannot be sent yet` (the knowingly stale readiness counts, task 4b.15) and `console-preview › points the preview image at the URL the crawler will fetch`. Run with `PORT=3123` because the user's own `next dev` holds 3000 and the config refuses to reuse a server it did not build; nothing was killed |
| Cold-start flake | `tools/eslint-zones.spec.ts` passed on every full-suite run. No re-run needed |
| Database survival check | Before: `auth.users` = `lumigu.dev@gmail.com`, `sruiz7541@gmail.com`; `ceremony.couple_names` = `Luis & Michell`. After: identical. `supabase db reset` was NOT run. No `withSenderFixture` row leaked; one `E2E Sender …@example.test` row and one invitation remain from the Playwright harness's own teardown, not from these tests |
| Rollback boundary | Delete the nine exported actions and their eight helpers from `app/console/(authenticated)/actions.ts`, `updateInvitation` and the `nickname` payload key from `lib/server/invitations.ts`, the Zod schemas and `importedNickname` from the importer, the appended `describe` blocks from the three specs, and the single `EXEMPT_PATHS` entry. `updateGuestPhoneAction` and both dispatch actions are untouched. No migration, no schema, no data |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `app/console/(authenticated)/actions.ts` | Modified | +390/−0. Nine new Server Actions — create, update, add/edit/remove/move member, choose recipient, delete, rotate — none owner-scoped, all session-required; eight parse helpers |
| `app/console/(authenticated)/actions.spec.ts` | Modified | +582/−0. 31 new cases across six `describe` blocks; the decision-4 block runs as BETO against ANA's invitation with the owner-scoped lookup answering `null` |
| `lib/server/invitations.ts` | Modified | +83/−0. New `updateInvitation` and `InvitationEdit`; `ImportGuest` gains optional `nickname`; `importedNickname` helper; the RPC payload now sends `nickname` |
| `lib/server/invitations.spec.ts` | Modified | +155/−0. `updateInvitation`'s three cases and the imported-nickname case |
| `scripts/import-guests.ts` | Modified | +75/−1. `importGuestSchema`/`importRowSchema` (both `strictObject`), `issuePath`, `firstIssueMessage`; the unchecked cast at the old `:101` is gone |
| `scripts/import-guests.spec.ts` | Modified | +173/−1. Nine new cases over the Zod parse and the one-way door |
| `tools/no-seats-allowed.spec.ts` | Modified | +31/−9. One exemption, argued in place |
| `openspec/changes/invitation-administration/tasks.md` | Modified | 3b.1–3b.15 marked `[x]` |
| `openspec/changes/invitation-administration/apply-progress.md` | Modified | This section appended; slices 1a, 2a, 2b and 3a are byte-untouched |

## Workload / PR Boundary

- Mode: **chained slice 3b of eight**, one commit per slice, no pull requests
- Current work unit: 3b — Server Actions and the importer
- Boundary: starts at `3b83efe` with a clean tree; ends with the console's whole write surface
  callable and the importer refusing a malformed or old-format file by name. Slice 4a — the
  console routes and the form — is NOT started
- **Authored changed lines: 1,498** — 1,480 insertions and 18 deletions excluding
  `openspec/**`. Against `review_budget_lines: 800` this is **1.9× over. `size:exception` is
  required for this slice**
- **Not committed and not pushed**, as instructed

### Why this slice could not land in 800 lines

`design.md` §6 estimated 3b at ≈510 lines. Facts, not excuses:

1. **Nine Server Actions, not two.** The task list names create, update, four member actions,
   choose-recipient, delete and rotate. At this repository's density — every existing action
   carries a rationale comment explaining what it checks and what it deliberately does not —
   390 source lines for nine surfaces plus eight helpers is the house rate.
2. **The authorization removal had to be proved, not asserted.** Nine writes by a non-owning
   operator, an absence assertion on the owner-scoped lookup, a nine-entry session table, and
   three dispatch refusals are 582 spec lines on their own. A shorter version would have been
   the version that cannot fail.
3. **Two repository gaps had to be closed** (`updateInvitation`, the dropped `nickname` payload
   key), each with its own real-database test.
4. **The importer's one-way door has four spellings and two failure shapes**, and each needs a
   source file built to exhibit exactly one fault.

No comment, test or doc was removed to reach a number, and no compression was attempted beyond
the helper extraction that made the actions readable in the first place.

## Status

84/120 tasks complete (slices 1a, 2a, 2b, 3a and 3b). Slice 1b, 4a and 4b are NOT started.
Ready for verify.

---

# Maintenance Unit: Test Suite Order Independence

**Mode**: Strict TDD — the RED here is a demonstrated failure under
`npx vitest run --sequence.shuffle`, because every failing test already existed.
**Work unit**: `ia-flake-actor-1` — not a slice. `tasks.md` is byte-untouched by this unit.
**Branch**: `feat/whatsapp-wedding-invitations` (base `a7d40e6`, clean tree)
**Prior progress read**: yes — slices 1a, 2a, 2b, 3a and 3b above are byte-untouched.

## Why

`npm test` was green in declaration order and failed roughly 1 run in 10 otherwise. Three
slices remain (1b, 4a, 4b) and a suite that fails by luck makes every one of their
verification reports unreadable.

## RED — reproduction before any change

Ten full shuffled runs, captured in full:

| Run | Result |
|---|---|
| 1 | 1858 passed |
| 2 | 2 failed |
| 3 | 4 failed |
| 4 | 2 failed |
| 5 | 1 failed |
| 6 | 2 failed |
| 7 | 3 failed |
| 8 | 2 failed |
| 9 | 3 failed |
| 10 | 1858 passed |
| 11 | 2 failed |

**8 of 10 runs red, 21 failures total**, across exactly five distinct tests.

## Cluster 1 — `supabase/tests/rsvp-store.spec.ts` (14 of the 21 failures)

**Root cause**: one invitation created in `beforeAll` and shared by every test in the file,
against a table that is append-only by a trigger binding even `service_role`, so no case can
undo what the case before it wrote.

Observed: `reports no answer for a household that has not responded` (6), `cannot be talked
into replacing a row` (5), `returns the newest answer after the household changes its mind` (3).

**Fix**: a fresh household per test — `beforeEach` seeds an invitation and three named members
through the existing `seedInvitation` / `seedGuests` helpers, and `afterAll` tears down every
id it recorded. The sender stays shared because nothing writes to it. The append-only guarantee
was NOT weakened; the two tests that had been reading a sibling's row now write their own
first, so each still asserts exactly what it asserted before.

The hard-coded slug `storeaaaaaaaaaaa` went with it: a per-test household needs a unique slug,
and `seedInvitation` already generates one for the documented reason that parallel workers
collide on the unique index.

## Cluster 2 — `app/console/login/login-form.spec.tsx` (7 of the 21 failures)

**The brief's premise for this cluster was wrong, and the wrong fix was available.** The brief
read it as `findByRole`'s own 1000 ms budget starving under load. Measured instead:

- Instrumented the file with `asyncUtilTimeout: 9000`. Both tests **still failed**, after
  waiting the full nine seconds (file duration 18,983 ms). A longer wait is not the fix.
- Ran the file **alone** under `--sequence.shuffle`, with no competing workers at all:
  **7 of 8 runs red.** Nothing was starved. It is order dependence inside one file.
- The `"A React form was unexpectedly submitted"` string in the dumped markup is React 19's
  normal `javascript:` fallback on a form with a function action. It appears in passing runs
  too, and is not a submission bug.

**Root cause**: `states why the submit button is unavailable while the sign-in is in flight`
submits an action backed by `new Promise(() => {})` and abandons it. React entangles async
transitions across the whole renderer, and `useActionState` dispatches through one — so that
never-settling transition outlives the test and every later `useActionState` commit in the file
queues behind it forever. In declaration order this test runs last and nothing follows it.

Proved deterministically with a two-test probe: pending-forever action first, notice assertion
second → **fails 100% of the time**; release the promise at the end of the first test → passes.

**Fix**: the promise is held rather than abandoned. The in-flight assertions run first and are
unchanged; then `await act(async () => release(IDLE))` settles it before the test ends.

## Cluster 3 — `lib/server/operators.spec.ts`: NOT REPRODUCED, and not fixed

`lowercases the stored address, which the CHECK constraint requires` did not fail once in:

- 25 full shuffled suite runs (10 before the fixes, 15 after)
- 20 shuffled runs of `lib/server/operators.spec.ts` in isolation

The file is already order-independent by construction: `seedInput()` uniquifies every address
with `randomBytes(4)` and `afterEach` drains its own list, deleting both the `senders` row and
the auth user. I found no shared-fixture, absent-row or cross-test coupling in it.

I am not inventing a third story. On the evidence available the single observed failure is most
consistent with the cold-start class `vitest.config.mts` already documents — a first
database-touching test in a worker timing out at 15 s — rather than with order dependence. If it
recurs, the message matters: `Test timed out in 15000ms` is that class, an `AssertionError` is
not, and the full output should be captured before anything is changed.

One latent coupling worth recording without acting on it: `findAuthUserByEmail` in
`lib/server/operators.ts` pages `auth.users` 200 at a time, so this file's behaviour depends on
the total auth population that other spec files are concurrently creating and deleting. Harmless
at the current handful of users; it becomes a real cross-file race above 200.

## Sweep for the same shape elsewhere

- `beforeAll` fixtures in non-e2e specs: only `rsvp-store.spec.ts` (fixed) and
  `operator-session-refresh.spec.ts`. The latter creates one auth user but every test calls
  `staleBrowserCookies()`, which signs in freshly — no test consumes another's session.
- Every other `supabase/tests/**` file goes through `withRollback` or `withSeededData`, both of
  which leave the database as they found it. `ceremony.spec.ts` mutates a singleton table and
  does so inside `withRollback`.
- Abandoned promises: three more in `lib/browser/beacon.spec.ts`, all in the node project with
  no React renderer to entangle. Left alone.
- Module-scope mutable fixtures across `lib/**` and `supabase/tests/**`: three, all reviewed.

## GREEN — after the fixes

| Scope | Before | After |
|---|---|---|
| `login-form.spec.tsx` alone, shuffled | 7 of 8 runs red | **10 of 10 green** |
| `rsvp-store.spec.ts` alone, shuffled | — | **10 of 10 green** |
| `operators.spec.ts` alone, shuffled | — | **20 of 20 green** |
| Full suite, shuffled | 8 of 10 runs red | **23 of 23 green** (15 + 8) |

## Verification

| Command | Observed result |
|---|---|
| `npm test` | exit 0 — 97 files, **1858 passed**, matches the stated baseline |
| `npx vitest run --sequence.shuffle` ×8 | exit 0 every time — 1858 passed; seeds 1789516669890, …681792, …698659, …717756, …738333, …760725, …777519, …794825 |
| `npm run typecheck` | exit 0, no output |
| `npm run lint` | exit 0, no findings |
| `npm run format:check` | exit 0 — "All matched files use Prettier code style!" |
| `npm run build` | exit 0 — 13 routes plus the proxy |

**Database safety**: `select email from auth.users order by email;` returned
`lumigu.dev@gmail.com` and `sruiz7541@gmail.com` before AND after; `select couple_names from
ceremony;` returned `Luis & Michell` before AND after. `supabase db reset` was never run. This
unit left no fixture behind (`rsvp_responses` count 0). One pre-existing leftover from an
earlier e2e run, `E2E Sender 62cf786b`, was already there and was not touched.

**E2E**: out of scope and unaffected. Only two spec files changed; no product source, no schema,
no route, no component.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `supabase/tests/rsvp-store.spec.ts` | Modified | +54/−29. Per-test household via `beforeEach`; two tests write the row they assert on |
| `app/console/login/login-form.spec.tsx` | Modified | +20/−2. Deferred release of the in-flight action, with the entanglement explained in place |
| `openspec/changes/invitation-administration/apply-progress.md` | Modified | This section appended; every earlier batch byte-untouched |

## Workload / PR Boundary

- Mode: maintenance unit, outside the eight-slice chain
- Boundary: starts at `a7d40e6` with a clean tree; ends with the suite green under shuffle.
  No product behaviour is touched, so it reverts by reverting these two files
- **Authored changed lines: 105** (74 insertions, 31 deletions), excluding `openspec/**`.
  Well inside the 800-line ceiling for this unit
- **Not committed and not pushed**, as instructed

## Status

Maintenance unit complete: clusters 1 and 2 fixed and demonstrated; cluster 3 not reproduced in
45 shuffled runs and deliberately left alone rather than changed on a guess.

# Maintenance Unit: Browser Suite Restoration (the E2E half of task 4b.15)

**Mode**: Strict TDD with the RED already standing — both failures were reproduced on the
untouched tree before a single edit, and they are the same two slice 3b reported and knowingly
left behind.
**Work unit**: `ia-e2e-4b15-actor-1` — not a slice. `tasks.md` is byte-untouched by this unit.
**Branch**: `feat/whatsapp-wedding-invitations` (base `3ed8d48`, clean tree)
**Prior progress read**: yes — slices 1a, 2a, 2b, 3a, 3b and the order-independence maintenance
unit above are byte-untouched.

## Why

The browser suite had been red since slice 2b. Slices 3a, 3b and the units after them each
reported "E2E out of scope" and were accepted on that basis, so none of them carries
browser-level evidence. Worse, `playwright.config.ts:76` declares `wedding-facts` with
`dependencies: ["chromium"]`, so **two** chromium failures suspended a further thirty-eight
tests. Two stale assertions were withholding a quarter of the suite.

## RED — measured before any change

`PORT=3123 npm run e2e` on the untouched tree at `3ed8d48`:

| Outcome | Count |
|---|---|
| passed | 114 |
| failed | **2** |
| did not run | 38 |
| **total declared** | **154** |

A note on the brief that commissioned this unit: it stated 152 runnable. The runner declares
`Running 154 tests using 5 workers`, and 114 + 2 + 38 = 154. The figure to beat was 154, and
the unit adds one test, so 155 is the new total.

The 38 were not a separate fault. `console-dispatch.spec.ts` and `console-preview.spec.ts` are
both `mode: "serial"`, so a failure abandons the rest of its group (21 tests), and the suspended
`wedding-facts` project accounts for the other 17.

## Failure 1 — the rename worked exactly as designed

`console-dispatch.spec.ts:132` looked for the heading `"Sin número en la agenda"`. That heading
is gone, and its absence is the mechanism working: slice 2b renamed the preflight's blocker
kinds **because their meaning changed**, and the `recipient_` prefix exists precisely so a stale
assertion cannot keep passing across that change. `no_phone_on_file` asked whether the HOUSEHOLD
held a number; `recipient_has_no_phone` asks whether the CHOSEN PERSON holds one.

So the fixtures were re-derived, not the assertions relaxed:

| Group | Fixture before | Fixture now | What it now proves |
|---|---|---|---|
| `no_recipient_chosen` | *(none — the group was not asserted)* | `Familia Sin Elegir Valencia`, two members, both with mobiles, nobody chosen | The column is never backfilled from `is_primary`: the primary member's mobile is right there and the invitation is blocked anyway |
| `recipient_has_no_phone` | both members phoneless | `Carlos Sin Número` chosen and phoneless, **`Rosa Con Celular` holding a usable mobile** | The household is blocked even though somebody in it is reachable — the exact case the old name got wrong. The group names Carlos and is asserted NOT to name Rosa |
| `recipient_phone_unreachable` | landline household | same, with `Casa Fija` chosen | Unchanged in meaning; the choice is now explicit |
| `recipient_not_in_household` | *(not asserted)* | permanently empty by D23 | The section renders and says it is empty. A group that appeared only when non-empty is indistinguishable from one that stopped being computed |
| `already_dispatched` | `marked_sent` | same, with a recipient chosen | A dispatched household had somebody chosen; the fixture now says so |

The readiness count moved from `1 de 4` to `1 de 5` because the unit adds the
`no_recipient_chosen` fixture. It was re-derived from the five fixtures, not fitted to the
observed output.

## Failure 2 — the fixture, not the product

`console-preview.spec.ts:272` waited 30s for `img.wa-preview__card-image`. The bubble never
rendered because the seeded invitation was blocked on `no_recipient_chosen`: **nobody is
dispatched by default any more**, and the fixture never chose anyone. One line of fixture —
`recipient: "Ana Previa Muñóz"` — and the pane renders. No product file was touched for this.

**Swept for the same shape.** `seedConsoleInvitation` has five callers. Only
`console-dispatch.spec.ts` and `console-preview.spec.ts` reach a surface that resolves a
recipient; `console-guest-list.spec.ts` asserts only that the `Preparar envío` link exists
(the list renders it for every owned row, ready or not), and `console-design.spec.ts` and
`console-wedding.spec.ts` never touch dispatch. `e2e/helpers/seed.ts` is guest-facing and has
no recipient to choose. No other fixture needed the change.

## The helper gained one option and one method

`e2e/helpers/console.ts`:

- `seedConsoleInvitation({ …, recipient?: string })` — names the chosen member. **Omitting it
  is a real state, not a shortcut**: it is the state every imported household starts in.
- `seed.chooseRecipient(fullName)` — the write `chooseRecipient` performs, so one test can watch
  an invitation cross from blocked to sendable. It refuses a name the household does not hold,
  because an unknown name would otherwise write `null` and fail later as "dispatch is blocked",
  which is indistinguishable from the product regressing.

## What this does NOT cover, so slice 4b knows what is left

The E2E half of **4b.15 is done**: dispatch is blocked before a recipient is chosen and
unblocked after, and every readiness-count assertion is re-derived against the five-kind
classification. Slice 4b should not redo it.

What remains is the half this unit could not reach: `chooseRecipientAction` **has no caller**.
The recipient is chosen here through the fixture, because the console offers no affordance to
choose one — that is tasks 4b.1/4b.2 (the `GuestList` recipient indicator and its edit link).
Once that UI lands, 4b.13 should exercise the choice through the form; the blocked/unblocked
transition itself is already covered.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4b.15 (E2E half) | `e2e/console-dispatch.spec.ts` | End-to-end (production build, real Postgres, real operator session) | ✅ 114/154 measured on the untouched tree before the first edit | ✅ `names the households that cannot be sent yet` failed on a heading that no longer exists, with 13 more tests in its serial group abandoned | ✅ all 14 tests in the file green, plus the one this unit adds | ✅ 5 cases: the unchosen group naming every member, the no-phone group naming ONLY the chosen person and asserted not to name the reachable partner, the unreachable group, the D23 group asserted rendered-and-empty, and the already-sent group | ✅ the five per-group locators collapsed into one `group(heading)` helper; green after |
| 4b.15 (blocked → unblocked) | same file | End-to-end | ✅ as above | ⚠️ **written GREEN and proved by mutation instead** — stated plainly rather than claimed. The test and `chooseRecipient` landed together, so the honest RED is the mutation run below | ✅ green. Mutation: suppressing the single `chooseRecipient` call fails it at `expect(locator).toContainText` on `p.dispatch-launcher__recipient`, "element(s) not found" — the second half is not vacuous | ✅ the chosen member is deliberately NOT the `is_primary` one, so the stored choice is the only thing that can decide it | ➖ |
| — (fixture repair) | `e2e/console-preview.spec.ts` | End-to-end | ✅ as above | ✅ `points the preview image at the URL the crawler will fetch` timed out at 30s on `img.wa-preview__card-image`, with 8 more tests abandoned | ✅ all 20 tests in the file green | ➖ one line of fixture; the nine assertions it unblocked are the triangulation | ➖ |

### Test Summary

- **Total tests written**: **1** authored `it(`/`test(` block — the blocked-then-unblocked
  transition. Everything else in this unit is a re-derived assertion or a fixture.
- **Total E2E tests passing**: **155** (`155 passed`), up from `114 passed / 2 failed / 38 did
  not run`. Zero failed, zero did not run.
- **Unit tests**: **1863**, unchanged — this unit adds none and breaks none.
- **Layers used**: End-to-end 3 files.
- **Pure functions created**: 0. One test-local locator helper, `group(heading)`.

## Verification

| Command | Observed result |
|---|---|
| `PORT=3123 npm run e2e` | exit 0 — **155 passed**, 0 failed, **0 did not run** (`Running 155 tests using 5 workers`). Both projects ran: `wedding-facts` is no longer suspended |
| `npm test` | exit 0 — 97 files, **1863 passed**, matches the stated baseline |
| `npm run typecheck` | exit 0, no output |
| `npm run lint` | exit 0, no findings |
| `npm run format:check` | exit 0 — "All matched files use Prettier code style!" |
| `npm run build` | exit 0 — 13 routes plus the proxy |
| `npx vitest run --sequence.shuffle` | **Not run, and that is the correct answer here.** Nothing under `lib/**` or `supabase/tests/**` was touched; the only non-`e2e/**` change is a two-line comment correction in `components/console/DispatchPreflight.tsx` |

**Database safety**: `select email from auth.users order by email;` returned
`lumigu.dev@gmail.com` and `sruiz7541@gmail.com` before AND after; `select couple_names from
ceremony;` returned `Luis & Michell` before AND after. `supabase db reset` was **NOT** run.
`PORT=3123` throughout, because the user's own `next dev` may hold 3000 and the config refuses
to reuse a server it did not build; nothing was killed. Fixture teardown left `dispatch_events`
and `rsvp_responses` at 0; the one leftover `E2E Sender 62cf786b` was already there before this
unit and was not touched.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `e2e/helpers/console.ts` | Modified | +51/−0. `recipient` seed option and `chooseRecipient(fullName)`, the latter refusing a name the household does not hold |
| `e2e/console-dispatch.spec.ts` | Modified | +108/−22. Five fixtures re-derived one per readiness group, all five group assertions rewritten, `1 de 4` → `1 de 5`, one new blocked-then-unblocked test, `noPhone` renamed `chosenHasNoPhone` because its meaning changed |
| `e2e/console-preview.spec.ts` | Modified | +6/−0. The seeded household now names its recipient, with the reason in place |
| `components/console/DispatchPreflight.tsx` | Modified | +2/−2. **Comment only.** Its worked example quoted `"Sin número en la agenda"`, a heading the slice-2b rename removed |
| `openspec/changes/invitation-administration/apply-progress.md` | Modified | This section appended; every earlier batch byte-untouched |

## Workload / PR Boundary

- Mode: maintenance unit, outside the eight-slice chain
- Boundary: starts at `3ed8d48` with a clean tree; ends with the browser suite fully green and
  nothing skipped. No product behaviour is touched — the one product-file line is a comment —
  so it reverts by reverting these four files
- **Authored changed lines: 191** (167 insertions, 24 deletions), excluding `openspec/**`.
  Well inside the 800-line ceiling for this unit
- **Not committed and not pushed**, as instructed. The `gentle-ai` attempt ledger was not touched

## Status

Browser suite restored: **155 passed, 0 failed, 0 did not run**, from 114/2/38. The E2E half of
task 4b.15 is complete and slice 4b should not repeat it; the UI half (4b.1/4b.2, then 4b.13
exercising the choice through the form) is untouched and still owed, because
`chooseRecipientAction` still has no caller.
