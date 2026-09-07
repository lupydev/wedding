import { describe, expect, it } from "vitest";

import { renderMessageTemplate } from "./message-template";

// A rendered message goes straight into a chat a human is about to send. There
// is no proofreading step and no recall, so a missing variable must fail loudly
// rather than ship the literal string "undefined" to a wedding guest.

describe("renderMessageTemplate", () => {
  it("substitutes the greeting name", () => {
    const output = renderMessageTemplate(
      "Hola {{greeting_name}}, te esperamos",
      {
        greeting_name: "Ana",
      },
    );

    expect(output).toBe("Hola Ana, te esperamos");
  });

  it("leaves no placeholder token behind", () => {
    const output = renderMessageTemplate("{{greeting_name}}!", {
      greeting_name: "Ana",
    });

    expect(output).toBe("Ana!");
    expect(output).not.toContain("{{");
    expect(output).not.toContain("greeting_name");
  });

  it("substitutes every occurrence of a repeated placeholder", () => {
    const output = renderMessageTemplate(
      "{{greeting_name}}, {{greeting_name}} y {{greeting_name}}",
      { greeting_name: "Ana" },
    );

    expect(output).toBe("Ana, Ana y Ana");
  });

  it("substitutes several distinct placeholders", () => {
    const output = renderMessageTemplate("Hola {{a}} y {{b}}", {
      a: "Ana",
      b: "Luis",
    });

    expect(output).toBe("Hola Ana y Luis");
  });

  it("tolerates whitespace inside the placeholder delimiters", () => {
    expect(
      renderMessageTemplate("Hola {{ greeting_name }}", {
        greeting_name: "Ana",
      }),
    ).toBe("Hola Ana");
  });

  it("returns a template with no placeholders unchanged", () => {
    expect(renderMessageTemplate("Hola, te esperamos", {})).toBe(
      "Hola, te esperamos",
    );
  });

  it("preserves accents, emoji and newlines in both template and values", () => {
    const output = renderMessageTemplate(
      "Hola {{greeting_name}} 💍\n¿Vienes?",
      {
        greeting_name: "Muñóz",
      },
    );

    expect(output).toBe("Hola Muñóz 💍\n¿Vienes?");
  });

  it("does not re-expand a placeholder that appears inside a value", () => {
    // Otherwise a guest name could inject another variable's content.
    const output = renderMessageTemplate("Hola {{a}}", {
      a: "{{b}}",
      b: "injected",
    });

    expect(output).toBe("Hola {{b}}");
    expect(output).not.toContain("injected");
  });

  it("throws when a referenced variable is missing", () => {
    expect(() => renderMessageTemplate("Hola {{greeting_name}}", {})).toThrow(
      /greeting_name/,
    );
  });

  it("names every missing variable, not only the first", () => {
    expect(() => renderMessageTemplate("{{a}} {{b}}", {})).toThrow(
      /missing a value for: a, b/,
    );
  });

  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
  ])("throws when a variable value is %s", (_label, value) => {
    expect(() =>
      renderMessageTemplate("Hola {{greeting_name}}", {
        greeting_name: value as string,
      }),
    ).toThrow(/greeting_name/);
  });

  it("never renders the literal string undefined", () => {
    let rendered: string | null = null;
    try {
      rendered = renderMessageTemplate("Hola {{greeting_name}}", {});
    } catch {
      rendered = null;
    }

    expect(rendered).toBeNull();
  });

  it.each([["constructor"], ["toString"], ["hasOwnProperty"], ["valueOf"]])(
    "treats the inherited Object.prototype member %s as missing",
    (name) => {
      // Without an own-property check the prototype chain answers with a
      // function, and its source text would be rendered straight into a
      // WhatsApp draft a human is about to send.
      expect(() => renderMessageTemplate(`Hola {{${name}}}`, {})).toThrow(
        new RegExp(`missing a value for: ${name}`),
      );
    },
  );

  it("never renders a function body for an inherited member", () => {
    let rendered: string | null = null;
    try {
      rendered = renderMessageTemplate("{{constructor}} {{toString}}", {});
    } catch {
      rendered = null;
    }

    expect(rendered).toBeNull();
  });

  it("still substitutes an own property that shadows a prototype member", () => {
    expect(
      renderMessageTemplate("Hola {{toString}}", { toString: "Ana" }),
    ).toBe("Hola Ana");
  });

  it("ignores unused variables", () => {
    expect(
      renderMessageTemplate("Hola {{a}}", { a: "Ana", unused: "Luis" }),
    ).toBe("Hola Ana");
  });
});
