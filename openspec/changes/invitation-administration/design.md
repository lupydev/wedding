# Design: Invitation Administration

**Change**: `invitation-administration` | **Store**: hybrid | **Engram**: `sdd/invitation-administration/design`
**Contract**: `openspec/changes/invitation-administration/proposal.md` (12 confirmed decisions, 12 adopted assumptions — not re-derived here)
**Extends**: `openspec/changes/archive/2026-09-13-whatsapp-wedding-invitations/design.md`. Decisions continue its numbering at **D11**.
**Baseline**: the seven published specs in `openspec/specs/`. The proposal's note that `openspec/specs/` is empty is **stale** — `whatsapp-wedding-invitations` is archived at `openspec/changes/archive/2026-09-13-whatsapp-wedding-invitations/`.

> **Size note**: this document exceeds the 800-word design budget, for the same reason the prior design did — DDL, exact signatures, and the removal inventory are all required by the phase brief. Prose is minimal; every section is table, code, or list.

---

## 0. Corrections to the proposal, stated before anything is designed on top of them

One proposal claim was **measured false against the live local PostgreSQL 17.6**. Two others are refinements. None is still open.

| # | Proposal claim | Finding | Status |
|---|---|---|---|
| **C1** | R1's FK carries `on update set null (dispatch_recipient_guest_id)`, so **moving** a guest clears the recipient with "nothing to remember in application code". | **Measured false — evidence in §0.1.** The `on delete` half is real and works. The `on update` half describes behaviour **no foreign-key form in PostgreSQL provides**: the column-list form is rejected at DDL time, the plain form nulls the primary key at runtime, and omitting the clause turns a move into a raw foreign-key error shown to the couple. | **RESOLVED. Replaced by D11** — a `BEFORE UPDATE` trigger, measured working. |
| **C2** | "Verified: deployed instance is 17.6." | **Correct**, confirmed against the live instance; `supabase/config.toml:41` (`major_version = 17`) agrees. 17.6 ≥ 15, so the `ON DELETE` column-list form is available — and it was exercised directly rather than inferred from the version number. | **Confirmed.** |
| **C3** | "**53 files** reference `seats_allowed`/`seatsAllowed` today." | **Correct on every directory that matters.** Two independent counts agree exactly outside OpenSpec: **11 `lib`, 11 `e2e`, 10 `supabase`, 8 `components`, 3 `app`, 2 `scripts` = 45 source/test/migration files, 200 occurrences.** The 53-versus-57 spread is entirely the OpenSpec **document** count (8 versus 12) and moves with when the count was taken relative to archiving `whatsapp-wedding-invitations` minutes ago. Those documents change nothing. **Operative figure, identical either way: 45 referencing files, of which 5 are frozen migration history (`0001`, `0003`, `0006`, `0007`, `0007_down`), so 40 files actually change.** Inventory in §5. | **Confirmed, operative figure pinned.** |
| **C4** | Affected Areas lists `supabase/migrations/0006_import_invitations.sql` as **Modified**. | This project does not edit shipped migrations. `0005` superseded `0003`'s `reject_mutation` and `0007` superseded `0003`'s `enforce_seat_cap`, both with `create or replace function` in a **new** migration. Editing `0006` in place would desynchronise every already-migrated database from the file. | **Corrected — D13.** `0012` supersedes `import_invitations`; `0006` is untouched. |

**C5 — budget conflict, flagged not resolved.** `openspec/config.yaml:126-127` declares `delivery_strategy: ask-on-risk` and `review_budget_lines: 800`. The proposal asserts `single-pr`. The phase brief names **400**. Three numbers. §6 forecasts against 400 and 800 both; the conclusion is the same under either.

One refinement to C3 that survives: the proposal's illustrative *"and six E2E specs"* undercounts the E2E surface. It is **9 E2E specs plus 2 E2E seed helpers** — and the helpers matter most, because changing those three seed functions collapses nearly all downstream churn into one-line deletions (§5, group E).

### 0.1 The measurement that killed `on update` — recorded so nobody re-adds it "for completeness"

Four probes, run against the live local PostgreSQL **17.6**.

**Probe 1 — the exact form the proposal specifies. Rejected at DDL time.**

```sql
foreign key (a, chosen) references t_parent (a, b)
  on delete set null (chosen) on update set null (chosen)
```
```
ERROR:  a column list with SET NULL is only supported for ON DELETE actions
LINE 3:     on delete set null (chosen) on update set null (chosen))...
```

**Probe 2 — `on update set null` with no column list. Accepted at DDL, explodes at runtime.** It nulls *every* referencing column, and one of them is `invitations.id`, the primary key:

```
ERROR:  null value in column "a" of relation "t_child" violates not-null constraint
CONTEXT: UPDATE ONLY "public"."t_child" SET "a" = NULL, "chosen" = NULL WHERE ...
```

**Probe 3 — no `on update` clause at all (default `NO ACTION`). The move is refused**, and the couple would see this:

```
ERROR:  update or delete on table "t_parent" violates foreign key constraint
DETAIL:  Key (a, b)=(...) is still referenced from table "t_child".
```

**Probe 4 — `on delete set null (chosen)` alone. Accepted, and correct.** Deleting the chosen guest clears the choice, exactly as the proposal wants.

There is no fifth option. `on update cascade` would rewrite `invitations.id` into a collision with the destination invitation's primary key — a worse failure than probe 2.

**The replacement, also measured.** A `BEFORE UPDATE` trigger nulling the choice when `invitation_id` changes: the move **passed** and the column came back **null**.

---

## 1. Technical Approach

Unchanged rings, unchanged arrows. This change adds a **write side** to a product that had one import script, and it adds it in the layer the prior design already reserved for it.

```
  app/console/(authenticated)/invitations/{new,[id]/edit}/   DELIVERY
  app/console/(authenticated)/actions.ts                     thin: parse, call, revalidate
        │
        ▼
  lib/server/invitations.ts                                  ADAPTERS
        │  create · update · member add/edit/remove/move · chooseRecipient
        │  deleteInvitation · rotateSlug        (every file opens `import 'server-only'`)
        ▼
  lib/domain/{spanish-list,guest-name,greeting-name,           CORE (new)
              dispatch-recipient,invitation-draft,
              invitation-deletion}.ts                         pure; randomness+clock are arguments (D2)
        ▲
        └───── components/console/InvitationForm.tsx ('use client') imports the SAME modules
```

The client form and the Server Action reach the same pure functions by **plain import of the same file** — no duplication, no shared-package indirection, no lint exception. Why that is legal, and why it needs no rule change, is **D14**.

---

