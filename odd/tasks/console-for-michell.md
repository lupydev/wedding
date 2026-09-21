# A console Michell can run without being taught

## Objective

The couple's words: "sigue habiendo mucho slop en los cruds de invitaciones y de
invitados, debe ser mucho más simple poder crear un invitado y poder escoger un
invitado para la creación de una invitación… vi que al crear el invitado le puse
apodo sin embargo en la creación de la invitación no registró el apodo… la lista
de invitados está súper desorganizada, debe estar organizada por fecha de
creación DESC… además se le debe de poder mediante un botón o algo enviar la
invitación individual si se quiere al invitado sin necesidad de pertenecer a una
invitación, estas son para grupos familiares de 2 o más personas… recuerda que mi
novia no es técnica."

Explicitly out of scope for now, by their own instruction: the invitation's
visual design ("posteriormente a esto vamos a hacer todo el tema de diseño"), and
seed data of any kind ("dejá que yo cree tanto los invitados como las
invitaciones").

## The nickname, diagnosed before it was believed

**The report was "no registró el apodo". The data was registered. The console
never showed it.**

Proven at the repository, against the running database: a directory guest
created with "Tita" comes back holding "Tita"; an invitation built from that
picked guest stores the nickname on the member row AND derives its greeting from
it. Both throwaway checks passed on the first run.

What is true is worse in a quieter way. `CONSOLE_GUEST_COLUMNS` in
`lib/server/invitations.ts` selects `id, full_name, phone_e164, phone_last8,
is_primary, is_child` — **no nickname at all** — and `GuestList.tsx` and
`lib/domain/console-list.ts` contain the word zero times. So the nickname is
typed, stored, used to build the greeting, and then invisible on the one screen
the couple spend their time on. From the outside that is indistinguishable from
not being saved, which is exactly what it looked like.

## The ordering, and why the old one was wrong

The directory sorts alphabetically through a Spanish collator, and the reasoning
was that a directory is where you look somebody up by name. That reasoning fits
a finished list. It does not fit the list being BUILT: the couple are typing
forty people in one sitting, and the only question that matters between one
entry and the next is "did that one land?" — whose answer is at the top only if
the newest is at the top.

`created_at DESC`, as asked.

## The individual send

"Enviar la invitación individual… sin necesidad de pertenecer a una invitación,
estas son para grupos familiares de 2 o más personas."

An invitation is still the unit that gets sent — it carries the address, the
gate and the audit trail — so an individual send is a ONE-PERSON invitation
created on the press, not a second kind of thing. That is already the couple's
own model: "el slug sea el nombre del grupo familiar y el de la persona
individual el nombre completo".

What changes is that nobody has to build a household to send to one person. The
button does it.

**Stated rather than asked:** that one-person invitation then appears in the
invitations list like any other. Keeping it out would need a third concept, and
the couple asked for exactly two CRUDs.

## Work units

- [x] **U1 — the list answers "did that one land?"** Guests ordered
      `created_at DESC`, and the nickname visible everywhere a person is named,
      including the console's invitation rows where it is currently not even
      selected from the database.
- [x] **U2 — one press sends to one person.** A send affordance on a guest who
      belongs to no household: it mints their one-person invitation, addresses
      it to them, and lands on the dispatch screen.
- [ ] **U3 — fewer steps and less noise in both CRUDs.** Named against the
      screens as they actually are, once U1 and U2 have settled what they hold.

## Checks per unit

`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run build`, `PORT=3100 npx playwright test`. Strict TDD: RED observed in
the runner before implementation, quoted here.

## Progress

### U1 — done

**The ordering.** `buildGuestDirectory` sorts `created_at DESC`, with the id as
a tiebreak. The tiebreak is not defensive padding: `created_at` defaults to
`now()` and an import writes a whole file inside one statement, so identical
timestamps are ordinary — and without a tiebreak the list reshuffles between
two renders of the same data, which is the kind of flicker that makes a screen
feel broken without ever being wrong.

The Spanish collator it replaced is gone. Its reasoning was sound for a
FINISHED list and wrong for one being built.

**The nickname, and the report was half right in the most misleading way.**
Two throwaway checks against the running database, both green on the first run:
a directory guest created with "Tita" comes back holding "Tita", and an
invitation built from that picked guest stores the nickname on the member row
AND derives its greeting from it. The component test added here shows the
picked card carried it too.

So nothing was losing it. `CONSOLE_GUEST_COLUMNS` and
`CONSOLE_INVITATION_SELECT` simply never asked the database for the column, and
`GuestList.tsx` and `console-list.ts` contained the word zero times. Typed,
stored, used — and invisible on the one screen the couple live in, which from
the outside cannot be told apart from never having been saved.

Both projections now select it, `ConsoleListGuest` carries it, and the row
renders it BESIDE the full name rather than instead of it: the nickname is what
the greeting says, the full name is who the person is, and a list showing only
"Anita" stops being one you can check against reality.

**One test-robustness fix worth keeping.** The directory's add form and every
row's editor carry the same field labels, so a bare `getByLabel("Apodo")` on a
list of forty is ambiguous by construction. The browser tests scope to
`form.guest-directory__new`.

Green: 2241 unit and component tests, 194 browser tests, typecheck, lint,
format, build.

### U2 — done

A guest who belongs to nobody carries "Invitar a {nombre} sola". The press mints
their one-person invitation and the server redirects to the same dispatch
screen every household reaches — so a message is still composed, gated and
audited in exactly one place. What disappears is assembling a household for a
cousin who is coming by herself.

**`createSoloInvitation` composes `createInvitation` rather than writing rows.**
That is what makes it small: the refusal for a guest somebody else already
took, the compensation that leaves nothing behind, and the recipient being
recorded all arrive for free, already tested.

**The address is their full name and the greeting is their nickname, and that
is not an inconsistency.** `greetingName` feeds the slug; a `derived` source
makes the STORED greeting come from the member instead. So Marta Ruiz, known as
Tita, lives at `/i/marta-ruiz` and is greeted as "Tita" — the couple's own rule,
"el slug… de la persona individual el nombre completo".

**Checked twice, and both earn their place.** The repository reads the guest and
refuses one who already belongs somewhere, which is what gives the operator a
sentence they can act on. `placeGuestInInvitation`'s `invitation_id is null`
travels inside the UPDATE and is what actually makes the race impossible — the
first read can go stale between the two statements and the second cannot.

**The recipient is recorded on creation**, because the only member is
necessarily the only possible recipient. An invitation arriving unchosen would
land the operator on a dispatch screen that refuses, which is the exact defect
the create form had once.

**Navigation lives in the page wrapper, not the action or the component.** The
action answers with the dispatch path; the wrapper redirects. A repository that
throws navigation at its callers is a repository you cannot call from anywhere
else.

Green: 2249 unit and component tests, 196 browser tests, typecheck, lint,
format, build.

### Next: U3 — fewer steps and less noise in both CRUDs.
