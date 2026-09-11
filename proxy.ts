import type { NextRequest } from "next/server";

import { updateOperatorSession } from "@/lib/proxy/operator-session";

/**
 * Named `proxy` rather than `middleware`: Next.js 16.3 deprecated the
 * `middleware` file convention in favour of this one, and warns on every build
 * that uses it. The API and the semantics are unchanged — this still runs
 * before the matched routes, on the server, and returns the response.
 */
export default async function proxy(request: NextRequest) {
  return updateOperatorSession(request);
}

export const config = {
  /**
   * Console routes only.
   *
   * Written as a literal because Next.js reads this config statically at build
   * time and rejects a value it cannot evaluate — so it cannot be imported from
   * the module it belongs to.
   *
   * Widening it is a performance bug with a security-shaped excuse: the guest
   * invitation route would pay a Supabase auth round-trip on every open to
   * answer a question it never asks, and its single unlock path does not read
   * an operator session at all.
   */
  matcher: ["/console/:path*"],
};
