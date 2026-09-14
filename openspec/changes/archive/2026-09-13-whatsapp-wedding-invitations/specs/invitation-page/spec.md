# Invitation Page Specification

## Purpose

Server-render the per-guest invitation page at `/i/[slug]`, with Open Graph metadata and image, and friendly handling of invalid slugs. Open Graph tags MUST be server-rendered into the first HTML response (config rule, applies to every requirement in this spec touching the invitation page).

## Requirements

### Requirement: Server-rendered per-guest OG metadata

The invitation page at `/i/[slug]` MUST server-render `og:title` and `og:image` tags inside `<head>` of the FIRST HTML response, before any client JavaScript executes, for any requesting User-Agent including WhatsApp's crawler.

#### Scenario: OG tags present under a WhatsApp User-Agent

- GIVEN a valid invitation with slug `k7q2m9xr4t`
- WHEN `/i/k7q2m9xr4t` is fetched with `User-Agent: WhatsApp/2.23.20.0`
- THEN the raw HTML response body MUST contain `og:title` and `og:image` meta tags inside `<head>...</head>`, before `</head>` closes

#### Scenario: OG tags present under an ordinary browser User-Agent

- GIVEN the same valid invitation
- WHEN `/i/k7q2m9xr4t` is fetched with a standard desktop browser User-Agent
- THEN the raw HTML response body MUST also contain the same `og:title` and `og:image` tags inside `<head>`, not appended near `</body>`

### Requirement: OG card content is names-only

The Open Graph preview card MUST show the household's greeting name and an invitation line only. It MUST NOT include the wedding date, the venue name or address, or any phone number (per A confirmed decision).

#### Scenario: Card omits private details

- GIVEN an invitation's OG image is generated
- WHEN the rendered image and its `og:description` text are inspected
- THEN neither MUST contain the wedding date, venue name, venue address, or any phone number
- AND both MUST contain the household's greeting name

### Requirement: OG image renders accented and enye characters

The OG image generation MUST correctly render guest names containing accented vowels and the letter enye.

#### Scenario: Name with accents and enye renders without corruption

- GIVEN an invitation with `greeting_name` containing "Ñoño Muñóz"
- WHEN the OG image route is fetched
- THEN it MUST return `content-type: image/png` with a non-zero byte body
- AND the rendered glyphs MUST NOT be replaced with tofu/placeholder boxes

### Requirement: Invalid or rotated slug shows a friendly page

An unknown or rotated slug MUST show a friendly contact page rather than a raw 404 (per A11).

#### Scenario: Unknown slug is handled gracefully

- GIVEN a slug that does not exist in the invitations table
- WHEN `/i/<unknown-slug>` is requested
- THEN the response MUST render a friendly contact page and MUST NOT return a raw framework 404 page

#### Scenario: Unknown-slug and wrong-phone responses are shape-identical

- GIVEN an unknown slug versus a valid slug with a wrong phone attempt
- WHEN both responses are compared
- THEN neither response's shape MUST reveal whether the invitation exists, beyond the intentional friendly-page distinction for slugs

### Requirement: Absolute OG image URL

Per the project-scaffold `metadataBase` requirement, the `og:image` tag emitted by this page MUST resolve to a fully-qualified HTTPS URL, never a relative path.

#### Scenario: og:image is absolute

- GIVEN any valid invitation page response
- WHEN the `og:image` meta tag value is inspected
- THEN it MUST start with `https://` and match the deployed origin
