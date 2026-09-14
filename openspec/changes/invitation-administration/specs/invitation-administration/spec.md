# Invitation Administration Specification

## Purpose

Give both console operators a real administrator for invitations and their
members: create, edit, move, and delete, with the refusals, advisories, and
membership-change reporting that keep those operations honest. This is a new
capability; it has no baseline to supersede. Before this change, the only
creation path was `scripts/import-guests.ts`, and the console could write
exactly one field, `updateGuestPhone`.

## Requirements

### Requirement: An invitation is created with at least one member

The console MUST allow either operator to create a new invitation consisting of
one or more named members, using one form and one write path for both a solo
guest and a group — there MUST NOT be a separate "single guest" mode and
"group" mode, because the model already treats a solo guest as a one-member
invitation and a UI with a mode switch could disagree with that model. Creation
MUST refuse to save a draft with zero members.

#### Scenario: A solo guest is created with the same form as a group

- GIVEN an operator opens the invitation creation form and adds exactly one member
- WHEN the form is saved
- THEN a new invitation MUST be created with exactly that one member, using the identical write path a multi-member group would use

#### Scenario: A draft with zero members is refused

- GIVEN an operator opens the invitation creation form and removes every member row without adding one
- WHEN the form is saved
- THEN the save MUST be refused with an explanation, and no invitation MUST be created

### Requirement: Either operator may create or edit any invitation

Both console operators MUST be able to create a new invitation and edit any
existing invitation, regardless of which operator's guest partition it belongs
to. Ownership continues to gate DISPATCH (see the dispatch-console capability's
owner-scoping requirement), but it MUST NOT gate the ability to create, edit,
move members between, or delete invitations.

#### Scenario: The non-owning operator can edit an invitation they do not own

- GIVEN invitation X is owned by sender A
- WHEN sender B opens invitation X's edit form and changes a member's nickname
- THEN the edit MUST be accepted and saved, exactly as if sender A had made it

### Requirement: Group name defaults to the derived Spanish name and may be overridden

A new or edited invitation's group name (its greeting name) MUST default to the
value computed by the guest-naming capability's derivation from its current
members, shown live as members and nicknames are edited, using the SAME pure
derivation function the server uses to store it — not a second implementation
in the client that could drift from the server's. An operator MAY type a
different value; doing so MUST record that the name is now custom, and a reset
control MUST be available to return it to the live derived value. The live
derived name MUST be shown beside a custom one at all times, because detecting
whether a custom name still mentions a removed member by matching its text
against member names is unreliable and MUST NOT be attempted.

#### Scenario: The derived name updates live as nicknames are typed

- GIVEN an operator is creating an invitation with two members and has typed a nickname for the first
- WHEN a nickname is typed for the second member
- THEN the displayed derived group name MUST update to reflect both nicknames, without a page reload or an explicit recompute action

#### Scenario: Overriding the name marks it custom and a reset restores the derived value

- GIVEN an operator has typed a custom group name replacing the derived default
- WHEN the form is saved
- THEN the invitation's group-name source MUST be recorded as custom, and the stored name MUST be exactly what was typed
- WHEN the operator later uses the reset control
- THEN the group name MUST return to the value the current members currently derive to, and the source MUST be recorded as derived

#### Scenario: A custom name is shown beside the live derived name, not string-matched against members

- GIVEN an invitation has a custom group name and a member who might be mentioned in it is later removed
- WHEN the edit form is opened
- THEN the current custom name MUST be displayed unchanged alongside the freshly computed derived name, and the system MUST NOT attempt to infer from the custom text whether it "still mentions" the removed member

### Requirement: Members may be added, edited, and removed on an existing invitation

An operator MUST be able to add a new member to an existing invitation, edit an
existing member's name, nickname, or phone, and remove a member — all as
ordinary, permitted edits, none of them refused solely for changing who belongs
to a group.

#### Scenario: Adding a member to an existing invitation succeeds

- GIVEN an existing invitation with two members
- WHEN an operator adds a third member with a name and phone
- THEN the invitation MUST have three members afterward, and its group name MUST re-derive if its source is derived

#### Scenario: Editing a member's nickname succeeds

- GIVEN an existing member with no nickname
- WHEN an operator sets a nickname for that member
- THEN the member's stored nickname MUST reflect the new value

### Requirement: Moving or deleting the last member of an invitation is refused

Removing or moving away the LAST remaining member of an invitation, leaving it
with zero members, MUST be refused. The refusal MUST point the operator at
deleting the invitation itself instead, because an invitation is not permitted
to exist with zero members — it could never be unlocked by anyone and would sit
in the console looking valid while being unreachable.

Every refusal in this capability MUST ship with its permitting counterpart
proven in the same test: removing or moving a member from an invitation with
TWO OR MORE members MUST succeed, so that the assertion for the last-member
case can fail if the refusal is ever accidentally removed.

#### Scenario: Removing the only member of a solo invitation is refused

- GIVEN an invitation with exactly one member
- WHEN an operator attempts to remove that member
- THEN the removal MUST be refused, and the refusal message MUST direct the operator to delete the invitation instead
- AND the invitation MUST still have that one member afterward

#### Scenario: Moving away the last member is refused the same way

- GIVEN an invitation with exactly one member
- WHEN an operator attempts to move that member to a different invitation
- THEN the move MUST be refused for the same reason, and the invitation MUST retain that member afterward

#### Scenario: Removing a member from a multi-member invitation succeeds

- GIVEN an invitation with two members
- WHEN an operator removes one of them
- THEN the removal MUST succeed, leaving one member on the invitation

