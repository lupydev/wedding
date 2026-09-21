# A directory of guests, and invitations assembled from it

## Objective

The couple's words: "no veo la lista de invitados por ninguna parte, lo que veo
es que los invitados se deben crear con una invitación… debemos tener presente
poder tener un CRUD de invitados y la creación de invitaciones donde se pueda
agregar un invitado y poder modificar el nombre de la invitación y eliminarla…
cuando un invitado pertenece a una invitación no debe poder pertenecer a otra,
no se debería poder escoger en una próxima invitación."

## The findings that shaped the plan

Four facts, all verified against the schema and the running code before any of
this was planned.

**1. A guest without an invitation is impossible to store today.**
`invitation_guests.invitation_id uuid **not null**`
(`supabase/migrations/0001_schema.sql:44`). That single word is the whole reason
there is no guest list in the console: a guest has nowhere to live outside a
household. This is the migration.

**2. "A guest cannot belong to two invitations" is already true — and the half
that is NOT true is the one that matters.** One guest ROW carries one
`invitation_id`, so by construction it is never in two places. What nothing
prevents is the same PERSON existing as two rows in two households: they are
unrelated records and no check compares them. The only duplicate rule that
exists, `duplicate_member_id` in `lib/domain/invitation-draft.ts:63`, looks
WITHIN one draft. So the directory is not defending an invariant the database
already holds; it is defending against inviting one person twice without
anybody noticing.

**3. RLS will not fight this.** `0002_rls.sql` is default-deny with ZERO
policies — no policy joins through `invitations` to authorize a guest row, so a
guest whose `invitation_id` is NULL breaks no authorization path. The file says
adding any policy to these tables is a spec violation; nothing here adds one.

**4. The pieces for "release a guest" already exist, and were built for the
neighbouring case.** `invitations_dispatch_recipient_fk` is composite —
`(id, dispatch_recipient_guest_id) references invitation_guests (invitation_id,
id)` (`0012:130`) — so a released guest, whose `invitation_id` is NULL, cannot
be referenced by any invitation at all. NULL matches nothing, which is exactly
the rule we want and we get it for free. And
`invitation_guests_clear_recipient_on_move` (`0012:144`) already fires `before
update of invitation_id` and clears the source invitation's choice, which is
precisely what a release is.

## The decision the couple made

**Deleting an invitation RELEASES its guests; it does not delete them.** Asked
directly, the answer was "vuelven a la libreta". Today the FK says `on delete
cascade`, so the people go with the household — and the first thing a
non-technical operator does is delete a household they assembled wrong, losing
every name and phone number they had just typed.

## The assumption this proceeds under

**A guest in no invitation counts in no total.** They are in the directory, not
invited yet — so the dashboard's "Personas confirmadas: N de M" and the
readiness panel keep counting only guests that belong to an invitation, which
is what they do today with no change. Stated rather than asked, because every
figure on that screen is already derived from the invitation join.

## Delivery

Three work units, each shippable on its own, committed to
`feat/whatsapp-wedding-invitations` as every unit this session has been.
Forecast is well past the 400-line heuristic for the feature as a whole, which
is why it is three units and not one.

- [x] **U1 — the schema can hold an unassigned guest, and a deleted invitation
      releases its people.** Migration 0015: `invitation_guests.invitation_id`
      becomes nullable and its FK becomes `on delete set null`. Verify against
      the running database that the release actually fires and that the
      recipient trigger does not fight the delete ordering. Down script in the
      expand-then-drop style of 0013/0014, refusing rather than corrupting if
      any released guest exists.
- [x] **U2 — the directory itself.** `/console/guests`: every guest, with the
      household they belong to or "sin invitación". Create, edit and delete a
      guest from there. One nav entry. This is the "no veo la lista de invitados
      por ninguna parte" half.
- [x] **U3a — creating an invitation from the directory.** The create form
      gains "Agregar de la lista", offering only guests with no invitation;
      typing a new person stays, because it is faster for a household entered
      all at once.
- [ ] **U3b — adding somebody from the directory to an invitation that already
      exists.** The edit screen's "Agregar integrante" writes a new person;
      it should also be able to take a free one. A different write against a
      saved row, with its own action, which is why it is its own unit.

## Checks per unit

`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run build`, `PORT=3100 npx playwright test`. Strict TDD: RED observed
before implementation, in the runner, quoted in this document.

## Known consequences to keep in view

- `invitation_guests_one_primary` is `unique(invitation_id) where is_primary`.
  Each NULL is distinct in a unique index, so many released guests may each
  carry `is_primary = true` without colliding. Harmless, and `is_primary` is
  meaningless for somebody in no household — U2 decides whether to clear it on
  release or leave it.
