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

| Fact | Value | Source |
| --- | --- | --- |
| Couple | `Luis & Michell` | The couple, this session |
| Day | 28 November 2026 | The couple, this session |
| Time of day | 00:00 `America/Bogota` | ASSUMED — see below |
| Photograph | `img/compromiso.JPG`, 737×1600 | Supplied |
| Song | `audio/sjjm_S_132.mp3`, 4.7 MB | Supplied |

**The hour is an assumption and it is marked as one.** The couple gave a DAY, not
an instant, and a countdown needs an instant. Midnight at the start of the
wedding day in Bogotá is the reading that makes "faltan N días" say exactly what
a reader expects it to say. It is one exported constant; correcting it later is a
one-line change plus its guard test.

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
- **`.JPG` in uppercase imports fine.** `nextImageLoaderRegex` in
  `node_modules/next/dist/build/webpack-config.js` is
  `/\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i` — the `i` flag decides it. The
  static import also yields `width`, `height` and a generated `blurDataURL`,
  which is why the photograph stays in `img/` instead of moving to `public/`.
- **Audio cannot be statically imported.** The mp3 must be served verbatim, so it
  goes to `public/`, which is the one folder Next serves from the base URL
  (`01-app/01-getting-started/12-images.md`, "Local images").
- **No browser autoplays audio with sound.** `HTMLMediaElement.play()` returns a
  promise that REJECTS with `NotAllowedError` without a user gesture. The song is
  therefore off until the visitor presses a button, and the rejection is handled
  rather than left to become an unhandled promise rejection.
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

- [ ] B1. `components/landing/Countdown.spec.tsx`: renders the dashed skeleton
      before mount; renders figures after; the machine `<time>` is always
      present; the figures are `aria-hidden`. Observe RED.
- [ ] B2. `components/landing/Countdown.tsx`. GREEN.
- [ ] B3. `components/landing/MusicToggle.spec.tsx`: starts paused and labelled
      to play; a click plays and relabels; a rejected `play()` leaves the control
      labelled to play and throws nothing. Observe RED.
- [ ] B4. `components/landing/MusicToggle.tsx`. GREEN.
- [ ] B5. `app/page.spec.tsx`: the names, the date and the photograph's alt text
      are present. Observe RED.
- [ ] B6. `app/page.tsx` — hero composition and `metadata`. Move the song to
      `public/audio/`. GREEN.
- [ ] B7. `npm test` + `npm run typecheck` + `npm run lint` + `npm run build`.
      Commit unit B with both assets.

## Progress

Unit A done: 11 unit tests green, typecheck and lint clean. Next: unit B.

## Next step

B1.