## 2. Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|---|---|---|---|
| **D11** | How the recipient choice survives a **move**, given C1 | Composite FK carrying **`on delete set null (dispatch_recipient_guest_id)` only** (probe 4), plus a **`before update of invitation_id` trigger** on `invitation_guests` that nulls the choice (probe 5). No `on update` clause is written; the default `NO ACTION` is the backstop. | (a) `on update set null (col)` — **rejected at DDL time**, probe 1. (b) `on update set null` plain — **nulls the primary key at runtime**, probe 2. (c) `on update cascade` — rewrites `invitations.id` into a PK collision with the destination invitation. (d) `NO ACTION` with no trigger — probe 3: the move is refused and the couple gets a raw `violates foreign key constraint` message naming a constraint they have never heard of. (e) R2, an `is_primary`-style flag on the guest — the flag **travels with the moved guest**, silently making them the new household's recipient: precisely the failure decision 2 exists to prevent. | **The proposal's goal survives intact; only its mechanism was impossible.** The FK still makes a cross-household recipient *unrepresentable*, which was R1's real prize and is untouched by C1. The clearing moves to a trigger, and that is **house style rather than a workaround**: this project already enforces append-only (`0003`/`0005`) and the seat cap (`0007`) by TRIGGER rather than by policy, because `service_role` carries `BYPASSRLS` and a policy binds nothing against our own server code. A trigger binds against every writer — psql, a future script, a forgetful repository function — so "nothing to remember in application code" still holds. Belt and braces: if the trigger is ever dropped, the default `NO ACTION` makes the move **fail loudly** (probe 3) rather than produce a cross-household recipient. Fail-closed, never fail-silent. |
| **D25** | Ordering when a move would **both** clear the recipient **and** empty the source invitation | **The emptiness refusal runs first, in the application, and the trigger never fires** — because no `UPDATE` is ever issued. `moveMemberToInvitation` calls the pure `validateInvitationDraft`/`canMoveMember` check, gets `would_empty_source`, and returns a sentence pointing at deleting the invitation (decision 11). Only a move that passes that check reaches SQL, where the trigger then clears the source's recipient. | (a) A second refusal in the database — a `BEFORE UPDATE`/`BEFORE DELETE` trigger raising when the source would be emptied. (b) Letting the move empty the source and auto-deleting the invitation. (c) Moving the recipient choice to the destination invitation along with the guest. | **The two checks can never contend, because a refused move never becomes a statement** — that is the whole answer to "which runs first". A database refusal was considered and rejected for `0005`'s reason, which has already been paid for once: to be meaningful it would have to fire on DELETE too (deleting the last member is the identical hazard), and on DELETE it would abort the **invitation cascade delete**, re-creating exactly the bug `0005` exists to fix, and forcing a second copy of `0005`'s parent-existence discrimination. Same argument as D20, same verdict. Instead the zero-member state is made **inert rather than prevented**: D12's cap is `count(*)`, so a memberless invitation has cap 0 and the database refuses every attending RSVP; no phone matches, so it cannot be unlocked; it is visible in the console and deletable. One definition of existence, no second refusal — `0005`'s posture. (c) is rejected outright: carrying the choice to the destination is an auto-pick that nobody made, which decision 2 removed. After an allowed move the source has **no** recipient and the destination is **unchanged**, and both are states the preflight already reports as `no_recipient_chosen`. |
| **D12** | `enforce_seat_cap` cap source | `select count(*)::int from invitation_guests where invitation_id = new.invitation_id`. `0007`'s two checks and **their order** are copied verbatim. | Keeping `seats_allowed` as a cache of the count; a generated column. | The cap *is* the member count once `seats_allowed` is gone (decision 3). Side benefit, not the reason: the old `select seats_allowed into cap` returned `NULL` for a missing parent and `x > NULL` is `NULL`, so the cap silently passed; `count(*)` never returns `NULL`. **Ordering — cap first, parity second.** `0007` states why and it still holds: because `0007` forces `cardinality(attendee_guest_ids) = seats_confirmed` in every legitimate submission, an over-cap submission almost always *also* trips parity. Checking parity first would report the wrong fault and send the operator to fix the wrong field. `supabase/tests/seat-parity.spec.ts` asserts this order today and must keep asserting it against the new message. |
| **D13** | Where the `import_invitations` and `enforce_seat_cap` changes live | A **new** `0012`, using `create or replace function` for both. `0006` and `0007` are never edited. | Editing `0006` in place, as the proposal's Affected Areas table says. | Project convention with two precedents (`0005` over `0003`, `0007` over `0003`). Editing a shipped migration desynchronises every database that already ran it, and `0012`'s own down script would then have nothing coherent to restore. |
| **D14** | Client/server sharing of the derived name (B2) | `components/console/InvitationForm.tsx` carries `'use client'` and imports `deriveGreetingName` from `lib/domain/greeting-name.ts` directly. The Server Action imports the same specifier. | A duplicated client-side implementation; a shared npm workspace; passing the derived name down as a prop computed only on the server; relaxing `domainImportZone`. | **No rule needs weakening, because no rule is violated.** `domainImportZone` (`eslint.config.mjs:15-43`) restricts what `lib/domain/**` **imports** — it says nothing about who imports *it*. `componentImportZone` (`:45-61`) bans `@/lib/server/*` and `@supabase/*` from components, not `lib/domain`. `tools/eslint-zones.spec.ts:64-87` pins exactly that asymmetry. **Precedent already in the tree**: `components/invitation/RsvpAnswer.tsx` is `'use client'` and imports `seatsSelectionSentence` from `lib/domain/rsvp-copy`. The module is bundled into both graphs from one source file, so drift is not merely unlikely — it is unrepresentable. **The constraint this imposes on the module**: `greeting-name.ts`, `guest-name.ts` and `spanish-list.ts` may use only what both runtimes have. They need `String.prototype.normalize("NFC")` (universal) and nothing else; the `node:*` ban already enforced by the zone is what keeps it that way. |
| **D15** | `greeting_name_source` default | `not null default 'imported'`, `check (greeting_name_source in ('derived','custom','imported'))`. The console writes `'derived'`/`'custom'` **explicitly** at every write; the importer lets the default do it. | `default 'derived'`; a boolean. | Confirmed decision 9, restated here only because the default is the whole trap: `'derived'` would mark every imported row derivable and the first membership edit would overwrite a hand-written "Familia Restrepo". Letting the importer rely on the default is deliberate — the importer then has no way to write the wrong value. |
| **D16** | Randomness in slug rotation | `rotateInvitationSlug(client, invitationId)` calls the existing `mintSlug()` (`lib/server/invitations.ts:307`), which is `encodeSlug(randomBytes(SLUG_BYTE_LENGTH))`. The domain sees bytes, never a generator. | Minting in SQL; a domain-level `rotateSlug()` that sources its own randomness. | Extends D2 unchanged. `0006`'s comment already records that slugs are minted in the adapter so the database keeps no randomness policy; rotation must not become the exception. Rotation additionally sets `slug_rotated_at = now()` and `og_warmed_at = null`, then re-warms — the new URL is a new CDN key (prior design, "Warming"). |
| **D17** | `ConsoleListRow.seatsAllowed` after the drop | Renamed to `memberCount`, derived as `guests.length` in `assembleConsoleRows`. `ConsoleSummary.seatsAllowed` → `seats` with the same accumulation. | Keeping the name `seatsAllowed` over a derived value. | A field whose name says "allowed" over a value that is no longer allowed by anyone is how the next reader re-introduces the concept. The rename is what makes the `grep`-clean success criterion meaningful rather than cosmetic. |
| **D18** | Preflight blocker kinds (B11) | Rename, do not extend. Table in §7. | Adding `no_recipient_chosen` beside the existing two names. | A kind whose meaning changed under a stable name is how a stale test keeps passing. Bonus the rename buys: `DispatchRecipientProblem` and `PreflightBlockerKind` become **the same four names**, so `classify()` stops translating and becomes a pass-through. |
| **D19** | `classifyMembershipChangeImpact` home and shape | `lib/domain/invitation-draft.ts`, beside `validateInvitationDraft`. Returns a record, never a boolean. Signature in §4. | A separate `membership-impact.ts`; returning `boolean`; a refusal. | It reads exactly the inputs `validateInvitationDraft` already has (members after the edit) plus the latest stored answer, and both are called from the same Server Action on the same submit. A boolean cannot name *which* guest was removed or *which* answer is contradicted, and the badge has to name them or the operator cannot act. |
| **D20** | Deferred constraint trigger as a seat backstop — **the proposal's explicit question to design** | **Viable, and rejected.** | A `constraint trigger ... deferrable initially deferred` on `invitation_guests` DELETE/UPDATE re-checking `seats_confirmed <= count(*)`. | Three reasons, in order of weight. (1) **It is S1 wearing a trigger's clothes.** It aborts the transaction, so removing a member who already confirmed becomes a refusal — the option decision 3 and the proposal both rejected by name, because that is the couple's actual workflow. (2) **It refuses at COMMIT**, after the form has already submitted, with a database error that names no member; the console cannot attribute it. (3) **It would also abort the invitation cascade delete** unless it repeated `0005`'s parent-existence discrimination — a second place that lesson has to be remembered, and `0005`'s comment is explicit that `pg_trigger_depth()` is not the discriminator. The backstop stays `classifyMembershipChangeImpact` + **D24**'s visibility contract. |
| **D21** | `createInvitation`'s discarded compensation (`lib/server/invitations.ts:398`) | Capture the delete's `error` and, when non-null, throw a message naming **both** failures plus the orphaned invitation's `id` and `slug`. | Retrying the delete; logging and swallowing; leaving it. | Today a failed compensation leaves a guestless invitation that can never be unlocked and looks valid in the console, and the thrown message mentions only the guest insert — so the operator is told the wrong thing and given no handle on the row. This function is rewritten by this change anyway; leaving the bug in rewritten code would be choosing it. Retry is wrong: the same client just failed, and PostgREST has no cross-request transaction (`0006`'s premise). |
| **D22** | `scripts/import-guests.ts:101`'s unchecked cast | Replace `return invitations as ImportRow[]` with a Zod `safeParse` over `z.array(importRowSchema)`, reporting only the **first** issue as `data/guests.source.json → invitations[7].guests[1].full_name: expected string, received number`. | Hand-rolled shape checks; parsing every row and reporting all issues; leaving it. | `zod ^4.6.1` is already a runtime dependency (`package.json:32`), so this costs nothing. The requirement's whole point is stopping at the row that introduced the problem: today the failure is a bare `TypeError` from somewhere downstream naming no row, no field and no file. First issue only, because `ZodError.issues` for a malformed array is dominated by cascade noise from the first bad row. `issue.path` maps directly to the message. |
| **D23** | Where `recipient_not_in_household` surfaces | Its own preflight kind, ordered fourth, **expected to be permanently empty** — and that expectation is the assertion. | Collapsing it into `no_recipient_chosen`; omitting it from the preflight; omitting it from `resolveDispatchRecipient`. | `buildDispatchPreflight` already renders all groups unconditionally, zero-count included, so a permanently-zero group is consistent rather than special-cased. Keeping the reason in `resolveDispatchRecipient` is the exploration's point restated: the function takes plain arrays and a function that trusts its caller for an invariant is one refactor from being wrong. The DB test that the FK **refuses** the row that would populate it is what makes "permanently empty" a fact. |
| **D24** | Making the membership badge un-ignorable | A badge on the row **and** a counted line in `scopedMetrics`: `ConsoleSummary` gains `contradictedAnswers: number`, rendered in the existing `countSentence` shape — `"Respuestas que ya no cuadran: 2 de 41 invitaciones de Luzma"`. | Badge only; a toast; an interstitial. | The proposal's own risk row says the badge "must be impossible to miss or it is decoration". A badge lives on one row in a scrolling list and is invisible until you reach it. A count in the same sentence shape as every other console metric is on screen before scrolling, carries its population like every other count in `console-list.ts`, and cannot be styled away without deleting a metric. An interstitial is rejected: it blocks work over a state the couple deliberately chose to allow. |

