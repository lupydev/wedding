# Wedding landing page with a countdown

## Objective

`/` is a placeholder that renders an empty `<main>`. Replace it with the public
save-the-date: the engagement photograph full-bleed, the couple's names, the
wedding date, a live countdown to it, and the couple's song behind a button.

This surface is NOT the invitation. It carries no guest name, no address, no
phone number and no RSVP — those live at `/i/[slug]` behind the phone gate. The
landing says one thing to anybody who opens it: these two, this day, this long
to go.

## Facts, and where each one comes from

| Fact        | Value                          | Source                   |
| ----------- | ------------------------------ | ------------------------ |
| Couple      | `Luis & Michell`               | The couple, this session |
| Day         | 28 November 2026               | The couple, this session |
| Time of day | 00:00 `America/Bogota`         | ASSUMED — see below      |
| Photograph  | `img/compromiso.JPG`, 737×1600 | Supplied                 |
| Song        | `audio/sjjm_S_132.mp3`, 4.7 MB | Supplied                 |

**The hour was an assumption for exactly one commit, and is now the real one.**
The couple gave a day; a countdown needs an instant, so midnight was used and
marked as assumed. The ceremony begins at 5:00 p.m., and the countdown now
reaches zero when they start walking rather than seventeen hours earlier — so on
the morning of the 28th the page reads "0 días, 9 horas" instead of having
expired overnight.

Correcting it cost one constant, its guard test, and one unrelated assertion:
`formatWeddingDate`'s zone test used Honolulu, which was the 27th at midnight
Bogota and is noon on the 28th at 17:00 Bogota. It went red for a correct reason
and moved to Kiritimati (UTC+14, already the 29th). That is a guard working, not
a test to relax.

### Why these facts are constants here and not the `ceremony` row

`ceremony.couple_names` and `ceremony_date` exist and every invitation surface
reads them — `supabase/migrations/0009_ceremony.sql:61` states the rule: "Every
surface that shows them MUST read this row; never restate a value."

This surface does not follow that rule, deliberately, and the reason is the
column type. `ceremony_date` is `text` (`0009_ceremony.sql:52`), free prose an
operator types. A countdown cannot be driven by prose: parsing "28 de noviembre
de 2026" back into an instant is a guess that fails silently on any wording the
parser did not anticipate, and a landing page that silently counts to the wrong
day is worse than one that counts to a day written in a file.

The honest options were (a) add a `timestamptz` column to `ceremony`, teach the
console form to edit it, and read the row here, or (b) one constant and one guard
test. (a) is the correct end state and is NOT in this scope; the couple asked for
the landing first and the invitation afterwards. This document is the record that
the duplication is known and bounded: two values, one file, one test.

**When the `ceremony` row gains a real instant, this landing must read it and
these constants must be deleted.** Until then the drift is between a constant and
a placeholder (`{{CEREMONY_DATE}}`), so there is nothing yet to drift from.

## Constraints measured, not assumed

- **`priority` is deprecated in Next 16.3.4.** The hero image uses
  `preload={true}`. Verified at
  `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md:293`
  and in that file's version history for `v16.0.0`.
- **`objectFit` is not a prop.** Removed in v13 (same file, version history). It
  goes through `style` or a Tailwind `object-*` utility.
- **`.JPG` in uppercase bundles but does NOT typecheck, and the two disagree.**
  `nextImageLoaderRegex` in `node_modules/next/dist/build/webpack-config.js` is
  `/\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i`, so the bundler accepts the
  uppercase extension. `node_modules/next/image-types/global.d.ts` declares
  `'*.jpg'` only, and TypeScript's wildcard module matching is case-SENSITIVE,
  so `tsc` reports TS2307 on the very same import. The file was renamed to
  `img/compromiso.jpg` rather than papering over the gap with a `*.JPG`
  declaration of our own. The static import also yields `width`, `height` and a
  generated `blurDataURL`, which is why the photograph stays in `img/` instead
  of moving to `public/`.
