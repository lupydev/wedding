# A console two people can actually use

## Objective

The couple's words: "tenemos un poco de basura sin sentido, debe ser muy
minimalista y sencilla, no hay forma simple de crear un invitado ni de crear una
invitación o de agregar los invitados a un grupo familiar específico… en la
página principal de console debería existir un dashboard muy sencillo de
invitaciones enviadas, y asistentes."

## The finding that shaped the plan

**None of the CRUD is missing.** Creating an invitation, adding, editing and
removing members, choosing the recipient, dispatching, deleting and editing the
wedding facts all exist as working server actions with tests. The gap is reach
and noise, not absence.

Two things were genuinely dead: `moveMemberAction` (a full server action and
repository function with spec coverage and NO UI anywhere) and
`removeMemberAction`'s `impact` return value (computed, returned, discarded at
`edit/page.tsx`).

## Done

- **`components/console/ConsoleDashboard.tsx`** — four figures over the whole
  event: invitaciones enviadas, personas confirmadas, sin enviar, sin responder.
  It replaced TWO `ProgressSummary` blocks of ten sentences each; the two scopes
  overlapped, so "Confirmadas" appeared twice on one screen with different
  denominators. Zero new queries: every field was already computed by
  `summarizeConsoleList`, and `operatorAssertedSends` had been computed and
  thrown away since the day it was written.
- **Creation is in the header.** It used to be a button at the foot of
  `GuestList` — rendered in BOTH lists, including the read-only one where every
  other control had been withdrawn — so the more invitations existed, the
  further the way to make another one scrolled off. Nothing in the navigation
  pointed at it.
- **Navigation 5 tabs → 3.** "Revisión" and "Evento" were fragments of
  `/console`, so three of five tabs led to one page, and
  `isConsoleNavItemActive` hard-codes a fragment tab never to highlight — the
  bar could not say where you were whenever you were on one of them.
- **The device link left the header**, which was its fourth door. That screen
  still has a nav tab, a forced redirect when no declaration exists, and a red
  interstitial when the declaration does not match.

## Verified

2108 unit and component tests green, 174 browser tests green, typecheck, lint,
format and build clean. The browser suite needed four assertions re-pointed, and
one of them taught something: the dashboard is event-wide, and the E2E database
is shared across spec files running in parallel, so an exact total cannot be
asserted from there. Two tests that used to read per-operator sentences now
prove their invariant over rows in `console-list.spec.ts` instead, and the two
that must stay in the browser assert the shape (`/^\d+ de \d+$/`) and a floor.

## Done — adding somebody to a household

"Agregar integrante" claimed to add a person and added nobody: it opened a blank
card, and the person reached the invitation on a SECOND press, on a different
button, further down. An operator who pressed it once and walked away had added
no one, and the screen had told them otherwise.

- The button says what it opens: **"Agregar otra persona"**.
- The card it opens is legended **"Integrante N · sin guardar"**, and only while
  it is unsaved. On the create form no card carries it — the whole form is one
  submit, so there is nothing to distinguish.
- The cursor lands in the new name. It was press, AIM, type, save; the aiming
  was on a phone, at a field that had just appeared below the fold.

Two consequences taken rather than worked around: the spec's `row(position)`
helper matched the legend as a literal, so it became a pattern anchored at both
ends (`Integrante 1` must not match `Integrante 10`); and `autoFocus` is driven
by a state that starts `null`, so no card can match it on the first render and
nothing steals focus when the page loads.

## Next

- Merge the two guest lists into one. The home still renders the operator's own
  households and then the other account's, separately, with a paragraph
  explaining the partition. Ownership must stay where it decides something — the
  send button, because a message leaves from one WhatsApp account — but the
  lists and their counts should not be doubled for it.
- The five-group `DispatchPreflight`, always fully expanded, one group of which
  its own copy says can never have contents.
- Adding a member takes two presses and the first one writes nothing
  ("Agregar integrante" adds a local blank row; "Guardar integrante N" saves).
- The create form cannot choose a recipient, so every new invitation lands in
  "Sin destinatario elegido" until somebody reopens it.
- Delete `moveMemberAction` and the discarded `impact`, or give them UI.
