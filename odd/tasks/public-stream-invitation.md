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

- [x] B1. `components/invitation/StreamInvitation.spec.tsx`: names the couple,
      carries the four details verbatim, says the ceremony is streamed. RED.
- [x] B2. `components/invitation/StreamInvitation.tsx`. GREEN.
- [x] B3. `app/transmision/page.tsx`: reads the row, composes, `metadata` with
      `robots: { index: false }`.
- [x] B4. `app/page.tsx`: the door — a link to `/transmision`.
- [x] B5. `npm test` + typecheck + lint + format + build, and drive both pages
      in a real browser at phone and laptop widths. Commit unit B.

## Progress

Both units done.

- Unit A — commit `884cc0e`. `StreamDetails` extracted, `CeremonyStream.spec`
  untouched and green, `STREAM_PATH` disallowed.
- Unit B — `StreamInvitation`, `app/transmision/page.tsx`, the door on `/`.

Verified, not assumed:

- 2048 tests, 108 files, green. typecheck, lint, format:check, build clean.
- `curl /robots.txt` returns `Disallow: /transmision` alongside `/i/` and
  `/console`, and no `Disallow: /`.
- Driven in Chromium: tapping the link on `/` lands on `/transmision`, the
  served `<meta name="robots">` reads `noindex, nofollow`, zero console errors.
- The four values render verbatim. The live row still holds seeded placeholders
  for the time, the meeting id and the passcode, and the page shows them as
  such — which is the doctrine working, and also the couple's to-do list.

**One defect caught by reading the build output rather than trusting a
comment.** The first build reported `○ (Static)` for this route: reading the
database is NOT enough to make a page dynamic, because Next cannot tell that a
promise touches a network. The meeting id and passcode were baked into the build
output, so correcting either from the console would have changed nothing until a
redeploy — silently, on the one day it matters. Fixed with `await connection()`,
which the installed docs name as the successor to
`export const dynamic = 'force-dynamic'`
(`04-functions/use-search-params.md:264`). The build now reports `ƒ`.

A second, smaller one caught by looking: the blurred backdrop rendered as flat
black, so the visual continuity its comment claimed did not exist. The
photograph is a dusk shot; it needed the exposure lifted, not only the opacity.

## Discovered while verifying

The live `ceremony` row ALREADY holds real values for `couple_names`
("Luis & Michell") and `ceremony_date` ("28-11-2026"). The landing renders both
from constants in `lib/domain/wedding-day.ts` instead. The duplication recorded
in `odd/tasks/wedding-landing.md` as bounded and theoretical is therefore live:
two places hold this wedding's date, and they already disagree in form.

### Unit C — the door opens in the final week

- [x] C1. `lib/domain/stream-window.spec.ts`: closed at eight days, open at
      exactly seven and never a millisecond earlier, open for ever after.
- [x] C2. `lib/domain/stream-window.ts`, which now also owns `STREAM_PATH` so a
      component need not import from `app/**`. `robots.ts` re-exports it.
- [x] C3/C4. `components/landing/StreamLink.tsx`, and C5 wires it into `/`.

The copy is the couple's: **"Acompáñanos por Zoom"**.

`useSyncExternalStore`, NOT a `useEffect` that calls `setState`. The first
attempt was the effect, and `react-hooks/set-state-in-effect` rejected it — a
synchronous `setState` in an effect is a second render React was never asked
for, and here it computed a value that was available during the first one. The
hook is built for reading an external store: `getServerSnapshot` answers closed
during prerender and hydration, `getSnapshot` answers afterwards, React
reconciles them. It is also strictly better for the reader: no flash at all,
where the effect had one frame.

Before the window the control is a disabled `<button>` carrying its reason
through `whyDisabled`, AND the same sentence on screen — a `title` never appears
on a touch device, which is where this page is read. Inside the window it is a
`<Link>` with identical words.

### Unit D — the reminder

- [x] D1/D2. `lib/domain/calendar-event.ts` — the `.ics` and the Google
      Calendar URL, both derived from one `CalendarEvent`.
- [x] D3. `app/transmision/evento.ics/route.ts`.
- [x] D4. `StreamInvitation` gains both actions.

The format has teeth, and the tests earn their keep on all of it: CRLF on every
line (Outlook rejects bare LF outright), folding at 75 **octets** rather than
characters because this copy is Spanish and a cut inside a multi-byte sequence
hands the calendar invalid UTF-8, backslash escaped BEFORE comma (the other
order escapes the escapes), and a UID derived from the instant so saving twice
updates one entry instead of ringing twice. Two `VALARM`s — a day before and an
hour before — because an entry with no alarm is a note nobody is reminded of,
which is the problem this was added to solve.

