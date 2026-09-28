import { describe, expect, it } from "vitest";

import {
  CEREMONY_MINUTES,
  buildCeremonyCalendarEvent,
  buildStreamCalendarEvent,
  googleCalendarUrl,
} from "./calendar-event";
import { VENUE_COORDINATES } from "./wedding-day";

const START = new Date("2026-11-28T17:00:00-05:00");
const FACTS = {
  coupleNames: "Luis & Michell",
  streamUrl: "https://meet.google.com/abc-defg-hij",
};

const EVENT = buildStreamCalendarEvent(FACTS, START);

describe("buildStreamCalendarEvent", () => {
  it("names the couple in the title", () => {
    expect(EVENT.title).toContain("Luis & Michell");
  });

  it("carries the joining details in the description", () => {
    expect(EVENT.description).toContain(FACTS.streamUrl);
  });

  /**
   * The identifier is derived from the instant, not random.
   *
   * A calendar treats UID as the identity of the event: a guest who adds it
   * twice should end up with ONE entry that got updated, not two that both
   * fire. A fresh random id per request guarantees the duplicate.
   */
  it("gives the event a stable identity", () => {
    const again = buildStreamCalendarEvent(FACTS, START);

    expect(again.uid).toBe(EVENT.uid);
    expect(EVENT.uid).toMatch(/20261128T220000Z/);
  });
});

