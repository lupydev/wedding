import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
