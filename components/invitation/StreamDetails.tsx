/**
 * The way in to the ceremony, wherever it is offered.
 *
 * ONE BLOCK, TWO SURFACES, AND THAT IS THE WHOLE REASON IT EXISTS.
 *
 * `CeremonyStream` shows this to a household behind the phone gate that told us
 * they cannot come in person. `/transmision` shows it to everybody else,
 * publicly. Migration 0009 states the rule for the row itself — "every surface
 * that shows them MUST read this row; never restate a value" — and this file is
 * that rule one level up: the label, the safety attributes on the link and the
 * decision about what an unfinished row looks like are written once.
 *
 * IT USED TO BE A LIST OF CREDENTIALS, AND THE HISTORY EXPLAINS THE SHAPE.
 *
 * Zoom is a meeting id and a passcode: values a guest READS and TYPES into
 * another application, on a phone, often while the ceremony has already
 * started. So this rendered them large, in a description list, each with a
 * button that removed the typing — a surface built for transcription, in a
 * grotesque with tabular figures so a 1 could not become a 7.
 *
 * Google Meet is one address, and the guest presses it. The couple removed the
 * printed address once the control existed — "en vista de que existe un botón
 * de ingresar a la reunión no valdría la pena tener el link para copiar" — and
 * with it went the copy button, the tabular figures, the description list and
 * this component's client boundary. What is left is a link.
 *
 * WHAT THAT COST, STATED RATHER THAN GLOSSED. A household behind the gate who
 * wants the address on a second device has to open their invitation there
 * instead of pasting a link. On `/transmision` nothing is lost at all: the page
 * is public, so forwarding it does everything forwarding the address did and
 * carries the day and the counter too.
 *
 * Props-only. It performs no data access, and its prop type has no field for a
 * phone number or a guest, so neither can reach it by accident.
 *
 * NO PALETTE OF ITS OWN, AND THAT IS LITERALLY TRUE. It used to SAY so while
 * reaching for `--foreground`, `--paper-hint` and `--border` — the paper
 * palette, right on the invitation's cream card and resolving to near-black on
 * near-black on the stream page's dark ground, where the values were rendered
 * and invisible. Everything here is `currentColor` and opacity, so the surface
 * decides and this cannot be wrong on either.
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
    /*
      A `<div>`, WHERE THIS USED TO BE A `<dl role="group">`.

      It was a description list because it held terms and values: a meeting id
      and a passcode, each with its label and a button that removed the typing.
      The couple asked for the address to go — "en vista de que existe un botón
      de ingresar a la reunión no valdría la pena tener el link para copiar" —
      and a description list describing nothing is invalid markup rather than
      merely odd.

      The group name went with it. One control needs no grouping: the link
      carries its own accessible name and says where it goes.

      The optional date/time line keeps a list of its own, because there the
      labels still have values.
    */
    <div
      /*
        A TEST HOOK NAMED AS ONE, WHERE A STYLING CLASS WAS PRETENDING.

        `rsvp__stream-details` carried no styles anywhere — it was already
        nothing but a locator, and five call sites across two specs and two
        browser files depended on it. A class is renamed by anybody tidying
        CSS, and the failure it produces is "element not found" five files
        away. `data-testid` says what it is and why it may not be renamed
        casually.

        It replaced a `role="group"` with an accessible name, which WAS a
        contract — but that described a list of labelled values to a reader,
        and there is one link here now.
      */
      data-testid="stream-details"
      className={`text-center ${className ?? ""}`}
    >
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
        ONE CONTROL, AND ONLY WHEN THERE IS SOMEWHERE TO GO.

        The migration seeds this column with an obviously-unfinished marker.
        Rendered as a link it would be a button that fails the one time it is
        pressed; left as the text it is, it reads as a value nobody has filled
        in yet — which, now that the address is not printed anywhere else, is
        also the only thing on the page that would say so.
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
            block w-full rounded-full border border-current/30 bg-black/25
            px-5 py-2.5 text-center text-sm backdrop-blur-sm transition-colors
            duration-(--console-motion-fast) ease-(--ease-console-out)
            hover:bg-black/40
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-current
          "
        >
          Entrar a la transmisión
        </a>
      ) : (
        <p className="text-sm font-medium tracking-wide break-all">
          {ceremony.streamUrl}
        </p>
      )}
    </div>
  );
}