---

## 3. Migration `0012` and its down script

### `supabase/migrations/0012_invitation_administration.sql`

```sql
-- 0012_invitation_administration.sql — give the couple a real write side.
--
-- Five moves: a nickname, a stored reason for the greeting name, an explicit
-- dispatch recipient held structurally, a seat cap that reads the member count,
-- and the removal of the column that cap used to read.
--
-- 0006 and 0007 are NOT edited. This project supersedes a function in a new
-- migration (0005 over 0003, 0007 over 0003); editing a shipped file would
-- desynchronise every database that already ran it. See design D13.

-- 1 ─ nickname. Optional free text, no uniqueness: two members of one group
--     sharing one is an ADVISORY (decision 10), and a constraint cannot be an
--     advisory.
alter table invitation_guests add column nickname text;
comment on column invitation_guests.nickname is
  'What this person is actually called. Feeds the derived greeting name: a list member contributes nickname else FIRST name, a solo guest nickname else FULL name. NULL means nobody has supplied one.';

-- 2 ─ why the greeting name says what it says.
--     The DEFAULT IS THE WHOLE POINT. 'derived' would mark every imported row
--     derivable and the first membership edit would overwrite a hand-written
--     "Familia Restrepo". 'imported' means a script wrote this and no human has
--     looked at it, which lets the console offer a reset without claiming
--     anyone chose it. Decision 9, design D15.
alter table invitations add column greeting_name_source text not null default 'imported'
  check (greeting_name_source in ('derived', 'custom', 'imported'));
comment on column invitations.greeting_name_source is
  'derived = recompute from members on every membership or nickname write. custom = a human typed it; never overwrite. imported = a script wrote it and nobody has looked.';

-- 3 ─ the composite FK target. `id` is already the primary key, so this index
--     is redundant for lookups and exists solely so (invitation_id, id) can be
--     referenced.
alter table invitation_guests
  add constraint invitation_guests_invitation_id_id_key unique (invitation_id, id);

-- 4 ─ the explicit recipient, held structurally rather than remembered.
--
--     MATCH SIMPLE (the default) is load-bearing and MUST NOT become MATCH
--     FULL. Under SIMPLE the constraint is satisfied whenever ANY referencing
--     column is null, so a null recipient is legal. Under FULL both columns
--     would have to be null together, and `invitations.id` is never null — so
--     MATCH FULL would make "no recipient chosen" a constraint violation, which
--     is the state every invitation starts in.
--
--     THERE IS DELIBERATELY NO `on update` CLAUSE, AND IT MUST NOT BE ADDED.
--     Measured against this instance (17.6), not read from a manual:
--
--       on update set null (dispatch_recipient_guest_id)
--         ERROR: a column list with SET NULL is only supported for ON DELETE
--                actions
--
--       on update set null            -- no column list; accepted, then at runtime:
--         ERROR: null value in column "id" ... violates not-null constraint
--         CONTEXT: UPDATE ONLY "public"."invitations" SET "id" = NULL, ...
--                  (it nulls EVERY referencing column, and one is the PK)
--
--       on update cascade             -- would rewrite invitations.id into a
--                                        collision with the destination row
--
--     The default NO ACTION is therefore what we want, and it is the BACKSTOP:
--     if the trigger below is ever dropped, a move FAILS with a foreign-key
--     error instead of silently producing a cross-household recipient. The
--     clearing itself lives in that trigger. Design D11.
alter table invitations add column dispatch_recipient_guest_id uuid;
alter table invitations
  add constraint invitations_dispatch_recipient_fk
  foreign key (id, dispatch_recipient_guest_id)
  references invitation_guests (invitation_id, id)
  on delete set null (dispatch_recipient_guest_id);
comment on column invitations.dispatch_recipient_guest_id is
  'The member this invitation is addressed to. NULL means nobody has chosen, which BLOCKS dispatch on purpose (decision 2). Never backfilled from is_primary.';

-- 5 ─ moving a guest clears the choice. This is what the FK cannot do (D11),
--     and a trigger is house style here rather than a workaround: append-only
--     (0003/0005) and the seat cap (0007) are both triggers for the same
--     reason, that service_role carries BYPASSRLS and a policy binds nothing
--     against our own server code. A trigger binds against every writer.
--
--     BEFORE, so the clear lands before the row change and unambiguously ahead
--     of any constraint check. Scoped `update of invitation_id`, so an ordinary
--     phone or nickname edit never enters the function.
--
--     It clears the SOURCE only and sets nothing on the destination. Carrying
--     the choice across would be an auto-pick nobody made, which decision 2
--     removed. After a move the source reports no_recipient_chosen, a state the
--     preflight already handles. Design D25.
create function clear_recipient_on_guest_move() returns trigger language plpgsql as $$
begin
  if new.invitation_id is distinct from old.invitation_id then
    update invitations
       set dispatch_recipient_guest_id = null
     where id = old.invitation_id
       and dispatch_recipient_guest_id = old.id;
  end if;

  return new;
end $$;

create trigger invitation_guests_clear_recipient_on_move
  before update of invitation_id on invitation_guests
  for each row execute function clear_recipient_on_guest_move();

-- 0004's event trigger already revokes this, because `alter default privileges`
-- never covered FUNCTIONS and PostgREST would otherwise publish it as an
-- anon-callable RPC. Stated here too so a reader never has to infer it from
-- another migration (0006's precedent).
revoke all on function clear_recipient_on_guest_move()
  from public, anon, authenticated;

-- 6 ─ the cap now reads the member count.
--     0007's two checks and THEIR ORDER are reproduced verbatim. The hard cap
--     is evaluated FIRST so an over-cap submission still fails for the cap's own
--     reason: 0007 forces named = seats_confirmed in every legitimate
--     submission, so an over-cap row almost always trips parity too, and
--     checking parity first would send the operator to fix the wrong field.
--     count(*) additionally never returns NULL, unlike the old
--     `select seats_allowed into cap`, where a missing parent made `x > NULL`
--     null and the cap silently passed.
create or replace function enforce_seat_cap() returns trigger language plpgsql as $$
declare
  cap   int;
  named int := cardinality(new.attendee_guest_ids);
begin
  select count(*)::int into cap
    from invitation_guests
   where invitation_id = new.invitation_id;

  if new.seats_confirmed > cap or named > cap then
    raise exception 'seats_confirmed % exceeds the % named members of this invitation',
      new.seats_confirmed, cap;
  end if;

  if named <> new.seats_confirmed then
    raise exception 'seats_confirmed % does not match attendee_guest_ids of length %',
      new.seats_confirmed, named;
  end if;

  return new;
end $$;

-- 7 ─ REPORT BEFORE DESTROYING. Any row whose stored allowance already
--     disagreed with its member count is a row the down script cannot restore
--     exactly, so it is named here while the value still exists.
do $$
declare r record;
begin
  for r in
    select i.id, i.display_name, i.seats_allowed, count(g.id)::int as members
      from invitations i
      left join invitation_guests g on g.invitation_id = i.id
     group by i.id, i.display_name, i.seats_allowed
    having i.seats_allowed <> count(g.id)
  loop
    raise notice
      'seats_allowed % disagrees with % named members for "%" (%). A revert restores the member count, not this value.',
      r.seats_allowed, r.members, r.display_name, r.id;
  end loop;
end $$;

alter table invitations drop column seats_allowed;

-- 8 ─ the importer, superseded rather than edited (D13). Identical to 0006
--     except: no seats_allowed, guests carry nickname, and greeting_name_source
--     is left to its 'imported' DEFAULT so the importer has no way to write the
--     wrong value.
create or replace function import_invitations(payload jsonb) returns jsonb
language plpgsql as $$
declare
  item          jsonb;
  guest         jsonb;
  new_id        uuid;
  existing_slug text;
  row_key       text;
  outcome       jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception 'import_invitations expects a JSON array, got %',
      coalesce(jsonb_typeof(payload), 'null');
  end if;

  for item in select value from jsonb_array_elements(payload) loop
    new_id := null;
    existing_slug := null;
    row_key := nullif(btrim(coalesce(item->>'source_key', '')), '');

    if row_key is null then
      raise exception 'every imported invitation needs a source_key; the import is not re-runnable without one';
    end if;

    insert into invitations (
      slug, owner_sender_id, display_name, greeting_name, rsvp_deadline, source_key
    )
    values (
      item->>'slug',
      (item->>'owner_sender_id')::uuid,
      item->>'display_name',
      item->>'greeting_name',
      (item->>'rsvp_deadline')::date,
      row_key
    )
    on conflict (source_key) do nothing
    returning id into new_id;

    if new_id is null then
      select i.slug into existing_slug from invitations i where i.source_key = row_key;

      if existing_slug is null then
        raise exception 'invitation % was neither created nor already present', row_key;
      end if;

      outcome := outcome || jsonb_build_object(
        'source_key', row_key, 'slug', existing_slug, 'created', false);
      continue;
    end if;

    for guest in select value from jsonb_array_elements(coalesce(item->'guests', '[]'::jsonb)) loop
      insert into invitation_guests (
        invitation_id, full_name, nickname, phone_e164, is_primary, is_child
      )
      values (
        new_id,
        guest->>'full_name',
        nullif(btrim(coalesce(guest->>'nickname', '')), ''),
        guest->>'phone_e164',
        coalesce((guest->>'is_primary')::boolean, false),
        coalesce((guest->>'is_child')::boolean, false)
      );
    end loop;

    outcome := outcome || jsonb_build_object(
      'source_key', row_key, 'slug', item->>'slug', 'created', true);
  end loop;

  return outcome;
end $$;

revoke all on function import_invitations(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
```

