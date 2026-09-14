# Phone Gate Specification

## Purpose

Gate access to invitation body content behind a last-8-digit phone match against any guest on the invitation, with rate limiting, an unlock cookie, and a human recovery path. Per A1, the gate is an unlock mechanism only, not RSVP identity.

## Requirements

### Requirement: Last-8-digit any-guest match

The gate MUST accept a phone input that matches the last 8 digits of ANY guest's stored phone on that invitation, not only a primary contact.

#### Scenario: Any guest's number unlocks the invitation

- GIVEN an invitation with guests whose numbers end in `55512345`, `55567890`, and `55599999`
- WHEN a visitor submits a phone input ending in `55567890`
- THEN the gate MUST unlock

#### Scenario: A near-miss does not unlock

- GIVEN the same invitation
- WHEN a visitor submits a phone input ending in `55567891`
- THEN the gate MUST reject the attempt

### Requirement: Wrong phone reveals nothing

A failed gate attempt MUST expose no invitation content and MUST NOT leak any stored phone digit into the page source, network response, or DOM.

#### Scenario: No content or digits leak on failure

- GIVEN a valid slug and an incorrect phone input
- WHEN the gate submission response is inspected in full (HTML, inline JSON, network payloads)
- THEN it MUST contain no guest name, no RSVP form, no dietary/message fields, and no digit sequence matching any stored guest's phone number

### Requirement: Rate limiting is DB-backed

Gate attempts MUST be rate-limited using durable, DB-backed storage (not in-process memory), because serverless instances share no memory.

#### Scenario: Repeated failures trigger lockout

- GIVEN a visitor has made 8 failed attempts against one invitation within 15 minutes
- WHEN a 9th attempt is submitted
- THEN the gate MUST reject the attempt with a lockout response regardless of the input's correctness
- AND the lockout MUST persist across separate serverless invocations

### Requirement: Exactly one unlock path

The public gated route MUST have exactly one unlock path: the phone match described above. No query parameter, hidden field, or admin session state MAY bypass the gate on the public route.

#### Scenario: No query parameter bypasses the gate

- GIVEN a valid slug
- WHEN `/i/<slug>?preview=1`, `/i/<slug>?admin=1`, or any other query parameter is requested without a prior successful phone match
- THEN the gate MUST still require the phone input and MUST NOT reveal gated content

#### Scenario: An authenticated admin session does not bypass the public route

- GIVEN an operator is authenticated in the admin console
- WHEN that operator visits the public `/i/<slug>` route directly, without using the separate admin-only preview route
- THEN the public route MUST still require the phone gate

### Requirement: Unlock cookie persists the session

On successful unlock, the system MUST set a signed, `httpOnly`, `SameSite=Lax` cookie scoped to that invitation, valid for 180 days, so the guest is not re-gated on return visits.

This supersedes the original 30-day decision. The reasoning: the gate exists to stop a FORWARDED link, not to expire a guest who already proved they hold a number on the invitation, and the capability actually being protected is the slug — which that guest keeps either way, cookie or no cookie. So a shorter lifetime buys no security here; it only re-gates the household that answered early and comes back the week of the wedding to re-read the address, which is precisely the person the gate is not aimed at. The event is months out, which is why 30 days was too short in the first place: the invitation is dispatched long before the day it describes. A fresh cookie is minted on every successful unlock, so anyone who does re-enter their number restarts the clock. The expiry is enforced SERVER-side from the signed payload, not from the browser's copy, so a tampered or extended cookie is refused rather than honoured.

#### Scenario: Repeat visit skips the gate

- GIVEN a visitor successfully unlocked an invitation and received the unlock cookie
- WHEN the same visitor requests `/i/<slug>` again within 180 days with that cookie present
- THEN the gate MUST NOT be shown and the invitation body MUST render directly

### Requirement: Recovery path to the owning sender

The gate MUST offer a "cannot get in" recovery link that opens a `wa.me` deep link addressed to the invitation's OWNING sender, pre-filled with a help message. This link follows the same `wa.me` recipient-only rules as invitation-domain: the app MUST NOT claim to send the recovery message itself.

#### Scenario: Recovery link targets the correct owner

- GIVEN an invitation owned by sender A
- WHEN the "cannot get in" link is inspected on the gate screen
- THEN it MUST be a `wa.me` link whose recipient digits correspond to sender A's contact number, and it MUST require a human to press send inside WhatsApp