- **`tools/no-source-placeholders.spec.ts` scans comments, not just code.** A
  comment in `lib/domain/wedding-day.ts` named the seeded placeholder token
  literally and failed the suite. The guard is right — a comment naming one
  teaches the next reader that the value is a compile-time constant. The
  comment now describes it without writing it.
- **Audio cannot be statically imported.** The mp3 must be served verbatim, so it
  goes to `public/`, which is the one folder Next serves from the base URL
  (`01-app/01-getting-started/12-images.md`, "Local images").
- **No browser autoplays audio with sound, and no setting on our side changes
  it.** `HTMLMediaElement.play()` rejects with `NotAllowedError` on a page nobody
  has interacted with, and the `autoplay` attribute is silently ignored under the
  same rule. Measured in Chromium at the default policy: after `load` the element
  is `paused` and not one byte of the mp3 has been fetched.

  What IS possible is two attempts. Ask once after the window's `load` event —
  a visitor Chrome scores as engaged with this origin is allowed, and for them
  the song simply starts (measured with `--autoplay-policy=no-user-gesture-required`:
  `paused=false`, `currentTime=1.68` with nothing pressed). If refused, wait for
  ANY gesture anywhere: the browser's rule is satisfied by any interaction, not
  only one aimed at a control, so a tap on the photograph is enough (measured:
  `paused=false`, `currentTime=1.69`, `loop=true` after one raw click).

  The attempt waits for `load` rather than firing on mount, so the 4.7 MB never
  competes with the photograph for the connection.

- **Audio that starts by itself needs a way to stop it** — WCAG 2.2 success
  criterion 1.4.2, for anything over three seconds. That is what the button is
  for now, and it is on screen from the first paint.
- **The countdown may not be rendered on the server.** `/` is statically
  generated; a server-rendered figure would be frozen at build time and would
  either ship stale or mismatch on hydration. The first client render matches the
  server markup exactly (no figures), and `useEffect` fills it in. That is why
  `Countdown` renders a dashed skeleton before mount.
- **A per-second `aria-live` region is unusable with a screen reader.** The
  ticking figures are `aria-hidden`; the accessible truth is a single `<time>`
  element carrying the machine date.
- `eslint.config.mjs` forbids React, Next and Node built-ins inside
  `lib/domain/**`. `Intl` is a language built-in, not a Node built-in, and is
  already used by `lib/domain/rsvp-deadline.ts`.

## Scope

In scope: `lib/domain/countdown.ts`, `lib/domain/wedding-day.ts`,
`components/landing/**`, `app/page.tsx`, moving the song into `public/`,
committing both assets.

Out of scope: the invitation redesign, a `ceremony` timestamp column, any change
to `robots.ts`, any change to the console.

## Delivery

Strategy `ask-on-risk`. Forecast ≈ 700 authored changed lines across two work
units, so the slice boundary is the unit A commit.

TDD: **strict**, source = session configuration. Runner = `npm test`
(`vitest run`). Every task below observes RED before its implementation exists.

## Tasks

### Unit A — the pure domain (≈ 280 lines)

- [x] A1. `lib/domain/wedding-day.spec.ts`: the target instant IS midnight on
      2026-11-28 in `America/Bogota`, and the Spanish long date reads
      "28 de noviembre de 2026". Observe RED.
- [x] A2. `lib/domain/wedding-day.ts`: `WEDDING_INSTANT`, `WEDDING_TIME_ZONE`,
      `formatWeddingDate`. GREEN.
- [x] A3. `lib/domain/countdown.spec.ts`: whole days/hours/minutes/seconds
      remaining; the boundary at exactly zero; any instant past the target
      reports arrival with every unit at zero. Observe RED.
- [x] A4. `lib/domain/countdown.ts`: `remainingUntil(target, now)`. GREEN.
- [x] A5. `npm test` + `npm run typecheck` + `npm run lint`. Commit unit A.

### Unit B — the surface (≈ 420 lines)