`TextEncoder`, not Node's byte-length helper: `lib/domain` is forbidden Node
built-ins so a client component may import it, and the linter cannot catch that
one because it is a global rather than an import.

The start comes from `WEDDING_INSTANT`, not from `ceremony_time`. That column is
free prose an operator types, and parsing it into an instant is a guess whose
failure mode is an alarm ringing on the wrong day.

Verified against the running server: `curl` returns `text/calendar; charset=utf-8`,
`attachment; filename="boda.ics"`, `no-store`; the body has 25 CRLF and **zero**
bare LF, and its longest line is exactly 75 octets. In Chromium with the clock
fixed: at 69 days out the landing shows one disabled button whose title reads
"El enlace se abre el 21 de noviembre de 2026" and no link; at six days out, one
link and no button. Zero console errors in both.

### Unit E — one stage, and no downloads

On the couple's instruction: the `.ics` action is gone, only Google Calendar
remains, and `/transmision` now stands on the same layout as `/`.

**The file was removed, not hidden.** `app/transmision/evento.ics/route.ts` is
deleted, and with it `buildIcs` and its folding, escaping and alarm code — an
endpoint nothing links to is worse than one that never existed. Git holds it.
The cost is named rather than buried: a guest on Apple Calendar or Outlook with
no Google account now gets no entry from this page.
`StreamInvitation.spec.tsx` holds the rule — no `href` matching `.ics`, no
`download` attribute on any anchor — so the obvious "improvement" of adding the
file back cannot happen without the couple deciding it again.

**`components/landing/PhotoStage.tsx`** now owns the dark ground, the blurred
64px backdrop and the framed photograph, and both public pages render inside
it. Copied instead of shared, the two would have diverged on the first tweak to
either — which is precisely the seam the couple asked to remove.

It takes `overlayOnMobile`. True on `/`, where the words are a heading, a date
and four figures and the photograph IS the page. False on `/transmision`, whose
content is a card of credentials and two paragraphs: unreadable laid over a
photograph, and pushed off the screen stacked below one. There the photograph
appears only at `lg`, and the blurred ground carries the continuity on a phone.

Unifying the backdrop meant one set of values for both, and the brighter pair
won — the landing's backdrop is slightly warmer than it was.

Verified in Chromium at 1440×900 and 390×844: no horizontal overflow on either
page at either size, zero console errors, and the only two links on the stream
page are "Agregar a Google Calendar" and "Volver al inicio". 2083 tests green;
typecheck, lint, format and build clean. The build no longer lists
`/transmision/evento.ics`.

### Unit F — the song plays on both pages, and across the jump between them

The couple asked for the music on `/transmision`. Rendering a second
`MusicToggle` there would have delivered the control and broken the thing it is
for: `/` and `/transmision` navigate to each other through `<Link>`, which is a
CLIENT-SIDE navigation, so React unmounts the page's tree and mounts the next
one. A new `<audio>` element, the song back at zero, and the autoplay attempt
running again — on every tap.

So it moved into a layout. The installed Next states the guarantee plainly:
"Layouts do not re-render on navigation"
(`03-file-conventions/layout.md:240`).

`app/(public)/layout.tsx`, in a route GROUP rather than the root layout.
`(public)` changes no URL — the build still reports `○ /` — but it scopes the
song to exactly the two public pages. In `app/layout.tsx` it would also have
reached `/console`, where an operator is working, and `/i/[slug]`, which is a
different surface with its own voice.

PROVEN, NOT ASSUMED. The `<audio>` node was branded with a `data-` attribute on
`/` and looked up again after following the link: `node=same-node`, so it was
never remounted. `currentTime` went 0.04 → 2.67 with `paused === false`
throughout, and the control still read "Pausar la música". Zero console errors.
The clock was fixed inside the final week so the door on the landing was a live
link and the navigation was the real one.

2085 tests green; typecheck, lint, format and build clean.

### Unit G — the card stops being a form

The four values were four identical rows in two columns, and that was the
defect: they are not four of the same thing. The date and the time are READ,
glanced at once for context. The meeting id and the passcode are TRANSCRIBED —
typed into another application, on a phone, often while the ceremony is already
starting. Giving an eleven digit number the same weight as the word "Fecha" is
what made it read as a form.

So the date and time became a centred caption, the two credentials became the
content, and each carries a copy button. The caption's `<dt>` labels are
`sr-only` rather than deleted: "28-11-2026 · 5:00 p. m." needs no label for a
reader and very much needs one for a screen reader.

`StreamDetails` is now a client component, which `CeremonyStream` inherits — the
household behind the phone gate gets the same card and the same buttons, which
is the point of having extracted it.

