import { describe, expect, it } from "vitest";

import {
  DISPATCH_EVENT_BEACON_PATH,
  INVITATION_MESSAGE_TEMPLATE,
  INVITATION_MESSAGE_VARIABLES,
  buildInvitationDispatchLink,
  buildInvitationMessage,
  consoleDispatchPath,
  selectDispatchRecipient,
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
    fullName: "Ana Muñóz",
    phoneE164: "+573001234567",
    dispatchable: true,
    ...overrides,
  };
}

const INVITATION_URL = "https://boda.example/i/abcdefghijklmn23";

describe("INVITATION_MESSAGE_TEMPLATE", () => {
  it("declares exactly two variables, the greeting name and the invitation URL", () => {
    expect([...INVITATION_MESSAGE_VARIABLES].sort()).toEqual([
      "greeting_name",
      "invitation_url",
    ]);
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
    const message = buildInvitationMessage({
      greetingName: "Familia Muñóz Aristizábal",
      invitationUrl: INVITATION_URL,
    });

    expect(message).toContain("Familia Muñóz Aristizábal");
    expect(message).not.toContain("{{");
  });

  it("carries the invitation URL, and carries it exactly once", () => {
    const message = buildInvitationMessage({
      greetingName: "Familia Muñóz",
      invitationUrl: INVITATION_URL,
    });
    const urls = message.match(/https?:\/\/\S+/g) ?? [];

    expect(urls).toEqual([INVITATION_URL]);
  });

  it("states no date and no venue: every digit it renders comes from the URL", () => {
    // The load-bearing assertion of this file. A hard-coded "14 de marzo de
    // 2026" or a street number would survive review and would keep announcing a
    // detail the invitation page no longer shows.
    const message = buildInvitationMessage({
      greetingName: "Familia Muñóz",
      invitationUrl: INVITATION_URL,
    });

    expect(message.replace(INVITATION_URL, "")).not.toMatch(/\d/);
  });

  it("refuses a second URL, because only the first one gets a preview card", () => {
    expect(() =>
      buildInvitationMessage({
        greetingName: "Familia https://otra.example/promo",
        invitationUrl: INVITATION_URL,
      }),
    ).toThrow(/una sola|one URL|single URL/i);
  });

  it("refuses an empty household name rather than drafting a broken greeting", () => {
    expect(() =>
      buildInvitationMessage({
        greetingName: "",
        invitationUrl: INVITATION_URL,
      }),
    ).toThrow(/greeting_name/);
  });

  it("refuses a blank invitation URL rather than drafting a message with no link", () => {
    expect(() =>
      buildInvitationMessage({
        greetingName: "Familia Muñóz",
        invitationUrl: "",
      }),
    ).toThrow(/invitation_url/);
  });
});

describe("buildInvitationDispatchLink", () => {
  it("addresses the recipient and prefills the rendered draft", () => {
    const link = buildInvitationDispatchLink({
      recipientE164: "+573001234567",
      greetingName: "Familia Muñóz",
      invitationUrl: INVITATION_URL,
    });
    const url = new URL(link);

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/573001234567");
    expect(url.searchParams.get("text")).toBe(
      buildInvitationMessage({
        greetingName: "Familia Muñóz",
        invitationUrl: INVITATION_URL,
      }),
    );
  });

  it("refuses a recipient that never became E.164 instead of cleaning it up", () => {
    expect(() =>
      buildInvitationDispatchLink({
        recipientE164: "300 123 4567",
        greetingName: "Familia Muñóz",
        invitationUrl: INVITATION_URL,
      }),
    ).toThrow(/E\.164/);
  });
});

describe("selectDispatchRecipient", () => {
  it("addresses the first household member whose number can receive WhatsApp", () => {
    const outcome = selectDispatchRecipient([
      guest({ fullName: "Ana Muñóz", phoneE164: "+573001234567" }),
      guest({ fullName: "Beto Muñóz", phoneE164: "+573009999999" }),
    ]);

    expect(outcome).toEqual({
      ok: true,
      guest: expect.objectContaining({ fullName: "Ana Muñóz" }),
      phoneE164: "+573001234567",
    });
  });

  it("skips a landline and addresses the mobile behind it", () => {
    // The household's primary contact is a landline. It is a valid E.164 number
    // and no WhatsApp will ever answer it, so dispatching to it records a send
    // nobody receives.
    const outcome = selectDispatchRecipient([
      guest({
        fullName: "Casa Muñóz",
        phoneE164: "+576012345678",
        dispatchable: false,
      }),
      guest({ fullName: "Ana Muñóz", phoneE164: "+573001234567" }),
    ]);

    expect(outcome).toMatchObject({ ok: true, phoneE164: "+573001234567" });
  });

  it("reports a household with no number on file as exactly that", () => {
    const outcome = selectDispatchRecipient([
      guest({ fullName: "Niña Muñóz", phoneE164: null, dispatchable: false }),
    ]);

    expect(outcome).toEqual({ ok: false, reason: "no_phone_on_file" });
  });

  it("distinguishes a household whose only numbers cannot receive WhatsApp", () => {
    const outcome = selectDispatchRecipient([
      guest({
        fullName: "Casa Muñóz",
        phoneE164: "+576012345678",
        dispatchable: false,
      }),
      guest({ fullName: "Niña Muñóz", phoneE164: null, dispatchable: false }),
    ]);

    expect(outcome).toEqual({ ok: false, reason: "no_reachable_phone" });
  });

  it("reports an empty household rather than throwing on it", () => {
    expect(selectDispatchRecipient([])).toEqual({
      ok: false,
      reason: "no_phone_on_file",
    });
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
