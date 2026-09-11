/**
 * What the console's mock WhatsApp bubble is allowed to claim — pure.
 *
 * WHY THE DISCLAIMERS ARE CODE AND NOT A COMMENT IN A COMPONENT
 *
 * A preview is useful exactly in proportion to how closely it matches the real
 * thing, and dangerous in exactly the same proportion: an operator who trusts
 * the mock stops reading the message, and a WhatsApp message cannot be recalled
 * once it is sent. Every line below names a specific way the mock is KNOWN to
 * be wrong, so that a difference the operator notices in a real chat reads as
 * "the preview said this would differ" rather than as a defect in the
 * invitation.
 *
 * They live here, pinned by tests, because a divergence quietly dropped during
 * a markup refactor is precisely the kind of loss nobody notices until it
 * matters. WhatsApp publishes none of this behavior, so there is no upstream
 * document to re-derive it from.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** The label the whole preview pane carries. */
export const MESSAGE_PREVIEW_APPROXIMATE_LABEL =
  "Aproximado — el resultado real varía según el dispositivo";

/**
 * Every way the mock is known to diverge from a real WhatsApp chat.
 *
 * Ordered from the most likely to be mistaken for a defect to the least.
 */
export const MESSAGE_PREVIEW_DIVERGENCES: readonly string[] = [
  "WhatsApp pliega los mensajes largos detrás de «Ver más». No publica a partir de cuántos caracteres lo hace, y el punto de corte cambia con el ancho de la pantalla y con el tamaño de letra que tenga configurado quien lo lee.",
  "La tarjeta puede dibujarse grande, con la imagen arriba, o pequeña, con una miniatura al lado. Esa elección es un comportamiento de la aplicación, no una garantía: la misma imagen puede verse de las dos formas.",
  "iOS, Android y WhatsApp Web no dibujan la tarjeta igual. Cambian los bordes, cuántas líneas de título se muestran y si la descripción aparece siquiera.",
  "Solo el primer enlace del mensaje genera vista previa. Un segundo enlace no añade otra tarjeta: quita la primera. Por eso la plantilla lleva un único enlace.",
  "La tarjeta aparece únicamente cuando WhatsApp ya descargó la imagen en el dispositivo de quien envía. Si todavía no la descargó, se ve texto plano durante unos segundos.",
  "La imagen de la tarjeta dibuja los emoji con el juego Twemoji, mientras que el texto del mensaje usa los emoji propios del dispositivo. No van a coincidir.",
];

/**
 * Where WhatsApp is ROUGHLY known to start collapsing a message.
 *
 * Explicitly an approximation, and treated as one everywhere it is used. The
 * real threshold is undocumented and depends on screen width and the reader's
 * font size, so the honest thing a preview can do is warn near the region where
 * folding becomes likely — never announce a limit, which would be a lie with a
 * number in it, and therefore the most believable kind.
 */
export const READ_MORE_APPROX_CHARACTERS = 650;

export interface MessageLengthDescription {
  readonly characters: number;
  /** `true` once the draft is long enough that folding becomes likely. */
  readonly mayCollapse: boolean;
  /** The operator-facing sentence. Always states the count. */
  readonly sentence: string;
}

/** Describes how long a draft is, and whether it is near the folding region. */
export function describeMessageLength(
  message: string,
): MessageLengthDescription {
  const characters = message.length;
  const mayCollapse = characters > READ_MORE_APPROX_CHARACTERS;

  return {
    characters,
    mayCollapse,
    sentence: mayCollapse
      ? `${characters} caracteres. A partir de aproximadamente ${READ_MORE_APPROX_CHARACTERS} WhatsApp suele plegar el mensaje detrás de «Ver más»; el punto exacto no está documentado.`
      : `${characters} caracteres.`,
  };
}
