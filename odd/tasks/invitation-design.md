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

## Next

- The couple have not filled the wedding's own facts, so the invitation still
  renders `{{VENUE_NAME}}` and `{{VENUE_ADDRESS}}`. That is deliberate — the
  placeholders are visible rather than hidden, so an unfinished invitation
  cannot pass for a finished one — and it is theirs to do at `/console/wedding`.
- The submit button is quiet against the photograph. Legible and unambiguous,
  since it is the only one, but a judgement the couple may want to overrule.
