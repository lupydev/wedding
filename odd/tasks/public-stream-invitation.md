# A public invitation for everyone who joins by stream

## Objective

The couple needs ONE invitation they can send to anybody who will attend over
Zoom, without creating a per-household record for each of them. Today the stream
credentials exist on exactly one surface — `/i/[slug]`, behind the phone gate,
shown to a household that has declined — and reaching them requires an
invitation row, a slug and a phone number on file.

`/transmision` becomes that surface: public, no gate, no guest list. The landing
at `/` keeps being the link that gets shared and gains a door to it.

## This was already the plan, and it is written in the code

`components/invitation/CeremonyStream.tsx`, in its own header comment:

> For these guests the Zoom details sit BEHIND the phone gate, which is better
> protected than **the public ceremony page that will serve everyone else
> later**. Both surfaces read the same `ceremony` row (migration 0009); neither
> restates a value.

So this is the second half of a design that was always intended, not a new
direction. The rule it states — both surfaces read the row, neither restates a
value — is binding on the new page.

## Why the credentials do NOT go on `/`

`app/robots.ts` leaves `/` indexable, deliberately. Putting a live meeting id and
passcode there publishes them to a search index, which is how a ceremony gets
crashed by strangers.

The obvious fix — disallowing `/` — costs something the couple actually needs. A
`Disallow` tells every conforming crawler not to FETCH the page, and the card
that WhatsApp shows is built by reading the `og:` tags inside it. This repository
already knows that trap: `robots.ts` allows `/i/*/opengraph-image` back in for
exactly this reason, and says so.

So `/` stays indexable and keeps its card; `/transmision` is disallowed and
carries the credentials. One link to share, credentials out of the index.

**Stated plainly, because it would be dishonest to imply otherwise: this is not
security.** Any guest can forward the link. What protects the ceremony is Zoom's
waiting room or registration. The disallow only stops a stranger tripping over
the call while searching for something else.

## Decisions taken by the couple

- **The details are open from the moment the page goes up.** Not time-gated, not
  behind a shared password. That keeps `/` and `/transmision` static, and puts
  the protection where it belongs — on Zoom.

## Constraints measured, not assumed

- `getCeremony(createServerSupabaseClient())` is how `/i/[slug]` reads the row
  (`app/i/[slug]/load-invitation.ts:93`). The new route reads it the same way.
  It throws rather than returning null when the row is missing, deliberately.
- `CeremonyStream.tsx` renders the four values VERBATIM, seeded `{{...}}`
  placeholders included, because hiding an unfinished value turns an obviously
  incomplete invitation into a plausible wrong one. The new surface must do the
  same.
- `CeremonyStream` is NOT reusable whole: it is the decline branch of the RSVP
  flow and carries "Gracias por contarnos", an `onReconsider` callback and a
  "Volver a responder" button. Only the four-row `<dl>` is common.
- The extracted `<dl>` must keep its current markup exactly —
  `role="group"`, `aria-label="Detalles de la transmisión"`, and the four
  `<dt>`/`<dd>` pairs in order. `CeremonyStream.spec.tsx` queries by that role
  and reads `term` elements with their next sibling, so anything else changes a
  surface nobody asked to change.
- The row holds a meeting id and a passcode, NOT a join URL. Zoom's `pwd` query
  parameter is an encrypted token, not the passcode, so a one-tap join link
  cannot be synthesised from what we store. Rendering what exists is the only
  honest option; a real join link would be a new column and is out of scope.
- `.paper-surface` in `app/globals.css` already exists to put a cream island on
  a dark surface, for the console's preview panes. The credentials card reuses
  it rather than inventing a second mechanism.

## Scope

In scope: `components/invitation/StreamDetails.tsx` extracted from
`CeremonyStream`, `components/invitation/StreamInvitation.tsx`,
`app/transmision/page.tsx`, a disallow entry in `app/robots.ts`, and one link
from `app/page.tsx`.

Out of scope: a join-URL column, any change to the phone gate, any change to
`/i/[slug]`'s behaviour, RSVP for stream guests.

## Delivery

Strategy `ask-on-risk`. Forecast ≈ 600 authored changed lines across two work
units. TDD: **strict**. Runner `npm test` (`vitest run`).

## Tasks

### Unit A — the shared block, and the door closed to crawlers

- [x] A1. `components/invitation/StreamDetails.spec.tsx`: four labels, each
      beside its own value, in order, rendered verbatim. Observe RED.
- [x] A2. `components/invitation/StreamDetails.tsx`, and `CeremonyStream` uses
      it. GREEN, with `CeremonyStream.spec.tsx` still green and unedited.
- [x] A3. `app/robots.spec.ts`: the stream path is disallowed and never allowed
      back in. Observe RED.
- [x] A4. `app/robots.ts`: `STREAM_PATH`. GREEN.
- [x] A5. `npm test` + typecheck + lint + format. Commit unit A.

### Unit B — the page, and the way in

- [ ] B1. `components/invitation/StreamInvitation.spec.tsx`: names the couple,
      carries the four details verbatim, says the ceremony is streamed. RED.
- [ ] B2. `components/invitation/StreamInvitation.tsx`. GREEN.
- [ ] B3. `app/transmision/page.tsx`: reads the row, composes, `metadata` with
      `robots: { index: false }`.
- [ ] B4. `app/page.tsx`: the door — a link to `/transmision`.
- [ ] B5. `npm test` + typecheck + lint + format + build, and drive both pages
      in a real browser at phone and laptop widths. Commit unit B.

## Progress

Unit A done: StreamDetails extracted with CeremonyStream.spec untouched and green; the stream path is disallowed.

## Next step

B1.
