import { describe, expect, it } from "vitest";

import { invitationSizeSentence } from "./rsvp-copy";

import {
  DISPATCH_EVENT_BEACON_PATH,
  INVITATION_MESSAGE_TEMPLATE,
  INVITATION_MESSAGE_VARIABLES,
  buildInvitationDispatchLink,
  buildInvitationMessage,
  buildInvitationWebFallbackLink,
  consoleDispatchPath,
  type DispatchCandidateGuest,
  type InvitationMessageInput,
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

/**
 * One complete draft input. Every test varies a single field of it.
 *
 * `memberCount` is three — the size the couple have described as the ceiling
 * — and it is a NUMBER among strings, which is why the overrides are typed as
 * a partial of the input rather than a bag of strings.
 */
function draft(overrides: Partial<InvitationMessageInput> = {}) {
  return {
    greetingName: "Familia Muñóz",
    invitationUrl: INVITATION_URL,
    coupleNames: COUPLE_NAMES,
    memberCount: 3,
    ...overrides,
  };
}

describe("INVITATION_MESSAGE_TEMPLATE", () => {
  it("declares exactly six variables: the household, the two verbs that address it, its size, the couple and the link", () => {
    expect([...INVITATION_MESSAGE_VARIABLES].sort()).toEqual([
      "couple_names",
      "greeting_name",
      "invitation_size",
      "invitation_url",
      "invitation_verb",
      "link_verb",
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

  /**
   * THE LOAD-BEARING ASSERTION OF THIS FILE, NARROWED ON THE COUPLE'S
   * EXPLICIT INSTRUCTION AND NOT WEAKENED BY ACCIDENT.
   *
   * THE OLD RULE, QUOTED SO NOBODY HAS TO GO AND FIND IT: "the only digits a
   * rendered message may contain are the ones inside the invitation URL". It
   * exists because a reference project hard-coded "14 de marzo de 2026" and a
   * venue into an approved template; the event moved, the invitation page was
   * corrected in minutes, and every already-delivered message kept announcing
   * the old venue with no way to recall it.
   *
   * WHAT CHANGED. The couple asked for a digit in the body: "debe decir la
   * invitación es para una (1) persona. y si es dos o mas debe decir el
   * numero en letras y el digito entre ()." So the rule becomes **the only
   * digits outside the URL are the ones inside the size sentence's
   * parentheses** — and the parentheses are not a licence for digits
   * generally. Everything the old rule caught, this one still catches, which
   * is what the negative control below is for.
   *
   * IT IS NARROWED BY SUBTRACTING THE EXACT SENTENCE rather than by allowing
   * a pattern. A rule phrased as "ignore anything in brackets" would wave
   * through "(14 de marzo de 2026)" pasted anywhere; removing the one string
   * `invitationSizeSentence` produced leaves every other digit in the
   * message visible, including a second parenthesised number.
   */
  function digitsOutsideTheAllowance(
    message: string,
    memberCount: number,
  ): string {
    return message
      .replace(INVITATION_URL, "")
      .replace(invitationSizeSentence(memberCount), "")
      .replace(/\D/g, "");
  }

  it("states no date and no venue: the only digits left are the size's own", () => {
    for (const memberCount of [1, 2, 3, 4, 10]) {
      const message = buildInvitationMessage(draft({ memberCount }));

      expect(digitsOutsideTheAllowance(message, memberCount)).toBe("");
    }
  });

  /**
   * AND THE TEMPLATE ITSELF STILL HOLDS NO DIGIT AT ALL, which is the
   * sharpest form of the original rule and the one the parentheses cannot
   * touch. Every digit a guest reads arrives through a NAMED variable; a date
   * or a street number typed into the literal above fails here before it ever
   * reaches a rendering.
   */
  it("holds no digit in the template itself, whatever the variables carry", () => {
    expect(INVITATION_MESSAGE_TEMPLATE).not.toMatch(/\d/);
  });

  /**
   * THE NEGATIVE CONTROL, because a narrowed guard that nobody proved is a
   * deleted guard with extra steps.
   *
   * A date arriving through any other variable — here the household's own
   * name, which is the one free-text value an operator types — is exactly
   * what the old rule caught, and the narrowed one still does.
   */
  it("still catches a date that arrives through any other variable", () => {
    const message = buildInvitationMessage(
      draft({ greetingName: "Familia Muñóz, 14 de marzo de 2026" }),
    );

    expect(digitsOutsideTheAllowance(message, 3)).toBe("142026");
  });

  /**
   * AND A SECOND PARENTHESISED NUMBER IS NOT WAVED THROUGH EITHER, which is
   * the failure a pattern-based narrowing would have shipped.
   */
  it("still catches a number dressed up in the size sentence's own clothes", () => {
    const message = buildInvitationMessage(
      draft({ greetingName: "Familia Muñóz (14)" }),
    );

    expect(digitsOutsideTheAllowance(message, 3)).toBe("14");
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

/**
 * THE SHAPE OF THE DRAFT, ASSERTED ON THE RENDERED MESSAGE AND NOT ON THE
 * TEMPLATE.
 *
 * The couple wrote this out line by line, and the shape is not decoration. A
 * URL sitting alone on its own line is the one a thumb can hit without
 * catching the words around it, and it is what gives WhatsApp's link detector
 * a clean target — a link with a comma or a closing bracket welded to it is
 * the classic way to ship a dead invitation.
 *
 * Every assertion below reads `buildInvitationMessage(...)` rather than
 * `INVITATION_MESSAGE_TEMPLATE`. A template with a correct shape and a
 * renderer that collapsed it would pass a template assertion and reach the
 * guest broken; the rendered string is the only thing the guest ever sees.
 */
describe("the draft's shape", () => {
  /** The rendered draft, split the way a reader's eye splits it. */
  function paragraphs(): string[] {
    return buildInvitationMessage(draft()).split("\n\n");
  }

  it("is four paragraphs separated by blank lines", () => {
    expect(paragraphs()).toHaveLength(4);
  });

  it("greets the household on a line of its own", () => {
    expect(paragraphs()[0]).toBe("Hola, Familia Muñóz.");
  });

  /**
   * AND THE INVITATION ITSELF IS ADDRESSED IN THE READER'S OWN NUMBER.
   *
   * "Cuando sea para una persona debe decir nos alegra mucho invitarte
   * (singular) cuando la invitacion es para 1 sola persona, si es para 2 o
   * mas ahi si debe seguir igual." The line was fixed prose until the couple
   * read it addressed to a guest invited alone.
   *
   * ONLY THE VERB IS A VARIABLE. The emoji and the rest of the sentence stay
   * in the template literal, where the shape the couple wrote is still
   * visible in the source — a whole-line variable would have moved their
   * sentence out of the file that is supposed to show it.
   */
  it("invites a household in the plural", () => {
    expect(paragraphs()[1].split("\n")[0]).toContain(
      "Nos alegra mucho invitarlos a nuestra boda",
    );
  });

  it("invites one guest in the singular", () => {
    const lines = buildInvitationMessage(draft({ memberCount: 1 }))
      .split("\n\n")[1]
      .split("\n");

    expect(lines[0]).toBe("Nos alegra mucho invitarte a nuestra boda 👰🏻‍♀️🤵🏼‍♂️.");
    expect(lines[0]).not.toContain("invitarlos");
  });

  /**
   * AND SO IS THE SENTENCE THAT HANDS OVER THE LINK, WHICH IS THE SAME
   * CORRECTION ONE PARAGRAPH LATER.
   *
   * The couple asked for `invitarte` first, read the result, and asked again:
   * "si arreglalo." Four lines under a verb addressed to one person the
   * message went back to the plural — "En este enlace **encontrarán** la
   * invitación" — which is the slip that is worse than never having tried,
   * because it is visible inside one short message.
   */
  it("hands the link to a household in the plural", () => {
    expect(paragraphs()[2]).toContain("En este enlace encontrarán");
  });

  it("hands the link to one guest in the singular", () => {
    expect(buildInvitationMessage(draft({ memberCount: 1 }))).toContain(
      "En este enlace encontrarás la invitación",
    );
  });

  /**
   * AND NO FORM OF THE OTHER NUMBER SURVIVES ANYWHERE IN THE DRAFT, which is
   * the assertion the two above cannot make between them.
   *
   * Two inflections have now been corrected one at a time, each after the
   * couple read a rendered draft, and each time the one that was missed was
   * in a paragraph nobody was looking at. This checks the WHOLE message
   * rather than a sentence, so a third inflection added to the template
   * without an entry in `invitationVoice` fails here instead of in a chat.
   */
  it.each([
    [1, ["invitarlos", "encontrarán"], ["invitarte", "encontrarás"]],
    [3, ["invitarte", "encontrarás"], ["invitarlos", "encontrarán"]],
  ])(
    "addresses an invitation of %i in one number throughout",
    (memberCount, wrong, right) => {
      const message = buildInvitationMessage(draft({ memberCount }));

      for (const form of wrong) {
        expect(message).not.toContain(form);
      }
      for (const form of right) {
        expect(message).toContain(form);
      }
    },
  );

  /**
   * THE ONE THIRD-PERSON POSSESSIVE LEFT, PINNED SO THAT CHANGING IT IS A
   * DECISION RATHER THAN A MERGE.
   *
   * "Confirmar **su** asistencia" is the possessive of `usted`/`ustedes`. It
   * is correct for a household and it does NOT agree with the `tú` the solo
   * draft now uses twice — `invitarte`, `encontrarás` — so a guest invited
   * alone reads one sentence that changes register halfway through. The
   * product's singular voice is `tú` everywhere else: "Confirma antes del…",
   * "todo lo que necesitas", "Te esperamos".
   *
   * NOT CHANGED HERE, because the couple have corrected this message's
   * wording twice by reading it and saying what they want, and this is their
   * sentence. The feature document carries it with the exact correction —
   * `tu asistencia` for one, `su asistencia` for two or more, one more entry
   * in `invitationVoice` — so it is one line the day they say yes.
   */
  it("still says `su asistencia` to both, which is the open question", () => {
    for (const memberCount of [1, 3]) {
      expect(buildInvitationMessage(draft({ memberCount }))).toContain(
        "para confirmar su asistencia",
      );
    }
  });

  it("carries the couple's emoji in the second paragraph, unsplit", () => {
    // A multi-codepoint ZWJ sequence with a skin-tone modifier. Asserted as
    // one string rather than by codepoint: the failure this guards against is
    // an editor or a transform that helpfully "normalises" the joiner away and
    // turns one bride into a bride followed by a stray gender sign.
    //
    // THE LINE, NOT THE PARAGRAPH, SINCE THE COUNT JOINED IT. The size
    // sentence is the second line of this same paragraph — see below for why
    // it is not a fifth one — so the emoji is asserted where it actually
    // lives rather than against a paragraph that now holds two sentences.
    expect(paragraphs()[1].split("\n")[0]).toBe(
      "Nos alegra mucho invitarlos a nuestra boda 👰🏻‍♀️🤵🏼‍♂️.",
    );
  });

  /**
   * HOW MANY PEOPLE THE INVITATION IS FOR, IN THE MESSAGE THAT ARRIVES
   * FIRST.
   *
   * "Si en todo el flujo debe ser super claro el numero de personas inclusive
   * en el mensaje de whatsapp." This is the surface the couple named, and the
   * one that matters most: it is read before anything is opened, and it is
   * what a household forwards and discusses.
   *
   * THE SECOND LINE OF THE INVITATION PARAGRAPH, NOT A FIFTH PARAGRAPH. The
   * couple wrote this message out line by line and the rhythm is theirs —
   * four paragraphs, the URL alone with a blank line after it. The count
   * qualifies "invitarlos", so it belongs against that sentence rather than
   * floating between the invitation and the link.
   */
  it("says how many people the invitation is for, under the invitation itself", () => {
    const lines = paragraphs()[1].split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("La invitación es para tres (3) personas.");
  });

  it("says it in the singular to an invitation that names one person", () => {
    expect(buildInvitationMessage(draft({ memberCount: 1 }))).toContain(
      "La invitación es para una (1) persona.",
    );
  });

  /**
   * AND THE COUNT DOES NOT COST THE DRAFT ITS SHAPE, which is the assertion
   * that would catch a well-meaning edit promoting it to a paragraph of its
   * own. Four paragraphs before, four after.
   */
  it("still arrives as four paragraphs", () => {
    for (const memberCount of [1, 2, 3, 4]) {
      expect(
        buildInvitationMessage(draft({ memberCount })).split("\n\n"),
      ).toHaveLength(4);
    }
  });

  it("puts the invitation URL alone on the last line of its paragraph", () => {
    const lines = paragraphs()[2].split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(INVITATION_URL);
  });

  it("leaves a blank line after the URL, so nothing is welded to it", () => {
    expect(buildInvitationMessage(draft())).toContain(
      `${INVITATION_URL}\n\nCon cariño,`,
    );
  });

  it("signs off in the last paragraph and ends there", () => {
    expect(paragraphs()[3]).toBe("Con cariño, Ana y Bruno.");
  });

  it("begins and ends with no stray whitespace of its own", () => {
    const message = buildInvitationMessage(draft());

    expect(message).toBe(message.trim());
  });

  it("uses no carriage returns, which WhatsApp would show as a blank line", () => {
    expect(buildInvitationMessage(draft())).not.toContain("\r");
  });
});

describe("buildInvitationDispatchLink", () => {
  it("addresses the recipient and prefills the rendered draft", () => {
    const link = buildInvitationDispatchLink({
      ...draft(),
      recipientE164: "+573001234567",
    });
    const url = new URL(link);

    expect(url.protocol).toBe("whatsapp:");
    expect(url.searchParams.get("phone")).toBe("573001234567");
    expect(url.searchParams.get("text")).toBe(buildInvitationMessage(draft()));
  });

  /**
   * THE LINK THE BUTTON OPENS IS THE ONE THAT REACHES THE APPLICATION.
   *
   * `wa.me` is a redirect to a web page with a button on it. This is the
   * dispatch link, so it is the direct one; the web route is still built, and
   * is offered only after the direct one has already been tried.
   */
  it("is the scheme the operating system hands to WhatsApp, not a web page", () => {
    const link = buildInvitationDispatchLink({
      ...draft(),
      recipientE164: "+573001234567",
    });

    expect(link.startsWith("whatsapp://send?")).toBe(true);
    expect(link).not.toContain("wa.me");
  });

  it("survives the blank lines and the emoji through the encoding", () => {
    // `encodeURIComponent` turns a newline into `%0A` and an emoji into its
    // UTF-8 bytes. Asserted through a real parse rather than by reading the
    // string: what matters is that the draft comes back out byte for byte.
    const url = new URL(
      buildInvitationDispatchLink({
        ...draft(),
        recipientE164: "+573001234567",
      }),
    );

    expect(url.href).toContain("%0A%0A");
    expect(url.href).toContain(
      "%F0%9F%91%B0%F0%9F%8F%BB%E2%80%8D%E2%99%80%EF%B8%8F",
    );
    expect(url.href).toContain(
      "%F0%9F%A4%B5%F0%9F%8F%BC%E2%80%8D%E2%99%82%EF%B8%8F",
    );
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

/**
 * The web route, kept because `whatsapp://` fails SILENTLY.
 *
 * A custom scheme with no handler does nothing at all: no error, no page, no
 * way for the operator to tell a missed click from a missing application.
 * `https://wa.me/…` degrades instead — it answers with a page that offers the
 * download — so it is built for every household and shown after the direct
 * link has already been pressed and its event already written.
 */
describe("buildInvitationWebFallbackLink", () => {
  it("is the wa.me link, carrying the identical draft", () => {
    const url = new URL(
      buildInvitationWebFallbackLink({
        ...draft(),
        recipientE164: "+573001234567",
      }),
    );

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/573001234567");
    expect(url.searchParams.get("text")).toBe(buildInvitationMessage(draft()));
  });

  it("carries the same text as the link the button opens", () => {
    // Two builders, one draft. A fallback that drifted would be worse than no
    // fallback: the operator would send a different message and never know.
    const input = { ...draft(), recipientE164: "+573001234567" };

    expect(
      new URL(buildInvitationWebFallbackLink(input)).searchParams.get("text"),
    ).toBe(
      new URL(buildInvitationDispatchLink(input)).searchParams.get("text"),
    );
  });

  it("refuses a recipient that never became E.164, exactly as the direct link does", () => {
    expect(() =>
      buildInvitationWebFallbackLink({
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
