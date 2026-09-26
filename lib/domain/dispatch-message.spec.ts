import { describe, expect, it } from "vitest";

import {
  DISPATCH_EVENT_BEACON_PATH,
  INVITATION_MESSAGE_TEMPLATE,
  INVITATION_MESSAGE_VARIABLES,
  buildInvitationDispatchLink,
  buildInvitationMessage,
  consoleDispatchPath,
  type DispatchCandidateGuest,
} from "./dispatch-message";

/**
 * The guest-facing WhatsApp draft, and who it is addressed to.
 *
 * Two defects from a reference project are asserted against here, because both
 * are silent and both reach a guest:
 *
 *  1. It hard-coded the date and the venue into an approved template. The event
 *     moved, the invitation page was updated, and the WhatsApp message kept
 *     announcing the old venue for weeks. So the template carries NO event fact
 *     at all: the only digits a rendered message may contain are the ones inside
 *     the invitation URL, and that is asserted rather than reviewed.
 *  2. Only the FIRST URL in a WhatsApp message produces a preview card. A second
 *     link silently costs the card that the whole Open Graph work unit exists to
 *     produce, so a message that would contain two URLs is refused.
 */

function guest(
  overrides: Partial<DispatchCandidateGuest> = {},
): DispatchCandidateGuest {
  return {
    id: "g1",
    fullName: "Ana Muñóz",
    phoneE164: "+573001234567",
    dispatchable: true,
    ...overrides,
  };
}

const INVITATION_URL = "https://boda.example/i/abcdefghijklmn23";

/**
 * The couple's names, which arrive from the `ceremony` row like every other
 * wedding fact. Digit-free on purpose: the "no date, no venue" assertion below
 * works by counting digits, and a couple who put a digit in their own names would
 * be the one legitimate way to produce one outside the URL.
 */
const COUPLE_NAMES = "Ana y Bruno";

/** One complete draft input. Every test varies a single field of it. */
function draft(overrides: Record<string, string> = {}) {
  return {
    greetingName: "Familia Muñóz",
    invitationUrl: INVITATION_URL,
    coupleNames: COUPLE_NAMES,
    ...overrides,
  };
}

describe("INVITATION_MESSAGE_TEMPLATE", () => {
  it("declares exactly three variables: the household, the couple and the link", () => {
    expect([...INVITATION_MESSAGE_VARIABLES].sort()).toEqual([
      "couple_names",
      "greeting_name",
      "invitation_url",
    ]);
  });

  /**
   * THE COUPLE'S NAMES ARE A VARIABLE. THE DATE AND THE VENUE ARE NOT, AND WILL
   * NOT BE.
   *
   * This module's own comment named the plan: "adding a signature there is a
   * template edit plus one new entry below", once real details existed. They now
   * do — in the `ceremony` row — so the draft signs off with the couple's names
   * read from that row rather than restating them or omitting them.
   *
   * What does NOT join it is the date, the time, the venue or the address. Those
   * are the four facts a reference project hard-coded into an approved template;
   * the event moved, the page was corrected in minutes, and the already-delivered
   * messages kept announcing the old venue forever. The link resolves to the one
   * surface that can still be corrected, which is the whole argument.
   *
   * Two of these names are now doubly impossible: migration 0018 dropped
   * `ceremony_date` and `ceremony_time` outright. They stay on the list for the
   * reason `wedding_date` — which was never a column at all — is on it: this
   * guard forbids NAMES in a template, not columns in a schema, and the name is
   * what somebody would reach for.
   */
  it("declares no date, time, venue or address variable, and never will", () => {
    for (const forbidden of [
      "wedding_date",
      "ceremony_date",
      "ceremony_time",
      "venue_name",
      "venue_address",
    ]) {
      expect(INVITATION_MESSAGE_VARIABLES).not.toContain(forbidden);
      expect(INVITATION_MESSAGE_TEMPLATE).not.toContain(forbidden);
    }
  });

  it("names every placeholder it actually contains, so none can be forgotten", () => {
    const present = [
      ...INVITATION_MESSAGE_TEMPLATE.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
    ].map((match) => match[1]);

    expect(present.sort()).toEqual([...INVITATION_MESSAGE_VARIABLES].sort());
  });
});

