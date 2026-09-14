# Invitation Domain Specification

## Purpose

Pure, vendor-free, React-free functions for phone normalization/matching, `wa.me` link building, message template rendering, and slug generation. These functions MUST NOT import React or any storage vendor SDK.

## Requirements

### Requirement: Phone normalization

The system MUST normalize an arbitrary phone input string into a canonical E.164 representation and a derived last-8-digit value, given a default country.

#### Scenario: Normalizes formats with punctuation and country code variants

- GIVEN inputs with and without `+`, with and without country code, with spaces, dashes, and parentheses, including a Mexican `1` mobile prefix and an Argentine `9` prefix
- WHEN `normalizePhone(input, defaultCountry)` is called
- THEN it MUST return `{ e164, last8 }` with `last8` equal to the final 8 digits of `e164`

#### Scenario: Rejects unparseable input

- GIVEN an empty string or non-phone garbage input
- WHEN `normalizePhone(input, defaultCountry)` is called
- THEN it MUST return a failure result and MUST NOT throw an uncaught exception

### Requirement: Any-guest phone match

The system MUST determine whether a normalized phone input matches ANY guest's stored `phone_last8` on a given invitation, not only a primary contact.

#### Scenario: Matches any listed guest

- GIVEN an invitation with multiple guests, each with a distinct `phone_last8`
- WHEN `matchesInvitation(input, guests)` is called with a phone matching the second guest's last 8 digits
- THEN it MUST return `true`

#### Scenario: Rejects a near-miss

- GIVEN an invitation's guests with known `phone_last8` values
- WHEN `matchesInvitation(input, guests)` is called with a phone differing by one digit from every guest
- THEN it MUST return `false`

### Requirement: wa.me link building

The system MUST build a `wa.me` deep link that addresses the RECIPIENT only. The system MUST NOT provide any mechanism to specify a sender, and no requirement or generated link may imply the app sends a message; the app only prepares the link for a human to open inside WhatsApp.

#### Scenario: Produces a correctly encoded URL

- GIVEN a recipient E.164 phone number and a message text containing spaces, `&`, `?`, a newline, an accented character, and an emoji
- WHEN `buildWaMeLink(recipientE164, text)` is called
- THEN it MUST return `https://wa.me/<digits-no-plus>?text=<percent-encoded text>` with the newline encoded as `%0A` and no literal `&` or `?` breaking the query string
- AND the returned digits MUST contain no `+` character

### Requirement: Message template rendering

The system MUST render a message template using the greeting name only (per confirmed decision: no seat count, no per-guest free note, no register variant). A missing required template variable MUST fail loudly.

#### Scenario: Renders with the guest's greeting name

- GIVEN a template containing a `{{greeting_name}}` placeholder and a value for it
- WHEN `renderMessageTemplate(template, vars)` is called
- THEN the output MUST contain the substituted greeting name and MUST NOT contain the literal placeholder token

#### Scenario: Fails loudly on a missing variable

- GIVEN a template referencing a variable absent from `vars`
- WHEN `renderMessageTemplate(template, vars)` is called
- THEN it MUST throw or return an explicit error, and MUST NOT render the literal string `undefined` into the output

### Requirement: Slug generation

The system MUST generate an opaque, random, URL-safe slug of at least 64 bits of entropy for each invitation, distinct from the invitation's internal numeric id.

#### Scenario: Slug is unguessable and unique per invocation

- GIVEN 10,000 calls to `generateSlug()`
- WHEN the results are compared
- THEN every slug MUST be unique, MUST contain only URL-safe characters, and MUST NOT encode or reveal the invitation's sequential id
