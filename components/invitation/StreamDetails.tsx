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
export interface StreamDetailsValues {
  readonly ceremonyDate: string;
  readonly ceremonyTime: string;
  readonly streamMeetingId: string;
  readonly streamPasscode: string;
}

export function StreamDetails({
  ceremony,
  className,
  showDate = true,
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
   * The HOUR is never dropped: nothing above it says the hour, and a guest
   * joining a call needs one. The invitation behind the phone gate keeps both,
   * because it has no announcement above it.
   */
  readonly showDate?: boolean;
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
      className={className ?? "rsvp__stream-details"}
      role="group"
      aria-label="Detalles de la transmisión"
    >
      <div className="mb-4 flex items-baseline justify-center gap-2 text-sm opacity-70">
        {showDate ? (
          <>
            <dt className="sr-only">Fecha</dt>
            <dd className="m-0">{ceremony.ceremonyDate}</dd>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <dt className="sr-only">Hora</dt>
        <dd className="m-0">{ceremony.ceremonyTime}</dd>
      </div>

      <Credential
        label="ID de la reunión"
        value={ceremony.streamMeetingId}
        copyLabel="Copiar el ID de la reunión"
      />

      <Credential
        label="Clave de acceso"
        value={ceremony.streamPasscode}
        copyLabel="Copiar la clave de acceso"
      />
    </dl>
  );
}

/**
 * One value somebody is going to type into Zoom.
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

      <dd className="m-0 mt-1 flex items-center justify-between gap-3">
        <span className="text-xl font-semibold tracking-wide tabular-nums break-all">
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
