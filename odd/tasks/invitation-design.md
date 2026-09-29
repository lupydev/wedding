# The invitation, in the landing's own language

## Objective

The couple's words: "ahora vamos para la ux/ui de la invitación, podemos seguir
manejando el mismo estilo de la landing pero utilicemos ahora la imagen de la
boda dentro de img."

## The photograph, and the trap it arrived with

`img/boda.HEIC` — the proposal at a lit waterfall, at night. Two problems before
a single line of layout.

**HEIC reaches no browser.** `next/image` declares no loader for it and only
Safari decodes it at all, so it had to become a JPEG.

**AND THE FILE DISAGREED WITH ITSELF ABOUT ITS OWN SHAPE.** `sips` reported the
HEIC as 4032×3024 — landscape. `sharp` reported 3024×4032 — portrait. Both were
telling the truth about different things: the PIXELS are stored landscape and an
EXIF orientation tag says to rotate them.

That matters here more than usual. A browser honours the tag; a build step
reading the header does not. So a file like this renders upright in the page and
computes its layout from the wrong dimensions — and `PhotoStage` is built
entirely out of one photograph's aspect ratio.

My own first attempt made it worse: `sips -r 90` rotated the pixels and LEFT the
tag, so the file then meant "rotate me again". The final image is produced by
baking the orientation into the pixels and dropping the tag, so the file cannot
mean one thing to a browser and another to a build:

    sips -s format png img/boda.HEIC --out /tmp/boda-raw.png
    # then, through sharp: .rotate() .resize({ width: 1800 }) .jpeg({ quality: 82, mozjpeg: true })

`sips` decodes the HEIC because sharp has no HEVC plugin; `sharp` normalises it
because `sips` cannot drop the tag. Result: `img/boda.jpg`, 1800×2400, no
orientation tag, 0.75:1.

`img/boda.HEIC` stays out of the repository: it is the couple's original, it is
1.6 MB, and nothing reads it. This paragraph is its provenance.

## What that shape breaks

`PhotoStage` is not photo-agnostic, and its comment says why in the clearest
possible terms: "The photograph is 737×1600, or 0.46:1. A phone is 0.462:1 — the
same shape to three decimals — so below `lg` it fills the viewport and the words
can sit on top of it." The ratio is hard-coded as `lg:aspect-[737/1600]`, and the
import is hard-coded too.

The wedding photograph is 0.75:1. Portrait, but nothing like a phone: filling a
phone viewport with it discards about 38% of the width, and the two people stand
left and right of centre — so a fill crop clips both of them. The same class of
defect the couple reported on day one: "la imagen se ve súper grande con zoom".

## Work units

- [x] **U1 — the stage takes a photograph instead of containing one.** The
      aspect ratio comes from the image's own dimensions rather than a literal,
      and `overlay` stops being offered to a photograph that cannot survive it.
- [x] **U2 — the invitation stands on that stage.** Dark ground, framed print,
      words beside it on a laptop and beneath it on a phone — the landing's
      language, which `/` and `/transmision` already share.
- [x] **U3 — the parts of the invitation that are TYPED, not read.** The
      announcement and the greeting can sit on a photograph. A radio group, a
      set of checkboxes and a free-text field cannot: `/transmision` moved its
      credentials off a cream card on purpose, and its content is four values
      to copy rather than a form to fill. This unit decides that surface on its
      own merits and says why.

The units below were not planned. Each one is something the couple saw on their
own screen after a unit shipped, which is the only reason it was found.

- [x] **U4 — the two screens I had not looked at.** The gate and the
      invitation-not-found page were still the undesigned white default.
- [x] **U5 — the gate carries the wedding, and the song reaches it.** The
      landing's announcement, one sentence instead of two, and the music
      control on `/i/[slug]`.
- [x] **U6 — the song stopped giving up after one refusal.** A real lifecycle
      defect in the gesture fallback.
- [x] **U7 — the desktop layout stopped collapsing.** The print sticks beside a
      long form instead of floating in the middle of a taller row.
- [x] **U8 — the print stays inside its own column.** Its width was derived
      from the window's HEIGHT, so on a tall window it spilled over the words.
- [x] **U9 — the two public pages, which had no browser test at all.** A
      duplicated announcement and words that stopped centring, both invisible
      to every existing check.
- [x] **U10 — the song, measured instead of argued about.** Two of three
      reported faults do not reproduce; the third is a browser permission. The
      continuity both layouts claim is now asserted.
- [x] **U11 — the song keeps its place across a whole new document.** A typed
      URL destroys the element, so the position crosses instead.
- [x] **U12 — click-to-play, which U11 had killed.** The pause-memory that
      came along uninvited took the gesture fallback with it. Deleted.
- [x] **U13 — walking through a page erased the song's place.** `pagehide`
      wrote a zero over a real position on any page the guest never touched.
      Found by the review's refuter, not by me.
- [x] **U14 — crossing the two public pages by URL.** No recent change broke
      it: the landing's door has been a disabled button since before the shared
      layout existed. Where the browser permits autoplay, the song is proven to
      resume from the remembered second rather than the first bar — which is
      not the same as gapless, and was overclaimed here as "seamless" until the
      review said so. The new document still loads, fetches metadata and seeks,
      and that is audible.
- [x] **U15 — the same song straight through the landing's own link.** No cut
      at all where the guest follows the `<Link>`, which is the journey the
      shared layout was built for and which no test had ever taken.
- [x] **U16 — the unlock, held to the same bar.** Opening the invitation with
      the phone number is measured fluid, by the wall clock rather than by a
      comparison that had gone toothless.

The couple read the unlocked invitation on a laptop and asked for three things
— the announcement kept, the question asked one step at a time, and the
declined screen given the language `/transmision` already uses.

- [x] **U17 — the unlocked invitation keeps the announcement.** The gate opens
      with the greeting, "Nos casamos", the names, the day and the counter; the
      invitation behind it dropped all but the names. "Quisiera que en esta
      última página se conserve."
- [x] **U18 — the RSVP asks one question at a time, in the household's own
      number.** One person is asked "¿Podrás acompañarnos?" and answers "Sí,
      allá estaré"; two or more keep the plural. Nothing but those two choices
      shows until one is picked, and a household of one is never asked to tick
      its own name.
      The couple read the unlocked invitation beside the gate and asked for four
      things: the same announcement on both, the venue kept back until somebody says
      yes, the dietary field gone, and a warmer declined screen.

- [x] **U21 — the announcement says the same thing on both screens.** The gate
      names the day; the invitation behind it hid that line and restated the
      date in a list below. One of them has to go, and it is the list.
- [x] **U22 — the address waits for a yes, and the dietary field goes.** A
      household that cannot come does not need a street, and asking every
      household about food before they have said they are coming is a question
      out of order.
- [x] **U23 — the declined screen, warmer and with a control that fills its
      column.**

- [x] **U26 — one element decides how wide the declined card's controls are.**
- [x] **U24 — the greeting sits on the photograph, on a phone.**
- [x] **U25 — saying yes costs one tap alone and two as a household.**

- [x] **U31 — the day and the hour leave the database entirely.** Two columns
      nothing guest-facing rendered, and a console hint that said they did.
      The wedding date now lives only in `WEDDING_INSTANT`, which answers
      `odd/tasks/wedding-landing.md`'s open question in the negative.

- [x] **U32 — the couple's line goes back onto the card, painted into the
      JPEG.** The preview reads as a wedding at a glance again, without
      `ImageResponse` and without the household's name. The card stays
      byte-identical for every household; what it costs is that those names are
      now inside an asset served `immutable` for a year.

- [x] **U33 — the venue has no address, so the map IS the directions.** A
      committed OpenStreetMap still under the venue block, behind the same
      "only if you said yes" gate, and the whole picture is a link that opens
      Google Maps with the route already laid in. The interactive embed was
      considered and rejected; the reasons are written down so nobody has to
      rediscover them.

- [x] **U34 — one screen per step, because the invitation was two and a half
      of them.** Measured on an iPhone 14: the landing page the couple asked
      this to match is exactly one viewport; a household that had accepted was
      2.50. The photograph moves behind the words, the question becomes four
      screens answered one at a time, the hour and the dress code reach a guest
      for the first time, and two phone-shaped Playwright projects hold the
      result to 1.00.

- [x] **U35 — the gate's own label could not be read, and its field did not
      look like a field.** A defect in U34's output, found on U34's own
      screenshot. Measured against the pixels actually behind it, the label of
      the only control on the first screen every guest sees was 1.2:1 and the
      field's edge 1.3:1. The gate carries its own ground now, painted rather
      than laid out so it costs no height, and `gate-legibility.spec.tsx`
      holds every word on that screen to the same 4.5:1 the two theme tables
      are already held to.

- [x] **U36 — the last screen says the couple are expecting you, and the map
      picture goes.** The couple's four changes to the accepted screen: the top
      line becomes "Te esperamos, <name>" for one guest and "Los esperamos,
      <name>" for two or more, the day and the dress code move up under it, the
      place and one "Cómo llegar" button go to the foot of the screen, and the
      committed map image is deleted — the file, its shape guard and the
      `next/image` frame that reserved its box. The greeting had to move out of
      `InvitationBody` to do it, because only the stepper knows which screen is
      showing. Pushing the venue to the foot put it on the brightest ground on
      the page, so the foot carries a measured card of its own.

- [x] **U37 — every block goes to an end of its screen, and four ways back
      are deleted.** The couple read the whole flow on a phone: the blocks sat
      over the middle of the photograph and covered the two of them. So the
      gate's announcement goes to the top and its form to the foot, the
      question's card keeps only the two answers with the deadline below it,
      the list of who is coming goes to the top with "Volver a la pregunta" at
      the foot, and the affirmative becomes "¡Sí, acepto!". With it go the
      gate's WhatsApp escape hatch, the accepted screen's receipt line and its
      "Volver a responder", and — for a one-person invitation — the screen that
      asks who is coming, which used to flash for the length of the request.
      Taken together an accepted answer can no longer be changed from inside
      the invitation, which the couple were told and chose. The measurement
      that came with the move found an older defect: the stepper's card had
      been sitting on the brightest pixel in the photograph at `bg-black/25`
      since U34, and prose had recorded it as fine.

- [x] **U44 — five reads were answering with the first thousand rows and
      calling it everything.** PostgREST caps an unbounded `.select()` at
      `max_rows` and returns the short answer with no error, no flag and
      nothing in the shape of the result to tell it from a complete one —
      which is why this sat in `## Next` for four units while the suite went
      red around it. The console's guest list, the free-guest picker, the
      shared dashboard, the sender directory the import validates against and
      the device picker all page now, against a stable key, stopping only on
      an empty page rather than a short one. On the polluted local database it
      took the unit suite from ten-to-seventeen drifting failures to 2,535
      green, and the browser suite from 131 passing with 114 never reached to
      243 passing.

- [x] **U42 — the confirmation stopped reading like a spec sheet.** The
      couple asked for the countdown and said the page "se ve muy diferente a
      las demas y se ve un poco fea"; the cause was the label-over-value
      pairs, so the day, the hour and the dress code are said in the
      announcement's own line now, with its hairline and its counter closing
      the block exactly as they close the other three. It cost 31 pixels and
      the screen had 242 of empty middle, so every case is still 1.00.
      Re-sampling lifted the shared line to full cream and found an older,
      wider defect: the counter has no ground and its labels are 2.6:1 on the
      live screen, its figures 2.2:1 after the deadline — so it is not shown
      there, with the number asserted beside the absence.

- [x] **U41 — the calendar file is back, with two alarms, and the entry
      knows who it is for.** The `.ics` the couple deleted returns as their
      own experiment — "probemos qué sucede en un android e iphone" —
      recovered from git rather than rewritten, with an alarm the evening
      before at eight and another three hours out, both asserted as instants
      so they move with the ceremony. The Google button gains the venue's
      location and loses a comment claiming it carried alarms, which it never
      could. Two builders rather than one: the entry a declining household
      saves has no venue in it, because a calendar file is forwarded like a
      link and outlives one. The fourth control was measured before it was
      added to the declined screen, and re-sampling caught the accepted
      foot's ground sitting on a pixel three and a half times brighter than
      its fixture.

- [x] **U40 — the deadline stopped blanking the invitation, and the clock
      became testable.** Closing the RSVP replaced the whole stepper with two
      sentences, so in the final seven days an accepted household lost the
      venue, the map, the hour and the dress code and a declined one lost the
      stream and the calendar. It closes the ability to CHANGE an answer now,
      not the invitation — the couple's own decision — with the same shared
      blocks the open flow uses. The reason nobody had seen it is that the
      state was unreachable from any test: `RSVP_CLOCK` is the seam, a second
      Playwright server runs with the deadline past, and the first test proves
      the two origins differ so the rest cannot be green against the open
      branch. The declined screen also stopped promising a household could
      answer "cuando quieras".

- [x] **U39 — the screen a household reaches by saying no.** The greeting
      becomes "Los vamos a extrañar, {name}", the pair to "Los esperamos" on
      the other ending and now beside it in the domain; the heading that said
      "Los esperamos por Google Meet" is gone; the stream block moves to the
      top with the way back kept at the foot; and "Agregar a Google Calendar"
      arrives by SHARING `/transmision`'s button rather than rebuilding it —
      one calendar entry, built inside the block both surfaces render, because
      two would be two weddings with a date attached. The move put the words
      in the gap between the two scrims, which is where the fourth legibility
      spec found a 4.15:1 paragraph, two 1.77:1 control edges and three
      42-pixel targets.

- [x] **U38 — the two answers became two buttons, and three screens became
      one card.** The couple compared the question with the gate: the card
      had to be the gate's card to the pixel — 374 wide with its controls at
      342, which is two numbers, not one — sitting against the deadline with
      nothing between them, and the answers had to be buttons rather than
      radios. The list of who is coming took the same card, lost its
      selection count and its band of empty card under `Enviar respuesta`.
      Buttons close the keyboard defect U28 recorded and left open, measured
      rather than assumed. The affirmative is confirmed singular for every
      size. And the announcement is back at the top of the attendee screen
      with the list at the foot, which reverses U37 on the couple's own
      instruction: it misses an iPhone 14 by 125 pixels at their four-person
      ceiling, they were given that number and every candidate trim before
      it was built, and they chose to see it rather than cut anything yet.
      The guard asserts the measured overflow instead of pretending it fits.

- [x] **U20 — the error screen, which nobody had ever looked at.** Black text
      on white, crammed top-left, a bare button. On the stage now, with the
      photograph.
- [x] **U19 — the declined screen in `/transmision`'s language.** "Los
      esperamos por Zoom", rather than the longer explanation it carries now.

## Checks per unit

`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run build`, `PORT=3100 npx playwright test`. Strict TDD: RED observed in
the runner before implementation, quoted here.

## Progress

### U1 — done

`PhotoStage` takes a `StagePhoto` — the image and what it shows — and reads the
frame's ratio off the image's own dimensions. The literal `aspect-[737/1600]`
and the hard-coded import are gone.

**The ratio travels as a CSS custom property**, for two reasons that both
matter: Tailwind cannot compile a class name out of a runtime value, and the
frame is shaped only at `lg` — below that the photograph is a band or the whole
screen, so a plain inline `aspect-ratio` would apply at every width.

**The `alt` moved with the image.** It was hard-coded in the component,
describing the engagement photograph. Left there, a page showing the wedding
photograph would have described the wrong picture — a confident wrong answer,
which is worse for the reader who needs it than no answer.

`components/landing/photos.ts` holds both photographs, one definition each, for
the reason `PhotoStage` gives for its own existence: two would drift into two
different weddings. The dimensions are NOT written there — they come from the
static import, because a number typed beside a picture is a second opinion
about it, and this photograph already taught that lesson.

**One thing the unit tests could not do, recorded so nobody repeats it.** Under
Vitest a static image import resolves to a bare string, `"/img/boda.jpg"` — the
loader that produces `{ src, width, height, blurDataURL }` belongs to the Next
build. So the spec supplies its own image objects and tests the component's own
contract; that the real files arrive with the right dimensions is the build's
job and the browser suite's.

Green: 2290 unit and component tests, 200 browser tests, typecheck, lint,
format, build.

### U2 — done

`/i/[slug]` stands on `PhotoStage` with the wedding photograph, in `band` — the
strip across the top, the words beneath it on a phone, beside the framed print
on a laptop. `InvitationBody` speaks the landing's language now: cream on the
photograph's own darkness, the script face for the couple's line, the display
face for the salutation, the same hairline `SaveTheDate` uses.

Its `.invitation__*` classes are untouched. The browser suite and the console
preview point at `invitation__rsvp` and `section.invitation__household`, so a
rename here is a silent failure over there.

**A LATENT BUG CAME OUT THE MOMENT THIS WAS LOOKED AT.**

`band` had never been used. Both existing pages pass `overlay`, and the stage's
contract said the CHILD owns its grid placement — so every caller wrote
`col-start-1 row-start-1`, which in `band` is the photograph's own cell. The
first screenshot showed it: a household's names laid across the waterfall, the
form on top of the couple. It rendered. Nothing failed.

The stage places the words now, in `div.photo-stage__column`, and decides the
cell from the mode: the print's cell in `overlay`, the second row in `band`,
the second column at `lg` either way. A caller cannot get it wrong because a
caller no longer says anything about it, and the three children dropped the
placement classes they had been carrying.

**Found by looking, not by testing.** Every check was green with the words on
top of the photograph — there is no assertion that says "these two do not
overlap". Screenshots at 390px and 1440px are what caught it, and are worth
taking for any change to this stage.

Green: 2293 unit and component tests, 203 browser tests, typecheck, lint,
format, build.

### U3 — done

**THE SURFACE, DECIDED ON ITS OWN MERITS.** `/transmision` took its credentials
OFF a cream card and was right to — an opaque island in the middle of the
photograph is what broke the two pages looking like one — but its content is
four values to copy. This is a radio group, a checkbox per member and a
free-text field. A textarea with no border on a photograph is an invisible
control, and a bare radio on a dark ground is a five-pixel target on a phone.

So the form gets a surface that is a DEEPENING of the same ground rather than a
sheet of paper laid on it: `bg-black/25` with a hairline ring and a blur, the
photograph still showing through.

The control language is `StreamLink`'s pill, already the guest-facing one on `/`
and `/transmision`. A third would have been a third wedding.

**THE NATIVE INPUTS STAY VISIBLE**, sized and coloured rather than hidden
behind a drawn substitute. Hiding one means re-implementing focus, and the 27
tests in this component's spec find every control by ROLE and accessible name —
which is exactly what a hidden input quietly costs. `has-[:checked]:` lifts the
whole row, so the chosen answer is legible at arm's length instead of by
squinting at a dot.

**The attendee list is dimmed whole while it does not apply.** The fieldset was
already `disabled`, so the browser refused every tap — but it LOOKED live, which
reads as a broken page rather than as a question that is not theirs yet.

**A REAL REGRESSION, CAUGHT BY A TEST, AND WORTH WRITING DOWN.** Wrapping the
child marker in a `<span>` moved the leading space inside it — and
accessible-name computation TRIMS each element's text before joining, so a
screen reader announced "Sara Aguirre(niño o niña)". The spec asserting that
the form and the couple's own list read alike failed on it. The space is a
sibling text node now.

Verified by screenshot at 390px and 1440px, because that is what caught the
overlap in U2 and no assertion says "these controls are large enough to press".

Green: 2293 unit and component tests, 203 browser tests, typecheck, lint,
format, build.

### U4 — done (the two screens I had not looked at)

The couple sent a screenshot of the GATE: black text on white, crammed at the
top left, a bare field and a bare button — while the invitation one tap behind
it stood on a photograph. Both were shipped in the same hour, and I had only
looked at one of them.

The gate stands on the same stage now, in `band` for the photograph's sake
rather than the word count's: its few lines would have fitted over the picture,
but at 0.75:1 a phone-filling crop discards about 38% of the width and clips
both people.

**The field has a visible edge**, asserted rather than eyeballed. An unbordered
input on a photograph is an invisible control, and on THIS screen a guest who
cannot tell there is anywhere to type has nothing else to try. The label stays
visible rather than becoming a placeholder, which disappears the moment
somebody types — on the one field this page has, that is exactly when they want
to check they are answering the right question.

**And the dead end, which nobody had asked about.** `/i/<a slug nobody holds>`
was the same undesigned white page. It gets the dark ground but NOT the
photograph: framing the couple above "no encontramos esta invitación" would put
their wedding on a screen reached by typing a wrong address.

**A bug found by screenshotting it.** `max-w-md` sat on the `main`, which capped
the BACKGROUND as well as the words and left cream bars down both sides of a
dark page. The measure belongs to the text, so the text carries it now.

Green: 2293 unit and component tests, 205 browser tests, typecheck, lint,
format, build.

### U5 — done (the gate carries the wedding, and the song reaches it)

Three things the couple asked for after seeing the gate on a laptop.

**The announcement, "como en la landing".** The gate said "we have your
invitation, now prove who you are", and the wedding it was about lived on the
other side of the field. It carries `SaveTheDate` now — the script line, the
names, the date and the counter, which is what makes the date feel like
something approaching rather than small print.

That move exposed a split: "Nos casamos" lived in `app/(public)/page.tsx`,
ABOVE the component, so the announcement was two halves in two files. Fine
while one page made it; a drift waiting to happen once two did. The line is in
`SaveTheDate` now and the landing imports the whole block.

**One sentence instead of two.** "Tenemos lista su invitación de matrimonio."
followed by "Para abrirla, escribe el número de celular que compartiste con
nosotros." — two sentences saying what one says, above the only thing there is
to do. It reads "Escribe tu número para abrir la invitación." The greeting
still comes first, and there is a test that keeps the announcement from
slipping above it: the ordering is a product promise, because the WhatsApp
message said "your invitation".

**The song, and a trap that cost a detour.** The obvious move was to bring
`/i/[slug]` into the `(public)` group, which already mounts the control — a
route group changes no URL. It changes ONE: inside a group Next renames the
`opengraph-image` route to a hashed SEGMENT, `/i/[slug]/opengraph-image-1gh5xv`,
and the clean path 404s. `lib/server/og-warm.ts` fetches that clean path on
purpose — Next appends its build hash as a QUERY to the emitted `og:image`, and
warming the unhashed path is what keeps a warm cache usable across builds.

Four browser tests reported it within a minute of the move, which is the only
reason it did not ship. The route stayed put and got its own layout; the cost
is two mounts, and it is nothing here, because a guest arrives at the
invitation from a message and leaves by closing the tab. There is no
client-side navigation for an `<audio>` element to survive.

**One measurement.** `max-w-md` on the gate broke "Luis & Michell" after the
ampersand at `lg`, where the names are set at `text-6xl`. The cap is right on a
phone and wrong in a grid column that has the room; it lifts at the breakpoint.

Green: 2298 unit and component tests, 205 browser tests, typecheck, lint,
format, build.

### U6 — done (the song stopped giving up after one refusal)

The couple, on the gate: "al dar click o interactuar con la página no se activa
el audio."

**A real defect, and it was one line of lifecycle.** The gesture listeners were
registered with `once: true` AND removed at the TOP of the handler — before the
attempt's answer was known. So a first gesture whose `play()` was refused took
the fallback away with it, and the visitor could tap all day for nothing.

A refusal on that first gesture is not exotic. `preload="none"` means the file
is not loaded when the tap arrives, and a stricter autoplay shield than
Chrome's — Brave blocks by default, and Brave is what the couple use — can
decline a programmatic `play()` even inside a gesture handler.

The listeners now come off only once the song is actually playing. Each refused
attempt costs nothing: `play()` on a `preload="none"` element opens no
connection it does not need.

**Proven twice.** A component test with a stub that refuses the autoplay
attempt AND the first gesture, asserting the second gesture still starts it —
which failed before the change. And a browser probe against the real page:
silent on arrival, playing after a click on the body, pausing and resuming from
the button.

**What this may not fix, stated plainly.** If Brave refuses the `play()` behind
the button itself, no code here can help: that is a per-site autoplay
permission. Pressing the music control is what tells the two apart, because a
click landing directly on the control is the strongest gesture a browser
recognises.

Green: 2299 unit and component tests, 205 browser tests, typecheck, lint,
format, build.

### U7 — done (the desktop layout stopped collapsing)

The couple: "hay que organizar el ui para que no colapsen y se vea feo en
desktop en ambas pantallas de la invitación."

**What was ugly was measurable.** On a 1440×760 window the unlocked invitation
is about 1190px long. The grid centred an 86dvh print inside that taller row,
so the picture floated in the middle with roughly 270px of black above and
below it — and on arrival a guest saw the top of the words and the top third of
the photograph. The two people in it were below the fold, on the one page that
is about them.

**The print sticks now**, so it stays with the reader all the way down the
form. Proven by a browser test that scrolls to the submit button and asserts
more than 70% of the frame is still on screen.

**It could not simply be `position: sticky`.** The stage's `main` carried
`overflow-hidden` to clip the backdrop, which is scaled past the edges on
purpose — and an `overflow` ancestor makes a sticky element stick to a
container that does not scroll, which is to say to nothing. The clip moved onto
the backdrop, the only thing that ever needed it. Worth knowing, because the
class would have looked applied and done nothing.

`lg:items-center` went with it: the cells stretch, so the row's height comes
from the words and the sticky print sits inside a cell as tall as they are.
Both short pages still centre, because their own columns already ask to.

**One number used twice.** The print sticks at `top-[7dvh]` and the words now
carry `lg:py-[7dvh]`, so the couple's line is level with the top of the picture
instead of against the browser chrome.

The gate needed nothing: its content fits one screen at 760px tall, and with
the cells stretched its column still centres itself.

Green: 2299 unit and component tests, 206 browser tests, typecheck, lint,
format, build.

### U8 — done (the frame's width was growing with the window's HEIGHT)

The couple sent one more desktop screenshot and one question: "puedes verlo tú
también a través de Playwright, no?" Yes — and asking it is what found this,
because the answer was to go and look at the size THEY use rather than the size
I had been checking.

**The arithmetic, which is the whole defect.** The print was `lg:h-[86dvh]` with
`aspect-ratio` deriving its WIDTH from that height. At 0.75:1 that is 654px wide
on a 760px-tall window and 697px on a 1080px one — against a grid column that is
half of `max-w-6xl`, which is 576px. So a frame sized from the viewport height
has a width no column can constrain, and above roughly 900px of viewport the
picture spilled into the second column: the number field and the button were
drawn ON TOP of the photograph.

At 1440×760 — the size every screenshot in U2, U3, U4 and U7 was taken at — it
fits, and nothing was wrong. That is the part worth keeping: a layout bug can be
a function of a dimension nobody is varying.

**So the width is the given now and the height follows.**
`min(100%, 86dvh × ratio)` takes whichever limit binds — the column on a tall
window, the viewport height on a short one — and `aspect-ratio` gives the
height, so the photograph is never squashed either way.

**The custom property changed shape with it.** `--photo-stage-aspect:
"1800 / 2400"` became `--photo-stage-ratio: 0.75`, a single decimal, because the
same number is now multiplied inside a `calc()` and a fraction cannot be. Three
places named the old property and I updated two; the browser suite reported the
third within a minute. Worth recording precisely because a renamed CSS custom
property fails silently — an unknown `var()` resolves to nothing and the element
simply has no width.

**RED first, at three heights.** `e2e/phone-gate.spec.ts` loops 760, 1080 and
1440 at width 1920 and asserts the print ends before the words begin, and that
it is still wider than 300px rather than a sliver that would pass the first
assertion trivially. It failed as `Expected: <= 961, Received: 1112.59` at 1080
and `1344.78` at 1440.

The unlocked invitation needed no second assertion: it is the same `PhotoStage`
in the same mode, so the geometry under test is identical. It was confirmed by
screenshot at 1920, along with the gate.

Green: 2299 unit and component tests, 209 browser tests, typecheck, lint,
format, build.

### U9 — done (the two public pages, which had no browser test at all)

The couple, with two screenshots: "ojo que con lo último que hiciste la landing
y /transmisión ahora quedaron mal en la ui."

**Two defects, and neither came from the change they followed.** Worth stating
plainly rather than accepting the attribution: the width cap in U8 changed the
engagement photograph's frame by a couple of pixels. These were U5's and U7's,
sitting there unseen because nothing looks at these two pages.

**`/transmision` said "Nos casamos" twice.** `StreamInvitation` had carried its
own script line since before the shared block existed. In U5 that line moved
INTO `SaveTheDate` so the gate could make the same announcement — the landing
dropped its copy, and this one was missed. The page then rendered the line, then
the block that also renders it.

Nothing failed. Two components each rendered one correct line, and each
component's spec asserted its own line was present. `getByText` would not have
caught it either: it throws on multiple matches, but only for the string it is
handed, and no test asked for this one.

**The words were no longer level with the photograph.** U7 removed
`lg:items-center` from the grid so the print could stick, and recorded that
"both short pages still centre, because their own columns already ask to."
That was wrong, and this is the correction: `justify-center` centres content
inside a box that is already exactly as tall as that content. With the cells
stretched, a column holding words shorter than the print pins them to the top
with several hundred pixels of empty ground underneath. Measured at 1920×1080:
the stream page's words sat 177px above where they belonged.

**Fixed in the stage, not in the pages.** Each page could have carried
`lg:h-full`, and all three callers would then need to remember it — the exact
trap U2 already paid for, where every caller wrote its own grid placement and
one of them was wrong. `div.photo-stage__column` centres its child at `lg` now.
It is a no-op where the words are the taller of the two, which is the unlocked
invitation, so that screen is unchanged.

**A TEST THAT PASSED FOR THE WRONG REASON, CAUGHT BEFORE IT WAS TRUSTED.** The
first version of the centring assertion measured `div.photo-stage__column` —
the grid item. The cells stretch, so its box runs the full height of the row
and its centre matches the print's centre WHATEVER happens inside it. It went
green against the broken page. The assertion measures the column's child now.

**And the real gap underneath all of it: `/` and `/transmision` had no browser
test.** Component tests covered every string and unit tests covered the data;
nothing covered either page assembled. Both of these defects are only visible
there. `e2e/public-pages.spec.ts` now counts the announcement and measures the
words against the print, on both pages, at the window the couple actually use.

Green: 2301 unit and component tests, 213 browser tests, typecheck, lint,
format, build. Verified by screenshot on all four guest screens at 1920×1080.

### U10 — done (the song: three reports, one real finding, and none of it code)

The couple: "veo que en la landing y /transmisión ya no comparten el mismo audio
como antes y también cuando recién se abre la invitación si se hace click o algo
no inicia la canción y supondría que tampoco esta página comparte el audio con
la de aceptar la invitación."

Three separate claims. Measured in a browser rather than reasoned about, because
element identity across a navigation is not something a component test can see.
What the probe reported, at 1440×900:

| where                              | paused    | currentTime | same element |
| ---------------------------------- | --------- | ----------- | ------------ |
| landing, on arrival                | true      | 0           | —            |
| landing, after a click on the page | **false** | 0.87        | tagged       |
| /transmision, after a click        | false     | 1.04        | tagged       |
| landing, after the `<Link>` back   | **false** | **2.41**    | **yes**      |
| gate, on arrival                   | true      | 0           | —            |
| gate, after a click on the page    | **false** | 1.26        | tagged       |
| invitation, after the unlock       | **false** | **2.60**    | **yes**      |

**The two pages DO share the song.** The same element survived the link and the
song was 2.41s in, continuing from 1.04s. And **the gate DOES share it with the
invitation**: the unlock is a server action inside one route, so the layout and
its element persist — 1.26s to 2.60s, same element.

**The gate's click-to-start works too**, in Chromium. Which leaves the couple's
browser: Brave blocks autoplay per site by default, and they have already
confirmed the BUTTON starts the song there. So Brave is allowing `play()` from a
click that lands on the control and refusing it from a click elsewhere on the
page. U6 recorded that exact residual, and nothing in this repository changes a
per-site browser permission.

**THE ONE REAL FINDING, AND IT IS NOT A DEFECT.** The probe reported
`LANDING zoom link count: 0`. There is no `<Link>` from `/` to `/transmision`
today: `StreamLink` opens in the final week, by the couple's own design. So the
only way to reach the stream page right now is to type the URL — a full document
load, a new element, and the song back at zero. That is what they were seeing,
and it stops being true for guests the week of the wedding.

**What the session actually gained: `e2e/guest-audio.spec.ts`.** Both layouts
justify mounting the control by an architectural claim — "Layouts do not
re-render on navigation", so the element persists — and nothing checked it.
Asserting the element is PRESENT proves nothing, because a remounted one is also
present with the song at zero. These tests tag the element and check the tag
survived, then check `currentTime` did not fall back.

**And one assertion that proved nothing, fixed before it was trusted.** The
first version took its baseline the moment `paused` flipped, when `currentTime`
is still 0 — so "it did not restart" compared zero to zero. The baseline now
waits for half a second of real playback, which a reset cannot match.

Green: 2302 unit and component tests, 217 browser tests, typecheck, lint,
format, build.

### U11 — done (the song keeps its place across a whole new document)

The couple, with the exact steps: "abro la landing y pongo a sonar la canción,
luego por url agrego /transmision y se pausa la canción y arranca desde el
inicio. Antes de hacer los últimos cambios esto no sucedía."

