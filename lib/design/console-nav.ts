import { CONSOLE_DEVICE_PATH } from "@/lib/domain/device-declaration";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { CONSOLE_WEDDING_PATH } from "@/lib/domain/wedding-facts";

/**
 * The console shell's navigation, as data rather than as markup.
 *
 * ONE BREAKPOINT. THE WHOLE SHELL. NO EXCEPTIONS.
 *
 * A reference console flipped its table layout at 600px and its navigation at
 * 900px. Between those widths — every tablet, every landscape phone, every
 * half-width desktop window — it rendered a phone tab bar underneath a six-column
 * desktop table. Nobody designed that layout; it was the arithmetic of two
 * independent decisions. One number removes the possibility.
 *
 * Sidebar above the breakpoint, bottom tab bar below. `tools/console-one-breakpoint.spec.ts`
 * reads every console source file and fails on any responsive variant other than
 * the one named here, so the rule survives the next screen somebody adds.
 */

/** The one width at which the console changes shape. */
export const CONSOLE_BREAKPOINT_PX = 768;

/**
 * The Tailwind variant matching that width.
 *
 * Both are exported so a reviewer can check the class against the number: `md` is
 * `48rem`, which is 768px at the default root font size.
 */
export const CONSOLE_BREAKPOINT_VARIANT = "md";

/**
 * The bar's height before the home-indicator inset.
 *
 * 56px is the smallest bar that still gives each tab a 44px touch target with a
 * readable label beneath it. The safe-area inset is added in CSS, once, as
 * `--console-tabbar-height` — and the content's bottom padding reads that same
 * variable rather than repeating the arithmetic, because two literals drift and
 * the way they drift is the last row of the guest list living under the bar.
 */
export const CONSOLE_TABBAR_BASE_PX = 56;

/** Which lucide icon a tab draws. Resolved in the component, not here. */
export type ConsoleNavIcon = "list" | "check" | "users" | "phone" | "calendar";

export interface ConsoleNavItem {
  readonly key: string;
  readonly href: string;
  /**
   * The tab's label.
   *
   * Short enough to sit under an icon on the narrowest phone without wrapping.
   * The length is asserted, because a label that wraps makes the bar taller than
   * the height the content's padding was calculated from.
   */
  readonly label: string;
  readonly icon: ConsoleNavIcon;
}

/**
 * FIVE TABS, AND STILL NO OVERFLOW SHEET.
 *
 * It was four, and the reason was worth writing down: the console had exactly
 * four destinations needing no invitation id. Work Unit 9 added the fifth, the
 * page where either operator edits the wedding's own facts — a real route, not a
 * fragment, and the only place those facts can be corrected now that no component
 * holds them.
 *
 * FIVE IS THE CEILING, AND IT IS NOT AN ARBITRARY ONE. Five labelled tabs fit
 * across the narrowest phone this console targets while each keeps its 44px touch
 * target. A sixth would need an overflow sheet, and an overflow sheet is where a
 * destination goes to be forgotten. `console-nav.spec.ts` asserts the ceiling, so
 * the next destination has to argue with a failing test rather than with a
 * comment.
 *
 * Signing out is deliberately NOT here — a bottom bar sits under the operator's
 * thumb, and an accidental sign-out in the middle of a dispatch run costs a
 * re-authentication on a phone in a venue. It lives in the header, where it is
 * reached on purpose. The compose and preview routes are per-household and need
 * an invitation id, so they are reached from a row rather than from the bar.
 *
 * THREE DESTINATIONS, AND THERE WERE FIVE.
 *
 * Two of them — "Revisión" and "Evento" — were FRAGMENTS of the console root,
 * so three of the five tabs led to the same page. Worse, `isConsoleNavItemActive`
 * hard-codes a fragment tab never to highlight, which means the bar could not
 * show where you were whenever you were on one of them. A tab bar whose
 * majority is one page, and which cannot say so, is not navigation.
 *
 * What is left is three real places: the invitations, the wedding's own facts,
 * and which WhatsApp account this handset holds.
 */
export const CONSOLE_NAV_ITEMS: readonly ConsoleNavItem[] = [
  {
    key: "mine",
    href: CONSOLE_ROOT_PATH,
    label: "Invitaciones",
    icon: "list",
  },
  {
    key: "wedding",
    href: CONSOLE_WEDDING_PATH,
    // "Boda" and not "Datos de la boda": the label sits under an icon on the
    // narrowest phone, and a label that wraps makes the bar taller than the
    // height the content's bottom padding was calculated from.
    label: "Boda",
    icon: "calendar",
  },
  {
    key: "device",
    href: CONSOLE_DEVICE_PATH,
    label: "Dispositivo",
    icon: "phone",
  },
];

/** Strips the fragment and any trailing slash, leaving a comparable path. */
function normalizePath(value: string): string {
  const withoutFragment = value.split("#")[0];

  return withoutFragment.length > 1 && withoutFragment.endsWith("/")
    ? withoutFragment.slice(0, -1)
    : withoutFragment;
}

/**
 * Whether a tab is the one the operator is looking at.
 *
 * EXACT MATCH FOR THE ROOT, PREFIX MATCH BELOW IT. Prefix matching alone would
 * light every tab at once, because every console href starts with `/console`.
 * Exact matching alone would leave `/console/device/anything` with no active tab,
 * and a bar with nothing highlighted reads as a bar that is broken.
 *
 * A JUMP LINK IS NEVER ACTIVE. Two tabs point at fragments of the console root, and
 * `usePathname()` never carries a hash — so treating a fragment as a path made all
 * three of those tabs active at once on `/console`. Three highlighted tabs is worse
 * than none: it says the bar does not know where the operator is. The root tab owns
 * `/console`; the jump links are navigation WITHIN the page it already renders.
 */
export function isConsoleNavItemActive(
  item: Pick<ConsoleNavItem, "href">,
  pathname: string,
): boolean {
  if (item.href.includes("#")) {
    return false;
  }

  const target = normalizePath(item.href);
  const current = normalizePath(pathname);

  if (target === CONSOLE_ROOT_PATH) {
    return current === CONSOLE_ROOT_PATH;
  }

  return current === target || current.startsWith(`${target}/`);
}

/** The three independent ways an active tab announces itself. */
export interface ConsoleNavActiveSignals {
  /** The gold foreground. Invisible in daylight and to a colour-blind reader. */
  readonly color: boolean;
  /** Heavier type. Survives a washed-out screen, not a low-resolution one. */
  readonly weight: boolean;
  /** A geometric mark. Survives both, and greyscale printing besides. */
  readonly mark: boolean;
}

/**
 * THREE REDUNDANT SIGNALS, NOT ONE.
 *
 * The operator is holding a phone outdoors at whatever brightness the battery has
 * left. A colour-only active state is invisible there, and invisible to a
 * colour-blind reader in perfect light. Colour, weight and a geometric mark each
 * survive a different failure, so all three are present or none are.
 *
 * A function rather than three booleans at the call site, because "all three or
 * none" is the rule and a call site that can set them independently can break it.
 */
export function consoleNavActiveSignals(
  isActive: boolean,
): ConsoleNavActiveSignals {
  return { color: isActive, weight: isActive, mark: isActive };
}
