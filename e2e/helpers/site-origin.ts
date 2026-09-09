/**
 * The origin the server under test is built with.
 *
 * The Open Graph specification the product depends on is that `og:image` is an
 * absolute HTTPS URL: a relative one yields no preview card at all. The local
 * server necessarily listens on plain HTTP, so the deployed origin is injected
 * separately from the address Playwright connects to. That mirrors production,
 * where `NEXT_PUBLIC_SITE_ORIGIN` is the public origin and the process listens
 * behind it.
 *
 * Both `playwright.config.ts` (which passes it to the server) and the specs
 * (which assert against it) read this single value, so they cannot disagree.
 */
export const E2E_SITE_ORIGIN =
  process.env.E2E_SITE_ORIGIN ?? "https://boda.e2e.test";