**The second sentence is checkable, so it was checked.** The last three commits
— `d1416c2`, `16141d4`, `7730d25` — touch `PhotoStage`, `StreamInvitation`,
four spec files, `.gitignore` and this document. The last change to
`MusicToggle.tsx` or to either layout was `49a4684`, which is older than all
three. The audio behaved identically before them.

**And the first sentence is real, unavoidable, and worth fixing anyway.** Typing
a URL is not a navigation the router handles: it tears the document down and
builds another, and every element dies with it. Both layouts justify mounting
the control by "Layouts do not re-render on navigation" — which is about
`<Link>` and cannot reach this case. No browser API keeps a sound playing across
a document load, so there is nothing here to repair.

What can cross is the POSITION. It does now.

**`sessionStorage`, and the choice is the product.** The record is scoped to one
tab and dies when it closes, so a guest returning tomorrow hears the song from
the beginning. In `localStorage` it would open four minutes in, forever, and
nothing on the page would explain why.

**Restored on `loadedmetadata`, which is the only moment that works.**
`preload="none"` leaves the file untouched until something asks for it, and
`currentTime` cannot be set on an element that does not yet know its duration.
That event also fires BEFORE playback begins, so the seek lands without a bar of
the opening leaking out first. Guarded on `duration`, because a stale position
past the end of a replaced file throws.

**Written on `pagehide` and, as a backstop, once a second of playback.**
`pagehide` is the event that fires when the URL bar tears the document down and
it records the exact instant — but a note kept only there is lost to a crash, a
killed tab, or a browser that backgrounds the page and never fires it.

**AND THE PAUSE BUTTON BECAME AN INSTRUCTION THAT SURVIVES THE PAGE.** The
record is only written once the song has played, so `playing: false` means the
guest stopped it deliberately. The load-time attempt is now skipped in that
case. Before this the control asked again on every document — a site that
argues with the person reading it.

**Storage that throws rather than returning null.** In a private window, or with
site data blocked, reading `window.sessionStorage` raises. Unguarded that is an
exception inside an effect on every guest-facing page, for the least important
thing on any of them. Both accessors are guarded and there is a test that
replaces the getter with one that throws.

**One test failed in its own teardown and the product was innocent.** The new
`afterEach` cleared `sessionStorage` while that throwing getter was still
installed. `vi.restoreAllMocks()` runs first now. Worth recording because the
failure pointed at the component.

Green: 2306 unit and component tests, 218 browser tests, typecheck, lint,
format, build.

**What is still out of reach, stated plainly.** The couple's own browser blocks
autoplay per site, and they have confirmed the BUTTON works there. So Brave is
allowing `play()` from a click that lands on the control and refusing it from a
click elsewhere on the page. Nothing in this repository changes a per-site
browser permission. With this unit, pressing that button now resumes from where
the song was rather than from the top.

### U12 — done (I broke click-to-play in U11, and took the cleverness back out)

The couple, one commit later: "al dar click o interactuar con la landing no
inicia la música y lo mismo con /transmision."

**Mine, from U11, and not a subtle break.** Remembering the song's place brought
a second idea along that nobody asked for: a guest who pressed pause should not
be asked again on the next page. So `askOnce` returned early when the record
said paused.

`startWaiting()` — the whole gesture fallback — is reached only INSIDE that
attempt's refusal path. Returning early never registered the listeners at all.
A click on the page then did nothing whatsoever, for the life of the tab, with
no way back but finding the button.

**And the flag could be set without anybody pressing anything.** It was written
from the `pause` EVENT, which a browser fires for its own reasons — tearing a
document down among them. A guest who only ever navigated could land in the
dead state.

**The fix is a deletion.** The flag is gone and the record carries the position
alone. Not "make the flag correct" — track only a real press of the button,
keep the fallback registered whatever it says — because the feature was never
requested and the position was. Every page now behaves exactly as it did before
U11, only starting at the right second.

`readResume` ignores an unknown extra field, so a tab still holding the old
`{at, playing: false}` record recovers on its next page rather than staying
dead until it is closed. There is a test for exactly that record.

**A TEST ASSERTED THE DEFECT AND PASSED.** `MusicToggle.spec.tsx` had "stays
quiet when the guest had stopped it", written in U11 alongside the code. It was
green the whole time the couple could not start the music. A test written from
the same idea as the code cannot disagree with it — the U11 checks were four
green tests describing a broken product. It is inverted now: "still starts on a
touch when an older record mentions a pause."

The browser test is the couple's own path — play, press pause, go to the next
page, click — and it failed by timing out for ten seconds with `paused` stuck
at `true`.

Green: 2306 unit and component tests, 219 browser tests, typecheck, lint,
format, build.

### U13 — done (a page the guest walks through was erasing the song's place)

Found by the native review's refuter, rated CRITICAL, and it was right. Every
check I had was green.

**The defect.** The position is written on `pagehide`, which fires for EVERY
document that mounts the control — including one a guest merely passes through.
On such a page the song never started, `preload="none"` means the file was never
fetched, so `currentTime` is 0. Unguarded, walking through stored a zero OVER a
real position; and because `restore` treats `at <= 0` as nothing to restore, the
place was then GONE rather than merely stale.

The read side had that guard. The write side had no counterpart.

**And it is an ordinary path, not a corner.** A browser that refuses the
load-time attempt leaves every untouched page sitting at 0 — and the couple's
browser refuses it. Their own route, landing → `/transmision` → somewhere else,
destroys the record every time.

**Why my tests could not see it.** The typed-URL test starts the song in the
SECOND document, every time. A browser that autoplays hides the whole defect,
and the test's own steps guarantee autoplay. The new test is the difference:
pass through the middle page touching nothing.

Measured before the fix: 2.31s on the landing, then 1.20s after the round trip —
which is not a resume at all, it is fresh playback from zero.

**The fix is four lines.** `remember` returns unless `currentTime > 0`.

**THE THIRD TEST-SHAPED FAILURE IN THIS FEATURE, AND THE SECOND FOUND BY
SOMEBODY ELSE.** U9's centring assertion measured the stretched grid cell rather
than its child. U12's spec asserted the defect as though it were the
requirement. This one is subtler and worth naming precisely: the test covered
the right journey and still could not fail, because a step inside it — playing
the song on the second page — removed the condition the defect needs. A test
whose own setup precludes the failure is not a test of that behaviour.

Green: 2306 unit and component tests, 220 browser tests, typecheck, lint,
format, build.

### U14 — done (crossing between the two public pages, and what the history says)

The couple: "no se trata de clickear en transmision, la idea es que si estoy en
/transmision o en / al poner la canción pueda moverme libremente entre las dos
sin que la canción se pare, sino que sea fluido. Esto estaba ocurriendo hasta
hace unos momentos donde pedí que el audio también se incorporara en la
invitación… podés ver el historial y deducir cuál fue el cambio que tiró esto."

**The history says no change tired it, and it names the reason.**

`8fc7c14` — the commit that put the song on the invitation — changed exactly one
line of `app/(public)/layout.tsx`: the import, so `SONG_SRC` could be shared. The
mount is identical. The rest of that diff is the comment explaining why
`/i/[slug]` could not join the group.

The real answer is in `components/landing/StreamLink.tsx`. Outside the final week
the landing's door to the stream is a **disabled `<button>`**, not a link:

    if (open) { return <Link href={STREAM_PATH}>…</Link>; }
    …
    <button type="button" {...whyDisabled(…)} className={`${PILL} cursor-not-allowed`}>

That was decided in `04f75c7` at 20:47 on 20 September — **thirty-eight minutes
before** `46dbbac` created the shared layout at 21:25. So the guarantee that
layout rests on, "Layouts do not re-render on navigation", has NEVER applied in
the `/` → `/transmision` direction: there has never been a link to take.
`46dbbac`'s own proof note records having to fix the clock inside the final week
to exercise it. The other direction, `/transmision` → `/`, has a live link and
works; it is asserted in `guest-audio.spec.ts`.

**So the crossing is a typed URL, which is a new document, which no browser
keeps a sound alive across.** What makes it fluid is the position from U11 plus
a browser willing to start the song without being asked again — which is what a
browser grants a site the visitor has already played media on.

**Measured, and it is seamless.** Three documents, one continuous song:

| step                  | state   | at    |
| --------------------- | ------- | ----- |
| landing, arriving     | playing | 2.26s |
| `/transmision`, typed | playing | 4.33s |
| back to `/`, typed    | playing | 6.23s |

A new element each time, and the song never returns to the first bar.

**THE FIRST TWO VERSIONS OF THAT TEST PROVED NOTHING.** The first polled for
`currentTime` to pass the previous page's reading inside fifteen seconds, and my
comment claimed a restart "would have to play all the way there again from zero,
and the poll gives up first" — arithmetically false, since those readings are
two and four seconds. The review found it CRITICAL. The second sampled the
instant `paused` turned false, which is before the seek lands on
`loadedmetadata`, and failed against a working product.

**What a restart cannot do at ANY instant** is be further along than the
document has been open, so `at - open` stays at or below zero forever. Polling
that is safe: waiting longer cannot rescue a restart. Proven by sabotage — with
the seek replaced by a no-op the margin never rose above **-0.285**.

**`e2e/guest-audio-crossing.spec.ts`, and it needs its own file.** The measurement
is impossible in Playwright's default Chromium, which refuses autoplay — that
refusal hides the entire question and every assertion would be about a silent
page. `launchOptions` cannot be scoped to a `describe`, and the rest of the audio
suite needs the opposite setting: "says nothing until the guest touches the page"
is only meaningful in a browser that refuses.

**What is left is a browser permission, not code.** The couple's Brave blocks
autoplay per site. Allowing it for the site is what turns the measured behaviour
above into what they see; until then the first touch on each page starts the
song, from the right second.

Green: 2307 unit and component tests, 221 browser tests, typecheck, lint,
format, build.

### U15 — done (the journey the layout was built for, finally tested)

The couple: "probé dando click en la landing y empieza a sonar la canción, pero
cuando en la url ingreso a /transmision hay un pequeño corte y la canción
continúa sin problema. ¿Podés habilitar el botón de la landing para ir a
/transmision para ver si efectivamente el audio continúa sin ningún problema?"

**Their cut is real and it is the typed URL's, not a defect.** A new document
fetches the file and seeks to the remembered position, and the seek is audible.
U14 already recorded that "seamless" was an overclaim.

**Through the `<Link>` there is no cut at all, and now it is measured:**

|                           | position | same element |
| ------------------------- | -------- | ------------ |
| landing, before the click | 2.72s    | —            |
| `/transmision`, after it  | 2.94s    | **yes**      |

0.22s of song across 0.22s of wall clock: the playhead advanced by exactly the
time the navigation took. Nothing was torn down, so there was nothing to
resume.

**THIS IS THE JOURNEY `app/(public)/layout.tsx` EXISTS FOR, AND NOTHING HAD
EVER EXERCISED IT.** Its comment rests the whole design on "Layouts do not
re-render on navigation", `46dbbac` verified it by hand once, and no test was
left behind — because outside the final week `StreamLink` renders a disabled
`<button>` and there is nothing to click.

`page.clock.setFixedTime` moves `Date.now()` and `new Date()` while leaving
timers running, which is exactly what the component reads. The product is
untouched: the door still waits for the final week.

**The element's identity is the assertion**, because a remounted `<audio>` has
no tag and a restart cannot fake one.

**PROVEN BY SABOTAGE, NOT BY PASSING.** The control was moved out of the layout
and into both pages — the precise regression the layout prevents — and the test
went red on `survived: false`. Both files were restored and `git status`
confirmed clean. After six tests in this feature that could not fail, a green
run is not evidence on its own.

Green: 2307 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U16 — done (the unlock, held to the same bar as the link)

The couple: "ahora vamos a hacer algo similar para la página de la invitación, y
cuando lo abren ingresando el número de celular el audio tiene que ser fluido."

**It already was, and now that is proven rather than assumed.** Measured across
the unlock: the playhead advanced 0.34s while 0.34s of wall clock passed, so the
silence was **-0.00s**. `unlockAction` ends in `redirect()` inside a server
action, which the router handles — the layout is never torn down and there is
nothing to resume.

**THE OLD TEST COULD NOT HAVE CAUGHT A REGRESSION, AND ITS COMMENT SAID WHY
WITHOUT NOTICING.** It asserted `currentTime >= before` and explained "a restart
lands back at 0". That stopped being true at U11: the position is remembered
now, so a REMOUNTED element also comes back near where it was. The comparison
had quietly become decoration. Only the element's tag discriminates.

**And "did not restart" is not "fluid" anyway.** Playback is realtime, so the
playhead cannot outrun the wall clock; if it advanced by AS MUCH as the wall
clock, nothing was missed. Any pause, re-fetch or seek shows up as wall clock
the song did not account for. That invariant is the test now.

**PROVEN BY SABOTAGE, TWICE, BECAUSE ONE ASSERTION WAS HIDING THE OTHER.** The
control was moved out of `app/i/[slug]/layout.tsx` into both branches of the
page under different wrapper element types, so React tears the subtree down —
the regression the layout exists to prevent. The identity check went red. Then
it was run again with the identity check stood down, to find out whether the
silence invariant earns its place: it does. **0.81s of real silence** against a
0.25s threshold, which is what a fresh `preload="none"` element costs before it
can sound at all. Every file restored and `git status` confirmed clean.

**The landing's link test was raised to the same bar**, having carried the same
now-toothless `currentTime` comparison.

Green: 2307 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U17 — done (the invitation keeps the announcement the gate makes)

The couple, having read both a tap apart: "quisiera que en esta última página se
conserve" — the greeting, "Nos casamos", the names and the counter.

The gate was the screen that got the wedding; the page behind it opened with a
household's name and a line of prose. A guest who answers the question is the
one person guaranteed to read it, so it was the last place the announcement
should have been the thinner of the two.

**`SaveTheDate` TOOK ITS FIRST PROPS, AND THE REASON IS A FACT IT CANNOT READ.**
Its own comment said props would be "a wiring step with nothing to wire" — true
when it had one caller whose facts were module constants. It has four now, and
this one already held the couple's names in a form an operator can CORRECT, from
the `ceremony` row. Rendering the constant beside that would have put two couple
names on one page, and two DIFFERENT ones the first time somebody fixed a
spelling. So `coupleNames` and `showDate` are optional props and the constants
remain the default: the three pages with nothing to read still pass nothing.

**The day is stated once.** `showDate={false}` here, because the details list
immediately below carries the operator's own value. The block's own line is
built from `WEDDING_INSTANT` — a duplication today, and a contradiction the
first time those two disagree. The counter stays: it runs to the instant and
nothing else on the page says how long is left.

**The script couple line is gone and that is not a deletion.** `SaveTheDate`
renders the same names, larger, now from this page's own row.

**A LIVE CLOCK BROKE TWO DRIFT GUARDS, AND NEITHER DESERVED TO BE DELETED.**
The two `toMatchSnapshot` guards began failing on the countdown's SECONDS
figure — a guard that cries wolf gets updated with `-u` without being read,
which is exactly the failure it exists to prevent. They freeze the clock with
`vi.useFakeTimers` now, and three consecutive runs confirm they are stable.

The browser's equivalent is `console-preview.spec.ts`, which compares the
operator's preview against the guest's page byte for byte: the two are loaded
one after the other, so the seconds differed by the time the second rendered.
The figures are EMPTIED rather than the block removed, so a preview that stopped
rendering the counter, or rendered a different number of units, still fails.

**And the same measure bug the gate already recorded.** `max-w-md` is 448px and
"Luis & Michell" at `text-6xl` does not fit, so it broke after the ampersand —
in the middle of the couple's own names. `lg:max-w-none`, exactly as
`InvitationGate` does it. Found by screenshot, not by assertion.

**One diagnosis worth keeping: an aborted browser run leaves seeds behind, and
the next run reads them.** Two console specs failed on households they did not
expect; they failed identically with my changes stashed, and passed on a cleared
database. Clear before trusting a run that follows an abort.

