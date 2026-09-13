# Proposal: Invitation Administration

**Change**: `invitation-administration` | **Store**: hybrid | **Phase**: sdd-propose
**Inputs**: `openspec/changes/invitation-administration/exploration.md`; Engram `wedding/invitation-admin-requirements` (#1665), `wedding/invitation-admin-decisions` (#1667), `wedding/product-decisions` (#1555), `wedding/wu6a-ii-console-list` (#1651), `wedding/gate-security` (#1638).
**Extends**: `openspec/changes/whatsapp-wedding-invitations/design.md`. Data layer stays Supabase; WhatsApp Cloud API stays ruled out (`rules.proposal`).

## Intent

Invitations enter the system through exactly one door: `scripts/import-guests.ts`. The console can write exactly one field, `updateGuestPhone`. The couple cannot create a household, cannot name a group, cannot add a late guest, cannot fix a mistaken import, and cannot say which member of a group should receive the WhatsApp — the code picks the first member with a phone.

This change gives them a real administrator: create, edit, move, and delete invitations and their members; a group name that defaults to the members' names in correct Spanish and can be overridden; and an explicitly chosen dispatch recipient, so no guest is ever messaged by default.

**A group IS an invitation.** A guest in no group is an invitation with one member. That model is unchanged and not up for revision.

Success: the couple runs the guest list from the console without opening a terminal, every dispatch goes to a person someone chose, and a mistaken invitation has a real exit.

## Scope

### In Scope

| # | Deliverable |
|---|---|
| 1 | Migration `0012` + down script: `invitation_guests.nickname text null`; `invitations.greeting_name_source text not null default 'imported' check (in ('derived','custom','imported'))`; `invitations.dispatch_recipient_guest_id uuid null` held by a **composite FK** (R1); `unique (invitation_id, id)` on `invitation_guests`; **drop `invitations.seats_allowed`**. |
| 2 | `enforce_seat_cap` rewritten to source the cap from `count(*)` of `invitation_guests`; the 0007 parity rule (`cardinality(attendee_guest_ids) = seats_confirmed`) and its evaluation order are preserved verbatim. |
| 3 | Pure domain: `spanish-list.ts`, `guest-name.ts`, `greeting-name.ts`, `dispatch-recipient.ts`, `invitation-draft.ts`, `invitation-deletion.ts`. No I/O, no React, `environment: 'node'`, zero mocking. |
| 4 | Repository writes and Server Actions: create, update, add/edit/remove member, move member, choose recipient, delete invitation, rotate slug. |
| 5 | Console UI: `/console/invitations/new` and `/console/invitations/[id]/edit` — one form, no mode switch; live derived name recomputed client-side from the **same** pure function; recipient radio with **no default selected**; recipient indicator and edit affordance in `GuestList.tsx`; corrected empty-state copy. |
| 6 | **Slug rotation**, implemented against the existing `slug_rotated_at` — the exit for "dispatched by mistake". |
| 7 | Importer keeps working and gains `nickname`; source format changes (one-way door). `scripts/import-guests.ts`, `validateImportRow`, `NewInvitation`, migration `0006`. `buildImportAdvisory`'s seats-versus-names warning is deleted as meaningless. |
| 8 | `classifyMembershipChangeImpact` — allow the edit, detect the inconsistency, report it as a row badge and a dashboard group. |
| 9 | Owner scoping removed from console **writes**. Dispatch stays gated by the per-device WhatsApp declaration. |

### Out of Scope

- Soft delete. Migration `0005` rejected it by name; a second definition of "exists" must be honoured by the gate, the OG image, `generateMetadata`, the list, the preflight, and the RSVP write, and the one that forgets leaks a removed invitation to a guest.
- Correcting stored `rsvp_responses`. Append-only holds, including against `service_role`. Appending a corrective RSVP on the couple's behalf is rejected: it would record that *the guest* changed their answer when the couple did.
- Foreign-keying `attendee_guest_ids`. Postgres cannot FK array elements; a junction table is a rewrite of an append-only table.
- `o → u` disjunction, and the sentence-initial interrogative exception. This function joins proper nouns inside a phrase and never produces a disjunction. Both exclusions belong in the module doc comment so nobody adds them "for completeness".
- A third operator, a role model, permissions, or an edit audit trail. Two trusted humans.
- Notifying guests that a slug rotated. Invalidating Meta's cached card for the old URL — impossible.
- Re-warming OG cards on every greeting-name edit.

## Capabilities

> `openspec/specs/` is **empty**: `whatsapp-wedding-invitations` has shipped 25 commits but is **not archived**. `sdd-spec` must read the baseline from `openspec/changes/whatsapp-wedding-invitations/specs/<name>/spec.md` and write deltas against those, not against `openspec/specs/`.

### New Capabilities

- `guest-naming`: Spanish list joining with the `y`/`e` conjunction rule, solo-versus-list-member name fallbacks, `deriveGreetingName`, `resolveGreetingName`.
- `invitation-administration`: console create/edit/delete of invitations, member add/edit/remove/move, refusals, advisories, membership-change impact.
- `dispatch-recipient`: explicit recipient choice, its storage, and the preflight semantics that follow.
- `slug-rotation`: rotating a dispatched invitation's slug, and what survives rotation.

### Modified Capabilities

- `guest-directory`: `nickname`; `greeting_name_source`; `dispatch_recipient_guest_id`; **`seats_allowed` removed**; importer source format.
- `dispatch-console`: owner scoping removed on writes; preflight blockers change **meaning**, not only shape; recipient indicator; create/edit surfaces.
- `rsvp`: the seat cap is derived from the member count; the form caps at named members; membership changes may contradict a stored answer.
- `invitation-domain`: `selectDispatchRecipient` is removed and replaced by `resolveDispatchRecipient(guests, chosenGuestId)`.
- `invitation-page`: body copy that names a seat count now names members; the greeting name may re-derive after dispatch.

## Approach

**Change the write side; leave the read side alone.** `greeting_name` stays materialized so the crawler path still reads one column with no join, and a sibling `greeting_name_source` makes "should this re-derive?" a *stored fact* rather than a guess at write time.

The two load-bearing moves are both of the make-it-unrepresentable kind this project already values — the same instinct as `assembleConsoleRows`, which made double-counting unrepresentable rather than guarded:

1. **Composite foreign key (R1).** `foreign key (id, dispatch_recipient_guest_id) references invitation_guests (invitation_id, id) on delete set null (dispatch_recipient_guest_id) on update set null (dispatch_recipient_guest_id)`. A cross-household recipient becomes unrepresentable; deleting the guest clears the choice; **moving** the guest changes `invitation_guests.invitation_id`, trips `on update`, and clears the choice, so the invitation falls back to a state the preflight already reports. Nothing to remember in application code. Verified available: the deployed Postgres is **17.6**, above the 15 the column-list `SET NULL` form requires; R2 is no longer needed as a fallback.
2. **`greeting_name_source` defaults to `'imported'`, never `'derived'`.** A `'derived'` default would mark every imported row derivable, and the first membership edit would silently overwrite a hand-written "Familia Restrepo".

`resolveDispatchRecipient` returns one of `no_recipient_chosen | recipient_not_in_household | recipient_has_no_phone | recipient_phone_unreachable | ok`. `recipient_not_in_household` is kept even though R1 makes it unrepresentable in the database, because the function takes plain arrays and a function that trusts its caller for an invariant is one refactor from being wrong. `no_recipient_chosen` goes **first** in `PREFLIGHT_BLOCKER_ORDER`.

**The Spanish rule, verified against the RAE, not from memory.** `y → e` before a word whose first **sound** is /i/. The discriminator is **diphthong versus hiatus**, not spelling: *hija* is hiatus → `e hija`; *hielo* is a diphthong → `y hielo`. *Hierro* and *hielo* are the **same case** — both `hie-`, both diphthongs, both take **y**. Implementable rule: emit `e` when the name begins `i`/`í`/`hi`/`hí` **and** the next letter is a consonant or the name ends there; otherwise `y`, including for `y-` initial names, which are /ʝ/. Normalize to NFC and trim before testing. No Oxford comma — Spanish does not take one, and a test must say so because an English-speaking contributor will add one.

**`seats_allowed` removal is the largest simplification and it deletes a refusal.** 0007 already makes `seats_confirmed = cardinality(attendee_guest_ids)`, and `submitRsvp` already requires every attendee to be a named member, so an *unnamed* seat is already unconfirmable. A cap above the member count reserves seats nobody can take; below it, names a person who can never be seated. Adding a plus-one becomes adding a named member — which is what the couple does anyway. Because the field is gone, the "refuse to lower `seats_allowed` below the confirmed count" rule disappears entirely: membership changes are **allowed, detected, and reported**, and there is no second refusal to write. The reach is wide — **53 files** reference `seats_allowed`/`seatsAllowed` today, including `lib/domain/seats.ts`, `components/invitation/RsvpAnswer.tsx`, `components/invitation/InvitationBody.tsx`, `supabase/tests/seat-parity.spec.ts` and six E2E specs.

**Form.** One route pair, one write path, one validation function, one derivation site. The form *is* the model: one member row is a solo guest, three is a group; no mode switch, so no UI can disagree with "a group is an invitation". The inline phone editor stays inline, where it already works.

**Sequencing** (also the dependency order): migration → pure domain → repository and Server Actions → console UI and E2E.

## Confirmed Decisions Applied (do not re-derive)

| # | Decision |
|---|---|
| 1 | A member with no nickname contributes their **first name only** — "Lucho, Luzma y Luis". |
| 2 | The dispatch recipient is **always explicit**; `selectDispatchRecipient`'s auto-pick is removed. |
| 3 | `seats_allowed` is **derived from the member count and the column is dropped**. |
| 4 | **Both operators may create and edit any invitation.** Dispatch stays gated by the per-device declaration. |
| 5 | **Slug rotation is in scope** as the exit for "dispatched by mistake". |
| 6 | The **importer survives and gains nicknames**; its source format changes — a one-way door. |
| 7 | A `'derived'` name **does** re-derive after dispatch; the delivered message keeps the old name and the UI must say so. |
| 8 | **Any** `dispatch_events` row blocks deletion, including `link_opened` and `marked_failed`. |
| 9 | `greeting_name_source` backfills to a distinct `'imported'`. |
| 10 | Two members sharing a nickname is an **advisory**, not a refusal. |
| 11 | Moving or deleting the **last** member **refuses** and points at deleting the invitation; `deriveGreetingName([])` **throws**. |
| 12 | `is_primary` is retained for **sort order only**, never as a recipient signal. Do not backfill the recipient from it. |

## Assumptions (adopted defaults — the couple may overturn any of these)

| # | Assumption |
|---|---|
| B1 | A solo guest's `greeting_name` derives from the same functions: nickname if present, else full name. |
| B2 | The derived name recomputes client-side as nicknames are typed, importing the **same** pure function — two runtimes, one function, no drift. |
| B3 | Touching the group-name field sets `source = 'custom'`; a reset button sets it back to `'derived'`. The live derived name is shown beside a custom one, always — never string-match a custom name to guess whether it mentions a removed member. |
| B4 | `nickname` is optional free text with no uniqueness constraint; duplicates inside one group raise an advisory. |
| B5 | `display_name` stays a separate stored column, distinct from `greeting_name`. |
| B6 | Deleting a guest who appears in a stored RSVP is **permitted**; the impact is reported, never repaired. |
| B7 | Rotating a slug invalidates the path-scoped unlock cookie, so that guest must re-unlock. No revocation list is needed — this is why the cookie was path-scoped. |
| B8 | Rotation does **not** delete `dispatch_events`, so a rotated invitation stays undeletable. |
| B9 | A removed-but-confirmed advisory persists until the couple acts. No auto-expiry, no auto-dismiss. |
| B10 | No edit audit trail. Two trusted operators. |
| B11 | The preflight's phone blocker kinds are **renamed** with `recipient_` prefixes, because a kind whose meaning changed under a stable name is how a stale test keeps passing. |
| B12 | Greeting-name edits do not re-warm the OG card. |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/0012_*.sql`, `supabase/down/0012_*_down.sql` | New | `nickname`, `greeting_name_source`, `dispatch_recipient_guest_id`, composite unique + FK, drop `seats_allowed` |
| `supabase/migrations/0007` → superseded in `0012` | Modified | `enforce_seat_cap` sources the cap from `count(*)`; parity rule and ordering preserved |
| `supabase/migrations/0006_import_invitations.sql` | Modified | `import_invitations` accepts `nickname`, drops `seats_allowed` |
| `lib/domain/spanish-list.ts`, `guest-name.ts`, `greeting-name.ts`, `dispatch-recipient.ts`, `invitation-draft.ts`, `invitation-deletion.ts` | New | Pure, I/O-free |
| `lib/domain/dispatch-message.ts` | Modified | `selectDispatchRecipient` removed |
| `lib/domain/dispatch-preflight.ts` | Modified | New blocker kind first; household-reachable becomes recipient-reachable |
| `lib/domain/console-list.ts` | Modified | `nickname`, chosen recipient, greeting-name source, membership advisories |
| `lib/domain/seats.ts` | Modified | Takes the member count instead of `seatsAllowed` |
| `lib/server/invitations.ts` | Modified | The entire new write side; owner scoping removed on writes |
| `lib/server/rsvp.ts` | Modified | Cap sourced from members |
| `app/console/(authenticated)/actions.ts` | Modified | New Server Actions |
| `app/console/(authenticated)/invitations/new`, `/[id]/edit` | New | The one form |
| `components/console/GuestList.tsx` | Modified | Recipient indicator, edit affordance, empty-state copy (currently says invitations are loaded with the importer — false the moment this ships, and a standing E2E asserts it) |
| `components/invitation/RsvpAnswer.tsx`, `InvitationBody.tsx` | Modified | Seat copy expressed as members |
| `scripts/import-guests.ts` | Modified | `nickname`; `buildImportAdvisory`'s seats-versus-names warning deleted |
| `supabase/tests/seat-parity.spec.ts`, `append-only.spec.ts`, `rls.spec.ts` | Modified | New cap source; 0005 cascade must not regress |
| `app/i/[slug]/opengraph-image.tsx` | Unchanged | But the reason editing a dispatched name has a consequence |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **`enforce_seat_cap` fires only on `rsvp_responses` INSERT.** It reads the cap at that instant and nothing re-evaluates it. This change makes the *other* side of the relationship editable for the first time, so removing a member after a confirmed RSVP leaves `seats_confirmed > count(members)` with **no database backstop on the side being edited**. | **High** | `classifyMembershipChangeImpact` detects and reports it as a row badge and a dashboard group — visible where it is fixable. Deliberately not a refusal: the blocked case ("Fer said yes but now he can't come — take him off") is the couple's actual workflow, and a tool that refuses the thing people came to do gets worked around. Whether a deferred constraint trigger on `invitation_guests` DELETE/UPDATE is a viable backstop is a **question for `sdd-design`**; the badge must be impossible to miss or it is decoration. |
| **`attendee_guest_ids` is a bare `uuid[]`, not a foreign key.** Removing or moving a guest leaves **dangling identifiers** in `rsvp_responses`, which is append-only against `service_role` too — so those rows **can never be corrected**. Nothing cascades and nothing notices. | **High** | Accept it and make it legible rather than repairing it: history stays honest about what was answered at the time. Every read of `attendee_guest_ids` MUST tolerate an unresolvable id and render it as a removed guest — never crash, never silently drop it, which would understate the answer. Appending a corrective RSVP is rejected (it would attribute the couple's act to the guest). FK-ing the array is out of scope. |
| **Every existing undispatched invitation becomes un-dispatchable on deploy** until someone chooses a recipient; the first preflight run shows a large `no_recipient_chosen` group. | High | Expected, not discovered. Tell the couple before deploying. Backfilling from `is_primary` is the auto-pick decision 2 removed, applied silently and at scale — **do not**. |
| **The preflight changes meaning, not just shape.** Readiness is now about one person: an invitation whose chosen recipient has a landline is blocked though their partner holds a mobile. | High | Correct and intended. Rename the phone kinds (B11). Existing E2E readiness-count assertions will move and must be re-derived, not patched to pass. |
| **Dropping `seats_allowed` is destructive and irreversible by data.** | Med | The down script recreates the column from `count(*)` per invitation — exactly the value the derived rule defines — so revert is lossless under the new rule and wrong only for pre-existing rows that already disagreed with their member count. The migration MUST report those rows **before** dropping. |
| **The importer source format is a one-way door.** The couple's existing source file stops validating. | Med | Keep the pre-change source file; rollback reverts the format too. `import_invitations` stays idempotent on `source_key`. |
| **Editing a dispatched invitation's greeting name leaves a stale Open Graph card.** The page corrects; the card already in the chat does not. | Med | Accepted project-wide already (names-only card limits the damage). Decision 7 requires the UI to **say so** at the point of edit. |
| **Size.** ≈2,150–2,550 authored lines against an **800**-line budget. See below. | High | Recommend chained slices. Explicitly not assumed — see the next section. |
| Owner scoping removed on writes weakens a control. | Low | It was never the control that mattered: dispatch remains gated by the per-device WhatsApp declaration, which is what prevents a message leaving the wrong account. `actor_sender_id` still records who acted. |
| A spelling-only conjunction rule ships and reads as careless on a wedding invitation. | Med | The sixteen-row table below is a success criterion, and `Ian`, `Yolanda`, `Hierro` and NFD `Íñigo` are in it precisely because each one kills a spelling-only rule. |

## Size Forecast and Delivery — decision needed, not assumed

| Slice | Content | Est. lines |
|---|---|---|
| 1 | Migration `0012` + down + DB tests | ≈250 |
| 2 | Pure domain + unit tests | ≈600 |
| 3 | Repository writes + Server Actions | ≈600 |
| 4 | Console UI + E2E | ≈700 |
| + | `seats_allowed` removal across 53 referencing files | ≈150–400 |
| | **Total** | **≈2,150–2,550** |

`delivery_strategy` for this session is **`single-pr`** at `review_budget_lines: 800`. This change does not fit, and the gap is roughly threefold. **Recommendation: chained slices in the order above** — the slice boundaries are already the order the work must happen in, and each slice has a clear start, a clear finish, its own verification, and its own rollback. The alternative is a knowingly accepted `size:exception`. This proposal does **not** assume the exception; `sdd-tasks` must emit the guard lines and the orchestrator must resolve the strategy with the couple before `sdd-apply` starts.

## Rollback Plan

- **Before the first invitation is created through the new console**: fully reversible. Revert the branch, run `supabase/down/0012_*_down.sql`, redeploy the previous Vercel build. `seats_allowed` is recreated from the member count (see risk table); the pre-drop report names any row that disagreed.
- **After creation but before dispatch**: reverting the migration leaves console-created invitations in place with a recreated `seats_allowed`. `nickname`, `greeting_name_source` and `dispatch_recipient_guest_id` are dropped; greeting names remain as last written, which is correct — they are materialized.
- **After dispatch**: forward-only. Delivered `wa.me` URLs cannot be recalled and Meta caches per URL. Keep `/i/[slug]` serving; use **slug rotation**, not deletion, for anything sent by mistake.
- **Per-slice**: each of the four slices is independently revertable. Slice 1 is the only destructive one and is the only one needing a data-restoring down script.
- The importer source file must be reverted alongside slice 1.

## Dependencies

- **Postgres ≥ 15** for the composite `on delete/update set null (column)` syntax. **Verified: deployed instance is 17.6.** The exploration's top risk is closed.
- `whatsapp-wedding-invitations` is shipped but **not archived**, so `openspec/specs/` is empty — spec deltas must target the change folder's specs.
- A new import source file from the couple carrying `nickname` and no seats column.
- No new runtime or dev dependencies. Vitest `environment: 'node'` already covers the pure domain with zero mocking.
- `strict_tdd: true` is in force; every refusal must ship with its permitting counterpart in the same test.

## Success Criteria

### The Spanish conjunction — the full table, all sixteen rows

| # | Second name | Expected | Why it is in the table |
|---|---|---|---|
| 1 | Luzma | `y Luzma` | Ordinary consonant |
| 2 | Ana | `y Ana` | Vowel, not /i/ |
| 3 | Elena | `y Elena` | `e-`, unaffected |
| 4 | Inés | `e Inés` | /i/ nucleus — the headline case |
| 5 | Ignacio | `e Ignacio` | `i` + consonant |
| 6 | Isabel | `e Isabel` | The RAE's own example |
| 7 | Hilda | `e Hilda` | Silent `h`; the `i` is the nucleus |
| 8 | Íñigo | `e Íñigo` | Accented `Í` — a plain `=== "i"` fails |
| 9 | **Ian** | `y Ian` | `i` + vowel = diphthong. A real name in Colombia; **defeats every spelling-only rule** |
| 10 | **Yolanda** | `y Yolanda` | `y-` is /ʝ/, not /i/ — the trap for "starts with y or i" |
| 11 | **Hierro** | `y Hierro` | `hie-` diphthong — the case the original briefing had **backwards**; same case as *hielo* |
| 12 | Iván | `e Iván` | |
| 13 | Irene | `e Irene` | |
| 14 | ÍÑIGO / íñigo | `e …` | Case-insensitive both ways |
| 15 | **`Íñigo` as NFD** | `e Íñigo` | A mobile keyboard and a paste from Contacts disagree; normalize to NFC |
| 16 | `"  Inés"` | `e Inés` | Leading whitespace from a paste |

### Behaviour

- [ ] Arity: `[]` **throws**; `["Lucho"]` → `"Lucho"`; two → `"Lucho y Luzma"`; three → `"Lucho, Luzma y Fer"`; four → `"Lucho, Luzma, Fer y Ana"`. A test asserts there is **no Oxford comma**.
- [ ] The same guest `{fullName: "Luis Guzmán", nickname: null}` yields `"Luis Guzmán"` as a solo invitation and `"Luis"` inside a group list. One function with a flag would collapse these; the test forbids it.
- [ ] `resolveGreetingName` at `'custom'` returns the stored string **and** the same call at `'derived'` returns the derived one. The pair is the test — alone, the first passes a function that always returns `stored`.
- [ ] `resolveDispatchRecipient(guests, null)` is `no_recipient_chosen` **and** a chosen id returns `ok`. Alone, the first passes a function that always refuses.
- [ ] `canDeleteInvitation([])` is `ok` **and** any `dispatch_events` row — including `link_opened` and `marked_failed` — refuses.
- [ ] Every refusal in this change (no recipient, no delete after dispatch, no emptying an invitation) ships with its **permitting** case in the same test, so the assertion can fail when the refusal is removed.
- [ ] DB: the composite FK **refuses** a recipient belonging to another invitation, and moving a guest **clears** the recipient with no application code involved.
- [ ] DB: `enforce_seat_cap` rejects `seats_confirmed` above the member count and rejects a parity mismatch, with the cap checked first so an over-cap submission still fails for the cap's own reason.
- [ ] DB: the append-only triggers still reject a direct delete on `dispatch_events` and `rsvp_responses` while the `invitations` cascade still passes — **0005 must not regress**.
- [ ] `grep`-clean: no reference to `seats_allowed` or `seatsAllowed` survives outside migration history.
- [ ] An imported row carries `greeting_name_source = 'imported'`, and no imported invitation acquires a dispatch recipient.
- [ ] E2E on a phone viewport: create a group, watch the derived name appear as nicknames are typed, override it, add a member, and confirm the override survived.
- [ ] E2E: dispatch is blocked before a recipient is chosen and unblocked after; deletion is refused on a dispatched invitation and slug rotation is offered instead.
- [ ] Rotating a slug makes the old URL stop resolving to the invitation and the path-scoped unlock cookie unusable.
- [ ] Removing a member named in a confirmed RSVP **succeeds** and produces a visible advisory naming that invitation; an RSVP naming only current members produces none.
- [ ] A stored `attendee_guest_ids` containing a deleted guest's id renders that guest as removed — it neither crashes nor silently shortens the answer.
- [ ] Either the work is sliced into four chained PRs, or a `size:exception` is recorded as knowingly accepted. Not both, and not neither.

## Sources

- RAE, *Diccionario panhispánico de dudas*, s.v. «y» — <https://www.rae.es/dpd/y>
- RAE, «Cambio de la "y" copulativa en "e"» — <https://www.rae.es/espanol-al-dia/cambio-de-la-y-copulativa-en-e-0>
- RAE, *Nueva gramática básica* 16.2.3 — <https://www.rae.es/gram%C3%A1tica-b%C3%A1sica/la-preposici%C3%B3n-la-conjunci%C3%B3n-la-interjecci%C3%B3n/la-conjunci%C3%B3n/las-conjunciones-copulativas>