- [x] B1. `components/landing/Countdown.spec.tsx`: renders the dashed skeleton
      before mount; renders figures after; the machine `<time>` is always
      present; the figures are `aria-hidden`. Observe RED.
- [x] B2. `components/landing/Countdown.tsx`. GREEN.
- [x] B3. `components/landing/MusicToggle.spec.tsx`: starts paused and labelled
      to play; a click plays and relabels; a rejected `play()` leaves the control
      labelled to play and throws nothing. Observe RED.
- [x] B4. `components/landing/MusicToggle.tsx`. GREEN.
- [x] B5. `components/landing/SaveTheDate.spec.tsx`: the names, the date and the photograph's alt text
      are present. Observe RED.
- [x] B6. `app/page.tsx` — hero composition and `metadata`. Move the song to
      `public/audio/`. GREEN.
- [x] B7. `npm test` + `npm run typecheck` + `npm run lint` + `npm run build`.
      Commit unit B with both assets.

## Progress

Both units done.

- Unit A — commit `7a6caba`. 11 unit tests.
- Unit B — `components/landing/{Countdown,MusicToggle,SaveTheDate}.tsx` and
  `app/page.tsx`. 18 component tests.

Verified, not assumed:

- `npm test`: 2027 tests, 106 files, green.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`:
  clean. `/` builds as `○ (Static)`, which is what makes the client-only
  countdown necessary rather than merely tidy.
- Driven in a real Chromium at 390×844 and 1440×900: zero console errors on
  both, so no hydration mismatch. Countdown read 68 días, which is correct for
  20 September 2026.
- The song: zero `.mp3` requests before the button is pressed, `206` and
  `paused === false` after. `preload="none"` does what it claims.

Two defects were found by LOOKING at the rendered page, and neither was
reachable from a unit test: the toggle in the bottom-right corner overlapped the
word "segundos" at 390px, and the date line wrapped and orphaned "2026". Both
fixed; the reasoning is in the files.

## Layout, after seeing it on a real laptop

The first version was full-bleed `object-cover` at every size, and on a 1920×950
window that is a zoom, not a photograph: 737×1600 is 0.46:1, a laptop window is
about 2:1, and `cover` scales on the WIDTH — so 26% of the photograph's height is
on screen and every crop position is only a choice of which three quarters to
discard. The waterfall and the lantern were never once visible on a laptop.

`object-contain` alone was worse: the whole photograph showed, marooned in a
black page, with the heading still lying across the couple.

What holds is ONE grid with two layouts. Both children sit in the same cell below
`lg`, so the words are on the photograph — right, because there the viewport and
the photograph are the same shape. At `lg` a second column appears and the words
move into it; the photograph gets `aspect-[737/1600]` and becomes a framed print,
whole, with the scrims hidden because nothing is overlapping it any more. The
sides are filled by a 64px-wide copy of the same photograph, blurred — about two
kilobytes, because a 64px image blurred by 64px is indistinguishable from a
full-resolution one blurred by 64px.

Verified at 390×844, 820×1180, 1024×768 and 1920×950: no horizontal overflow at
any of them, the heading stays on one line (428px measured), zero console errors.

**One defect cost the whole mobile layout and is worth remembering.** In the
rewrite the text column and both scrims were left `position: static` while the
photograph's `<Image fill>` is `absolute`. Painting order is not DOM order —
every positioned element paints above every non-positioned one, whatever the
markup says — so on a phone the page rendered the photograph and NOTHING else:
no heading, no date, no countdown, and no error anywhere. Found by looking at a
screenshot. All three now carry `relative`.

## Next step

Open question for the couple, recorded rather than decided: wire the landing to
the `ceremony` row. `couple_names` is ALREADY a column and could be read today;
only the countdown instant needs the new `timestamptz`. Doing it makes `/`
dynamic instead of static and makes the page render the seeded placeholder until
the console is filled in — which is the project's stated preference for an
unfinished value, and a decision that belongs to the couple, not to this
document.
