import type { Metadata } from "next";

import compromiso from "@/img/compromiso.jpg";

import { PhotoStage } from "@/components/landing/PhotoStage";
import { SaveTheDate } from "@/components/landing/SaveTheDate";
import { StreamLink } from "@/components/landing/StreamLink";
import { COUPLE_NAMES, formatWeddingDate } from "@/lib/domain/wedding-day";

/**
 * The public save-the-date.
 *
 * THIS IS NOT THE INVITATION AND IT MUST NEVER BECOME ONE.
 *
 * `/` is public and indexable. It carries the couple, the day and a countdown —
 * nothing else. No guest name, no address, no phone number, no RSVP: those live
 * at `/i/[slug]` behind the phone gate, and `app/robots.ts` keeps that prefix
 * out of every search index precisely because an invitation URL is an unlisted
 * capability. Adding a venue or a stream credential to this file would move a
 * private fact onto a page anyone can find.
 *
 * The route composes and does not decide. All copy lives in `SaveTheDate`; the
 * only thing this file owns is the photograph, the scrim over it, and where the
 * two blocks sit on top.
 */

/**
 * What a crawler and a WhatsApp preview see.
 *
 * `metadataBase` is set once in `app/layout.tsx`, so the relative image path
 * below resolves to an absolute HTTPS URL. Without it the emitted `og:image`
 * stays relative and no external crawler can fetch it — the same trap the
 * per-guest card at `/i/[slug]/opengraph-image.tsx` already documents.
 *
 * `compromiso.src` rather than a written path: the static import is
 * content-hashed at build time, so a literal would break on the first change to
 * the photograph and would do it silently, in the preview card only.
 */
const TITLE = `${COUPLE_NAMES} — ${formatWeddingDate()}`;
const DESCRIPTION = "Nos casamos, y queremos celebrarlo con ustedes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "es_CO",
    images: [
      {
        url: compromiso.src,
        width: compromiso.width,
        height: compromiso.height,
        alt: `${COUPLE_NAMES}, tomados de la mano frente a una cascada`,
      },
    ],
  },
};

export default function Home() {
  return (
    <PhotoStage overlayOnMobile>
      <div
        className="
          relative col-start-1 row-start-1 flex min-h-dvh flex-col items-center
          justify-between gap-12 px-6 pt-10
          pb-[max(3rem,env(safe-area-inset-bottom))]
          sm:pt-14 sm:pb-14
          lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:justify-center lg:gap-9
          lg:px-4 lg:py-0
        "
      >
        <p
          className="
            font-script text-3xl text-[#f6efe2]/90
            [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]
            sm:text-4xl
          "
        >
          Nos casamos
        </p>

        {/*
          WRAPPED WITH THE LINK, AND THE WRAPPER IS NOT DECORATION.

          Below `lg` this column is `justify-between` with exactly two children:
          the script line at the top and this block at the foot. A third child
          would have made it three evenly spread rows and pushed the heading
          into the middle of the photograph, across the couple. One wrapper
          keeps the count at two.
        */}
        <div className="flex flex-col items-center gap-7">
          <SaveTheDate />

          {/*
            The door to `/transmision`, which opens in the final week.

            A client component, and it has to be: `/` is static, so a decision
            made here on the server would be frozen at build time and would
            still say "not yet" on the morning of the wedding.
          */}
          <StreamLink />
        </div>
      </div>
    </PhotoStage>
  );
}
