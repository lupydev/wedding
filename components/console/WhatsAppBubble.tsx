import {
  MESSAGE_PREVIEW_APPROXIMATE_LABEL,
  MESSAGE_PREVIEW_DIVERGENCES,
  describeMessageLength,
} from "@/lib/domain/message-preview";

/**
 * A mock WhatsApp chat bubble for one invitation draft.
 *
 * WHAT IS REAL HERE AND WHAT IS NOT
 *
 * The chrome is a drawing. The rounded bubble, the card layout, the line
 * breaks — none of it is WhatsApp's renderer, and the pane says so out loud
 * rather than letting the operator infer it. `MESSAGE_PREVIEW_DIVERGENCES`
 * names each known difference; they are pinned by tests in
 * `lib/domain/message-preview.spec.ts` so a markup refactor cannot quietly drop
 * one.
 *
 * The IMAGE is real, and it is the whole reason this component earns its place.
 * It is the actual card the crawler will fetch, which is what catches a wrong
 * household name, a clipped line or a broken accent before a message goes out.
 *
 * WHY THE SRC IS THE ADVERTISED URL AND NOT THE ROUTE PATH
 *
 * Next.js appends a build-scoped hash to the `og:image` it emits
 * (`.../opengraph-image?88f8dd53`), and a CDN keys its cache on the full URL
 * INCLUDING that query. `<img src="/i/{slug}/opengraph-image">` is therefore a
 * DIFFERENT cache entry from the one WhatsApp fetches: the operator would see a
 * genuine card while the entry the crawler later requests stayed cold. A
 * cache-busting parameter would be a third entry and strictly worse.
 *
 * So the route resolves the advertised path through
 * `resolveAdvertisedCardPath` and hands it here as a prop. That is what makes
 * "previewing IS warming" true rather than merely intended: opening this pane
 * puts a fetch of exactly the crawler's URL into the CDN.
 *
 * `cardImagePath` is nullable because that resolution can fail. When it does,
 * the pane says the card could not be loaded instead of falling back to the
 * bare path — a fallback would warm the wrong entry and silently re-introduce
 * the bug this prop exists to prevent.
 *
 * Props-only and synchronous, like every component in `components/**`: it
 * performs no data access, so it cannot be handed a phone number by accident.
 *
 * Operator-facing copy is Spanish, neutral register.
 */

export interface WhatsAppBubbleProps {
  /** The exact prefilled draft, already rendered for this household. */
  readonly messageText: string;
  /** The raw `wa.me` URL, encoded exactly as it will be opened. */
  readonly waUrl: string;
  /**
   * The card URL the invitation page ADVERTISES, as a same-origin path.
   *
   * `null` when it could not be resolved. Never the bare route path: see above.
   */
  readonly cardImagePath: string | null;
  /** `og:title`, as WhatsApp will read it. */
  readonly cardTitle: string;
  /** `og:description`, as WhatsApp will read it. */
  readonly cardDescription: string;
  /** The host WhatsApp shows under the card. A label, never a link. */
  readonly cardLinkLabel: string;
}

export function WhatsAppBubble({
  messageText,
  waUrl,
  cardImagePath,
  cardTitle,
  cardDescription,
  cardLinkLabel,
}: WhatsAppBubbleProps) {
  const length = describeMessageLength(messageText);

  return (
    <section className="wa-preview" aria-label="Vista previa del mensaje">
      <p className="wa-preview__label">{MESSAGE_PREVIEW_APPROXIMATE_LABEL}</p>

      <div className="wa-preview__bubble">
        <div className="wa-preview__card">
          {cardImagePath === null ? (
            <p className="wa-preview__card-missing">
              No se pudo cargar la tarjeta de vista previa. El mensaje se puede
              enviar igual: WhatsApp la genera por su cuenta al abrir el enlace.
            </p>
          ) : (
            /*
              A plain <img>, never next/image. The optimizer would rewrite this
              into `/_next/image?url=...`, which is a different URL and
              therefore a different CDN cache entry — exactly the mistake the
              advertised path exists to avoid. No width or height either: the
              card's dimensions are the ones the OG route emits, and repeating
              them here would be a second source of truth.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="wa-preview__card-image"
              src={cardImagePath}
              alt={`Tarjeta de vista previa de la invitación de ${cardTitle}`}
            />
          )}

          <div className="wa-preview__card-text">
            <p className="wa-preview__card-title">{cardTitle}</p>
            <p className="wa-preview__card-description">{cardDescription}</p>
            {/* A label, not an anchor: nothing in this pane may be a second
                route to the send that records no `link_opened` event. */}
            <p className="wa-preview__card-host">{cardLinkLabel}</p>
          </div>
        </div>

        <p className="wa-preview__text">{messageText}</p>
      </div>

      <p className="wa-preview__length">{length.sentence}</p>

      <p className="wa-preview__url-label">Enlace que se abrirá:</p>
      <p className="wa-preview__url">{waUrl}</p>

      <div className="wa-preview__divergences">
        <p>En qué se diferencia esta vista previa de WhatsApp de verdad:</p>
        <ul>
          {MESSAGE_PREVIEW_DIVERGENCES.map((divergence) => (
            <li key={divergence}>{divergence}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
