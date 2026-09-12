import type { ReactNode } from "react";

import { cn } from "cn";

/**
 * The console's frame.
 *
 * Layout only. It fetches nothing and decides nothing about the session: the
 * `(authenticated)` layout above it calls `requireOperator()` and
 * `requireDeclaredDevice()`, and a shell that re-asked would be a second
 * authorization surface for a reviewer to keep in their head.
 *
 * IT DECLARES THE GRAPHITE SURFACE, AND THAT IS LOAD-BEARING. The document default
 * is paper, because the guest-facing invitation is the thing a guest is given and
 * a forgotten opt-out there would ship a wedding invitation on a near-black page.
 * The console opts IN, here, once.
 *
 * THE CONTENT'S BOTTOM PADDING IS THE BAR'S HEIGHT, READ FROM THE SAME VARIABLE.
 * A literal here and a literal in the bar drift, and the way they drift is the last
 * row of the guest list sitting permanently underneath the tab bar — on the one
 * screen size the operators actually use.
 */

export interface ConsoleShellProps {
  /** The navigation. Both renderings of it: sidebar and bottom bar. */
  readonly nav: ReactNode;
  /** Who is signed in, and the two links out. `null` where there is no session. */
  readonly header: ReactNode;
  readonly children: ReactNode;
  /** Any class hook the layout wants preserved on the shell's root. */
  readonly className?: string;
}

export function ConsoleShell({
  nav,
  header,
  children,
  className,
}: ConsoleShellProps) {
  return (
    <div
      data-slot="console-shell"
      className={cn(
        "console-surface min-h-dvh bg-background text-foreground",
        className,
      )}
    >
      {/*
        First focusable element in the document, and visible only once focused.
        The sidebar is four links deep; without this, reaching the guest list by
        keyboard means tabbing past all of them on every page load.
      */}
      <a
        href="#console-content"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Saltar al contenido
      </a>

      <div className="flex min-h-dvh">
        {nav}

        <div className="flex min-w-0 flex-1 flex-col">
          {header}

          <main
            data-slot="console-content"
            id="console-content"
            className="min-w-0 flex-1 px-4 py-4 md:px-6"
            style={{ paddingBottom: "var(--console-tabbar-height)" }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