TWO CORRECTIONS MADE WHILE BUILDING IT, both worth keeping:

- The credentials were set in `font-display` (Yeseva One) beside a comment
  arguing that tabular figures matter here. The two contradicted each other:
  Yeseva is a decorative single-weight serif with no tabular set, so the utility
  had nothing to apply. They are set in the body grotesque now, which is the
  face that keeps a 1 from becoming a 7.
- Two tests went red because `stubClipboard` ran BEFORE `userEvent.setup()`, and
  user-event installs a working clipboard fake of its own. The stub was being
  overwritten, the write "succeeded", and the refusal case could not happen at
  all. Set the user up first, then replace the clipboard.

The button is icon-only and so is its confirmation, deliberately: its accessible
name carries everything ("Copiar el ID de la reunión", then "Copiado"), so it
contributes no TEXT to the `<dd>` it sits in. That is what keeps each value
readable as exactly the value — by a screen reader, and by the pair assertions
this card has had since it was extracted.

A refused write does NOT set the copied state. `navigator.clipboard` is
undefined outside a secure context and can be refused by permission inside one;
a button claiming "copiado" over an empty clipboard sends a guest to Zoom to
paste nothing, convinced they have the id. The value stays on screen either way,
so failing quietly costs nothing and lying costs the call.

Verified against a real Chromium with clipboard permission: the value actually
reached the clipboard, the button read "Copiado" and reverted after two seconds,
zero console errors. 2090 tests green; typecheck, lint, format and build clean.

### Unit H — the page speaks to one person, and explains nothing

Two copy changes from the couple, and one of them carries a decision.

The lead was "Vamos a transmitir la ceremonia en vivo por Zoom, así que pueden
acompañarnos desde donde estén." It is now "Te esperamos. Vamos a transmitir la
ceremonia en vivo para que puedas acompañarnos desde donde estés." Warmth first,
the practical fact second: opened with logistics this page reads as a calendar
entry, and the guests who land here are the ones who cannot be in the room.

THE REGISTER CHANGED WITH IT, DELIBERATELY. "Te esperamos" and "puedas" are
singular, and the rest of the product is plural. That is not an inconsistency
to fix later — `/i/[slug]` addresses a HOUSEHOLD and names every member, so
"ustedes" is right there; this page is read by one person at a time. The
couple's own wording for the landing's door ("Acompáñanos por Zoom") had already
chosen the singular. The page is now singular throughout, and a test asserts it:
the plural forms are what would drift back in, since this component sits in the
same folder as the ones written in them.

And the line explaining how to use Zoom is gone. The couple's reason is worth
recording: everybody already knows how to join a Zoom call, and a page that
explains it anyway is a page that thinks less of whoever is reading it.

2092 tests green; typecheck, lint, format and build clean.

### Unit I — the couple stop being covered, on both pages

Two reports, one cause: on a phone the words and the couple were competing for
the same vertical space. MEASURED ON THE PHOTOGRAPH — they occupy from 52% to
88% of its height; above 45% there is nobody, only sky, waterfall and the
lantern.

**The landing.** The words moved from the foot of the screen to the top. They
had been `justify-between`, which put the heading, the date and four figures
straight across the couple — and the block had grown past what the bottom could
hold once the countdown gained a button and a line of explanation. The block is
about 300px and the free band above is 380, so it fits with room and the two of
them are completely clear. The top scrim grew to 55% and the bottom one shrank
to a short anchor; 80% falling to nothing still lets the lantern read through.

**The stream invitation.** `PhotoStage`'s boolean became `mobilePhoto:
"overlay" | "band"`. Overlay was tried first on this page and measured: its
content is about 700px on an 844px screen, so the card landed squarely on the
couple — their feet showing and nothing else — and a paragraph fell across the
lit lantern. The photograph was present and the two people in it were gone.

`band` puts the photograph in a 38dvh strip at the top, cropped at 72% where the
couple are, and the words in grid ROW TWO beneath it. Left in row one they
overlaid the strip and put the heading straight back across their faces, which
is the whole point of the mode.

Verified at 390×844: the landing is one screen with the couple entirely
unobscured; the stream page is 1046px with the meeting id at y=744, above the
fold. Desktop is untouched at 1440×900 — both changes are below `lg`. No
horizontal overflow and zero console errors at any size. 2092 tests green;
typecheck, lint, format and build clean.

## Next step

For the couple: fill `ceremony_time`, `stream_meeting_id` and `stream_passcode`
in the console — the stream page shows the seeded placeholders until they do.

For the code: wire `/` to the `ceremony` row and delete the constants. Only the
countdown instant still needs a column that does not exist.