### `supabase/down/0012_invitation_administration_down.sql`

Reverse order. Two honesty notes belong in the file itself, not only here.

```sql
-- Restores the pre-0012 schema. Two things a revert CANNOT restore, stated
-- rather than hidden:
--
--  1. seats_allowed is recreated from count(*), which is exactly the value the
--     derived rule defines. It is therefore lossless under the new rule and
--     WRONG for any row that already disagreed. 0012 named those rows with a
--     NOTICE before dropping the column.
--  2. 0001's check is `between 1 and 12`. A zero-member or >12-member
--     invitation created after 0012 has no legal value, so it is CLAMPED and
--     named. Clamping is preferred to failing the revert: a revert that cannot
--     run is not a rollback plan.

drop trigger if exists invitation_guests_clear_recipient_on_move on invitation_guests;
drop function if exists clear_recipient_on_guest_move();

alter table invitations drop constraint if exists invitations_dispatch_recipient_fk;
alter table invitations drop column if exists dispatch_recipient_guest_id;
alter table invitation_guests drop constraint if exists invitation_guests_invitation_id_id_key;
alter table invitations drop column if exists greeting_name_source;
alter table invitation_guests drop column if exists nickname;

alter table invitations add column seats_allowed int;

do $$
declare r record;
begin
  for r in
    select i.id, i.display_name, count(g.id)::int as members
      from invitations i
      left join invitation_guests g on g.invitation_id = i.id
     group by i.id, i.display_name
  loop
    if r.members < 1 or r.members > 12 then
      raise notice 'invitation "%" (%) has % members, outside 0001''s 1..12 check; seats_allowed clamped.',
        r.display_name, r.id, r.members;
    end if;

    update invitations
       set seats_allowed = least(12, greatest(1, r.members))
     where id = r.id;
  end loop;
end $$;

alter table invitations alter column seats_allowed set not null;
alter table invitations
  add constraint invitations_seats_allowed_check check (seats_allowed between 1 and 12);

-- Restore 0007's body verbatim (cap from seats_allowed, cap checked first).
create or replace function enforce_seat_cap() returns trigger language plpgsql as $$
declare
  cap   int;
  named int := cardinality(new.attendee_guest_ids);
begin
  select seats_allowed into cap from invitations where id = new.invitation_id;

  if new.seats_confirmed > cap or named > cap then
    raise exception 'seats_confirmed % exceeds seats_allowed %', new.seats_confirmed, cap;
  end if;

  if named <> new.seats_confirmed then
    raise exception 'seats_confirmed % does not match attendee_guest_ids of length %',
      new.seats_confirmed, named;
  end if;

  return new;
end $$;

-- Restore 0006's import_invitations verbatim (seats_allowed present, no nickname).
-- ... full 0006 body, copied ...

notify pgrst, 'reload schema';
```

