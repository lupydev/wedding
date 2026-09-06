# Dispatch Console Specification

## Purpose

Authenticated console for the two senders to review their guest partition, declare their device's WhatsApp account, build and open `wa.me` links, record dispatch events, and preview both invitation surfaces. The console PREPARES a `wa.me` link only; it never claims to send a message itself.

## Requirements

### Requirement: Operator authentication via magic link

Console access MUST require Supabase Auth magic-link sign-in, restricted to a server-checked two-email allowlist mapped to `senders.auth_user_id`.

#### Scenario: Unallowlisted email cannot access the console

- GIVEN an email address not on the two-email allowlist
- WHEN that email attempts magic-link sign-in
- THEN the console MUST deny access and MUST NOT create a session mapped to any sender

#### Scenario: Allowlisted sender reaches their dashboard

- GIVEN an allowlisted email completes magic-link sign-in
- WHEN the session is established
- THEN it MUST resolve to exactly one `senders.auth_user_id` identity

### Requirement: Guest list partitioned by ownership

Each authenticated sender MUST see their own owned invitations by default, distinct from the other sender's, per the disjoint-subset model in guest-directory. Both operators MAY view a shared read-only progress dashboard covering all invitations (per A14).

#### Scenario: Sender's default view shows only owned invitations

- GIVEN sender A is authenticated
- WHEN sender A opens the console guest list
- THEN it MUST list only invitations where `owner_sender_id` equals sender A's identity, by default

#### Scenario: Shared progress dashboard is visible to both

- GIVEN either sender is authenticated
- WHEN the shared progress dashboard is opened
- THEN it MUST show aggregate counts across all invitations regardless of owner

### Requirement: No send affordance for non-owned guests

The console MUST NOT present a dispatch/send action for an invitation the authenticated sender does not own.

#### Scenario: Non-owner sees no send button

- GIVEN sender A views an invitation owned by sender B in the shared dashboard
- WHEN the invitation row is rendered
- THEN no send/dispatch button MUST be present; an "owned by {other sender}" label MUST appear instead

### Requirement: Per-device WhatsApp account declaration

On first console load on a device, the console MUST ask the operator which WhatsApp account is installed on that device, and store the answer locally to that device (per A15/R2).

#### Scenario: Declaration mismatch blocks dispatch

- GIVEN the authenticated operator is sender A, and the device has declared "sender B's WhatsApp account is installed here"
- WHEN sender A attempts to dispatch an invitation
- THEN the console MUST block the dispatch with an explanatory interstitial rather than proceeding silently

#### Scenario: Declaration match allows dispatch

- GIVEN the authenticated operator is sender A, and the device has declared "sender A's WhatsApp account is installed here"
- WHEN sender A attempts to dispatch an owned invitation
- THEN the console MUST allow the dispatch flow to proceed

### Requirement: wa.me link preparation, never auto-send

The console MUST build a `wa.me` link using invitation-domain's `buildWaMeLink` and open it for the operator to send manually inside WhatsApp. The console MUST NOT claim, imply, or attempt to programmatically send the message itself.

#### Scenario: Dispatch action opens WhatsApp for a human to send

- GIVEN sender A dispatches an owned invitation
- WHEN the dispatch action completes
- THEN the operator MUST be navigated to a `wa.me` URL with the message pre-filled, and no server-side send MUST have occurred

### Requirement: Append-only dispatch events with actor attribution

Every dispatch action MUST insert a row into `dispatch_events` recording `actor_sender_id` (who acted) separate from `invitations.owner_sender_id` (who should have). Events MUST NOT be updated or deleted.

#### Scenario: Every dispatch produces an event row

- GIVEN sender A dispatches invitation X
- WHEN the dispatch completes
- THEN a `dispatch_events` row MUST exist with `invitation_id = X` and `actor_sender_id` equal to sender A's identity

#### Scenario: Mismatch between actor and owner is recorded, not silently dropped

- GIVEN the device-declaration interstitial was overridden or bypassed through an authorized path
- WHEN a dispatch occurs where `actor_sender_id` differs from `owner_sender_id`
- THEN the event row MUST still be recorded with both values intact, for later audit

### Requirement: Message preview via the real OG endpoint

The console MUST render a mock chat-bubble preview that fetches the invitation's real, canonical OG image endpoint (no cache-busting parameter), labelled as approximate.

#### Scenario: Preview image matches the dispatched card

- GIVEN an invitation's preview pane is opened
- WHEN the rendered preview image is compared byte-for-byte to a direct fetch of `/i/<slug>/opengraph-image`
- THEN they MUST be identical

### Requirement: Invitation body preview on a separate admin-only route

The invitation body preview MUST be served on a separate admin-only route (`/console/preview/[invitationId]`), sharing one body component with the public `/i/[slug]` route. The public gated route MUST remain unaware of any preview concept and MUST keep exactly one unlock path.

#### Scenario: Admin preview renders the same body component

- GIVEN the same invitation fixture data
- WHEN the public route's body (post-unlock) and the admin preview route are both rendered
- THEN their rendered body output MUST be identical

#### Scenario: Admin preview route requires console authentication

- GIVEN an unauthenticated visitor
- WHEN `/console/preview/<invitationId>` is requested
- THEN the request MUST be denied and MUST NOT render invitation content