Green: 2308 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U18 — done (one question at a time, in the reader's own number)

The couple: two buttons worded for one person or for several; the list of who
is coming only "una vez den click en lo afirmativo"; and a household of one
never asked to tick its own name.

**EVERY LINE WAS PLURAL, BECAUSE AN INVITATION WAS ASSUMED TO BE A HOUSEHOLD.**
A guest invited alone was made to answer "Sí, allá estaremos" on the one page in
the product addressed to them by name. `rsvpChoiceCopy(memberCount)` now returns
the question and both answers, in the domain beside the other two sentences a
count already decides — `seatsSelectionSentence` and `currentRsvpSentence` —
where all three can be read against each other without a DOM.

Zero reads as a household on purpose. An invitation with no members is refused
long before that function, so the branch is unreachable; written as `<= 1` a
count that somehow arrived as zero would address a group in the singular, and
the cost of being wrong the other way is nothing.

**THE REST OF THE FORM IS REMOVED, NOT DISABLED.** It used to be on screen from
the first paint with the attendee list `disabled` and dimmed. The browser
honoured that and a reader did not: it looked like a control refusing to work
rather than a question that was not theirs yet. And removal makes `declineNow`'s
own note about payload timing stronger rather than obsolete — a fieldset that is
not mounted cannot contribute a name at all.

**A SOLO INVITATION STILL NAMES ITS SEAT, AND THAT IS NOT OPTIONAL.**
`seats_confirmed` is derived from the attendees and must EQUAL their count
(migration 0007), so a solo acceptance submitting no name would record an
accepted answer holding zero seats — a household the couple would cook for
nobody. A hidden input carries it, and the payload is byte for byte the one a
single ticked box produced. There is a test for exactly that.

**SEVEN EXISTING TESTS FAILED AND NONE WAS DELETED.** Each asserted something
that genuinely changed, so each was updated to assert the same intent through
the new flow — the attendee list after the affirmative, the child marker on a
household rather than on a solo fixture, the refused decline leaving the
QUESTION on screen rather than a submit button that now belongs to the other
branch. One was replaced outright: "keeps the attendee list disabled until the
household says yes" asserted the weaker version of what "shows nothing else
until the question is answered" now asserts, and a comment stands where it was.

**One branch is now unreachable and is recorded rather than removed.**
`seatsSelectionSentence`'s "Ya seleccionaron a la única persona." can only be
produced by a one-member list, and a one-member invitation no longer has a list.
It is still a correct sentence and still covered in `rsvp-copy.spec.ts`; nothing
renders it.

Green: 2317 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U20 — done (the screen that shows when the invitation fails to draw)

The couple, with a screenshot: "cuando algo sale mal esta es la pantalla que
está retornando, está horrible; hay que mejorarla con el mismo estilo que
estamos llevando en la landing y la invitación: una fotografía y un mensaje de
error."

It was black text on white, crammed into the top-left corner, with a bare
`<button>` — the framework's default box model and nothing else. Exactly the
defect U4 found on the gate, for exactly the same reason: a screen written for
what it SAYS and never looked at. `error.tsx` had thorough tests for its stale-
chunk detection and its copy, and not one line about what a guest would see.

**IT TAKES THE PHOTOGRAPH, AND `InvitationUnavailable` DELIBERATELY DOES NOT.**
That distinction is the design. The not-found page is reached by typing an
address nobody holds, and framing the couple above "no encontramos esta
invitación" would put their wedding on a screen a stranger reached by guessing.
Here the reader holds a real invitation and is already past the gate: theirs did
not go missing, it failed to draw. Showing the same picture the working page
would have shown is the difference between "something broke" and "you are in
the wrong place".

**The reassurance stays first, and that order is the whole copy.** By the time
this fires the RSVP write has usually already succeeded and only the screen
died. A guest who has just confirmed and then meets a failure will assume their
answer was lost, and answering twice is a worse outcome than the error.

**"Intentar de nuevo" became a control.** It was a bare button with no surface
at all — on the one screen whose entire purpose is to offer a second try, a
control a guest cannot recognise is the same as no control. It wears
`StreamLink`'s pill, already the guest-facing one everywhere else.

**The photograph had to be mocked in the spec**, for the reason
`PhotoStage.spec.tsx` records: under Vitest a static image import resolves to a
bare string, and `next/image` throws when `placeholder="blur"` arrives without
its data URL.

Verified by screenshot at 1920 and at 390, through a throwaway route, because an
error boundary cannot be reached from a browser test without breaking the page
on purpose.

Green: 2320 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U19 — done (the screen a household reads after declining)

The couple: "en caso de no poder asistir entonces se les muestra la información
de Zoom con un mejor copy como 'los esperamos por Zoom', similar a lo que
aparece en /transmision."

It said "Los acompañamos por transmisión" over two lines explaining what a
stream is, with no styling of its own — an `h2` and a bare `<button>` inheriting
whatever the page gave them. `/transmision` had already been cut to one
sentence; this card is the same offer, made to somebody who has just said they
cannot be in the room.

**"Gracias por contarnos" stays.** It is the only line that acknowledges the
answer they just gave, and a screen that jumps straight to credentials reads as
though nobody noticed.

**AND IT SPEAKS IN THE NUMBER THEY ANSWERED IN.** U18 made the form ask one
person "¿Podrás acompañarnos?"; a card that then said "pueden acompañarnos" to
that same person is the product changing voice between one screen and the next.
`memberCount` comes from the guest list `RsvpAnswer` already holds.

**The day and the hour are gone from it**, for the reason `/transmision` gave
for its own copy: the announcement above names the day and counts down to it,
and the details list states it again.

**WHICH EXPOSED SOMETHING THE COUPLE SHOULD DECIDE, NOT ME.** This card was the
LAST guest-facing surface rendering `ceremony_time`. The invitation's details
list names Fecha, Lugar and Dirección and no hour, and `/transmision` set
`showTime={false}` long ago. So the hour an operator can edit at
`/console/wedding` is now rendered nowhere a guest can see it. The countdown
carries the instant, and the calendar button on `/transmision` carries the
precise time — but the typed prose reaches no one. Flagged rather than fixed:
adding an "Hora" row to the invitation's details list is one line, and whether
it belongs there is theirs to say.

Green: 2323 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U21, U22 and U23 — done (the two screens say the same thing, and the form asks in order)

The couple read the gate and the invitation side by side and asked for four
things at once.

**THE ANNOUNCEMENT IS THE SAME ON BOTH, AND THAT REVERSES U17.** The gate names
the day; the invitation hid that line and restated the date in a list below. I
hid it because the two come from different places — the announcement from
`WEDDING_INSTANT`, the list from the `ceremony` row an operator can correct —
and protecting the correctable one got the priority backwards. The screen a
guest reads FIRST is the announcement, and the list is what went.

**THE VENUE WAITS FOR A YES, AND IT HAD TO CHANGE COMPONENTS TO DO IT.** The
address was in `InvitationBody`, above the form, shown to everybody before
anybody had been asked anything. A household that cannot come does not need a
street, and handing one to everybody buries the question under directions.

The answer is client state owned by `RsvpAnswer`; `InvitationBody` is a Server
Component and cannot see it. So the venue moved into the form rather than the
answer moving out of it — the alternative would make a mostly-static page depend
on a client boundary.

**WHAT THAT COSTS, STATED.** The operator preview renders no RSVP, so it no
longer shows the venue. That is CORRECT rather than lost: it now matches what an
unanswered guest sees, and the operator checks that copy at `/console/wedding`
where they type it. `console-wedding.spec.ts` answers the question before
asserting the venue, which is what a guest going to the wedding does.

**THE DIETARY FIELD IS GONE AND THE COLUMN STAYS.** It was the one thing on the
form that asked a household to type rather than choose, and it asked it of
everybody who said yes. `rsvp_responses.dietary_notes` is nullable, an absent
field arrives as null, and dropping a column to remove a field is a migration
that buys nothing and forecloses asking again. The browser test asserts the
stored value is NULL rather than dropping the assertion, so a field quietly
reappearing is reported.

**AND THE DECLINED SCREEN UNDERSTANDS BEFORE IT EXPLAINS.** It opened with
"Gracias por contarnos" and went straight to the stream. Thanks is not
understanding: somebody telling the couple they cannot come to their wedding has
usually just decided something they are sorry about. "Comprendemos que no puedan
acompañarnos ese día" comes first, the stream follows in the same breath, and
the way back fills its column like the control above it.

**One thing the couple reported that needed no work.** The Meet address showing
as `{{MEET_URL}}` text rather than a button is the UNFINISHED state: the same
component renders the button the moment the row holds a real address, which was
confirmed by screenshot.

**A KNOWN GAP, RECORDED RATHER THAN FIXED:** the invitation now states the day
from `WEDDING_INSTANT` and no longer from the `ceremony` row, so an operator
correcting `ceremony_date` changes nothing a guest reads. `ceremony_time` was
already in that position. Both belong to the couple to decide.

Green: 2327 unit and component tests, 222 browser tests, typecheck, lint,
format, build. Verified by screenshot at 390 in all three states.

### U24 and U25 — done (the greeting on the photograph, and the cost of saying yes)

The couple, on a phone: "el 'Hola, nombre' que quede en la parte superior de la
fotografía", and "al dar click en 'sí voy a asistir' se abre y se pierde la
información, toca hacer un scroll… ¿qué propones para evitarse un click de más?"

**THE COUNT WAS WORSE THAN THE SCROLL, AND THAT IS WHAT THE QUESTION WAS REALLY
ABOUT.** A household of three tapped FIVE times: yes, three empty boxes, send.
The boxes started empty, so the form asked the household to type back the names
the invitation had just printed to them.

**What was proposed, and what the couple chose.** One person confirms in ONE
tap, exactly as a decline already does: there is nothing to choose, and the
second tap carried no information. A HOUSEHOLD keeps its explicit send — put to
them as a choice, and they took it. The reason is the asymmetry that already
justified the auto-submitting decline: a decline confirms zero seats and names
nobody, so a mis-tap cannot store a wrong number, while an accepted answer does
— and the send is the one place a wrong count can be caught before the couple
cook for it.

**And the household starts with everybody coming.** Unchecking whoever cannot is
the exception. An answer already on file still wins, so a household that said
two of three are coming finds that rather than a form that quietly re-added the
third.

**What opens is brought into view.** `scrollIntoView` with `block: "nearest"`,
so the question they just answered stays on screen above what it opened rather
than being pushed off the top by it. Guarded, because jsdom has no layout and a
screen that scrolls is worth nothing if the page throws on the way.

**THE GREETING NEEDED THE STAGE TO OFFER A PLACE FOR IT.** In `band` the
photograph is a strip and the words begin beneath it, so "¡Hola, Mimi!" sat
under the picture with a band of empty ground above. `PhotoStage` takes an
optional `overPhoto` now, rendered in the print's own cell with its own scrim —
`overlay`'s pair is not rendered in `band` — and hidden at `lg`, where the
photograph is a framed print and type over it is a different design.

TWO ELEMENTS, ONE STRING, and only ever one announced: each is `display: none`
on the side it does not belong to, which assistive technology honours. Placing
ONE element in two different grid cells is not something a grid can do.

**The side padding is 64px and it is measured, not chosen.** The music control
sits at `right-5` and is 44px across, so it occupies the last 64px of the row;
a long household name reaching further would run underneath it. The same gutter
both sides keeps the line centred, and the top clears the notch from the same
safe-area inset that control uses.

**Four browser tests checked boxes that now start checked.** Each was rewritten
to UNCHECK instead, which preserves what it was about — two names means two
seats — and one mattered more than the others: the forged-payload test appended
a stranger to a full household, which put it over the cap, so the SEAT rule
refused it before ownership was ever considered. It makes room first now, and is
about ownership again.

Green: 2334 unit and component tests, 222 browser tests, typecheck, lint,
format, build. Verified by screenshot at 390.

### U26 — done (both controls the same width, decided in one place)

The couple, with a screenshot of them stacked: "los botones tienen diferentes
anchos, deben quedar del mismo ancho."

**BOTH WERE ALREADY `w-full`.** Of two different boxes. "Entrar a la
transmisión" lives inside the stream block, which this card was capping at
`max-w-sm`; "Volver a responder" is a sibling of that block and inherited the
card's full width. Two elements each correctly filling their own parent, and
the parents were different sizes.

**The measure moved onto the card, and nothing inside it caps anything a second
time.** That is the part worth keeping: with one capping element every control
is `w-full` of the same box BY CONSTRUCTION, rather than by three places
agreeing — so it survives somebody adding a third button. The welcome
paragraph's own `max-w-sm` went too; a measure for prose inside a box already
that wide was a second opinion about the same number.

The test asserts exactly that structure — the card carries a `max-w-`, and the
block, the link and the button carry `w-full` and no cap — because jsdom has no
layout and "the same width" is not measurable there.

Green: 2336 unit and component tests, 222 browser tests, typecheck, lint,
format, build. Verified by screenshot at 390 and 1920.

### U27 — done (the scroll fired on the way in, and the review caught it)

Rated CRITICAL, and it was right.

**`attending` IS READ FROM THE ROW ON THE FIRST RENDER.** A household that has
already accepted therefore MOUNTS with the block open — and an effect keyed on
that value alone fired immediately, smooth-scrolling the page under somebody who
had done nothing but reopen their invitation.

The self-submitting effect directly above it guards its own first run, for
exactly the same reason. This one had no equivalent; the idiom was right there
and I did not reach for it.

**MY TEST COULD NOT TELL THE TWO APART.** It clicked the radio and then checked
the stub, so "scrolled because the guest just answered" and "scrolled on load"
both satisfied it. That is the fourth time this session a test has passed for a
reason unrelated to the behaviour it names, and the shape is always the same: an
assertion that the good path satisfies AND the bad path satisfies.

**The guard is a ref of the value last acted on, seeded with the value we
ARRIVED with.** A plain "have we mounted yet" boolean would also silence a
household that declines and then accepts again in the same visit — a real answer
given in front of us — so there is a test for that too.

Green: 2338 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

### U28 — done (a decline names nobody, and the form was reading it as if it did)

The review's validator found it after the scroll fix, and it is a defect I
introduced with the pre-checked default.

**`??` DOES NOT FALL BACK FOR AN EMPTY ARRAY.** A recorded decline stores an
empty attendee list BY CONSTRUCTION — it confirms zero seats. So
`current?.attendeeGuestIds ?? guests.map(...)` took the empty list, and a
household that declined and then pressed "Volver a responder" met a form with
nothing ticked: the exact friction the default had just removed, in the one case
where somebody is changing their mind, which is when a form should be at its
most helpful.

An ACCEPTED answer on file still wins. The condition is `current.attending` now,
not the presence of a list.

**One more known limitation, recorded rather than fixed.** Both radios answer on
`change`, so a keyboard user arrowing through the group passes over the first
option and answers it. That shape predates this work — the decline has always
had it — and it is recoverable from either side. Named here so it is a decision
rather than an oversight.

Green: 2339 unit and component tests, 222 browser tests, typecheck, lint,
format, build.

Commit `0e13786`. RDD: assessed **medium** (`executable_change`, 4 paths, 95
authored lines), `review_due: false` — under the ~400-line delivery budget, so
the candidate is the slice, not this commit. Deferred to slice close.

### U29 — done (the card became the photograph, and stopped saying the name twice)

The couple, on the WhatsApp preview: the card should be the PICTURE, with the
household's name and our line beside it — the bubble WhatsApp actually draws.

**IT WAS SAYING THE SAME THING TWICE.** WhatsApp renders a thumbnail with
`og:title` and `og:description` next to it, and those two strings already
carried "Familia Muñóz" and "Nos casamos — Luis & Michell". The card then
rasterized both of them AGAIN, in Satori's fallback face, on cream, on the one
surface where the photograph had to do the work. `app/i/[slug]/opengraph-image.tsx`
renders no text at all now: one full-bleed photograph, and the names stay
exactly where they were, in `buildInvitationMetadataText`.

**THE SHAPE IS A DECISION AND IT IS THE COUPLE'S.** 1200×630 is the
conventional Open Graph size and it was right for words on a cream ground. It
is the wrong frame for this picture: at 1.9:1 the band cannot hold her head and
his knee on the ground at once, and every crop that fits the band loses either
the waterfall above them or the two of them standing in it. At the size a
preview is actually drawn, what has to survive is the emotion, not the
composition. They chose the square, and it keeps the waterfall and both people.

**AND THE SQUARE HAD TO BE A NEW FILE, FOR A REASON THAT IS A HARD LIMIT.**
`ImageResponse` refuses a bundle over 500 KB — "your JSX, CSS, fonts, images,
and any other assets" — and the only way to get a local file into Satori is a
base64 data URI, which costs four bytes for every three. `img/boda.jpg` is
518,242 bytes and encodes to **690,992**: it cannot render at all. The
derivative `img/og-card.jpg` is the `1800x1800+0+500` window of the original,
resized to 1200×1200 at q80 with the EXIF stripped — 265,052 bytes, **353,404**
encoded, about 147 KB of headroom.

That is a trap with no signal of its own: an over-budget card throws at request
time, the crawler gets nothing, and the message goes out with a blank preview
nobody sees until a guest mentions it. So `tools/og-card-asset-budget.spec.ts`
measures the asset on disk — that it is 1200×1200, read out of the JPEG's own
frame header rather than trusted from its filename, and that its base64 length
clears the ceiling with room to spare.

**AND THAT GUARD WAS GREEN THE MOMENT IT WAS WRITTEN, SO IT WAS MADE TO FAIL ON
PURPOSE.** `3a7f89a` in this same branch exists because two assertions in this
repository could not fail; a budget guard written against an asset that already
fits is exactly that shape. Pointed at `img/boda.jpg` it reported:

    AssertionError: expected 690992 to be less than 500000
    AssertionError: expected { height: 2400, width: 1800 } to deeply equal
      { width: 1200, height: 1200 }

Pointed back, green. The negative control stayed in the file rather than only
in this paragraph: the last test measures the full-resolution original and
asserts it does NOT fit, so the ceiling assertion is proven falsifiable on every
run instead of once, by me, today.

**THE CARD IS NOW BYTE-IDENTICAL FOR EVERY HOUSEHOLD, AND THAT IS A STRONGER
GUARANTEE THAN THE ONE IT REPLACED.** The route reads no invitation, takes no
`params` and touches no database. `buildOgCardModel` existed to be a PROJECTION
so a field added to the read model could not leak onto a public card by being
forgotten — good reasoning, and now obsolete: an image with no input cannot leak
anything. It and `OgCardModel` were deleted with their only caller.
`buildOgCardInvitationLine`, `OgCardSource` and `buildInvitationMetadataText`
stay; the page and the dispatch console still read them.

**RED, quoted.** `e2e/invitation-page-og.spec.ts` asserted the OPPOSITE of the
new truth — "renders visibly different pixels for the accented and unaccented
name", which required the card to vary by household. Its replacement asserts
two households get equal BYTES, and it failed against the old card exactly as
it should:

    ✘ 6 › the Open Graph card image › is byte-identical for two households,
          while their og:title still differs
      Error: expect(received).toBe(expected) // Object.is equality
      Expected: true
      Received: false
      > 285 |       expect(mineBody.equals(theirsBody)).toBe(true);

**Both halves of it can fail, and that is the point.** Equal bytes alone would
also be satisfied by deleting personalization altogether, so the same test reads
`og:title` for both households and requires them to DIFFER. One half guards the
image against guest data; the other guards the product against a green run that
got there by breaking the preview.

And the tools guard binds itself to the subject: it reads the route file and
asserts it names `og-card.jpg`, because a budget guard measuring a file the
route no longer embeds is green and proves nothing.

**A TEST WAS DELETED, AND A GREEN ONE.** `tools/og-font-coverage.spec.ts` read
the cmap of the font `next/og` bundles and proved `ñ`, `Ñ` and the accented
vowels were real glyphs rather than tofu. Its premise was "the card renders
guest names". Nothing renders text in the image any more and no font is loaded,
so it asserted a property of a font this product no longer uses — four green
tests describing nothing. A test that cannot fail is worse than no test,
because it is read as coverage. `tools/ttf-cmap.ts` went with it: it had exactly
one consumer. `tools/no-source-placeholders.spec.ts` was checked first, since it
requires at least 50 source files and globs `tools/**/*.ts` — 144 before, 143
after.

**TWO WRITTEN REQUIREMENTS WERE FALSE AND WERE REWRITTEN RATHER THAN DROPPED.**
`openspec/specs/invitation-page/spec.md` said the card was names-only "when the
rendered image and its `og:description` text are inspected", and that the image
must render accented and enye characters without tofu. Neither describes this
product now. The first became the same prohibition over the METADATA TEXT plus
the stronger image claim — two households, byte-identical card — and the second
became the guarantee that a Spanish name survives the path it actually travels:
`og:title` in the first HTML response, byte for byte, with the card's own
obligation kept as "it must return a real PNG raster", because that is what an
over-budget card stops doing.

**THE ASSET SHIPS, AND THAT WAS VERIFIED RATHER THAN ASSUMED.** `img/` sits
outside `public/`, `next.config.ts` has no `outputFileTracingIncludes`, and the
path is built at module scope from `process.cwd()` — three reasons a traced
bundle might not carry the file, and a card that renders locally and 500s in
production is the worst way to find out. The build's own trace answers it:
`.next/server/app/i/[slug]/opengraph-image/route.js.nft.json` lists
`../../../../../../img/og-card.jpg` among its 204 traced files.

**THE CONSOLE'S BUBBLE WAS MEASURED, NOT EYEBALLED.** A 1:1 image dropped into a
box built for a 1.9:1 one is exactly where a squash or a letterbox hides.
`WhatsAppBubble` renders `<img class="block w-full">` with no height, no
`aspect-ratio` and no `object-fit`, and `app/globals.css` has no `img` rule at
all, so the browser uses the intrinsic ratio. Measured through a throwaway probe
that injected the committed snapshot's own markup into a page carrying the built
stylesheet: **366 × 366, ratio 1.000**. No distortion, no letterbox, and the
snapshot needed no update — it encodes classes, never dimensions. The probe was
deleted.

`og:image:alt` changed with the image. "Invitación de boda" was an honest label
for a card that said those words; for a photograph of two people it tells a
screen-reader user nothing. It describes the picture now, and still names
nobody and nowhere — it travels with every forward of the link, exactly like the
image.

Green: 2334 unit and component tests, 222 browser tests, typecheck, lint,
format, build. The unit figure is four lower than the last run on purpose: nine
tests were deleted with `buildOgCardModel` and the font guard, and five were
added with the asset budget. Verified by eye at 1200×1200 and inside the bubble
at 1440.

#### U29 amended — the card worked, and it was 11× too heavy

Not a new unit: a defect in the one above, found by the parent's verification of
it rather than by a guest, a couple or a review.

**THE MEASUREMENT, AND HOW IT WAS FOUND.** Every check U29 shipped with was
green, and each one was true. The card returned 200, it carried PNG magic bytes,
it was byte-identical across households, the asset cleared the 500 KB
`ImageResponse` ceiling with 147 KB to spare. Not one of them looked at HOW MANY
BYTES a crawler downloads. Rendering the route's real output through the actual
Satori + Resvg pipeline — rather than trusting "it returns a valid PNG" —
answered it:

| what                                  | bytes         |
| ------------------------------------- | ------------- |
| `img/og-card.jpg` on disk             | 265,052       |
| its base64, for the data URI          | 353,404       |
| **the PNG the route actually served** | **2,887,177** |

Reproduced here before anything was changed, by constructing the shipped JSX
against `ImageResponse` directly: `2887177 bytes`, magic `89 50 4e 47`.

**`ImageResponse` ALWAYS RASTERIZES TO PNG, AND THAT IS WHY THE NUMBER IS THAT
SHAPE.** PNG is lossless, so a photograph re-encoded into it costs eleven times
the JPEG it was made from. The card this route used to draw was words on a flat
cream ground — the one case where PNG costs almost nothing — and U29 changed the
content out from under that encoding without noticing the encoding was part of
the decision. Every crawler then paid 2.88 MB for a thumbnail, and every cold
generation paid a full Satori + Resvg rasterization to produce a worse version
of a file the repository already had.

**THE TOOL WAS WRONG THE MOMENT THE CARD STOPPED BEING COMPOSED.**
`ImageResponse` exists to turn JSX into pixels. U29's own strongest claim —
"this file reads no invitation, takes no `params` and touches no database, so
the card is BYTE-IDENTICAL for every household" — is precisely the statement
that there is nothing to compose. A static photograph run through a layout
engine is a layout engine being asked to copy a file.

**AND RETURNING IT DIRECTLY IS THE CONVENTION'S ACTUAL CONTRACT, NOT A WAY
AROUND IT.** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`
line 251: "The default export function should return a `Response`." Line 253:
"> **Good to know**: `ImageResponse` satisfies this return type." `alt`, `size`
and `contentType` stay separate config exports (lines 257-263 and 302-311), and
`contentType` is the image MIME type — `image/jpeg` now, which Next emits as
`og:image:type`.

**THE FILE IS `.ts`, NOT `.tsx`,** because no JSX survived. The convention
accepts `.js`, `.ts` and `.tsx` alike (same document, "Generate images using
code"), and the extension never reaches the URL — which is what `og-warm.ts`,
the console's dispatch preview and `app/robots.ts` all depend on. `git mv`, so
the history follows.

**THE BUDGET GUARD'S PREMISE DIED WITH THE RASTERIZER, AND THE REPLACEMENT SAYS
WHAT IT IS.** The 500 KB ceiling was an `ImageResponse` bundle limit; there is
no bundle. Base64 length is now irrelevant to this product. What matters is the
served payload, so `tools/og-card-asset-budget.spec.ts` measures the raw JPEG
and the 1200×1200 frame out of the file's own header.

Its threshold is **self-imposed and labelled as such in the file**. I could not
verify a documented maximum image size for WhatsApp link previews from any
source available in this session, so none is claimed and none is cited: 500,000
bytes is a crawler-friendliness budget chosen here, about 2× headroom over the
265,052 the card weighs. The real, measured reason the guard exists is written
beside it — the PNG this route used to return was 2,887,177 bytes. The negative
control stays: `img/boda.jpg` is 518,242 bytes and fails the same budget on its
own, so the assertion is proven falsifiable on every run rather than once.

The old "and with headroom" assertion was dropped on purpose, and that is a
weakening only in appearance. It existed because overrunning `ImageResponse`'s
ceiling meant the card did not render AT ALL — a cliff worth standing well back
from. A raw-bytes budget has no cliff: a file at 499,900 bytes is heavy, not
broken, and keeping the margin would have made the real budget 400,000 while the
constant said 500,000.

**ONE NEW ASSERTION BINDS THE GUARD TO THE ROUTE'S BEHAVIOUR**, because every
number in that file is about a JPEG on disk and that is only the served payload
while the route returns those bytes. It asserts the route neither imports
`next/og` nor constructs an `ImageResponse`. Written first as a bare
`toContain`, it failed against the CORRECT implementation — the route's comments
name `ImageResponse` several times to explain why it is gone — so it checks the
import and the construction by shape instead. A guard that forbids the
explanation alongside the defect is one the next person loosens.

**RED, OBSERVED AND QUOTED, TWICE.** The unit guard, pointed at the route that
shipped in `8b9e348`:

    AssertionError: expected '…import { ImageResponse } from "next/og"…'
      not to match /from\s+["']next\/og["']/
    ❯ tools/og-card-asset-budget.spec.ts:184

And the browser test, run against that same restored route before the fix was
put back:

    ✘ 9 › the Open Graph card image › answers a crawler with the photograph's
          own JPEG bytes, not a re-encoding
      Error: expect(received).toContain(expected) // indexOf
      Expected substring: "image/jpeg"
      Received string:    "image/png"
      > 246 |  expect(response.headers()["content-type"]).toContain("image/jpeg");

**THE E2E ASSERTS EQUALITY WITH THE FILE, NOT A SIZE THRESHOLD.** A threshold
answers "is it small enough"; `body.equals(CARD_PHOTOGRAPH)` answers the
question that actually matters, which is "was anything re-encoded at all". It
cannot be satisfied by a smaller re-encoding, it needs no number anybody chose,
and a reintroduced `ImageResponse` fails it on the first byte. The
byte-identical-across-households test and the `og:title`-differs half are
untouched and both still able to fail; so is the cache-control test, and the
header value is unchanged.

**One trap on the way in, worth the line.** `import.meta.url` cannot resolve the
asset path in a Playwright spec: the runner transpiles these to CommonJS and
fails the whole FILE with "Cannot use 'import.meta' outside a module", which it
then reports as **"No tests found"** rather than as an error on that line.
`__dirname`.

**THE TRACE SURVIVED THE RENAME, AND IT WAS CHECKED RATHER THAN ASSUMED**, since
`img/` sits outside `public/` and the path is built at module scope from
`process.cwd()`. `.next/server/app/i/[slug]/opengraph-image/route.js.nft.json`
still lists `../../../../../../img/og-card.jpg` — now among **100** traced files
rather than 204, the other hundred having been Satori and Resvg.

**AND THE PAYLOAD WAS MEASURED, NOT ASSUMED.** Against `next start` on the final
build:

    content-type: image/jpeg
    cache-control: public, immutable, no-transform, max-age=31536000
    served bytes: 265052
    byte-identical to img/og-card.jpg

**2,887,177 → 265,052. The card is 9.2% of what it was**, and it is now the file
rather than a picture of it.

Three stale claims elsewhere were corrected rather than left: `og-warm.ts` said
the first fetch pays for "a cold Satori + Resvg generation" — it pays for a disk
read now, and the warm is still worth doing because it is the CDN edge holding
the object that matters, which never depended on how the bytes were produced;
`openspec/specs/invitation-page/spec.md` required `content-type: image/png` and
PNG magic bytes, and now requires the JPEG and the byte-identity; and three
comments naming `opengraph-image.tsx` follow the rename. The historical
`openspec/changes/**` planning artifacts were deliberately left alone.

Green: 2335 unit and component tests, 222 browser tests, typecheck, lint,
format, build. One test added — the no-rasterizer assertion — and none deleted.

Commits `8b9e348` and `7232191`. RDD: assessed **medium** (`executable_change`
in `app/(public)/page.tsx`), 16 paths, 1363 changed lines, `review_due: true`
(`slice_budget_reached`). Reviewed as one candidate under lineage
`review-7798c414d7581ea1`, single lens `review-reliability`, consent **granted**
by the couple, outcome **approved**.

The assessment first refused with `unassessable` because the untracked
`.claude-write-probe` — an empty 0-byte tooling artifact, not part of this work —
requires an explicit declaration. Excluded with `--untracked-scope=exclude` and
the inventory digest the refusal handed back, rather than deleted: it is not
this unit's file to remove.

**The acknowledgement receipt was not read, and that is worth writing down
rather than glossing.** `review acknowledge-approved` exited 0, but the envelope
it prints was swallowed by a `jq` filter of mine — `//empty` inside an object
construction discards the whole object, so a successful command looked silent.
The contract says report the burn from that envelope and never from a later
status, so this record does not claim the receipt. What is evidenced: the
command exited 0, no replay was attempted, and the subsequent read-only status
reports the lineage `unrelated` with `base_tree` advanced to `eef51cf`, this
candidate's own tree — consistent with a burn, and short of proof of one.

Five advisory findings, all non-blocking and `informational`; per contract they
are separate later work and never reopen this candidate. Two share a root cause
worth fixing on its merits, because it is the failure mode this repo already
names in `components/landing/photos.ts` — two literals that are one fact:

- `R3-declared-size-unbound` (`app/i/[slug]/opengraph-image.ts:72`) — `size`
  hardcodes 1200x1200 and the budget spec hardcodes it again. Nothing binds
  either to the JPEG's own frame, so a replaced asset makes `og:image:width`
  and `og:image:height` advertise a lie while both files still agree with each
  other.
- `R3-route-asset-binding-satisfied-by-comment`
  (`tools/og-card-asset-budget.spec.ts:167`) — only a comment ties the guard to
  the path the route actually reads, so the guard could measure a file the route
  has stopped using.
- `R3-byte-identity-passes-on-error-pages`
  (`e2e/invitation-page-og.spec.ts:316-318`) — the `> 1_000` floor rules out two
  empty bodies, which the comment says, but not two identical error pages over
  1 KB.
- `R3-module-init-read-unproved` (`app/i/[slug]/opengraph-image.ts:140`) —
  nothing asserts the module-scope read resolves at init in the built bundle;
  the build trace and the browser tests cover it only in practice.
- `R3-jpeg-walk-standalone-markers`
  (`tools/og-card-asset-budget.spec.ts:132`, SUGGESTION) — the frame-header walk
  does not account for standalone markers.

### U30 — done (two assertions that read stronger than they were)

Written earlier and left on disk uncommitted; committed now on request, after
reading them rather than trusting them.

**`for (const box of getAllByRole("checkbox")) expect(box).toBeChecked()` is
satisfied by ONE rendered checkbox**, and it never says which guest any box
belongs to. The default under test exists precisely so the household arrives
complete, so the count is now pinned and every guest named by `fullName`. Two
occurrences in `components/invitation/RsvpAnswer.spec.tsx`.

**In the browser test the failure ran the other way.** `uncheck()` is satisfied
by the state it wants, so on a box already off it does nothing and reports
nothing. A default that regressed to empty would have passed both `uncheck()`
calls and failed later through the seat count — a test that says something
broke without saying what. `e2e/rsvp.spec.ts` now asserts all three boxes
checked before touching any of them.

Same family as `3a7f89a`: the assertion existed, and it could not fail.

Green: 2335 unit and component tests, 14 rsvp browser tests, typecheck, lint
(0 errors; the 9 warnings are pre-existing and none are in these files —
verified by re-linting the stashed base), format.

Commit `902007d`. RDD: assessed **medium** (`executable_change` in
`components/invitation/RsvpAnswer.spec.tsx`), 3 paths, 92 changed lines,
`review_due: false` — `under_budget`. The slice stays pending; the reviewed
boundary remains this unit's predecessor until a later commit reaches the
delivery budget.

### U31 — done (the day and the hour leave the database entirely)

The owner asked for the removal outright: delete `ceremony_date` and
`ceremony_time` — column, domain field, console field, read model, rendering
path and tests. "They are dead weight and the console actively lies about them."

**NOTHING A GUEST COULD OPEN RENDERED EITHER, AND THAT WAS CHECKED RATHER THAN
ASSUMED.** `StreamDetails` was the only component that ever printed them, above
the join control, behind `showDate` and `showTime` props that **defaulted to
true**. There are exactly two callers and both passed false:

| caller                               | what it passes                      |
| ------------------------------------ | ----------------------------------- |
| `StreamInvitation` (`/transmision`)  | `showDate={false} showTime={false}` |
| `CeremonyStream` (the declined card) | `showDate={false} showTime={false}` |

`RsvpAnswer` reaches the block only through the second of those, so there is no
third caller and no third answer. A default nothing takes is not a safe default:
it is a branch that renders only in a spec file, and it kept two columns alive
in the schema, the read model, the console form and every fixture that had to
name them.

**AND THE CONSOLE TOLD THE OPERATOR THE OPPOSITE.** Beside the date field:
"Se muestra tal como se escriba acá, en la invitación y en la transmisión."
False. An operator correcting the date changed nothing a guest reads and was
told it had worked — which is worse than an editor that is simply missing,
because the wrong belief survives the visit. That hint went with the field.

**THE DATE A GUEST ACTUALLY READS COMES FROM SOMEWHERE ELSE AND STAYS THERE.**
`WEDDING_INSTANT` in `lib/domain/wedding-day.ts`, hardcoded, driving
`SaveTheDate` on every guest-facing screen, the countdown and the RSVP deadline.
Untouched by this unit.

**THE CALENDAR LINK WAS THE ONE THING THAT COULD HAVE BLOCKED THIS, AND IT WAS
VERIFIED BEFORE ANYTHING WAS DELETED.** `/transmision` builds
`googleCalendarUrl(calendarEvent)`, and `buildStreamCalendarEvent` takes
`{ coupleNames, streamUrl }` plus a `Date` — the page passes `WEDDING_INSTANT`.
The event's `uid`, `start` and `dates` are all derived from that instant. No
path from the dropped columns to the calendar entry, so the link is byte-for-byte
what it was.

**THE CONSEQUENCE THE OWNER ACCEPTED, WRITTEN DOWN RATHER THAN DISCOVERED
LATER.** The wedding date now lives ONLY in code. Moving the wedding is a deploy,
not an UPDATE at `/console/wedding`. And `odd/tasks/wedding-landing.md` carried
the OPPOSITE open question under "Next step" — wire the landing TO the
`ceremony` row, so the day becomes correctable without a deploy. **This change
answers that question in the negative**, and that document now says so at the
top of the section rather than continuing to read as undecided.

**RED, OBSERVED AND QUOTED, ON FOUR FRONTS.** A deletion's honest red is a test
asserting the thing is gone; `3a7f89a` exists in this branch because two
assertions here could not fail, so each of these was run before a line of
implementation.

The domain field list:

    AssertionError: expected [ Array(6) ] to deeply equal
      [ 'coupleNames', 'streamUrl', …(2) ]
    +   "ceremonyDate",
    +   "ceremonyTime",
    ❯ lib/domain/wedding-facts.spec.ts:76:45

The live schema, asked of the catalog rather than of a list in the test file:

    ✕ the ceremony configuration row > no longer has the two columns migration
      0018 dropped
    AssertionError: expected [ 'ceremony_date', 'ceremony_time' ]
      to deeply equal []
    ❯ supabase/tests/ceremony.spec.ts:190:21

The console form, once for each box:

    ✕ WeddingFactsForm's fields > offers no Fecha box to type into
    AssertionError: expected <input data-slot="input" …(9)></input> to be null
    + <input … id="wedding-ceremonyDate" name="ceremonyDate" required=""
             value="sábado 14 de noviembre de 2026" />

And the component, with no props at all — which is what both callers passed in
effect:

    ✕ StreamDetails > states no day and no hour, with nothing to switch off
    AssertionError: expected [ <dt class="sr-only"></dt>, …(1) ]
      to have a length of +0 but got 2

**THE SCHEMA ASSERTION IS AGAINST THE CATALOG, NOT AGAINST A SHORTER LIST.**
Removing two entries from `CEREMONY_COLUMNS` proves only that the test stopped
asking. It cannot tell a tree that stopped reading two columns from one where
the migration actually ran — the exact gap `seats-allowed-dropped.spec.ts` was
written to close for 0013. So `DROPPED_COLUMNS` is kept by name and
`information_schema.columns` is queried for it.

**NO SCANNER GUARD, AND THAT IS THE ESTABLISHED PATTERN RATHER THAN AN
OMISSION.** 0013 shipped `tools/no-seats-allowed.spec.ts`, and it is the only
drop that did: 0016 (`rsvp_deadline`) and 0017 (the two Zoom credentials, on
this same table) shipped a migration and a down script and nothing else. 0013's
guard exists because 0012 deliberately left the column standing, dead, for one
migration — a window where source and schema disagreed on purpose. There is no
such window here.

**WHAT THE MIGRATION HAD TO ACCOUNT FOR, ASKED OF THE RUNNING CATALOG.** The
same four questions 0013 and 0016 ask, because PL/pgSQL resolves a column
reference when a function RUNS: views — none; indexes — none but `ceremony_pkey`
on `id`; functions and triggers — none; constraints — **four**, all of them
column checks on the two columns (`ceremony_ceremony_date_check` and
`_time_check` from 0009, `_not_blank` for each from 0011). A check naming one
column is dropped with it, which is what 0017 relied on, so step 2 is a bare
`drop column` and not `cascade`.

**THE VALUES DESTROYED WERE REAL, NOT PLACEHOLDERS.** The row held
`28 de noviembre de 2026` and `5:00 pm`, typed by the couple. Unlike 0017, which
could say honestly that it was dropping `{{ZOOM_MEETING_ID}}`. So the migration
prints them in a `raise notice` before the drop, following 0013 and 0016: the
deploy log is the only place they survive, and the down script says so rather
than pretending otherwise.

**THE DOWN SCRIPT RESTORES THE PLACEHOLDER, NOT THE DATE WE KNOW.** Writing a
rendering of `WEDDING_INSTANT` into the column would be an invention wearing the
shape of a restore — and it is precisely the drift the drop exists to end. It
comes back as `{{CEREMONY_DATE}}` / `{{CEREMONY_TIME}}`, visibly unfinished.

**AND THE DOWN SCRIPT WAS RUN, NOT READ.** Against the live schema inside a
transaction that was then rolled back, because a rollback path nobody executes
is a rollback path nobody knows works:

    before:              []
    after down (in txn): [ 'ceremony_date', 'ceremony_time' ]
    restored values:     {"ceremony_date":"{{CEREMONY_DATE}}",
                          "ceremony_time":"{{CEREMONY_TIME}}"}
    constraints back:    ceremony_ceremony_date_check,
                         ceremony_ceremony_date_not_blank,
                         ceremony_ceremony_time_check,
                         ceremony_ceremony_time_not_blank
    after rollback:      []

All four constraints return under their original names, so a later rollback of
0011 finds what it expects to drop. Nothing leaked out of the transaction.

**THREE ASSERTIONS WERE REWRITTEN RATHER THAN DELETED, AND THEY GOT STRONGER.**
Each compared against a fixture string the prop type no longer has a field for.
`Fecha` and `Hora` were the only `<dt>`/`<dd>` pair these surfaces ever carried,
so `term` and `definition` are what would come back — and unlike a string
comparison, a role count catches the line restated in ANY wording.
`StreamInvitation`'s day test became `getAllByTestId("save-the-date-when")`
having length one, which is the announcement's own `<time>` and the only
statement of the day on the page.

**ONE TEST NAME WAS FALSE AND SURVIVED TWO EARLIER SHRINKS OF THIS FORM.**
`e2e/console-wedding.spec.ts` said "offers all six facts", and `WeddingFactsForm`
and five other files said "seven" while the list had been six since 0017. Both
are four now, corrected wherever the prose names THIS list. The console form's
`Cuándo y dónde` heading became `Dónde`: a heading promising a "cuándo" above two
boxes that only ask where is the same defect as the hint, one level up.

**AND THE ABSENCE IS ASSERTED, NOT MERELY UNLISTED.** The browser test names the
four labels it expects AND requires `Fecha` and `Hora` to have count zero. A list
that simply stopped naming them would go green with both boxes still on the page.

`lib/domain/dispatch-message.spec.ts` keeps `ceremony_date` and `ceremony_time`
on its forbidden-variable list on purpose, for the same reason `wedding_date` —
never a column at all — is on it: that guard forbids NAMES in a WhatsApp
template, not columns in a schema, and the name is what somebody would reach for.

Green: **2321 unit and component tests** (14 fewer, and the arithmetic is
exact: five `it.each` over `WEDDING_FACT_FIELDS` lost two cases each, two over
`CEREMONY_COLUMNS` lost two each, `StreamDetails` lost four prop-driven cases,
and six were added — the catalog assertion, the two `Fecha`/`Hora` absences, and
three rewritten in place), **222 browser tests**, typecheck, lint (0 errors; the
9 warnings are pre-existing — the identical 9 were re-measured on the stashed
base), format, build.

The migration was applied to the LOCAL database only, with
`npx supabase migration up --local`, which applies the pending file without
touching data — so no reset, and the seeded operators the browser suite needs
were never emptied. **Nothing was pushed to the hosted database**; that is the
owner's step, with the couple present.

**ONE THING FOUND AND NOT TOUCHED, BECAUSE IT IS NOT THIS UNIT'S.**
`img/og-card.jpg` changed in the working tree during this session — 265,052
bytes at `HEAD`, 243,748 on disk, mtime 21:03 — and nothing in this unit reads
or writes that file. It is still a valid 1200×1200 JPEG and every check that
measures it passes, so it is left unstaged rather than reverted or committed.

### U32 — done (the couple's line goes back onto the card, and what that costs)

This is the file U31 found unstaged and correctly left alone. It is committed
here, with the words that explain it.

**WHAT THE COUPLE ASKED FOR, AND WHY IT IS NOT A REVERSAL OF U29.** The preview
should read as a WEDDING at a glance. U29 took every word off the card and moved
the personalization into `og:title` and `og:description`, which is the bubble
WhatsApp actually draws — and it was right about the HOUSEHOLD's name, which
said the same thing twice in a typeface nobody chose. What it left behind is a
thumbnail of two people in the dark. A forwarded chat scrolls past the title
beside the picture; the picture is the part that stops a thumb. So the couple's
line goes back on, and ONLY theirs.

**TOP, NOT BOTTOM, AND THAT WAS SETTLED BY LOOKING RATHER THAN BY ARGUING.**
Both were rendered and put in front of the couple. The bottom placement covered
them: the crop is `1800x1800+0+500` of a 1800×2400 portrait, so the two of them
stand through the lower two thirds and anything written under them lands on her
dress and on his knee. The top third is waterfall and dark rock — the words sit
there with nothing behind them that anybody came to see. The couple picked the
top after seeing both.

Two faces, the same pair the site already uses (`app/globals.css:200-201`):
"Nos casamos" in **Caveat** (`--font-script`) and "Luis & Michell" in **Yeseva
One** (`--font-display`). Both are OFL, fetched from the `google/fonts`
repository for the one render. They are NOT vendored: nothing in this repository
rasterizes text any more, so a font in the tree would be a dependency with no
consumer.

**REPRODUCTION, SO THE ASSET IS NOT A MYSTERY BINARY.** This is the whole
derivation, from the original the repository already ships:

    magick img/boda.jpg -crop 1800x1800+0+500 +repage -resize 1200x1200 base.png
    magick -background none -fill '#f6efe2' -font Caveat.ttf    -pointsize 92  label:'Nos casamos'    \( +clone -background black -shadow 90x14+0+5 \) +swap -background none -layers merge +repage t1.png
    magick -background none -fill '#f6efe2' -font YesevaOne.ttf -pointsize 104 label:'Luis & Michell' \( +clone -background black -shadow 90x14+0+5 \) +swap -background none -layers merge +repage t2.png
    magick base.png \( -size 1200x480 gradient:'rgba(0,0,0,0.62)'-none \) -gravity north -composite \
      t1.png -gravity north -geometry +0+70  -composite \
      t2.png -gravity north -geometry +0+170 -composite \
      -sampling-factor 4:2:0 -strip -quality 80 img/og-card.jpg

1200×1200, 243,748 bytes, EXIF stripped. Smaller than the 265,052-byte cut it
replaces, which is the opposite of what adding words suggests: the second pass
through the encoder at quality 80 gave back more than the text took.

**THE HOUSEHOLD'S NAME DELIBERATELY DID NOT GO ON, AND THAT IS THE WHOLE
DESIGN.** It was the obvious next step and it is the one thing that must never
happen. The couple's names are the same fact for every household, so the card
stays ONE asset: `e2e/invitation-page-og.spec.ts` fetches it for two different
households and requires equal bytes, which is a statement that no guest data
reaches the image at all. A household name on the card destroys exactly that —
the image becomes per-guest data on a public, crawlable URL that travels with
every forward of the link, fetched by an unauthenticated crawler. The names-only
metadata rule would then have to be enforced twice, in two places, one of which
is a JPEG nobody can grep.

**THE SPEC SENTENCE HAD TO CHANGE SHAPE, NOT JUST WORDING.**
`openspec/specs/invitation-page/spec.md` said "The card IMAGE renders no text
whatsoever". That was a STRUCTURAL guarantee: it needed no judgement, because an
image with no text has nothing on it to leak. What replaces it is CONDITIONAL —
the image may carry only facts that are identical for every household — and a
conditional rule is strictly weaker to enforce, because somebody has to apply
it. The requirement now says so in as many words, and names the operative test
("would two households receive different bytes"), so a future reader who sees
names on the card and infers that the household's name may join them is refused
by the requirement instead of encouraged by the precedent.

**`ImageResponse` WAS DELIBERATELY NOT REINTRODUCED, AND THE NUMBER WAS
RE-MEASURED RATHER THAN QUOTED.** Wanting text on the card again is the exact
reason somebody would reach back for `next/og`. U29 measured 2,887,177 bytes of
PNG from the 265,052-byte JPEG the card was then; that number belongs to that
cut, so the same probe was run again against THIS card, through `next/og`'s real
`ImageResponse`:

    jpeg on disk : 243748 bytes
    ImageResponse: 2646572 bytes
    magic        : 89 50 4e 47
    content-type : image/png

Still eleven times, because the cost was never the words — it is that
`ImageResponse` always rasterizes to PNG and a photographic 1200×1200 PNG is
enormous. Words painted into the JPEG cost nothing at request time. The same
words composed over it cost 2.4 MB on every cold fetch, and the route would stop
returning static bytes. Both numbers are now in
`app/i/[slug]/opengraph-image.ts`, each attributed to the cut it was taken from.

**THE REGRESSION, AND IT IS A REGRESSION RATHER THAN AN OVERSIGHT.** When the
text moved OUT of the image earlier this week, the stated benefit was that every
word a guest could read then lived in `og:title` and `og:description` — rebuilt
on every request, and therefore CORRECTABLE AFTER A DISPATCH, including for
links already sitting in somebody's chat. Baking "Luis & Michell" into an asset
served `public, immutable, no-transform, max-age=31536000` gives that property
back up. If the couple's names were ever wrong, cards already delivered could
not be fixed; the only lever left would be rotating the slug, which is a new URL
and a new message. It is theoretical here — they are the couple's own names and
they are already correct — but it is a property this project HAD and chose to
spend. `lib/domain/og-card.ts` still carries the comment explaining why the
names are an input from the `ceremony` row rather than a constant: that reason
("they can be fixed BEFORE the first dispatch without a deploy") now covers only
the metadata text, and the image is past even that. Written into the
cache-control comment in `app/i/[slug]/opengraph-image.ts` so the next reader
meets it where the header is set.

**ONE INVITATION IS ALREADY OUT WITH THE OLD CARD AND KEEPS IT.** "Momo y Lucho"
was dispatched with the text-free photograph. WhatsApp caches one preview per
URL, so that chat will go on showing what it downloaded no matter what this
commit does. Not worth rotating a working slug over: the household has the right
link to the right invitation, and the card they see is the one the couple were
happy to send that morning.

**THE RED, AND WHY THERE IS SO LITTLE OF IT.** This unit is prose plus one
binary. The binary was already green before a word was written — the owner had
replaced it and `tools/og-card-asset-budget.spec.ts` passed 6/6 against it — and
no assertion in the repository can fail because a comment is wrong. Nothing was
invented to fill the gap; `3a7f89a` exists in this branch because two assertions
that could not fail had to be removed, and manufacturing a third would be the
same defect wearing a TDD costume.

What WAS done instead is a failability probe, so "the guards are green" is not
confused with "the guards are looking at this file". `img/boda.jpg` was copied
over `img/og-card.jpg` and the budget spec re-run:

    ✕ the photograph the Open Graph card serves > is the square crop the couple
      chose, read from the file's own header
    AssertionError: expected { height: 2400, width: 1800 } to deeply equal
      { width: 1200, height: 1200 }
    ❯ tools/og-card-asset-budget.spec.ts:193:32

    ✕ the photograph the Open Graph card serves > fits inside the self-imposed
      served-payload budget
    AssertionError: expected 518242 to be less than 500000
    ❯ tools/og-card-asset-budget.spec.ts:212:29

    Tests  2 failed | 4 passed (6)

The real file was restored from a copy taken beforehand and verified by hash
(`98214e70…471e97da`, 243,748 bytes) before anything else ran.

**WHICH EXISTING TESTS COVER THIS CHANGE, AND WHY NO NEW ONE WAS ADDED.**

| Guard                                                                                                           | What it holds for this unit                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/invitation-page-og.spec.ts` — "is byte-identical for two households, while their `og:title` still differs" | The load-bearing one. It is now the ONLY check that can tell the couple's line from a household name painted beside it, and its comment says so.                                                                                                      |
| `e2e/invitation-page-og.spec.ts` — "answers a crawler with the photograph's own JPEG bytes, not a re-encoding"  | The response body equals `img/og-card.jpg` on disk. The new asset ships only if it is the asset actually served.                                                                                                                                      |
| `tools/og-card-asset-budget.spec.ts` (6)                                                                        | Dimensions read out of the file's own JPEG header, weight under the self-imposed 500,000-byte budget, and no `next/og` import or `new ImageResponse(` in the route. The last two are what a future "just put the text back through Satori" runs into. |

A test asserting the card DOES carry text would need OCR; this repository has no
image library at all (the budget spec hand-rolls a JPEG marker walk rather than
add `sharp`), and a dependency installed on every machine to read two words off
a thumbnail is not a trade worth making. A test comparing the alt string to the
`COUPLE_NAMES` constant would assert a constant against itself while proving
nothing about the pixels — which is precisely why `alt` is written as a literal
here, with a comment saying that interpolating the constant would let an edit
move the description off the image it claims to describe.

**THE STALE CLAIMS FOUND AND CORRECTED.** Five files asserted the card was
text-free, in four different wordings:
`app/i/[slug]/opengraph-image.ts` (the header, the cache-control rationale, the
`alt`, and the return comment), `openspec/specs/invitation-page/spec.md` (two
requirements), `lib/domain/og-card.ts`, `lib/domain/og-card.spec.ts` and
`e2e/invitation-page-og.spec.ts` (two block comments). The budget spec's "the
265,052 bytes the card weighs today" was present tense and is now 243,748;
historical measurements elsewhere keep their own numbers, attributed to the cut
they were taken from, because rewriting them would falsify the record rather
than update it.

**AND U31's THREE STALE SENTENCES IN `lib/domain/wedding-day.ts`, WHICH THAT
UNIT DELIBERATELY DID NOT TOUCH.** The header said `ceremony_date` is `text`
(the column is gone, dropped by `0018`), that the end state is a `timestamptz`
on that row (U31 decided the opposite — the day lives in `WEDDING_INSTANT` and
moving the wedding is a deploy), and that there was nothing to drift from
because the row still held its seeded placeholder, untouched (the couple had
filled it in; `0018`'s `raise notice` printed a real date and a real hour on the
way out, so for a while the database and this constant both stated the day with
nothing keeping them equal). All three corrected. No behaviour in that file
changed: `WEDDING_INSTANT` and everything derived from it is byte-for-byte what
it was.

**GREEN.** `npm test` 2321 unit and component tests, `npm run typecheck`,
`npm run lint` (0 errors, the same 9 pre-existing warnings), `npm run format:check`,
`npm run build`, and `PORT=3100 npx playwright test` 222 browser tests. Same
counts as the baseline at `b913743`: this unit adds no test and removes none.

**ONE THING FOUND AND NOT TOUCHED, BECAUSE IT NEEDS THE COUPLE.**
`lib/domain/message-preview.ts:38` tells the operator, in the console's preview
pane, that «la imagen de la tarjeta dibuja los emoji con el juego Twemoji». That
stopped being true at U29, when Satori left — the card has drawn no emoji since,
and it draws none now. It is operator-facing Spanish copy with an approved
snapshot (`components/console/__snapshots__/WhatsAppBubble.spec.tsx.snap`) and a
browser assertion (`e2e/console-preview.spec.ts:365`) behind it, so rewording it
is a copy decision rather than a correction I should make unasked.

### U33 — done (the venue has no address, so the map is the directions)

**THE FACT THE WHOLE UNIT HANGS ON: "Salón para Eventos Villa Campestre" HAS NO
STREET ADDRESS.** There is no line a guest can type into anything. `Dirección`
above this block prints whatever the `ceremony` row holds, and even once the
couple fill it in it will be a description rather than a navigable address — so
the map is not an illustration beside the venue's name. It is the only thing on
this page that says where the wedding is, which is also why it had to go behind
the same gate as the two lines above it.

**WHAT THE OWNER ASKED FOR, IN THEIR OWN WORDS.** "Todo lo del zoom etc debe
realizarse desde la app, por lo tanto deberia existir un boton de como llegar
con las indicaciones ya listas." Zooming happens in the Maps application; the
page's job is to hand it a route that is already prepared. So the link is
`https://www.google.com/maps/dir/?api=1&destination=…` — the DIRECTIONS form,
not a place page. A `?q=` place link lands the guest on a card they then have to
press "cómo llegar" on, which is the extra step this exists to remove. That URL
opens the Google Maps application where one is installed and the web map
otherwise.

**THE INTERACTIVE EMBED WAS CONSIDERED AND DELIBERATELY REJECTED. THREE
REASONS, RECORDED SO THIS IS NOT RE-LITIGATED.**

1. An embed that can be pinched also swallows the page scroll. The usual fix is
   to make it inert until tapped — a first tap whose only job is to arm a second
   one, in the middle of an invitation the guest is still reading.
2. Pinching a ~320x200 box is worse than what it substitutes for. The Maps
   application is the whole screen, knows where the guest is standing and gives
   turn-by-turn directions. The embed is a keyhole onto the same data.
3. It pulls map tiles over cellular before the guest has decided they care. A
   still image, lazily loaded below the fold, costs nothing until it is scrolled
   to.

**MOBILE FIRST, AND THE PART OF IT THAT WAS ACTUALLY VERIFIED RATHER THAN
ASSUMED.** These invitations go out over WhatsApp, so close to every guest opens
this on a phone — the owner stressed it, and it is the reason the browser
assertion runs at 360px rather than on a desktop viewport. The claim that was
checked rather than repeated: a link inside an ORDINARY WhatsApp message, which
is how these are sent (a `wa.me` deep link in free-form text), opens in the
phone's DEFAULT BROWSER. The WhatsApp in-app browser applies to CTA buttons in
Business API templates, which this is not. So the guest really is in Chrome or
Safari with a Maps application installed behind it, and the hand-off works.

**WHY OPENSTREETMAP AND NOT A GOOGLE MAPS SCREENSHOT.** Licensing, not taste. A
Google Maps screenshot cannot be redistributed without licensing; OSM permits it
and requires attribution, and that attribution is BURNED INTO the bottom-right
of `img/venue-map.jpg`. The two travel together: recut the picture from Google
and the attribution goes with the rest of the imagery. No test can read either
fact off a JPEG, so both are written into `VenueMap.tsx` and into
`tools/venue-map-asset.spec.ts` instead.

**AND WHY BUGA IS IN THE FRAME.** An earlier, tighter crop was rejected by the
owner precisely because it showed nothing anybody could place. A map a guest
cannot locate themselves on is a picture of some roads. The committed file is
1280x800: z=13 tiles cropped to the extent of z=12, so it is a 2x source and the
labels stay sharp on a phone at the widths it is actually painted.

**ONE FACT, ONE PLACE, AND THE TRADE THAT COMES WITH IT.** The coordinates the
image was rendered around and the point the link sends the guest to are the same
fact, so `VenueMap.tsx` declares `3.853778,-76.2971633` once and DERIVES the
Maps URL from it. Two copies are two venues the day somebody edits one, and the
failure is silent: a map of one place beside a route to another, with nothing on
the page to compare them.

That does put a wedding fact in the source, which is exactly what
`tools/no-source-placeholders.spec.ts` argues against — and the difference is
worth stating rather than glossing. That rule exists because the venue's NAME
and ADDRESS live in the `ceremony` row, where an operator corrects them with an
UPDATE and no redeploy. A coordinate cannot: moving it in the database would
move the link while the committed picture went on showing the old place, which
is a worse version of the drift that rule prevents. So the picture and the point
are bound to the same commit, and **the price is that changing the venue means
regenerating the image AND deploying, not editing a row.** Taken knowingly, on a
wedding whose venue is booked.

**THE RED, QUOTED.**

    FAIL  |component| components/invitation/VenueMap.spec.tsx
    Error: Failed to resolve import "./VenueMap" from
      "components/invitation/VenueMap.spec.tsx". Does the file exist?

    FAIL  |unit| tools/venue-map-asset.spec.ts
    Error: Cannot find module './jpeg-size' imported from
      /Users/lu/.../tools/venue-map-asset.spec.ts

    FAIL  |component| components/invitation/RsvpAnswer.spec.tsx >
      where the wedding is > gives the household the way there once they say
      they are coming
    AssertionError: expected null not to be null

That last one was re-observed rather than transcribed. Written first as
`expect(mapLink()?.getAttribute("href")).toContain(…)`, its red was chai's
"the given combination of arguments (undefined and string) is invalid for this
assertion" — a true failure that named the wrong thing. The assertion was split
so the absent link is what the message says; the quote above is that version,
run again with the component unwired.

And the browser test, which could only go red AFTER `VenueMap.tsx` existed —
`next build` type-checks the suite, so a spec importing a missing module fails
the web server rather than the assertion. The component was therefore written
first and left UNWIRED, which is the honest red for what this test is actually
about: whether the invitation reaches it.

    ✘ e2e/rsvp.spec.ts › the way to the venue, on a phone › appears only after
      the household accepts, and fits the screen
    Error: expect(locator).toBeVisible() failed
    Locator: getByRole('link', { name: /Cómo llegar/ })
    Error: element(s) not found

**THE THREE ASSERTIONS THAT PASSED THE MOMENT THEY WERE WRITTEN, AND HOW EACH
WAS PROVEN ABLE TO FAIL.** The gate assertions are about ABSENCE, so they are
green against a component that does not exist yet — which is the state
`3a7f89a` exists to keep out of this repository.

`<VenueMap />` was temporarily rendered above the question AND inside the
declining branch:

    × offers no directions before the question is answered
    × offers no directions to a household that has just declined
    × offers no directions to a household whose decline is already on file
    AssertionError: expected <a …(5)>…(2)</a> to be null

`img/og-card.jpg` was copied over `img/venue-map.jpg`:

    × the committed map of the venue > is the 2x crop the labels on a phone
      depend on
    AssertionError: expected { height: 1200, width: 1200 } to deeply equal
      { width: 1280, height: 800 }

and a second copy of the latitude was pasted into `CeremonyStream.tsx`:

    × the venue's coordinates > is written down in exactly one source file
    - Expected: [ "components/invitation/VenueMap.tsx" ]
    + Received: [ "components/invitation/CeremonyStream.tsx",
                  "components/invitation/VenueMap.tsx" ]

Every probe was reverted; the asset was restored from a copy taken beforehand
and verified by hash (`4343a0af…02d6dba5`, 118,041 bytes).

**WHAT IS GUARDED, AND ONE THING DELIBERATELY NOT.**
`tools/venue-map-asset.spec.ts` measures the file's SHAPE, because the shape is
the claim: halve those pixels and nothing fails — the page lays out identically
and every check stays green while the labels a guest needs turn to mush. It does
NOT weigh the file. `tools/og-card-asset-budget.spec.ts` weighs its asset
because the card route returns those exact bytes; this one is rendered through
`next/image`, which re-encodes and resizes per request, so a byte budget here
would measure bytes nobody downloads.

The JPEG marker walk moved out of that spec into `tools/jpeg-size.ts` rather
than being copied. Two committed binaries are now measured, and a copied decoder
is two decoders that agree until somebody fixes a bug in one of them.

**THE GEOMETRY, AND WHY IT IS `fill` RATHER THAN THE DOCUMENTED RESPONSIVE
PATTERN.** The box is `fill` inside an `aspect-ratio` read off the static
import, exactly as `PhotoStage` frames the wedding photograph — so the space is
reserved before the pixels arrive (a lazily-loaded image below the fold must not
shove the submit button down under somebody reaching for it) and the shape is
the file's own. `next/image`'s documented `style={{width:'100%',height:'auto'}}`
form would also have worked in production and would have thrown in Vitest: a
static import is a bare string there, so `next/image` sees a `src` with no
dimensions and raises `E451`. That is why the shape is asserted against the
file's own header and against the rendered page instead of in jsdom.

**GREEN.** `npm test` 2341 unit and component tests (2321 at `14ab9e6`, plus 16
new and 4 that the two glob-driven guards add for two new source files),
`npm run typecheck`, `npm run lint` (0 errors, the same 9 pre-existing
warnings), `npm run format:check`, `npm run build`, and
`PORT=3100 npx playwright test` 223 browser tests (222 plus one).

**ONE THING FOUND AND NOT TOUCHED, BECAUSE IT IS THE COUPLE'S DATA.**
`venue_address` still holds the literal `{{VENUE_ADDRESS}}` in production, so
the `Dirección` line renders that placeholder to every household that accepts.
Correct behaviour — an unfinished invitation must not pass for a finished one —
and theirs to fill at `/console/wedding`. Worth saying, though, that once they
do, `Dirección` and this map will be two answers to the same question and the
map is the one a guest can act on. Whether the line stays, or becomes a landmark
("a 10 minutos al sur de Buga") rather than an address, is a copy decision for
them.

### U34 — done (one screen per step, and the measurement that proves it)

**WHAT WAS WRONG, IN NUMBERS RATHER THAN IN ADJECTIVES.** Measured on an
iPhone 14 (390×664 visible) and a Pixel 7 (412×839), `document.documentElement.scrollHeight`
against `window.innerHeight`:

| screen                 | iPhone before   | iPhone after | Pixel before | Pixel after |
| ---------------------- | --------------- | ------------ | ------------ | ----------- |
| landing `/`            | 664 — 1.00      | 664 — 1.00   | 839 — 1.00   | 839 — 1.00  |
| gate                   | 832 — 1.25      | 664 — 1.00   | 899 — 1.07   | 839 — 1.00  |
| the question           | 1022 — 1.54     | 664 — 1.00   | 1088 — 1.30  | 839 — 1.00  |
| the question, 5 people | 1074 — 1.62     | 664 — 1.00   | 1140 — 1.36  | 839 — 1.00  |
| who is coming (3)      | —               | 664 — 1.00   | —            | 839 — 1.00  |
| who is coming (5)      | —               | 664 — 1.00   | —            | 839 — 1.00  |
| accepted               | 1663 — **2.50** | 664 — 1.00   | 1743 — 2.08  | 839 — 1.00  |
| accepted, 5 people     | 1823 — **2.75** | 664 — 1.00   | 1903 — 2.27  | 839 — 1.00  |
| declined               | 1086 — 1.64     | 664 — 1.00   | 1136 — 1.35  | 839 — 1.00  |
| not found              | 664 — 1.00      | 664 — 1.00   | 839 — 1.00   | 839 — 1.00  |

Horizontal overflow was false before and is false after, on every screen. A
1440×900 desktop window went the same way: 1764 to 900 on the accepted screen.

The "before" column is measured against a build of `97a146e`, not remembered.

Close to every guest opens this from a WhatsApp link on a phone, so "past 664
pixels" means "most households never see it" — and what lived past it on the
accepted screen was the venue, the map and the send button.

**THE ONE STRUCTURAL CAUSE, AND THE SENTENCE IN THIS REPOSITORY THAT WAS HALF
WRONG.** `/` fits because the photograph is BEHIND everything: `PhotoStage` in
`overlay`, one `h-dvh` figure, two scrims, the words in the same grid cell,
`justify-between`. `/i/[slug]` used `band` — a `h-[38dvh]` strip on top with
every block stacked beneath it — and `photos.ts` justified that in as many
words: "filling a phone viewport with it discards about 38% of the width, and
the two people stand left and right of centre — so a fill crop clips both of
them."

Half right. A CENTRED fill crop clips Luis. The couple occupy x 485–1545 of an
1800-pixel-wide file — 1060 pixels, 59% of the width — and a Pixel 7 shows 1178
of them. They fit with room to spare once the crop is told where to look.

**THE CROP, AND WHY THE FIRST NUMBER FOR IT WAS WRONG.** The brief for this unit
estimated `object-position: 55%`, from `999/1800 = 55.5%`. `object-position`
does not name a point in the picture: it distributes the OVERFLOW, so the
percentage that centres a subject depends on how much is being cropped, and the
same value lands somewhere different on every phone. At 55% on a Pixel 7 the
window is 342–1520 and Luis's shoe is 26 source pixels — about nine CSS pixels —
from the edge; at 50% it is off the frame.

Measured with a pixel ruler laid over the file and checked by eye at both device
sizes: **68%**. Pixel 7 sees 423–1601, about sixty pixels clear at each end;
iPhone 14 sees 265–1675, over a hundred. `components/landing/photos.spec.ts`
does that arithmetic on both phones and asserts a centred crop would clip,
because a crop that loses somebody does not fail — it renders.

The limit is stated rather than left to be discovered: a phone narrower than
about 0.41:1 cannot hold both people at any focus, and at 360×800 — the
narrowest in common use — 68% takes a few pixels off the hem of Michell's dress.
That is the picture's shape, not a value that can be tuned.

**THE FOUR SCREENS.** `RsvpAnswer` derives which one is showing from the two
answers it already knew about — the one on file and the one being given — rather
than storing a fifth piece of state that would have to be kept in step:

1. **Gate** — greeting, announcement, field, submit, the WhatsApp way out.
2. **The question** — announcement, one question, two answers, and the deadline.
3. **Who is coming** — the checkboxes and the send button. Nothing else.
4. **Where to go** — the venue, the map, the day AND the hour, the dress code.
   A decline reaches the stream screen instead, as before.

**WHERE THE 999 PIXELS WENT.**

- The photograph stopped being a 252-pixel block on an iPhone (319 on a Pixel)
  and became the background.
- `SaveTheDate` is 236 pixels and rendered on the gate AND on every unlocked
  screen. It is a SLOT now, passed from the route to `RsvpAnswer`, which shows
  it on the question screen and on no other. A slot rather than an import
  because it is a Server Component tree with a live countdown in it, and the
  operator preview renders the same block without rendering the form at all —
  so both surfaces build it from one new component, `InvitationAnnouncement`.
- `.invitation__household` (93px) listed the same names `.rsvp__attendees`
  (194px) lists as checkboxes, and both were on screen at once. The checkboxes
  won: they are the ones a guest can act on.
- `.rsvp__venue` and the map (322px together) opened the instant the affirmative
  was chosen, above the boxes that still had to be ticked. They are the screen
  AFTER the answer is sent, which is also better: nobody is told where to go
  before they have said they are coming.
- `RsvpAnswer`'s `scrollIntoView` and the ref it needed are gone. They existed
  because the venue opened below the fold — "se abre y se pierde la información,
  toca hacer un scroll". Nothing opens below the fold now, and a page that is
  exactly one viewport tall cannot be scrolled to anything.
- The invitation's opening line of prose went with them: "Nos alegra mucho
  invitarlos a celebrar nuestro matrimonio." It is 68 pixels — a tenth of an
  iPhone screen — spent on the only line on the question screen that neither
  states a fact nor asks anything, and the guest read it seconds earlier: the
  WhatsApp message that brings them here opens with the same sentence
  (`lib/domain/dispatch-message.ts`). **A copy decision the couple can reverse,
  at the price of the question screen no longer fitting.**
- `Dirección` went too. The venue HAS no street a guest can type into a maps
  application — `VenueMap` opens with that fact — so the line was a second
  answer to the question the map already answers, and the one a guest cannot
  act on. In production it printed `{{VENUE_ADDRESS}}` verbatim. The column
  stays and the console still edits it; `e2e/console-wedding.spec.ts` now proves
  an edit reaches the guest through `venueName`, which is the value that does.

**THE HOUR AND THE DRESS CODE, WHICH ARE NEW FACTS ON A GUEST'S SCREEN.**
`WEDDING_INSTANT` has carried five in the afternoon since the couple gave it,
and nothing ever PRINTED it: the countdown consumed the instant and migration
0018 dropped the column a household would otherwise have read. So a wrong hour
was invisible until this screen existed, which is why the couple were asked to
confirm it. `formatWeddingTime` renders `5:00 p. m.` in `es-CO`; the spelling is
asserted exactly, because a locale swap that turned it into `PM` would change
the one line that tells a household when to arrive.

`WEDDING_DRESS_CODE` is a constant beside it, on the terms migration 0018 set
for the date: changing it is a deploy rather than an `UPDATE`. A column and a
console field for a two-word phrase that will not change before the wedding
buys a form nobody fills in and a second place a reader has to look.

**THE GATE IS THE ONE SCREEN THAT IS DELIBERATELY NOT HELD TO A HEIGHT, AND
HERE IS WHY.** On real iOS Safari the software keyboard changes neither
`window.innerHeight` nor the `dvh` unit — only `visualViewport.height`. A gate
pinned to the bottom of `100dvh` keeps its full height BEHIND the keyboard, and
the field a guest has just tapped is under it.

Two ways out were weighed. The visual viewport can be read in JavaScript and
projected into a custom property, which tracks the keyboard exactly — and makes
the height of the one screen every guest must get past depend on a script
running. The other is to keep the screen short, put the field in the MIDDLE of
it rather than at its foot, and let the browser do what browsers already do:
`min-h-dvh` rather than a locked height, so nothing forbids a scroll the
keyboard makes necessary, and `justify-center` so there is less of it. That is
what shipped. It costs nothing when there is no keyboard and degrades to an
ordinary page that scrolls a little when there is one.

Nothing in this unit is height-LOCKED, in fact, and that is the same decision
one level up. `min-h-dvh` everywhere, never `h-dvh`: a locked screen clips what
does not fit, and a clipped send button is a dead end, while a household of nine
or a guest who has raised their system font gets a screen that scrolls — worse
than the couple asked for, and still a screen that works. There is no `100vh`,
no `h-screen` and no `min-h-screen` anywhere in the repository, and no
`overflow-hidden` on `<main>`: `PhotoStage` records that an overflow ancestor
kills `position: sticky` on the desktop framed print.

**THE ALERT REGIONS, WHICH ADD HEIGHT WITH NO WARNING.** `.rsvp__feedback` was
82 pixels and `.gate__feedback` 106, mounted on submit. Both now reserve their
space from the first paint — one line's worth — so a refusal does not shove the
page at the exact moment a guest is already stuck. Reserved for ONE line and not
for the worst case: holding four lines of empty ground on every successful visit
to spare the unlucky one a small scroll is the wrong trade.

That change had a consequence in the browser suite worth recording. Three tests
used `expect(gateAlert(page)).toBeVisible()` as a way to WAIT for a refusal. A
reserved slot is visible while empty, so the wait became instantaneous and those
tests went on to submit into a form that had not settled — and then failed on
the next assertion, in a way that looked like a gate defect. `spoke(page)`, which
waits for the region not to be empty, is what they use now.

**WHAT BROKE IN THE BROWSER SUITE, AND WHY EACH BREAK IS INFORMATION.**

- `.check()` on the attendance radios timed out in five places. `check()` clicks
  and then waits for the input to REPORT itself checked; answering replaces the
  screen, so the radio is unmounted a frame later and the wait can never be
  satisfied. `.click()` throughout.
- Two serial stories had to be told in two halves rather than one: a household
  that has accepted now lands on the directions, so the test after the one that
  accepts has to press "Volver a responder" first. That is the product
  behaviour, and the tests say so.
- `e2e/console-preview.spec.ts`'s drift guard compared the two documents byte
  for byte, minus the RSVP slot. That worked while the guest's invitation and
  the operator's preview WERE the same document with one hole in it. They are
  not any more: the guest's is a stepped screen and the preview renders no form.
  The guard now compares the `invitation__announcement` subtree and the greeting
  — the two blocks both surfaces genuinely still build from the same components,
  which is exactly what can drift. Narrower, and still real.

**THE GUARD, AND THE PROOF IT CAN FAIL.** `playwright.config.ts` grew an
`iphone-14` and a `pixel-7` project from the `devices` presets, scoped to one
spec: pointing them at the whole suite would re-run the console at phone width,
a surface nobody administers from a phone. `wedding-facts` now depends on all
three projects rather than on `chromium` alone, because the two phones read the
same singleton `ceremony` row that spec edits.

Both run on Chromium, INCLUDING the iPhone, and that is a limitation rather than
an oversight: the `iPhone 14` preset asks for WebKit, which this project does
not install. What is measured is geometry — a viewport, a device pixel ratio and
how `dvh` resolves — and Chromium gives all three. What it does not give is
Safari's own layout, and it gives no software keyboard at all.

`e2e/invitation-one-screen.spec.ts` asserts three things per step, on both
phones: `scrollHeight <= innerHeight`, `scrollWidth <= clientWidth`, and that
the step's primary control is inside the viewport. The third is not redundant —
a page can satisfy the first two and still have pushed its send button out of
the bottom of an element that clips, and `toBeVisible()` does not catch that
either, because an element below the fold is "visible" to Playwright.

**ALL THREE WERE FORCED RED BEFORE BEING RELIED ON.**

Reverting the route to `mobilePhoto="band"` — the layout this unit replaced —
turned 12 of the 16 mobile tests red:

    Error: gate: the document is 916px tall on a 664px screen
    Error: question: the document is 916px tall on a 664px screen
    Error: question: the document is 1158px tall on a 839px screen

And the third assertion, forced on its own by clipping `<main>` and pushing the
send button down with a transform, so the document stayed exactly one viewport
tall while the control left it:

    Error: attendees (3): the primary control ends at 912px, past the 664px fold

**THE RED FOR THE REST, QUOTED.**

    FAIL  lib/domain/wedding-day.spec.ts > formatWeddingTime
    TypeError: formatWeddingTime is not a function

    FAIL  lib/domain/wedding-day.spec.ts > WEDDING_DRESS_CODE
    AssertionError: expected undefined to be 'Formal elegante'

    FAIL  components/landing/PhotoStage.spec.tsx > covers the viewport at the
      focus the photograph declares
    AssertionError: expected 'lg:object-center lg:object-cover obje…' not to
      contain 'object-contain'

    FAIL  components/landing/photos.spec.ts > holds both people on a Pixel 7
    Error: The wedding photograph's overlay focus is "undefined", which this
      spec cannot read.

The step-boundary assertions in `RsvpAnswer.spec.tsx` were written after the
component and were therefore proven able to fail rather than observed failing
first: rendering the announcement unconditionally, deleting the hidden
`attending` field and un-reserving the feedback region turned seven of them red,
including

    × does not repeat the announcement while they choose who is coming
    expected document not to contain element, found <p>Nos casamos, Ana y Bruno</p>

    × still says yes in the payload once the radios are off screen
    AssertionError: expected null to be 'yes'

and the same was done for `rsvpDeadlineSentence` and `rsvpConfirmedHeading`,
which are pure functions written beside their tests.

**ONE MISTAKE WORTH RECORDING, BECAUSE IT NEARLY SHIPPED A WRONG MEASUREMENT.**
The first "after" numbers said every screen was 1.00 and they were wrong. The
capture script waited for `networkidle` after submitting the phone number — but
the unlock is a Server Action, not a navigation, so `networkidle` sometimes
resolves while the GATE is still on screen. It was recording the gate's height
under the question screen's name, which is why the "before" run read 832 for
both. Waiting for `article.invitation` found the real numbers: 1022 before, and
699 after — thirty-five pixels over, which is what the announcement's line of
prose cost, and the reason that line is gone. Anything that measures a page has
to prove it was looking at the right one; the before column in the table above
was re-measured against a build of `97a146e` for the same reason.

**WHAT DOES NOT FIT, STATED RATHER THAN GLOSSED.** A REFUSED gate is 676 on an
iPhone 14 — twelve pixels over — because the refusal is two sentences and wraps
past the reserved line. That is an exception state of the one screen that is
deliberately allowed to scroll, and the alternative was shortening a refusal
whose vagueness is a security decision. Every other screen, in every state,
including a five-person household, is 1.00 on both phones.

**DESKTOP IS UNCHANGED BY CONSTRUCTION.** `overlay` and `band` differ only below
`lg`; above it both put the photograph in its own sticky framed column and the
words in the next one. The stepped content is the change, and the accepted
screen went from 1764 pixels on a 1440×900 window to 900.

**GREEN.** `npm test` 2389 unit and component tests (2341 at `97a146e`),
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings — one fewer than
before, all in files this unit did not touch), `npm run format:check`,
`npm run build`, and `PORT=3100 npx playwright test` 239 browser tests (223 plus
the 8 new ones on each of the two phones).

### U35 — done (the gate's label, measured against what was behind it)

A defect in U34, found on U34's own screenshot, twenty minutes after U34 was
committed. Worth recording as its own unit rather than folded into that one:
what it is really about is that U34 measured HEIGHT and never measured
CONTRAST, and a unit that got a number right can still ship a screen nobody
can read.

**WHAT WAS WRONG, IN NUMBERS.** Cream type at 60% opacity, laid over the lit
edge of Michell's dress, with nothing in between.

| iPhone 14            | before (p95 / worst) | after (p95 / worst) |
| -------------------- | -------------------- | ------------------- |
| "Escribe tu número…" | 1.21 / 1.05          | 8.08 / 7.00         |
| `NÚMERO DE CELULAR`  | **1.24 / 1.05**      | 8.43 / 7.48         |
| the number as typed  | 2.54 / 1.38          | 11.71 / 9.50        |
| the field's own edge | **1.30**             | 5.27                |
| `Ver la invitación`  | 4.50 / 3.06          | 13.09 / 12.11       |
| the WhatsApp way out | 6.33 / 5.36          | 16.23 / 14.20       |

| Pixel 7              | before (p95 / worst) | after (p95 / worst) |
| -------------------- | -------------------- | ------------------- |
| "Escribe tu número…" | 5.69 / 1.32          | 11.11 / 10.39       |
| `NÚMERO DE CELULAR`  | **1.12 / 1.01**      | 7.25 / 6.77         |
| the number as typed  | 1.47 / 1.03          | 9.59 / 8.23         |
| the field's own edge | **1.11**             | 4.59                |
| `Ver la invitación`  | 2.94 / 1.86          | 11.70 / 9.65        |
| the WhatsApp way out | 3.74 / 2.94          | 10.04 / 8.16        |

WCAG holds body text to 4.5:1 and the boundary of a control to 3:1. Nine of
those twelve before-numbers are under the first threshold and both edges are
under the second. 1.12:1 is not "dim": it is the label of the only control on
the page, absent.

**HOW THEY WERE TAKEN, BECAUSE A CONTRAST NUMBER NOBODY CAN REPRODUCE IS AN
OPINION WITH A DECIMAL POINT.** The gate was rendered at both phone presets and
screenshotted twice: once with the form's own grounds stripped, once with only
the glyphs made transparent. The second shot is what each element actually sits
on, and the WCAG relative luminance of every pixel inside the element's own box
was taken from it — p95 because a single specular pixel is not a reading
surface, and the worst pixel beside it because the floor should be visible too.
The arithmetic is `lib/design/contrast.ts`, which already grades both theme
tables.

One trap on the way, recorded because it would cost the next person an hour:
`getComputedStyle` returns Tailwind's opacity modifiers as `lab(…)`, which
`parseCssColor` REFUSES by design. Each colour was therefore resolved back to
`rgba()` by painting it on a canvas over black and over white and solving the
two results for its alpha, rather than by loosening the parser.

**THE STRUCTURAL CAUSE, WHICH IS NOT "SOMEBODY PICKED A LOW OPACITY".**
`PhotoStage` lays two scrims over an `overlay` page: the top 55% and the bottom
38%, fading towards each other so that the middle — where the couple are —
keeps the least veil of anywhere in the frame. That is exactly right for the
landing, whose photograph puts the couple low with clear sky above them and
whose words sit at the two ends.

The wedding photograph puts the couple in the MIDDLE, from 53% to 87% of the
frame. And the gate's words run all the way down: measured on an iPhone 14 the
field sits at 60%–72%, in the gap where the top scrim has already faded out and
the bottom one has not yet begun. The brightest pixel under the label is
`#FAF8EF` — 0.937 luminance, all but white, against the 0.861 of the cream the
page writes in.

It is also why the panel on the question screen has been fine at `bg-black/25`
since U34: it sits at 70%–95%, where the bottom scrim is already carrying 60%
to 90% of the load. Same card, a third of the work to do.

**THE FIX THAT WAS LOOKED FOR FIRST AND DOES NOT EXIST.** Shifting the crop
downwards so the couple fall lower and the words get clear sky would have been
the better answer — one value in `photos.ts`, no new ink on the page. It is not
available, and now the spec says so rather than a comment: a `cover` crop is
bound by whichever axis needs the most scaling, and on a 0.75:1 picture in a
0.59:1 or 0.49:1 window that is the HEIGHT. The scaled height equals the screen
exactly, so there is no vertical overflow for `object-position` to distribute
and `68% center`, `68% top` and `68% bottom` are the same picture. Where the
couple sit vertically is the photograph's, full stop.

`components/landing/photos.spec.ts` asserts it on both phones now, which also
turns an assumption `visibleSpan` was already making into a line somebody can
read.

**WHAT THE GATE GREW, AND WHY IT IS PAINTED RATHER THAN LAID OUT.** A ground of
its own, in the language `RsvpAnswer` already uses — a deepening of the same
photograph rather than a sheet of paper on it, rounded, ringed and blurred —
covering the sentence that asks, the label, the field, the button and the
reserved refusal line.

It is `absolute`, with negative insets and `-z-10`, so it adds NO height and
does not narrow the text. Both mattered. A card with real padding would have
taken about 26 pixels from a screen with 57 to spare, and — worse — reflowed
the refusal onto another line on the one screen whose refusal was already past
the fold. As painted, the refused gate got SHORTER: 676px on a 664px iPhone 14
before, 672px after, because the panel absorbed one 16px section gap into a
12px one and the reserved line went from `min-h-6` to the `min-h-5` that is
actually one line of `text-sm`.

`isolate` on the panel is load-bearing, and its absence is the same failure
`PhotoStage` documents for its scrims: painting order is not DOM order. Without
a stacking context of its own, a `-z-10` ground paints below every positioned
element in the page — including the photograph — and the gate renders exactly
as it did before, with nothing to see and no error anywhere.

**AND THE FIELD, WHICH IS A SEPARATE FAILURE FROM THE LABEL.** It was a
translucent bar with a 25% edge under a button that did read as a button. It is
a sunk well now — darker than the panel, a 60% edge that measures 5.3:1 and
4.6:1 against it, an inset shadow, and a placeholder showing the shape of a
Colombian mobile number. The language is the console's own: `--muted` is "the
SUNK surface: inputs, alternate rows, wells", and the button above it stays the
raised one, so the two controls no longer look alike.

The placeholder is not the visible label coming back. `300 123 4567` is an
example of the thing being asked for, it answers "am I meant to type in here?",
and it disappears on the first keystroke — which is exactly why it could never
have been the label.

**WHAT IT COSTS, STATED RATHER THAN GLOSSED.** On the gate the couple are now
behind the card, blurred and darkened, the same way they already are behind the
question screen's card. The photograph still carries the screen — the waterfall
and the lit foliage are untouched above it, and on a Pixel 7 their legs and
Luis's shoes are clear below it — but the gate is no longer a picture of the
two of them. If the couple want them visible on the first screen, the answer is
a different photograph for the gate, and that is theirs to choose, not a value
to tune.

**RED, QUOTED.** `app/i/[slug]/gate-legibility.spec.tsx` was written first and
all eleven of its assertions failed against the shipped gate:

    Error: the gate has no `.gate__panel-ground`
    Error: expected exactly one unconditional `text-` colour on <a class="…">,
      found 0. This spec measures the colour the component declares, so it
      cannot fall back to a default.

and, once the panel existed but its edge did not yet clear the non-text
threshold:

    AssertionError: expected 2.8266786718264405 to be greater than or equal to 3

The new assertion in `photos.spec.ts` cannot fail on today's photograph, so it
was forced: declaring the source 300×2400 — a picture narrower than a phone, so
the WIDTH binds — turned it red on both phones.

    × has nothing to crop vertically on a iPhone 14
    × has nothing to crop vertically on a Pixel 7

**WHAT THE SPEC DELIBERATELY DOES NOT CREDIT.** The panel blurs what is behind
it, and a blur pulls a highlight towards its dark surroundings — which is why
the numbers measured on the real page (8.4:1 for the label) are far above the
5.6:1 the spec's arithmetic predicts from the same tokens. The spec measures
the SHARP pixel. A floor that credits an unmeasurable is not a floor.

**GREEN.** `npm test` 2403 unit and component tests (2389 at `c930ac0`),
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings — the same eight, all
in files this unit did not touch), `npm run format:check`, `npm run build`.
Every step of the invitation still measures 1.00 on both phones.

**NOT GREEN, AND NOT THIS UNIT'S DOING.** `PORT=3100 npx playwright test`
cannot complete on this machine: `e2e/console-guest-directory.spec.ts` fails at
its first assertion, which aborts the rest of its serial describe and skips the
`wedding-facts` project that depends on `chromium`. The cause is the local
Supabase, which has accumulated 607 invitations and 1074 `invitation_guests`
rows from crashed runs — `listGuestDirectory` issues an unpaginated
`.select()`, PostgREST caps a page at 1000 rows, and a freshly seeded fixture
now falls outside it. Reproduced at `c930ac0` with this unit's changes stashed,
so it predates them.

Run around it, every other test passes: 179 of `chromium`'s 207, all 8 on
`iphone-14`, all 8 on `pixel-7`, all 16 of `wedding-facts` — 211 of the 211
tests outside that one file, with 1 passed, 1 failed and 26 skipped inside it.
The fixtures were left in place rather than deleted: 265 of those invitations
do not match any fixture-naming pattern, and a local database is not something
to clear on a guess.

It is also a real defect wearing a test failure's clothes. `listGuestDirectory`
will silently stop returning guests past the thousandth in production too. The
list is 388 people today, so it is not urgent, but it is not hypothetical
either — and it is nothing to do with the invitation, so it is written down
here rather than fixed here.

### U36 — done (the last screen, and the picture that left it)

**WHAT WAS ASKED, IN THE COUPLE'S OWN WORDS.** "En la última parte del flujo de
que sí van a asistir vamos a hacer un ajuste en la parte de arriba en vez de
decir: hola, nombre de la invitación debería ser para la invitación individual
**Te esperamos** nombre de la invitación y si la invitación es 2 personas o más
debería decir: **Los esperamos** nombre de la invitación, seguido la fecha y el
código de vestimenta y en la parte de abajo de la pantalla lugar y solamente el
botón de cómo llegar **sin una imagen**."

Four changes to one screen, and the fourth is the one with consequences.

**THE PLURAL KEYS OFF THE INVITATION, NOT OFF THE ANSWER.** "Si la invitación
es 2 personas o más" — read literally, because the literal reading is also the
kind one. A household of three of whom only one can come is still "los
esperamos": the invitation is addressed to the three people the couple invited,
and a line that dropped to the singular because two boxes came unticked would
read as the couple striking people off a list at the exact moment those people
have just been apologised for. `rsvpConfirmedHeading` therefore takes
`guests.length`, which has been the invitation's own membership since migration
0012 — the same number `rsvpChoiceCopy`, `rsvpDeadlineSentence` and
`RsvpAnswer`'s `soloGuest` already branch on, rather than a second notion of
"one person" invented beside them. Two tests hold it: the pure function is
asserted to take a membership and nothing about the answer, and
`RsvpAnswer.spec.tsx` accepts for a household of three with two boxes unticked
and asserts the heading is still plural — the only place the two numbers can
actually differ.

No exclamation marks and a vocative comma. "¡Te esperamos!" is shouted at
somebody who has just answered politely, and the rest of this surface is flat.

**THE GREETING HAD TO CHANGE OWNERS, AND THAT IS THE STRUCTURAL PART.**
"En vez de" — instead of, not underneath. The top line of this screen is the
same slot every other screen greets the household in, and that slot was painted
by `InvitationBody`: a Server Component sitting ABOVE the stepper, which cannot
see which of the four screens is showing. A Server Component cannot choose
between two lines it has no way to distinguish.

So the markup moved into `InvitationGreeting`, and the CHOICE of line moved to
`RsvpAnswer`, beside the `step` that decides it. `InvitationBody` grew one prop,
`greetingOwner`, defaulting to `"frame"`; the route passes `"step"` only while
the stepper is rendered, so a closed RSVP and the operator preview are
unchanged. The article's `gap-5 sm:gap-6` moved down one level onto
`.invitation__rsvp`, because the greeting and the screen under it are siblings
there now — which is why the geometry is identical rather than merely close.

**THE ALTERNATIVE WAS CONSIDERED AND REJECTED, AND IT WAS THE SMALLER DIFF.**
Leave the body's greeting where it is and hide it on this one step with a
`group-has-[[data-rsvp-step=confirmed]]:hidden` on the header. Two lines,
touching one file. It puts the household's name on the page TWICE and relies on
a stylesheet to keep one of them quiet — and the whole point of U34 was to move
things out of the tree rather than hide them. `RsvpAnswer.spec.tsx` asserts
there is exactly one `.invitation__greeting` on every screen, which is the
assertion that would have failed.

`greetingLine` came out of the same change. The gate and the invitation behind
it each spelled "¡Hola, <name>!" out for themselves; the stepper would have
been a third copy, so the sentence is written once in `lib/domain/greeting-name.ts`
and all three read it.

**THE MAP PICTURE IS DELETED, NOT HIDDEN, AND SO IS WHAT GUARDED IT.**
`img/venue-map.jpg` was 118,041 bytes of committed OpenStreetMap tiles with the
pin painted on. With the `<Image>` gone it had no consumer, so it went, and
`VenueMap` is now what survives of it: the coordinates, the derived
`maps/dir/?api=1` link, the accessible name and a full-width pill in
`StreamDetails`' own language. Same reasoning as `tools/og-font-coverage.spec.ts`
and `ceremony_date` — a thing whose premise has died is deleted rather than left
to be rediscovered.

**ITS GUARD WAS HALF ALIVE, AND ONLY THE DEAD HALF WENT.**
`tools/venue-map-asset.spec.ts` held five assertions. Three measured the FILE —
that it is the 1280×800 2x crop the labels on a phone depend on, that the
component imports that exact path, and a negative control against a
differently-shaped asset. Those describe something that no longer exists.

The other two guard the COORDINATES: that the venue's latitude appears in
exactly one source file, and exactly once inside it. That premise did not die
with the picture. It got slightly worse, in fact — the argument for one copy
used to be "the image and the link must agree", and there is no image to
disagree with now, so a wrong pin has nothing on the screen for a guest to catch
it against. The file is `tools/venue-coordinates.spec.ts`, renamed because it
now guards the destination rather than an asset, and it says in its own header
what it lost and why the rest stayed.

**AND `tools/jpeg-size.ts` FOLDED BACK INTO ITS ONE REMAINING CALLER.** It was
extracted in `97a146e` for a stated reason: `img/venue-map.jpg` had become a
second committed binary somebody measured, and a copied marker walk is two
decoders that agree until a bug is fixed in one of them. That reason is gone —
`tools/og-card-asset-budget.spec.ts` is the only caller again — so the parser
is back inside it, with the round trip recorded in its doc comment. A shared
module with one caller is a promise of reuse nothing keeps: the next reader
opens two files to follow one assertion, and the extraction's own comment goes
on naming an asset that no longer exists. If a third binary ever wants it,
moving it out again is the same commit it was the first time.

The same test ran the other way in this unit and came out the opposite way, which
is the point of stating the rule rather than the outcome. `declaredColor` — the
reader that pulls a colour back off a Tailwind class name — was written inside
`gate-legibility.spec.tsx` when the gate was the only surface whose words sat on
a photograph. This screen is the second, so it moved to
`lib/design/declared-color.ts`. One caller is a module nobody needs; two is a
module that earns itself.

**THE PICTURE LEFT AND TOOK 188 PIXELS WITH IT, WHICH WERE SPENT ON AIR.**
The screen is two groups pushed apart with `justify-between` rather than one
stack pushed to the bottom: what a household has to KNOW at the top under the
line that names them, what they have to DO at the foot under their thumb. The
emptied middle is where `PhotoStage`'s two scrims fade towards each other around
55%–62% — the brightest ground on the page, and now the part of it with no words
on it at all.

**AND THE ONE THING THAT MOVED ONTO A GROUND IT COULD NOT BE READ ON.**

Measured the way U35 measured the gate: the screen rendered at both phone
presets and at 1280×720, every glyph made transparent and every ground the
screen draws for itself removed, and the maximum WCAG relative luminance taken
from inside each element's own box. p95 was recorded beside each maximum; the
maximum is what is asserted, because it is the harsher floor and it is the one
the gate's spec already chose.

| line                           | brightest pixel | where     | before   | after |
| ------------------------------ | --------------- | --------- | -------- | ----- |
| `Te esperamos, <name>`         | #33350f         | 1280×720  | 11.08    | 11.08 |
| `Su respuesta quedó guardada.` | #2d2e0d         | 1280×720  | 6.99     | 8.36  |
| `CUÁNDO`                       | #3e4038         | iPhone 14 | 4.48     | 6.00  |
| the day and the hour           | #66684c         | iPhone 14 | 5.03     | 5.03  |
| `LUGAR`                        | #838380         | iPhone 14 | **2.96** | 6.07  |
| the venue's own name           | #656665         | iPhone 14 | 5.00     | 11.13 |
| `Cómo llegar`                  | #494539         | iPhone 14 | 6.35     | 13.33 |
| its edge (3:1, not 4.5:1)      | #494539         | iPhone 14 | **2.90** | 3.65  |
| `Volver a responder`           | #2e2621         | 1280×720  | 10.06    | 15.29 |

`LUGAR` is the finding. Pushed to the foot of an iPhone 14 it lands at 78%–84%
of the screen, over Luis's lit trouser leg, whose brightest pixel is #838380.
Cream on that measures **3.30:1 at FULL strength** — no opacity reaches 4.5, so
this was not a label that had been set too quietly. It needed a ground or a
different place to stand, and the couple had just said where it stands.

So the foot of the screen carries a card of its own, in the gate's language and
for the gate's reasons: painted rather than laid out, `absolute` with negative
insets and `-z-10`, so it costs no height on a screen whose whole promise is
that it is exactly one viewport tall. `isolate` on its parent is load-bearing
and its absence is silent — without a stacking context of its own a `-z-10`
ground paints below every positioned element including the photograph, and the
screen renders exactly as it did before with no error anywhere.

`bg-[#0d1114]/60` rather than the gate's `/70`, and the difference is measured:
the gate's panel sits at 60%–72%, in the gap where neither scrim carries
anything, and this sits low enough that the bottom one already does.

**THE TOP OF THE SCREEN HAS NO CARD, AND THAT IS ALSO A MEASUREMENT.** Every
line up there clears 4.5:1 on the bare photograph — the thinnest is the day and
the hour at 5.03:1. U35 recorded what a card costs on the gate: "the gate is no
longer a picture of the two of them." It is not a price worth paying twice on a
screen that is otherwise the couple and four short lines. The labels went from
`/60` to `/75` instead, which is what `CUÁNDO`'s 4.48 needed — thirty-six
thousandths under the line, and exactly the kind of number nobody catches by
looking.

**THE CONTROL'S EDGE IS THE OTHER HALF, AND IT IS A DIFFERENT THRESHOLD.** With
the picture gone, "Cómo llegar" is a bar rather than a 320×200 photograph of
Buga, and WCAG holds the boundary of a control to 3:1 because an invisible
control is not a contrast problem — it is a missing control. At the `/40` the
send button uses it measured 2.90:1 against the foot's ground; it is `/50` here,
at 3.65:1. The send button is deliberately not changed to match: it sits inside
the form's own panel, higher up the photograph, with a heading and a list and a
deadline around it. This one is alone at the foot of the last screen.

**WHAT WAS KEPT AGAINST THE LIST, AND IT IS THE COUPLE'S TO OVERRULE.**
"Su respuesta quedó guardada." is not among the four things they named. It
stays, one line of `text-sm` directly under the heading, because a confirmation
screen that never says anything was confirmed is the one failure on this page a
guest cannot recover from on their own — and the screen has the room. Deleting
it is one line if they disagree.

**RED, QUOTED.** `confirm-legibility.spec.tsx` was forced to fail in both of
the ways it exists to catch. With the foot's ground weakened to `/25`:

    × reads .rsvp__venue dt on that ground — `LUGAR`, which is why this
      ground exists
    AssertionError: expected 3.611091032934468 to be greater than or equal to 4.5

    × draws an edge that can be seen against the ground it sits on
    AssertionError: expected 2.4903114469756296 to be greater than or equal to 3

and with the labels put back to the `/60` they shipped at:

    × reads .rsvp__when dt on the bare photograph — #3e4038
    AssertionError: expected 4.476597291586587 to be greater than or equal to 4.5

It also carries its own permanent negative control — one assertion measures
`LUGAR` against the same pixel WITHOUT the card and requires it to be UNDER
4.5:1, so an assertion that only ever ran with the card in place cannot sit
green after the card stops being needed.

**GREEN.** `npm test` 2,445 unit and component tests, of which the 2,432
outside `lib/server/guest-directory.spec.ts` all pass (2,403 in total at
`5d8622f`). The total moves by one between runs and the count outside that file
does not, which is the same local database saying so twice. `npm run typecheck`,
`npm run lint` (0 errors, 8 warnings — the same eight, all in files this unit
did not touch), `npm run format:check`, `npm run build`.
Every step of the invitation still measures 1.00 on both phones for a household
of three and of five, and the one-screen spec now also asserts that the line
naming the household is on the screen with the rest and that the two groups
really are at the two ends of it.

**NOT GREEN, AND STILL NOT THIS UNIT'S DOING.** The same eight
`lib/server/guest-directory.spec.ts` failures U35 recorded, and the same
`e2e/console-guest-directory.spec.ts` failure, from the same cause — which has
got worse rather than better: the local Supabase now holds 807 invitations and
1,409 `invitation_guests` rows. Confirmed directly this time rather than
inferred, by asking PostgREST for the table and reading its own answer:

    Content-Range: 0-999/1409
    rows returned: 1000

and confirmed as the cause by temporarily adding a `.limit()` to
`listGuestDirectory`, which moved the failure from the spec's second test to its
third and back again between runs — a page of 1000 unordered rows out of 1409
catches a different fixture each time. The probe was reverted. Run around that
one file, all 211 tests outside it pass: `chromium`, all 8 on `iphone-14`, all 8
on `pixel-7`, all 16 of `wedding-facts`.

### U37 — done (every block to an end of its screen, and four ways back deleted)

**WHAT WAS ASKED, AND THE ONE REASON GIVEN FOR ALL OF IT.** The couple read the
live flow on a phone. Every item on their list is a move, and the reason is the
same each time: the blocks sat over the middle of the photograph and covered the
two of them.

| screen        | before                               | after                                      |
| ------------- | ------------------------------------ | ------------------------------------------ |
| gate          | everything centred, 56%–86%          | announcement at the top, form at 66%–96%   |
| the question  | card 57%–96%, deadline inside it     | card 57%–91%, deadline below it at 93%–96% |
| who is coming | card bottom-justified, 36%–96%       | card 14%–68%, way back at 93%–96%          |
| the accepted  | receipt line and a way back          | neither                                    |
| one person    | a third screen flashed for a request | no third screen                            |

Bands are an iPhone 14 (390×664); the "before" column was measured against a
build of `19d67f2` rather than remembered, which matters because one of those
numbers contradicts what this document already said. More on that below.

**THE COPY, AND THE ONE PLACE IT ARGUES WITH ITSELF.** The affirmative is
`¡Sí, acepto!` — the couple's own string, with the opening mark that every other
exclamation in this product carries. It is now ONE line whatever the size of the
invitation, and that reverses half of a decision they made in an earlier pass.
`rsvpChoiceCopy` exists because a guest invited alone was being made to answer
"Sí, allá estaremos" on the one page addressed to them by name: "the couple asked
for both voices", in that function's own words. The refusal still has both
voices. So a household of three is now asked "¿Podrán acompañarnos?" and offered

    ¡Sí, acepto!
    No podemos acompañarlos

which mixes the singular and the plural inside one question. It is written down
here and in `rsvp-copy.ts` rather than smoothed over, because smoothing it would
have meant inventing "¡Sí, aceptamos!", which nobody asked for. **One line in
`rsvp-copy.ts` if the couple want the voices to agree again.**

**THE FOUR WAYS BACK THAT ARE GONE, AND WHAT EACH ONE COST.**

- **The gate's escape hatch.** "¿No puedes entrar? Escríbenos por WhatsApp" was
  a `wa.me` draft addressed to the invitation's owning sender. A household whose
  number is not the stored one now has nothing on the page to press. They still
  hold the WhatsApp thread the invitation arrived in; the page no longer says
  so.
- **The accepted screen's `Volver a responder`.** An accepted answer cannot be
  changed from inside the invitation at all. Responses are still append-only and
  the console still shows whatever is stored, but a household that ticks three
  people and then loses one is back to WhatsApp.
- **The receipt line.** "Su respuesta quedó guardada." U36 kept it against the
  couple's list and said in as many words that it was theirs to overrule.
- **The third screen, for a one-person invitation.** Not a way back, but the
  same kind of removal: one tap now records and lands on the directions with
  nothing in between.

Taken together that is every way back except one. **The DECLINED screen keeps
its own `Volver a responder`**, and that was verified rather than assumed:
`CeremonyStream` owns it, it has never been the same element as the accepted
screen's, and `CeremonyStream.spec.tsx` still asserts it positively. The
asymmetry now has a reason worth stating — a decline auto-submits on the first
tap, so a mis-tap is recorded instantly and the escape sits beside the
consequence; an acceptance passes through a send button, which is the check this
ending has and that one does not.

**WHAT THE REMOVAL MADE UNREACHABLE, WHICH IS MORE THAN THE BUTTON.** With no
path from a recorded acceptance back to the form, two pieces of `RsvpAnswer`
have no way of being reached: the branch of `currentRsvpSentence` that reports
an attending answer, and the seeding of `selected` from `current.attendeeGuestIds`.
Both are KEPT rather than deleted, and the reason is in the component: what made
them unreachable is one button the couple may put back, and the seeding is what
stops a re-offered form quietly re-adding somebody who cannot come. Four tests
that reached the form through that button are gone from `RsvpAnswer.spec.tsx`,
replaced by one that asserts the absence and a comment naming what went with
them.

**WHAT THE ONE-PERSON FLOW ACTUALLY DID BEFORE, SINCE THE BRIEF ASKED.** Neither
"already skips it" nor "requires a second tap": it rendered the step and then
left it. `acceptNow` sets the answer and submits from an effect, so no second tap
was ever needed — but `step` was derived as `attending === "yes" ? "attendees"`,
so for the length of the Server Action the guest saw a card holding one hidden
field, a send button pressing itself, and a way back. A flash of a screen that
exists for a choice this household does not have. The affirmative submits from
the QUESTION screen now, exactly as a decline already did, and the hidden
`attendee` field came with it so the payload is byte for byte the one the third
screen used to send.

That one needed a test that could see a single frame. `waitFor(confirmedScreen)`
was already green against the old behaviour and says nothing about what was on
the screen in between, so the test holds the Server Action open with an
unresolved promise, asserts, and then releases it. **Releasing it is not tidiness**
— an action left unsettled keeps React's transition open and the next twelve
tests in that file stop seeing their own updates, which cost twenty minutes.

**AND THEN THE MEASUREMENT FOUND SOMETHING OLDER THAN THE MOVE.**

The brief was explicit that moving a block changes what is behind it, and that
fixtures sampled at the old positions had to be re-sampled rather than trusted.
Two of the three re-samples were routine. The third was not.

U35 recorded, in prose and without a number: "it is also why the panel on the
question screen has been fine at `bg-black/25` since U34: it sits at 70%–95%,
where the bottom scrim is already carrying 60% to 90% of the load."

Both halves are wrong. Measured against a build of `19d67f2`, on an iPhone 14:

| claim                        | prose   | measured |
| ---------------------------- | ------- | -------- |
| where the question's card is | 70%–95% | 57%–96%  |
| cream on it, worst pixel     | "fine"  | 2.5:1    |

57% is across the gap between `PhotoStage`'s two scrims, over the #FAF8EF edge of
Michell's dress at 62% — 0.937 luminance, the brightest pixel in the frame, and
the exact pixel U35 gave the GATE a card for twenty minutes after U34 shipped.
The card that was supposedly fine was carrying a quarter of the black the gate's
needed. This pass moved it to 57%–91% and the list of who is coming to 14%–68%,
which took the reading from 2.5:1 to 1.7:1 against a 4.5:1 floor.

So: **the defect is older than the move, the move made it worse, and nothing
would have caught either** — there was no spec for these two screens at all, and
the claim that there did not need to be was the prose above.

The fix is the gate's own ground below `lg`, `bg-[#0d1114]/70`, at 6.4:1 against
the same pixel, and the four quiet opacities that sat on it came up with it:

| element                      | before | after | why             |
| ---------------------------- | ------ | ----- | --------------- |
| `.rsvp__current`             | /75    | /80   | 4.45:1 → 4.81:1 |
| `.rsvp__seats`               | /70    | /80   | 4.11:1 → 4.81:1 |
| `(niño o niña)`              | /60    | /70   | 4.22:1 → 5.11:1 |
| the send button's edge (3:1) | /40    | /60   | 2.40:1 → 3.47:1 |

`lg:bg-black/25` puts the desktop back exactly as it was: above the breakpoint
the words are in their own column beside a framed print, the brightest pixel
under the card is #2F271F, and the old value already measures 5.8:1 there.
`declaredColor` reads the unconditional token and skips the variant, so what the
spec measures is the phone, which is where this is read.

**THE THIRD LEGIBILITY SPEC, AND ITS NEGATIVE CONTROL.**
`app/i/[slug]/step-legibility.spec.tsx` joins the gate's and the accepted
screen's. Eleven of its fifteen assertions were forced red against the ground it
replaced:

    × is deep enough to read cream on the brightest pixel it covers
    AssertionError: expected 1.6999783869805252 to be greater than or equal to 4.5

    × reads the two answers on the row they sit in
    AssertionError: expected 2.421364418841415 to be greater than or equal to 4.5

    × draws an edge that can be seen against the card it sits on
    AssertionError: expected 1.3920111461611409 to be greater than or equal to 3

and it carries a permanent one: an assertion that `bg-black/25` over the same
pixel is UNDER 4.5:1, so putting the old ground back cannot sit green.

**THE OTHER TWO RE-SAMPLES, WHICH WENT THE OTHER WAY.**

- The gate's fixture is UNCHANGED at #FAF8EF and that is the interesting part.
  At rest the panel now covers 66%–96% and the brightest pixel inside it is
  #DEC799. The fixture stays harsher because this card is bottom-anchored and
  grows upward: the refusal line is reserved for one line, a real refusal is two
  sentences and wraps to three or four on a narrow phone, and that lifts the top
  of the card back over the 62% mark. The state a guest most needs to read it in
  is the state that puts it back on the brightest pixel in the frame.
- The accepted screen's fixtures all got DARKER, because losing two lines
  shortened both of its groups: the day and the hour rose to 14%–19% and the
  place and the button fell to 81%–96%. `#3E4038` became `#282911` under
  `CUÁNDO`, `#66684C` became `#2E2F27` under the day and the hour, and the foot
  went from `#838380` to `#535453` inside its own box.

  **The foot's fixture is deliberately not that number.** At `#535453`, `Lugar`
  clears 4.5:1 WITHOUT the card by two percent, which would have retired U36's
  negative control on an argument that does not hold: where that group sits
  depends on how many lines the venue's NAME takes, and the couple have not
  filled that field in — production still renders `{{VENUE_NAME}}`. One line
  more and the group is back at 78%, on Luis's lit trouser leg. So the fixture
  is the brightest pixel in the bottom quarter of the screen, `#8A8985`, which
  is slightly harsher than the number U36 wrote down rather than softer.

**GEOMETRY, WHICH IS WHAT THE WHOLE REDESIGN IS HELD TO.** Every step, on both
phones, for a one-, three- and five-person invitation, measured on the shipped
build:

| device          | gate | question | who is coming | accepted | declined |
| --------------- | ---- | -------- | ------------- | -------- | -------- |
| iPhone 14 (664) | 664  | 664      | 664           | 664      | 664      |
| Pixel 7 (839)   | 839  | 839      | 839           | 839      | 839      |
| 1440×900        | 900  | 900      | 900           | 900      | 900      |

Five people is the tightest and it is 1.00 on both phones. `ff8af29`'s guard is
unchanged and not loosened; it grew two assertions instead — the gate's two
groups are at the two ends of the screen, and on the screen that asks who is
coming the card is in the top quarter while the way back is in the bottom one.

**ONE NUMBER THAT IS NOT 1.00, AND IT IS NOT THIS PASS'S.** At 1280×720 the
question screen is 768 tall. Measured at `19d67f2` it was 772, so this pass made
it four pixels better and left it over. It is a desktop window shorter than the
content of one step; the one-screen guard is a phone guard by construction and
the couple's own review was on a phone. Recorded rather than fixed here.

**AND A TRAP IN THE MEASUREMENT ITSELF, WORTH THE PARAGRAPH.** The harness makes
every glyph transparent and removes every ground the screen draws for itself,
then reads the photograph underneath. Twice it lied. The first time the native
radios and checkboxes came back as pure white — `#FFFFFF`, brighter than
anything in the picture — because `color: transparent` does not touch a control
the browser paints itself. The second was subtler: `.rsvp__venue-map` and
`.rsvp__back` carry `transition-colors`, so injecting the stripping stylesheet
started a fade and the screenshot caught the words halfway out, reading them
back as their own background. `transition: none` and `visibility: hidden` on
inputs and SVGs fixed both. A contrast number is only as good as the proof that
the shot contained no ink.

The third trap cost the most and was not about colour at all: a stale `next
start` still holding port 3210 meant a rebuilt app was being measured through an
old server whose asset hashes no longer resolved. The page rendered as the
blurred backdrop and nothing else, the figure measured zero pixels tall, and
Playwright reported the photograph intercepting clicks on the submit button —
which reads exactly like a layout regression. `lsof -ti tcp:PORT` before
trusting a number.

**RED, QUOTED, FOR THE REST.** The layout assertions were written against the
shipped screens and forced to fail:

    × how the gate is composed on a phone > pushes its two groups to the two ends
    expected '\n        gate mx-auto flex min-h-dvh…' to contain 'justify-between'

and the one-frame test for the solo flow was proven able to fail by the shape of
its own construction: against an action that resolves immediately it is green
whatever the stepper does, which is why it holds the promise open.

**GREEN.** `npm test` 2,450 unit and component tests, of which the 2,442 outside
`lib/server/guest-directory.spec.ts` all pass (2,445 at `19d67f2`).
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings — the same eight, all
in files this unit did not touch), `npm run format:check`, `npm run build`.

**NOT GREEN, AND STILL NOT THIS UNIT'S DOING.** The same eight
`lib/server/guest-directory.spec.ts` failures U35 and U36 recorded, and the same
`e2e/console-guest-directory.spec.ts:104`, from the same cause: the local
Supabase holds more `invitation_guests` rows than PostgREST will return in one
unpaged page, so a freshly seeded fixture falls outside the first thousand.
`PORT=3100 npx playwright test` therefore reports 192 passed, 1 failed and 42
not run — that file's serial describe aborts and takes the `wedding-facts`
project's dependency with it. Run around that one file, **207 of 207 pass**,
which is the 211 U36 recorded minus the four browser tests this unit deleted
with the recovery link and the accepted screen's way back.

**THE WORK UNITS.** `484565d feat(invitation): give the middle of the gate back
to the couple` — the gate, the deleted recovery chain and its specs, verified
green on its own before the rest was staged. `1e460f8 feat(invitation): move the
three answering screens off the couple's faces` — the question, the list, the
confirmation, the solo flow and the card's ground. Two rather than five, because
the five changes interlock through three shared files: `RsvpAnswer` carries
three of them, and two browser specs carry four.

### U38 — done (two answers became two buttons, and three cards became one card)

**WHAT WAS ASKED, IN THREE MESSAGES, AND ONE OF THEM REVERSED THE ONE BEFORE.**
The couple read the question screen on a phone after U37 shipped.

| #   | their words                                                                                         | what it became                                             |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | "este componente es muy ancho debe ocupar el ancho de las dos respuestas"                           | the card was rebuilt twice — see below                     |
| 2   | "deberian ser como dos botones"                                                                     | the radio group is two buttons                             |
| 3   | "esto deberia quedar como en la primera pagina en cuanto al ancho para que se mantenga la misma ui" | the card is the GATE's card, to the pixel                  |
| 4   | "el componente debe quedar abajo pegado a la fecha de confirmación"                                 | nothing stands between the card and the deadline           |
| 5   | "el maximo de personas por invitacion es de 4"                                                      | the geometry guard measures 1, 2 and 4 — and 5 as a canary |

Plus one excess nobody named: **76 pixels of empty card below the second
answer** on an iPhone 14, measured — the gap above the reserved refusal slot,
the slot's own 40 pixels, and the card's bottom padding. A band the height of
another answer, under every question nobody has got wrong yet.

**THE WIDTH WAS BUILT TWICE, AND THE FIRST ONE WAS WRONG.** "Debe ocupar el
ancho de las dos respuestas" was read as _hug the content_: `w-fit`, which
made the card 291 pixels — narrower than the gate's 374 — and the couple's
next message was about that. The answer to "the card is too wide" turned out
to be "the card is the wrong width", and the reference was the screen one tap
earlier all along. Recorded rather than quietly replaced, because the second
instruction only makes sense beside the first.

**THE GATE'S MEASURE IS TWO NUMBERS, NOT ONE**, which is why matching it by
eye would have failed. `InvitationGate` paints its ground as an absolute layer
at `-inset-x-4`, so on an iPhone 14 its card runs 8→382 (374 wide) while the
field and `Ver la invitación` inside it run 24→366 (342). A card that matched
only the outer number would have put its controls 16 pixels off the gate's;
one that matched only the inner number would have been a visibly narrower
card. `-mx-4 px-4` lands on both, and `e2e/invitation-one-screen.spec.ts`
measures the question's card against the gate's own boxes rather than against
374, so the two cannot drift apart while the assertion stays green.

Measured on the shipped build, iPhone 14, all four household sizes:

| screen        | card      | its controls |
| ------------- | --------- | ------------ |
| gate          | x=8 w=374 | x=24 w=342   |
| the question  | x=8 w=374 | x=24 w=342   |
| who is coming | x=8 w=374 | x=24 w=342   |

**TWO BUTTONS, AND WHAT THAT RETIRES.** A radio describes a selection that a
later submit will send, and that stopped being true when the question became a
screen of its own: the negative records a decline on the spot, the affirmative
opens the list of who is coming, and for an invitation naming one person it
records the acceptance too. The markup had been describing something the
product no longer did.

**IT CLOSES U28'S RECORDED DEFECT, MEASURED RATHER THAN ASSUMED.** That entry
says, in as many words: "Both radios answer on `change`, so a keyboard user
arrowing through the group passes over the first option and answers it. That
shape predates this work — the decline has always had it — and it is
recoverable from either side. Named here so it is a decision rather than an
oversight." It was worse than _recoverable_: arrowing onto the refusal
RECORDED a decline, because a decline submits on the first answer. A keyboard
user exploring the group answered on the household's behalf.

Buttons have no such behaviour, and `RsvpAnswer.spec.tsx` proves it rather
than asserting that the markup changed: a test tabs onto the affirmative,
presses `ArrowDown`, `ArrowUp`, `ArrowRight` and `ArrowLeft`, tabs to the
refusal, arrows again, and then asserts the Server Action was never called,
the stream screen never appeared and no radio exists in the document at all.
A second test presses `Enter` on the affirmative and asserts the list opens.
**U28's open limitation is closed by this unit.**

**THE CONTROL LANGUAGE COLLAPSED FROM TWO INTO ONE.** The answers were a
bordered row and the send button a pill; with the radio gone the row IS the
control, so both are now `PILL` — `StreamLink`'s pill, already the
guest-facing control on `/` and `/transmision`. That has a measured
consequence: `step-legibility.spec.tsx` used to explain in a comment why the
choice rows were exempt from WCAG 1.4.11's 3:1 control-edge floor ("the
control is the native radio… the row is the tap target around it"). The
exemption died with the radio. The answers' edge is `border-[#f6efe2]/60`,
measured at 3.46:1 against the card over the worst pixel it covers, and the
row's old `/20` is now a permanent negative control at 1.59:1.

**WHERE THE REFUSAL'S 40 RESERVED PIXELS WENT, AND WHY THEY DID NOT DIE.** The
reservation is U34's and it is not negotiable: an alert that mounts on submit
adds 82 pixels with no warning to a screen whose promise is that it is exactly
one viewport tall. What changed is where the space is held, and the two asking
screens now differ because they are anchored to opposite ends:

- **The question's card is at the foot**, so the slot is ABOVE it. A refusal
  grows upward into the empty middle of the photograph and neither the card
  nor the deadline moves a pixel.
- **The list of who is coming is at the top**, so its slot is BELOW it, beside
  the send button that was just refused, growing downward.

Up there the slot lands at 58%–64% of an iPhone 14, across the #FAF8EF edge of
Michell's dress at 62%, where unbacked cream is **1.1:1**. So a refusal is
painted onto the card's own ground when it has something to say — 6.4:1
against that same pixel — and onto nothing at all when it does not, because an
empty dark bar floating over the couple is the defect this pass removes, not a
place to put it back. Both are measured, including a negative control that
fails if anybody gives the slot the deadline's bare-photograph treatment.

**THE CARD'S FIXTURE WAS RE-SAMPLED AND GOT HARSHER.** The card moved from
57%–96% to 66%–91% and grew 32 pixels wider, so the pixels behind it changed
twice over. A card that low could easily have stopped covering the worst pixel
in the frame, which would have quietly retired the negative control that says
`bg-black/25` is not a ground.

It did not, and the state that proves it is not the resting one:

| state                      | band, iPhone 14 | worst pixel       |
| -------------------------- | --------------- | ----------------- |
| the question, fresh        | 66%–92%         | `#CDC7A5` (0.565) |
| after "Volver a responder" | 61%–92%         | `#FAF8EF` (0.937) |
| with a refusal showing     | 63%–94%         | `#FEFCF0` (0.970) |

The card is bottom-anchored and grows UPWARD: the line naming an answer
already on file is 36 pixels that put its top back across the dress edge. That
is the same argument `gate-legibility.spec.tsx` makes for keeping the gate's
fixture, and `BRIGHTEST_UNDER_THE_CARD` is now **#FBF9F0** (0.9455, the
reconsidering state) rather than #FAF8EF. Every floor still clears with the
harsher number: the question 6.41:1, the answer labels 5.06:1, the answer
edges 3.46:1, the line naming the current answer 4.79:1, and the negative
control 1.69:1 — still under 4.5:1, so putting the old ground back cannot sit
green.

**THE SELECTION COUNT IS GONE, AND SO IS THE FUNCTION BEHIND IT.** "Ya
seleccionaron las 3." existed to explain the moment the remaining checkboxes
freeze. Migration 0012 had already taken its subject away: the cap became the
MEMBERSHIP, so every box is a member, they all arrive ticked, and unticking
one always leaves room — the "N more" half was unreachable and the "all
selected" half was the first thing every household read. `seatsSelectionSentence`
had exactly one caller, so it went with the line, and its four spec assertions
with it. `currentRsvpSentence` STAYS: that one reports an answer already on
file, which is a fact a guest cannot see anywhere else.

**THE AFFIRMATIVE IS SETTLED, NOT HEDGED.** U37 left this open — "One line in
`rsvp-copy.ts` if the couple want the voices to agree again" — and so did the
function's own doc comment. It was put to them: a household of four is
addressed in the plural and answers in the singular. **Asked and confirmed:
`¡Sí, acepto!` stays, for every invitation whatever its size.** Both hedges
are rewritten to say so, because a settled decision that reads like an
oversight is one a later reader tidies away.

**GEOMETRY.** Every step, both phones, on the shipped build:

| device          | gate | question | one person | accepted | declined |
| --------------- | ---- | -------- | ---------- | -------- | -------- |
| iPhone 14 (664) | 664  | 664      | 664        | 664      | 664      |
| Pixel 7 (839)   | 839  | 839      | 839        | 839      | 839      |

The three screens that ask who is coming are the exception, and a chosen
one: see the announcement's return below.

`ff8af29`'s guard is unchanged in kind and grew three cases: a household of
two, an invitation naming one person (which has no attendee screen at all),
and the width assertion that ties this card to the gate's. Its fixtures are
now **one, two and four** — "el máximo de personas por invitación es de 4" —
with five kept as a canary, for the reason in the next section.

**ONE STATE THAT IS NOT 1.00, AND IT IS A COMPOUND ONE.** A household that
declined, pressed "Volver a responder", and then had the second answer REFUSED
by the server measures 680 pixels on an iPhone 14 — 16 over. It is the only
state on the screen that carries both the line naming the current answer (36
pixels) and a two-line refusal (61 where 40 are reserved). The guard has never
measured it, and this pass did not cause it: the group is strictly shorter
than it was — the count line went (−24), and the group's gap went from `gap-3`
to `gap-2` (−4) — so the same state was at least 20 pixels worse before.
Recorded rather than fixed: everything on it stays reachable, and the fix is
either a bigger reservation or a shorter refusal, both of which are copy or
product decisions.

The `gap-2` itself is a measurement rather than a preference. At `gap-3` the
reconsidering state — the card 36 pixels taller — came to 667 on a 664-pixel
screen. The two gaps this group spends are the cheapest four pixels on it.

**THE ANNOUNCEMENT WENT BACK ON THE SECOND SCREEN, WHICH REVERSES U37, AND IT
DOES NOT FIT.** This is the one part of the pass with a cost the couple paid
knowingly.

U37 had put the list of who is coming at the TOP of its screen and left the
announcement off it, on their own instruction — "los bloques quedan sobre la
mitad de la foto y nos tapan" — and on U34's arithmetic: the announcement is
250 pixels the screens after the question must not pay for. They changed their
minds, and the reason outranks both: **"sin importar que se lleguen a tapar
las dos personas de la foto, porque sino despues de aceptar esa pagina de
escoger las personas se ve extraña."** Pressing "¡Sí, acepto!" used to throw
the announcement away and jump the card from the foot of the screen to the top
of it; the screen a household lands on is the screen they just left now, with
the list where the answers were.

So all three asking screens are one shape: **the announcement above, the card
below it, one small line beneath the card** — the deadline on the question,
"Volver a la pregunta" on the list.

**THE MEASUREMENT CAME FIRST, AND IT WAS PUT TO THEM BEFORE ANYTHING WAS
BUILT.** Every term measured on the shipped build, iPhone 14, 664 pixels:

| term                                  | pixels  |
| ------------------------------------- | ------- |
| top padding                           | 20      |
| the greeting, two lines               | 50      |
| the article's gap                     | 20      |
| the announcement group                | 236     |
| the form's gap between its two groups | 24      |
| bottom padding                        | 28      |
| **left for the card group**           | **286** |

| household          | its card | + slot 40, gaps 16, way back 16 | over 286 by |
| ------------------ | -------- | ------------------------------- | ----------- |
| two                | 230      | 302                             | 16          |
| four (the ceiling) | 338      | 410                             | **124**     |
| five (the canary)  | 392      | 464                             | 178         |

And what each candidate would free, measured the same way:

| candidate                                   | pixels freed |
| ------------------------------------------- | ------------ |
| the countdown, with its gap                 | 74           |
| the greeting "¡Hola, <name>!", with its gap | 70           |
| "Nos casamos", with its gap                 | 60           |
| the date line, with its gap                 | 40           |
| the hairline rule, with its gap             | 25           |
| the reserved refusal slot                   | 48           |
| "Volver a la pregunta"                      | 24           |

Any two of the first three clear a four-person list. The couple's answer: **"no
saques nada todavia haz los cambios y yo creo una invitacion de 4 personas
para ver como queda."** They want to see the overflow before choosing what to
lose. Nothing was trimmed, no target shrunk, no row compressed.

**WHAT THE SCREEN ACTUALLY DOES NOW, MEASURED ON THE SHIPPED BUILD:**

| household | iPhone 14 (664)       | Pixel 7 (839)   |
| --------- | --------------------- | --------------- |
| two       | 681 — over by 17      | 839 — fits      |
| four      | 789 — **over by 125** | 839 — fits      |
| five      | 843 — over by 179     | 843 — over by 4 |

The predictions above were 16, 124 and 178; the built screens are 17, 125 and 179. Every other step, at every household size, on both phones, is still 1.00.

**AND THE GUARD ASSERTS THE OVERFLOW RATHER THAN EXCUSING IT.** Three
reactions were available and all three are worse than the number:

- leaving `main` red, which is how a suite stops being read — this branch
  already carries eleven environmental failures doing exactly that damage;
- deleting or loosening the attendee cases so they quietly pass, which is a
  guard that has stopped asking;
- a `skip` with no number, which rots into "forgotten".

So `CHOSEN_OVERFLOW` in `e2e/invitation-one-screen.spec.ts` holds the measured
excess per step per viewport, and the three cases assert it **within six
pixels, in both directions**. It fails if the overflow grows — something got
bigger that nobody asked for — and it fails if the overflow shrinks or goes
away, because then the recorded number is stale and the case belongs back on
`expectOneScreen`. The failure message says which of the two happened and what
to do. Proven falsifiable rather than assumed: setting the four-person entry
to 60 produces

    Error: attendees (4): this screen is meant to overflow by 60px and now
    overflows by 125px

The other two assertions are unchanged for these cases — the document is still
never WIDER than the window, and the send button must still be reachable: the
test scrolls to it and then requires it to be inside the viewport, which is
what catches a container that clips instead of scrolling.

**WHEN THE COUPLE CHOOSE, THE TABLE GOES** and those three cases return to
`expectOneScreen`. That sentence is in the spec beside the numbers, not only
here.

**THE CARD'S FIXTURE WAS RE-SAMPLED A THIRD TIME, AND GOT HARSHER AGAIN.**
Moving the list to the foot put a card over the brightest ground any card has
covered in this product: **#FFFDF4, 0.9804** on an iPhone 14 — the lit edge of
Michell's dress, nearly pure white — under a two-person list running 60%–95%.
The sequence across this one pass, each measured on the shipped build at both
phone presets:

| when                                       | fixture   | luminance |
| ------------------------------------------ | --------- | --------- |
| the question's card at 57%–96%             | `#FAF8EF` | 0.9369    |
| after it took the gate's width, at 66%–91% | `#FBF9F0` | 0.9455    |
| after the list came down to the foot too   | `#FFFDF4` | 0.9804    |

Every floor still clears against the worst of the three, which is what
`BRIGHTEST_UNDER_THE_CARD` now holds: the question 6.29:1, the answer labels
4.98:1, the answer and send edges 3.42:1, a member's name 7.08:1, the child
marker 5.02:1, the line naming the current answer 4.72:1 — and the negative
controls at 1.63:1 and 1.58:1, still failing as they must. Two rather than
four people is the harshest case because a four-person card starts at the same
60% and runs past the fold, so its extra rows only cover darker ground further
down.

**AND NOTHING ENFORCES FOUR, WHICH IS WHY THE CANARY STAYS.** Checked rather
than assumed:

- **The schema has no bound.** `invitation_guests` has no row-count constraint
  and no trigger that counts — the only trigger on it is
  `invitation_guests_clear_recipient_on_move` (0012). Migration 0012 made the
  seat cap `count(*)` of the members themselves, and 0013 dropped the column
  that had been the only one to carry an upper bound at all.
- **The console cannot refuse a fifth.** `DraftRefusal`
  (`lib/domain/invitation-draft.ts:49`) has no code for "too many members",
  and a refusal without a code cannot reach an operator — the form translates
  that union exhaustively, so an untranslated refusal is a compile error.
- **The importer does not count.** `scripts/import-guests.ts:212` sums members
  for its report and bounds nothing.

So four is how the couple's list happens to be written, not a guarantee the
layout can lean on. A five-person fixture stays in the guard as a documented
canary; the gap is in **Next** rather than papered over, and no enforcement
rule was invented here.

**RED, QUOTED.** The specs were written against the shipped screens and forced
to fail first:

    × answers nothing when a keyboard walks through the two answers
    TestingLibraryElementError: Unable to find an accessible element with the
    role "button" and name `/Sí, acepto/`

    × reserves the refusal below the card, not inside it
    AssertionError: expected <div role="alert" …(1)></div> to be null

    × reads the way back on the bare photograph
    Error: the step has no `.rsvp__attending .rsvp__answer`

63 of the 85 assertions in `RsvpAnswer.spec.tsx` and
`step-legibility.spec.tsx` were red before the component moved.

**GREEN.** `npm test` — 2,454 unit and component tests, 2,443 passing.
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings, the same eight in
files this unit did not touch), `npm run format:check`, `npm run build`.
`PORT=3100 npx playwright test` — 194 passed, and all 22 geometry assertions
green on both phone projects.

**NOT GREEN, AND COUNTED FRESH EACH TIME RATHER THAN QUOTED.** The brief for
this unit said eight environmental failures. It was **nine** when the first
half of the work was verified and **eleven** by the time the second half was,
and the count moved while nobody touched those files: the local Supabase
crossed PostgREST's unpaged 1000-row ceiling for one more table partway
through the day. Every number below was measured by running the suite on the
tree it describes.

| suite                           | without this work                | with it                                   |
| ------------------------------- | -------------------------------- | ----------------------------------------- |
| `npm test` (first half)         | 9 failed / 2,450                 | 9 failed / 2,453 — the same nine          |
| `npm test` (second half)        | 11 failed / 2,453                | 11 failed / 2,454 — the same eleven       |
| `PORT=3100 npx playwright test` | 188 passed, 2 failed, 45 not run | 194 passed, the same 2 failed, 45 not run |

Eight are in `lib/server/guest-directory.spec.ts` — the ones U35, U36 and U37
recorded. The other three are in `lib/server/invitations.spec.ts`
(`listConsoleInvitations` twice and `listSenderDirectory` once), and the
browser twin of the first is `console-guest-list.spec.ts:625`, which fails
only in a FULL run: the suite seeds invitations as it goes, so the row count
crosses the ceiling partway through. Same defect, three tables further along
than it was — the local database holds more rows than an unpaged `.select()`
returns, so a freshly created row falls outside the first thousand. Not fixed
here and not reset; it is the same entry already in **Next**, and it is now
doing the damage that entry predicted: eleven red tests nobody reads is how a
real failure gets through.

### U39 — done (the screen a household reaches by saying no)

**WHAT WAS ASKED.** Four changes to the declined screen, and one of them was
already built somewhere else.

| #   | asked                                                                               | done                                             |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | the greeting becomes "Los vamos a extrañar, {name}" / "Te vamos a extrañar, {name}" | `rsvpDeclinedHeading`, beside its twin           |
| 2   | delete the "Los esperamos por Google Meet" heading                                  | gone; the screen has no `h2` at all now          |
| 3   | the stream block goes to the TOP, the way back stays at the foot                    | two groups, one at each end                      |
| 4   | add "Agregar a Google Calendar"                                                     | shared out of `/transmision` rather than rebuilt |

**THE TWO ENDINGS ARE A PAIR NOW, IN THE DOMAIN AND ON THE SCREEN.** The
accepted screen has said "Los esperamos, {name}" in the greeting's place since
U36. The declined screen kept "¡Hola, {name}!" and put "Los esperamos por
Google Meet" underneath it: two headings, one of which greeted and neither of
which said the thing the screen is for. `rsvpDeclinedHeading` sits directly
beside `rsvpConfirmedHeading` in `rsvp-copy.ts` — same `memberCount`
boundary, same vocative comma, same flat register, no exclamation marks — and
`rsvp-copy.spec.ts` asserts the pair rather than the line: both turn singular
at the same place, and a change to either that leaves the other behind is
red.

The heading inside `CeremonyStream` is gone, and its spec asserts the absence
— `queryByRole("heading")` is null — so a card that grows its own heading back
puts two on the screen again and is caught.

**THE CALENDAR ENTRY IS BUILT ONCE, WHICH IS THE WHOLE OF ITEM 4.**
`/transmision` had the button: the route composed
`googleCalendarUrl(buildStreamCalendarEvent(...))` and passed a `googleHref`
down to `StreamInvitation`, which drew it. The declined screen renders
`StreamDetails` and had no calendar of any kind.

Two routes building one calendar entry is the failure
`components/landing/photos.ts` argues against for the photographs — "two
different weddings" — with a date attached: two screens offering the same
wedding at two different times, and the guest who took the wrong one finds
out on the day. So the entry moved INTO `StreamDetails`, which both surfaces
already render, built from the row it already receives and the same
`WEDDING_INSTANT` the countdown runs on. `buildStreamCalendarEvent` and
`googleCalendarUrl` are untouched and still hold their own spec; nothing
about the URL is hand-rolled.

What that cost, stated: `StreamDetailsValues` gained `coupleNames` — the
entry's title is "Matrimonio de {coupleNames}" — so both routes now pass two
fields of the same row instead of one. The alternative was reading
`COUPLE_NAMES` from the domain inside the block while every other surface
reads the row, which is two sources for one wedding's name.

`StreamInvitation` lost its `calendar` prop entirely, and its spec stopped
asserting that a string it was handed came back out. It asserts the entry is
for THIS wedding instead: Google's own endpoint, `action=TEMPLATE`, the
couple's names in `text`, and the stream address in `details`.

AND THE ENTRY ONLY EXISTS WHEN THERE IS SOMEWHERE TO GO. The description
carries the address, so an unfinished row would write the seeded placeholder
into somebody's calendar as the joining link — a reminder that looks correct
for months and fails on the one morning it is read. `/transmision` used to
render the button unconditionally; it does not any more, which is a change to
that page nobody asked for and the right one.

**AND THEN THE MEASUREMENT FOUND THREE THINGS, WHICH IS WHY THIS SCREEN NOW
HAS A SPEC.** It was the last screen of the invitation with no legibility
file — `app/i/[slug]/stream-legibility.spec.tsx` is the fourth, after the
gate's, the accepted screen's and the two asking screens'. Moving the stream
block to the top put it exactly where U37 measured the gap between
`PhotoStage`'s two scrims: the top one has faded out, the bottom one has not
started, and the photograph is carried by nothing.

| element                       | was         | measured   | now                            |
| ----------------------------- | ----------- | ---------- | ------------------------------ |
| the welcome paragraph         | `/85` cream | **4.15:1** | full cream, 5.03:1             |
| the two stream controls' edge | `/30`       | **1.77:1** | `/60` on `bg-black/40`, 3.62:1 |
| the way back's edge           | `/30`       | **2.52:1** | `/60`, 5.02:1                  |
| the sentence at the foot      | `/70`       | **4.48:1** | `/85`, 5.32:1                  |

The paragraph is the sentence that tells a household the couple understand.
It was under the floor, in the brightest band of the screen, and nothing
would have said so. Two of the fixes carry permanent negative controls:
`/85` on the paragraph's pixel is asserted to FAIL 4.5:1, and `/30` on the
controls' ground is asserted to fail 3:1.

THE LAST ROW OF THAT TABLE ONLY EXISTS BECAUSE THE FIXTURES WERE SAMPLED
TWICE. Declaring `min-h-11` on the three controls — the fix below — moved
everything under them by a few pixels, which took the foot's band from
#504A3D to #4F4F4E and the sentence from 4.73:1 to 4.48:1. Two hundredths
under the floor, found only because the screen was re-measured AFTER the
last change to it rather than before.

The control fix lands on `/transmision` too, because the block is shared.
That page has never been contrast-measured either and stands on a photograph
of its own; a stronger edge is not worse there.

**AND A FOURTH THING THE BROWSER FOUND THAT NO UNIT COULD.** The three
controls were **42 pixels tall** — `py-2.5` on `text-sm` — two under the 44
the rest of this redesign is held to. Pre-existing on the two old ones, and
the new calendar button inherited it; it surfaced the moment the geometry
guard started measuring all three. All three declare `min-h-11` now rather
than inheriting a height from their padding, the same way the question's two
answers do.

**GEOMETRY. IT FITS, WHICH WAS NOT A FOREGONE CONCLUSION.** A heading, a
paragraph and two buttons at the top, a sentence and a button at the foot,
with a third control added to a screen that was holding two:

| device          | one person | two | four | five |
| --------------- | ---------- | --- | ---- | ---- |
| iPhone 14 (664) | 664        | 664 | 664  | 664  |
| Pixel 7 (839)   | 839        | 839 | 839  | 839  |

The guard grew assertions rather than just staying green: the calendar button
is below the join link, the way back is below both, all three end inside the
fold, and each one clears 44 pixels.

**GREEN.** `npm test`, `npm run typecheck`, `npm run lint` (0 errors, 8
warnings, the same eight), `npm run format:check`, `npm run build`, and the
guest-facing browser specs. The environmental failures are the same ones U38
records and counts fresh.

### U40 — done (the deadline stopped blanking the invitation, and the clock became testable)

**THE SMALL PART FIRST: A SENTENCE THAT WAS FALSE FOR THE LAST WEEK.** The
declined screen said "Si cambias de opinión, puedes volver a responder cuando
quieras." `RSVP_DEADLINE_DAYS_BEFORE` is 7, so the answer freezes on the 21st
of November and _whenever you like_ was a promise the product stopped keeping
exactly when a household that had said no is most likely to reconsider. It
names the day now — `rsvpReconsiderSentence`, in `rsvp-copy.ts` beside
`rsvpDeadlineSentence`, both reading `RSVP_DEADLINE_TEXT` — so the two screens
that name this deadline cannot drift to two different days. The spec asserts
the absence as well as the presence: a future edit that softened the date back
into "cuando quieras" would restore the lie while still mentioning a date.

**AND THE DEFECT: CLOSING THE RSVP CLOSED THE INVITATION.** `RsvpClosed` took
no props and rendered an `h2` and a paragraph, and the route substituted it
for the entire stepper. So from the 21st of November — the seven days when a
guest most needs the page:

| household      | what it lost                                                         |
| -------------- | -------------------------------------------------------------------- |
| accepted       | the venue, the map, `Cómo llegar`, the day, the hour, the dress code |
| declined       | `Entrar a la transmisión`, `Agregar a Google Calendar`               |
| never answered | everything above, and it could not be told apart from the other two  |

Everyone opening their invitation in the final week got a greeting, the
announcement, and the words "Confirmaciones cerradas". **Nothing anybody
needed in order to reach the wedding survived the deadline.**

The other half of it was in the route: `const current = open ? await
loadCurrentRsvp(...) : null`. With the answer discarded, an accepted household
was indistinguishable from one that had never replied — so even a closed
screen that wanted to be useful had nothing to be useful with.

**WHY NOBODY CAUGHT IT, WHICH IS THE PART WORTH FIXING.** The deadline is
derived from a constant in the future and the decision is made on the SERVER
during render: no fixture can be past it, and `page.clock` reaches nothing.
`e2e/rsvp.spec.ts` had recorded the gap honestly — "the closed branch stays
unreachable from this suite" — and left it open. A state nobody can reach is a
state nobody has looked at.

**WHAT THE COUPLE DECIDED**, put to them and confirmed: the deadline closes
THE ABILITY TO CHANGE AN ANSWER, not the invitation.

| household      | after the deadline                                                                      |
| -------------- | --------------------------------------------------------------------------------------- |
| accepted       | the venue, the map, the day, the hour, the dress code — and no way to change the answer |
| declined       | the stream link and the calendar — and no way to change the answer                      |
| never answered | **my decision, not theirs** — see below                                                 |

**THE THIRD ENDING IS A DECISION TAKEN ON THEIR BEHALF AND IT IS FLAGGED
RATHER THAN BURIED.** They named the first two. A household that never
answered can still watch, so they are offered the stream and the calendar —
but NOT the venue, because the venue is gated behind saying you are coming and
a deadline passing is not a confirmation. Handing the address to everybody who
ignored the invitation would undo the rule the whole accepted screen exists to
enforce. It is asserted in two specs and written in **Next** so the couple can
overrule it with one line.

**NOTHING IS A SECOND COPY.** The accepted ending is `RsvpConfirmed`, the same
component the open flow uses; the two stream endings are `StreamDetails`, the
same block `/transmision` and the declining screen render. A closed-state copy
of either would be two weddings waiting to disagree about an hour or a venue.
`CeremonyStream` is deliberately NOT reused: it is the declining FLOW, and
both of its own sentences — "comprendemos que no puedan acompañarnos" and the
way back — are wrong on a screen where the decision is already made and
frozen.

**THE COPY.** "Confirmaciones cerradas" as a bare headline stopped making
sense once the screen carries the venue underneath it — a headline announcing
an absence over working content reads as an error message. It is one quiet
line per ending now (`rsvpClosedNote`), and the heading is the same one the
open flow would have given them: "Los esperamos" for a household that
accepted, "Los vamos a extrañar" for one that declined, and the plain greeting
for one that never answered, because nothing has been said to them yet.
`greetingOwner` stopped being conditional on the deadline as a result.

**THE CLOCK IS A SEAM NOW, AND THAT IS THE DURABLE PART OF THIS UNIT.**
`RSVP_CLOCK` is read through `lib/server/env.ts` — the module whose whole job
is turning one raw environment string into a validated value — parsed
strictly, throwing on anything unparseable, and **refusing to exist on a
production deployment at all**: a frozen clock on the couple's own site would
pin the deadline open or shut for every guest, which is this same defect with
a longer fuse.

`playwright.config.ts` runs a second server on the next port with that
variable set to four days after the deadline, and two `*-closed` projects at
both phone presets point at it. No second build — it waits for the first
server to answer, then serves the same `.next`.

**AND THE SUITE PROVES IT IS LOOKING AT THE CLOSED BRANCH.** A frozen clock
that silently failed to apply would leave every assertion running against the
OPEN page — where a household that accepted also sees the venue — and the file
would be green while testing nothing. So the first test loads the same
invitation on BOTH origins: a form on one, no form and the closed note on the
other. Proven falsifiable rather than assumed — moving the configured instant
to the 1st of November turns four of the five red, the guard first:

    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('form.rsvp__form')
    Expected: 0
    Received: 1

**GEOMETRY.** Three endings × two household sizes × two phones, all measured
on the shipped build with the deadline past:

| device          | accepted | declined | never answered |
| --------------- | -------- | -------- | -------------- |
| iPhone 14 (664) | 664      | 664      | 664            |
| Pixel 7 (839)   | 839      | 839      | 839            |

**AND THE FIFTH LEGIBILITY SPEC FOUND ONE MORE THING.**
`app/i/[slug]/closed-legibility.spec.tsx` measures a screen that never had
numbers because it never had content. It caught a value inside a component
that HAD been measured: `RsvpConfirmed`'s labels are `/75`, comfortable where
the accepted screen puts them — and one line lower, under the closed note,
the day's label lands on #5C5E47 at **4.10:1**. It is `/85` now, 4.75:1 here
and better than it was on the open screen, lifted on the shared component
rather than copied. That is the argument for sharing made twice in one unit:
the reuse is what let a second surface find the first surface's defect.

Permanent negative controls for both: `/75` on that pixel is asserted to fail
4.5:1, and the stream controls' old `/30` edge to fail 3:1.

**GREEN.** `npm test` — 2,497 unit and component tests, 2,486 passing.
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings, the same eight),
`npm run format:check`, `npm run build`. `PORT=3100 npx playwright test` — 130
passed, including all ten of the new closed-clock tests on both phones.

**NOT GREEN, AND WORSE THAN WHEN THIS FEATURE STARTED.** Eleven unit failures
and seven browser ones, all environmental and all the same cause: the local
Supabase now holds 1,193 `senders` and more than a thousand `invitations`, so
unpaged `.select()` reads no longer return freshly seeded rows. It has reached
`console-auth.spec.ts`, which is a dependency of most console specs, so 114
browser tests do not run at all. Measured on a clean checkout of the commit
before this one and identical there. Not fixed and not reset — no permission
was given to reset it, and the entry in **Next** has been predicting exactly
this.

### U41 — done (the file is back, with two alarms, and the entry knows who it is for)

**THE `.ics` IS A REVERSAL, TAKEN KNOWINGLY, AND THE ORIGINAL REASON STILL
READS WELL.** `2cb43cb` deleted it on the couple's instruction: "a browser
that answers a tap by dropping a file into a downloads folder has not helped
anybody reading a wedding invitation on their phone." They have reversed that
themselves — **"volvé al .ics con las dos alarmas para que probemos qué sucede
en un android e iphone"** — as an experiment, because what each phone actually
does with the file is the thing they want to see. Both sentences are in
`lib/domain/calendar-event.ts` so the next reader meets a decision rather than
a contradiction.

**RECOVERED FROM GIT RATHER THAN REWRITTEN.** `git log -S` found the removal;
the octet-accurate folding, the escape ORDER (backslash first, or the comma's
own escape gets escaped) and the trailing CRLF came back as they were. They
are easy to get subtly wrong and were already right. What is new is the two
alarms and the location.

**THE COMMENT THAT HAD BECOME A LIE.** The header said the entry went "with
alarms attached". True of the `.ics`; never of the Google link, which sends
`action`, `text`, `dates`, `details` and now `location` and has no reminder
parameter at all. An entry saved that way inherits whatever default the guest
has set. The file says that plainly now, in the module and on the component,
because the difference between a guest who sets their own alarm and one who
assumes we set it for them is a guest who misses the ceremony.

**THE TWO ALARMS, AND WHY ONE IS ABSOLUTE.**

| alarm                       | encoded                                    | resolves to             |
| --------------------------- | ------------------------------------------ | ----------------------- |
| the evening before at eight | `TRIGGER;VALUE=DATE-TIME:20261128T010000Z` | 2026-11-27 20:00 −05:00 |
| three hours before          | `TRIGGER:-PT3H`                            | 2026-11-28 14:00 −05:00 |

Three hours before is a DURATION and iCalendar says it in one token. Eight in
the evening is a TIME OF DAY, and writing it as the 21 hours it happens to be
today would quietly become nine o'clock if the ceremony moved an hour. So it
is derived from the wedding's own local time of day, and the spec asserts the
resulting INSTANTS rather than the trigger syntax — including a test that
moves the ceremony to 19:00 and requires the alarm to stay at eight.

**AND THE ENTRY KNOWS WHICH HOUSEHOLD IT IS FOR, WHICH IS THE PRIVACY LINE.**
There are two builders, not one with a flag:

| entry                                                     | name | date | Meet URL | location  |
| --------------------------------------------------------- | ---- | ---- | -------- | --------- |
| `buildCeremonyCalendarEvent` — accepted                   | ✓    | ✓    | ✓        | **✓**     |
| `buildStreamCalendarEvent` — declined, stream, unanswered | ✓    | ✓    | ✓        | **never** |

The venue is gated behind saying you are coming. A calendar entry is forwarded
exactly like a link and survives longer — it lands in a file and an app rather
than in a chat — so an address in a declining household's entry would travel
further than anything the page ever showed them. Asserted from both
directions, in the `.ics` and in the Google URL, by name and by coordinate,
with a negative control for the way it would regress: one builder with
`location: venueName ?? ""` writes `LOCATION:` and `location=` into every
stream entry, and an empty location is not the same as no location.

**THE ENDPOINT FOLLOWS THE ANSWER, NOT THE URL.** `app/i/[slug]/evento.ics`
sits behind the same unlock cookie the page does, checked against THIS
invitation, and re-reads the household's answer for itself: one path, one
household, two possible files. A locked invitation answers exactly as an
unknown slug does, so it cannot be used to discover which slugs are real. The
browser suite proves all three: the gate, the accepted file's `LOCATION`, and
the declining file's total absence of one.

**THE LOCATION IS RESOLVABLE RATHER THAN DECORATIVE.** `venue_name` is "Villa
Campestre", which a maps search will happily place in a dozen towns, and
`venue_address` holds a placeholder the couple have decided they will never
fill. So the entry carries the name AND the coordinates the directions button
already uses — which meant moving `VENUE_COORDINATES` out of `VenueMap` and
into the domain, because `lib/domain` cannot import a component and the only
other option was a second copy. `tools/venue-coordinates.spec.ts` followed it
and still holds the latitude to exactly one source file; it immediately caught
a comment of mine that quoted the pair, which is the guard doing its job.

**A FOURTH CONTROL ON THE DECLINED SCREEN — MEASURED FIRST, THEN ADDED.** The
couple asked for both buttons on the accepted screen and said nothing about
this one, which already had three. The module's own argument is that the
alarms matter MOST to a guest with no journey to plan, so it was worth asking
whether a fourth fits:

| screen                 | iPhone 14 (664) | Pixel 7 (839) | controls     |
| ---------------------- | --------------- | ------------- | ------------ |
| accepted, one and four | 664             | 839           | 3, all ≥44px |
| declined, one and four | 664             | 839           | 4, all ≥44px |

It fits, so it is there. Nothing was shrunk to make room.

**AND THE MEASUREMENT FOUND FOUR THINGS THE MOVE BROKE.** Adding controls
made two cards taller, which pushed both onto brighter photograph — the
failure mode this project has now hit in four consecutive units:

| element                      | was               | measured at the new position      | now                      |
| ---------------------------- | ----------------- | --------------------------------- | ------------------------ |
| the accepted foot's ground   | `bg-[#0d1114]/60` | `Lugar` at **3.92:1**             | `/75`, 6.28:1            |
| `Cómo llegar`'s edge         | `/50`             | **2.82:1**                        | `/60`, 3.35:1            |
| the stream screen's controls | `bg-black/40`     | label **4.30:1**, edge **2.61:1** | `/55`, 6.59:1 and 3.53:1 |
| the accepted foot's fixture  | `#8A8985`         | the card now covers **#F3F1E6**   | re-sampled               |

That last row is the one worth reading twice. The foot's fixture was the
brightest pixel in the bottom quarter of the screen, chosen carefully in U37
for a card that sat there. Two more controls grew the card upward by about a
hundred pixels, across the lit edge of Michell's dress — **0.250 to 0.877
luminance, three and a half times brighter** — and every assertion in
`confirm-legibility.spec.tsx` still passed, because they were all measured
against the old number. Nothing but re-sampling would have found it.

**GREEN.** `npm test` — 2,516 unit and component tests, 2,505 passing.
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings, the same eight),
`npm run format:check`, `npm run build`. `PORT=3100 npx playwright test` — 131
passed, and all 96 guest-facing browser tests green across both phone projects
and both clocks.

**NOT GREEN.** The same eleven unit and seven browser failures U40 records,
unchanged and environmental: the local Supabase is past PostgREST's unpaged
1000-row ceiling on `senders` and `invitations`, `console-auth.spec.ts` cannot
find a seeded operator, and 114 console tests do not run behind it. Nothing
here reset it.

### U42 — done (the confirmation stopped reading like a spec sheet)

**WHAT WAS ASKED, AND THE COUPLE DIAGNOSED IT THEMSELVES.** "Importante que en
la ultima pagina de afirmacion tambien tenga la cuenta regresiva, siento que
esa pagina se ve muy diferente a las demas y se ve un poco fea."

They asked for a countdown and they were right about the cause, which was not
only the countdown's absence. The gate, the question and the list of who is
coming all open the same way: script line, the couple's names, one quiet line
of spaced caps, a hairline, the counter. The confirmation opened with

    CUÁNDO
    sábado, 28 de noviembre de 2026, 5:00 p. m.
    CÓDIGO DE VESTIMENTA
    Formal elegante

— label over value, twice. Same facts, different voice: a spec sheet where
every other screen is an invitation. **Adding a countdown under that would
have left a spec sheet with a countdown under it**, so the block was rebuilt
in the announcement's own line and the counter closes it the way it closes the
other three.

| was                                 | is                                                          |
| ----------------------------------- | ----------------------------------------------------------- |
| `dl` with two `dt`/`dd` pairs, 88px | two lines of spaced caps, a hairline and the counter, 119px |
| `CUÁNDO` / value                    | `SÁBADO, 28 DE NOVIEMBRE DE 2026`                           |
| `CÓDIGO DE VESTIMENTA` / value      | `5:00 P. M. · FORMAL ELEGANTE`                              |

All three facts the couple named — the day, the hour, the dress code — are
still there. What went is two label lines that said in small caps what the
values say plainly.

**REUSED, NOT RESTATED.** `SaveTheDate` now exports `ANNOUNCEMENT_LINE` and
`ANNOUNCEMENT_RULE` and uses them itself, so the setting has one definition
and tuning the landing's type tunes the confirmation with it. The counter is
the landing's own `Countdown`, ticking to the same instant rather than to a
second reading of the same date.

**THE CONSTRAINT DID NOT BIND, AND THE MEASUREMENT IS WHY WE KNOW.** The brief
expected a fight for space: this screen carries the most of any and measures
1.00. It measures 1.00 because the content is 422 pixels and the layout is
`justify-between` — there were **242 pixels of empty middle** on an iPhone 14
before this change, which is what U37's two-groups-at-the-two-ends design
bought. The block grew from 88 to 119 and the middle absorbed it.

| device          | one person | four people |
| --------------- | ---------- | ----------- |
| iPhone 14 (664) | 664        | 664         |
| Pixel 7 (839)   | 839        | 839         |

Nothing was tightened, no control dropped, no target shrunk. The attendees
screen's `CHOSEN_OVERFLOW` was not touched.

**AND THE RE-SAMPLE FOUND TWO THINGS, ONE OF WHICH IS OLDER AND WIDER THAN
THIS SCREEN.**

The new lines sit where the old pairs did not, so both fixtures moved —
`#262620` and `#2E2F27` on the live screen, `#5C5E47` and `#63674E` on the
closed one, which pushes the block a note lower. At the closed screen's
position the shared line measured **4.23:1** at `/85`. It is full cream now:
5.13:1 there, better everywhere else, and 85% versus 100% of this cream at
12px is not a difference anybody sees.

**THE COUNTER HAS NO GROUND, AND ON BRIGHT PHOTOGRAPH IT CANNOT BE READ.**
This is not this unit's doing and it is not confined to this screen — the
counter has never been measured anywhere:

| where                        | element                 | measured   |
| ---------------------------- | ----------------------- | ---------- |
| accepted, live               | its labels at `/65`     | **2.62:1** |
| accepted, live               | its figures, full cream | 5.34:1     |
| accepted, after the deadline | its figures, full cream | **2.21:1** |

The labels are 10px, so 4.5:1 applies, and **full cream on that ground is
3.96:1** — there is no opacity that fixes it. The fix is a ground the counter
does not have on any of the five screens that show it, which would change the
landing, the gate, the question and the list of who is coming, none of which
the couple asked to change. So:

- the counter ships on the accepted screen, where the couple asked for it and
  where it is no worse than on the four screens that already carry it;
- it is NOT shown after the deadline, where it would be 2.21:1 —
  `RsvpConfirmed` takes `countdown={false}` from `RsvpClosed`, the day and the
  hour are stated immediately above it either way, and
  `closed-legibility.spec.tsx` asserts both the absence and the number, so the
  test goes red the day the counter gains a ground and can come back;
- the defect itself is in **Next**, with its numbers, as a decision for the
  couple rather than a restyling of five screens smuggled into a unit about
  one.

**GREEN.** `npm test` — 2,516 unit and component tests, 2,506 passing.
`npm run typecheck`, `npm run lint` (0 errors, 8 warnings), `npm run
format:check`, `npm run build`. `PORT=3100 npx playwright test` — 131 passed,
all 96 guest-facing browser tests green across both phone projects and both
clocks.

**NOT GREEN.** Ten unit and seven browser failures, all environmental and all
the same cause U40 and U41 record: the local Supabase is past PostgREST's
unpaged 1000-row ceiling, `console-auth.spec.ts` cannot find a seeded
operator, and 114 console tests do not run behind it. The unit count moves
between ten and eleven between runs as the row counts shift. Nothing reset.

### U43 — done (the download went, and the pin it left behind was the wrong one)

**THREE THINGS, AND THE MIDDLE ONE WAS A REAL DEFECT.** "El .ics realmente
intenta descargar un archivo, entonces descartemos ese boton." "El comentario
esta horrible: 'Nos casamos y los acompañamos por Google Meet.'" And, from
their own phone, the location in the accepted household's entry opened a
DIFFERENT venue.

**THE FILE IS GONE FOR THE SECOND TIME, AND THE EXPERIMENT IS WHY IT STAYS
GONE.** U41 restored it deliberately — "volvé al .ics con las dos alarmas para
que probemos que sucede en un android e iphone" — and the answer came back from
a real phone, which is exactly what the unit was for. Deleted with it:
`app/i/[slug]/evento.ics/route.ts`, `buildIcs` and its four helpers
(`fold`, `escapeText`, `octets`, `eveningBefore`), the alarm derivation, the
`icsHref` prop through five components, and the builder's own test suite.

**WHAT IT COST, STATED RATHER THAN MOURNED.** The file was the only output
that could carry a reminder. Google's `TEMPLATE` endpoint takes `action`,
`text`, `dates`, `details` and `location` and has **no reminder parameter at
all**, so an entry saved through the one remaining button inherits whatever
default the guest has set on their own calendar, which may be nothing. The
guest this loses most is the one who joins by stream: no journey to plan
around the date, and now no alarm either. That is a knowing loss, it is
recorded in `lib/domain/calendar-event.ts` and in `CalendarActions.tsx`, and
`lib/domain/calendar-event.spec.ts` keeps the deleted suite's obituary where
the next reader will find it.

**THE HEADER HAD DRIFTED FOR THE THIRD TIME AND THIS PASS CAUGHT IT.** It said
"TWO DESTINATIONS", described the file as present, and explained that the
`.ics` "exists beside" the link — with the file deleted in the same commit.
Four blocks were rewritten, not one: the module header, `CEREMONY_MINUTES`
("the start and the alarms are" → "the start is"),
`buildCeremonyCalendarEvent`'s doc, and `googleCalendarUrl`'s. One more claim
went with them: both the header and the button asserted a specific default
reminder — "often ten minutes", "thirty minutes, in the couple's own
screenshot" — which nothing here has measured. Neither says it now.

**THE WRONG PIN, WHICH IS THE PART THAT WOULD HAVE COST GUESTS A WEDDING.**
U41 wrote the location as `Villa Campestre (3.853778,-76.2971633)` — name
first, coordinates in brackets. Google text-searches a name and treats the
brackets as decoration: the link the couple's phone opened carries
`ftid=0x8e38599a77a5ec99:0xdb3c2905bbdb6107`, where their own venue is
`0x8e39e561ae218207:0x1ccc8574b77d6614`. Two different places, confidently,
with nothing about it looking wrong until fifty people arrive somewhere else.

| was                                     | is                                            |
| --------------------------------------- | --------------------------------------------- |
| `location=Villa Campestre (3.853778,…)` | `location=3.853778,-76.2971633`               |
| name in the location, nowhere else      | name in the `details`, where a guest reads it |

Google's own URL documentation settles the form: a query "may be a place name,
address, or **comma-separated latitude/longitude coordinates**". A bare pair is
the coordinate form; a name beside it is a name search. So the assertion is now
the SHAPE of the value — `/^-?\d+\.\d+,-?\d+\.\d+$/` — and not merely that the
numbers appear somewhere in it, because the bug was that they appeared and were
ignored.

**VERIFIED AS FAR AS IT CAN BE, AND THE LIMIT NAMED.** Google Maps resolves a
`?q=` client-side: `curl` and a server-side fetch both receive a JavaScript
shell with no canonical place in it, so nothing here can prove which pin
Google will drop. Two things could be checked and were. Google's URL
specification confirms the coordinate form, and an independent reverse geocode
of the pair (OpenStreetMap Nominatim) places it on the **Troncal de Occidente,
El Vínculo, Buga, Valle del Cauca** — which is the road and the town the map
picture's deleted `alt` text named in U36. **The couple should still click the
two links below before a guest does.** A `query_place_id` would be the only
absolute guarantee, and it needs their venue's Place ID, which is theirs to
read off their own Google listing.

`Cómo llegar` was checked too and was never wrong: `VenueMap` has always sent
`maps/dir/?api=1&destination=` the bare pair, which is why the two now agree —
`3.853778,-76.2971633` has one definition in `lib/domain/wedding-day.ts` and
`tools/venue-coordinates.spec.ts` fails if a second appears.

**THE TWO DESCRIPTIONS, WHICH WERE ONE DESCRIPTION SAYING THE WRONG THING TO
HALF ITS READERS.** The rejected line was written for a stream viewer and was
being read by a household that had just said it was coming.

| entry             | says                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| accepted          | `Los esperamos en Salón para Eventos Villa Campestre.` + `También transmitimos la ceremonia en vivo: <url>` |
| declined / stream | `Transmitimos la ceremonia en vivo para que puedan acompañarnos desde donde estén.` + `Enlace: <url>`       |

One is travelling to a place and is told where, and that there is a stream if
they need it. The other is joining a call and is told nothing about where.
Both are short — a calendar entry is read in a list — and neither shouts, which
is the register `rsvpConfirmedHeading` and `rsvpDeclinedHeading` set. "Nos
casamos y los acompañamos por Google Meet." is a **permanent negative control**
in `calendar-event.spec.ts`: the sentence the couple rejected by name cannot
come back quietly.

**THE EXACT LINKS, SO THEY CAN CHECK THE PIN THEMSELVES.** Generated from
`WEDDING_INSTANT` and the production coordinates; the Meet URL is whatever
`/console/wedding` holds.

    accepted:
    https://calendar.google.com/calendar/render?action=TEMPLATE&text=Matrimonio+de+Luis+%26+Michell&dates=20261128T220000Z%2F20261128T230000Z&details=Los+esperamos+en+Sal%C3%B3n+para+Eventos+Villa+Campestre.%0A%0ATambi%C3%A9n+transmitimos+la+ceremonia+en+vivo%3A+%3Curl%3E&location=3.853778%2C-76.2971633

    declined / stream:
    https://calendar.google.com/calendar/render?action=TEMPLATE&text=Matrimonio+de+Luis+%26+Michell&dates=20261128T220000Z%2F20261128T230000Z&details=Transmitimos+la+ceremonia+en+vivo+para+que+puedan+acompa%C3%B1arnos+desde+donde+est%C3%A9n.%0A%0AEnlace%3A+%3Curl%3E

    cómo llegar:
    https://www.google.com/maps/dir/?api=1&destination=3.853778%2C-76.2971633

**THE HEIGHT THE DELETION FREED WAS NOT SPENT.** Both screens still measure
1.00 with nothing added, nothing enlarged and no target changed.

| screen                 | iPhone 14 (664) | Pixel 7 (839) |
| ---------------------- | --------------- | ------------- |
| accepted, three people | 664             | 839           |
| declined, three people | 664             | 839           |

**AND THE RE-SAMPLE FOUND THE FIXTURES POINTING AT A CONTROL THAT NO LONGER
EXISTS.** Both were measured under the LOWER of the two calendar buttons, and
the lower one is the one that went:

| fixture                        | recorded        | measured now    | kept     |
| ------------------------------ | --------------- | --------------- | -------- |
| `BRIGHTEST_UNDER_THE_CALENDAR` | `#BFBCAA` 0.500 | `#ACAF86` 0.412 | recorded |
| `BRIGHTEST_UNDER_THE_FOOT`     | `#F3F1E6` 0.877 | `#A29C98` 0.337 | recorded |

Both grounds got DARKER, so every assertion in the two files is now held
against a brighter ground than the one that is there. The numbers are kept —
relaxing a contrast fixture because a control was deleted buys nothing, and
both cards' top edges still move with content nobody has fixed (the paragraph's
line count on one, the unfilled venue name on the other). Both comments now say
which number is measured and which is the high-water mark.

**GREEN.** `npm test` — 2,514 unit and component tests, 2,503 passing.
`npx tsc --noEmit`, `npm run lint` (0 errors, 8 warnings — back to baseline
after an unused `WEDDING_TIME_ZONE` import the alarm derivation had left
behind), `npm run format:check`, `npm run build`. `npm run e2e` — 131 passed,
every guest-facing browser test green across both phone projects and both
clocks; `e2e/rsvp.spec.ts` alone is 15/15.

**NOT GREEN.** Eleven unit and seven browser failures, all environmental and
all the cause U40, U41 and U42 record: the local Supabase is past PostgREST's
unpaged 1000-row ceiling, `console-auth.spec.ts` cannot find a seeded operator,
and 114 console tests do not run behind it. Nothing reset.

### U44 — done (five reads were answering with the first thousand rows)

**THE DEFECT IS THE SHAPE OF THE ANSWER, NOT THE SIZE OF IT.** PostgREST caps
an unbounded `.select()` at `max_rows` — 1000, set in `supabase/config.toml` —
and serves the first page with a 200, no error, no truncation flag and nothing
in the body to distinguish it from the whole table. A console that had stopped
listing guests past the thousandth would have looked exactly like a wedding
with a thousand guests. **That is why it survived four units in `## Next`**:
every symptom it produced was somebody else's test failing for what looked
like an unrelated reason, and "eleven red tests everybody expects" is the same
weather that hid the blanked-invitation defect until U40.

**FIVE READS, NOT THE THREE THAT WERE NAMED.** `listGuestDirectory` (no filter
at all) and `listConsoleInvitations` (the shared dashboard passes neither
`ownedOnly` nor `invitationId`, so that call is the whole `invitations` table)
were on the list. `listFreeGuests` was too, and its filter is the interesting
one: `is("invitation_id", null)` NARROWS the read without BOUNDING it — the
people nobody has placed yet grow with the guest list, and the local database
is past a thousand on that filter alone. The survey added two more.
`listSenderDirectory` reads `senders` with no filter, and a short answer there
does not merely hide rows: the import validates every row of the couple's file
against that map, and a missing key is indistinguishable from an operator who
does not exist, so an operator PostgREST declined to send would come back as
"that email is not on the allowlist" and the import would refuse invitations
that are perfectly valid. `listOperatorProfiles` reads the same table for the
device picker — which is precisely what had been breaking `console-auth`.

**WHAT WAS JUDGED AND LEFT ALONE, WITH THE ARITHMETIC.** A filter is not a
bound, so each one was reasoned about rather than waved past.
`rsvp_latest.in(batch)` in `readLatestAnswers` is structurally safe: the view
is one row per invitation by construction and a batch carries at most 100 ids,
so it cannot exceed 100. `dispatch_events.in(batch)` in `readDispatchEvents`
and `readDispatchStates` is the one with real exposure — the batch bounds the
FILTER at 100 invitations, not the result, so ten operator actions per
household in one batch would reach the cap. It holds 288 rows across the whole
database today and this wedding has ~200 households; it is recorded in
`## Next` rather than paged, because paging it adds a round trip per batch to
the slowest read in the console and buys nothing at this scale.
`gate_attempts` is bounded by an invitation AND a 60-minute window, and a
brute force past a thousand attempts in an hour would still be answered
correctly: the read is ordered `attempted_at` DESCENDING, so truncation drops
the oldest attempts in the window and the 1000 it keeps are the ones any
lockout threshold is decided on. `listDispatchEvents` is one household's log.
`findSlugsInUse` matches one slug family; the largest in this database is 2.

**ORDER WAS PART OF THE FIX, NOT SCOPE CREEP.** `.range()` over a query with
no `ORDER BY` is two unordered reads with an offset between them: Postgres
promises no repeatable row order, an UPDATE relocates a row in the heap, and
two pages are then free to overlap or skip. None of the five ordered at the
top level. `listGuestDirectory` was explicitly "UNORDERED ON PURPOSE" and that
reasoning is preserved rather than overruled — `buildGuestDirectory` still
sorts with a Spanish collator and the database still has no opinion about what
a reader SEES. `id` is a page key: total, stable and invisible. The comment
says so, because an `.order()` that looks decorative is one the next reader
deletes. `listOperatorProfiles` ordered by `display_name`, which is not
unique, so it gained `id` as a tiebreak — a cursor that is not unique can
serve one of two tied rows twice and the other never.

**THE LOOP STOPS ON AN EMPTY PAGE, NOT A SHORT ONE, AND THAT IS THE WHOLE
GUARANTEE.** "Fewer rows than I asked for means there are no more" holds only
while the server's ceiling is above the page size. Lower `max_rows` under it —
one line in a config file nobody would connect to this — and every page comes
back short, a loop that stopped on a short page stops on the first one, and
the silent wrong answer is back with a paging loop on top of it looking like a
fix. So `readEveryPage` advances the cursor by the rows it RECEIVED and ends
only on a page with nothing in it. One extra round trip buys a correctness
guarantee that does not depend on a setting the module cannot see.
`paged-read.spec.ts` holds a server that caps every page at three while the
caller asks for ten, and all seven rows still come back.

**THE PAGE SIZE IS INJECTABLE BECAUSE THE ALTERNATIVE WAS THE DISEASE.** A
test that seeded 1001 rows to watch one boundary would take minutes and make
the suite slower, which is exactly what this unit is treating. Two rows a page
over five households proves the same loop. It is exercised on
`listConsoleInvitations` with `ownedOnly` against a sender nobody shares —
five households, pages of two, exactly four requests including the empty one —
because that is the only one of the five whose result set can be isolated. The
same test written against `listGuestDirectory` was MEASURED at 6.5 seconds,
because with no filter a page size of two pages the whole 2,991-row table, and
it would get slower every time anybody crashed a run. It was deleted and the
reason is in the file where it stood.

**THE ASSERTION IS THE NUMBER OF REQUESTS, AND IT HAD TO BE.** An unpaged
`.select()` still answers with up to a thousand rows, so against a small
database it returns exactly what the loop would have returned: no assertion
about the RESULT can tell the two apart, and one that only passes because this
particular database happens to be polluted is a test that cannot fail on
purpose. A table-wide total would distinguish them and is unavailable — this
database is shared with every spec file and with whatever a crashed run left
behind. `countingClient` wraps the REAL client, simulates nothing, and counts
`from()`. One request means unpaged, on any database of any size.

**PROVEN TO FAIL, because `3a7f89a` is in this history.** Each read was
reverted to a single unpaged `.select()` and the tests were run:

```
listGuestDirectory   expected false to be true      (the seeded guest is absent)
listFreeGuests       expected 1 to be greater than 1
listConsoleInvitations  expected 1 to be 4
listSenderDirectory  expected [ …(1000) ] to include 'cdf4c9a8-…'
listOperatorProfiles expected [ …(1000) ] to include 'b6de60dd-…'
```

The cap is legible in the last two: `[ …(1000) ]` is PostgREST's ceiling
printed into an assertion message.

**THE PAYOFF, MEASURED ON THE POLLUTED DATABASE AND WITHOUT RESETTING IT.**
Nothing was truncated; no permission was given to. `lib/server/guest-directory.spec.ts`
went from **8 failed / 5 passed in 130.21s** to **16 passed in 8.99s**, and the
eight failures were the whole of the diagnosis: they cleared because the cap
was the cause, not because the fixtures moved. `lib/server/invitations.spec.ts`
cleared its own. The full unit suite is **2,535 passing across 128 files in
18.7s**, stable across three consecutive runs — `tools/eslint-zones.spec.ts`
stopped timing out on its own, exactly as predicted, because nothing is
starving it any more, and `lib/server/operators.spec.ts` stopped drifting. A
suite whose red set changed every run is a suite again.

**AND THE BROWSER SUITE, WHICH IS WHERE THE PRODUCTION BUG WAS ACTUALLY
VISIBLE.** Before: **131 passed, 7 failed, 114 never ran** — `declareDevice`
could not find a freshly seeded operator, because `listOperatorProfiles`
stopped at the thousandth sender and the new one sorted past it, and most
console specs sit behind that. After: **243 passed, 1 failed, 8 did not run.**
That is 112 browser tests that had not executed in this repository for four
units.

**TWO E2E ASSERTIONS CHANGED, AND THE HONESTY IS WHY.** `console-guest-list.spec.ts`
walked every radio on the device picker asserting each was unchecked. That was
free while the picker rendered a handful and stopped being free the moment the
read became honest: 1,186 radios, each with its own retry budget, inside one
30-second test. `getByRole("radio", { checked: true })` with `toHaveCount(0)`
says the same thing in one query and no longer scales with how much junk the
database is carrying.

**GREEN.** `npm test` — 2,535 passed, 128 files, 18.7s. `npm run typecheck`.
`npm run lint` — 0 errors, 8 warnings, baseline. `npm run build`.

**NOT GREEN, AND NOT THIS UNIT'S.** `npm run format:check` fails on
`components/landing/StreamLink.spec.tsx`, which this unit does not touch —
`1c83ae3` introduced `STREAM_LINK_LABEL` and left three call sites over the
print width. Reproduced against `git show HEAD:` to confirm it predates this
work, and fixed in a commit of its own so it is visible rather than absorbed.
One browser test fails: `console-wedding.spec.ts:226`, a household declining.
It is NEWLY REACHABLE rather than newly broken — the baseline died in that
file's `beforeAll` at `declareDevice` and tests 123 onward never ran. It is
recorded in `## Next` with the evidence.

### U45 — done (the counter left one screen, and the ceiling moved to three)

**WHAT THE COUPLE SAW, ON A REAL PHONE RATHER THAN IN AN EMULATOR.** They
opened the list of who is coming in Brave on an iPhone, with a three-person
household, and `Enviar respuesta` was behind the browser chrome. Their
instruction, after being given the arithmetic: **"sacalos solo cuando la
invitacion es de 3 personas, porque con dos personas si se ve bien."**

**THE ARITHMETIC THEY WERE GIVEN WAS EXTRAPOLATED, AND EVERY NUMBER IN IT WAS
RE-MEASURED BEFORE ANYTHING WAS STYLED.** The estimate said three people were
"about 70 pixels over"; the shipped build says **71**. Measured on a build of
`c8f3739`, iPhone 14, 664 pixels, by rendering the real screen and then
deleting the two elements from the live DOM — so the "after" column is a
measurement of the proposal rather than a prediction about it:

| household | announcement whole | over   | counter and rule gone | over |
| --------- | ------------------ | ------ | --------------------- | ---- |
| two       | 681                | 17     | 664                   | 0    |
| three     | 735                | **71** | 664                   | 0    |
| four      | 789                | 125    | 690                   | 26   |

A Pixel 7 is 839 and fits every one of those six cases. The trim frees **98
pixels**: the counter is 50 tall with a 24-pixel gap above it, the hairline 1
with another 24. The estimate had said 74 and 25, which is the same 99 to
within a rounding of the gap.

**AND THE TWO-PERSON OVERFLOW IS REAL, WHICH THE COUPLE ARE ENTITLED TO
KNOW.** U38 recorded 17 pixels there and they say it looks fine on a phone.
Both are true, and the measurement says exactly why: "Volver a la pregunta"
ends at **653** of a 664-pixel screen, and every one of the 17 overflowing
pixels is the form's own bottom padding underneath it. Nothing a guest can
read or press is off the screen; what the overflow buys them is a page that
can be nudged 17 pixels. **They have chosen to keep the counter there and it
costs a hair of scroll.** At three people the same arithmetic reads
differently: the send button itself ended at 663 of 664 — flush against the
fold in an emulator, and behind the chrome on the phone in their hand.

**SO ONE SCREEN LOSES TWO ELEMENTS, AND ONLY ONE.** The gate, the question and
the directions are untouched at every household size;
`e2e/invitation-one-screen.spec.ts` has a test whose whole job is to say the
question still has its counter at the size where the list has lost it,
because a change that took it off both would leave every other assertion
green.

**HOW IT IS WIRED, AND WHY IT IS TWO SLOTS RATHER THAN A FLAG.** Three facts
have to meet and they live in three places: the household's SIZE is known to
the route, WHICH SCREEN is showing is client state inside `RsvpAnswer`, and
the announcement is a Server Component tree with a live countdown in it that
cannot be composed on the client at all. So the route builds both renderings
for the household it already knows and hands them down as two slots;
`RsvpAnswer` picks by step and knows no numbers. `attendeesAnnouncement`
falls back to `announcement`, so a two-person household and every existing
caller — the console preview, the legibility fixtures — keep exactly what
they had.

`SaveTheDate` grew `showCountdown`, beside the `showDate` it already had. One
prop for both elements rather than two, because the hairline exists to close
the date line and introduce the counter: with no counter it separates
something from nothing, and a second prop would only make that state
expressible.

**THE THRESHOLD IS ONE NAMED PLACE AND IT IS `>=`, NOT `=== 3`.**
`attendeesScreenFitsCountdown` in `InvitationAnnouncement.tsx`, with
`HOUSEHOLD_THAT_CROWDS_THE_LIST = 3` beside it and the measured table in its
comment. Three is now the ceiling — "las invitaciones a la final van a ser 3
personas como maximo", down from the four U38 was built around — but nothing
enforces any ceiling, so an equality would hand the whole announcement back
to the one size with least room for it. A four-person list is 789 pixels
whole and 690 shortened; the threshold is wrong in the safe direction and
costs nothing.

**THE GUARD'S CASES MOVED DOWN WITH THE CEILING.** Its fixtures were one,
two, four and a five-person canary; they are now **one, two, three, and a
four-person canary** — one above whatever the ceiling is, so it measures the
first size that actually breaks. Every generic case (the gate, the question,
the directions, the stream) now seeds three rather than four, because three
is the tallest screen this product is supposed to be able to draw.

**`CHOSEN_OVERFLOW` DID NOT DIE, AND SAYING WHY IS THE POINT.** It held three
entries asserting a deliberate overflow the couple accepted while they
decided. They have decided, so the three-person case went back to
`expectOneScreen` and is held to 1.00 like every other step. Two entries
survive and they are **not the same kind of thing**, which the table now says
in as many words:

- **two, 17 pixels** — a price the couple knowingly paid to keep the counter.
- **four, 26 pixels** — not a choice at all. It is the canary, already
  wearing the shortened announcement, and it is what the first household past
  an unenforced ceiling would get. 26 rather than the 125 it was.

A Pixel 7 now has no entry at all: every size fits it, canary included.

**CONTRAST RE-SAMPLED, AND THIS TIME NOTHING MOVED — WHICH IS ITSELF THE
FINDING.** Shortening the announcement pulls the card UP into frame nobody
had covered before: 60%–95% at two people becomes 49%–92% at three and
45%–96% at four. The previous three re-samples each came back harsher than
the one before, so this one was measured on the shipped build at both phone
presets rather than reasoned about.

| card                       | band, iPhone 14 | worst pixel       |
| -------------------------- | --------------- | ----------------- |
| two people, counter kept   | 60%–95%         | `#FFFDF4` (0.980) |
| three people, counter gone | 49%–92%         | `#FAF8EF` (0.937) |
| four people (canary)       | 45%–96%         | `#FFFDF4` (0.980) |

`BRIGHTEST_UNDER_THE_CARD` is unchanged at **#FFFDF4**: the higher edge the
shortened card reaches is the dark green above Michell, and the lit edge of
her dress is still the worst thing under any card. The refusal's slot moved
with the card and got DARKER at every size — #FEF3BB at two, #B4B587 at
three, #A4A780 at four — and is still held to the harsher constant. "Volver a
la pregunta" climbed from 96%–98% to 93%–96% and measures #030305 there,
far under `BRIGHTEST_AT_THE_FOOT`. A Pixel 7 is kinder at every size. All of
that is written into `step-legibility.spec.tsx` although no constant changed,
because "re-sampled and unchanged" and "never looked" are indistinguishable
from a green test.

**THE SAMPLING METHOD PROVED ITSELF BEFORE IT WAS TRUSTED.** It reproduced
the recorded fixture exactly — #FFFDF4, 0.9804, two people, iPhone 14, card
at 60%–95% — which is the number `step-legibility.spec.tsx` already held from
U38. A method that cannot re-derive the last measurement has no business
producing the next one.

**RED, QUOTED.** Written first and observed failing:

    × can be asked for the announcement without its counter
    expected element not to be in the document

    × keeps the counter for the sizes that have room for it
    TypeError: attendeesScreenFitsCountdown is not a function

    × shows the list the shorter announcement when it is given one
    TestingLibraryElementError: Unable to find an element with the text:
    Nos casamos, Ana y Bruno — sin reloj

**GREEN.** `npm test` — 2,543 passed, 128 files, 15.4s (2,535 at `c8f3739`,
plus 8). `npm run typecheck`. `npm run lint` — 0 errors, 8 warnings, the same
eight in files this unit did not touch. `npm run format:check` — clean.
`npm run build`. `PORT=3100 npx playwright test` — **245 passed, 1 failed, 8
did not run** (243 passed at the baseline, plus the 2 new counter assertions,
one per phone project). All 28 geometry assertions green on both phones.

**THE ONE FAILURE IS THE SAME ONE AND IT IS STILL THE ONLY ONE.**
`console-wedding.spec.ts:226` — the gate unlock that answers 200 with
`x-action-redirect` and never navigates. Not this unit's, unchanged by it,
and already in `## Next` as a Next 16.3.4 `redirect()`-in-`useActionState`
question.

### U46 — done (the console opens WhatsApp itself, and the draft breaks where the couple wrote it)

**WHAT THE COUPLE ASKED FOR, AND WHAT THEY WERE ACTUALLY HITTING.** Pressing
`Abrir WhatsApp con el mensaje` did not open WhatsApp. It opened a Meta web
page — `wa.me` redirects to `api.whatsapp.com/send/?phone=…` — carrying an
**Abrir aplicación** button the operator had to press before anything
happened. Two presses per household, the second one on a page whose only
purpose is to ask for the permission the first press already gave, and fifty
of them on the night the invitations go out.

`whatsapp://send?phone=<digits>&text=<encoded>` is not fetched at all. The
browser hands it to the operating system and the installed application gets
it. Same two facts inside, no page in between.

**THE ORDERING CLAIM WAS MEASURED RATHER THAN REASONED ABOUT, BECAUSE IT IS
THE ONE THIS COMPONENT IS BUILT AROUND.** `DispatchLauncher` writes
`link_opened` through `postEventBeacon` and then hands off, never awaiting,
because "a guest who never receives their invitation because a logging call
hung is a far worse trade than a missing audit row". The expectation was that
a scheme handoff gives the beacon _more_ room than an unload did. That is a
claim about a browser, so it was put to two of them — a local page, a
`sendBeacon`, an assignment to `whatsapp://`, and a check of what survived:

| engine        | document after the handoff | `pagehide` | request made | beacon delivered |
| ------------- | -------------------------- | ---------- | ------------ | ---------------- |
| Chromium 1243 | survives, same `window`    | never      | none         | yes              |
| WebKit 26.6   | survives, same `window`    | never      | none         | yes              |

So the answer is the one hoped for, and it is written down rather than
assumed. Firefox was not checked: this project installs no Gecko and the whole
suite is Chromium, which `playwright.config.ts` already says out loud for the
iPhone preset. The ordering in the click handler is **unchanged** either way —
it is the guarantee that must not depend on which destination is configured.

**AND THE PAGE SURVIVING MOVED A QUESTION NOBODY HAD NOTICED WAS LOAD-BEARING.**
"¿Se envió el mensaje?" used to appear because the document came back: it was
re-rendered after a navigation, or the tab became visible again. Neither
happens now. On a desktop, another application taking focus does **not** make
a tab hidden, so `visibilitychange` never fires and the mount never happens —
the question would simply never be asked and no send could ever be recorded.
The press asks it now. The stash and the `visibilitychange` listener both stay:
a machine where WhatsApp genuinely replaced the tab is still a machine this has
to work on.

**THE TRADEOFF, DECIDED IN THE OPEN RATHER THAN QUIETLY.** `wa.me` degrades
gracefully — no WhatsApp installed and you get a page offering the download.
`whatsapp://` fails **silently**: no handler, no error, no page, nothing at
all, and the operator cannot tell a missed click from a machine without the
application. The two operators are the couple, on their own machines, with
WhatsApp installed, so the risk is genuinely small — and a dead button on the
one night fifty invitations go out is not a risk worth carrying for nothing.

So the press reveals two things instead of one: the question, and a quiet line
that says what silence means, with `Abrirlo en el navegador` behind it opening
the `wa.me` link. **It is not the second route the button rule forbids.** That
rule protects two properties — no open goes unrecorded, and the operator
cannot reach for the unrecorded one _first_. By the time this control exists,
`link_opened` has been written and stashed for this invitation, and the
control writes no event of its own: a second write for one press would be the
same press recorded twice, which is what the stash and
`dispatch_events_client_event_idx` exist to prevent. It is a `variant="link"`
button and not an anchor, for the same reason the primary is — an anchor is
reachable by a middle click and a context menu before anything is recorded —
and it is not gold, because there is still exactly one press on this screen
that records an event.

**THE DRAFT, IN THE COUPLE'S OWN SHAPE.** Four paragraphs, and the URL alone
on its own line with a blank line after it. The shape is not decoration: a
link with a comma or a closing bracket welded to its tail is the ordinary way
to ship an invitation nobody can open, and a line of its own is what a thumb
can hit and what gives WhatsApp's detector a clean target.
`INVITATION_MESSAGE_TEMPLATE` is one template literal with real newlines now,
so the value in the source has the shape of the message on the phone — a blank
line you can see is one that survives an edit, and `"…\n" + "\n" + "…"` is one
an editor eventually tidies away.

**EVERY SHAPE ASSERTION READS THE RENDERED MESSAGE, NEVER THE TEMPLATE.** A
correct template behind a renderer that collapsed it would pass a template
assertion and still reach the guest as a wall of text. The encoding is checked
end to end through a real `URL` parse: `%0A%0A` for the blank lines, and the
two emoji as their exact UTF-8 bytes —
`%F0%9F%91%B0%F0%9F%8F%BB%E2%80%8D%E2%99%80%EF%B8%8F` and
`%F0%9F%A4%B5%F0%9F%8F%BC%E2%80%8D%E2%99%82%EF%B8%8F` — five codepoints each,
skin tone and zero-width joiner included, round-tripping byte for byte. The
browser suite asserts the same thing again on the URI a real Chromium actually
handed to the operating system.

**THE `&` IN THE NEW QUERY IS A SHARPER PROBLEM THAN THE OLD ONE WAS, AND IT
IS ASSERTED.** `wa.me` carried the recipient in the PATH; `whatsapp://` carries
it in the query beside the text. So an unescaped `&phone=` inside a household's
name would no longer be cosmetic — it would open a chat with somebody else.
`encodeURIComponent` prevents it, and a test proves the parameter list is
exactly `["phone", "text"]` for a draft written to attack it.

**THE PREVIEW ALREADY HAD `whitespace-pre-line` AND NOTHING PINNED IT.** It
works, so the breaks show; but it is one class in a `className` string and
nothing anywhere would have gone red if a refactor dropped it — the operator
would have approved a wall of text and the guest would have received four
paragraphs, or the reverse. Pinned twice now: the class in the unit test, and
`getComputedStyle(...).whiteSpace === "pre-line"` in the browser, because a
class name proves the intent and only a browser proves the result. The
approved snapshot carries the real four-paragraph draft and the real
`whatsapp://` URI, so the thing it approves is the thing that ships.

**`Enlace que se abrirá:` WAS ABOUT TO BECOME A LIE, AND IT NOW SHOWS THE URI.**
The pane named `wa.me` while the button would have opened `whatsapp://` — a
label promising a destination the operator would never reach. It shows the URI
the press actually hands over.

**THE TWEMOJI CLAIM IS GONE, AND WHAT REPLACED IT IS THE ONE THAT WENT LIVE
TODAY.** U32 found it and left it, correctly, as a copy decision:
`lib/domain/message-preview.ts:38` told the operator «la imagen de la tarjeta
dibuja los emoji con el juego Twemoji», which stopped being true at U29 when
Satori left — the card is a JPEG read off the disk, there is no emoji on it and
no Twemoji anywhere in this product. A list whose whole contract is "every line
names a specific way the mock is KNOWN to be wrong" cannot carry a line that is
itself wrong; a false caveat spends the operator's attention hunting a
difference that cannot occur, which is the opposite of what the list is for.

**Replaced rather than deleted, and that is the judgement to look at.** The
divergence went live the moment the draft gained 👰🏻‍♀️🤵🏼‍♂️: this pane draws
them with the operator's own fonts, the recipient's phone draws them with its
own, and a joined sequence carrying a skin tone is exactly the kind a system
that does not know it renders as separate pieces. Same slot, same count of six,
a claim that is true again. **Removing the false sentence is a correction;
choosing its replacement's wording is not, so it is in `## Next` for the
couple** with the exact sentence quoted.

**ONE MEASUREMENT THAT MOVED AND WAS LEFT ALONE.** The character count under
the bubble reads 194 for the fixture draft, and about a dozen of those are the
two emoji: `String.length` counts UTF-16 code units, so each five-codepoint
sequence costs seven and displays as one. Against a folding threshold that is
explicitly approximate and undocumented, twelve is noise, and grapheme counting
would be a new claim to defend rather than a fix. Recorded, not changed.

**RED, QUOTED.** 41 failures, written first and observed:

    × builds the canonical URI shape
    Error: No "buildWhatsAppAppLink" export is defined on the "./wa-link" mock

    × is four paragraphs separated by blank lines
    AssertionError: expected [ Array(1) ] to have a length of 4 but got 1

    × addresses the recipient and prefills the rendered draft
    AssertionError: expected 'https:' to be 'whatsapp:'

    × survives the blank lines and the emoji through the encoding
    AssertionError: expected 'https://wa.me/573001234567?text=Hola%…' to contain '%0A%0A'

    × asks whether it was sent as soon as the link is opened
    TestingLibraryElementError: Unable to find an accessible element with the
    role "button" and name `/Marcar como enviada/i`

    × no longer claims the card draws emoji, because the card draws none
    AssertionError: expected '…con el juego Twemoji…' not to match /twemoji/i

**GREEN.** `npm test` — 2,593 passed, 128 files (2,543 at `1b36a38`, plus 50).
`npm run typecheck`. `npm run lint` — 0 errors, 8 warnings, the same eight in
files this unit did not touch. `npm run format:check` — clean. `npm run build`.
`PORT=3100 npx playwright test` — **250 passed, 1 failed, 8 did not run** (245
at the baseline, plus 5: two in `console-dispatch.spec.ts` and three in
`console-preview.spec.ts`).

**THE ONE FAILURE IS THE SAME ONE AND IT IS STILL THE ONLY ONE.**
`console-wedding.spec.ts:226` — the gate unlock that answers 200 with
`x-action-redirect` and never navigates. Not this unit's, unchanged by it, and
already in `## Next`.

**A SECOND BROWSER FAILURE APPEARED ONCE, DID NOT REPRODUCE, AND IS WRITTEN
DOWN RATHER THAN DISMISSED.** The first run failed at
`console-guest-directory.spec.ts:464` — "puts the person just added at the top
of the list" — with `Sara Aguirre` in row one. That name is seeded by four
other spec files, the suite is `fullyParallel`, and they all write the same
guest table: the test asserts a GLOBAL "newest row is mine" property while
other workers are inserting guests. The second run passed it and failed only
the recorded one. Nothing in this unit touches guest creation or ordering. It
is a pre-existing cross-file race and it has its own entry in `## Next`.

**THE BROWSER TEST FOR THE HANDOFF HAD TO CHANGE SHAPE, AND IT GOT STRONGER.**
`page.route` intercepts HTTP; a `whatsapp://` handoff makes no request, changes
no URL and replaces no document, so the old interception would have timed out
on a product that was working. Chromium reports the attempt to the DevTools
protocol as `Page.frameRequestedNavigation` carrying the exact URI, and that is
what the suite records now. The previous assertion proved the browser had asked
for a `wa.me` URL; this one proves it asked the operating system for the exact
draft, addressed to the exact recipient, with the blank lines and the emoji
intact. `wa.me` is still intercepted, because the fallback still navigates
there — and a test clicks it and checks it carries the identical draft.

### U47 — done (the fallback opens beside the console, not over it)

**THE COUPLE'S CORRECTION TO U46, IN THEIR OWN WORDS.** "ese abrirlo en el
navegador debe abrirse en una nueva pestaña no en la actual." U46 shipped the
fallback as `browserNavigation.assign(webFallbackUrl)`, which navigated the
console away.

**IT IS NOT A PREFERENCE, AND THE REASON IS THE THING U46 ITSELF UNCOVERED.**
That unit found the `whatsapp://` handoff leaves the document alive, and that
finding is exactly why "¿Se envió el mensaje?" now has to be asked at the press
— no remount and no `visibilitychange` ever arrive to ask it later. A fallback
that navigated the current tab would carry that question off the screen with
it, and an operator who had just sent the message would have to find their way
back to record it. That is the audit gap the two-step dispatch exists to close,
reopened by the one control added to protect against a different failure. The
fallback has to preserve what the primary now preserves: **the console survives
the press.**

`browserNavigation` gains `openInNewTab`, and the fallback calls it from inside
the same click handler with nothing awaited before it — a tab opened outside
the user's own gesture is a tab the browser is entitled to block. It stays a
button, not an anchor: U46's reasoning and the component's older comment both
still hold, and `link_opened` is already stashed by the time it can be pressed.

**VERIFIED IN THE SUITE'S OWN BROWSER RATHER THAN ASSUMED, because "should be
allowed" is what the rest of this work was careful not to lean on.** A real
click, a real `window.open(url, "_blank", "noopener")`, Chromium 1243:

| property                                  | observed                        |
| ----------------------------------------- | ------------------------------- |
| new page opened, not swallowed as a popup | yes, one `page` event           |
| console's own URL after the press         | unchanged                       |
| `window.open(...)` return value           | `null` (as `noopener` requires) |
| `window.opener` in the opened page        | `null`                          |
| pages in the context                      | 2                               |
| console still scriptable afterwards       | yes                             |

**`noopener` IS LOAD-BEARING HERE AND HAS NOWHERE ELSE TO LIVE.** Without it
the opened page holds a handle on the console's `window` and can navigate it.
On an anchor the guarantee is `rel="noopener"`, which a reviewer recognises on
sight; the fallback is a button — deliberately, so no unrecorded route to
WhatsApp exists — and a button has no `rel`. So it is a token inside a feature
string that the type checker cannot see, and dropping it would compile, would
still open the tab, and would pass every component test. That is why
`lib/browser/navigation.ts` now has a spec at all: `assign` still does not,
for the reason the module has always given, and the new method does, for the
one string in it that types cannot check. The module says which and why.

**ONE E2E DETAIL THAT WOULD HAVE SENT A REAL REQUEST TO META.**
`page.route("https://wa.me/**")` is scoped to a page, and the fallback now
opens a SECOND one. A page-scoped route would never have seen it and the
interception would have silently stopped covering the only test that needs it.
It is registered on the context now.

**ASSERTED AS THE ABSENCE OF A NAVIGATION AND AS THE SURVIVAL OF THE
CONFIRMATION**, because a test that only checked the fallback carried the
right draft would pass on the broken version. The component spec presses the
fallback and then marks the invitation as sent, and the browser spec checks
the console's URL is untouched, the question is still on screen, and
`window.opener` is null in the tab that opened.

**RED, QUOTED.** 9 failures, written first and observed:

    × opens the url in a new tab
    TypeError: browserNavigation.openInNewTab is not a function

    × never navigates the console away, whatever it opens
    AssertionError: expected "assign" to not be called at all, but actually
    been called once

    × still records the send after the fallback was used
    TypeError: browserNavigation.openInNewTab is not a function

One of them was environmental rather than behavioural and is worth a line:
`lib/**` runs in the `unit` project, which is `environment: "node"`, so the new
spec failed with `ReferenceError: window is not defined` until it took the
`// @vitest-environment jsdom` docblock its sibling `beacon.spec.ts` already
carries for the same reason.

**GREEN.** `npm test` — 2,601 passed, 129 files (2,593 at `a1913c1`, plus 8 in
one new file). `npm run typecheck`. `npm run lint` — 0 errors, 8 warnings, the
same eight. `npm run format:check` — clean. `npm run build`.
`PORT=3100 npx playwright test` — **250 passed, 1 failed, 8 did not run**, the
same counts as U46: this unit changes an existing browser assertion rather than
adding one. The single failure is `console-wedding.spec.ts:226` again.

## Next

- **The replacement for the Twemoji sentence is the couple's to keep or
  reword, and it is quoted here so the choice is one line rather than an
  archaeology exercise.** U46 removed a claim that had been false since U29;
  what stands in its slot now is: «Los emoji del mensaje los dibuja cada
  dispositivo con su propio juego: aquí se ven con los de este equipo y en el
  teléfono de quien lo reciba se verán con los suyos. Un sistema que no
  conozca uno de ellos puede partirlo en varios.» It is true, and it is the
  divergence that went live when the draft gained 👰🏻‍♀️🤵🏼‍♂️. **What is
  theirs is whether it earns its place**: the list has six entries and every
  one costs attention, so dropping this one to five is a perfectly good answer
  and so is a shorter wording. One string in `lib/domain/message-preview.ts`,
  plus the count in `message-preview.spec.ts`, the approved snapshot and one
  browser assertion — all four fail loudly if only the string is edited, which
  is the point.
- **The dispatch button can now fail with no sign at all, and the mitigation
  is one press deep.** `whatsapp://` reaching nobody does nothing: no error,
  no page. U46 put a visible way out behind the press — `Abrirlo en el
navegador`, with a line saying what silence means — and that is enough for
  two operators on their own machines with WhatsApp installed. It would not be
  enough for a stranger. **Nothing detects the failure**, because nothing can:
  a browser reports no result for a scheme handoff, so the console cannot know
  whether WhatsApp opened and must not pretend to. If the couple ever hand the
  console to somebody else, the honest change is to make the fallback louder,
  not to try to sense the failure.
- **`console-guest-directory.spec.ts:464` asserts a global ordering property
  against a database four other spec files are writing in parallel.** It
  failed once during U46 and passed on the next run with `Sara Aguirre` — a
  name seeded by `phone-gate`, `rsvp`, `invitation-closed` and
  `invitation-one-screen` — sitting in the row it expected to own. The suite
  is `fullyParallel` and the guest table is shared, so "the newest row in the
  whole directory is the one I just typed" is only true when no other worker
  inserts between the write and the read. The fix is to scope the assertion to
  the rows this test created rather than to row one of the list; it was not
  made in U46 because it is a different file's test and a different concern,
  and a flake fixed inside an unrelated unit is a flake nobody reviews. It is
  the second known way this suite can go red without the product changing.
- **The countdown has no ground, and on bright photograph it cannot be
  read.** It has never been measured on any of the five screens that show it.
  On the live accepted screen its labels are **2.62:1** at `/65`; after the
  deadline its figures are **2.21:1** at full cream. The labels are 10px, so
  the 4.5:1 floor applies and full cream only reaches 3.96:1 — **no opacity
  fixes this**. The fix is a ground, or the same painted halo the gate's form
  and the accepted screen's foot already use, and it would change the
  landing, the gate, the question and the list of who is coming as well as
  both accepted screens. U42 declined to restyle five screens inside a unit
  about one: the counter ships where the couple asked for it and is withheld
  from the one screen where it measured 2.2:1, with the number asserted in
  `closed-legibility.spec.tsx` so the day it is fixed the test says so. **The
  decision is theirs: a ground behind the counter, or leave it.**
- **The declined screen is the only one without a counter, the couple asked
  for one, and it FITS but cannot be READ — so it is blocked on the entry
  above rather than on space.** Measured on `b8ef5d3` before anything was
  styled, both phones, a household of three. **Room is not the problem**: the
  screen is two groups at the two ends of a `justify-between` column with an
  empty middle, and on an iPhone 14 that middle holds **220 pixels** of
  slack against the 83 a hairline and a counter would spend — a spacer of 200
  still measures 664, and 236 is the first that overflows. A Pixel 7 swallows
  300 without moving. Ground is the problem. Full cream against the worst
  pixel of each candidate band, and `/65` cream for the 10px labels that
  carry the units:

  | where the counter could go               | worst pixel | figures 30px | labels `/65` |
  | ---------------------------------------- | ----------- | ------------ | ------------ |
  | closing the top group, iPhone 46%–59%    | `#FEF3BB`   | 1.02:1       | 1.02:1       |
  | opening the foot group, iPhone 69%–82%   | `#C1AD87`   | 1.91:1       | 1.55:1       |
  | under the greeting, iPhone 17%–29%       | `#757A35`   | 4.00:1       | 2.64:1       |
  | the very foot, already occupied, 82%–96% | `#535453`   | 6.65:1       | 3.89:1       |
  | closing the top group, Pixel 32%–42%     | `#BAB8A6`   | 1.75:1       | 1.46:1       |
  | opening the foot group, Pixel 76%–86%    | `#7D7B7B`   | 3.68:1       | 2.48:1       |

  **There is no position on this screen where the labels reach 4.5:1**, and
  the best number anywhere on it — 3.89:1 — belongs to the band the
  reconsider sentence and its button already stand in. The figures would pass
  at three of the six, so a counter placed there would look fine and be half
  unreadable, which is precisely the failure the entry above describes. It
  was not built: adding a fifth unreadable instance of the counter would be
  deciding the question the couple were asked and have not answered. **One
  answer unblocks both entries at once — a ground behind the counter, and
  this screen gets it too.**

- **A fifteen-minute gate on `Entrar a la transmisión` was specified and then
  withdrawn, and it is written down so nobody rediscovers it.** The couple
  asked for the join control to open only at 16:45 — "el entrar a la
  transmision se debe habilitar 15 minutos antes de las 5:00 pm colombia" —
  and then cancelled it before a line was written: **"entonces dejarlo como
  esta el componente, no faltando 15 sino una semana."** The worry behind the
  request was that a free Google Meet account's time limit would be eaten by
  guests joining early; they have since configured the scheduled meeting so
  that **nobody enters until a host admits them**, which answers that worry
  without a gate. So `lib/domain/stream-window.ts` is untouched, the existing
  one-week window on the landing's door is the only timing rule in the
  product, and `StreamDetails` stays ungated on both surfaces it serves.
- **`CEREMONY_MINUTES = 60` is an assumption nobody has confirmed, and both
  calendar entries state an end time from it.** `lib/domain/calendar-event.ts`
  has always said so — "the couple gave a start and nobody has said how long
  the ceremony runs". U43 deleted the `.ics`, so it is back to padding a link
  rather than sitting in a file on a phone, which lowers the cost but does not
  remove it: an hour that is wrong is a block of time in a guest's day that
  ends before the ceremony does, and every guest who taps the one remaining
  button gets it. **How long does the ceremony run?** One line to correct, and
  worth asking before the invitations go out rather than after.
- **Nothing reachable from here can prove which pin Google drops, and a Place
  ID would end the question.** U43 fixed a location that sent the couple's own
  phone to the wrong venue, and verified the fix as far as it can be verified:
  Google's URL specification confirms that a bare comma-separated pair is the
  coordinate form, and an independent reverse geocode puts `3.853778,-76.2971633`
  on the Troncal de Occidente in El Vínculo, Buga. But Google Maps resolves a
  query client-side — a fetch returns a JavaScript shell — so the last step is
  a human tapping the link. **`query_place_id` is the only absolute guarantee**,
  and it needs the venue's Place ID off the couple's own Google listing. One
  parameter in `googleCalendarUrl` and one in `VenueMap` the day they have it.
- **The calendar entry carries no reminder and nothing replaces it.** The
  `.ics` was the only output that could set one, and it is deleted. Google's
  `TEMPLATE` endpoint has no reminder parameter, so every guest gets their own
  calendar's default, which may be nothing. The stream guest loses most — no
  journey to plan around the date and now no alarm — and there is no third
  option that is a link rather than a download. Recorded here because it is a
  consequence the couple chose, not a defect to fix.
- **A household that never answered is offered the stream and NOT the venue
  after the deadline, and that is my decision rather than the couple's.** They
  named the other two endings: accepted keeps the venue and the way there,
  declined keeps the stream and the calendar. For the third I chose the stream
  — they can still watch — and withheld the address, because the venue is
  gated behind saying you are coming and a deadline passing is not a
  confirmation. Handing it to everybody who ignored the invitation would undo
  the rule the accepted screen exists to enforce. It is asserted in
  `components/invitation/RsvpClosed.spec.tsx` and `e2e/invitation-closed.spec.ts`,
  so overruling it is a visible change to two named tests rather than a quiet
  one. **One line in `RsvpClosed` if they want it the other way.**
- **A household that declines cannot get through the gate in the browser
  suite, and it is newly visible rather than newly broken.**
  `console-wedding.spec.ts:226` times out at the decline radio. The trace says
  the gate SUCCEEDED: the unlock POST answered 200 in 37ms carrying
  `x-action-redirect: /i/<slug>;push`, and then the browser never performed
  that navigation — no second GET, the page still on the gate with its submit
  disabled. So the server is right and the client-side redirect is where it
  stops. U44 did not cause it and reverting U44's console paging does not
  change it; none of the five paged reads is on the guest gate's path. What
  U44 changed is that the test RUNS: the baseline died in the same file's
  `beforeAll` at `declareDevice`, so everything from test 123 onward has not
  executed here in four units. It needs its own look, at Next 16.3.4's
  handling of `redirect()` inside a `useActionState` action.
- **The two batched `dispatch_events` reads are bounded by their filter and
  not by their result, and the arithmetic is worth writing down.**
  `readDispatchStates` in `guest-directory.ts` and `readDispatchEvents` in
  `invitations.ts` chunk the `in` filter at 100 invitation ids — which bounds
  the request line, which is what `IDS_PER_READ` was for, and says nothing
  about how many rows come back. Ten operator actions per household across one
  batch of 100 reaches PostgREST's thousand, and the answer would be a wrong
  dispatch state shown in the console with no error: the same silent shape U44
  removed everywhere else. It holds 288 rows across the entire database today
  against ~200 households, so U44 judged it distant and left it, because
  paging it adds a round trip per batch to the console's slowest read. If
  `dispatch_events` ever grows an automatic writer, this stops being distant.
- **A two-person invitation still overflows an iPhone 14 by 17 pixels, and
  the couple chose that knowingly.** U45 closed the decision this entry used
  to be waiting for: the counter and the hairline leave the list of who is
  coming for households of three or more, three now fits, and the four-person
  canary is 26 over instead of 125. What remains is the size they kept the
  counter on. **The 17 pixels are real** — the document is 681 tall on a
  664-pixel screen — and they are all the form's own bottom padding: "Volver
  a la pregunta" ends at 653, so nothing is hidden and nothing is out of
  reach. The page can be nudged, which is the whole cost, and it is the
  couple's to reverse: one call to `attendeesScreenFitsCountdown` decides it,
  and dropping the threshold to two would take the counter off that screen as
  well and make it 1.00. **Recorded rather than fixed, because they were
  explicit: "con dos personas si se ve bien."**
- **Nothing in this product enforces "las invitaciones a la final van a ser 3
  personas como maximo".** Not the schema (`invitation_guests` has no
  row-count constraint and no counting trigger; the only column that ever
  carried an upper bound was dropped by 0013), not the console
  (`DraftRefusal` has no code for "too many members", so there is nothing an
  operator could be shown), and not the importer
  (`scripts/import-guests.ts` counts members for its report and bounds
  nothing). The ceiling moved from four to three at U45 and nothing about
  that is enforced either. Until something does, a layout tuned to three
  breaks silently the first time somebody adds a fourth — so the geometry
  guard keeps a **four-person** fixture as a canary, one above whatever the
  ceiling is, and the rule itself is a product decision with a migration and
  a console message behind it, not something to invent here.
- **A household that declines, reconsiders, and is then refused reaches 680
  pixels on an iPhone 14** — 16 over. It is the only state carrying both the
  line naming the current answer and a two-line refusal in a 40-pixel slot.
  The guard has never measured it and U38 made it at least 20 pixels better
  rather than worse; the honest fixes are a bigger reservation or a shorter
  refusal, and both are copy decisions.
- The couple have not filled the wedding's own facts, so the invitation still
  renders `{{VENUE_NAME}}` and `{{VENUE_ADDRESS}}`. That is deliberate — the
  placeholders are visible rather than hidden, so an unfinished invitation
  cannot pass for a finished one — and it is theirs to do at `/console/wedding`.
- The `Dirección` line is gone, which answers the question U33 left open in the
  negative: the map is the only navigable answer, so the line beside it was the
  one a guest could not act on. `venue_address` stays in the row and in the
  console. If the couple want a landmark ("a 10 minutos al sur de Buga") on the
  last screen, that is a line to add back deliberately, not a placeholder to
  leave printing.
- U36 makes that question sharper rather than settling it. The map picture
  carried an `alt` that named the town — "el salón Villa Campestre está señalado
  al sur de Buga, junto a la Troncal de Occidente" — and it was the only place
  in the product that told a guest who cannot see the screen roughly WHERE the
  venue is before they open Google Maps. It went with the picture, because a
  description of a picture that is not there is a lie. Nothing replaced it: the
  last screen now says the venue's name and offers a route. One short landmark
  line under `Lugar` would give it back to everybody, sighted or not, and it is
  a sentence the couple have to write, not one to invent for them.
- "Nos alegra mucho invitarlos a celebrar nuestro matrimonio." is no longer on
  the invitation. It repeated the WhatsApp message that brings a guest here and
  cost the question screen a tenth of its height. Theirs to overrule — the price
  is stated in U34.
- A refused gate was eight pixels taller than an iPhone 14 screen at U36 — it
  was twelve until U35 absorbed a section gap into the panel. It has NOT been
  re-measured since U37 moved the form to the foot of the screen, and the move
  cuts both ways: the panel no longer competes with the announcement for the
  middle, but it grows upward into it when a refusal wraps. The gate is the one
  surface deliberately left free to scroll, so this is a degradation rather
  than a defect either way — but the number in this list is now stale rather
  than measured.
- The submit button is quiet against the photograph. That was written here as
  "legible and unambiguous, since it is the only one", and U35 measured it:
  2.94:1 on a Pixel 7, against a 4.5:1 minimum. It was quiet because it was
  half-readable. On the gate's panel it now measures 11.7:1 and 13.1:1 without
  the button itself changing at all, so what is left really is a question of
  weight rather than of legibility — and still one the couple may want to
  overrule.
- The gate's card no longer covers the couple, which closes the question U35
  left open here. It said a guest opening the invitation "no longer sees Luis
  and Michell until they are through the gate", and offered a different
  photograph as the only way out. U37 answered it by moving the card instead:
  at 66%–96% it sits over their legs and the dark ground below, and both faces
  are clear above it. The two cards on the screens behind the gate still cover
  them, and there the picture is the point rather than the subject.
- The affirmative answer is "¡Sí, acepto!" for everybody, and the refusal is
  still inflected — so a household is asked "¿Podrán acompañarnos?" and offered
  "¡Sí, acepto!" beside "No podemos acompañarlos". **Asked and confirmed at
  U38, and no longer open:** the mixture was put to the couple — a household
  of four is addressed in the plural and answers in the singular — and they
  chose to keep `¡Sí, acepto!` for every invitation whatever its size. The
  hedge in `rsvp-copy.ts` that offered "¡Sí, aceptamos!" as a one-line change
  is rewritten to say so, because a settled decision that reads like an
  oversight is one a later reader tidies away.
- An accepted answer cannot be changed from inside the invitation any more.
  That was put to the couple before it was built and chosen; what it leaves is
  a household that ticks three people and then loses one, with nothing on the
  page to press. `currentRsvpSentence`'s attending branch and the seeding of
  the checkboxes from a stored acceptance are kept but unreachable, so putting
  the button back is one element rather than a rewrite.
- At 1280×720 the question screen is 768 pixels tall. It was 772 before U37, so
  the pass improved it and left it over: it is a desktop window shorter than
  one step's content, and the one-screen guard is a phone guard by
  construction. Nothing on that screen is clipped; the window scrolls.
