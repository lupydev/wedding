import { describe, expect, it } from "vitest";

import {
  MESSAGE_PREVIEW_APPROXIMATE_LABEL,
  MESSAGE_PREVIEW_DIVERGENCES,
  READ_MORE_APPROX_CHARACTERS,
  describeMessageLength,
} from "./message-preview";

/**
 * The honesty layer around the mock bubble.
 *
 * The preview's value comes from being nearly right; its danger comes from
 * being taken as exactly right. An operator who trusts a mock bubble stops
 * checking, and the message they approve is unrecallable the moment it is sent.
 *
 * Pure and here rather than inside the component because these are claims about
 * a third party's undocumented rendering behavior, and a claim worth making is
 * worth pinning. A divergence silently dropped in a markup refactor is exactly
 * the kind of thing nobody notices until it matters.
 */
describe("MESSAGE_PREVIEW_APPROXIMATE_LABEL", () => {
  it("says the preview is approximate and device-dependent", () => {
    expect(MESSAGE_PREVIEW_APPROXIMATE_LABEL).toBe(
      "Aproximado — el resultado real varía según el dispositivo",
    );
  });
});

describe("MESSAGE_PREVIEW_DIVERGENCES", () => {
  it("states every way the mock is known to diverge", () => {
    // Six, and each one is a distinct failure mode an operator could otherwise
    // mistake for a bug in the invitation.
    expect(MESSAGE_PREVIEW_DIVERGENCES).toHaveLength(6);
  });

  it("warns that long messages collapse behind an undocumented threshold", () => {
    expect(MESSAGE_PREVIEW_DIVERGENCES.join(" ")).toMatch(/Ver más/);
  });

  it("warns that the card size is behavior and not a contract", () => {
    expect(MESSAGE_PREVIEW_DIVERGENCES.join(" ")).toMatch(/tarjeta/i);
  });

  it("warns that iOS, Android and WhatsApp Web differ", () => {
    const all = MESSAGE_PREVIEW_DIVERGENCES.join(" ");

    expect(all).toContain("iOS");
    expect(all).toContain("Android");
    expect(all).toContain("WhatsApp Web");
  });

  it("warns that only the first link in a message gets a card", () => {
    // The hard design constraint the template is built around: a second URL
    // does not add a second card, it costs the first one.
    expect(MESSAGE_PREVIEW_DIVERGENCES.join(" ")).toMatch(/primer enlace/i);
  });

  it("warns that the card appears only once the sender's client fetched it", () => {
    expect(MESSAGE_PREVIEW_DIVERGENCES.join(" ")).toMatch(/todavía no/i);
  });

  /**
   * THIS LINE USED TO NAME THE CARD, AND THE CARD HAS DRAWN NO EMOJI SINCE U29.
   *
   * It said «la imagen de la tarjeta dibuja los emoji con el juego Twemoji»,
   * which was true while the card went through Satori. The card is a JPEG read
   * off the disk now; there is no emoji on it and no Twemoji anywhere in this
   * product. A disclosure list whose whole contract is "every line names a
   * specific way the mock is KNOWN to be wrong" cannot carry a line that is
   * itself wrong — a false caveat is worse than a missing one, because the
   * operator spends attention checking for a difference that cannot occur.
   *
   * What replaced it is the divergence that went LIVE when the draft gained
   * 👰🏻‍♀️🤵🏼‍♂️: this pane draws them with the operator's own fonts and the
   * recipient's phone draws them with its own, and a joined sequence with a
   * skin tone is exactly the kind a system that does not know it splits apart.
   */
  it("warns that each device draws the message's emoji with its own set", () => {
    const aboutEmoji = MESSAGE_PREVIEW_DIVERGENCES.filter((line) =>
      /emoji/i.test(line),
    );

    expect(aboutEmoji).toHaveLength(1);
    // The claim is about the MESSAGE's emoji and about the reader's device.
    // Matched on that line alone: `join(" ")` would pass on the unrelated
    // sentence about the first link, which also says "mensaje".
    expect(aboutEmoji[0]).toMatch(/mensaje/i);
    expect(aboutEmoji[0]).toMatch(/dispositivo|equipo|teléfono/i);
  });

  it("no longer claims the card draws emoji, because the card draws none", () => {
    // Asserted as an absence: the sentence compiled, read well and had a
    // browser assertion behind it for four units after it stopped being true.
    expect(MESSAGE_PREVIEW_DIVERGENCES.join(" ")).not.toMatch(/twemoji/i);
  });

  it("states each divergence exactly once", () => {
    expect(new Set(MESSAGE_PREVIEW_DIVERGENCES).size).toBe(
      MESSAGE_PREVIEW_DIVERGENCES.length,
    );
  });

  it("is written in Spanish for the operator, with no placeholder left in it", () => {
    for (const line of MESSAGE_PREVIEW_DIVERGENCES) {
      expect(line).not.toContain("{{");
      expect(line.length).toBeGreaterThan(20);
    }
  });
});

describe("describeMessageLength", () => {
  it("counts the characters of a short message and does not warn", () => {
    const described = describeMessageLength("Hola");

    expect(described.characters).toBe(4);
    expect(described.mayCollapse).toBe(false);
  });

  it("counts a different message to a different length", () => {
    expect(describeMessageLength("Hola, Familia Muñóz").characters).toBe(19);
  });

  it("counts an empty message as zero", () => {
    expect(describeMessageLength("").characters).toBe(0);
  });

  it("warns once the message passes the approximate collapse point", () => {
    expect(
      describeMessageLength("a".repeat(READ_MORE_APPROX_CHARACTERS + 1))
        .mayCollapse,
    ).toBe(true);
  });

  it("does not warn exactly at the approximate collapse point", () => {
    expect(
      describeMessageLength("a".repeat(READ_MORE_APPROX_CHARACTERS))
        .mayCollapse,
    ).toBe(false);
  });

  it("says the collapse point is approximate rather than a real limit", () => {
    // WhatsApp does not publish the threshold and it varies by device width and
    // the reader's font-size setting. Claiming precision here would be a lie
    // with a number in it, which is the most believable kind.
    expect(
      describeMessageLength("a".repeat(READ_MORE_APPROX_CHARACTERS + 1))
        .sentence,
    ).toMatch(/aproximadamente|aproximad/i);
  });

  it("states the count in its sentence, whatever the length", () => {
    expect(describeMessageLength("Hola").sentence).toContain("4");
    expect(describeMessageLength("Hola, Ana").sentence).toContain("9");
  });

  it("counts a rendered invitation draft as the operator sees it", () => {
    const draft =
      "Hola, Familia Muñóz. Nos alegra mucho invitarlos a nuestra boda.";

    expect(describeMessageLength(draft).characters).toBe(draft.length);
    expect(describeMessageLength(draft).mayCollapse).toBe(false);
  });
});
