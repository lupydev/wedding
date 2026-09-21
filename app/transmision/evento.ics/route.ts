import {
  buildIcs,
  buildStreamCalendarEvent,
} from "@/lib/domain/calendar-event";
import { WEDDING_INSTANT } from "@/lib/domain/wedding-day";
import { getCeremony } from "@/lib/server/ceremony";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * The ceremony as a downloadable calendar entry.
 *
 * The folder is literally named `evento.ics`, so the URL ends in the extension.
 * Several calendar clients decide what a resource is from its path before they
 * look at the content type, and one that guesses wrong shows a guest a wall of
 * text instead of an event.
 *
 * THE START COMES FROM THE CONSTANT, NOT FROM THE ROW, AND THAT IS NOT AN
 * OVERSIGHT. `ceremony.ceremony_time` is free prose an operator types — "5:00
 * p. m.", or anything else — and a calendar needs an instant. Recovering one by
 * parsing that text is a guess that fails silently on the first wording nobody
 * anticipated, and the failure is an alarm that rings on the wrong day. The
 * machine-readable instant lives in `lib/domain/wedding-day.ts`, which is the
 * same instant the countdown uses, so the page and the entry cannot disagree.
 *
 * The joining details DO come from the row: those are what the couple corrects
 * from the console, and they are what the guest needs in front of them when the
 * alarm goes off.
 */
export async function GET(): Promise<Response> {
  const ceremony = await getCeremony(createServerSupabaseClient());

  const ics = buildIcs(
    buildStreamCalendarEvent(
      {
        coupleNames: ceremony.coupleNames,
        streamMeetingId: ceremony.streamMeetingId,
        streamPasscode: ceremony.streamPasscode,
      },
      WEDDING_INSTANT,
      new Date(),
    ),
  );

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      /*
       * `attachment`, chosen over `inline` after weighing both.
       *
       * Inline, iOS and macOS hand the file straight to Calendar, which is
       * lovely — and a desktop browser renders it as raw text, which is a wall
       * of `BEGIN:VEVENT` and a guest who thinks the page is broken.
       * `attachment` costs one extra tap everywhere and works everywhere, and
       * the filename is what the guest sees in their downloads.
       */
      "content-disposition": 'attachment; filename="boda.ics"',
      /*
       * Never cached. The meeting id and passcode are exactly the values the
       * couple may correct an hour before the ceremony, and a cached entry is
       * an alarm that rings with the old passcode attached.
       */
      "cache-control": "no-store",
    },
  });
}
