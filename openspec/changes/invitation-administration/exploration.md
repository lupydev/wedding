# Exploration: invitation-administration

**Phase**: sdd-explore | **Change**: `invitation-administration` | **Store**: hybrid
**Engram mirror**: observation #1666, topic `sdd/invitation-administration/explore`

## Current State

**A group is an invitation, and the schema already says so.** `invitations` is the household;
`invitation_guests` are its members; a one-member invitation is a solo guest. Nothing in this
change touches that model.

What exists today:

- `invitations(id, slug, owner_sender_id, display_name, greeting_name, seats_allowed,
  rsvp_deadline, og_warmed_at, slug_rotated_at, …)`. `display_name` and `greeting_name` are both
  `not null`. `greeting_name` is the name rendered in the WhatsApp draft, on the invitation page,
  and **inside the Open Graph card** (`app/i/[slug]/opengraph-image.tsx:87,108`).
- `invitation_guests(id, invitation_id, full_name, phone_e164, phone_last8 generated, is_primary,
  is_child)`. **There is no `nickname`.** `is_primary` has a partial unique index and today does
  exactly one thing: sorts the guest first in `listConsoleInvitations`.
- Writes: the ONLY creation path is `scripts/import-guests.ts` → `validateImportRows` →
  `importInvitations` → the `import_invitations` SQL function (0006), one transaction, idempotent
  on `source_key`. The console can write exactly one field: `updateGuestPhone`.
- `selectDispatchRecipient(guests)` (`lib/domain/dispatch-message.ts:161`) returns the **first
  guest with a dispatchable phone**. Its two failure reasons feed `buildDispatchPreflight`.
- RLS is default-deny with zero policies; every write goes through `service_role` in
  `lib/server/**`. Authorization is owner-scoped in application code.
- Append-only: `dispatch_events` and `rsvp_responses` reject direct UPDATE/DELETE by trigger
  (0003), including as `service_role`. 0005 carved out exactly one exemption — the FK cascade from
  `invitations` — so a mistakenly imported invitation can be hard-deleted. It rejected soft delete
  by name.
- Seats: `enforce_seat_cap` (0007) fires **on insert into `rsvp_responses` only** and requires
  `seats_confirmed = cardinality(attendee_guest_ids) <= seats_allowed`. `attendee_guest_ids` is a
  bare `uuid[]`, **not** a foreign key — membership is checked in application code at submit time.
- Slug rotation is designed (`slug_rotated_at`, design.md:252) but **not implemented anywhere**.
- Tests: 1458 unit, 152 E2E, strict TDD.

**Standing constraint**: exactly two operators, the couple. No roles, no invites, no permission
model. Every design below assumes two trusted humans and is cheaper because of it.

## Affected Areas

| Path | Why |
|---|---|
| `supabase/migrations/0012_*.sql` + down | `nickname`, `greeting_name_source`, `dispatch_recipient_guest_id`, composite unique |
| `lib/domain/dispatch-message.ts` | `selectDispatchRecipient` auto-pick contradicts the explicit-recipient decision |
| `lib/domain/dispatch-preflight.ts` | New blocker kind; household-reachable becomes recipient-reachable |
| `lib/domain/console-list.ts` | `nickname`, chosen recipient, greeting-name source |
| `lib/server/invitations.ts` | New write side: create, update, move, delete, choose recipient |
| `app/console/(authenticated)/actions.ts` | New Server Actions, each owner-scoped |
| `app/console/(authenticated)/invitations/**` | Create and edit surfaces |
| `components/console/GuestList.tsx` | Recipient indicator, edit affordance, empty-state copy |
| `scripts/import-guests.ts`, migration 0006 | Produce rows the new machinery must accept |
| `app/i/[slug]/opengraph-image.tsx` | Unchanged, but the reason editing a dispatched name has a consequence |

## 1. Derived vs. overridden group name

The default is computed from members; the operator may override. The question is what a later
membership change does. **An override must survive** — but that only becomes enforceable if the
storage shape can tell the two apart, and today's cannot.

