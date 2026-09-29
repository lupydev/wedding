import { describe, expect, it } from "vitest";

import { buildWaMeLink, buildWhatsAppAppLink } from "./wa-link";

// Both links address the RECIPIENT only. There is no sender parameter, and
// neither one sends anything: a human opens it inside WhatsApp and presses
// send. What differs is who resolves the link — `whatsapp://` goes to the
// operating system and reaches the installed application directly, `wa.me`
// goes to Meta and comes back as a web page with a button on it.

const RECIPIENT = "+525512345678";

describe("buildWaMeLink", () => {
  it("builds the canonical URL shape", () => {
    expect(buildWaMeLink(RECIPIENT, "Hola")).toBe(
      "https://wa.me/525512345678?text=Hola",
    );
  });

  it("strips the leading + from the recipient digits", () => {
    const link = buildWaMeLink(RECIPIENT, "Hola");

    expect(link).toContain("wa.me/525512345678");
    expect(link.split("?")[0]).not.toContain("+");
  });

  it.each([
    ["a space", "Hola Ana", "Hola%20Ana"],
    ["an ampersand", "Ana & Luis", "Ana%20%26%20Luis"],
    ["a question mark", "¿Vienes?", "%C2%BFVienes%3F"],
    ["a newline", "Hola\nAna", "Hola%0AAna"],
    ["a CRLF newline", "Hola\r\nAna", "Hola%0D%0AAna"],
    ["an accented character", "Muñóz", "Mu%C3%B1%C3%B3z"],
    ["an emoji", "Nos casamos 💍", "Nos%20casamos%20%F0%9F%92%8D"],
    ["a hash", "sala #3", "sala%20%233"],
    ["a plus sign", "1+1", "1%2B1"],
    ["an equals sign", "a=b", "a%3Db"],
  ])("percent-encodes %s", (_label, text, expectedEncoded) => {
    expect(buildWaMeLink(RECIPIENT, text)).toBe(
      `https://wa.me/525512345678?text=${expectedEncoded}`,
    );
  });

  it("keeps a literal & or ? from breaking the query string", () => {
    const link = buildWaMeLink(RECIPIENT, "Ana & Luis? Confirma");
    const url = new URL(link);

    // Exactly one parameter: the message did not inject a second one.
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.searchParams.get("text")).toBe("Ana & Luis? Confirma");
  });

  it("round-trips a message containing every risky character", () => {
    const text = "Hola Ana & Luis\n¿Confirmas? 💍 Muñóz";
    const url = new URL(buildWaMeLink(RECIPIENT, text));

    expect(url.searchParams.get("text")).toBe(text);
    expect(url.hostname).toBe("wa.me");
    expect(url.protocol).toBe("https:");
  });

  it.each([
    ["a number with spaces", "+52 55 1234 5678"],
    ["a number with dashes", "+52-55-1234-5678"],
    ["a number without a leading plus", "525512345678"],
    ["an empty recipient", ""],
    ["a non-numeric recipient", "not-a-number"],
    ["a recipient with a leading zero", "+025512345678"],
    ["a recipient that is too short", "+5251234"],
  ])("rejects %s rather than building a broken link", (_label, recipient) => {
    expect(() => buildWaMeLink(recipient, "Hola")).toThrow(/E\.164|recipient/i);
  });

  it("rejects an empty message rather than opening a blank chat draft", () => {
    expect(() => buildWaMeLink(RECIPIENT, "")).toThrow(/message/i);
  });
});

/**
 * The link the console actually opens.
 *
 * `wa.me` is a REDIRECTOR. On a desktop it answers with
 * `api.whatsapp.com/send/?phone=…`, a full web page carrying an "Abrir
 * aplicación" button the operator has to press before WhatsApp opens at all.
 * That page is the whole cost: fifty invitations is fifty extra presses on a
 * page that exists to ask permission the operator already gave by pressing the
 * button in the console.
 *
 * `whatsapp://send` is handed to the operating system instead, which passes it
 * straight to the installed application. Same two facts inside it — a
 * recipient and a prefilled draft — and no page in between.
 */
