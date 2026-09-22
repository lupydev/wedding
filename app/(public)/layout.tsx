import { MusicToggle, SONG_SRC } from "@/components/landing/MusicToggle";

/**
 * Every guest-facing page, and the one song that plays across them.
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
 * THE INVITATION PLAYS IT TOO, FROM ITS OWN LAYOUT, AND THAT IS NOT A CHOICE.
 *
 * The couple asked for the song there — "tener en cuenta lo de la canción en
 * esta página como en la siguiente" — and the obvious move was to bring
 * `/i/[slug]` into this group, since a route group changes no URL.
 *
 * It changes ONE, and it is load-bearing. Inside a group Next renames the
 * `opengraph-image` route to a hashed SEGMENT — `/i/[slug]/opengraph-image-1gh5xv`
 * — so the clean path 404s. `lib/server/og-warm.ts` fetches exactly that clean
 * path on purpose: its own comment explains that Next appends a build-scoped
 * hash as a QUERY to the `og:image` it emits, and warming the unhashed path is
 * what makes the warm reusable across builds. Four browser tests said so
 * within a minute of the move.
 *
 * So `app/i/[slug]/layout.tsx` mounts the same control. Two mounts, and the
 * "one element across navigations" reasoning above does not apply between them:
 * a guest arrives at the invitation from a WhatsApp message and never
 * client-navigates from it to the landing, so there is no navigation for an
 * element to survive.
 *
 * WHY A ROUTE GROUP RATHER THAN THE ROOT LAYOUT. `(public)` changes no URL —
 * the pages are still `/` and `/transmision` — but it scopes this layout to
 * exactly those two. In `app/layout.tsx` the song would also reach `/console`,
 * where an operator is working through forty households.
 */

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