### Required DB tests (`supabase/tests/`)

| Test | Why it exists |
|---|---|
| FK **refuses** a `dispatch_recipient_guest_id` belonging to another invitation, **and permits** one belonging to this one | The refusal alone passes against a broken-everything constraint |
| Moving a guest who is the recipient **clears** it; moving a guest who is not leaves it alone | The trigger's condition, both branches |
| Dropping the trigger and repeating the move makes the move **fail** with a foreign-key error | Proves the default `NO ACTION` really is the backstop D11 claims, and pins probe 3's behaviour so a future `on update` clause cannot be slipped in unnoticed |
| A move leaves the **destination** invitation's recipient untouched | D25: the choice is cleared, never carried. Without this, an auto-pick could be re-introduced and no test would notice |
| Deleting the recipient guest sets the column null; the invitation survives | `on delete set null (col)` — probe 4 under real schema and real load |
| Deleting an **invitation** that has a chosen recipient still cascades and succeeds | Two FKs point in opposite directions between these tables. `0005`'s lesson: this is verified, never assumed |
| `enforce_seat_cap` rejects over-cap **and** rejects parity mismatch, with cap reported first | The `0007` ordering, re-asserted against the new message |
| `0005` does not regress: direct delete on `dispatch_events`/`rsvp_responses` still raises; the invitation cascade still passes | Named in the brief as a standing hazard |
| `anon` cannot execute `clear_recipient_on_guest_move` | `alter default privileges` never covers FUNCTIONS |

---

## 4. Pure domain modules — exact signatures

All six live under `lib/domain/**`: no I/O, no React, no vendor SDK, `environment: 'node'`, zero mocking. Randomness and clocks are arguments (D2) — none of these six needs either.

