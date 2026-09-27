import { cookies } from "next/headers";

import {
  buildCeremonyCalendarEvent,
  buildIcs,
  buildStreamCalendarEvent,
} from "@/lib/domain/calendar-event";
import { WEDDING_INSTANT } from "@/lib/domain/wedding-day";
import { UNLOCK_COOKIE_NAME, unlockCookieUnlocks } from "@/lib/server/cookies";

import {
  loadCeremony,
  loadCurrentRsvp,
  loadInvitationRecord,
} from "../load-invitation";

/**
 * The ceremony as a downloadable calendar entry, per household.
 *
 * The folder is literally named `evento.ics`, so the URL ends in the
 * extension. Several calendar clients decide what a resource is from its path
 * before they look at the content type, and one that guesses wrong shows a
 * guest a wall of text instead of an event.
 *
 * IT LIVES UNDER `/i/[slug]` RATHER THAN ON A PUBLIC PATH, AND THAT IS THE
 * PRIVACY RULE RATHER THAN TIDINESS. The entry a household that ACCEPTED
 * saves carries the venue's location. The venue is gated behind saying you
 * are coming — the same gate `RsvpAnswer` enforces on screen and the closed
 * screen enforces for a household that never answered — so the file that
 * carries it has to sit behind the same unlock cookie, checked against THIS
 * invitation exactly as the page checks it.
 *
 * AND THE CONTENT FOLLOWS THE ANSWER, NOT THE URL. One household, one path,
 * and what comes back depends on what they told the couple: an accepted
 * household gets the entry with the location, everybody else gets the stream
 * entry with no trace of a venue. A guest who forwards their file forwards
 * what they were allowed to have.
 *
 * THE START COMES FROM THE CONSTANT, NOT FROM THE ROW. A calendar needs an
 * instant, and `WEDDING_INSTANT` is the same one the countdown and the
 * on-screen hour read, so the page and the entry cannot disagree. The joining
 * link DOES come from the row: that is what the couple corrects from the
 * console, and it is what a guest needs in front of them when the alarm goes
 * off.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const record = await loadInvitationRecord(slug);

  if (record === null) {
    return new Response("No encontrado", { status: 404 });
  }

  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value ?? "";

  /*
    THE SAME ANSWER AN UNKNOWN SLUG GETS, AND DELIBERATELY SO. A locked
    invitation and a nonexistent one are indistinguishable from outside, so
    this endpoint cannot be used to discover which slugs are real.
  */
  if (!unlockCookieUnlocks(unlockCookie, record.id)) {
    return new Response("No encontrado", { status: 404 });
  }

  const [ceremony, current] = await Promise.all([
    loadCeremony(),
    loadCurrentRsvp(record.id),
  ]);
  const facts = {
    coupleNames: ceremony.coupleNames,
    streamUrl: ceremony.streamUrl,
  };
  const event =
    current !== null && current.attending
      ? buildCeremonyCalendarEvent(
          { ...facts, venueName: ceremony.venueName },
          WEDDING_INSTANT,
        )
      : buildStreamCalendarEvent(facts, WEDDING_INSTANT);

  return new Response(buildIcs(event, new Date()), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      /*
       * `attachment`, chosen over `inline` after weighing both.
       *
       * Inline, iOS and macOS hand the file straight to Calendar, which is
       * lovely — and a desktop browser renders it as raw text, which is a
       * wall of `BEGIN:VEVENT` and a guest who thinks the page is broken.
       * `attachment` costs one extra tap everywhere and works everywhere, and
       * the filename is what the guest sees in their downloads.
       *
       * WHICH OF THOSE TWO A PHONE ACTUALLY DOES is the thing the couple
       * asked to find out — "probemos qué sucede en un android e iphone" —
       * so this is the behaviour they are testing rather than a settled
       * choice.
       */
      "content-disposition": 'attachment; filename="boda.ics"',
      /*
       * Never cached, and never by a shared cache. The joining link is a
       * value the couple may correct an hour before the ceremony, and the
       * response differs per household: a cached copy is either an alarm
       * carrying a dead link or one household's entry handed to another.
       */
      "cache-control": "private, no-store",
    },
  });
}
