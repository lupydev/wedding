/**
 * Test-time stand-in for the `server-only` package.
 *
 * The real package throws on import outside a React Server Component, which is
 * exactly the guard we want in production and exactly what makes `lib/server/**`
 * unimportable from a plain Vitest node environment. Aliasing it here keeps the
 * production guard intact — the alias exists only in `vitest.config.mts` and is
 * never part of the Next.js build.
 */
export {};