```ts
// lib/domain/spanish-list.ts
// Joins PROPER NOUNS inside a phrase. It never produces a disjunction, so
// `o → u` is deliberately NOT implemented, and the sentence-initial
// interrogative exception is unreachable. Do not add them "for completeness".
export function spanishConjunction(nextItem: string): "y" | "e";
export function joinSpanishList(items: readonly string[]): string; // no Oxford comma

// lib/domain/guest-name.ts
export interface NameableGuest {
  readonly fullName: string;
  readonly nickname: string | null;
}
export function firstName(fullName: string): string;
export function soloAddressName(guest: NameableGuest): string;  // nickname ?? fullName
export function listMemberName(guest: NameableGuest): string;   // nickname ?? firstName(fullName)

// lib/domain/greeting-name.ts
export type GreetingNameSource = "derived" | "custom" | "imported";
/** THROWS on an empty list (decision 11). An invitation with no members must not exist. */
export function deriveGreetingName(members: readonly NameableGuest[]): string;
export function resolveGreetingName(input: {
  readonly source: GreetingNameSource;
  readonly stored: string;
  readonly members: readonly NameableGuest[];
}): string;

// lib/domain/dispatch-recipient.ts
export interface IdentifiedDispatchGuest extends DispatchCandidateGuest {
  readonly id: string;
}
export type DispatchRecipientProblem =
  | "no_recipient_chosen"
  | "recipient_not_in_household"
  | "recipient_has_no_phone"
  | "recipient_phone_unreachable";
export type DispatchRecipientOutcome =
  | { readonly ok: true; readonly guest: IdentifiedDispatchGuest; readonly phoneE164: string }
  | { readonly ok: false; readonly reason: DispatchRecipientProblem };
export function resolveDispatchRecipient(
  guests: readonly IdentifiedDispatchGuest[],
  chosenGuestId: string | null,
): DispatchRecipientOutcome;

// lib/domain/invitation-draft.ts
export interface InvitationDraftMember {
  readonly id: string | null;            // null = a row the form added, not yet persisted
  readonly fullName: string;
  readonly nickname: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
  readonly dispatchable: boolean;        // computed upstream, as DispatchCandidateGuest already is
}
export interface InvitationDraft {
  readonly displayName: string;
  readonly greetingName: string;
  readonly greetingNameSource: GreetingNameSource;
  readonly members: readonly InvitationDraftMember[];
  readonly dispatchRecipientGuestId: string | null;
  readonly rsvpDeadline: string | null;
}
export type DraftRefusal =
  | "no_members" | "member_without_name" | "duplicate_member_id"
  | "recipient_not_a_member" | "custom_name_empty";
export type DraftAdvisory =
  | "duplicate_nickname" | "recipient_has_no_phone" | "recipient_phone_unreachable";
export interface DraftValidation {
  readonly refusals: readonly DraftRefusal[];
  readonly advisories: readonly DraftAdvisory[];
}
export function validateInvitationDraft(draft: InvitationDraft): DraftValidation;

export type MoveRefusal = "would_empty_source" | "member_not_in_source" | "same_invitation";
export type MoveOutcome =
  | { readonly ok: true; readonly clearsSourceRecipient: boolean }
  | { readonly ok: false; readonly reason: MoveRefusal };
/**
 * Decision 11's refusal, and D25's ordering. This runs BEFORE any SQL is
 * issued, so a refused move never becomes a statement and can never contend
 * with `clear_recipient_on_guest_move`. `clearsSourceRecipient` is what the UI
 * warns about up front; the trigger is what actually performs the clear.
 */
export function canMoveMember(input: {
  readonly sourceMemberIds: readonly string[];
  readonly memberId: string;
  readonly sourceRecipientGuestId: string | null;
  readonly destinationInvitationId: string;
  readonly sourceInvitationId: string;
}): MoveOutcome;

export interface ContradictedAnswer {
  readonly rsvpResponseId: string;
  readonly seatsConfirmed: number;
  /** Attendee ids no longer belonging to this invitation. Never dropped, never crashed on. */
  readonly danglingGuestIds: readonly string[];
}
export interface MembershipChangeImpact {
  readonly removedGuestIds: readonly string[];
  readonly contradictedAnswers: readonly ContradictedAnswer[];
  readonly seatsConfirmedExceedsMembers: boolean;
}
export function classifyMembershipChangeImpact(input: {
  readonly memberIdsBefore: readonly string[];
  readonly memberIdsAfter: readonly string[];
  readonly latestAnswer: {
    readonly id: string;
    readonly attending: boolean;
    readonly seatsConfirmed: number;
    readonly attendeeGuestIds: readonly string[];
  } | null;
}): MembershipChangeImpact;

// lib/domain/invitation-deletion.ts
export type DeletionRefusal = "already_dispatched";
export type DeletionOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: DeletionRefusal; readonly eventKinds: readonly string[] };
/** ANY dispatch_events row refuses, including link_opened and marked_failed (decision 8). */
export function canDeleteInvitation(
  events: readonly { readonly kind: string }[],
): DeletionOutcome;
```

**Modified, not new**: `lib/domain/dispatch-message.ts` loses `selectDispatchRecipient`, `DispatchRecipientProblem` and `DispatchRecipientOutcome` (they move to `dispatch-recipient.ts` under the new names); `DispatchCandidateGuest` gains `readonly id: string`.

---

## 5. The verified `seats_allowed` inventory

**200 occurrences across 45 source/test/migration files** — `lib` 11, `e2e` 11, `supabase` 10, `components` 8, `app` 3, `scripts` 2. Two independent counts agree on every one of those directories (C3). **5 are frozen migration history, so 40 files change.** Grouped by what each one needs:

### A — Frozen. Do not touch (5)

`supabase/migrations/0001_schema.sql` · `0003_triggers.sql` · `0006_import_invitations.sql` · `0007_seat_attendee_parity.sql` · `supabase/down/0007_seat_attendee_parity_down.sql`

Migration history is the record of what already ran. `0012` supersedes; it does not rewrite (D13). The `grep`-clean success criterion must be scoped **outside migration history**, exactly as the proposal words it.

### B — Delete the concept outright (2 files, ~105 lines, almost all deletions)

| File | What goes |
|---|---|
| `scripts/import-guests.ts` | `SeatMismatch` interface, `seatMismatches` from `ImportAdvisory`, the mismatch loop in `buildImportAdvisory` (`:153-159`), the "Seats:" block in `formatImportAdvisory` (`:217-226`), and the `seatsAllowed` example in the doc comment. The warning is meaningless once the count *is* the allowance. |
| `scripts/import-guests.spec.ts` | Every seat-mismatch test and its fixture helper (`:140-160`, `:223`, `:259`) |

### C — Derive from the member count (6 files, ~125 lines)

| File | Change |
|---|---|
| `lib/domain/seats.ts` | `validateRsvpSelection(selection, seatsAllowed)` → `(selection, memberCount)`. Reasons `seats_exceed_allowed`/`attendees_exceed_allowed` keep their names — the reason is unchanged, only its source is |
| `lib/domain/console-list.ts` | 8 sites: `ConsoleListRow.seatsAllowed` → `memberCount` (D17), `ConsoleSummary.seatsAllowed` → `seats`, the accumulator, the `scopedMetrics` line, the `assembleConsoleRows` mapping now `invitation.guests.length` |
| `lib/server/invitations.ts` | 18 sites: drop from `InvitationRow`, `INVITATION_SELECT` (×2), `toRecord` (×2), `createInvitation`'s insert, `importInvitations`'s payload, `InvitationRecord`/`NewInvitation`/`ImportRow` types, and **delete `MAX_SEATS_ALLOWED` and the `:153-158` validation entirely** |
| `lib/server/rsvp.ts` | Cap sourced from `invitation.guests.length`; the `:27` comment updated to name `0012` |
| `app/i/[slug]/actions.ts` | `record.seatsAllowed` → `record.guests.length` at `:144` |
| `app/i/[slug]/page.tsx` | Stop passing the prop at `:142` |

### D — Copy change: the sentence now names members (4 files, ~65 lines)

| File | Change |
|---|---|
| `components/invitation/InvitationBody.tsx` | `seatsSentence(seatsAllowed)` → a sentence naming the household's members. The `seatsAllowed` prop leaves `InvitationBodyProps` |
| `components/invitation/RsvpAnswer.tsx` | `allowanceSpent` and the `seatsSelectionSentence` call read the member count |
| `lib/domain/rsvp-copy.ts` | `seatsSelectionSentence(selected, seatsAllowed)` → `(selected, memberCount)`; guest-facing Spanish reworded from "lugares reservados" to the members themselves |
| `components/console/GuestList.tsx` | `:90` and `:93` — `"N de M lugares confirmados"` / `"M lugares"` become member-count phrasing |

