# Member write refusals reach the operator

## Objective

A membership write refused by the server must tell the operator WHAT it refused,
not "check your connection". Today every failure of `addMemberAction`,
`editMemberAction`, `removeMemberAction` and `chooseRecipientAction` reaches the
console as one generic string, because the refusals are THROWN and
`components/console/InvitationForm.tsx` catches everything unconditionally.

## Problem, and why the obvious fix was already tried and reverted

Surfacing the thrown message is not an option. Two facts from the installed Next
16.3.4 docs settle it:

- `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`:
  expected errors "should be handled explicitly and returned to the client...
  avoid using `try`/`catch` blocks and throw errors. Instead, model expected
  errors as return values."
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`:
  a message forwarded from the server "show[s] a generic message with an
  identifier... to prevent leaking sensitive details". In production the refusal
  text is replaced by an opaque `digest` and never reaches the browser.

Independently of the framework, a thrown value carries no proof of who wrote it:
a `TypeError: Failed to fetch` is an ordinary `Error` with a non-empty message,
and `lib/server/invitations.ts` throws English developer text. A previous work
unit tried to filter those out and was reverted whole; the guard that replaced
it is `components/console/InvitationForm.spec.tsx` →
"a failed write never leaks what was thrown".

So: the refusals must be RETURNED.

## Constraints measured, not assumed

- `app/console/(authenticated)/actions.ts:1` is `"use server"`, which forbids
  non-function exports. The refusal type CANNOT live there. Precedent, stated
  verbatim in two existing files for this same reason:
  `app/console/login/sign-in-state.ts:4-7` and
  `app/console/(authenticated)/wedding/wedding-facts-state.ts:5-8`.
- `eslint.config.mjs:45-61` bans `@/lib/server/*` from `components/**`, so the
  type cannot live in `lib/server` either. It goes in `lib/domain/**`, which is
  React-free and vendor-free exactly so a client component may import it (D14).
- No `<form action={...}>` binds any of the four actions. The only form element
  in `InvitationForm` binds a local client function. Nothing forces a `void`
  return.
- `InvitationFormAction` (`components/console/InvitationForm.tsx:126`) is
  `(formData: FormData) => void | Promise<void>`. A `Promise<Refusal>` is NOT
  assignable to it — TypeScript's return-type-void relaxation applies only when
  the target is exactly `void`. This type must widen, and so must the four
  wrappers at `app/console/(authenticated)/invitations/[id]/edit/page.tsx:102-134`,
  which currently await and discard.
- A returned refusal must be plain serializable data: a string-literal union or
  a plain object, never an `Error` or a class instance.
- `revalidatePath` currently never runs on a throw. Every refusal return must
  skip it explicitly, in the action AND in the page wrapper, or a refused write
  re-seeds the form for nothing.

## Scope

In: the four member actions, their return types, the page wrappers, the
`InvitationFormAction` type, `runWrite`, and the rendering of a returned refusal
through the EXISTING `invitation-refusals` element and `REFUSAL_COPY` map.

Out: `updateInvitationAction` / `createInvitationAction` (the whole-form save),
`deleteInvitationAction`, `moveMemberAction` (no caller), `rotateSlugAction`.
Out: the unrendered `MembershipChangeImpact` — it is a separate gap.

## Tasks

- [x] T1 — Probe whether `requireOperator`'s `redirect()` signal is swallowed by
      `runWrite`'s bare `catch`. `lib/server/console-session.ts:139,145` calls
      `redirect()`, which raises Next's `NEXT_REDIRECT` control-flow signal, and
      `InvitationForm.tsx:481` is `} catch {` — it binds nothing and filters
      nothing. If the signal lands there, an expired session shows "revisá la
      conexión" instead of sending the operator to the login page. This is a
      pre-existing defect, not one this change introduces, and it must be
      settled before `runWrite` is touched. Determine it by test, not by reading.
- [x] T2 — Declare the returned refusal vocabulary in
      `lib/domain/invitation-draft.ts`, beside `DraftRefusal`. It must cover the
      refusals that exist TODAY, each already proven reachable:
      the five `DraftRefusal` codes (raised by `refuseInvalidMembership`,
      `lib/server/invitations.ts:743-766`), a stale invitation
      (`actions.ts:311-313` "Esa invitación no existe."), a stale member row
      (`lib/server/invitations.ts:891-893`, `:956-958`), a required field that
      arrived empty (`actions.ts:216`), a cross-household recipient
      (`actions.ts:525-527`), and a phone that could not be normalized
      (`lib/domain/phone.ts:116`). One code per distinct operator-actionable
      fact; codes the operator cannot act on stay thrown.
- [x] T3 — Return the refusal from `chooseRecipientAction` first. It is the
      smallest end-to-end slice: it returns `void` today, and its one business
      refusal is authored in the action itself with its own test
      (`actions.spec.ts:923-931`). Skip `revalidatePath` on refusal.
- [x] T4 — Widen `InvitationFormAction`, thread the return through the page
      wrapper, and render it via the existing `invitation-refusals` element.
      Note the hazard: several specs use `findByRole("alert")`, which THROWS on
      multiple matches, and the refusals `<ul>` already carries `role="alert"`.
      `components/console/InvitationForm.spec.tsx:587-640` will become ambiguous.
- [x] T5 — Extend to `removeMemberAction`. Its return becomes a union with
      `MembershipChangeImpact`; three assertion blocks need narrowing
      (`actions.spec.ts:840-909`).
- [x] T6 — Extend to `addMemberAction` and `editMemberAction`.
- [ ] T7 — Delete the now-dead English copy map `REFUSAL_EXPLANATION`
      (`lib/server/invitations.ts:613-621`) and the `refusalMessage` formatter
      (`:623-627`) if nothing else reads them. One union, one copy map.
      NOT DEAD, and not deletable from here — see Progress. `refusalMessage` has
      two live readers left, `createInvitation` and `updateInvitation`, both the
      whole-form save, which this change lists as out of scope. Carried to the
      slice that converts it.

## Verification

`npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`,
and `npx vitest run --sequence.shuffle` on any touched spec.

Strict TDD is enabled: RED must fail for the RIGHT reason before each change,
and each behavioural claim gets a mutation proof.

## Known gaps this change does not close

No e2e spec exercises a member write at all. `e2e/helpers/console.ts:150-180`
chooses a recipient by direct SQL, not through the action, and
`openspec/changes/invitation-administration/tasks.md:93` records E2E as
deferred. Nothing in `e2e/` will catch a regression here.

## Progress

T1 settled WITHOUT an e2e, from the installed docs. `redirect.md` states that "in
a Server Action, `redirect` performs a client-side navigation when JavaScript is
available", and that `redirect` "throws an error so it should be called outside
the `try` block". The second is a server-side caution and we satisfy it already:
`await requireOperator()` is the first statement of every action, outside any
`try`. So an expired session DOES reach the login page. The unproven residue is
cosmetic only — whether the generic copy flashes before the navigation lands. Not
worth an e2e on its own; worth knowing.

T2 needed no new vocabulary. `recipient_not_a_member` was already in
`DraftRefusal` (`lib/domain/invitation-draft.ts:50-55`) and already had Spanish
copy in `REFUSAL_COPY`. The refusal was never missing a type — it was being
stringified on the way out. Codes for the OTHER refusals are still owed by T5-T6.

T3 + T4 done: `chooseRecipientAction` returns `readonly DraftRefusal[]`, the
route wrapper passes it on, and `runWrite` translates it through `REFUSAL_COPY`
into the existing `invitation-write-error` element. Rendering there rather than
merging into the `invitation-refusals` list avoided the `findByRole("alert")`
ambiguity the map warned about: one element, one piece of state, and the
client-side validator keeps its own list ungated.

A type now guards the two-hop delivery. `InvitationRefusingAction` REQUIRES a
returned answer, so a wrapper that awaited and discarded is a compile error —
proved by mutation at `edit/page.tsx:187`. That guard exists because this
codebase already has two returns that reach no pixel, and nothing caught them.

Proofs recorded: RED failed at the exact `throw` it replaced
(`actions.ts:525:11`); four mutations red — the code not travelling, revalidation
leaking into the refusal path, `runWrite` ignoring the answer, and the optimistic
radio not reverting.

Verified: 1917 tests / 98 files, typecheck, eslint, prettier clean, and the two
touched specs green across three shuffled runs plus four shuffled full-suite
runs.

T5 + T6 done, as one work unit with T7's verdict.

The repository stopped stringifying. `refuseInvalidMembership` became
`membershipRefusals(membership, afterMembers)` and RETURNS the codes; the
`action` string parameter is gone, because it existed only to build the thrown
sentence. `addMember` answers `{ refusals, guest }`, `editMember` and
`removeMember` answer `readonly DraftRefusal[]`. The asymmetry is deliberate and
stated at `addMember`: it is the only one of the three that mints a row, and the
id it mints exists nowhere else until it is returned. Collapsing the three into
one shape would have to throw that record away.

Only the REFUSAL channel changed. Every internal throw stayed a throw — the
Supabase error wrappers, `readMembership`'s missing invitation, and the
"does not belong to invitation" guards. Those are developer-facing invariants,
not operator copy.

A refusal returns exactly where the throw stood, before the insert / update /
delete, so a refused write still writes nothing. Mutation 3 is the evidence that
this ordering is load-bearing rather than tidy: deleting `removeMember`'s early
return made the suite fail with "cannot derive a greeting name from zero
members" — the precise crash the Member-management docblock predicts for a
re-derivation placed before the refusal.

`removeMemberAction` now answers BOTH questions, so it answers with an object:
`{ refusals, impact }`, `impact` null exactly when refusals is non-empty. A
refused removal contradicted nothing, and classifying one that never happened
would badge the console with a guest who is still there. Its route wrapper is the
ADAPTER — it keeps the impact server-side and hands the form only the refusals.
The impact still renders nowhere; that remains the separate gap this change
declared out of scope.

`revalidatePath` is now conditional in all six places (three actions, three
wrappers). A throw skipped it for free; a return has to mean it on purpose, and
two mutations confirm the suite notices when it does not.

T7 IS NOT DOABLE FROM HERE, and that is a finding rather than a shortfall.
`rg` says `refusalMessage` still has two readers — `lib/server/invitations.ts:454`
(`createInvitation`) and `:569` (`updateInvitation`). Both are the whole-form
save, which this change's own Scope section lists as out. Deleting the pair now
would only relocate the same English into those two template strings. Left in
place, with its docblock narrowed to name the two callers that still read it so
the next slice finds them. One union and one copy map is still the destination;
it is one slice further away than T7 assumed.

Proofs recorded, seven mutations red: addMember's refusal return removed
(`expected [] to deeply equal [ 'member_without_name' ]`), editMember's removed
(same), removeMember's removed (the zero-member derivation crash), addMember's
created record dropped (`expected undefined to be 'Fernando Guzmán'`),
addMemberAction revalidating on a refusal (`expected "vi.fn()" to not be called
at all, but actually been called 1 times`), removeMemberAction classifying a
refused removal (`expected { …(3) } to be null`), and editMemberAction
discarding its refusal. The component's own claim is a TYPE claim, and its RED
was `tsc`: widening `InvitationMemberActions` broke `edit/page.tsx` at lines 190,
191 and 192 — the three wrappers that awaited and discarded — exactly as
`InvitationRefusingAction` exists to do. `runWrite` needed no change; it already
read the answer.

Verified: 1923 tests / 98 files, typecheck, eslint, prettier clean, the three
touched specs green across three shuffled runs, plus a shuffled full suite.
