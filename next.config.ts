import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable streaming metadata for every user agent.
  //
  // Next.js streams `generateMetadata` output near `</body>` and only blocks
  // for user agents matching its built-in bot list. WhatsApp's crawler does not
  // execute JavaScript and must find the per-guest Open Graph tags inside the
  // `<head>` of the first HTML response. Matching every user agent removes the
  // dependency on a User-Agent string, whose silent miss would produce a blank
  // preview card with no error anywhere.
  //
  // Key placement verified against the installed Next.js version (16.3.4):
  // `htmlLimitedBots` is a top-level `NextConfig` option here. It lived under
  // `experimental` on 15.2 and was promoted to the top level afterwards.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
