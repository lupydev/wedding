# Invitation Page Specification (Delta)

Delta against `openspec/specs/invitation-page/spec.md`. Only requirements that
are added, modified, or superseded are listed here. Server-rendered per-guest
OG metadata, the names-only OG card content rule, accented/enye rendering, and
the absolute OG image URL requirement are all UNCHANGED from the baseline and
continue to apply as published; the slug-rotation capability additionally
reuses "Invalid or rotated slug shows a friendly page" verbatim (a rotated
slug was already named in that baseline requirement's title, though rotation
itself was unimplemented before this change).

## MODIFIED Requirements

### Requirement: Body copy naming attendee counts now names members

Wherever the invitation page's body copy previously referred to a seat count
(for example, a phrase describing how many seats or how many people the
invitation covers), it MUST instead refer to the invitation's current named
members, because there is no longer a separately stored seat count to quote
(see the guest-directory capability's delta removing `seats_allowed`). This
SUPERSEDES any body copy that rendered a bare number of seats; the number of
members and their names are always available from the same members list the
RSVP form already uses to build its own cap.

#### Scenario: Body copy names the members instead of a seat count

- GIVEN an invitation with three current members
- WHEN the invitation page's body is rendered
- THEN any copy describing who the invitation covers MUST reference those three members, by name or by count derived from the current member list, and MUST NOT reference a separately stored seat number

### Requirement: A derived greeting name may re-derive after dispatch, and the page says so

An invitation whose `greeting_name_source` is `'derived'` MUST continue to
re-derive its displayed `greeting_name` from current membership after
dispatch, exactly as it does before dispatch — dispatch does not freeze
derivation. Because the already-delivered WhatsApp message is unrecallable and
therefore keeps whatever name it was rendered with at send time, a
`'derived'`-sourced invitation whose name changes after dispatch will show a
DIFFERENT name on the page (and in the Open Graph card) than the name the
guest received in their chat. The page and any editor surface that changes a
dispatched invitation's membership or name MUST say so at the point of the
edit, so the operator is not surprised later by a name mismatch between the
delivered message and the live page.

This is the same unrecallable-message property this project already accepts
for other post-dispatch edits (for example, editing a dispatched invitation's
greeting name leaves the OG card in an already-cached chat stale); it is
stated as its own requirement here because a greeting name is more visible
than a cached preview card and an operator editing membership needs to see the
warning at the moment they act, not discover it later by comparing a chat
screenshot to the live page.

#### Scenario: A derived name re-derives after dispatch

- GIVEN a dispatched invitation with `greeting_name_source = 'derived'`
- WHEN a member's nickname is edited after dispatch
- THEN the page's rendered greeting name MUST reflect the new nickname immediately, exactly as it would before dispatch

#### Scenario: The editor warns that the delivered message will not match

- GIVEN an operator is editing a dispatched invitation whose `greeting_name_source` is `'derived'`
- WHEN the edit form is shown
- THEN it MUST state that the already-delivered WhatsApp message keeps the old name and will no longer match the page after this edit
