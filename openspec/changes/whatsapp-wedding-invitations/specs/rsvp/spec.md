# RSVP Specification

## Purpose

Collect attendance responses per invitation, enforcing the seat hard cap, with append-only history and deadline behavior.

## Requirements

### Requirement: RSVP requires an unlocked session

RSVP submission MUST be authorized by the phone-gate unlock cookie (per A1, the gate is not RSVP identity, but it is the access control for reaching the RSVP form) and MUST go through server-side code, never a direct client-side database write.

#### Scenario: Unauthorized submission is rejected

- GIVEN a request to the RSVP submission endpoint without a valid unlock cookie for that invitation
- WHEN the request is made
- THEN the server MUST reject it and MUST NOT create an `rsvp_responses` row

### Requirement: Seat allowance is a hard cap

The RSVP form MUST NOT render an option to select more attendees than `seats_allowed`, and the server MUST independently re-validate and reject any submission exceeding `seats_allowed` (per confirmed decision: hard cap, no request-more flow).

#### Scenario: Form does not offer over-cap selection

- GIVEN an invitation with `seats_allowed = 3`
- WHEN the RSVP form is rendered
- THEN the maximum selectable attendee count MUST be 3, with no UI affordance to request more

#### Scenario: Server rejects a tampered over-cap submission

- GIVEN an invitation with `seats_allowed = 3`
- WHEN a submission is sent directly to the server action/route claiming 5 attendees, bypassing the client form
- THEN the server MUST reject the submission with an error and MUST NOT persist an `rsvp_responses` row recording 5 attendees

### Requirement: Append-only response history, latest wins

Every RSVP submission MUST be inserted as a new `rsvp_responses` row; existing rows MUST NOT be updated or deleted. The current RSVP state for an invitation MUST be derived as the most recent row by `submitted_at` (per A2).

#### Scenario: A changed answer is recorded, not overwritten

- GIVEN a guest submitted "attending" earlier
- WHEN the same guest later submits "not attending"
- THEN both rows MUST exist in `rsvp_responses`
- AND the invitation's current RSVP state MUST reflect "not attending"

### Requirement: Optional extra fields

The RSVP form MUST offer exactly two optional extra fields: dietary restrictions and a free-text message to the couple (per A8). No other free-form per-guest fields are in scope.

#### Scenario: Submission without optional fields succeeds

- GIVEN a guest submits attendance with dietary restrictions and message left blank
- WHEN the submission is processed
- THEN it MUST succeed and store null/empty values for both optional fields

### Requirement: Deadline behavior

The RSVP deadline is nullable per invitation or globally configured (per A7). After the deadline passes, the page MUST show a contact message instead of the RSVP form.

#### Scenario: Form is replaced after the deadline

- GIVEN an invitation whose RSVP deadline has passed
- WHEN the unlocked invitation page is rendered
- THEN it MUST show a contact message in place of the RSVP form, and MUST NOT accept new submissions

#### Scenario: Form is available before the deadline

- GIVEN an invitation whose RSVP deadline has not passed, or has no deadline set
- WHEN the unlocked invitation page is rendered
- THEN the RSVP form MUST be shown and accept submissions
