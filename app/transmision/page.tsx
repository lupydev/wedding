import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import compromiso from "@/img/compromiso.jpg";

import { StreamInvitation } from "@/components/invitation/StreamInvitation";
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
 * personal invitation belongs to one household and seats have to be counted.
 * A stream has neither: there is no seat to allocate and no headcount to plan,
 * so a gate here would protect nothing and would lock out precisely the guests
 * this page was built for — the ones too far away to be in the room.
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

const TITLE = "Acompáñanos por Zoom";
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

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 overflow-hidden bg-[#0d1114] px-6 py-14">
      {/*
        The same photograph as the landing, blurred, so a guest arriving from
        `/` lands somewhere that is obviously still the same wedding. Requested
        at 64px: it is unfocusable by construction, so a full-resolution copy
        would buy nothing and cost megabytes.

        BRIGHTENED AND SATURATED, BECAUSE DIMMED IT WAS NOTHING. The photograph
        is a dusk shot and already close to black; blurred and dropped to 45%
        opacity it rendered as flat black and the continuity this exists for
        simply was not there. Lifting the exposure brings back the greens and
        the lantern's gold as a wash, which is the thing worth keeping.
      */}
      <Image
        src={compromiso}
        alt=""
        aria-hidden="true"
        fill
        preload={false}
        sizes="64px"
        className="scale-110 object-cover opacity-70 blur-3xl brightness-150 saturate-150"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-black/65"
      />

      <div className="relative flex w-full flex-col items-center gap-10">
        {/*
          `coupleNames` and the four stream values come from the row and nothing
          else. The venue and its address are on that same row and are NOT
          passed: `StreamInvitation`'s prop type has no field for them, so this
          page cannot leak an address even by a careless edit here.
        */}
        <StreamInvitation
          ceremony={{
            coupleNames: ceremony.coupleNames,
            ceremonyDate: ceremony.ceremonyDate,
            ceremonyTime: ceremony.ceremonyTime,
            streamMeetingId: ceremony.streamMeetingId,
            streamPasscode: ceremony.streamPasscode,
          }}
        />

        <Link
          href="/"
          className="
            rounded-full border border-[#f6efe2]/25 px-5 py-2 text-sm
            text-[#f6efe2]/80 transition-colors
            duration-(--console-motion-fast) ease-(--ease-console-out)
            hover:bg-black/30 hover:text-[#f6efe2]
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-[#f6efe2]
          "
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
