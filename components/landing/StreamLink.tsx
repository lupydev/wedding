"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { whyDisabled } from "@/components/ui/why-disabled";
import { WEDDING_INSTANT, formatWeddingDate } from "@/lib/domain/wedding-day";
import {
  STREAM_PATH,
  streamLinkIsOpen,
  streamLinkOpensAt,
} from "@/lib/domain/stream-window";

/**
 * The door to the stream invitation, which opens in the final week.
 *
 * A CLIENT COMPONENT THAT RENDERS THE CLOSED STATE ON THE SERVER.
 *
 * `/` is statically generated: whatever this decides on the server is decided
 * ONCE, at build time, and served from a CDN for weeks. Built in September it
 * would answer "not yet" forever — including on the morning of the wedding,
 * which is the one day the link has to be there.
 *
 * So the first render on both sides is the closed state, which is also the
 * honest answer for almost the whole life of this page, and the client corrects
 * it once it is running.
 *
 * `useSyncExternalStore` RATHER THAN A `useEffect` THAT CALLS `setState`.
 *
 * The clock is an external store, and this is the hook built for reading one:
 * `getServerSnapshot` answers during prerender and hydration, `getSnapshot`
 * answers afterwards, and React reconciles the two itself. Written as an effect
 * it also worked, and `react-hooks/set-state-in-effect` was right to reject it
 * — a synchronous `setState` in an effect is a second render React was never
 * asked for, and here it was a second render to compute a value that was
 * available during the first one.
 *
 * THE WAIT IS ABOUT ATTENTION, NOT SECRECY. `/transmision` has no gate and
 * anybody who types the path reaches it on any day. What waits is the OFFER:
 * the landing circulates for months as a save-the-date, and a joining link
 * sitting on it the whole time is one nobody reads in October and everybody has
 * forgotten by November.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

const LABEL = "Acompáñanos en la transmisión";

/**
 * One class string for both states.
 *
 * The control is a `<button>` before the window and an `<a>` inside it — two
 * different elements, because a link cannot be disabled and a disabled link
 * that still navigates is worse than no control at all. They must nonetheless
 * be the SAME object to a reader: identical words, identical shape, the only
 * change being that it becomes pressable.
 */
const PILL = `
  rounded-full border border-[#f6efe2]/25 bg-black/20 px-5 py-2.5
  text-sm text-[#f6efe2]/85 backdrop-blur-sm transition-colors
  duration-(--console-motion-fast) ease-(--ease-console-out)
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-[#f6efe2]
`;

/**
 * Nothing to subscribe to, and that is correct rather than lazy.
 *
 * The boundary this watches is a week wide. A visitor whose tab happens to be
 * open across the exact moment it opens sees the link on their next reload or
 * navigation — a second of staleness on a page they are no longer reading. The
 * alternative is a timer ticking for weeks to catch one instant.
 *
 * Defined at module scope so the reference is stable; a new function each
 * render would make React resubscribe every time.
 */
const subscribe = () => () => {};

/** Closed during prerender and hydration, on every render of every build. */
const closedOnServer = () => false;

export function StreamLink({
  ceremony = WEDDING_INSTANT,
}: {
  /** Injectable so the spec can pin an instant. Production uses the default. */
  readonly ceremony?: Date;
}) {
  const ceremonyMs = ceremony.getTime();

  /*
   * A boolean, which is what makes this safe to read during render.
   *
   * `getSnapshot` must return a value that compares equal across calls while
   * the store has not changed, or React re-renders forever looking for a stable
   * one. A primitive satisfies that by construction; an object rebuilt from the
   * clock each call would not.
   */
  const open = useSyncExternalStore(
    subscribe,
    () => streamLinkIsOpen(new Date(ceremonyMs), new Date()),
    closedOnServer,
  );

  if (open) {
    return (
      /*
       * `<Link>` rather than `<a>`: Next prefetches on hover and the stream
       * page reads the database, so the round trip starts before the tap lands.
       */
      <Link
        href={STREAM_PATH}
        className={`${PILL} hover:bg-black/40 hover:text-[#f6efe2]`}
      >
        {LABEL}
      </Link>
    );
  }

  const opensOn = formatWeddingDate(streamLinkOpensAt(new Date(ceremonyMs)));

  return (
    <div className="flex flex-col items-center gap-2">
      {/*
        `whyDisabled` puts the reason in a `title`, which is the project's rule:
        a disabled control that does not say why is a dead end.

        The reason is ALSO on screen, below, and that is not redundancy. A
        `title` appears on hover and there is no hover on a phone, which is
        where this page is read. The tooltip serves a mouse; the line serves
        everybody.
      */}
      <button
        type="button"
        {...whyDisabled(`El enlace se abre el ${opensOn}.`)}
        className={`${PILL} cursor-not-allowed opacity-55`}
      >
        {LABEL}
      </button>

      <p className="text-xs text-[#f6efe2]/60 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
        El enlace se abre el {opensOn}.
      </p>
    </div>
  );
}
