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

## Next

- The couple have not filled the wedding's own facts, so the invitation still
  renders `{{VENUE_NAME}}` and `{{VENUE_ADDRESS}}`. That is deliberate — the
  placeholders are visible rather than hidden, so an unfinished invitation
  cannot pass for a finished one — and it is theirs to do at `/console/wedding`.
- The submit button is quiet against the photograph. Legible and unambiguous,
  since it is the only one, but a judgement the couple may want to overrule.