describe("buildInvitationMessage", () => {
  it("greets the household by the name the operator stored", () => {
    const message = buildInvitationMessage(
      draft({ greetingName: "Familia Muñóz Aristizábal" }),
    );

    expect(message).toContain("Familia Muñóz Aristizábal");
    expect(message).not.toContain("{{");
  });

  it("signs off with the couple's names from the ceremony row", () => {
    expect(buildInvitationMessage(draft())).toContain("Ana y Bruno");
  });

  it("signs off with a DIFFERENT couple when the row holds different names", () => {
    const message = buildInvitationMessage(
      draft({ coupleNames: "Camila y Dario" }),
    );

    expect(message).toContain("Camila y Dario");
    expect(message).not.toContain("Ana y Bruno");
  });

  it("refuses empty couple names rather than drafting an unsigned invitation", () => {
    // `renderMessageTemplate` treats empty as missing for the same reason it
    // treats undefined as missing: "Hola, ," reaches a guest and cannot be
    // recalled.
    expect(() => buildInvitationMessage(draft({ coupleNames: "" }))).toThrow(
      /couple_names/,
    );
  });

  it("carries the invitation URL, and carries it exactly once", () => {
    const message = buildInvitationMessage(draft());
    const urls = message.match(/https?:\/\/\S+/g) ?? [];

    expect(urls).toEqual([INVITATION_URL]);
  });

  it("states no date and no venue: every digit it renders comes from the URL", () => {
    // The load-bearing assertion of this file. A hard-coded "14 de marzo de
    // 2026" or a street number would survive review and would keep announcing a
    // detail the invitation page no longer shows.
    const message = buildInvitationMessage(draft());

    expect(message.replace(INVITATION_URL, "")).not.toMatch(/\d/);
  });

  it("refuses a second URL, because only the first one gets a preview card", () => {
    expect(() =>
      buildInvitationMessage(
        draft({ greetingName: "Familia https://otra.example/promo" }),
      ),
    ).toThrow(/una sola|one URL|single URL/i);
  });

  it("refuses an empty household name rather than drafting a broken greeting", () => {
    expect(() => buildInvitationMessage(draft({ greetingName: "" }))).toThrow(
      /greeting_name/,
    );
  });

  it("refuses a blank invitation URL rather than drafting a message with no link", () => {
    expect(() => buildInvitationMessage(draft({ invitationUrl: "" }))).toThrow(
      /invitation_url/,
    );
  });
});

describe("buildInvitationDispatchLink", () => {
  it("addresses the recipient and prefills the rendered draft", () => {
    const link = buildInvitationDispatchLink({
      ...draft(),
      recipientE164: "+573001234567",
    });
    const url = new URL(link);

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/573001234567");
    expect(url.searchParams.get("text")).toBe(buildInvitationMessage(draft()));
  });

  it("refuses a recipient that never became E.164 instead of cleaning it up", () => {
    expect(() =>
      buildInvitationDispatchLink({
        ...draft(),
        recipientE164: "300 123 4567",
      }),
    ).toThrow(/E\.164/);
  });
});

describe("the removed auto-pick", () => {
  /**
   * `selectDispatchRecipient` picked the first household member carrying a
   * dispatchable number, with no operator action and no record of a choice.
   * It is REMOVED, not deprecated, and its two reasons moved to
   * `dispatch-recipient.ts` under names that say whose phone is the problem.
   *
   * Asserted as absence from the module's exports, because a re-export left
   * behind would compile, pass every other test in this file, and quietly
   * restore the inference the dispatch-recipient capability exists to delete.
   */
  it("no longer exports the auto-pick or its outcome types", async () => {
    const moduleExports = await import("./dispatch-message");

    expect(Object.keys(moduleExports)).not.toContain("selectDispatchRecipient");
    expect(Object.keys(moduleExports)).not.toContain(
      "DispatchRecipientProblem",
    );
    expect(Object.keys(moduleExports)).not.toContain(
      "DispatchRecipientOutcome",
    );
    // The module is still the one that builds the draft, so an empty export
    // list would pass the three assertions above for the wrong reason.
    expect(Object.keys(moduleExports)).toContain("buildInvitationMessage");
  });

  it("carries the guest id the stored choice names", () => {
    const candidate: DispatchCandidateGuest = guest({ id: "g1" });

    expect(candidate.id).toBe("g1");
  });
});

describe("console dispatch routes", () => {
  it("builds the compose path for one invitation", () => {
    expect(consoleDispatchPath("11111111-1111-4111-8111-111111111111")).toBe(
      "/console/dispatch/11111111-1111-4111-8111-111111111111",
    );
  });

  it("puts the beacon target under the console, so the session cookie reaches it", () => {
    // A path outside `/console` would be outside the proxy matcher, and the
    // beacon would arrive with no operator identity to attribute it to.
    expect(DISPATCH_EVENT_BEACON_PATH.startsWith("/console/")).toBe(true);
  });
});
