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

## Done — the rows stopped being a paragraph

Every button repeated the household's name, which is already the heading
directly above it: "Preparar envío para Familia Guzmán Peña", "Ver la invitación
de Familia Guzmán Peña", "Editar invitación de Familia Guzmán Peña". Three long
labels read as prose, not as controls. And "Editar el número de {guest}"
rendered once per GUEST, so a household of six carried six copies of the longest
string on the screen.

On screen now: **Enviar · Ver · Editar**, and a pencil per guest.

The household's name stays in `aria-label`, and that is not decoration: it is
what tells two rows' buttons apart. A list full of bare "Editar" is ambiguous to
a test, to voice control and to anybody navigating by control rather than by
eye. The visible word is CONTAINED in the accessible name and never a different
word, so the two cannot contradict each other.

The phone button kept its accessible name exactly, which is why not one
assertion moved for it. The three row actions changed theirs — "Preparar envío"
became "Enviar la invitación de …" — and ten references followed.

## Done — a readable address

`/i/k22eth3lvkzptcco` became `/i/familia-guzman-pena`. It is a link two people
send to their families over WhatsApp, and sixteen base32 characters read as a
mistake.

**This one needed a migration, and the earlier "no migration needed" was about
something else.** An individual guest is a one-person invitation and the schema
already allowed it; the slug is a different matter — `0001_schema.sql` pinned
the column to `^[a-z2-7]{16}$`, so a hyphen alone was illegal. `0014` relaxes it
to lowercase letters, digits and single hyphens, 1 to 48 characters. Nothing is
rewritten: every stored slug is sixteen base32 characters, which the new pattern
already accepts.

**Derived once and frozen.** Nothing recomputes it on a rename. An address that
followed the name would die the moment somebody fixed a typo, and it would die
SILENTLY — the console shows nothing wrong, and only the guest meets "no
encontramos esta invitación". `rotateInvitationSlug` stays random, which is what
an address should be once it has had to change at all.

**The cost, accepted after being shown.** A random slug is unguessable; a name
is not. An unknown slug renders "we could not find this invitation" while a real
one renders the phone gate, so anybody can now probe a name and learn WHETHER
that family is invited. Reading the invitation still needs a member's phone
number, which never depended on the slug.

Details worth keeping: NFD normalisation before stripping marks, so "Peña"
becomes "pena" and not "pea" — `ñ` decomposes into `n` plus a combining tilde,
and a naive "drop everything outside a-z" deletes the whole letter. The counter
starts at 2, fills gaps, and shortens the BASE rather than itself so a fourth
household of one name still fits the column. A name that spells nothing a URL
can carry falls back to a random slug.

The down script names every readable slug it is about to refuse before it
refuses — verified against the running database, which listed six and then
raised the constraint violation rather than touching a row.

STILL RANDOM: the bulk importer (`lib/server/invitations.ts`, the
`source_key` path). Households created through the console get readable
addresses; imported ones do not, which will look inconsistent the first time
the guest list is loaded from a file.

## Done — the create form asks who receives the message

It used to render a paragraph where the question belonged: "A quién se le envía
el mensaje se elige después de guardar". The reason was real — when the form is
submitted the members do not exist yet, so there is no id to point at. The
consequence was that EVERY invitation created in the console was born blocked.
It appeared in the readiness panel under "Sin destinatario elegido", and
somebody had to find it and reopen it to finish what they thought they had
already finished.

**The answer is a POSITION, not an id.** The form has no ids to offer, so it
answers with the row's index and the server resolves it. That took changing the
guest insert from `.insert(...)` to `.insert(...).select("id")`: `RETURNING`
hands the rows back in the order they were given, which is the only thing that
turns a position into a person. A second statement then records it, because the
invitation row exists before its members do. The composite foreign key on
`(id, dispatch_recipient_guest_id)` refuses anyone outside the household, which
is what makes resolving by position safe rather than merely convenient.

**The first member is preselected, and nothing is inferred.** The distinction
matters and is the one the old code was protecting: the console still infers no
recipient anywhere — not from `is_primary`, not from ordering, not from being
the only reachable number. What changed is that the form ASKS, with an answer
already filled in and visibly so. An absent answer resolves to row zero, which
is the row written with `isPrimary: true` by the same rule.

A failure recording the choice is reported, not compensated: it leaves the
invitation created and unchosen — exactly the old state, recoverable from the
edit screen — and deleting a household somebody just typed in would be worse.

**Two browser tests asserted the opposite and were rewritten, not repaired.**
One proved a created group arrived with nobody chosen; that WAS the defect. The
other opened the edit screen expecting no radio selected, then chose the first
member — on a household where that member is now already chosen, so the click
would have issued no write and the test would have hung waiting for one. It now
asserts the stored choice arrives selected and MOVES the indicator to another
member, which a write that merely added a second recipient would fail.

Green: 2149 unit and component tests, 173 browser tests.

## Next

- **The bulk importer still mints random slugs.** Households created in the
  console get `/i/familia-guzman-pena`; imported ones get sixteen base32
  characters. The first import will look like a bug.
- **Dead code with tests**: `moveMemberAction` (a full server action and
  repository function, no UI anywhere) and `removeMemberAction`'s `impact`
  return value, computed and discarded at `edit/page.tsx`.
- **`invitations.rsvp_deadline` is a dormant column.** Dropping it is the
  destructive half, to be landed alone the way 0013 was.
- Outside the console: the landing renders "¡Hoy nos casamos!" from the
  ceremony instant onwards and never stops — in January it still says it. The
  copy for what it should say instead is the couple's to write.
