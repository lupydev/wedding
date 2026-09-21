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

## Done — one list

"Tus invitaciones" and then "Todas las invitaciones del evento", the second a
SUPERSET of the first, separated by four lines of prose explaining the
partition. Every owned household was fetched, reduced and rendered twice, and
the split communicated one thing — who manages each household — that every row
already says on its own face ("Gestionas tú" / "Gestiona X").

One query now, one list, one heading: "Invitaciones".

**Ownership still decides exactly what it always decided**: the send affordance,
because a WhatsApp message leaves from one account and not the other. What
changed is WHERE that is decided. `GuestList` derives `rowReadOnly = readOnly ||
!row.ownedByViewer` per ROW, and both doors — the edit link and the inline phone
editor — read that one answer. They used to be two separate conditions, and the
component's own comment had predicted the bug: "the only caller passes it
together with rows the viewer does not own, so the two guards never disagree —
which is exactly why leaving one out would go unnoticed until they did."
Merging the lists is when they disagree, and a phone editor on a row the server
refuses is worse than no editor.

The readiness check stays scoped to the operator's own households: it exists to
say which of THEIR invitations cannot be sent yet, and the other account's
blockers are not theirs to clear.

Three browser tests were rewritten rather than repaired. One asserted that the
default view lists only the operator's own households — the exact premise this
change removes — so it now asserts both partitions are present and that there
is exactly ONE section. Two more read the old heading; the negative assertions
among them moved off the bare string, because "Invitaciones" is now a nav label
too and a text query would have stopped distinguishing content from chrome.

## Next

- The five-group `DispatchPreflight`, always fully expanded, one group of which
  its own copy says can never have contents.
- Adding a member takes two presses and the first one writes nothing
  ("Agregar integrante" adds a local blank row; "Guardar integrante N" saves).
- The create form cannot choose a recipient, so every new invitation lands in
  "Sin destinatario elegido" until somebody reopens it.
- Delete `moveMemberAction` and the discarded `impact`, or give them UI.