describe("buildWhatsAppAppLink", () => {
  it("builds the canonical URI shape", () => {
    expect(buildWhatsAppAppLink(RECIPIENT, "Hola")).toBe(
      "whatsapp://send?phone=525512345678&text=Hola",
    );
  });

  it("names the scheme that skips the redirect, not the one that causes it", () => {
    const link = buildWhatsAppAppLink(RECIPIENT, "Hola");

    expect(link.startsWith("whatsapp://")).toBe(true);
    expect(link).not.toContain("wa.me");
    expect(link).not.toContain("api.whatsapp.com");
    expect(link).not.toContain("http");
  });

  it("strips the leading + from the recipient digits", () => {
    const url = new URL(buildWhatsAppAppLink(RECIPIENT, "Hola"));

    expect(url.searchParams.get("phone")).toBe("525512345678");
    expect(url.searchParams.get("phone")).not.toContain("+");
  });

  it.each([
    ["a space", "Hola Ana", "Hola%20Ana"],
    ["an ampersand", "Ana & Luis", "Ana%20%26%20Luis"],
    ["a question mark", "¿Vienes?", "%C2%BFVienes%3F"],
    ["a newline", "Hola\nAna", "Hola%0AAna"],
    ["a blank line", "Hola\n\nAna", "Hola%0A%0AAna"],
    ["an accented character", "Muñóz", "Mu%C3%B1%C3%B3z"],
    ["an emoji", "Nos casamos 💍", "Nos%20casamos%20%F0%9F%92%8D"],
    [
      "a ZWJ emoji sequence with a skin tone",
      "boda 👰🏻‍♀️🤵🏼‍♂️",
      "boda%20%F0%9F%91%B0%F0%9F%8F%BB%E2%80%8D%E2%99%80%EF%B8%8F%F0%9F%A4%B5%F0%9F%8F%BC%E2%80%8D%E2%99%82%EF%B8%8F",
    ],
    ["an equals sign", "a=b", "a%3Db"],
  ])("percent-encodes %s", (_label, text, expectedEncoded) => {
    expect(buildWhatsAppAppLink(RECIPIENT, text)).toBe(
      `whatsapp://send?phone=525512345678&text=${expectedEncoded}`,
    );
  });

  it("keeps a literal & from inventing a third parameter", () => {
    // `phone` and `text` are the only two, and a draft containing an `&` must
    // not be able to add a third — the recipient is in this query too, so a
    // message that could overwrite `phone` would open the wrong chat.
    const url = new URL(
      buildWhatsAppAppLink(RECIPIENT, "Ana & Luis&phone=1?Confirma"),
    );

    expect([...url.searchParams.keys()]).toEqual(["phone", "text"]);
    expect(url.searchParams.get("phone")).toBe("525512345678");
    expect(url.searchParams.get("text")).toBe("Ana & Luis&phone=1?Confirma");
  });

  it("round-trips a message containing every risky character", () => {
    const text = "Hola Ana & Luis\n\n¿Confirmas? 👰🏻‍♀️🤵🏼‍♂️ Muñóz";
    const url = new URL(buildWhatsAppAppLink(RECIPIENT, text));

    expect(url.protocol).toBe("whatsapp:");
    expect(url.searchParams.get("text")).toBe(text);
  });

  it.each([
    ["a number with spaces", "+52 55 1234 5678"],
    ["a number without a leading plus", "525512345678"],
    ["an empty recipient", ""],
    ["a non-numeric recipient", "not-a-number"],
    ["a recipient that is too short", "+5251234"],
  ])("rejects %s rather than building a broken link", (_label, recipient) => {
    expect(() => buildWhatsAppAppLink(recipient, "Hola")).toThrow(
      /E\.164|recipient/i,
    );
  });

  it("rejects an empty message rather than opening a blank chat draft", () => {
    expect(() => buildWhatsAppAppLink(RECIPIENT, "")).toThrow(/message/i);
  });
});

describe("the two links are the same message twice", () => {
  /**
   * The web link is the FALLBACK, and it only earns that name while it carries
   * the identical draft. An operator whose machine silently refused the custom
   * scheme opens the other one and must get the same message, not a stale or
   * differently-encoded copy of it.
   */
  it("addresses the same recipient with the same encoded text", () => {
    const text = "Hola, Familia.\n\nNos casamos 👰🏻‍♀️🤵🏼‍♂️.\n\nhttps://x.test/i/a";
    const app = new URL(buildWhatsAppAppLink(RECIPIENT, text));
    const web = new URL(buildWaMeLink(RECIPIENT, text));

    expect(app.searchParams.get("phone")).toBe(web.pathname.slice(1));
    expect(app.searchParams.get("text")).toBe(web.searchParams.get("text"));
    expect(app.searchParams.get("text")).toBe(text);
  });

  it("refuses the same recipients, so neither is the lenient way in", () => {
    for (const recipient of ["300 123 4567", "525512345678", ""]) {
      expect(() => buildWhatsAppAppLink(recipient, "Hola")).toThrow();
      expect(() => buildWaMeLink(recipient, "Hola")).toThrow();
    }
  });
});
