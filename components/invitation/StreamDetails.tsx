"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * The four values a guest needs in order to join the ceremony.
 *
 * ONE BLOCK, TWO SURFACES, AND THAT IS THE WHOLE REASON IT EXISTS.
 *
 * `CeremonyStream` shows these to a household behind the phone gate that told
 * us they cannot come in person. `/transmision` shows them to everybody else,
 * publicly. Migration 0009 states the rule for the row itself — "every surface
 * that shows them MUST read this row; never restate a value" — and this file is
 * that rule one level up: the labels, their order, and the decision to render
 * values verbatim are written once instead of twice.
 *
 * NOT ALL FOUR ARE THE SAME KIND OF THING, AND THE FIRST DESIGN PRETENDED THEY
 * WERE.
 *
 * It rendered four identical rows in two columns. But the date and the time are
 * READ — context, glanced at once — while the meeting id and the passcode are
 * TRANSCRIBED: typed into another application, on a phone, often while the
 * ceremony is already starting. Giving an eleven digit number the same weight
 * as the word "Fecha" is what made the card feel like a form.
 *
 * So the date and time became a quiet caption, the two credentials became the
 * content, and each of them carries a button that removes the typing
 * altogether. The labels for the caption are still in the markup and still read
 * aloud — they are `sr-only`, not deleted, because "28-11-2026 · 5:00 p. m."
 * needs no label to a reader and very much needs one to a screen reader.
 *
 * Props-only apart from the copy state. It performs no data access, and its
 * prop type has no field for a phone number or a guest, so neither can reach it
 * by accident.
 *
 * NO PALETTE OF ITS OWN, AND THAT IS NOW LITERALLY TRUE.
 *
 * It used to SAY so while reaching for `--foreground`, `--paper-hint` and
 * `--border`. Those are the paper palette, which is the document default, so on
 * the invitation's cream card they were right and on the stream page's dark
 * ground `--foreground` resolved to a near-black on near-black: the values were
 * rendered and invisible. Everything here is `currentColor` and opacity now, so
 * the surface decides and this cannot be wrong on either.
 *
 * Guest-facing copy is Spanish, neutral register. Identifiers and comments stay
 * English.
 */

/** The stream half of the `ceremony` row, as a component renders it. */
/**
 * Is this value somewhere a browser can actually go?
 *
 * The row is seeded with an unfinished marker and the console refuses to save
 * anything that is not an absolute `https` address, so in practice this asks
 * one question: has the couple filled it in yet? Checked here anyway rather
 * than trusted, because this component is also rendered from the operator
 * preview and from a row an older migration wrote.
 */
