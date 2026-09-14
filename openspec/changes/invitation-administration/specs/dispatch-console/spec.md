# Dispatch Console Specification (Delta)

Delta against `openspec/specs/dispatch-console/spec.md`. Only requirements that
are added, modified, or superseded are listed here. Operator authentication,
the shared read-only progress dashboard, the per-device WhatsApp declaration,
`wa.me` link preparation without auto-send, append-only dispatch events with
actor attribution, message preview via the real OG endpoint, and the
admin-only invitation body preview route are all UNCHANGED from the baseline
and continue to apply as published.

## MODIFIED Requirements

### Requirement: Owner scoping applies to dispatch, not to administration

The baseline's "Guest list partitioned by ownership" and "No send affordance
for non-owned guests" requirements continue to apply to DISPATCH exactly as
published: a sender's default guest-list view still shows only their own
owned invitations, the shared dashboard is still visible to both, and no
send/dispatch button is ever shown for an invitation the authenticated sender
does not own.

This SUPERSEDES any assumption that owner scoping also gated console WRITES in
general. It never gated writes broadly before this change because the console
had only one writable field (`updateGuestPhone`); this change adds an entire
administrative surface — create, edit, move, and delete — and owner scoping
does NOT extend to it. Both operators MAY create a new invitation and edit or
delete ANY existing invitation regardless of who owns it, per the
invitation-administration capability. The reasoning: ownership exists to
answer "who is authorized to press send", because that is the boundary the
per-device WhatsApp declaration actually protects — sending from the wrong
account is the failure ownership prevents. Administrative correctness (fixing
a name, adding a late guest, moving a member between households) is not a
sending action and carries no such risk; restricting it to one operator would
only slow down the couple's own two-person workflow for no corresponding
safety gain. `actor_sender_id` continues to record who performed a dispatch,
regardless of who owns the invitation dispatched.

#### Scenario: The non-owning operator can edit an invitation they do not own

- GIVEN invitation X is owned by sender A
- WHEN sender B, authenticated, opens invitation X's edit form and saves a change
- THEN the edit MUST be accepted, exactly as the invitation-administration capability specifies

#### Scenario: The non-owning operator still sees no send button for it

- GIVEN invitation X is owned by sender A
- WHEN sender B views invitation X in the shared dashboard
- THEN no send/dispatch button MUST be present for sender B, exactly as the baseline "No send affordance for non-owned guests" requirement specifies, even though sender B could edit the same invitation moments earlier

### Requirement: Preflight blockers are renamed and reordered around an explicit recipient

This SUPERSEDES the shape of the preflight blocker kinds implied by the
baseline's household-reachability model. Readiness previously asked "is ANY
member of this household reachable" — the baseline dispatch-recipient behaviour
auto-picked the first reachable member, so any reachable member made the
household ready. Readiness now asks a narrower and more correct question: "is
the CHOSEN recipient reachable", because a recipient is now an explicit choice,
not an inference, and an invitation whose chosen recipient holds a landline is
correctly blocked even when their partner in the same household holds a
mobile. This is a change in MEANING, not only in the blocker kinds' names — an
invitation the old check reported ready may now report blocked, correctly,
because readiness is now about a specific person rather than about the
household having any option at all.

The blocker kinds are renamed with a `recipient_` prefix and reordered to place
the new first-class blocker first:

1. `no_recipient_chosen` — no dispatch recipient has been chosen for this
   invitation at all. This is now the MOST common blocker on first deployment,
   because every previously undispatched invitation starts with no recipient
   chosen, and it is the most immediately actionable: choose someone.
2. `recipient_has_no_phone` — the chosen recipient has no stored phone number.
3. `recipient_phone_unreachable` — the chosen recipient's stored phone is not
   dispatchable (for example, a landline), even though another member of the
   same household might be reachable.
4. `already_dispatched` — unchanged from the baseline: an operator already
   asserted this invitation's send.

Renaming rather than reusing the previous kind names under a changed meaning is
deliberate: a blocker kind whose meaning changed while its name stayed the
same is exactly how a stale test, written against the old meaning, keeps
passing without ever being forced to notice the change.

`no_recipient_chosen` MUST sort FIRST in the preflight's display order,
ahead of both phone-related blockers and ahead of `already_dispatched`,
because it is both the most actionable single fix and the most common finding
immediately after this change ships.

#### Scenario: An invitation with no chosen recipient is blocked, even with a reachable member

- GIVEN an invitation with two members, one of whom has a dispatchable mobile number, and no dispatch recipient chosen
- WHEN the preflight check runs
- THEN the invitation MUST be classified `no_recipient_chosen`, not ready — despite a reachable member existing in the household

#### Scenario: A chosen recipient with an unreachable phone blocks even though a housemate is reachable

- GIVEN an invitation with two members: the chosen recipient holds a landline, and the other, unchosen member holds a dispatchable mobile
- WHEN the preflight check runs
- THEN the invitation MUST be classified `recipient_phone_unreachable`, never ready — the reachable housemate does not make the invitation ready, because the choice is about the one person who was chosen

#### Scenario: no_recipient_chosen sorts before every other blocker kind

- GIVEN a preflight run producing findings of every blocker kind, including at least one `no_recipient_chosen`, one `recipient_has_no_phone`, one `recipient_phone_unreachable`, and one `already_dispatched`
- WHEN the preflight's groups are rendered in order
- THEN the `no_recipient_chosen` group MUST appear first, before all three other groups

## ADDED Requirements

### Requirement: A recipient indicator on each console row

Each invitation's row in the console guest list MUST indicate which member, if
any, is the currently chosen dispatch recipient, and MUST offer an affordance
to change that choice without leaving the list.

#### Scenario: The chosen recipient is visibly indicated

- GIVEN an invitation with a chosen dispatch recipient
- WHEN its console row is rendered
- THEN the chosen member MUST be visually distinguished from the invitation's other members on that row

#### Scenario: An invitation with no chosen recipient shows that plainly

- GIVEN an invitation with no dispatch recipient chosen
- WHEN its console row is rendered
- THEN the row MUST indicate that no recipient has been chosen, not merely omit the indicator silently

### Requirement: Create and edit surfaces are reachable from the console

The console MUST offer a route to create a new invitation and a route to edit
any existing invitation, reachable from the guest list without requiring a
terminal or a script, per the invitation-administration capability's create and
edit requirements.

#### Scenario: A new invitation can be created from the console guest list

- GIVEN an operator is viewing the console guest list
- WHEN they use the create-invitation affordance
- THEN they MUST reach the invitation creation form without leaving the console

### Requirement: Empty-state copy no longer claims invitations arrive only through import

The console guest list's empty state MUST NOT state or imply that invitations
are loaded exclusively through the importer, since this change adds a console
creation path that makes that statement false. This SUPERSEDES whatever copy
previously described the importer as the way invitations enter the system,
because that copy becomes actively misleading the moment this capability
ships — an operator reading it would not learn that they can create an
invitation themselves from an empty list.

#### Scenario: The empty state mentions the console creation path

- GIVEN the console guest list has no invitations for the current view
- WHEN the empty state is rendered
- THEN its copy MUST NOT claim invitations are loaded with the importer, and MUST point the operator at creating one from the console