describe("googleCalendarUrl", () => {
  const url = new URL(googleCalendarUrl(EVENT));

  it("points at Google's event template", () => {
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.pathname).toBe("/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });

  it("spans the ceremony, an hour by default", () => {
    expect(CEREMONY_MINUTES).toBe(60);
    expect(url.searchParams.get("dates")).toBe(
      "20261128T220000Z/20261128T230000Z",
    );
  });

  it("carries the joining details, encoded rather than escaped", () => {
    const details = url.searchParams.get("details") ?? "";

    // Google reads a query parameter, not an iCalendar TEXT value, so the
    // backslash escaping that the file needs would arrive as literal
    // backslashes in the guest's event.
    expect(details).toContain(FACTS.streamUrl);
    expect(details).not.toContain("\\,");
  });
});

/*
  A `buildIcs` SUITE STOOD HERE: the folding at 75 octets, the escape order,
  the two alarms asserted as instants, and the proof that the evening one
  moved with the ceremony rather than drifting.

  All of it went with the file. The couple tested the download on a real
  phone and removed the button — "el .ics realmente intenta descargar un
  archivo" — which is the same reason they removed it the first time, and
  the experiment they asked for is what settled it. Tests for a builder
  nothing builds are tests about nothing; git holds them.

  WHAT THE DELETION COSTS, ASSERTED BELOW RATHER THAN MOURNED HERE: the file
  was the only output that could carry a reminder. `googleCalendarUrl` has
  no parameter for one and the entry inherits the guest's own default.
*/

/**
 * THE PRIVACY LINE, WHICH IS THE ONE THING IN THIS FILE THAT IS NOT A
 * CONVENIENCE.
 *
 * The venue is told only to a household that says it is coming. A calendar
 * entry is forwarded exactly like a link — more durably, in fact, since it
 * lands in a file and an app rather than in a chat — so an address in a
 * declining household's entry travels further than anything the page ever
 * showed them.
 *
 * Asserted from both directions: the ceremony entry HAS the location, and the
 * stream entry has no trace of it in either output.
 */
describe("which entry may name the venue", () => {
  const CEREMONY_EVENT = buildCeremonyCalendarEvent(
    { ...FACTS, venueName: "Salón para Eventos Villa Campestre" },
    START,
  );

  /**
   * THE LOCATION IS A POINT, NOT A NAME — AND THAT IS A FIX, NOT A STYLE.
   *
   * It read `Villa Campestre (3.853778,-76.2971633)` for one pass and the
   * couple found it on a real phone: tapping it opened a DIFFERENT venue.
   * Google text-searched the name and treated the parenthesised pair as
   * decoration, matching some other Villa Campestre — the link they were
   * sent carries `ftid=0x8e38599a77a5ec99:...` where their own venue is
   * `0x8e39e561ae218207:...`.
   *
   * Google's URL documentation says a query "may be a place name, address,
   * or comma-separated latitude/longitude coordinates". A bare pair is the
   * coordinate form; a name beside it is a name search. So the assertion is
   * the shape of the value, not merely that the numbers appear somewhere in
   * it — the bug was that they appeared and were ignored.
   */
  it("gives an accepted household a point, not a name to search for", () => {
    expect(CEREMONY_EVENT.location).toBe(VENUE_COORDINATES);
    expect(CEREMONY_EVENT.location).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);

    const url = new URL(googleCalendarUrl(CEREMONY_EVENT));

    expect(url.searchParams.get("location")).toBe(VENUE_COORDINATES);
  });

  /**
   * AND THE NAME IS STILL SOMEWHERE A GUEST CAN READ IT.
   *
   * A calendar entry whose location is two decimals helps a maps
   * application and nobody else, so the venue is named in the description —
   * which is the half of this the couple also asked to be rewritten.
   */
  it("names the venue where the guest reads it", () => {
    expect(CEREMONY_EVENT.description).toContain(
      "Salón para Eventos Villa Campestre",
    );
    expect(CEREMONY_EVENT.location).not.toContain("Villa");
  });

  /**
   * THE SAME COORDINATE THE DIRECTIONS BUTTON USES, which is why it lives in
   * the domain rather than inside `VenueMap`. Two copies are two venues the
   * day somebody edits one, and the guest finds out on the afternoon of the
   * wedding.
   */
  it("sends the calendar to the same point the map does", () => {
    expect(VENUE_COORDINATES).toBe("3.853778,-76.2971633");
    expect(CEREMONY_EVENT.location).toBe(VENUE_COORDINATES);
  });

  it("tells a stream guest nothing about where it is", () => {
    const url = googleCalendarUrl(EVENT);

    expect(EVENT.location).toBeUndefined();
    expect(url).not.toContain("location=");

    // Not by name and not by number — the coordinate is the one that would
    // survive a search-and-replace of the venue's name.
    for (const output of [url, decodeURIComponent(url)]) {
      expect(output).not.toContain(VENUE_COORDINATES);
      expect(output).not.toContain("3.853778");
      expect(output).not.toContain("Villa Campestre");
    }
  });

  it("writes no empty location for the entry that has none", () => {
    expect(new URL(googleCalendarUrl(EVENT)).searchParams.has("location")).toBe(
      false,
    );
  });
});

/**
 * WHAT EACH ENTRY SAYS, AND WHY THEY DO NOT SAY THE SAME THING.
 *
 * "El comentario esta horrible: 'Nos casamos y los acompañamos por Google
 * Meet.'" — the couple, reading it on their phone. The screenshot was the
 * ACCEPTED household's entry, which carries the venue, and it spoke in the
 * stream's voice as though they were watching from home. Two entries, two
 * audiences: one is travelling to a place, the other is joining a call.
 */
describe("what the two entries say", () => {
  const CEREMONY = buildCeremonyCalendarEvent(
    { ...FACTS, venueName: "Salón para Eventos Villa Campestre" },
    START,
  );

  it("tells a household that is coming where, and that it is streamed too", () => {
    expect(CEREMONY.description).toContain(
      "Los esperamos en Salón para Eventos Villa Campestre",
    );
    expect(CEREMONY.description).toContain(FACTS.streamUrl);
    expect(CEREMONY.description.toLowerCase()).toContain("también");
  });

  it("tells a guest who is watching how, and nothing about where", () => {
    expect(EVENT.description).toContain("en vivo");
    expect(EVENT.description).toContain(FACTS.streamUrl);
    expect(EVENT.description).not.toContain("Villa Campestre");
    expect(EVENT.description).not.toContain("Los esperamos en");
  });

  /**
   * AND NEITHER SHOUTS.
   *
   * `rsvpConfirmedHeading` and `rsvpDeclinedHeading` set the register for
   * this product — flat, vocative, no exclamation marks — and a calendar
   * entry is read in a list, so both are short.
   */
  it("is written the way the rest of this product is written", () => {
    for (const description of [CEREMONY.description, EVENT.description]) {
      expect(description).not.toMatch(/[¡!]/);
      expect(description.split("\n")[0].length).toBeLessThanOrEqual(90);
    }
  });

  /**
   * AND NEITHER IS THE OLD ONE — the permanent negative control for a
   * sentence the couple rejected by name.
   */
  it("no longer says the line the couple called horrible", () => {
    for (const description of [CEREMONY.description, EVENT.description]) {
      expect(description).not.toContain(
        "Nos casamos y los acompañamos por Google Meet.",
      );
    }
  });
});