### E — Seed helpers: the change that collapses everything downstream (3 files, ~18 lines)

`e2e/helpers/seed.ts` · `e2e/helpers/console.ts` · `supabase/tests/helpers/db.ts`

All three already default `seatsAllowed ?? options.guests.length`. Remove the option and the column from their INSERTs, and **every** call site downstream becomes a one-line property **deletion**. This is why the 40-file number overstates the work: most of it is `-  seatsAllowed: 3,`.

### F — Fixture deletions only, one to four lines each (19 files, ~40 deletions)

`e2e/phone-gate.spec.ts` · `e2e/console-guest-list.spec.ts` · `e2e/console-dispatch.spec.ts` · `e2e/rsvp.spec.ts` · `e2e/console-wedding.spec.ts` · `e2e/console-design.spec.ts` · `e2e/invitation-page-og.spec.ts` · `e2e/console-preview.spec.ts` · `e2e/invariants/rls.spec.ts` · `components/console/ProgressSummary.spec.tsx` · `components/console/GuestList.spec.tsx` · `components/console/DispatchPreflight.spec.tsx` · `components/invitation/RsvpAnswer.spec.tsx` · `components/invitation/InvitationBody.spec.tsx` · `lib/domain/og-card.spec.ts` · `lib/domain/dispatch-preflight.spec.ts` · `app/i/[slug]/actions.spec.ts` · `lib/server/dispatch.spec.ts` · `supabase/tests/rls.spec.ts`

**That is 9 E2E specs, not the six the proposal names**, plus the 2 helpers in group E.

### G — Assertions that must be RE-DERIVED, never patched to pass (5 files, ~70 lines)

| File | Why it cannot be patched |
|---|---|
| `supabase/tests/seat-parity.spec.ts` | `:142` asserts the literal `"exceeds seats_allowed 2"`. The message changes because the *rule* changed. Re-derive the expectation from the new cap source, keeping the cap-before-parity ordering assertion |
| `supabase/tests/append-only.spec.ts` | `:163`, `:187` — same two messages |
| `supabase/tests/rsvp-store.spec.ts` | `:162` — `/exceeds seats_allowed/` |
| `lib/server/invitations.spec.ts` | 9 sites. `:133` *"rejects a seats_allowed of zero, which the hard cap forbids"* is **deleted**: the rule it tests no longer exists. Deleting a test is the correct action here and must be visible in the diff, not quietly dropped |
| `lib/domain/console-list.spec.ts` | 10 sites. `:94` `expect(summary.seatsAllowed).toBe(12)` becomes a member-count sum — re-derive the fixture totals, do not adjust the number until it passes |

---

## 6. Sequencing, slices, and the budget

Dependency order is the delivery order: **migration → pure domain → repository and Server Actions → console UI and E2E**. Nothing in a later slice compiles without its predecessor.

Line estimates are measured against comparable existing files in this repository (`console-list.ts` 380 lines, `dispatch-preflight.ts` 243, `invitations.ts` 710+, `0006` 116), not guessed from feature size. This project writes long, heavily commented modules and pairs every refusal with its permitting case, so the test-to-source ratio runs near 1:1.

| Slice | Content | Est. authored lines | vs **400** | vs **800** |
|---|---|---|---|---|
| **1** | `0012` + down + DB tests (~390) **and the entire `seats_allowed` removal across 40 files** (~420) | **≈ 810** | **2.0× over** | **at the line / over** |
| **2** | Six pure domain modules + their unit tests; `dispatch-message` removal; preflight rename | **≈ 1,260** | **3.2× over** | **1.6× over** |
| **3** | `lib/server/invitations.ts` write side + spec; Server Actions + spec; importer Zod parse + `nickname`; D21 compensation fix | **≈ 1,260** | **3.2× over** | **1.6× over** |
| **4** | `/console/invitations/{new,[id]/edit}`, the form client component, `GuestList` recipient indicator and empty-state copy, component specs, E2E, re-derived readiness E2E | **≈ 1,270** | **3.2× over** | **1.6× over** |
| | **Total** | **≈ 3,800 – 4,800** | | |

**Every one of the four chosen slices exceeds both budgets.** Saying otherwise would require an estimate the file sizes in this repository do not support. **The proposal's ≈2,150–2,550 total is low by roughly half**, and the gap is concentrated in tests: the proposal costed the six domain modules at ≈600 total, which is about what `spanish-list` and `greeting-name` alone cost once the sixteen-row conjunction table and the paired permitting cases are written.

**Why slice 1 cannot be split further.** Dropping a column is one statement, and at that statement every `INVITATION_SELECT` naming `seats_allowed` starts returning a PostgREST error, every seed helper's INSERT fails, and `npm test` is red. The 40 files cannot land in a later commit without a knowingly-red intermediate commit, which `strict_tdd: true` forbids.

The standard escape is expand/contract — **1a** stop *reading* the column everywhere while still writing it, **1b** drop it. That split is available and it does **not** buy budget: the 40 files are all in 1a either way, so 1a is ~700 lines and 1b is ~110. What it buys is that the destructive statement lands alone, after a commit that is already green without it. **Recommended if and only if the operator wants the destructive step isolated**; it costs one extra migration and one extra deploy and does not bring any commit under 400.

**Where the other three do split cleanly**, if the four-slice decision is revisited:

| | Sub-slice | Est. |
|---|---|---|
| 2a | `spanish-list` · `guest-name` · `greeting-name` + tests | ≈ 530 |
| 2b | `dispatch-recipient` · `invitation-draft` · `invitation-deletion` + tests; preflight rename; `selectDispatchRecipient` removal | ≈ 730 |
| 3a | Repository write side + spec (create, update, member CRUD, move, chooseRecipient, delete, rotate) | ≈ 750 |
| 3b | Server Actions + spec; importer Zod parse + `nickname`; D21 | ≈ 510 |
| 4a | Routes, form component, live derived name, recipient radio + component specs | ≈ 700 |
| 4b | `GuestList` recipient indicator and empty-state copy; E2E including re-derived readiness counts | ≈ 570 |

Eight slices bring every commit under 800 and none under 400.

