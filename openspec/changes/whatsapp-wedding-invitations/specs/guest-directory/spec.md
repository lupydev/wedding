# Guest Directory Specification

## Purpose

Model invitations (households), individual guests, seat allowances, and sender ownership, with import from an untracked source. Model the two senders as distinct actors with disjoint guest subsets (per config rule).

## Requirements

### Requirement: Household-as-invitation model

The system MUST model an invitation as a household unit that MAY contain one or more individual guests, each guest belonging to exactly one invitation.

#### Scenario: One invitation link serves multiple named guests

- GIVEN an invitation created for a household of 4 named guests
- WHEN the invitation record is read
- THEN it MUST expose exactly one `slug`, one `seats_allowed` value, and a list of its 4 associated guests

### Requirement: Sender ownership is mandatory at creation

Every invitation MUST have a non-null `owner_sender_id` assigned at import time, identifying exactly one of the two senders as responsible for dispatching it. There MUST NOT be an unassigned queue or a claim flow (per confirmed decision).

#### Scenario: Import assigns an owner to every invitation

- GIVEN an import source listing invitations with an owner column populated for every row
- WHEN the import runs
- THEN every created invitation MUST have `owner_sender_id` set to one of exactly two sender identities
- AND the import MUST reject a row with a missing or unrecognized owner value rather than creating an unassigned invitation

### Requirement: Two senders are distinct actors with disjoint guest subsets

The system MUST treat the two senders as separate actors, each owning a disjoint subset of invitations. Ownership determines who is authorized to dispatch a given invitation.

#### Scenario: Ownership partitions the guest list

- GIVEN sender A owns invitations {1,2,3} and sender B owns invitations {4,5}
- WHEN the set of invitations owned by A and the set owned by B are compared
- THEN the two sets MUST be disjoint and their union MUST equal all invitations

### Requirement: Seat allowance per invitation

Each invitation MUST have a `seats_allowed` integer greater than zero, representing the hard cap on confirmed attendees for that household (per confirmed decision: hard cap, no request-more flow).

#### Scenario: Seats allowed is always positive

- GIVEN any invitation created through import
- WHEN `seats_allowed` is read
- THEN it MUST be an integer strictly greater than zero

### Requirement: Guest phone numbers stay server-side

Guest phone numbers (`phone_e164`) MUST NEVER be returned to any guest-facing surface or reach the browser. Only server-only code paths, gated by the `import 'server-only'` guard, MAY read `phone_e164`.

#### Scenario: Guest-facing response omits phone numbers

- GIVEN a guest-facing page or API response describing an invitation's guests
- WHEN the raw response body is inspected
- THEN it MUST NOT contain any guest's `phone_e164` or `phone_last8` value in any form

### Requirement: Import from an untracked source

Guest data MUST be imported from a source file that is not committed to the repository. Fabricated fixtures only MAY be committed for tests.

#### Scenario: No real phone number enters the repository

- GIVEN the full git history of the repository
- WHEN it is searched for phone-number-shaped strings
- THEN no real guest phone number MUST be found; only fabricated fixture values are permitted