| Shape | Pros | Cons | Effort |
|---|---|---|---|
| **A. `greeting_name` stays materialized + `greeting_name_source text not null check (in ('derived','custom','imported'))`** | Zero read-path change: the crawler path still reads one column with no join. The source names *why*, so the import backfill is a distinct value rather than a lie. Re-derivation is write-path only. | Two columns must be written together. Mitigated by one repository function owning every write. | Low |
| **B. Boolean `greeting_name_is_custom`** | Simplest migration. | Cannot distinguish "a human typed this" from "a script wrote this and nobody looked". A third state later costs a second migration. | Low |
| **C. Nullable override + derive at read** | Unambiguous; no flag to forget. | Breaks the no-join read. The OG image and `generateMetadata` would each load guests and run the join — and that path must stay cold-start-cheap. Derivation in two runtimes with no stored answer to compare. | Medium |
| **D. Store only the final string (today)** | No migration. | The distinction is unrecoverable. Every membership change forces a choice with no information: always rewrite (destroys deliberate names) or never (a two-member group grown to four keeps the two-name default forever, silently wrong). | None, and wrong |

**Recommendation: A.** Text over boolean because of the import backfill, and because
`check (kind in …)` + text is already this project's idiom for a set that will grow.

Costs on a member change:

- `source = 'derived'` — recomputes on every membership or nickname write. If already dispatched,
  the delivered WhatsApp text is frozen with the old name while the page and card change. Same
  unrecallable-message property the project already accepts — a reason to *say so in the UI*, not
  to freeze derivation.
- `source = 'custom'`, member removed — nothing happens, which is correct. A custom string may
  still contain the removed member's nickname. **Do not detect this by string matching.** Show the
  live derived name beside the custom one with a reset button: always available, never wrong.
- `source = 'custom'`, nickname edited — same.

## 2. The Spanish list conjunction

**The briefing's framing was wrong. Verified against the RAE, not from memory.**

