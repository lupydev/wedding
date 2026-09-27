import type { Metadata } from "next";
import { connection } from "next/server";

import { StreamInvitation } from "@/components/invitation/StreamInvitation";
import { PhotoStage } from "@/components/landing/PhotoStage";
import { ENGAGEMENT_PHOTO } from "@/components/landing/photos";
import { getCeremony } from "@/lib/server/ceremony";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * The public invitation for everybody who joins the ceremony over Zoom.
 *
 * WHY THIS IS A SEPARATE ROUTE AND NOT A SECTION OF THE LANDING.
 *
 * `/` is crawlable on purpose: it is the link the couple send, and the card
 * WhatsApp renders is built by fetching it and reading its `og:` tags. This
 * page carries a live meeting id and its passcode, and public is not the same
 * as indexed — in a search index those are findable by anyone searching for
 * anything, which is how a ceremony gets crashed by strangers. So the
 * credentials live here, on a path `app/robots.ts` disallows, one click from a
 * landing page that keeps its card.
 *
 * NONE OF THAT IS SECURITY. Any guest can forward the link, and what protects
 * the call is Zoom's waiting room. The split only stops a stranger tripping
 * over the ceremony while searching for something else.
 *
 * NO GATE, DELIBERATELY. The phone gate at `/i/[slug]` exists because a
 * personal invitation belongs to one household and seats have to be counted. A
 * stream has neither: there is no seat to allocate and no headcount to plan, so
 * a gate here would protect nothing and would lock out precisely the guests
 * this page was built for — the ones too far away to be in the room.
 *
 * IT STANDS ON THE SAME STAGE AS THE LANDING. `PhotoStage` owns the dark
 * ground, the blurred backdrop and the framed photograph, so a guest who taps
 * through from `/` arrives somewhere that is obviously the same wedding rather
 * than a second site. Without the mobile overlay, though: this page's content
 * is a card of credentials and two paragraphs, which is unreadable laid over a
 * photograph and pushed off the screen stacked below one.
 *
 * IT IS RENDERED PER REQUEST, AND SAYING SO TAKES A LINE OF CODE.
 *
 * Reading the database is NOT enough to make a route dynamic. Next has no way
 * to know a promise touches a network, so with no request-time API in sight it
 * prerendered this page at build time — measured, not assumed: the first build
 * reported it as `○ (Static)`, with the meeting id and passcode baked into the
 * output. Correcting either from the console would then have changed nothing
 * until the next deploy, and it would have failed silently, on the one day it
 * matters.
 *
 * `await connection()` is how the installed Next says to fix that. Its own
 * docs, at `04-functions/use-search-params.md:264`: "Previously, setting
 * `export const dynamic = 'force-dynamic'` on the page was used to force
 * dynamic rendering. Prefer using `connection()` instead, as it semantically
 * ties dynamic rendering to the incoming request."
 *
 * The landing stays static, deliberately. Nothing on it changes on the day.
 */

const TITLE = "Acompáñanos por Google Meet";
const DESCRIPTION =
  "Vamos a transmitir la ceremonia en vivo. Acá están los datos para entrar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  /*
   * BELT AND BRACES WITH `app/robots.ts`, AND THE TWO ARE NOT REDUNDANT.
   *
   * `robots.txt` asks a crawler not to FETCH the page; this meta tag tells one
   * that fetched it anyway not to INDEX what it found. They fail in different
   * directions — a crawler that ignores the file, a link followed from
   * somewhere else — and the credentials below are worth both.
   */
  robots: { index: false, follow: false },
};

export default async function StreamPage() {
  // Prerendering stops here. Everything below runs per request, so a meeting id
  // corrected in the console is live on the next reload.
  await connection();

  /*
   * `getCeremony` throws when the singleton row is missing rather than
   * returning null, and that is what should happen: a page that quietly
   * rendered blank details would send a guest to a call that does not exist,
   * with nothing anywhere saying why.
   */
  const ceremony = await getCeremony(createServerSupabaseClient());

  /*
   * THE CALENDAR ENTRY WAS BUILT HERE AND IS NOT ANY MORE.
   *
   * This route composed `buildStreamCalendarEvent(...)` with `WEDDING_INSTANT`
   * and handed the resulting link down as a prop. The couple asked for the
   * same button on the screen a household reaches by declining, which renders
   * the same `StreamDetails` block from a different route — and building it
   * twice is how two screens end up offering the same wedding at two
   * different times. It is built inside that block now, from the row this
   * page already passes it and the same instant the countdown runs on.
   *
   * The paragraph that stood here is worth keeping, because it is the reason
   * the instant is a constant at all: a `ceremony_time` column used to sit
   * beside it, free prose an operator typed — "5:00 p. m.", or anything else
   * — while a calendar needs an instant. Recovering one by parsing the text
   * is a guess that fails silently on the first wording nobody anticipated,
   * and its failure mode is a reminder that fires on the wrong day. Nothing
   * ever read it, so migration 0018 dropped it along with `ceremony_date`.
   */

  return (
    <PhotoStage mobilePhoto="overlay" photo={ENGAGEMENT_PHOTO}>
      {/*
        THE SAME COLUMN AS THE LANDING, ON PURPOSE.

        `justify-between` with two groups, one in each band the photograph
        leaves empty: the welcome above the couple, the joining details on the
        path below them. The couple asked for the two pages to read as one, and
        this is the shape that does it — a guest tapping through from `/` lands
        on the same layout with different words in it.
      */}
      <div
        className="
          flex min-h-dvh flex-col items-center
          justify-between gap-8 px-6 pt-8
          pb-[max(1.75rem,env(safe-area-inset-bottom))]
          sm:pt-12 sm:pb-10
          lg:min-h-0 lg:justify-center lg:gap-10
          lg:px-4 lg:py-0
        "
      >
        {/*
          The stream address and the couple's names come from the row and
          nothing else, and they are the ONLY values this page hands down. The
          venue and its street are on that same row and are NOT passed:
          `StreamInvitation`'s prop type has no field for them, so this page
          cannot leak an address even by a careless edit here.

          `coupleNames` is new here and it is not for the announcement —
          `SaveTheDate` reads the domain for that. It is the title of the
          calendar entry, which `StreamDetails` now builds so that this page
          and the declined screen cannot describe the same wedding
          differently.
        */}
        <StreamInvitation
          ceremony={{
            streamUrl: ceremony.streamUrl,
            coupleNames: ceremony.coupleNames,
          }}
        />
      </div>
    </PhotoStage>
  );
}
