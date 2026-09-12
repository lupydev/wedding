import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * How the three families are loaded, asserted against the source.
 *
 * `next/font/google` is a BUILD-TIME transform: importing it under Vitest does
 * not produce a font, it produces an error. So the loading decisions are checked
 * by reading the root layout, which is unusual and is the right trade here —
 * every decision below is invisible at runtime and expensive to get wrong.
 *
 *  - `display: "swap"` on all three, or the first paint shows nothing at all.
 *  - `preload: false` on Caveat, because it is decorative and ALWAYS below the
 *    title. Preloading it makes it compete for bandwidth with the font painting
 *    the first visible text.
 *  - the variable classes on `<html>`, not `<body>`. `@theme inline` is resolved
 *    at parse time, so a variable that only exists further down the tree is a
 *    variable the theme layer never sees.
 */

const LAYOUT = readFileSync(
  fileURLToPath(new URL("../app/layout.tsx", import.meta.url)),
  "utf8",
);

/** The arguments object passed to one `next/font/google` loader call. */
function loaderCall(family: string): string {
  const match = new RegExp(`${family}\\(\\{([\\s\\S]*?)\\}\\)`).exec(LAYOUT);

  expect(match, `no ${family}() call in app/layout.tsx`).not.toBeNull();

  return match?.[1] ?? "";
}

describe("the three families are loaded from next/font/google", () => {
  it.each(["Yeseva_One", "Hanken_Grotesk", "Caveat"])(
    "imports %s",
    (family) => {
      expect(LAYOUT).toMatch(
        new RegExp(
          `import\\s*\\{[^}]*${family}[^}]*\\}\\s*from\\s*"next/font/google"`,
        ),
      );
    },
  );

  it.each(["Yeseva_One", "Hanken_Grotesk", "Caveat"])(
    "asks %s to swap rather than block the first paint",
    (family) => {
      expect(loaderCall(family)).toMatch(/display:\s*"swap"/);
    },
  );

  it("loads the display family at a single weight", () => {
    // Yeseva One ships 400 only. Requesting more would silently synthesize.
    expect(loaderCall("Yeseva_One")).toMatch(/weight:\s*\["400"\]/);
  });

  it("loads the four body weights the console actually uses", () => {
    expect(loaderCall("Hanken_Grotesk")).toMatch(
      /weight:\s*\["400",\s*"500",\s*"600",\s*"700"\]/,
    );
  });

  it("does not preload the decorative script family", () => {
    expect(loaderCall("Caveat")).toMatch(/preload:\s*false/);
  });

  it("preloads the two families that paint the first visible text", () => {
    expect(loaderCall("Yeseva_One")).not.toMatch(/preload:\s*false/);
    expect(loaderCall("Hanken_Grotesk")).not.toMatch(/preload:\s*false/);
  });
});

describe("where the font variables are applied", () => {
  it("puts all three variable classes on the html element, never on body", () => {
    // `<html\s` rather than `<html`, so the prose in this file's own docblock
    // cannot be mistaken for the JSX element.
    const html = /<html\s[\s\S]*?>/.exec(LAYOUT)?.[0] ?? "";

    expect(html).toContain("yesevaOne.variable");
    expect(html).toContain("hankenGrotesk.variable");
    expect(html).toContain("caveat.variable");
  });

  it("leaves the body element carrying no class at all", () => {
    expect(LAYOUT).not.toMatch(/<body[^>]*className/);
  });
});
