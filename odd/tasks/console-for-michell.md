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
- [x] **U3a — the invitation form stops asking for two names.** It asks for
      "Nombre del hogar" AND "Nombre del grupo". `displayName` is read back on
      exactly one surface — the deletion sentence — while every list, heading
      and label shows `greetingName`. So one of the two fields is a question
      about a value the operator will never see again, asked of somebody who
      has no way to know that.
- [x] **U3b — a guest's row says less and offers one obvious action.** It now
      carries a name line, a household line, a recipient line and up to three
      buttons. Times forty people, that is a wall rather than a list.
- [x] **U3c — the invitation form leads with picking, not typing.** The
      directory picker sits under the member cards, so the default path is
      re-typing somebody who already exists. "Mucho más simple poder escoger un
      invitado" means the picker comes first and typing a new person is the
      secondary affordance.

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

### U3a — done

The form asked for a "Nombre del hogar" and a "Nombre del grupo", each under
its own paragraph explaining how it differed from the other — about ten lines
of prose to separate two values, one of which the operator never sees again.

**`display_name` surfaces on exactly ONE surface in the whole console**: the
sentence confirming a deletion. Every list, heading, aria-label and error shows
the greeting. So the form was asking a non-technical operator to invent a value
with no way to know it did not matter.

The column stays — it is what those messages name — and the repository fills it
from the greeting it resolves, on creation and on edit alike. The internal
label and the name on screen can no longer disagree.

**No hidden field.** Submitting a copy of the visible value under another name
would be the same two values with one of them invisible, which is the defect
rather than the fix. `displayName` became optional on `NewInvitation` and
`InvitationEdit`; the importer still supplies one, because its file is the
source of truth for the households it describes.

**One ownership test was tightened while passing through.** It asserted a
subset of what the update action forwards; it now asserts the whole argument,
so a field creeping back in fails rather than passing unnoticed.

**Two stale sentences on the edit screen.** It promised that "el nombre del
hogar, el saludo y la fecha límite" are saved by the final button. The
household name has just gone, and the per-invitation deadline went in migration 0016.

Green: 2254 unit and component tests, 196 browser tests, typecheck, lint,
format, build.

### U3b — done

A row carried a name line, a household line, a recipient line and three
controls. Forty of those is a wall.

**Three lines became two.** The household and who receives the message are one
sentence now — "En Familia Restrepo · el mensaje le llega a Ana". The recipient
note still earns its place: a send is addressed to the member its invitation
names, which need not be the person whose row was pressed, and the list is
ordered by when people were added, so that member's own row is nowhere nearby.
What was wrong was giving it a paragraph of its own.

**Deleting left the resting row.** It sat beside "Editar" on every one of those
forty rows — a destructive control one mis-tap away, on a phone. It lives
inside the editor now: the press that opens the editor is where somebody says
they want to change this person, and it is not a press anybody makes by
accident. It sits OUTSIDE the save form, because a destructive control inside
one is a mis-tap from the button next to it.

So a resting row offers exactly two controls, and the primary one is decided by
the person: send, for somebody in a household that can be written to; invite
separately, for somebody in none. The two cannot both apply — each needs the
opposite of the other.

**A defect of my own making, fixed.** The button read "Invitar a {nombre}
sola", which is simply wrong for half a guest list. It reads "Invitar por
separado"; the name lives in the accessible name, where it tells two rows apart
without putting a guess about somebody's gender on screen.

**One test-robustness fix.** The component spec located rows by the name span,
which disappears when the editor opens — the same trap the browser suite hit
earlier. Both now use the row's own `data-guest-name`.

Green: 2259 unit and component tests, 196 browser tests, typecheck, lint,
format, build.

### U3c — done

The picker was already above the member cards. The form still OPENED with a
blank card, and a blank card with four empty fields is the loudest instruction
on a screen — so the default path stayed "type somebody in", on a console whose
guest list is built in the directory first.

**It opens with no card when there is anybody to pick.** Typing stays one press
away, and it is still the only path when the directory has nobody free: a
screen whose sole affordance is one nobody can use would be worse than the
blank card ever was.

**Two labels became one.** The add button called itself "Agregar otra persona"
once a card existed and "una persona nueva" when none did — the same control
naming itself two things by state, which is a small puzzle for the reader and
an ambiguity for anything locating it. "Nueva" is the word that matters either
way: it separates typing somebody in from picking somebody who exists.

**A browser test stopped depending on state it does not own.** Whether the form
opens with a card is decided by the DIRECTORY, which is shared with every other
spec in a single database. The test now asks for a card when it needs one,
which is also what the product does.

Green: 2264 unit and component tests, 196 browser tests, typecheck, lint,
format, build.

## Next

- `moveMemberAction` is still dead code with tests — a full server action and
  repository function with no UI, and now the closest thing to "move somebody
  from one household to another", which the directory makes sensible to want.
- Nothing warns when the same PERSON is written twice under two names. The
  directory makes that visible for the first time; nobody has asked for it.
- The importer writes every guest straight into a household and knows nothing
  about the directory.
- The invitation's visual design, which the couple deferred until now.