### Requirement: A member may be moved to a different invitation

An operator MUST be able to move a member from one invitation to another
existing invitation, changing which household they belong to. This is subject
to the last-member refusal above at the origin, and to the dispatch-recipient
capability's rule that moving the chosen recipient clears the origin's choice.

#### Scenario: Moving a member changes their invitation

- GIVEN invitation A has two members and invitation B has one member
- WHEN an operator moves one member of invitation A to invitation B
- THEN invitation A MUST have one member remaining, and invitation B MUST have two members, including the moved one

### Requirement: Two members sharing a nickname is an advisory, never a refusal

Two members of the same invitation being given the same nickname MUST be
allowed to save. The system MUST surface this as an advisory — a fact reported
to the operator — and MUST NOT refuse the save on account of it. A shared
nickname is a plausible real fact (twins, a shared family nickname) and is not
this capability's business to prevent.

#### Scenario: Saving a duplicate nickname succeeds and produces an advisory

- GIVEN two members of the same invitation are both given the nickname "Nico"
- WHEN the form is saved
- THEN the save MUST succeed with both members carrying that nickname
- AND an advisory naming the duplicate MUST be shown to the operator

### Requirement: A membership change is allowed, detected, and reported — never refused for consistency

Removing or moving a member who is NAMED in a previously stored, confirmed RSVP
response MUST be permitted to succeed. The system MUST detect that the change
makes the invitation's confirmed seat count inconsistent with its current
member list, and MUST report that inconsistency visibly — as a badge on the
affected invitation's row and as an entry in a dashboard grouping — rather than
silently allowing it to disappear from view. This is a deliberate choice, NOT
an oversight: the blocked alternative ("Fer already said yes, but now he can't
come — take him off") is the couple's actual, ordinary workflow, and refusing
the edit that accomplishes it would only teach the couple to work around the
tool. The stored RSVP history itself is never altered or corrected by this
report; only the current, forward-looking state is flagged.

This is a narrower rule than a general seat-cap refusal might suggest, and it
replaces one: because `seats_allowed` no longer exists as a field an operator
sets (see the guest-directory capability's delta), there is no longer a second,
separate refusal for "lowering the cap below the confirmed count" — membership
IS the only side of this relationship an operator can now edit, and this
requirement is the entirety of what happens when they do.

#### Scenario: Removing an RSVP'd member succeeds and produces a visible advisory

- GIVEN an invitation with a confirmed RSVP naming two attendees, and both are still current members
- WHEN an operator removes one of those two members
- THEN the removal MUST succeed
- AND the invitation MUST be shown with a visible inconsistency badge on its console row
- AND the invitation MUST appear in a dashboard grouping of invitations with this inconsistency

#### Scenario: A membership change that does not affect the RSVP produces no advisory

- GIVEN an invitation with a confirmed RSVP naming two attendees, and a third member who was never named in that RSVP
- WHEN an operator removes the third, unnamed member
- THEN the removal MUST succeed
- AND no inconsistency badge MUST appear for this invitation

#### Scenario: An RSVP naming only current members produces no advisory

- GIVEN an invitation with a confirmed RSVP whose named attendees are all still current members
- WHEN the invitation's console row is rendered
- THEN no inconsistency badge MUST appear

### Requirement: An invitation may be deleted only if it has never been dispatched

An invitation MUST be permanently deletable only when it has ZERO
`dispatch_events` rows of any kind. ANY row in `dispatch_events` for that
invitation — including a `link_opened` event and a `marked_failed` event, not
only an operator-asserted send — MUST refuse the deletion. `link_opened` means
a device fetched that URL, so the link has demonstrably left this system's
control regardless of who clicked it; `marked_failed` records only that the
operator believes it did not arrive, not that it never left. Both carry the
same risk a confirmed send does: a real guest may hold that URL.

Deletion, where permitted, MUST be a genuine hard delete — this capability does
not implement or offer a soft-delete state. A second definition of "exists"
was rejected for this project by name (migration `0005`): the gate, the OG
image, `generateMetadata`, the console list, the preflight, and the RSVP write
would each have to honour it, and the one that forgot would leak a removed
invitation to a real guest.

Every refusal in this requirement MUST ship with its permitting counterpart in
the same test: an invitation with zero `dispatch_events` rows MUST delete
successfully, so the assertion for a dispatched invitation can fail if the
refusal is ever removed.

#### Scenario: An invitation with no dispatch history deletes successfully

- GIVEN an invitation with zero `dispatch_events` rows
- WHEN an operator deletes it
- THEN the invitation and its members MUST be permanently removed

#### Scenario: A confirmed-sent invitation cannot be deleted

- GIVEN an invitation with a `dispatch_events` row recording an operator-asserted send
- WHEN an operator attempts to delete it
- THEN the deletion MUST be refused, and the invitation MUST still exist afterward

#### Scenario: An opened-link invitation cannot be deleted

- GIVEN an invitation with a `dispatch_events` row of kind `link_opened` and no operator-asserted send
- WHEN an operator attempts to delete it
- THEN the deletion MUST be refused for the same reason a confirmed send would be

#### Scenario: A marked-failed invitation cannot be deleted

- GIVEN an invitation with a `dispatch_events` row of kind `marked_failed`
- WHEN an operator attempts to delete it
- THEN the deletion MUST be refused, because the operator's belief that it did not arrive is not proof that it never left

#### Scenario: A dispatched invitation is offered slug rotation instead

- GIVEN an invitation whose deletion is refused because of dispatch history
- WHEN the refusal is presented to the operator
- THEN it MUST offer slug rotation as the alternative action for "sent by mistake"
