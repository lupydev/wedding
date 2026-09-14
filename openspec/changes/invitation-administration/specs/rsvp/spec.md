# RSVP Specification (Delta)

Delta against `openspec/specs/rsvp/spec.md`. Only requirements that are added,
modified, or superseded are listed here. RSVP requiring an unlocked session,
append-only response history with latest-wins, the single optional dietary
field, the decline-shows-ceremony-stream behaviour, the ceremony configuration
row's default-deny access, and deadline behaviour are all UNCHANGED from the
baseline and continue to apply as published.

## MODIFIED Requirements

### Requirement: The seat cap is derived from the current member count, not a stored allowance

This SUPERSEDES the baseline's "Seat allowance is a hard cap" requirement to
the extent that it referenced `seats_allowed` as a stored value: `seats_allowed`
no longer exists (see the guest-directory capability's delta). The hard-cap
BEHAVIOUR is unchanged and remains a hard cap with server-side re-validation —
only the SOURCE of the cap changes. The RSVP form MUST NOT render an option to
select more attendees than the invitation's current member count, and the
server MUST independently re-validate and reject any submission naming more
attendees than there are current members, or naming an id that does not belong
to a current member.

The reasoning for deriving rather than storing the cap is given in full in the
guest-directory capability's delta: an unnamed seat was already unconfirmable
under the existing 0007 parity rule and the existing named-attendee
requirement in `submitRsvp`, so the member count was always the true
functional cap; a separately stored number could only disagree with it and
never correct it.

#### Scenario: The form's maximum selectable count is the member count

- GIVEN an invitation with 3 current members
- WHEN the RSVP form is rendered
- THEN the maximum selectable attendee count MUST be 3, with no UI affordance to select more, and no reference anywhere to a separately stored allowance

#### Scenario: The server rejects a submission exceeding the member count

- GIVEN an invitation with 3 current members
- WHEN a submission is sent directly to the server claiming 5 attendees, bypassing the client form
- THEN the server MUST reject the submission and MUST NOT persist an `rsvp_responses` row recording 5 attendees

#### Scenario: The server rejects a submission naming a non-member id

- GIVEN an invitation with 3 current members
- WHEN a submission is sent directly to the server naming an attendee id that does not belong to any current member of that invitation
- THEN the server MUST reject the submission and MUST NOT persist that row

## ADDED Requirements

### Requirement: A stored RSVP may become inconsistent with current membership, and this is reported, never silently corrected or blocked at write time

Because invitation membership can now change after an RSVP is stored (see the
invitation-administration capability's membership-change requirement), a
previously stored `rsvp_responses` row's `attendee_guest_ids` MAY come to
include an id that no longer belongs to any current member of the invitation
— through removal or a move to another invitation. This is EXPECTED, not an
error state to prevent: `rsvp_responses` is append-only against `service_role`
too, so a stored row can never be corrected to match a later membership
change, and the append-only guarantee is what keeps the RSVP history honest
about what was actually answered at the time.

Any code path that reads `attendee_guest_ids` to render or summarize an RSVP
MUST tolerate an id that no longer resolves to a current member. It MUST NOT
crash, and it MUST NOT silently drop the unresolvable id from a rendered
count or list, because dropping it would understate what the household
actually answered. It MUST render that id as a removed guest, visibly.

#### Scenario: A stored answer naming a since-removed guest still renders, marked removed

- GIVEN a stored RSVP whose `attendee_guest_ids` includes a guest who has since been removed from the invitation
- WHEN that RSVP is read and rendered
- THEN the rendering MUST NOT crash, MUST NOT silently omit that guest from the displayed attendee count or list, and MUST indicate that the named guest has been removed

#### Scenario: A stored answer naming only current members renders normally

- GIVEN a stored RSVP whose every `attendee_guest_ids` entry resolves to a current member
- WHEN that RSVP is read and rendered
- THEN it MUST render normally with no removed-guest indicator
