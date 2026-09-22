import { MusicToggle, SONG_SRC } from "@/components/landing/MusicToggle";

/**
 * The invitation, and the same song the other two guest pages play.
 *
 * The couple asked for it: "tener en cuenta lo de la canción en esta página
 * como en la siguiente". The invitation, the landing and the stream page are
 * one wedding read a tap apart, and a song that stops here says they are not.
 *
 * WHY THIS ROUTE IS NOT SIMPLY IN THE `(public)` GROUP, WHICH ALREADY MOUNTS IT.
 *
 * Because moving it there breaks the Open Graph card. Inside a route group Next
 * renames the `opengraph-image` route to a hashed SEGMENT —
 * `/i/[slug]/opengraph-image-1gh5xv` — and the clean path stops resolving.
 * `lib/server/og-warm.ts` fetches that clean path deliberately: Next appends a
 * build-scoped hash as a QUERY to the `og:image` it emits, and warming the
 * unhashed path is what keeps a warm cache usable across builds. It was tried,
 * and four browser tests reported the 404 within a minute.
 *
 * TWO MOUNTS, AND THE COST IS NOTHING HERE. `(public)/layout.tsx` explains that
 * the control lives in a layout so the `<audio>` element survives client-side
 * navigation between `/` and `/transmision`. There is no such navigation into
 * or out of this page: a guest arrives from a WhatsApp message and leaves by
 * closing the tab. Nothing needs to survive, so nothing is lost.
 *
 * The song's path is imported rather than repeated, because two literals are
 * two songs the day somebody renames the file.
 */
export default function InvitationLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <>
      {children}

      {/*
        Top right, clear of the notch and of the photograph's band — the same
        corner the other two pages put it in, so a guest who has seen one
        already knows where it is.
      */}
      <div className="fixed top-[max(1.25rem,env(safe-area-inset-top))] right-5 z-10">
        <MusicToggle src={SONG_SRC} />
      </div>
    </>
  );
}
