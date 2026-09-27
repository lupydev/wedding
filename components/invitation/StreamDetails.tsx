/**
 * The way in to the ceremony, wherever it is offered.
 *
 * ONE BLOCK, TWO SURFACES, AND THAT IS THE WHOLE REASON IT EXISTS.
 *
 * `CeremonyStream` shows this to a household behind the phone gate that told us
 * they cannot come in person. `/transmision` shows it to everybody else,
 * publicly. Migration 0009 states the rule for the row itself — "every surface
 * that shows them MUST read this row; never restate a value" — and this file is
 * that rule one level up: the label, the safety attributes on the link and the
 * decision about what an unfinished row looks like are written once.
 *
 * IT USED TO BE A LIST OF CREDENTIALS, AND THE HISTORY EXPLAINS THE SHAPE.
 *
 * Zoom is a meeting id and a passcode: values a guest READS and TYPES into
 * another application, on a phone, often while the ceremony has already
 * started. So this rendered them large, in a description list, each with a
 * button that removed the typing — a surface built for transcription, in a
 * grotesque with tabular figures so a 1 could not become a 7.
 *
 * Google Meet is one address, and the guest presses it. The couple removed the
 * printed address once the control existed — "en vista de que existe un botón
 * de ingresar a la reunión no valdría la pena tener el link para copiar" — and
 * with it went the copy button, the tabular figures, the description list and
 * this component's client boundary. What is left is a link.
 *
 * WHAT THAT COST, STATED RATHER THAN GLOSSED. A household behind the gate who
 * wants the address on a second device has to open their invitation there
 * instead of pasting a link. On `/transmision` nothing is lost at all: the page
 * is public, so forwarding it does everything forwarding the address did and
 * carries the day and the counter too.
 *
 * Props-only. It performs no data access, and its prop type has no field for a
 * phone number or a guest, so neither can reach it by accident.
 *
 * NO PALETTE OF ITS OWN, AND THAT IS LITERALLY TRUE. It used to SAY so while
 * reaching for `--foreground`, `--paper-hint` and `--border` — the paper
 * palette, right on the invitation's cream card and resolving to near-black on
 * near-black on the stream page's dark ground, where the values were rendered
 * and invisible. Everything here is `currentColor` and opacity, so the surface
 * decides and this cannot be wrong on either.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

import { buildStreamCalendarEvent } from "@/lib/domain/calendar-event";
import { WEDDING_INSTANT } from "@/lib/domain/wedding-day";

import { CalendarActions } from "./CalendarActions";

/** The stream half of the `ceremony` row, as a component renders it. */
/**
 * Is this value somewhere a browser can actually go?
 *
 * The row is seeded with an unfinished marker and the console refuses to save
 * anything that is not an absolute `https` address, so in practice this asks
 * one question: has the couple filled it in yet? Checked here anyway rather
 * than trusted, because this component is also rendered from the operator
 * preview and from a row an older migration wrote.
 */
