import { MusicToggle } from "@/components/landing/MusicToggle";

/**
 * The two public pages, and the one song that plays across both.
 *
 * WHY THE CONTROL LIVES HERE AND NOT ON EACH PAGE.
 *
 * `/` and `/transmision` navigate to each other through `<Link>`, which is a
 * CLIENT-SIDE navigation: React swaps the page's tree and leaves the layout
 * alone. Rendered inside each page, `MusicToggle` would be unmounted and a
 * fresh one mounted on every tap — a new `<audio>` element, the song back at
 * zero, and the autoplay attempt running all over again. A song that restarts
 * every time somebody follows a link is worse than no song.
 *
 * In a layout it survives. The installed Next says so in as many words:
 * "Layouts do not re-render on navigation"
 * (`03-file-conventions/layout.md:240`). The element persists, playback
 * continues, and the button keeps saying the truth.
 *
 * WHY A ROUTE GROUP RATHER THAN THE ROOT LAYOUT. `(public)` changes no URL —
 * the pages are still `/` and `/transmision` — but it scopes this layout to
 * exactly those two. In `app/layout.tsx` the song would also reach
 * `/console`, where an operator is working, and `/i/[slug]`, which is a
 * different surface with its own voice.
 */

/** Served from `public/`, which is the only folder Next serves verbatim. */
const SONG_SRC = "/audio/nuestra-cancion.mp3";

export default function PublicLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <>
      {children}

      {/*
        Top right on both pages, clear of the notch and of every band of text.
        `fixed` rather than `absolute` so it stays reachable if either page ever
        grows past one screen.
      */}
      <div className="fixed top-[max(1.25rem,env(safe-area-inset-top))] right-5 z-10">
        <MusicToggle src={SONG_SRC} />
      </div>
    </>
  );
}
