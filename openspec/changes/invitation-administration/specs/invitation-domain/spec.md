# Invitation Domain Specification (Delta)

Delta against `openspec/specs/invitation-domain/spec.md`. Only requirements
that are added, modified, or superseded are listed here. Phone normalization,
any-guest phone matching, `wa.me` link building, message template rendering,
and slug generation are all UNCHANGED from the baseline and continue to apply
as published; slug generation in particular is reused verbatim by the
slug-rotation capability.

## MODIFIED Requirements

### Requirement: Automatic dispatch recipient selection is removed

This SUPERSEDES the baseline behaviour of `selectDispatchRecipient(guests)`,
which picked the FIRST household member carrying a dispatchable phone number
automatically, with no operator action. `selectDispatchRecipient` and its
two-reason outcome (`no_phone_on_file` | `no_reachable_phone`) are REMOVED from
this capability entirely — not deprecated, not retained as a fallback path.

The reasoning: this project's own guest list previously had no notion of a
chosen person at all, and the console's ONLY writable field was a phone number,
so an automatic pick was the only behaviour the system could offer — there was
no operator action to defer to. This change adds a real administrator with an
explicit recipient choice (see the new dispatch-recipient capability), and
retaining an auto-pick alongside it would reintroduce, silently, exactly the
failure this whole change exists to close: a message addressed to a person
nobody looked at. The replacement function, `resolveDispatchRecipient(guests,
chosenGuestId)`, is specified in full by the dispatch-recipient capability,
including its four-outcome result and the requirement that
`no_recipient_chosen` is reachable precisely because a chosen id can now be
absent — a state `selectDispatchRecipient` never had to represent.

#### Scenario: selectDispatchRecipient does not exist in the shipped source

- GIVEN the invitation-domain module's shipped exports after this change
- WHEN its exports are inspected
- THEN `selectDispatchRecipient` MUST NOT be among them; only `resolveDispatchRecipient`, specified by the dispatch-recipient capability, addresses this concern

#### Scenario: No caller performs an automatic pick

- GIVEN the console's dispatch preflight and dispatch-compose code paths
- WHEN they determine who an invitation is addressed to
- THEN they MUST call `resolveDispatchRecipient` with an explicitly stored chosen id and MUST NOT iterate the household's members looking for the first reachable one
