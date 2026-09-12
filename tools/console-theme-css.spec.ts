import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CONSOLE_HAIRLINES,
  CONSOLE_INPUT_MIN_FONT_SIZE_PX,
  CONSOLE_RADIUS,
  CONSOLE_TOKENS,
  CONSOLE_TRANSITION_MAX_MS,
} from "@/lib/design/console-theme";
import { parseCssColor } from "@/lib/design/contrast";

/**
 * The stylesheet and the token table, held to each other.
 *
 * `lib/design/console-theme.spec.ts` proves the token VALUES are readable.
 * Nothing there proves the stylesheet actually uses them — and the stylesheet is
 * what the browser paints. `shadcn init` rewrites `app/globals.css` wholesale, so
 * "somebody will notice" is not a control here: an `npx shadcn@latest init` run
 * during a later work unit would silently restore a neutral grey theme and every
 * contrast assertion would keep passing against a table nothing reads.
 *
 * This file closes that gap by reading the real stylesheet off disk.
 */

const GLOBALS_CSS = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);

/** Every value the stylesheet declares for one custom property. */
function declarationsOf(property: string): readonly string[] {
  return [
    ...GLOBALS_CSS.matchAll(new RegExp(`--${property}:\\s*([^;]+);`, "g")),
  ].map((match) => match[1].trim());
}

/** `--name: value`, compared as a literal string. */
function declares(property: string, value: string): boolean {
  return declarationsOf(property).includes(value);
}

/**
 * `--name: <colour>`, compared as a COLOUR rather than as text.
 *
 * CSS is case-insensitive and `.10` is `0.1`, so a string comparison would fail
 * on a stylesheet that is byte-for-byte correct and merely formatted by Prettier.
 * Comparing parsed channels means this test tracks the value the browser will
 * paint, which is the only thing it is trying to protect.
 */
function declaresColor(property: string, value: string): boolean {
  const wanted = parseCssColor(value);

  return declarationsOf(property).some((declared) => {
    try {
      const found = parseCssColor(declared);

      return (
        found.red === wanted.red &&
        found.green === wanted.green &&
        found.blue === wanted.blue &&
        Math.abs(found.alpha - wanted.alpha) < 1e-6
      );
    } catch {
      // A non-colour value for this property, such as a `var()` reference. Not a
      // match, and not a reason to fail the whole file.
      return false;
    }
  });
}

describe("app/globals.css carries the measured console tokens", () => {
  it.each([
    ["background", CONSOLE_TOKENS.background],
    ["card", CONSOLE_TOKENS.card],
    ["muted", CONSOLE_TOKENS.muted],
    ["popover", CONSOLE_TOKENS.popover],
    ["foreground", CONSOLE_TOKENS.foreground],
    ["muted-foreground", CONSOLE_TOKENS.mutedForeground],
    ["console-hint", CONSOLE_TOKENS.hint],
    ["primary", CONSOLE_TOKENS.primary],
    ["primary-foreground", CONSOLE_TOKENS.primaryForeground],
    ["console-success", CONSOLE_TOKENS.success],
    ["destructive", CONSOLE_TOKENS.destructive],
  ])("declares --%s as %s", (property, value) => {
    expect(declaresColor(property, value)).toBe(true);
  });

  it("declares both hairlines at their measured opacities", () => {
    expect(declaresColor("border", CONSOLE_HAIRLINES.border)).toBe(true);
    expect(declaresColor("input", CONSOLE_HAIRLINES.input)).toBe(true);
  });

  it("declares the single 14px radius", () => {
    expect(declares("radius", CONSOLE_RADIUS)).toBe(true);
  });

  it("never leaves a neutral grey oklch token behind from a shadcn re-init", () => {
    // `shadcn init` writes `--background: oklch(1 0 0)` and friends. Any of them
    // surviving means the generated theme is what ships, not this one.
    expect(GLOBALS_CSS).not.toMatch(/--background:\s*oklch/);
    expect(GLOBALS_CSS).not.toMatch(/--primary:\s*oklch/);
  });
});

describe("the @theme inline font trap", () => {
  /**
   * `shadcn init` emits `--font-sans: var(--font-sans);` inside `@theme inline`.
   *
   * Tailwind v4 resolves custom properties in `@theme inline` at PARSE time, so
   * a variable injected at runtime by `next/font` resolves to nothing and the
   * declaration collapses into a self-reference. Every font silently falls back
   * to the browser default, with no error anywhere. The fix is a LITERAL family
   * name in `@theme inline` and the `next/font` variable classes on `<html>`.
   */
  it("never declares a theme font as a self-reference", () => {
    const themeBlock = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(GLOBALS_CSS);

    expect(themeBlock).not.toBeNull();

    const body = themeBlock?.[1] ?? "";
    const selfReferences = [
      ...body.matchAll(/--font-([a-z-]+):\s*var\(--font-\1\)/g),
    ];

    expect(selfReferences).toHaveLength(0);
  });

  it("names each family literally, so a runtime-injected variable is not required", () => {
    const themeBlock = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(GLOBALS_CSS);
    const body = themeBlock?.[1] ?? "";

    expect(body).toMatch(/--font-sans:[^;]*"Hanken Grotesk"/);
    expect(body).toMatch(/--font-display:[^;]*"Yeseva One"/);
    expect(body).toMatch(/--font-script:[^;]*"Caveat"/);
  });
});

describe("the console input rule", () => {
  it("sets every console field to at least the iOS zoom threshold", () => {
    expect(GLOBALS_CSS).toContain(`${CONSOLE_INPUT_MIN_FONT_SIZE_PX}px`);
    // The rule has to be a floor on the COMPUTED size, so it may not be
    // undercut by a viewport-scoped override further down the cascade.
    expect(GLOBALS_CSS).not.toMatch(/font-size:\s*15px/);
  });
});

describe("motion", () => {
  it("honours prefers-reduced-motion", () => {
    expect(GLOBALS_CSS).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    );
  });

  it("declares no transition longer than the console's cap", () => {
    const durations = [...GLOBALS_CSS.matchAll(/(\d+)ms/g)].map((match) =>
      Number(match[1]),
    );

    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) {
      expect(duration).toBeLessThanOrEqual(CONSOLE_TRANSITION_MAX_MS);
    }
  });
});
