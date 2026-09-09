import "server-only";

/**
 * The address the rate limiter counts against, and nothing else.
 *
 * The per-IP scope in `lib/domain/rate-limit.ts` is one of the gate's two
 * locks. It only locks anything if the visitor cannot choose their own bucket.
 * Read a value the client sent and the attacker simply sends a different one
 * per request: the counter never reaches its threshold and the scope becomes
 * decoration.
 *
 * So the rule here is narrow on purpose. A header is read ONLY when the
 * platform both computed it and refuses to forward a client's version of it,
 * and only while the platform says it is the one running this process.
 *
 * Verified against Vercel's own documentation rather than assumed
 * (`https://vercel.com/docs/headers/request-headers`, last updated
 * 2025-12-13):
 *
 *  - `x-forwarded-for` — "If you are trying to use Vercel behind a proxy, we
 *    currently overwrite the X-Forwarded-For header and do not forward external
 *    IPs. This restriction is in place to prevent IP spoofing." The overwrite
 *    is what made the previous implementation safe on a default deployment, but
 *    the same page sells "Custom X-Forwarded-For IP" through Trusted Proxy on
 *    Enterprise, which turns this header back into customer-proxy input. A
 *    security property that depends on a billing plan is not one, so this
 *    header is never read.
 *  - `x-vercel-forwarded-for` — "identical to the x-forwarded-for header.
 *    However, x-forwarded-for could be overwritten if you're using a proxy on
 *    top of Vercel." It is the platform's own value and survives that case,
 *    which is why it comes first.
 *  - `x-real-ip` — "identical to the x-forwarded-for header", and the ONLY
 *    header `@vercel/functions@3.9.6` reads for `ipAddress()`
 *    (`IP_HEADER_NAME = "x-real-ip"`, documented there as "Client IP as
 *    calculated by Vercel Proxy"). Second, as the platform's own fallback.
 *
 * Off Vercel none of that holds: `next dev`, `next start`, a container or any
 * self-hosted Node process will hand back whatever the client typed into any of
 * these headers. There, the honest answer is that no trustworthy address exists
 * — so every visitor shares one bucket. That is coarse, and it is the correct
 * direction to fail: a shared lockout inconveniences visitors who share an
 * origin, while a client-chosen bucket removes the lock altogether.
 */

/**
 * The headers the deployment platform computes, in order of preference.
 *
 * `x-forwarded-for` is deliberately absent and must stay absent.
 */
export const TRUSTED_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "x-real-ip",
] as const;

/**
 * The bucket every request falls into when no trustworthy address exists.
 *
 * Deliberately not IP-shaped: it must never collide with a real address, and
 * `hashClientIp` maps it to one constant `ip_hash` like any other value.
 */
export const SHARED_RATE_LIMIT_BUCKET = "shared-untrusted-origin";

/** The read-only slice of a `Headers` object this module needs. */
export interface RequestHeaders {
  get(name: string): string | null | undefined;
}

/** Is this process running on Vercel, as Vercel itself reports it? */
function onVercel(): boolean {
  // `VERCEL = 1` is a system environment variable exposed at both build and
  // runtime. A project with system variables switched off has no `VERCEL`, and
  // then this returns false — which costs bucket granularity, never safety.
  return process.env.VERCEL === "1";
}

/**
 * The rate-limit bucket for this request. Never client-settable.
 *
 * Whole values are used exactly as the platform produced them; nothing is split
 * on commas. Vercel supplies a single address, and comma-splitting was the
 * shape of the original defect — it is a parser for a list only an untrusted
 * intermediary would produce.
 */
export function trustedClientIp(headers: RequestHeaders): string {
  if (!onVercel()) {
    return SHARED_RATE_LIMIT_BUCKET;
  }

  for (const header of TRUSTED_IP_HEADERS) {
    const value = headers.get(header)?.trim();

    if (value) {
      return value;
    }
  }

  return SHARED_RATE_LIMIT_BUCKET;
}