function isJoinable(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export interface StreamDetailsValues {
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamUrl: string;
}

export function StreamDetails({
  ceremony,
  className,
  showDate = true,
  showTime = true,
}: {
  readonly ceremony: StreamDetailsValues;
  /** The host surface's own spacing. Never its colours. */
  readonly className?: string;
  /**
   * Whether to state the day, or leave it to something above.
   *
   * False on `/transmision`, where the landing's announcement sits directly
   * above this block and names the day in prose. Repeating it put the same
   * date on one small screen twice in two formats — "sábado, 28 de noviembre
   * de 2026" and "28-11-2026" — which reads as a defect however good each
   * reason is.
   *
   * The invitation behind the phone gate keeps both, because it has no
   * announcement above it.
   */
  readonly showDate?: boolean;
  /**
   * Whether to print the hour.
   *
   * DROPPED WHERE A COUNTER ALREADY LANDS ON IT. `/transmision` runs a
   * countdown to the ceremony instant, so printing "5:00 p. m." underneath is
   * the same fact stated twice — and the add-to-calendar button beside it
   * carries the precise time for anybody who wants to keep it.
   *
   * The couple asked for this in those terms: "hay que eliminar la hora ya que
   * el contador llega hasta el día 28 de noviembre a las 5:00pm".
   */
  readonly showTime?: boolean;
}) {
  return (
    /*
     * `role="group"` with a name, rather than a bare `<dl>`: it gives assistive
     * technology one addressable thing called "Detalles de la transmisión"
     * instead of four loose term/definition pairs adrift on the page.
     *
     * Every value is rendered exactly as the row holds it, including the seeded
     * `{{...}}` placeholders. Hiding or prettifying an unfinished value would
     * turn an obviously incomplete invitation into a plausible wrong one, and
     * nobody would notice until a guest joined a call that does not exist.
     */
    <dl
      /*
        THE CALLER'S CLASS IS ADDED, NOT SUBSTITUTED, AND THAT IS THE FIX.

        It used to be `className ?? "rsvp__stream-details"` — a caller's value
        REPLACED everything this component wanted. Both callers passed
        `text-left`, so the alignment could not be decided here at all: a block
        centred by default and left-aligned by every caller is centred by
        nobody. The couple saw the result — the address at one edge, the copy
        control at the other, and centred buttons directly beneath.
      */
      className={`rsvp__stream-details text-center ${className ?? ""}`}
      role="group"
      aria-label="Detalles de la transmisión"
    >
      {/*
        THE LINE ITSELF GOES WHEN IT WOULD BE EMPTY.

        `/transmision` drops both: the announcement above names the day in
        prose, and the countdown lands on the hour. Rendering the container
        anyway would leave a gap above the credentials that nobody put there on
        purpose.
      */}
      {(showDate || showTime) && (
        <div className="mb-4 flex items-baseline justify-center gap-2 text-sm opacity-70">
          {showDate ? (
            <>
              <dt className="sr-only">Fecha</dt>
              <dd className="m-0">{ceremony.ceremonyDate}</dd>
            </>
          ) : null}
          {showDate && showTime ? <span aria-hidden="true">·</span> : null}
          {showTime ? (
            <>
              <dt className="sr-only">Hora</dt>
              <dd className="m-0">{ceremony.ceremonyTime}</dd>
            </>
          ) : null}
        </div>
      )}

      {/*
        ONE ADDRESS, PRESSED RATHER THAN TRANSCRIBED.

        Zoom was two values a guest READ and TYPED into an app, which is why
        this block was a list of credentials set in a grotesque so a 1 could
        not become a 7. Meet is a link. Leaving it as a value to copy would
        have every guest doing by hand what an anchor does by itself.

        THE ADDRESS STAYS VISIBLE, and the copy control with it: a guest
        reading on a laptop joins from their phone, one who cannot join
        forwards it to somebody who can, and a button whose destination is
        invisible is a button nobody can check before the day.
      */}
      <Credential
        label="Enlace de la transmisión"
        value={ceremony.streamUrl}
        copyLabel="Copiar el enlace de la transmisión"
      />

      {/*
        AND THE CONTROL ITSELF — ONLY WHEN THERE IS SOMEWHERE TO GO.

        The migration seeds this column with an obviously-unfinished marker
        rather than an address. Rendered as a link it would be a control that
        fails on the one day it is pressed; left as the text it is, it reads as
        a value nobody has filled in yet — exactly as the venue's marker does,
        so an unfinished invitation cannot pass for a finished one.
      */}
      {isJoinable(ceremony.streamUrl) ? (
        <a
          href={ceremony.streamUrl}
          target="_blank"
          /*
           * `noopener` first, and not decoration: without it the opened tab
           * can reach back into this one through `window.opener`, and this
           * page sits behind a phone gate.
           */
          rel="noopener noreferrer"
          className="
            mt-4 block rounded-full border border-current/30 bg-black/25 px-5
            py-2.5 text-center text-sm backdrop-blur-sm transition-colors
            duration-(--console-motion-fast) ease-(--ease-console-out)
            hover:bg-black/40
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-current
          "
        >
          Entrar a la transmisión
        </a>
      ) : null}
    </dl>
  );
}

/**
 * One value somebody is going to read, copy, or forward.
 *
 * SET IN THE SANS, NOT THE DISPLAY FACE, AND THAT IS A CORRECTION.
 *
 * It was `font-display` — Yeseva One — beside a comment arguing that tabular
 * figures matter here. The two contradicted each other: Yeseva is a decorative
 * single-weight serif and does not carry a tabular set, so the utility asking
 * for one had nothing to apply. A meeting id is read one digit at a time, out
 * loud or under the breath, and the grotesque the body is already set in is the
 * face that keeps a 1 from becoming a 7. Elegance belongs to the heading above;
 * this is a string somebody has to get right.
 */
function Credential({
  label,
  value,
  copyLabel,
}: {
  readonly label: string;
  readonly value: string;
  readonly copyLabel: string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <dt className="text-[0.65rem] tracking-[0.18em] uppercase opacity-65">
        {label}
      </dt>

      {/*
        TOGETHER AND CENTRED, WHERE THIS USED TO BE `justify-between`.

        Pushing the value to one edge and the control to the other was right
        for TWO credentials: a meeting id and a passcode are a column an eye
        runs down while typing into another app, and a shared left edge is what
        makes that possible. There is one value now, read once, with a button
        beneath it.
      */}
      <dd className="m-0 mt-1 flex items-center justify-center gap-2">
        {/*
          SMALLER THAN IT WAS, AND `tabular-nums` IS GONE WITH THE DIGITS.

          `text-xl` and a tabular figure set were sized for a meeting id read
          ONE DIGIT AT A TIME, out loud or under the breath, where a 1 becoming
          a 7 is the whole failure. A URL is read once or copied, and it has no
          figures to align — at that size it wrapped onto a second line on a
          390px screen and left the copy control floating beside the remainder.
        */}
        <span className="text-sm font-medium tracking-wide break-all sm:text-base">
          {value}
        </span>
        <CopyButton value={value} label={copyLabel} />
      </dd>
    </div>
  );
}

/**
 * The button that removes the typing.
 *
 * ICON ONLY, AND THE CONFIRMATION IS AN ICON TOO. Its accessible name carries
 * everything — "Copiar el ID de la reunión", then "Copiado" — so the button
 * contributes no TEXT to the `<dd>` it sits in. That is what keeps the value
 * beside its label readable as exactly the value, by a screen reader and by
 * `StreamDetails.spec.tsx` alike.
 */
function CopyButton({
  value,
  label,
}: {
  readonly value: string;
  readonly label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      /*
       * `navigator.clipboard` IS UNDEFINED OUTSIDE A SECURE CONTEXT, and the
       * write can be refused by permission even inside one. Both land here.
       *
       * Swallowed, deliberately, and the state is NOT set: a button that says
       * "copiado" over an empty clipboard sends a guest to Zoom to paste
       * nothing, convinced they have the id. The value is on screen to read
       * either way, so failing quietly costs nothing and lying costs the call.
       */
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copiado" : label}
      className="
        flex size-9 shrink-0 items-center justify-center rounded-full
        opacity-65 transition-[opacity,background-color]
        duration-(--console-motion-fast) ease-(--ease-console-out)
        hover:bg-current/10 hover:opacity-100
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-current
      "
    >
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
    </button>
  );
}
