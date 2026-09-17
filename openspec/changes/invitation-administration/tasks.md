# Tasks: Invitation Administration

> **Size note**: this document exceeds the skill's generic 530-word budget, for
> the same reason `design.md` exceeds its 800-word budget: the phase brief
> requires every one of the 40 `seats_allowed`-referencing files enumerated by
> name (not "update the affected files"), the sixteen-row Spanish-conjunction
> table treated as its own task, exact DDL/error-text reproduction for the
> composite FK's rejected forms, and RED-before-GREEN for every behavioural
> change under `strict_tdd: true`. Every task line is still one line.

> **Design inventory correction (transparency, not a contradiction)**: `design.md`
> §5 enumerates 39 files across groups B–G but its own summary (and the C3
> corrigendum) states "40 files change" / "11 lib" files. Cross-checking the
> per-directory totals against the actual source (`lib/server/rsvp.spec.ts`,
> not part of any group B–G) closes the gap exactly: its `household()` fixture
> sets `seatsAllowed: 3` and one test constructs a 5-real-member household
> capped at 3 seats — a scenario the derived cap makes structurally impossible.
> That file is added below as the 40th file (1a.19/1a.20). This is a design
> completeness gap I closed by reading the live source, not a design-vs-spec
> disagreement — reported per the phase brief's instruction to flag anything
> the design got wrong before building on it.

> **Preflight order resolution**: the phase brief's prose lists the five
> canonical blocker-kind spellings as `no_recipient_chosen,
> recipient_not_in_household, recipient_has_no_phone,
> recipient_phone_unreachable, already_dispatched`, but only explicitly claims
> `no_recipient_chosen` sorts first — it does not assert a full order. `design.md`
> §7 gives an explicit, unambiguous `PREFLIGHT_BLOCKER_ORDER` array with
> `recipient_not_in_household` FOURTH (before `already_dispatched`, after both
> phone-reachability kinds), matching the D23 rationale that it is
> "permanently empty, ordered fourth". Per this phase's brief, design.md is
> authoritative for exact ordering — used below (2b.5/2b.6, 4b.15).

## Review Workload Forecast

