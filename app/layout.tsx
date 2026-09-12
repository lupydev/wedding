import type { Metadata } from "next";
import { Caveat, Hanken_Grotesk, Yeseva_One } from "next/font/google";

import "./globals.css";

/**
 * THE TYPE IS WHAT BINDS THE TWO PALETTES.
 *
 * The console is graphite and the invitation is paper, deliberately. What makes
 * the console legible as the back room OF THIS EVENT rather than a generic admin
 * tool pointed at it is that both surfaces are set in the same three families.
 * They are loaded here, once, at the root — not per surface — because a font
 * loaded twice is downloaded twice.
 *
 * `display: "swap"` on all three. The alternative, `block`, shows NOTHING for up
 * to three seconds; an operator on a phone in a venue car park reads fallback
 * text far more happily than blank space.
 *
 * THE VARIABLE CLASSES GO ON `<html>`, NOT `<body>`.
 *
 * Tailwind v4 resolves custom properties inside `@theme inline` at PARSE time. A
 * variable that only exists from `<body>` downwards is a variable the theme layer
 * never sees — which is why `app/globals.css` names each family LITERALLY and
 * treats these variables as a convenience for hand-written CSS rather than as the
 * mechanism. Putting them at the document root costs nothing and removes the
 * question.
 */

/** Display: headings and figures. Yeseva One ships 400 and only 400. */
const yesevaOne = Yeseva_One({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-yeseva-one",
});

/** Body: everything that is read rather than glanced at. */
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});

/**
 * Script accents.
 *
 * `preload: false`, deliberately. Caveat is decorative and it is ALWAYS below the
 * title — there is no first paint it participates in. Preloading it would make it
 * compete for the connection with the family painting the first visible text,
 * which is the opposite of what preloading is for.
 */
const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-caveat",
});

// `metadataBase` makes relative Open Graph paths (including the
// `opengraph-image` file convention) resolve to absolute HTTPS URLs. Without
// it the emitted `og:image` stays relative and external crawlers cannot fetch
// it. The deployed origin comes from the environment; localhost is the
// development fallback.
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${yesevaOne.variable} ${hankenGrotesk.variable} ${caveat.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