function isJoinable(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The one value this block needs, and there is deliberately only one.
 *
 * `ceremonyDate` and `ceremonyTime` were here too, printed above the control
 * behind `showDate` and `showTime` props that DEFAULTED TO TRUE — and both
 * callers passed false. `StreamInvitation` states the day in the announcement
 * above and runs a countdown to the hour; `CeremonyStream` sits inside the
 * invitation, under that same announcement. So the default rendered on no page
 * anybody could open, while keeping two columns alive in the schema, the read
 * model and the console form.
 *
 * The day a guest reads comes from `WEDDING_INSTANT` in
 * `lib/domain/wedding-day.ts`, and migration 0018 dropped the two columns.
 */
export interface StreamDetailsValues {
  readonly streamUrl: string;
  /**
   * AND THE ONE FACT THE CALENDAR ENTRY'S TITLE NEEDS, WHICH IS WHY IT IS
   * HERE AND NOT ONLY ON THE PAGES.
   *
   * The entry reads "Matrimonio de {coupleNames}". It is the same field of
   * the same `ceremony` row both callers already hold, so asking for it costs
   * nothing and buying the alternative — a `COUPLE_NAMES` constant read here
   * while the row is read everywhere else — would be two sources for one
   * wedding's name.
   */
  readonly coupleNames: string;
}

export function StreamDetails({
  ceremony,
  icsHref,
  className,
}: {
  readonly ceremony: StreamDetailsValues;
  /**
   * Where this household's `.ics` is served, when there is a household.
   *
   * Absent on `/transmision`, which has no invitation behind it and so no
   * answer to decide what the file may contain. Present on the screens inside
   * an invitation, where the endpoint re-reads that answer for itself.
   */
  readonly icsHref?: string;
  /** The host surface's own spacing. Never its colours. */
  readonly className?: string;
}) {
  return (
    /*
      The value is rendered exactly as the row holds it, including the seeded
      `{{...}}` placeholder. Hiding or prettifying an unfinished value would
      turn an obviously incomplete invitation into a plausible wrong one, and
      nobody would notice until a guest joined a call that does not exist.

      A `<div>`, WHERE THIS USED TO BE A `<dl role="group">`.

      It was a description list because it held terms and values: a meeting id
      and a passcode, each with its label and a button that removed the typing.
      The couple asked for the address to go — "en vista de que existe un botón
      de ingresar a la reunión no valdría la pena tener el link para copiar" —
      and a description list describing nothing is invalid markup rather than
      merely odd.

      The group name went with it. One control needs no grouping: the link
      carries its own accessible name and says where it goes.

      An optional date/time line survived that change, carrying a `dt`/`dd`
      pair of its own behind `showDate` and `showTime`. Neither caller ever
      asked for it and migration 0018 removed the columns behind it, so there
      is nothing labelled in this block at all any more.
    */
    <div
      /*
        A TEST HOOK NAMED AS ONE, WHERE A STYLING CLASS WAS PRETENDING.

        `rsvp__stream-details` carried no styles anywhere — it was already
        nothing but a locator, and five call sites across two specs and two
        browser files depended on it. A class is renamed by anybody tidying
        CSS, and the failure it produces is "element not found" five files
        away. `data-testid` says what it is and why it may not be renamed
        casually.

        It replaced a `role="group"` with an accessible name, which WAS a
        contract — but that described a list of labelled values to a reader,
        and there is one link here now.
      */
      data-testid="stream-details"
      className={`text-center ${className ?? ""}`}
    >
      {/*
        ONE CONTROL, AND ONLY WHEN THERE IS SOMEWHERE TO GO.

        The migration seeds this column with an obviously-unfinished marker.
        Rendered as a link it would be a button that fails the one time it is
        pressed; left as the text it is, it reads as a value nobody has filled
        in yet — which, now that the address is not printed anywhere else, is
        also the only thing on the page that would say so.
      */}
      {isJoinable(ceremony.streamUrl) ? (
        <a
          href={ceremony.streamUrl}
          target="_blank"
          /*
           * `noopener` first, and not decoration: without it the opened tab
           * can reach back into this one through `window.opener`, and this
           * page sits behind a phone gate.
           */
          rel="noopener noreferrer"
          className="
            flex min-h-11 w-full items-center justify-center rounded-full
            border border-current/60 bg-black/55
            px-5 py-2.5 text-center text-sm backdrop-blur-sm transition-colors
            duration-(--console-motion-fast) ease-(--ease-console-out)
            hover:bg-black/65
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-current
          "
        >
          Entrar a la transmisión
        </a>
      ) : (
        <p className="text-sm font-medium tracking-wide break-all">
          {ceremony.streamUrl}
        </p>
      )}

      {/*
        THE REMINDER, AND IT LIVES HERE SO THAT TWO SURFACES CANNOT DISAGREE
        ABOUT WHEN THIS WEDDING IS.

        It was `/transmision`'s alone: the route built the event, passed a
        `googleHref` down, and `StreamInvitation` drew the button. The couple
        asked for the same control on the declined screen, which renders THIS
        block and had no calendar of any kind — and two definitions of one
        calendar entry is the failure `components/landing/photos.ts` describes
        for the photographs, with a date attached.

        `CalendarActions` draws them because the accepted screen offers the
        same pair, and the difference between the two is the EVENT rather than
        the markup: the entry built here carries no venue, and the one built
        for an accepted household does. Passing the event in is what keeps
        that difference visible at the call site.

        ONLY WHEN THERE IS SOMEWHERE TO GO. The entry's description carries
        the address, so an unfinished row would write the seeded placeholder
        into somebody's calendar as the joining link — a reminder that looks
        correct for months and fails on the one morning it is read.
      */}
      {isJoinable(ceremony.streamUrl) ? (
        <CalendarActions
          event={buildStreamCalendarEvent(
            {
              coupleNames: ceremony.coupleNames,
              streamUrl: ceremony.streamUrl,
            },
            WEDDING_INSTANT,
          )}
          icsHref={icsHref}
          className="mt-3"
        />
      ) : null}
    </div>
  );
}