- `rsvp_responses.attendee_guest_ids` is a plain array with no foreign key, so
  nothing in the database ties it to a released guest. An invitation being
  deleted cascades its answers away, so the deletion path is clean; removing a
  single member from a live invitation is the case where the array can name
  somebody no longer in it, and that is existing behaviour
  (`removeMemberAction`'s discarded `impact`), not something this feature
  introduces.

## Progress

### U1 — done (migration 0015)

`invitation_guests.invitation_id` is nullable and its foreign key is
`on delete set null`. A guest can be written down before any household exists,
and deleting an invitation releases its people instead of deleting them.

**Proven against the running database, not read off a manual.**
`supabase/tests/guest-release.spec.ts` holds five cases, all observed RED first
with `null value in column "invitation_id" ... violates not-null constraint`:

- a guest stores with no invitation at all;
- deleting an invitation leaves all three of its members, all unassigned —
  the COUNT is asserted, because a cascade that took two would leave the third
  looking like a successful release;
- **an invitation that had already chosen a recipient still deletes.** This was
  the one worth writing: `invitations_dispatch_recipient_fk` points at
  `(invitation_id, id)` of the guest, and the release sets that very column to
  NULL while the referencing invitation is being deleted. Two referential
  actions over the same pair of rows is exactly where an ordering problem would
  live. It does not.
- a released guest cannot be addressed by any invitation — NULL matches
  nothing in the composite key, so the couple's "no se debería poder escoger en
  una próxima invitación" is held by the column's shape and not by a check;
- releasing a member of a LIVE invitation clears that invitation's choice, via
  `invitation_guests_clear_recipient_on_move` (0012) meeting a case it was not
  written for.

**The down script refuses rather than corrupts, and that was executed too.**
Two directory guests were seeded and the script run: it named both by name and
id, printed "2 guest(s) are in the directory with no invitation", then failed
with `column "invitation_id" ... contains null values`. Nothing was touched.

**The confirmation copy was lying and now is not.** "Se va a eliminar «X» con
todas las personas que tiene dentro" was true under the cascade; it now reads
"Las personas que tiene dentro vuelven a la lista de invitados: no se borran".
The old sentence frightened an operator away from the one action that fixes a
household assembled wrong — which is the first thing a non-technical operator
does.

Green: 2155 unit and component tests, 173 browser tests, typecheck, lint,
format, build.

**Loose end found on the way, not caused here.** Migration 0014 is applied to
the local database but absent from `supabase_migrations.schema_migrations`;
0015 recorded itself. Worth reconciling before anybody trusts that table.

### U2 — done (`/console/guests`)

The list of PEOPLE, with its own tab. Create, edit and delete a guest; each row
says which household holds them, or that none does.

**Four layers, each tested where its decisions live.**

- `lib/domain/guest-directory.ts` — one alphabetical order through a Spanish
  collator, the two counts, and the "only a name is required" rule. The
  collator is not a detail: `"Ñ" > "Z"` by code point, so the default
  comparison files Peña and Álvaro after Zulema, in a guest list for a
  Colombian wedding.
- `lib/server/guest-directory.ts` — a SEPARATE repository, not four more
  functions in a file of nineteen hundred lines. The boundary is real: nothing
  here takes an invitation id and nothing here moves anybody between
  households. `invitation_id` is deliberately absent from the update, so
  correcting a typo can never empty an invitation as a side effect.
- `components/console/GuestDirectory.tsx` — props-only.
- `app/console/(authenticated)/guests/page.tsx` — a thin async container.

**The tab took the fifth and last seat.** `console-nav.spec.ts` asserts a
ceiling of five, and the reason is recorded there: a sixth needs an overflow
sheet, which is where a destination goes to be forgotten. The new test asserts
both that the directory is present and that the bar is now full.

**A claim I wrote and then had to retract.** The page comment said the
directory was NOT behind the device gate. The browser test built to prove it
failed: `requireDeclaredDevice` is applied by the LAYOUT, over the whole
`(authenticated)` group. The comment now says what is true — the gate is the
layout's, and what this screen does not do is go read-only on a mismatch, which
is the same reasoning that already keeps the inline phone editor writable.

**One component change that came out of a failing browser test and was worth
keeping.** Opening a row's editor moves the name out of the row's text and into
an input's value, so anything locating that row by the name it displays loses
it at exactly the moment somebody is editing. The row now carries
`data-guest-name`, so its identity survives the swap.

**Deleting from here deletes the person, household membership included, and the
invitation survives.** Refusing until they were removed from their household
first would send the operator to another screen to do what they just asked for.
The confirmation says what it costs, naming the household when there is one.

Green: 2202 unit and component tests, 181 browser tests, typecheck, lint,
format, build.

### U3a — done (creating from the directory)

The create form offers the people the directory holds and no household does.
Picking one MOVES that row into the new invitation instead of writing a second
record with the same name — which is the point the couple were making: the
database always made "one guest, one invitation" unrepresentable, and what was
missing was a way to reuse a person rather than retype them.

**The rule is held twice, and the second time is the one that matters.** The
picker is fed `listFreeGuests`, so somebody already placed is never offered.
And `placeGuestInInvitation` carries `invitation_id is null` INSIDE the UPDATE,
so two operators submitting the same person from two phones cannot both win —
one statement matches a row, the other matches none. A read-then-write would
leave a window in which the honest answer changes, and the loser would silently
take somebody out of the other household.

**The order of operations is what makes a refusal clean.** Picked people are
moved FIRST, typed people are written SECOND. If a move is refused, the
compensation deletes the invitation — which releases every already-moved member
back into the directory (0015's `on delete set null`) — and no typed person has
been written yet. Nothing is created and nothing leaks. Done the other way
round, the typed names would be stranded in the directory as people nobody
meant to put there.

**Both kinds of member travel in the same parallel arrays**, distinguished by
one column that is an id or the empty string. A separate list of picked ids
would have lost the interleaved ORDER, and the order is exactly what
`dispatchRecipientIndex` refers to — asserted by choosing the PICKED member at
position 1, so an implementation resolving the index against only the inserted
rows names the wrong person rather than nobody.

**A test I wrote and the implementation corrected.** I had asserted the picked
person lands on card 2, under the blank one a new form opens with. The
implementation consumed that blank card instead, and it was right: an empty
"Integrante 1" above the person just added is refused by the validator on a
form where the operator did nothing wrong. The test now asserts the consuming
rule — and a second one asserts that a card somebody has TYPED into is never
consumed.

**Two stale sentences removed.** The create page still promised "a quién se le
manda el mensaje se elige después de guardar", which the previous commit made
false, and said nothing about the directory.

Green: 2215 unit and component tests, 185 browser tests, typecheck, lint,
format, build.

### Next: U3b — adding a directory guest to an invitation that already exists.