> **y** becomes **e** before a word beginning with the **sound /i/**, written `i-` or `hi-`:
> *Fernando **e** Isabel*, *madre **e** hija*.
> **Exception**: when that `i` is part of a **diphthong**, it stays **y**: *matas **y** hierbas*,
> *frío **y** hielo*.

The discriminator is **diphthong vs. hiatus**, not the spelling `hi-` vs `hie-`. *Hierro* and
*hielo* are the **same case**: both `hie-`, both diphthongs, both take **y**. The correct pair is
*hija* (hiatus → `e hija`) vs *hielo* (diphthong → `y hielo`).

**Scope finding that removes work**: this function only ever emits a conjunction between two proper
nouns inside a phrase. It never produces a disjunction, so **do not implement `o → u`**, and the
sentence-initial interrogative exception is unreachable. Both exclusions belong in the module's doc
comment so nobody adds them "for completeness".

**The implementable rule**: emit `e` when the next name's first sound is /i/ — it begins with
`i`/`í` or `hi`/`hí` **and** the letter after that `i` is a consonant or the name ends there
(hiatus). Emit `y` when the `i` is followed by another vowel (diphthong), and `y` for everything
else, notably `y-` initial names, which are /ʝ/ and not /i/.

| # | Second name | Expected | Why |
|---|---|---|---|
| 1 | Luzma | `y Luzma` | Ordinary consonant |
| 2 | Ana | `y Ana` | Vowel, not /i/ |
| 3 | Elena | `y Elena` | `e-`, unaffected |
| 4 * | Inés | `e Inés` | /i/ nucleus — the headline case |
| 5 | Ignacio | `e Ignacio` | `i` + consonant |
| 6 | Isabel | `e Isabel` | The RAE's own example |
| 7 * | Hilda | `e Hilda` | Silent `h`, `i` is the nucleus |
| 8 * | Íñigo | `e Íñigo` | Accented `Í` — a plain `=== "i"` fails |
| 9 * | Ian | `y Ian` | `i` + vowel = diphthong. A real name in Colombia; defeats every spelling-only rule |
| 10 * | Yolanda | `y Yolanda` | `y-` is /ʝ/ — the trap for "starts with y/i" |
| 11 * | Hierro | `y Hierro` | `hie-` diphthong; **the case the briefing had backwards** |
| 12 | Iván | `e Iván` | |
| 13 | Irene | `e Irene` | |
| 14 | ÍÑIGO / íñigo | `e …` | Case-insensitivity both ways |
| 15 * | `Íñigo` as NFD | `e Íñigo` | A mobile keyboard and a paste from Contacts can disagree; normalize to NFC |
| 16 | `"  Inés"` | `e Inés` | Leading whitespace from a paste |

Arity: 0 members (open question 7), 1 → `"Lucho"`, 2 → `"Lucho y Luzma"`, 3 → `"Lucho, Luzma y
Fer"`, 4 → `"Lucho, Luzma, Fer y Ana"`. **No Oxford comma** — Spanish does not take one, and a test
should say so because an English-speaking contributor will add one.

## 3. Creating and editing

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **C1. One `/console/invitations/new` (+ `/[id]/edit`), one form for both cases** | The form *is* the model: add member rows; one row is a solo guest, three is a group. No mode switch, so no UI can disagree with "a group is an invitation". One write path, one validation function, one derivation site. | A navigation away from the list. Two routes to build and E2E. | Medium |
| **C2. Two flows, "nuevo invitado" and "nuevo grupo"** | Smaller forms; matches how the couple talks. | Teaches a distinction the model does not have, and raises "how do I turn this guest into a group?" that C1 never does. Two paths that will drift on exactly the thing this change is about. | Medium/High |
| **C3. Inline creation in the list** | No navigation; matches the inline phone editor. | The phone editor is *one field*. A multi-member form inside a scrolling list on a phone is cramped, and `GuestList.tsx` is deliberately props-only. Nothing to prefill the derived name against until members exist. | Medium |

**Recommendation: C1, one form, no mode switch.** Keep C3's spirit where it already works — the
phone field stays inline.

Form notes: prefill the group-name field with the live derived value, recomputed **client-side as
nicknames are typed, importing the same pure function** — two runtimes, one function, no drift.
Touching the field sets `source = 'custom'`; a reset button sets it back to `'derived'`. The
recipient is a radio per member **with no default selected** — the explicit-recipient decision
rendered rather than validated. Single column, `min-w-0` on truncating flex children, no popover
menus.

**Moving guests between groups.** A "mover a otra invitación" action on the member row. Two hazards:
(1) moving the last member out leaves an invitation with zero guests, which `createInvitation`
already says must never exist — it can never be unlocked and sits in the console looking valid; the
move must refuse and point at deletion. (2) If the moved member is the chosen recipient, the choice
must clear — section 5 makes that structural.

## 4. Deleting

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **D1. Hard delete, always** | One definition of "exists". Cascade already works. | A dispatched URL is in someone's WhatsApp; deleting makes it show the unknown-slug page to a real guest. Destroys their RSVP and the dispatch log. | Low |
| **D2. Soft delete** | Nothing lost; reversible. | 0005 rejected this **by name**: a second definition of existence that the gate, the OG image, `generateMetadata`, the list, the preflight and the RSVP write must each honour — and the one that forgets leaks a removed invitation to a guest. | Medium/High |
| **D3. Hard delete while undispatched; refuse once dispatched** | Keeps the single definition **and** respects the unrecallable URL. Computable from data the list already loads. The mistaken-import case 0005 was written for is undispatched by definition. | Needs a stated exit for "dispatched by mistake". | Low/Medium |

**Recommendation: D3.**

**Which events count as dispatched?** Take the conservative one: **any `dispatch_events` row**.
`link_opened` means a device fetched that URL, so the link demonstrably escaped; `marked_failed` is
the operator saying it did not arrive, not that it never left. The cost differs by two orders of
magnitude: refusing a deletion costs one awkward row; allowing one costs a guest opening a 404
where their wedding invitation was.

**The exit for "dispatched by mistake" is not deletion.** `slug_rotated_at` exists for exactly
this: rotate the slug, the delivered URL dies, one definition of existence survives. Two caveats:
rotation is **designed and entirely unimplemented**, and Meta's cached card for the old URL survives
forever — which the names-only card decision is what limits.

**Deleting a guest** is a different act: permitted, clears the recipient choice if it was them,
must refuse to empty an invitation, and may leave their uuid inside a stored `attendee_guest_ids`.

## 5. The explicit recipient

| Storage | Pros | Cons | Effort |
|---|---|---|---|
| **R1. `invitations.dispatch_recipient_guest_id uuid null` with a COMPOSITE FK** — add `unique (invitation_id, id)` to `invitation_guests`, then `foreign key (id, dispatch_recipient_guest_id) references invitation_guests (invitation_id, id) on delete set null (…) on update set null (…)` | "The recipient belongs to this invitation" becomes **unrepresentable**, not guarded. Deleting the guest clears the choice. **Moving them updates `invitation_guests.invitation_id`, which trips `on update` and clears the choice**, so the invitation falls back to a state the preflight already reports. Nothing to remember in application code. | The column-list form of `SET NULL` is **Postgres 15+**. Verify against the deployed version. A plain `on delete set null` would try to null `invitations.id` and fail. | Medium |
| **R2. `invitation_guests.is_dispatch_recipient` + partial unique index** | Mirrors the existing `one_primary` idiom. No version risk. | **Moving the guest carries the flag**, silently making them the new group's recipient — a person chosen by nobody, precisely the failure the decision exists to prevent. | Low |
| **R3. Reuse `is_primary`** | No migration. | Conflates sort order with recipient. The importer sets it with no such meaning, so every imported invitation acquires a recipient nobody chose. | None, and wrong |

**Recommendation: R1, with R2 as the documented fallback if the Postgres version blocks it.**

`selectDispatchRecipient(guests)` becomes `resolveDispatchRecipient(guests, chosenGuestId)`:

```
no_recipient_chosen         — chosenGuestId is null
recipient_not_in_household  — chosen id is not among guests
recipient_has_no_phone      — chosen guest, phone null/empty
recipient_phone_unreachable — chosen guest, phone not dispatchable
ok                          — { guest, phoneE164 }
```

Keep `recipient_not_in_household` even though R1 makes it unrepresentable in the database: the
function takes plain arrays, and a function that trusts its caller for an invariant the caller
happens to hold is one refactor from being wrong.

**The semantic change nobody should miss.** Today a household is ready if **any** member is
reachable. With an explicit recipient, readiness is about **that one person** — an invitation whose
chosen recipient has a landline is blocked even though their partner holds a mobile. Correct and
intended, and it means the two existing preflight kinds change **meaning**, not just gain a sibling.

Add `no_recipient_chosen` **first** in `PREFLIGHT_BLOCKER_ORDER`: most actionable, and the most
common on day one. Whether the phone kinds gain `recipient_` prefixes is a naming call for the
spec — lean toward renaming, because a kind whose meaning changed under a stable name is how a
stale test keeps passing.

## 6. Seats and RSVP integrity — the sharpest question

Three facts, established from the code:

1. `enforce_seat_cap` is a trigger on **`rsvp_responses` INSERT**. It reads `seats_allowed` at that
   instant. **Nothing re-evaluates it when the invitation changes.** Lowering `seats_allowed` below
   an already-confirmed count would be accepted in silence — the invariant is enforced on one side
   of a relationship this change makes editable from the other.
2. `attendee_guest_ids` is a bare `uuid[]`. Deleting or moving a guest leaves **dangling uuids** in
   the history. Nothing cascades and nothing notices.
3. `rsvp_responses` is append-only against `service_role` too. **A stored answer can never be
   corrected.**

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **S1. Refuse the edit** | No inconsistent state can exist. | The blocked case is the couple's actual workflow: *"Fer already said yes, but now he can't come — take him off."* A tool that refuses the thing people came to do gets worked around. | Low |
| **S2. Allow, detect, report** — a pure `classifyMembershipChangeImpact(...)` rendered as a row badge and a dashboard group | The couple's judgment stays the authority. The history stays honest. The finding is visible where it is fixable. | An inconsistent state exists and must be carried by every count that reads seats. The badge must be impossible to miss or it is decoration. | Medium |
| **S3. Append a corrective RSVP on the couple's behalf** | Keeps every aggregate self-consistent; respects append-only. | The history would record that *the guest* changed their answer, when the couple did. On the one record the couple will re-read years later, that is a lie the system told. **Reject.** | Medium |

**Recommendation: split them.** Membership → **S2**: removing a person who already answered is a
real event in the world; the system's job is to notice, not veto. `seats_allowed` → **S1**: refuse
to lower it below the confirmed count — a number an operator typed and can retype, satisfiable in
one keystroke, unlike "un-remove Fer". Different refusals for different costs.

**Worth putting in front of the couple: derive `seats_allowed` from the member count and delete the
field.** 0007 already makes `seats_confirmed = cardinality(attendee_guest_ids)` and `submitRsvp`
already requires every attendee to be a named member, so an *unnamed* seat is already
unconfirmable. `seats_allowed` greater than the member count reserves seats nobody can take; less
than it names a person who can never be seated. If the console makes adding a plus-one *be* adding
a named member — which is what the couple does anyway — the entire mismatch class disappears along
with a form field. Not in the confirmed requirements: an open question, and the cheapest large
simplification available.

## 7. Migrating what already exists

- **`nickname text null`** — backfills NULL, no behaviour change. The first-name fallback keeps
  derivation meaningful.
- **`greeting_name_source`** — **the trap is the default.** `default 'derived'` would mark every
  imported row derivable, and the first membership edit would overwrite a hand-written "Familia
  Restrepo" with "Ana y Niño" — the exact destruction the override decision prevents. Use
  `not null default 'imported'`, and have the console write `'derived'`/`'custom'` explicitly at
  every insert. A distinct `'imported'` means *a script wrote this and no human has looked at it*,
  which lets the console offer a reset without claiming anyone chose it.
- **`dispatch_recipient_guest_id`** — backfills NULL. **Every existing undispatched invitation
  becomes un-dispatchable until someone chooses**, and the preflight will show a large
  `no_recipient_chosen` group on first run. Expected, not discovered. Backfilling from `is_primary`
  is the auto-pick the decision removed, applied silently and at scale. **Do not.**
- **The importer**: `import-guests.ts`, `validateImportRow`, `NewInvitation` and migration 0006 all
  need a decision — gain `nickname` and a recipient, or keep producing rows that land blocked.
  Whether it survives at all is open question 4, and it is a one-way door for the source format.

## 8. Testing

Pure domain functions (all I/O-free, importable under `environment: 'node'` with zero mocking):

| Module | Functions |
|---|---|
| `lib/domain/spanish-list.ts` | `spanishConjunction(nextWord)`, `joinSpanishList(items)` |
| `lib/domain/guest-name.ts` | `firstName`, `soloAddressName`, `listMemberName` |
| `lib/domain/greeting-name.ts` | `deriveGreetingName(members)`, `resolveGreetingName({source, stored, members})` |
| `lib/domain/dispatch-recipient.ts` | `resolveDispatchRecipient(guests, chosenGuestId)` |
| `lib/domain/invitation-draft.ts` | `validateInvitationDraft`, `classifyMembershipChangeImpact` |
| `lib/domain/invitation-deletion.ts` | `canDeleteInvitation(dispatchEvents)` |

**The distinction most likely to be collapsed, and therefore the first test.** A **solo** guest is
addressed by nickname **else full name**. A **list member** contributes nickname **else first
name**. Two different fallbacks on the same two fields; one function with a flag would collapse
them. The test: the same guest `{fullName: "Luis Guzmán", nickname: null}` must yield
`"Luis Guzmán"` solo and `"Luis"` inside a list.

RED order:

1. `joinSpanishList(["Lucho","Luzma","Fer"])`, then **`["Lucho","Inés"] === "Lucho e Inés"`** —
   which fails against any naive `" y "` join, so it must exist before the implementation.
2. The full conjunction table, table-driven — including `Ian`, `Yolanda`, `Hierro` and NFD `Íñigo`.
3. The solo-vs-list naming pair.
4. `resolveGreetingName` at `'custom'` returning the stored string **paired with** the same call at
   `'derived'` returning the derived one. The pair is the test: alone, the first also passes a
   function that always returns `stored`.
5. `resolveDispatchRecipient(guests, null) === no_recipient_chosen` **paired with** a chosen id
   returning `ok`. Alone, the first passes a function that always refuses.
6. `canDeleteInvitation([]) === ok` **paired with** a dispatched event refusing.
7. `classifyMembershipChangeImpact`: an answer naming a removed guest is reported; one naming only
   current members is not.

**Applied literally**: a test asserting a refusal must be capable of failing when the refusal is
removed. For every refusal here — no recipient, no delete after dispatch, no lowering seats below
confirmed, no emptying an invitation — the spec must carry the **permitting** case in the same
test, or the refusal is untested.

**Database tests**: the composite FK refuses a recipient from another invitation; moving a guest
clears the recipient; the append-only triggers still reject a direct delete while the invitation
cascade still passes (0005 must not regress); lowering `seats_allowed` below a confirmed answer is
refused by whatever layer owns S1.

**E2E**: create a group on a phone viewport, see the derived name appear as nicknames are typed,
override it, add a member, confirm the override survived; dispatch blocked before a recipient is
chosen and unblocked after; delete refused on a dispatched invitation.

## Recommendation

Change the **write** side and leave the **read** side alone: one materialized `greeting_name` plus
a `greeting_name_source`, one nullable `dispatch_recipient_guest_id` held by a composite foreign
key, one nullable `nickname`, one create/edit form with no mode switch, hard delete before dispatch
and refusal after, and an inconsistency *reported* rather than prevented on the one axis where
prevention would block the couple's real work.

The two design moves carrying the most weight are both of the "make it unrepresentable" kind this
project already values: the composite FK, which makes a cross-household recipient impossible rather
than guarded, and the `source` column, which makes "should this name re-derive?" a stored fact
rather than a guess at write time.

## Ready for Proposal

**Yes**, with ten open questions and one warning: `delivery_strategy` is `single-pr` at a review
budget of 800 lines, and this change forecasts roughly **2,000–2,300 authored lines** across four
natural slices (migration + DB tests ≈ 250; pure domain + unit tests ≈ 600; repository writes +
Server Actions + authorization ≈ 600; console UI + E2E ≈ 700). Budget risk: **High**. Tasks will
need chained slices, or the couple accepts a `size:exception` knowingly. Flagged here because the
slice boundaries are also the order the work has to happen in.

## Risks

- **The composite `on delete/update set null (column)` syntax requires Postgres 15+.** If the
  deployed instance is older, R1 collapses to R2 and "unrepresentable" becomes a remembered rule.
  Verify before `sdd-design`.
- **Editing a dispatched invitation's greeting name leaves a stale Open Graph card.** The page
  corrects; the card in the chat does not.
- **`enforce_seat_cap` is enforced on one table only.** This change makes the other side editable
  for the first time. Whatever S1 becomes has no database backstop unless one is added.
- **The preflight's meaning changes, not just its shape.** Households reported ready today may
  become blocked. Existing E2E assertions about readiness counts will move.
- **Every existing undispatched invitation becomes un-dispatchable on deploy** until a recipient is
  chosen. Correct, intended, and worth telling the couple before it happens.
- **`GuestList.tsx`'s empty state says invitations are loaded with the importer.** False the moment
  this ships; the standing E2E asserts what is visible there.
- **Size.** See the warning above.

## Open Questions (surfaced, not answered)

1. Does a `'derived'` name re-derive **after dispatch**, when the delivered message is frozen with
   the old one and only the page and card change?
2. Does `link_opened` / `marked_failed` block deletion, or only operator-asserted sends?
3. Should `seats_allowed` become **derived from the member count** and the field removed?
4. Does `scripts/import-guests.ts` survive now that a real administrator exists — and if so, does
   the source format gain `nickname` and a recipient?
5. Backfill value for `greeting_name_source` on imported rows: a distinct `'imported'`, or fold
   into `'custom'`?
6. May two members of one group share a nickname? Refusal, advisory, or silence?
7. Moving or deleting the **last** member: refuse, or delete the invitation? And what does
   `deriveGreetingName([])` mean — throw, or empty string?
8. May one operator create or edit an invitation **owned by the other**? Every console write is
   owner-scoped today; creation has to pick an owner from somewhere.
9. Is `is_primary` retained at all once an explicit recipient exists?
10. Is **slug rotation** in scope as the exit for "dispatched by mistake"? Designed, unimplemented.

## Sources

- RAE, *Diccionario panhispánico de dudas*, s.v. «y» — <https://www.rae.es/dpd/y>
- RAE, «Cambio de la "y" copulativa en "e"» — <https://www.rae.es/espanol-al-dia/cambio-de-la-y-copulativa-en-e-0>
- RAE, «Cambio de la "o" disyuntiva en "u"» — <https://www.rae.es/espanol-al-dia/cambio-de-la-o-disyuntiva-en-u-0>
- RAE, *Nueva gramática básica* 16.2.3 — <https://www.rae.es/gram%C3%A1tica-b%C3%A1sica/la-preposici%C3%B3n-la-conjunci%C3%B3n-la-interjecci%C3%B3n/la-conjunci%C3%B3n/las-conjunciones-copulativas>
