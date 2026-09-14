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

The RSVP form MUST offer exactly one optional extra field: dietary restrictions. It MUST NOT offer a free-text message to the couple, and `rsvp_responses` MUST NOT carry a column for one. No other free-form per-guest fields are in scope.

This supersedes the original A8 decision to offer two fields. The reasoning: the whole flow begins in the guest's own WhatsApp thread and arrives from the couple's own personal numbers, so the guest already holds their contact. A message box competes with the chat they are already in and loses, because a WhatsApp reply reaches the couple where they actually are while a form field waits for somebody to remember to check it. Dietary restrictions stay because they are not a message — they are operational data the catering needs and a guest will not think to send unprompted.

#### Scenario: Submission without the optional field succeeds

- GIVEN a guest submits attendance with dietary restrictions left blank
- WHEN the submission is processed
- THEN it MUST succeed and store a null value for that field

#### Scenario: A message field is neither offered nor accepted

- GIVEN the RSVP form is rendered for an unlocked household
- WHEN the page source is inspected and a submission carrying a `message` field is sent directly to the server action
- THEN the form MUST contain no message input, the submission MUST still be recorded, and no message value MUST be persisted anywhere

### Requirement: A declining household is shown the ceremony stream

Selecting "cannot attend" MUST submit the response immediately, without a second confirming action. Once that response is recorded, the page MUST replace the RSVP form with the ceremony stream details — date, time, stream meeting id and passcode — and MUST offer a control returning the household to the form. Accepting MUST still require an explicit submit.

The stream details MUST be read from a single-row configuration table rather than from environment variables or from any value restated in application code, because the public ceremony page needs exactly the same values and a fact stored in two places drifts. Until the couple supplies them, that row MUST hold visibly unfinished placeholders; no plausible date, meeting id or passcode may be invented.

#### Scenario: Declining submits on the first tap

- GIVEN an unlocked invitation whose RSVP is open
- WHEN the household selects that they cannot attend
- THEN exactly one `rsvp_responses` row MUST be created, with `attending = false`, `seats_confirmed = 0` and no named attendees, without any further interaction

#### Scenario: The stream replaces the form

- GIVEN a household whose current RSVP is a decline
- WHEN the unlocked invitation page is rendered
- THEN it MUST show the ceremony date, time, stream meeting id and passcode from the configuration row
- AND it MUST NOT render the RSVP form, not even a disabled one

#### Scenario: A decline can be corrected

- GIVEN a household that has declined and is looking at the stream details
- WHEN they use the control returning them to the form and submit an acceptance
- THEN a NEW `rsvp_responses` row MUST be appended rather than the decline being altered
- AND the reduced current state MUST report the acceptance

#### Scenario: A refused decline does not reveal the stream

- GIVEN a decline that the server refuses, for example because the unlock cookie is gone
- WHEN the outcome is rendered
- THEN the form MUST remain, showing the refusal, and the stream details MUST NOT be shown

### Requirement: The ceremony configuration row is default-deny

The single-row ceremony table MUST have row level security enabled with zero policies and MUST grant no privilege to `anon` or `authenticated`, exactly like every other table this change owns. The external publishable-key invariant suite MUST cover it.

#### Scenario: The publishable key reaches no ceremony value

- GIVEN the ceremony row exists and is visible to a privileged reader
- WHEN the publishable key attempts to select, insert, update or delete it
- THEN the select MUST return no rows, the three writes MUST be refused with an insufficient-privilege error, and the stored row MUST be unchanged

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
