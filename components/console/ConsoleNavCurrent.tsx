"use client";

import { usePathname } from "next/navigation";

import { ConsoleNav } from "./ConsoleNav";

/**
 * The four lines that know about the router, and nothing else.
 *
 * Every rule about the navigation — which tab is active, that exactly one is, that
 * the active one carries three redundant signals — lives in `ConsoleNav`, which
 * takes the path as a prop and is therefore testable with no router mock. This
 * wrapper exists so that stays true.
 */
export function ConsoleNavCurrent() {
  return <ConsoleNav pathname={usePathname()} />;
}
