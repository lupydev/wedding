# Dispatch Recipient Specification

## Purpose

The explicit choice of which household member a dispatch is addressed to: how
the choice is made, what an unresolvable or invalid choice means, and what
happens to the choice when the chosen guest is removed or moved. This is a new
capability; it has no baseline to supersede, though it replaces behaviour
previously described in `invitation-domain` (see that capability's delta) and
consumed by `dispatch-console`'s preflight (see that capability's delta).

## Requirements

### Requirement: No recipient is ever chosen by default

An invitation's dispatch recipient MUST start unset and MUST remain unset until
an operator explicitly chooses one of the invitation's members. The system MUST
NOT infer, pre-select, or auto-pick a recipient from any signal — not the first
member with a phone, not the member flagged `is_primary`, not the only member
with a reachable number. Every dispatch goes to a person somebody chose; that
is the entire point of this capability, and any inference defeats it just as
surely as a wrong inference would.

This requirement removes the previous behaviour entirely: the invitation-domain
capability's `selectDispatchRecipient` used to auto-pick the first household
member carrying a dispatchable phone, with no operator action and no record of
a choice. That auto-pick is REMOVED, not deprecated or hidden behind a flag. It
existed because the console only ever wrote one field, `updateGuestPhone`, and
had no notion of a chosen person at all — the recipient was whichever guest the
data happened to list first. Once the console can create and edit households
directly, that inference is not a convenience, it is the exact failure this
capability closes: a message can leave for a person nobody looked at.

#### Scenario: A newly created invitation has no recipient

- GIVEN an invitation is created through the console with two members, both carrying dispatchable phones
- WHEN the invitation is read immediately after creation
- THEN its dispatch recipient MUST be unset, even though a dispatchable candidate exists

#### Scenario: An imported invitation acquires no recipient

- GIVEN a row is created through the importer with a phone number that is dispatchable
- WHEN the created invitation is read
- THEN its dispatch recipient MUST be unset; the importer MUST NOT populate it from `is_primary` or from any other imported signal

### Requirement: Resolving the chosen recipient

The system MUST resolve a dispatch recipient outcome from an invitation's
current members and a chosen guest id, returning exactly one of:
`no_recipient_chosen` (no id is chosen), `recipient_not_in_household` (the
chosen id names nobody in the current member list), `recipient_has_no_phone`
(the chosen guest has no stored phone number), `recipient_phone_unreachable`
(the chosen guest's stored phone is not dispatchable, for example a landline),
or `ok` (the chosen guest and their dispatchable phone). This function MUST
take the member list and the chosen id as plain arguments and MUST NOT trust an
implicit invariant supplied by its caller — including the database-level
guarantee described below — because a pure function that assumes a caller's
invariant holds is one refactor away from being wrong the day it does not.

Resolution replaces `selectDispatchRecipient`'s two-reason outcome
(`no_phone_on_file` | `no_reachable_phone`, picked automatically) with a
four-reason outcome resolved against an explicit choice. The old function
answered "who can this go to"; this one answers "can it go to the person who
was chosen", which is a different question with a different, larger failure
space, because a choice can now be missing, stale, or dead as well as
unreachable.

#### Scenario: No id chosen resolves to no_recipient_chosen

- GIVEN a household with reachable members but no chosen recipient id
- WHEN the recipient is resolved
- THEN the outcome MUST be `no_recipient_chosen`

#### Scenario: A valid, dispatchable choice resolves to ok

- GIVEN a household member with a chosen id and a dispatchable phone
- WHEN the recipient is resolved with that id
- THEN the outcome MUST be `ok`, carrying that guest and their phone

Both scenarios above MUST be asserted together in the same test: a function
that always returns `no_recipient_chosen` regardless of input would pass the
first scenario alone.

#### Scenario: A chosen id absent from the household resolves to recipient_not_in_household

- GIVEN a chosen guest id that does not appear among the invitation's current members
- WHEN the recipient is resolved with that id
- THEN the outcome MUST be `recipient_not_in_household`

#### Scenario: A chosen guest with no stored phone resolves to recipient_has_no_phone

- GIVEN the chosen guest has no `phone_e164` on file
- WHEN the recipient is resolved with that guest's id
- THEN the outcome MUST be `recipient_has_no_phone`

#### Scenario: A chosen guest with an unreachable phone resolves to recipient_phone_unreachable

- GIVEN the chosen guest's stored phone is a landline, not dispatchable over WhatsApp
- WHEN the recipient is resolved with that guest's id
- THEN the outcome MUST be `recipient_phone_unreachable`

### Requirement: A cross-household recipient is impossible, not merely rejected

The stored dispatch recipient MUST be constrained so that it can only ever
reference a member of the SAME invitation it belongs to; a recipient pointing
at a guest belonging to a different invitation MUST be impossible to persist,
not merely caught by application-level validation. This is the same
make-it-unrepresentable discipline this project already applies elsewhere
(`assembleConsoleRows`'s double-counting prevention is the precedent): a state
that cannot be written needs no code path to guard against it, and no test can
ever regress by removing that code path.

#### Scenario: A recipient from another household cannot be persisted

- GIVEN two separate invitations, each with its own members
- WHEN an attempt is made to set the first invitation's dispatch recipient to a guest belonging to the second invitation
- THEN the write MUST be refused and the first invitation's dispatch recipient MUST remain unchanged

### Requirement: Deleting the chosen guest clears the choice

Deleting a guest who is the currently chosen dispatch recipient MUST clear that
invitation's dispatch recipient back to unset, automatically, as a consequence
of the deletion — never left pointing at a guest that no longer exists.

#### Scenario: Deleting the chosen recipient clears the choice

- GIVEN an invitation whose dispatch recipient is set to guest G
- WHEN guest G is deleted from that invitation
- THEN the invitation's dispatch recipient MUST become unset, with no separate application step required to clear it

### Requirement: Moving the chosen guest to another invitation clears the choice

Moving a guest who is the currently chosen dispatch recipient to a DIFFERENT
invitation MUST clear the original invitation's dispatch recipient back to
unset. The original invitation MUST NOT retain a reference to a guest who no
longer belongs to it, and the destination invitation MUST NOT inherit the
choice — a recipient is a choice made about one specific household's dispatch,
not a property that travels with a person.

#### Scenario: Moving the chosen recipient elsewhere clears the origin's choice

- GIVEN invitation A's dispatch recipient is set to guest G, and guest G is a member of invitation A
- WHEN guest G is moved to invitation B
- THEN invitation A's dispatch recipient MUST become unset
- AND invitation B's dispatch recipient MUST NOT be set to guest G as a side effect of the move

#### Scenario: Moving a guest who is not the chosen recipient leaves the choice untouched

- GIVEN invitation A has a chosen dispatch recipient of guest G, and a different guest H is also a member
- WHEN guest H is moved to another invitation
- THEN invitation A's dispatch recipient MUST remain set to guest G, unchanged
