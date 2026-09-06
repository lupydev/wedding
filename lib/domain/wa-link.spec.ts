import { describe, expect, it } from "vitest";

import { buildWaMeLink } from "./wa-link";

// `wa.me` addresses the RECIPIENT only. There is no sender parameter, and this
// link never sends anything: a human opens it inside WhatsApp and presses send.

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
