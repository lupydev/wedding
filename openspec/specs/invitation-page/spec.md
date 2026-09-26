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

### Requirement: OG preview content is names-only, and the card image carries only what every household shares

The Open Graph preview MUST identify the household by its greeting name and an invitation line only. It MUST NOT include the wedding date, the venue name or address, or any phone number (per A confirmed decision).

That names-only rule governs the METADATA TEXT — `og:title` and `og:description` — which is where WhatsApp draws the household's name, beside the thumbnail.

The card IMAGE is governed by a second, narrower rule. It MAY carry text, and it does: the couple's line is painted into `img/og-card.jpg`. Whatever it carries MUST be identical for every household — facts about the wedding itself, never about the household reading it. The greeting name, the guest names, the phone numbers, the RSVP state and the slug MUST NOT appear in the image, in any typeface, at any size, whether rasterized at request time or painted into the asset beforehand. The operative test is not "is there text on the card" but "would two different households receive different bytes": if the answer is yes, the rule is broken.

(This is the CURRENT form of a guarantee that has changed shape twice, and the shape matters more than the wording. It first placed the greeting name inside the rendered image. It was then strengthened to "the image renders no text whatsoever" — a STRUCTURAL guarantee, which needed no judgement to enforce, because an image with no text has nothing on it to leak. It is now CONDITIONAL: the image carries text again, so the guarantee has to name what that text may be, and a reader has to apply it. That is strictly weaker to enforce and it is written here so nobody has to rediscover it. A future reader who notices the couple's names on the card and concludes that the household's name may join them is reading it backwards: the couple's names are admissible precisely and only because they are the same for everyone. The private-detail prohibition still holds over everything a forwarded link exposes.)

#### Scenario: Metadata text names the household and omits private details

- GIVEN an invitation's page is fetched
- WHEN `og:title` and `og:description` are inspected
- THEN neither MUST contain the wedding date, venue name, venue address, or any phone number
- AND `og:title` MUST contain the household's greeting name

#### Scenario: Two households receive the same card image and different metadata text

- GIVEN two invitations whose greeting names differ
- WHEN each invitation's OG image is fetched and each invitation's page is fetched
- THEN the two image responses MUST be byte-identical, proving nothing household-specific reaches the image, whatever the image draws
- AND their `og:title` values MUST differ, proving the household is still named in the text

### Requirement: A Spanish household name survives the preview path uncorrupted

A greeting name containing accented vowels or the letter enye MUST reach a WhatsApp preview intact, and the card route MUST answer with a real image rather than an error page.

(This supersedes the earlier form of this requirement, which asserted that the rendered IMAGE drew those glyphs without tofu. The image draws no HOUSEHOLD name now — the only glyphs on it are the couple's line, the same for everyone — so the guarantee moved to the surface that carries the name: the metadata text in the first HTML response. Nothing here can come back by putting text on the card again: as long as the image is one shared asset, no household's glyphs are on it to be corrupted. The card's own obligation — that it answers with an image at all — is kept here rather than dropped, because a failing card produces a blank preview with no error anywhere.)

#### Scenario: Name with accents and enye reaches og:title uncorrupted

- GIVEN an invitation with `greeting_name` containing "Ñoño Muñóz"
- WHEN the invitation page is fetched with a WhatsApp User-Agent
- THEN the `og:title` in the raw HTML response MUST equal "Ñoño Muñóz" exactly, byte for byte

#### Scenario: The card route serves the photograph's own JPEG bytes

- GIVEN any invitation
- WHEN the OG image route is fetched
- THEN it MUST return status 200 with `content-type: image/jpeg`
- AND the body MUST begin with the JPEG magic number and be larger than 1 KB
- AND the body MUST be byte-identical to the photograph on disk, so the card is served rather than re-encoded

(This scenario said `image/png` until the route stopped composing the card. `ImageResponse` always rasterizes to PNG, and the measured PNG of this photograph was 2,887,177 bytes against the 265,052-byte JPEG it was rendering. The card is a static photograph with nothing to compose, so it is served directly; the byte-identity clause is what keeps "serve it" from quietly becoming "re-encode it" again.)

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
