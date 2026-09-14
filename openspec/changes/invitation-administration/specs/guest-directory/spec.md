# Guest Directory Specification (Delta)

Delta against `openspec/specs/guest-directory/spec.md`. Only requirements that
are added, modified, or superseded are listed here; every other requirement in
the baseline (household-as-invitation model, sender ownership at creation, the
two disjoint-subset senders, guest phone numbers staying server-side, import
from an untracked source) is UNCHANGED and continues to apply as published.

## MODIFIED Requirements

### Requirement: Seat allowance is derived from the member count, and the stored column is removed

This SUPERSEDES the baseline's "Seat allowance per invitation" requirement
(`openspec/specs/guest-directory/spec.md`), which required `invitations` to
carry a `seats_allowed` integer strictly greater than zero, and its scenario
"Seats allowed is always positive". That requirement and its stored column are
REMOVED entirely; there is no replacement column.

The reasoning: `enforce_seat_cap` already requires every confirmed RSVP to
satisfy `seats_confirmed = cardinality(attendee_guest_ids)`, and `submitRsvp`
already requires every id in `attendee_guest_ids` to name a current member of
the invitation. Together these two existing rules already made an UNNAMED seat
unconfirmable before this change — nobody could ever be seated in a seat that
did not correspond to a named member. A stored `seats_allowed` value could
therefore only ever be wrong in one of two directions: set ABOVE the member
count, it reserved seats nobody could take; set BELOW the member count, it
named a cap that excluded a real, named person from ever being confirmed.
Because the invitation's own member count already IS the only number that can
ever be substantiated by a real, confirmed answer, a separately stored cap was
redundant with that count at best and a lie about it at worst. The system now
derives the effective seat cap from `count(*)` of the invitation's current
members wherever the old column was read, including inside `enforce_seat_cap`
itself; the 0007 parity rule and its evaluation order (cap checked before
parity, so an over-cap submission fails for the cap's own reason) are preserved
verbatim.

Removing this field also removes a second refusal that existed alongside it:
because there is no longer a `seats_allowed` value for an operator to lower
below a confirmed count, there is no rule requiring that specific edit to be
refused. What remains is the invitation-administration capability's
membership-change reporting, which is a report, not a refusal.

#### Scenario: The seat cap is the current member count

- GIVEN an invitation with four current members
- WHEN a value is needed to cap the maximum selectable RSVP attendee count
- THEN that value MUST be exactly 4, derived from `count(*)` of the invitation's current `invitation_guests` rows, with no separately stored cap consulted or existing

#### Scenario: seats_allowed is absent from the schema and from every reference

- GIVEN the full, migrated `invitations` schema and the full application source tree
- WHEN the column `seats_allowed` and the identifier `seatsAllowed` are searched for
- THEN neither MUST be found anywhere outside migration history (the migration files themselves, which necessarily reference the column being dropped)

## ADDED Requirements

### Requirement: A member's optional nickname

`invitation_guests` MUST carry an optional `nickname` field, free text, with no
uniqueness constraint at the database level. A guest with no nickname MUST NOT
be treated differently from one whose nickname is an empty value; both fall
through to the full-name or first-name fallbacks defined by the guest-naming
capability.

#### Scenario: A guest with no nickname stored is valid

- GIVEN a guest is created or imported with no nickname provided
- WHEN that guest's row is read
- THEN `nickname` MUST be null, and the row MUST otherwise be a valid, complete guest

#### Scenario: Two members of one invitation may share a nickname

- GIVEN two members of the same invitation
- WHEN both are given the identical nickname value
- THEN both rows MUST save successfully; no database-level uniqueness constraint MUST reject the second write

### Requirement: A stored fact for whether the greeting name may re-derive

Every invitation MUST carry a `greeting_name_source` value of exactly one of
`'derived'`, `'custom'`, or `'imported'`, recording why the currently stored
`greeting_name` has the value it has. `greeting_name` itself remains
materialized on the invitation row exactly as in the baseline, so a read of the
invitation's name never requires a join to its members; `greeting_name_source`
makes "should this value re-derive on the next membership change?" a stored
fact rather than something re-guessed at write time by comparing strings.

An invitation created by the importer MUST be given the distinct value
`'imported'`, never `'derived'`. A default of `'derived'` would mark every
imported row as safe to silently overwrite, and the first membership edit made
through the console would then overwrite a hand-written household name (for
example "Familia Restrepo") with a freshly derived one — exactly the
destruction that the derived/custom distinction exists to prevent.
`'imported'` means specifically: a script wrote this value and no human has
reviewed or chosen it, which is a distinct fact from either "a human typed
this" (`'custom'`) or "this is deliberately kept in sync with membership"
(`'derived'`), and lets the console offer a reset without dishonestly implying
that anyone chose the imported value.

#### Scenario: An imported invitation is marked imported, not derived

- GIVEN a row is created through `scripts/import-guests.ts`
- WHEN the created invitation is read
- THEN `greeting_name_source` MUST be `'imported'`, not `'derived'`

#### Scenario: An imported name is not silently overwritten by a later membership edit

- GIVEN an invitation with `greeting_name_source = 'imported'` and a hand-meaningful stored name
- WHEN a member's nickname is edited through the console without the operator touching the group-name field
- THEN the stored `greeting_name` MUST remain unchanged, because only `'derived'` re-derives automatically; `'imported'` behaves like `'custom'` in this respect until an operator acts on it

### Requirement: A stored, constrained dispatch recipient

Every invitation MUST carry a `dispatch_recipient_guest_id` field, nullable,
which when set MUST reference a member of that SAME invitation and no other.
The dispatch-recipient capability specifies the choice semantics and the
outcomes this field feeds; this requirement covers only the stored fact and its
household-scoping guarantee.

#### Scenario: The field defaults to unset

- GIVEN any invitation, whether created through the console or the importer
- WHEN it is read immediately after creation
- THEN `dispatch_recipient_guest_id` MUST be null

#### Scenario: The field can only ever reference a member of its own invitation

- GIVEN an invitation and a guest belonging to a different invitation
- WHEN an attempt is made to set the invitation's `dispatch_recipient_guest_id` to that guest's id
- THEN the write MUST be refused

## The importer's source format changes — a one-way door

### Requirement: The importer accepts nickname and no longer accepts a seats column

`scripts/import-guests.ts`, `validateImportRow`, the `NewInvitation` type, and
the `import_invitations` SQL function (migration `0006`) MUST accept an
optional `nickname` per guest row, and MUST NOT accept, require, or interpret
any seats/seat-count column, since no such stored value exists to populate.
This is a ONE-WAY DOOR: a source file in the old format, carrying a seats
column and no nickname column, MUST NOT validate against the new importer.

`buildImportAdvisory`'s seats-versus-names warning — which compared a declared
seat count against the number of named guests — is DELETED, not merely
disabled, because the comparison it made is meaningless once there is no
declared seat count to compare against.

#### Scenario: A new-format row with a nickname imports successfully

- GIVEN a source row carrying `nickname` and no seats column
- WHEN the import runs
- THEN the created guest's `nickname` MUST match the source value, and the created invitation MUST have no `seats_allowed`-shaped field to populate

#### Scenario: An old-format row with a seats column is rejected

- GIVEN a source row in the pre-change format, carrying a seats column and no `nickname` column
- WHEN the import runs
- THEN that row MUST be rejected by validation, not silently accepted with the seats column ignored

#### Scenario: The seats-versus-names advisory no longer exists

- GIVEN the importer's advisory-building logic
- WHEN it is inspected for a seats-versus-named-guests comparison
- THEN no such comparison MUST exist in the source
