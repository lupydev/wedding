import {
  CalendarHeart,
  CheckCheck,
  ListOrdered,
  Smartphone,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  CONSOLE_NAV_ITEMS,
  type ConsoleNavIcon,
  type ConsoleNavItem,
  consoleNavActiveSignals,
  isConsoleNavItemActive,
} from "@/lib/design/console-nav";
import { cn } from "cn";

/**
 * The console's navigation: a sidebar above the breakpoint, a bottom bar below it.
 *
 * WHY TWO TREES AND NOT ONE THAT REFLOWS
 *
 * A sidebar item is a label with an icon beside it; a tab is an icon with a label
 * beneath it, at a smaller size, with a different touch target. One tree that
 * reflowed between those would put the bar's cramped labels in the sidebar or the
 * sidebar's padding in the bar. Two trees over ONE data source — `CONSOLE_NAV_ITEMS`
 * — is the trade: the shapes are independent, the destinations cannot diverge.
 *
 * WHY THIS TAKES A `pathname` PROP AND NOT `usePathname()`
 *
 * Every rule worth asserting lives here: which tab is active, that exactly one is,
 * and that the active one carries all three signals. Taking the path as a prop
 * makes all of that testable with no router mock at all, and leaves the hook in a
 * four-line client wrapper with no rules in it.
 *
 * ICONS COME FROM `lucide-react`, WHICH shadcn ALREADY DEPENDS ON. A reference
 * project declared `lucide-react` AND `framer-motion`, imported neither, and
 * carried roughly 100KB for nothing while hand-inlining SVG path data. Using the
 * dependency that is already there is both lighter and legible.
 */

const ICONS: Record<ConsoleNavIcon, ComponentType<{ className?: string }>> = {
  list: ListOrdered,
  check: CheckCheck,
  users: Users,
  phone: Smartphone,
  calendar: CalendarHeart,
};

/**
 * The geometric mark: the third signal, and the only one that is a SHAPE.
 *
 * Colour dies in daylight and for a colour-blind reader. Weight dies on a
 * low-resolution screen. A filled bar does not die, and it is the one an operator
 * can find without reading anything.
 *
 * `bg-foreground`, NOT `bg-primary`. Gold means "this needs your attention", and
 * "this is where you already are" is not that. A reference console spent its gold
 * on the active nav item — with white on top, at 2.36:1 — which is exactly how a
 * signal colour acquires a second meaning and stops signalling anything.
 */
function ActiveMark({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="nav-mark"
      className={cn("rounded-full bg-foreground", className)}
    />
  );
}

function SidebarItem({
  item,
  pathname,
}: {
  readonly item: ConsoleNavItem;
  readonly pathname: string;
}) {
  const active = isConsoleNavItemActive(item, pathname);
  const signals = consoleNavActiveSignals(active);
  const Icon = ICONS[item.icon];

  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-(--console-motion-fast) ease-(--ease-console-out) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        // The colour signal is the step from secondary to primary TEXT —
        // 6.18:1 to 12.91:1 on this surface — and not an accent colour.
        signals.color ? "text-foreground" : "text-muted-foreground",
        signals.weight ? "font-semibold" : "font-normal",
        active ? "bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      {signals.mark && (
        <ActiveMark className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-l-none" />
      )}
      <Icon className="size-4 shrink-0" />
      {item.label}
    </a>
  );
}

function TabItem({
  item,
  pathname,
}: {
  readonly item: ConsoleNavItem;
  readonly pathname: string;
}) {
  const active = isConsoleNavItemActive(item, pathname);
  const signals = consoleNavActiveSignals(active);
  const Icon = ICONS[item.icon];

  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // `min-h-11`: a 44px touch target, which is the smallest a thumb reliably
        // hits on a moving bus.
        "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[0.6875rem] transition-colors duration-(--console-motion-fast) ease-(--ease-console-out) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        signals.color ? "text-foreground" : "text-muted-foreground",
        signals.weight ? "font-semibold" : "font-normal",
      )}
    >
      {signals.mark && (
        <ActiveMark className="absolute top-0 h-[3px] w-8 rounded-t-none" />
      )}
      <Icon className="size-5 shrink-0" />
      {item.label}
    </a>
  );
}

export interface ConsoleNavProps {
  /** The current path, fragment and trailing slash both tolerated. */
  readonly pathname: string;
}

export function ConsoleNav({ pathname }: ConsoleNavProps) {
  return (
    <>
      {/*
        The sidebar. Hidden below the single breakpoint — `md`, 768px, the one
        number the whole shell changes shape at.

        IT IS PINNED, AND THAT IS NOT DECORATION. It shipped as a plain flex
        column with no positioning and no height, so it was as tall as its own
        links and scrolled away with the page. Two hundred households into the
        guest list the operator's navigation was above the top of the window, and
        the only route back to it was scrolling the whole list up again.

        STICKY, NOT FIXED. `fixed` takes it out of the flow and the content beside
        it slides underneath; `sticky` keeps the flex row's geometry intact, so the
        shell needs no compensating margin that could drift from the width.

        `dvh`, NOT `vh`. `100vh` is the viewport measured with a mobile browser's
        URL bar EXTENDED and it keeps that value after the bar retracts, so a
        `h-screen` sidebar is taller than the window holding it and its own last
        item cannot be reached. The sidebar appears from 768px up, which includes
        every tablet in portrait, and this shell is phone-first.

        The explicit height is also what makes `sticky` work at all here: a flex
        item with an `auto` cross size stretches to the row's full height, and an
        element as tall as its scroll container can never stick to anything.

        `overflow-y-auto` because a pinned element with a fixed height CLIPS
        whatever does not fit, silently — and the bar below the breakpoint renders
        the same destinations with no such limit.
      */}
      <nav
        aria-label="Navegación lateral del panel"
        data-slot="console-sidebar"
        className="hidden w-52 shrink-0 flex-col gap-1 border-r border-border p-3 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto"
      >
        {CONSOLE_NAV_ITEMS.map((item) => (
          <SidebarItem item={item} key={item.key} pathname={pathname} />
        ))}
      </nav>

      {/*
        The bottom bar. Its height is `--console-tabbar-height`, which already
        carries `env(safe-area-inset-bottom)`; the content's padding reads the same
        variable, so the two cannot drift apart.
      */}
      <nav
        aria-label="Navegación inferior del panel"
        data-slot="console-tabbar"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ height: "var(--console-tabbar-height)" }}
      >
        {CONSOLE_NAV_ITEMS.map((item) => (
          <TabItem item={item} key={item.key} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}