**Guard lines** (`sdd-tasks` must reproduce these):

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High
```

---

## 7. The preflight blocker rename (B11)

Every current kind, from `lib/domain/dispatch-preflight.ts:47-48`, and its new name:

| Current kind | New kind | Meaning change |
|---|---|---|
| `no_phone_on_file` | **`recipient_has_no_phone`** | **Yes.** Today: *nobody* in the household has a number. After: *the chosen person* has none. A household where the partner holds a mobile is now blocked |
| `no_reachable_phone` | **`recipient_phone_unreachable`** | **Yes.** Today: no member's number can carry WhatsApp. After: the chosen person's cannot |
| `already_dispatched` | **`already_dispatched`** — unchanged | **No.** Its meaning is untouched, so renaming it would be churn that hides the two that did change |
| — | **`no_recipient_chosen`** (new, first) | New. The most actionable group, and on day one the largest |
| — | **`recipient_not_in_household`** (new, fourth) | New, and permanently empty by construction (D23) |

```ts
export const PREFLIGHT_BLOCKER_ORDER: readonly PreflightBlockerKind[] = [
  "no_recipient_chosen",
  "recipient_has_no_phone",
  "recipient_phone_unreachable",
  "recipient_not_in_household",
  "already_dispatched",
];
```

`PreflightBlockerKind` now equals `DispatchRecipientProblem | "already_dispatched"`, so `classify()`'s `if (recipient.reason === ...)` translation at `:171-183` collapses into a pass-through. `GROUP_COPY` gains two Spanish entries and the two renamed entries are rewritten — the existing copy says *"Nadie de estas invitaciones tiene un número guardado"*, which becomes false under the new meaning and is exactly the stale-string failure B11 exists to prevent.

Every E2E readiness-count assertion moves. Re-derive them from the new classification; do not adjust numbers until green.

---

## 8. Data flow — create and edit

```
Operator types a nickname in the form
   │
   │  components/console/InvitationForm.tsx   'use client'
   ├──► deriveGreetingName(members)  ◄── lib/domain/greeting-name.ts ──┐
   │        live preview, source stays 'derived'                        │
   │        operator edits the field → source becomes 'custom';         │  ONE FILE
   │        the derived value stays visible beside it (B3)              │  TWO BUNDLES
   │                                                                    │  NO DRIFT (D14)
   ▼  submit                                                            │
app/console/(authenticated)/actions.ts   'use server'                    │
   ├──► validateInvitationDraft(draft)                                   │
   ├──► resolveGreetingName({source, stored, members}) ◄─────────────────┘
   ├──► classifyMembershipChangeImpact({before, after, latestAnswer})   → advisories
   ▼
lib/server/invitations.ts   ('server-only' first line)
   ├── insert/update invitations  (greeting_name + greeting_name_source together)
   ├── insert/update/delete invitation_guests
   ├── set dispatch_recipient_guest_id       ── composite FK refuses a foreign member
   └── move a guest: update invitation_guests.invitation_id
                          │
                          ▼  BEFORE UPDATE OF invitation_id
                     clear_recipient_on_guest_move()  → recipient cleared (D11)
                          │
                          ▼  end of statement
                     invitations_dispatch_recipient_fk  → backstop if the trigger is gone
```

The greeting name and its source are written by **one** repository function, never by two call sites — the mitigation exploration §1 named for shape A's only real cost.

---

## 9. Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | All six new domain modules | Vitest `environment: 'node'`, zero mocking. Table-driven for the sixteen conjunction rows including `Ian`, `Yolanda`, `Hierro`, NFD `Íñigo`, `"  Inés"`. One test asserts **no Oxford comma**. One test asserts the same `{fullName:"Luis Guzmán", nickname:null}` yields `"Luis Guzmán"` solo and `"Luis"` in a list — the distinction a single flagged function would collapse |
| Unit — refusals | `deriveGreetingName([])` throws · `resolveDispatchRecipient(_, null)` · `canDeleteInvitation` with any event · `canMoveMember` refusing `would_empty_source` | **Every refusal ships its permitting counterpart in the same test**, so the assertion can fail when the refusal is removed (`strict_tdd: true`). For `canMoveMember` the pair is a two-member source (refused) against a three-member source (allowed, `clearsSourceRecipient: true` when the moved guest is the chosen one) |
| Integration — D25 ordering | `moveMemberToInvitation` on a two-member source | Asserts the repository returns the refusal **and issues no write at all** — the fake client records zero calls. A refusal that still touched the database would let the trigger and the emptiness rule contend, which D25 says they never can |
| Component | `InvitationForm` (jsdom) | Typing a nickname updates the preview; touching the name field flips to `'custom'`; reset returns to `'derived'`; **no recipient radio is selected on mount** |
| DB | `supabase/tests/` via `pg` | The eight tests in §3 |
| Integration | `lib/server/**` with a repository fake | D21: guest insert fails **and** compensation fails → the thrown message names the orphaned invitation id. D22: a malformed source row → the message names file, index and field |
| E2E | Playwright, phone viewport | Create a group, watch the derived name appear, override it, add a member, confirm the override survived. Dispatch blocked before a recipient is chosen and unblocked after. Deletion refused on a dispatched invitation with rotation offered instead. Rotation makes the old URL stop resolving and the path-scoped cookie unusable. Removing a member named in a confirmed RSVP **succeeds** and produces a visible advisory. A stored `attendee_guest_ids` holding a deleted id renders that guest as removed — neither crashing nor silently shortening the answer |

---

## 10. Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | **N/A** | No file-classification or execution-of-content boundary |
| Git repository selection | **N/A** | The app never shells out to `git` |
| Commit / Push / PR commands | **N/A** | No VCS automation in this change |
| Shell / subprocess | **N/A** | `scripts/import-guests.ts` runs under `tsx` and spawns nothing |

The change does carry an **HTTP route-authorization** boundary — new `/console/invitations/**` routes — which this matrix does not cover. It is handled by the existing `app/console/(authenticated)/layout.tsx` guard: the new routes sit **inside** that route group and acquire `requireOperator()` plus the device-declaration gate with no new authorization axis. Confirmed decision 4 removes owner scoping from **writes only**; dispatch remains gated by the per-device declaration, and `actor_sender_id` still records who acted.

---

## 11. Migration / Rollout

Per the proposal's rollback plan, unchanged, plus:

- **Before deploy, tell the couple**: every existing undispatched invitation becomes un-dispatchable until someone chooses a recipient. The first preflight run shows a large `no_recipient_chosen` group. Expected, not discovered. **Do not backfill from `is_primary`** (decision 12).
- **The import source file is a one-way door.** Keep the pre-change copy; reverting slice 1 reverts the format too.
- Slice 1 is the only destructive slice and the only one needing a data-restoring down script.

---

## 12. Open Questions

- [x] ~~C1/C2 — whether the composite FK's `on update set null (col)` form works.~~ **Settled by measurement against the live PostgreSQL 17.6** (§0.1). It does not exist; D11 replaces it with a trigger, also measured. Nothing here is still open.
- [ ] Guest-facing Spanish for the member-count sentences replacing "lugares reservados" in `InvitationBody`, `RsvpAnswer` and `rsvp-copy` (group D). Copy, not structure; does not block slice 1.
- [ ] Whether the four-slice commit plan stands given that all four exceed 800, or the eight sub-slices in §6 are adopted. `sdd-tasks` must surface this; `sdd-apply` must not start slice 1 until it resolves.
- [ ] `openspec/config.yaml` says `delivery_strategy: ask-on-risk` at 800 lines; the proposal says `single-pr`; the phase brief says 400. One of the three has to become the recorded value before apply.
