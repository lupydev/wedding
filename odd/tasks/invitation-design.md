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

## Next

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
- "Nos alegra mucho invitarlos a celebrar nuestro matrimonio." is no longer on
  the invitation. It repeated the WhatsApp message that brings a guest here and
  cost the question screen a tenth of its height. Theirs to overrule — the price
  is stated in U34.
- A refused gate is twelve pixels taller than an iPhone 14 screen. The gate is
  the one surface deliberately left free to scroll, so this is a degradation
  rather than a defect, but it is the only number in the feature that is not
  1.00.
- The submit button is quiet against the photograph. Legible and unambiguous,
  since it is the only one, but a judgement the couple may want to overrule.