Reproducing `design.md` §6's guard lines verbatim, as required:

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High
```

**The decision has been made** (not left pending): **eight chained slices**,
one feature branch, **one commit per slice, no pull requests** — matching how
`whatsapp-wedding-invitations` shipped its 25 commits. Recorded budget
`review_budget_lines: 800` (`openspec/config.yaml:127`); `delivery_strategy:
ask-on-risk` (`openspec/config.yaml:126`). **No `size:exception` taken.**

| Field | Value |
|-------|-------|
| Estimated changed lines | ≈700 (1a) / ≈110 (1b) / ≈530 (2a) / ≈730 (2b) / ≈750 (3a) / ≈510 (3b) / ≈700 (4a) / ≈570 (4b) |
| 400-line budget risk | High — every slice exceeds 400; only 1b is under 800 by a wide margin |
| 800-line budget risk | Low for all eight — the design's own §6 table confirms 1a/1b (the split halves of a slice design measured at ≈810 whole) and every other slice already fits under 800 |
| Chained PRs recommended | Yes |
| Suggested split | 1a → 1b → 2a → 2b → 3a → 3b → 4a → 4b, strictly sequential (migration → pure domain → repository/actions → UI/E2E) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain, **adapted**: no PRs are opened — one feature branch, one commit per slice, each slice's commit depending on the previous one landing green first |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### The 1a/1b split — why it exists and what it costs

`design.md` §6 states slice 1 alone is ≈810 lines, over the 800-line budget,
and offers an expand/contract split as the escape: **1a** stops every
application read of `seats_allowed` while the column itself stays in the
schema; **1b** is the literal `DROP COLUMN`. The design leaves the exact DDL
for this split unspecified ("if and only if..."); this task list resolves it
as: **1a's migration `0012` drops `seats_allowed`'s `NOT NULL` and its
`between 1 and 12` check but keeps the column present** (nullable, unused),
so every one of the 40 referencing files can stop supplying or reading a
value without a synthetic bridge value. **1b's migration `0013` is then
purely the destructive `DROP COLUMN`** plus its pre-destroy `NOTICE` report
and the data-restoring down script. **This costs one extra migration and one
extra deploy beyond the design's single-`0012` plan.** Its entire purpose is
landing the destructive statement alone, on a tree that is already green
without it — not saving lines (1a is still ≈700, matching the design's own
estimate for that half).

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1a | Migration `0012` (expand) + DB tests; `seats_allowed` removed from every read across 40 files | `npm test -- supabase/tests lib/domain/console-list lib/server/invitations lib/server/rsvp app/i tools/no-seats-allowed` | Local Supabase (docker), `supabase db reset` | `supabase/down/0012_invitation_administration_down.sql`; revert the commit — `seats_allowed` regains `NOT NULL`/check, nothing else changes |
| 1b | Drop `seats_allowed` (migration `0013`) | `npm test -- supabase/tests tools/no-seats-allowed` | Local Supabase (docker) | `supabase/down/0013_drop_seats_allowed_down.sql` — the only slice that is destructive to data; the pre-drop `NOTICE` names any disagreeing row first |
| 2a | `spanish-list`, `guest-name`, `greeting-name` + tests | `npm test -- lib/domain/spanish-list lib/domain/guest-name lib/domain/greeting-name` | N/A — pure functions, zero I/O, Vitest `environment: 'node'` | Delete the three new files; nothing imports them yet |
| 2b | `dispatch-recipient`, `invitation-draft`, `invitation-deletion` + tests; preflight rename; `selectDispatchRecipient` removal | `npm test -- lib/domain/dispatch-recipient lib/domain/dispatch-message lib/domain/dispatch-preflight lib/domain/invitation-draft lib/domain/invitation-deletion` | N/A — pure functions | Delete the three new files; restore `dispatch-message.ts`'s and `dispatch-preflight.ts`'s prior exports |
| 3a | Repository write side + spec | `npm test -- lib/server/invitations` | Local Supabase (docker) for the real-client half of the existing fake/real split | Delete the new repository functions; the prior read-only surface is untouched |
| 3b | Server Actions + spec; importer Zod parse + `nickname`; D21 | `npm test -- app/console scripts/import-guests` | N/A — Server Actions unit-tested via a fake repository | Delete the new Server Actions and the importer's Zod layer |
| 4a | Routes, form component, live derived name, recipient radio + component specs | `npm test -- components/console/InvitationForm` | Local dev server smoke; full E2E deferred to 4b | Delete `app/console/(authenticated)/invitations/**` and `InvitationForm.tsx`; nothing else depends on them yet |
| 4b | `GuestList` recipient indicator, empty-state copy; E2E including re-derived readiness counts | `npm test -- components/console/GuestList lib/domain/console-list` | `PORT=3100 npm run e2e` | Revert `GuestList.tsx`'s new affordances; the E2E suite is the one artifact 4b cannot roll back independently of 4a |

---

## Phase 1a: Migration `0012` (expand) + `seats_allowed` removal from every read (40 files)

> **This is the risky slice.** Every `INVITATION_SELECT` naming `seats_allowed`
> and every seed INSERT breaks the instant the column stops being trustworthy;
> the 40 files below cannot land piecemeal across commits without a knowingly
> red intermediate state, which `strict_tdd: true` forbids. They land together,
> here, in one commit.

- [x] 1a.1 RED — `supabase/tests/dispatch-recipient.spec.ts` (new file): the composite FK refuses a `dispatch_recipient_guest_id` belonging to another invitation and permits one belonging to the same invitation.
- [x] 1a.2 RED — same file: moving a guest who is the chosen recipient clears it; moving a guest who is not leaves it alone.
- [x] 1a.3 RED — same file: dropping `invitation_guests_clear_recipient_on_move` and repeating the move makes the move FAIL with a foreign-key error — proves default `NO ACTION` is the fail-closed backstop so a future `on update` clause cannot slip in unnoticed.
- [x] 1a.4 RED — same file: a move leaves the DESTINATION invitation's recipient untouched (D25 — the choice is cleared, never carried).
- [x] 1a.5 RED — same file: deleting the recipient guest sets the column null; the invitation survives.
- [x] 1a.6 RED — same file: deleting an invitation with a chosen recipient still cascades and succeeds, despite the two opposite-direction FKs (0005's lesson: verified, never assumed).
- [x] 1a.7 RED — same file: `anon` cannot execute `clear_recipient_on_guest_move` (`alter default privileges` never covers FUNCTIONS).
- [x] 1a.8 GREEN — `supabase/migrations/0012_invitation_administration.sql` (expand half of the D-split, see above): relax `invitations.seats_allowed` by dropping its `NOT NULL` and `between 1 and 12` check (column stays; `DROP COLUMN` is deferred to `0013`); add `invitation_guests.nickname`; `invitations.greeting_name_source` (`default 'imported'`, check constraint, D15); `invitation_guests_invitation_id_id_key` unique constraint; `invitations.dispatch_recipient_guest_id` + composite FK (`on delete set null (dispatch_recipient_guest_id)`, MATCH SIMPLE default, deliberately NO `on update` — reproduce the three rejected forms from `design.md` §0.1 probes 1–3 verbatim as SQL comments, D11); `clear_recipient_on_guest_move()` `before update of invitation_id` trigger + its `revoke all on function ... from public, anon, authenticated`; supersede `import_invitations` (D13, never edit `0006`) to accept `nickname` per guest and stop inserting `seats_allowed`. Matching `supabase/down/0012_invitation_administration_down.sql` reversing every addition and restoring `seats_allowed`'s `NOT NULL` + check (not the column, since `0012` never drops it).
- [x] 1a.9 RED — `supabase/tests/seat-parity.spec.ts`: re-derive the cap-source assertions — currently pinning a literal message naming `seats_allowed` — against `count(*)` of `invitation_guests`, keeping the cap-checked-before-parity ordering assertion (D12).
- [x] 1a.10 GREEN — same `0012_invitation_administration.sql`: `create or replace function enforce_seat_cap()` sourcing the cap from `count(*)` of `invitation_guests`, reproducing 0007's two checks and their order verbatim (D12 — cap first, so an over-cap submission fails for the cap's own reason).
- [x] 1a.11 DELETE — `lib/server/invitations.spec.ts:133` (`"rejects a seats_allowed of zero, which the hard cap forbids"`) outright. The rule it tests no longer exists; deleting it is the correct action and must be visible in the diff, not adjusted to pass.
- [x] 1a.12 DELETE, pure deletion — `scripts/import-guests.ts`: remove `SeatMismatch`, `seatMismatches` from `ImportAdvisory`, the mismatch loop in `buildImportAdvisory`, the "Seats:" block in `formatImportAdvisory`, and the `seatsAllowed` doc-comment example. The warning is meaningless once the count *is* the allowance.
- [x] 1a.13 DELETE, pure deletion — `scripts/import-guests.spec.ts`: remove every seat-mismatch test and its fixture helper.
- [x] 1a.14 RED — `tools/no-seats-allowed.spec.ts` (new, follows the `tools/no-source-placeholders.spec.ts` precedent): scans `app/**`, `components/**`, `lib/**`, `scripts/**`, `e2e/**`, `supabase/tests/**` for the literals `seats_allowed`/`seatsAllowed`; asserts zero survive OUTSIDE an explicitly enumerated exemption list. Written now (RED — most of the 40 files still reference it); GREENs only once every task through 1a.29 lands.

  **The exemption list is not a loophole, it is the one file that must name the column to prove it is gone.** `supabase/tests/dispatch-recipient.spec.ts` is exempt, because 1b.1 and 1b.2 assert that `information_schema.columns` no longer lists `invitations.seats_allowed` and that rolling `0013` back recreates it — assertions that cannot be written without the literal. Querying the column name indirectly was rejected: it makes the assertion weaker and unreadable, and the scanner exists to catch a forgotten READ of the column, which that file does not contain. Migrations and down scripts are already outside the scanned globs and stay there; `0013` and its down script must name the column.

  The exemption list MUST be a literal array in the spec file, and the spec MUST assert that every path in it exists on disk — a stale exemption silently re-opens the hole it was carved for. Adding a path to that array is a deliberate edit a reviewer sees, which is the property that distinguishes it from a broadened glob.
- [x] 1a.15 RED — `lib/domain/console-list.spec.ts`: re-derive the 10 sites — `ConsoleListRow.seatsAllowed` → `memberCount`, `ConsoleSummary.seatsAllowed` → `seats`, the `:94` sum assertion becomes a member-count sum (D17).
- [x] 1a.16 GREEN — `lib/domain/console-list.ts`: the 8 sites — `ConsoleListRow.seatsAllowed` → `memberCount`, `ConsoleSummary.seatsAllowed` → `seats`, the accumulator, the `scopedMetrics` line, `assembleConsoleRows`'s mapping to `invitation.guests.length` (D17).
- [x] 1a.17 RED — `lib/server/invitations.spec.ts`: re-derive its remaining 8 sites (the 9th was 1a.11's deletion).
- [x] 1a.18 GREEN — `lib/server/invitations.ts`: the 18 sites — drop `seats_allowed` from `InvitationRow`, `INVITATION_SELECT` (×2), `toRecord` (×2), `createInvitation`'s insert, `importInvitations`'s payload, `InvitationRecord`/`NewInvitation`/`ImportRow` types; delete `MAX_SEATS_ALLOWED` and its `:153-158` validation entirely.
- [x] 1a.19 RED — `lib/server/rsvp.spec.ts` (the design-inventory's missing 40th file — see note above): its `household()` fixture sets `seatsAllowed: 3`, and `"rejects a tampered over-cap submission and writes nothing"` constructs a 5-real-member household capped at 3 seats. DELETE that test outright — a household's cap can no longer be lower than its own real member count, the exact scenario this change removes — and re-derive every other `household()` call site to drop `seatsAllowed`.
- [x] 1a.20 GREEN — `lib/server/rsvp.ts`: remove `RsvpTarget.seatsAllowed`; source the cap from `invitation.guestIds.length` at the `validateRsvpSelection` call site (`:226`); update the `:24-33` doc comment to name `0012`.
- [x] 1a.21 GREEN — `app/i/[slug]/actions.ts` (`:144` `record.seatsAllowed` → `record.guests.length`) and `app/i/[slug]/page.tsx` (`:142`, stop passing the prop). Derivation change; covered by `app/i/[slug]/actions.spec.ts`'s fixture re-derivation (1a.27).
- [x] 1a.22 RED — `components/invitation/InvitationBody.spec.tsx` addendum: body copy naming attendee counts names the invitation's current members instead of a bare seat number (invitation-page spec's "Body copy names the members instead of a seat count" scenario).
- [x] 1a.23 GREEN — `components/invitation/InvitationBody.tsx`: `seatsSentence(seatsAllowed)` → a sentence naming the household's members; the `seatsAllowed` prop leaves `InvitationBodyProps`.

  **REVISADO CON LA PAREJA, y el alcance cambió.** Viendo la pantalla completa
  quedó a la vista que la sección decía a quién va dirigida la invitación CUATRO
  veces: el saludo (`greeting_name`), el encabezado (`display_name`), el conteo
  de miembros y la lista de nombres. El conteo era nuevo; las otras tres ya
  estaban. Se eliminan el encabezado y el conteo: sobreviven el saludo y la
  lista, que es el registro autoritativo de quién está invitado. `display_name`
  sigue existiendo y se sigue usando en la consola y en los nombres de grupo —
  solo deja de renderizarse en la invitación. `memberSentence` no llegó a
  existir en el árbol final.
- [x] 1a.24 COPY CHANGE, no new test invented — `components/invitation/RsvpAnswer.tsx` (`allowanceSpent`/`seatsSelectionSentence` read the member count) and `lib/domain/rsvp-copy.ts` (`seatsSelectionSentence(selected, seatsAllowed)` → `(selected, memberCount)`; guest-facing Spanish reworded from "lugares reservados" to naming the members — exact wording is an open product decision, `design.md` §12).
- [x] 1a.25 COPY CHANGE, no new test invented — `components/console/GuestList.tsx` `:90`/`:93`: "N de M lugares confirmados" / "M lugares" become member-count phrasing.
- [x] 1a.26 GREEN, no RED (test infrastructure) — `e2e/helpers/seed.ts`, `e2e/helpers/console.ts`, `supabase/tests/helpers/db.ts`: remove the `seatsAllowed ?? options.guests.length` option and the column from their INSERTs.
- [x] 1a.27 DELETE, pure fixture deletions (one to four lines each) — `e2e/phone-gate.spec.ts`, `e2e/console-guest-list.spec.ts`, `e2e/console-dispatch.spec.ts`, `e2e/rsvp.spec.ts`, `e2e/console-wedding.spec.ts`, `e2e/console-design.spec.ts`, `e2e/invitation-page-og.spec.ts`, `e2e/console-preview.spec.ts`, `e2e/invariants/rls.spec.ts`, `components/console/ProgressSummary.spec.tsx`, `components/console/GuestList.spec.tsx`, `components/console/DispatchPreflight.spec.tsx`, `components/invitation/RsvpAnswer.spec.tsx`, `components/invitation/InvitationBody.spec.tsx`, `lib/domain/og-card.spec.ts`, `lib/domain/dispatch-preflight.spec.ts`, `app/i/[slug]/actions.spec.ts`, `lib/server/dispatch.spec.ts`, `supabase/tests/rls.spec.ts`: delete every leftover `seatsAllowed`/`seats_allowed` fixture line each now-updated seed helper no longer accepts.
- [x] 1a.28 RED — `supabase/tests/append-only.spec.ts` (`:163`, `:187`) and `supabase/tests/rsvp-store.spec.ts` (`:162`): re-derive the two `/exceeds seats_allowed/` message assertions against 1a.10's new cap-source message.
- [x] 1a.29 GREEN — confirm 1a.28's re-derived assertions pass; adjust only the two fixtures' member counts, never patch the assertion text to the old wording.
- [x] 1a.30 Verify: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`; confirm `tools/no-seats-allowed.spec.ts` (1a.14) is now GREEN; confirm 1a.1–1a.7, 1a.9, 1a.15, 1a.17, 1a.19, 1a.22, 1a.28 RED tests all pass GREEN; run local Supabase and roll `0012` down and back up.

## Phase 1b: Drop `seats_allowed` (migration `0013`, the destructive slice)

- [ ] 1b.1 RED — `supabase/tests/dispatch-recipient.spec.ts` addendum: `information_schema.columns` no longer lists `invitations.seats_allowed`.
- [ ] 1b.2 RED — same file: rolling back `0013` recreates `seats_allowed` `not null` with the `between 1 and 12` check, backfilled from `count(*)`, clamping and logging a `NOTICE` for a synthetic 0-member and >12-member invitation (the down script's two honesty notes).
- [ ] 1b.3 GREEN — `supabase/migrations/0013_drop_seats_allowed.sql`: the "report before destroying" `do $$ ... raise notice ...` block naming any row whose `seats_allowed` already disagreed with its member count, then `alter table invitations drop column seats_allowed;`. Matching `supabase/down/0013_drop_seats_allowed_down.sql`: recreate the column, backfill from `count(*)` clamped to `[1, 12]` with a `NOTICE` per out-of-range row, restore the `between 1 and 12` check and `NOT NULL`, and restore 0007's original `enforce_seat_cap` body verbatim (not 0012's).
- [ ] 1b.4 Verify: `npm test`, `0012` and `0013` rolled fully down and back up in order, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

## Phase 2a: Spanish naming — `spanish-list`, `guest-name`, `greeting-name`

- [x] 2a.1 RED — `lib/domain/spanish-list.spec.ts`: the full sixteen-row conjunction table (Luzma, Ana, Elena, Inés, Ignacio, Isabel, Hilda, Íñigo, Ian, Yolanda, Hierro, Iván, Irene, ÍÑIGO/íñigo, NFD Íñigo, `"  Inés"`), plus arity 0 (throws), 1, 3, 4 with an explicit no-Oxford-comma assertion.
- [x] 2a.2 GREEN — `lib/domain/spanish-list.ts`: `spanishConjunction(nextItem)` and `joinSpanishList(items)` per `design.md` §4 — NFC-normalize + trim before the /i/ hiatus-vs-diphthong test; the module comment states the `o→u` disjunction and sentence-initial interrogative exception are deliberately NOT implemented.
- [x] 2a.3 RED — `lib/domain/guest-name.spec.ts`: `firstName`, `soloAddressName` (`nickname ?? fullName`), `listMemberName` (`nickname ?? firstName(fullName)`) — the SAME guest (`{fullName:"Luis Guzmán", nickname:null}`) MUST yield `"Luis Guzmán"` solo and `"Luis"` in a list, asserted together.
- [x] 2a.4 GREEN — `lib/domain/guest-name.ts`: `NameableGuest`, `firstName`, `soloAddressName`, `listMemberName` per `design.md` §4.
- [x] 2a.5 RED — `lib/domain/greeting-name.spec.ts`: `deriveGreetingName` — one member (solo fallback), three members (list fallback + conjunction), empty list THROWS; `resolveGreetingName` at `'custom'` returns the stored string untouched AND at `'derived'` recomputes from current members, asserted together.
- [x] 2a.6 GREEN — `lib/domain/greeting-name.ts`: `GreetingNameSource`, `deriveGreetingName` (throws on `[]`), `resolveGreetingName` per `design.md` §4.
- [x] 2a.7 Verify: `npm test -- lib/domain/spanish-list lib/domain/guest-name lib/domain/greeting-name`, `npm run typecheck`, `npm run lint` (confirm `domainImportZone` accepts all three with zero I/O/React imports).

## Phase 2b: `dispatch-recipient`, `invitation-draft`, `invitation-deletion`; preflight rename

- [x] 2b.1 RED — `lib/domain/dispatch-recipient.spec.ts`: `resolveDispatchRecipient` — no id chosen → `no_recipient_chosen`; a valid dispatchable choice → `ok` (asserted together); a chosen id absent from the household → `recipient_not_in_household`; no stored phone → `recipient_has_no_phone`; a landline → `recipient_phone_unreachable`.
- [x] 2b.2 GREEN — `lib/domain/dispatch-recipient.ts`: `IdentifiedDispatchGuest`, `DispatchRecipientProblem`, `DispatchRecipientOutcome`, `resolveDispatchRecipient` per `design.md` §4 — plain arrays, trusts no caller invariant.
- [x] 2b.3 RED — `lib/domain/dispatch-message.spec.ts` addendum: `selectDispatchRecipient`, `DispatchRecipientProblem`, `DispatchRecipientOutcome` are asserted ABSENT from the module's exports.
- [x] 2b.4 GREEN — `lib/domain/dispatch-message.ts`: delete `selectDispatchRecipient`, `DispatchRecipientProblem`, `DispatchRecipientOutcome`; `DispatchCandidateGuest` gains `readonly id: string`.
- [x] 2b.5 RED — `lib/domain/dispatch-preflight.spec.ts`: re-derive against the renamed, reordered kinds — `no_recipient_chosen` sorts first; `recipient_has_no_phone`; `recipient_phone_unreachable`; `recipient_not_in_household` FOURTH, synthesized directly via `resolveDispatchRecipient`'s plain-array signature even though the FK makes it DB-unrepresentable (D23) — this proves all FIVE kinds sort correctly, not just four, closing advisory finding `R3-ordering-scenario-omits-fifth-kind`; `already_dispatched` unchanged, last.
- [x] 2b.6 GREEN — `lib/domain/dispatch-preflight.ts`: `PREFLIGHT_BLOCKER_ORDER` per `design.md` §7's five-kind array (`no_recipient_chosen`, `recipient_has_no_phone`, `recipient_phone_unreachable`, `recipient_not_in_household`, `already_dispatched`); `classify()` collapses to a pass-through now that `PreflightBlockerKind` equals `DispatchRecipientProblem | "already_dispatched"`; rewrite `GROUP_COPY`'s two renamed entries and add the two new Spanish entries — the existing `"Nadie de estas invitaciones tiene un número guardado"` is false under the new meaning and must not survive.
- [x] 2b.7 RED — `lib/domain/invitation-draft.spec.ts` (`validateInvitationDraft`): zero members → `no_members`; a blank member name → `member_without_name`; a duplicate member id → `duplicate_member_id`; a chosen recipient not among the draft's members → `recipient_not_a_member`; a blank custom name at `source='custom'` → `custom_name_empty`; a duplicate nickname → the `duplicate_nickname` ADVISORY, never a refusal; a chosen recipient with no/unreachable phone → advisories, not refusals. Every refusal paired with its permitting case in the same test.
- [x] 2b.8 GREEN — `lib/domain/invitation-draft.ts`: `InvitationDraftMember`, `InvitationDraft`, `DraftRefusal`, `DraftAdvisory`, `DraftValidation`, `validateInvitationDraft` per `design.md` §4.
- [x] 2b.9 RED — `invitation-draft.spec.ts` addendum (`canMoveMember`): a two-member source refuses `would_empty_source`; a three-member source allows the move, reporting `clearsSourceRecipient: true` only when the moved guest is the chosen recipient; same-invitation move refuses `same_invitation`; a member absent from the source refuses `member_not_in_source` — refusal/permission asserted together (D25).
- [x] 2b.10 GREEN — `lib/domain/invitation-draft.ts`: `MoveRefusal`, `MoveOutcome`, `canMoveMember` per `design.md` §4 — runs entirely before any SQL is issued.
- [x] 2b.11 RED — `invitation-draft.spec.ts` addendum (`classifyMembershipChangeImpact`): a removed member named in a confirmed RSVP → reported in `contradictedAnswers` with its `danglingGuestIds`; a removed member NOT named in the RSVP → no advisory; an RSVP naming only current members → no advisory.
- [x] 2b.12 GREEN — `lib/domain/invitation-draft.ts`: `ContradictedAnswer`, `MembershipChangeImpact`, `classifyMembershipChangeImpact` per `design.md` §4 (D19).
- [x] 2b.13 RED — `lib/domain/invitation-deletion.spec.ts`: `canDeleteInvitation([])` → `ok`; any `dispatch_events` row — including `link_opened` alone and `marked_failed` alone — refuses with the triggering `eventKinds` named (permitting/refusing pair asserted together).
- [x] 2b.14 GREEN — `lib/domain/invitation-deletion.ts`: `DeletionRefusal`, `DeletionOutcome`, `canDeleteInvitation` per `design.md` §4.
- [x] 2b.15 Verify: `npm test -- lib/domain/dispatch-recipient lib/domain/dispatch-message lib/domain/dispatch-preflight lib/domain/invitation-draft lib/domain/invitation-deletion`, `npm run typecheck`, `npm run lint`; confirm zero remaining references to `selectDispatchRecipient` anywhere in source.

## Phase 3a: Repository write side

- [x] 3a.1 RED — `lib/server/invitations.spec.ts` addendum: `createInvitation` calls `validateInvitationDraft` before writing and refuses (no invitation created) on any `DraftRefusal`; a valid draft creates the invitation and its members via ONE write path for both a solo guest and a group.
- [x] 3a.2 GREEN — `lib/server/invitations.ts`: `createInvitation(draft)` validates via `validateInvitationDraft`, inserts the invitation with `greeting_name` + `greeting_name_source` written together from this ONE function (`design.md` §8), then inserts every member.
- [x] 3a.3 RED — same file: **D21** — when the guest insert fails AND the compensating delete of the orphaned invitation ALSO fails, the thrown message names BOTH failures plus the orphaned invitation's `id` and `slug` — not only the guest-insert failure (today's bug at `:398`).
- [x] 3a.4 GREEN — `lib/server/invitations.ts`: capture the compensating delete's `error`; when non-null, throw a message naming both failures and the orphaned id/slug (D21). Placed here rather than `design.md`'s 3b line because the fix lives in the same function `3a.2` rewrites — splitting it into a separate commit would touch the same lines twice.
- [x] 3a.5 RED — same file: `addMember`/`editMember`/`removeMember` — removing the LAST member is refused, pointing at deletion; removing from a two-or-more-member invitation succeeds (paired).
- [x] 3a.6 GREEN — `lib/server/invitations.ts`: `addMember`, `editMember`, `removeMember` calling `validateInvitationDraft`'s member-count check before any write.
- [x] 3a.7 RED — same file: `moveMemberToInvitation` on a two-member source is refused via `canMoveMember` and issues NO write at all — a fake repository client records zero calls (D25's ordering guarantee).
- [x] 3a.8 GREEN — `lib/server/invitations.ts`: `moveMemberToInvitation` calls `canMoveMember` before issuing SQL; only a passing move updates `invitation_guests.invitation_id`, letting `clear_recipient_on_guest_move()` clear the source recipient (D11/D25).
- [x] 3a.9 RED — same file: an integration test proving the last-member refusal runs BEFORE any greeting-name re-derivation on `removeMember`/`moveMemberToInvitation`, so `deriveGreetingName([])` is unreachable through the real write path (closes advisory finding `R3-zero-member-derivation-throw`).
- [x] 3a.10 GREEN — order `removeMember`/`moveMemberToInvitation` so the member-count refusal always precedes any greeting-name re-derivation call.
- [x] 3a.11 RED — same file: `chooseRecipient` accepts a guest belonging to the SAME invitation; a guest belonging to a DIFFERENT invitation is refused by the composite FK, and the stored recipient is unchanged.
- [x] 3a.12 GREEN — `lib/server/invitations.ts`: `chooseRecipient(invitationId, guestId)` writing `dispatch_recipient_guest_id`.
- [x] 3a.13 RED — same file: `deleteInvitation` succeeds with zero `dispatch_events` rows and is refused (naming the offending `eventKinds`) for any dispatch history alone, including `link_opened` and `marked_failed` (paired).
- [x] 3a.14 GREEN — `lib/server/invitations.ts`: `deleteInvitation` calls `canDeleteInvitation` before issuing the hard delete.
- [x] 3a.15 RED — same file: `rotateInvitationSlug` mints a new slug via the existing `mintSlug()`, sets `slug_rotated_at = now()` and `og_warmed_at = null`, and triggers a re-warm of the new URL.
- [x] 3a.16 GREEN — `lib/server/invitations.ts`: `rotateInvitationSlug(client, invitationId)` per D16.
- [x] 3a.17 Verify: `npm test -- lib/server/invitations`, `npm run typecheck`, `npm run lint`.

## Phase 3b: Server Actions; importer Zod parse + `nickname`

- [x] 3b.1 RED — `app/console/(authenticated)/actions.spec.ts` addendum: sender B, authenticated but not owning invitation X, may create a new invitation and edit, move members on, and delete invitation X exactly as owning sender A could; dispatch itself (`markDispatchSentAction`/`markDispatchFailedAction`) remains gated by ownership + device declaration, unchanged.
- [x] 3b.2 GREEN — `app/console/(authenticated)/actions.ts`: `createInvitationAction`/`updateInvitationAction` — thin: parse, call `validateInvitationDraft`/`lib/server/invitations.ts`, revalidate the console list path; apply NO ownership check.
- [x] 3b.3 RED — same file: `addMemberAction`/`editMemberAction`/`removeMemberAction`/`moveMemberAction` each require an operator session (no ownership check) and call the corresponding repository function; `removeMemberAction`'s return surfaces `classifyMembershipChangeImpact`'s advisories.
- [x] 3b.4 GREEN — `app/console/(authenticated)/actions.ts`: wire the four member actions.
- [x] 3b.5 RED — same file: `chooseRecipientAction` refuses a guest id not present in the invitation's current members and accepts a valid member id.
- [x] 3b.6 GREEN — `app/console/(authenticated)/actions.ts`: `chooseRecipientAction`.
- [x] 3b.7 RED — same file: `deleteInvitationAction` refuses with the same `eventKinds`-naming message `canDeleteInvitation` returns, succeeds for a zero-history invitation, and its refusal offers slug rotation as the alternative.
- [x] 3b.8 GREEN — `app/console/(authenticated)/actions.ts`: `deleteInvitationAction`.
- [x] 3b.9 RED — same file: `rotateSlugAction` returns the new slug and does not alter `dispatch_events`.
- [x] 3b.10 GREEN — `app/console/(authenticated)/actions.ts`: `rotateSlugAction`.
- [x] 3b.11 RED — `scripts/import-guests.spec.ts`: a malformed source row is reported via a Zod `safeParse` naming only the FIRST issue, as `data/guests.source.json → invitations[7].guests[1].full_name: expected string, received number` (D22).
- [x] 3b.12 GREEN — `scripts/import-guests.ts`: replace `return invitations as ImportRow[]` with a Zod `safeParse` over `z.array(importRowSchema)`, reporting only the first issue (D22).
- [x] 3b.13 RED — same file: a new-format row carrying `nickname` and no seats column imports successfully; an old-format row carrying a seats column and no `nickname` column is REJECTED by validation, not silently accepted with the seats column ignored — closes advisory finding `R3-old-format-import-rejection-unproved`.
- [x] 3b.14 GREEN — `scripts/import-guests.ts`, `validateImportRow`, `NewInvitation`/`ImportRow` types: accept optional `nickname` per guest row; reject any row carrying a seats/seat-count column.
- [x] 3b.15 Verify: `npm test -- app/console scripts/import-guests`, `npm run typecheck`, `npm run lint`, `npm run build`; confirm the "seats-versus-names advisory no longer exists" scenario already holds from 1a.12's deletion.

## Phase 4a: Console routes, form component, live derived name

- [x] 4a.1 RED — `components/console/InvitationForm.spec.tsx`: typing a nickname updates the live derived-name preview (calling `deriveGreetingName`/`resolveGreetingName` via the SAME import the server uses, D14); touching the name field flips the source to `'custom'`; the reset control returns it to `'derived'`; on mount, NO recipient radio option is pre-selected.
- [x] 4a.2 GREEN — `components/console/InvitationForm.tsx` (`'use client'`): member rows (name, nickname, phone, remove), the group-name field with live preview, the recipient radio group with no default selection, the reset-to-derived control — importing `lib/domain/greeting-name.ts` directly, no duplication (D14).
- [x] 4a.3 RED — same file addendum: saving a draft with zero members is refused with an explanation and creates nothing; saving with a chosen recipient not among the current members is refused (`recipient_not_a_member`); a duplicate nickname saves successfully with a visible advisory.
- [x] 4a.4 GREEN — wire `InvitationForm.tsx`'s submit to call `validateInvitationDraft` client-side for immediate feedback, then the Server Action for the authoritative check.
- [x] 4a.5 GREEN — `app/console/(authenticated)/invitations/new/page.tsx`: renders `InvitationForm` in create mode, inside the `(authenticated)` route group so `requireOperator()` and the device gate already apply. Async Server Component — Vitest cannot unit-test it (project constraint); its behaviour is proved by 4b's E2E, not an invented unit test here.
- [x] 4a.6 GREEN — `app/console/(authenticated)/invitations/[id]/edit/page.tsx`: loads the invitation, its current members, and its dispatch recipient, then renders `InvitationForm` in edit mode — ONE form, no mode switch.
- [x] 4a.7 RED — `InvitationForm.spec.tsx` addendum: editing a DISPATCHED invitation whose `greeting_name_source` is `'derived'` shows the warning that the already-delivered message keeps the old name.
- [x] 4a.8 GREEN — `components/console/InvitationForm.tsx`: render the post-dispatch-derived-name warning when the loaded invitation has `greeting_name_source === 'derived'` and at least one `dispatch_events` row.
- [x] 4a.9 RED — same file addendum: the member-management UI refuses removing/moving the last member with the message pointing at deletion, and permits it on a multi-member invitation (paired).
- [x] 4a.10 GREEN — wire `InvitationForm.tsx`'s member remove/move controls to preview `canMoveMember`'s outcome client-side, surfacing the same refusal text the Server Action returns.
- [x] 4a.11 RED — same file addendum: overriding the group name records the source as custom and shows the live derived name BESIDE the custom one, always — never string-matched against a removed member.
- [x] 4a.12 GREEN — `InvitationForm.tsx`: render the live-derived preview permanently alongside a custom name; never attempt to infer whether the custom text still mentions a removed member.
- [x] 4a.13 Verify: `npm test -- components/console/InvitationForm`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Phase 4b: `GuestList` recipient indicator, empty state; E2E

- [ ] 4b.1 RED — `components/console/GuestList.spec.tsx` addendum: the chosen dispatch recipient is visually distinguished on its row; an invitation with NO recipient chosen shows that plainly rather than omitting the indicator silently.
- [ ] 4b.2 GREEN — `components/console/GuestList.tsx`: render the recipient indicator per row, with an edit affordance linking to `/console/invitations/[id]/edit`.
- [ ] 4b.3 RED — same file addendum: a "create invitation" affordance is present and reachable from the list without leaving the console.
- [ ] 4b.4 GREEN — `components/console/GuestList.tsx`: add the create-invitation link to `/console/invitations/new`.
- [ ] 4b.5 RED — same file addendum: the empty-state copy does NOT claim invitations are loaded exclusively through the importer, and instead points the operator at creating one from the console.
- [ ] 4b.6 GREEN — `components/console/GuestList.tsx`: rewrite the empty-state copy.
- [ ] 4b.7 RED — `lib/domain/console-list.spec.ts` addendum: `ConsoleSummary.contradictedAnswers` counts invitations whose stored RSVP names a since-removed member, rendered via the existing `countSentence` shape (D24).
- [ ] 4b.8 GREEN — `lib/domain/console-list.ts`: add `contradictedAnswers: number` to `ConsoleSummary`'s accumulation.
- [ ] 4b.9 RED — `components/console/GuestList.spec.tsx` addendum: a row whose invitation has a contradicted answer shows a visible inconsistency badge; a row whose RSVP names only current members shows none.
- [ ] 4b.10 GREEN — `components/console/GuestList.tsx`: render the row-level inconsistency badge from `classifyMembershipChangeImpact`'s output.
- [ ] 4b.11 RED — same file addendum: a rendered RSVP attendee list resolves each id against current members and renders an unresolved id as removed — neither crashing nor silently shortening the answer.
- [ ] 4b.12 GREEN — wire the resolution from 4b.11 wherever `attendee_guest_ids` is rendered in the console.
- [ ] 4b.13 RED — `e2e/console-guest-list.spec.ts` addendum: create a group through the console, watch the derived name appear as nicknames are typed, override it, add a member, and confirm the override survived; the recipient indicator and the create/edit affordances are reachable and functional.
- [ ] 4b.14 GREEN — confirm the wiring from 3a/3b/4a satisfies 4b.13; adjust only fixtures.
- [ ] 4b.15 RED — `e2e/console-dispatch.spec.ts` addendum: dispatch is blocked before a recipient is chosen and unblocked after; every readiness-count assertion is RE-DERIVED against the new five-kind classification — `no_recipient_chosen` first, `recipient_has_no_phone`, `recipient_phone_unreachable`, `recipient_not_in_household` (permanently empty, D23), `already_dispatched` last — do not adjust numbers until green.
- [ ] 4b.16 GREEN — confirm 3a/3b/4a's wiring satisfies 4b.15; adjust only fixture readiness counts.
- [ ] 4b.17 RED — new `e2e/console-invitation-lifecycle.spec.ts`: deletion is refused on a dispatched invitation and slug rotation is offered instead; rotating makes the old URL resolve to the friendly unknown-slug page and the path-scoped unlock cookie unusable there, while the new URL requires the phone gate again.
- [ ] 4b.18 GREEN — wire the rotation UI's confirmation copy so it MUST NOT claim the cached preview card is removed or updated (slug-rotation spec).
- [ ] 4b.19 Verify: `npm test`, `PORT=3100 npm run e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`; confirm `tools/no-seats-allowed.spec.ts` (1a.14) is still green.
