# The ceremony streams on Google Meet, not on Zoom

## Objective

The couple: "la transmisión ya no va a ser por Zoom, va a ser por Google Meet y
ya tengo el link."

## Why this is not a find-and-replace

The word "Zoom" appears on six guest-facing surfaces and in the console, and
replacing it would leave the product lying about its own shape.

**Zoom is two credentials; Meet is one link.** The `ceremony` row holds
`stream_meeting_id` and `stream_passcode`, both `not null`, both constrained
non-blank (0009, 0011). A guest READS those and TYPES them into an app, which is
why `StreamDetails` renders them large, in a `dl`, each with a copy button — a
surface built for transcription. A Meet link is a URL: the guest taps it and is
in the call. Keeping two fields would mean an operator inventing a passcode Meet
never issues, and a guest hunting for somewhere to paste it.

**So the data changes shape, not just its wording.** One `stream_url`,
validated as an absolute `https://` address, replacing the two.

**And the guest surface changes with it.** Two values to copy become one control
to press, with the address still legible for anybody who wants to forward it.

## What is safe, and how that was checked

The stored row is `{{ZOOM_MEETING_ID}}` / `{{ZOOM_PASSCODE}}` — the seeded
placeholders, read from the database before touching anything. No real
credential has ever been entered, and nothing has been sent to a guest.

## The link itself does not enter this repository

It is operational data, exactly like the operators' passwords: it belongs in the
`ceremony` row, typed at `/console/wedding`. A URL committed to source is one a
redeploy cannot correct and a public repository would publish.

## Work units

Two, not three, and the reason is honest coupling: a migration that drops the
two columns breaks `getCeremony` on its next read, and the field list that
validates the console form is the same list the server returns. Splitting them
would leave a unit that cannot be green.

- [x] **U1 — the row carries one address, and everything that reads or writes
      it follows.** Migration 0017 with its down script, `lib/server/ceremony.ts`,
      the wedding-facts domain, and the console field — one, labelled for Meet
      and validated as an absolute `https://` URL rather than as free text.
- [x] **U2 — the guest taps it.** `/transmision`, the declined card, the
      landing's door and the calendar entry: one control to press instead of two
      values to transcribe, and the word Google Meet where Zoom was.

## Checks per unit

`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run build`, `PORT=3100 npx playwright test`. Strict TDD: RED observed in the
runner before implementation, quoted here.

## Progress

### U1 and U2 — done

**One column, and the shape is the point.** Migration 0017 adds `stream_url`
with the placeholder as a DEFAULT so the existing row satisfies `not null` in
the same statement, then drops the default — left in place it would let a future
insert omit the address and still look complete — then adds the non-blank check,
then drops the two credentials. Replayed from zero: one `stream%` column, seeded
unfinished.

**The link is validated, and it is the one fact on the form that is not prose.**
Every other value is read by a human, so a typo looks like a typo. This one is
followed by a browser: a mistake looks like a button that does nothing, on the
morning of the wedding. `https` only — the page linking is served over https, a
plain-http destination is blocked as mixed content, and rejecting every other
scheme also rules out `javascript:`, which is what turns an operator's paste
into script on a guest's page. The HOST is deliberately not pinned: requiring
`meet.google.com` would catch a wrong-provider paste and make the next change of
provider a migration rather than an edit.

**`type="url"` was considered and rejected.** Its native validation fires before
the form action and reports in the browser's own English, beside a field whose
Spanish message the domain already writes. Two validators disagreeing about one
box is how an operator learns to distrust both.

**The guest presses it.** `StreamDetails` was a list of credentials set in a
grotesque so a 1 could not become a 7 — a surface built for transcription. It
carries the address and a copy control still, because a guest reading on a
laptop joins from their phone and one who cannot join forwards it, and a button
whose destination is invisible cannot be checked before the day. The control
itself renders ONLY when the value is a real address: the seeded marker rendered
as a link would be a button that fails the one time it is pressed.

**A guard caught a comment, and it was right to.**
`tools/no-source-placeholders.spec.ts` checks comments as well as code, on the
stated reasoning that a comment naming a value `{{LIKE_THIS}}` tells the next
reader it is a compile-time constant. Two comments of mine spelled the new
marker and had to be reworded.

**And the seed parser had to learn about deletion.** It reads every migration
and reports what each column is seeded with; 0009's INSERT still names the two
credentials, so it described a table that has not existed since 0017. It honours
`drop column` now.

**Three trailing commas, all mine, all from bulk edits.** A `select ... ,`
followed by `from`, an `update ... = $6,` followed by `where`, and one that ate
a multi-line query whole. The last is the lesson: a regex over a line is wrong
for SQL written across lines, and the file was restored from git and edited by
hand instead.

Green: 2323 unit and component tests, 222 browser tests, typecheck, lint,
format, build. Migration chain replayed from zero.

**AND THE REVIEW FOUND THREE DUPLICATED ASSERTIONS, ALL MINE.** Moving two
fields onto one meant rewriting dozens of fixtures, and where a spec asserted
the meeting id and then the passcode, a blind rename left the SAME assertion
twice — in `console-wedding.spec.ts`, `RsvpAnswer.spec.tsx` and
`calendar-event.spec.ts`. Harmless and green, which is exactly why nothing else
would have reported them.

The lesson is narrower than "read your diffs": a rename that COLLAPSES two
things into one produces duplicates by construction, and the way to find them is
to look for consecutive identical lines rather than to reread the whole change.

## Next

- The couple has the Meet link. It goes in at `/console/wedding`; it is
  deliberately not in this repository, for the same reason the operators'
  passwords are not.
- `npx supabase db reset --local` was run to prove the chain replays, which
  emptied `senders`. The two operators need re-seeding before the console can be
  signed into again.
